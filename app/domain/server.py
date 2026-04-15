from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any

import structlog
from slugify import slugify

from app.core.config import Settings
from app.schemas.server import ServerSchema

if TYPE_CHECKING:
    from app.services.pubsub import EventBus

log = structlog.get_logger()

_QUERY_INTERVAL = 5.0

# Game binary name per platform — matches arma-server npm package table
_BINARIES: dict[str, dict[str, str]] = {
    "linux": {
        "arma3": "arma3server",
        "arma3_x64": "arma3server_x64",
        "arma2oa": "arma2oaserver",
        "arma2": "arma2server",
        "arma1": "armaserver",
        "ofp": "ofpserver",
        "cwa": "cwaserver",
        "ofpresistance": "ofpresistanceserver",
    },
    "windows": {
        "arma3": "arma3server.exe",
        "arma3_x64": "arma3server_x64.exe",
        "arma2oa": "arma2oaserver.exe",
        "arma2": "arma2server.exe",
        "arma1": "armaserver.exe",
        "ofp": "ofpserver.exe",
        "cwa": "cwaserver.exe",
        "ofpresistance": "ofpresistanceserver.exe",
    },
    "wine": {
        "arma3": "arma3server.exe",
        "arma3_x64": "arma3server_x64.exe",
        "arma2oa": "arma2oaserver.exe",
        "arma2": "arma2server.exe",
        "arma1": "armaserver.exe",
    },
}


def _make_id(title: str) -> str:
    return slugify(title).replace(".", "-")


class Server:
    def __init__(self, schema: ServerSchema, settings: Settings, bus: EventBus) -> None:
        self._schema = schema
        self.settings = settings
        self.bus = bus
        self.id = _make_id(schema.title)

        # Runtime — not persisted
        self.pid: int | None = None
        self.state: dict[str, Any] | None = None
        self._process: asyncio.subprocess.Process | None = None
        self._hc_processes: list[asyncio.subprocess.Process] = []
        self._query_task: asyncio.Task[None] | None = None

    # --- Read-only property proxies ---
    @property
    def title(self) -> str:
        return self._schema.title

    @property
    def port(self) -> int:
        return self._schema.port

    @property
    def auto_start(self) -> bool:
        return self._schema.auto_start

    @property
    def mods(self) -> list[str]:
        return self._schema.mods

    @property
    def number_of_headless_clients(self) -> int:
        return self._schema.number_of_headless_clients

    # --- Mutation ---
    def update(self, data: dict[str, Any]) -> None:
        self._schema = self._schema.model_copy(update=data)
        self.id = _make_id(self._schema.title)

    # --- Serialisation ---
    def to_persisted_dict(self) -> dict[str, Any]:
        return self._schema.model_dump(exclude_none=False)

    def to_json(self) -> dict[str, Any]:
        d = self.to_persisted_dict()
        d["id"] = self.id
        d["pid"] = self.pid
        d["state"] = self.state
        return d

    # --- Process management ---
    def _binary(self) -> str:
        return _BINARIES.get(self.settings.type, {}).get(
            self.settings.game, "arma3server"
        )

    def _build_args(self, headless: bool = False) -> list[str]:
        from app.core.paths import game_dir

        cfg_path = game_dir(self.settings) / f"{self.id}.cfg"
        args: list[str] = [f"-port={self.port}", f"-config={cfg_path}"]

        if headless:
            args += [
                "-client",
                "-connect=127.0.0.1",
                f"-password={self._schema.password or ''}",
            ]

        mods = list(self._schema.mods)
        if self.settings.server_mods and not headless:
            mods = list(self.settings.server_mods) + mods
        if mods:
            args.append(f"-mod={';'.join(mods)}")

        if self._schema.file_patching:
            args.append("-filePatching")

        for p in self.settings.parameters or []:
            args.append(p)
        for p in self._schema.parameters or []:
            args.append(p)

        return args

    async def start(self) -> None:
        if self._process is not None:
            return

        self._write_configs()

        from app.core.paths import game_dir

        game_path = game_dir(self.settings)
        executable = str(game_path / self._binary())
        args = self._build_args()
        cmd = (["wine", executable] + args) if self.settings.type == "wine" else [executable] + args

        try:
            self._process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(game_path),
            )
        except OSError as exc:
            log.error("server start failed", id=self.id, error=str(exc))
            return

        self.pid = self._process.pid
        log.info("server started", id=self.id, pid=self.pid)

        asyncio.create_task(self._monitor())
        self._query_task = asyncio.create_task(self._poll_status())
        await self.bus.publish("servers", None)

    async def stop(self) -> None:
        if self._process is None:
            return

        self._process.terminate()
        try:
            await asyncio.wait_for(self._process.wait(), timeout=5.0)
        except TimeoutError:
            self._process.kill()

        await self._stop_hc()

    async def _monitor(self) -> None:
        if self._process:
            await self._process.wait()
        self._process = None
        self.pid = None
        self.state = None
        if self._query_task:
            self._query_task.cancel()
            self._query_task = None
        await self._stop_hc()
        await self.bus.publish("servers", None)

    async def _poll_status(self) -> None:
        from app.services.a2s import query_status

        while True:
            await asyncio.sleep(_QUERY_INTERVAL)
            if self._process is None:
                break
            result = await query_status(self.settings.game, "127.0.0.1", self.port)
            self.state = result
            if result and self.number_of_headless_clients > 0 and not self._hc_processes:
                await self._start_hc()
            await self.bus.publish("servers", None)

    async def _start_hc(self) -> None:
        from app.core.paths import game_dir

        game_path = game_dir(self.settings)
        executable = str(game_path / self._binary())
        args = self._build_args(headless=True)
        cmd = (["wine", executable] + args) if self.settings.type == "wine" else [executable] + args

        for i in range(self.number_of_headless_clients):
            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL,
                    cwd=str(game_path),
                )
                self._hc_processes.append(proc)
                log.info("headless client started", id=self.id, index=i + 1, pid=proc.pid)
            except OSError as exc:
                log.error("headless client start failed", id=self.id, error=str(exc))

    async def _stop_hc(self) -> None:
        for proc in self._hc_processes:
            try:
                proc.terminate()
            except ProcessLookupError:
                pass
        self._hc_processes = []

    def _write_configs(self) -> None:
        from app.core.paths import game_dir
        from app.domain.config_writer.basic_config import write_basic_cfg
        from app.domain.config_writer.profile_config import write_profile_cfg
        from app.domain.config_writer.server_config import write_server_cfg

        game_path = game_dir(self.settings)
        write_server_cfg(self._schema, self.settings, game_path / f"{self.id}.cfg")
        write_basic_cfg(game_path / "basic.cfg")
        if self._schema.forcedDifficulty == "Custom":
            write_profile_cfg(game_path / f"{self.id}.Arma3Profile")
