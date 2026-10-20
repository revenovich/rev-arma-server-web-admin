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


# Keeps `<id>.cfg` / `<id>.Arma3Profile` well under the 255-byte file-name limit
_MAX_ID_LENGTH = 100


def _make_id(title: str) -> str:
    return slugify(title, max_length=_MAX_ID_LENGTH).replace(".", "-")


def make_id(title: str) -> str:
    """Server id for *title* (empty when the title has no letters or digits)."""
    return _make_id(title)


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
        self._stopping = False
        # Why the last start() failed, and the mods it had to leave out
        self.last_error: str | None = None
        self.skipped_mods: list[str] = []

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

    def replace_schema(self, schema: ServerSchema) -> None:
        """Swap in an already-validated record (see Manager.update)."""
        self._schema = schema
        self.id = _make_id(schema.title)

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
        mods = self._launchable_mods(mods)
        if mods:
            args.append(f"-mod={';'.join(mods)}")

        if self._schema.file_patching:
            args.append("-filePatching")

        for p in self.settings.parameters or []:
            args.append(p)
        for p in self._schema.parameters or []:
            args.append(p)

        return args

    def _launchable_mods(self, mods: list[str]) -> list[str]:
        """Drop mods that aren't on disk or can't be written into `-mod=` (it splits on `;`).

        Arma refuses to start, or starts without them, when a `-mod` entry is missing.
        The dropped names are kept in `skipped_mods` for the start response.
        """
        from pathlib import Path

        from app.core.paths import game_dir

        root = game_dir(self.settings)
        kept: list[str] = []
        for mod in mods:
            path = Path(mod) if Path(mod).is_absolute() else root / mod.replace("\\", "/")
            if ";" in mod or not path.is_dir():
                if mod not in self.skipped_mods:
                    self.skipped_mods.append(mod)
                continue
            kept.append(mod)
        if self.skipped_mods:
            log.warning("mods left out of the launch", id=self.id, mods=self.skipped_mods)
        return kept

    async def start(self) -> None:
        if self._process is not None:
            return

        self._stopping = False
        self.last_error = None
        self.skipped_mods = []
        try:
            self._write_configs()
        except OSError as exc:
            self.last_error = f"Could not write the server config: {exc.strerror or exc}"
            log.error("server start failed", id=self.id, error=str(exc))
            return

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
        except NotImplementedError:
            log.error(
                "asyncio.create_subprocess_exec not supported on this event loop. "
                "On Windows, ProactorEventLoop is required. "
                "Set asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy()) "
                "before starting the event loop.",
                id=self.id,
            )
            self.last_error = "This event loop can't start processes (Windows needs the Proactor loop)"
            return
        except OSError as exc:
            self.last_error = f"Could not run {cmd[0]}: {exc.strerror or exc}"
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

        self._stopping = True
        self._process.terminate()
        try:
            await asyncio.wait_for(self._process.wait(), timeout=5.0)
        # Before Python 3.11 asyncio.TimeoutError is not the builtin TimeoutError
        except (TimeoutError, asyncio.TimeoutError):
            try:
                self._process.kill()
            except ProcessLookupError:
                pass

        await self._stop_hc()

    async def _monitor(self) -> None:
        returncode = await self._process.wait() if self._process else None
        expected = self._stopping
        self._process = None
        self.pid = None
        self.state = None
        if self._query_task:
            self._query_task.cancel()
            self._query_task = None
        await self._stop_hc()
        if expected:
            log.info("server stopped", id=self.id, returncode=returncode)
        else:
            # Crashed, failed to bind its ports, or was killed from outside
            log.warning("server exited unexpectedly", id=self.id, returncode=returncode)
            await self.bus.publish(
                "server_exited",
                {"title": self.title, "returncode": returncode},
                server_id=self.id,
            )
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
            except NotImplementedError:
                log.error(
                    "asyncio.create_subprocess_exec not supported on this event loop (Windows requires ProactorEventLoop)",
                    id=self.id,
                )
            except OSError as exc:
                log.error("headless client start failed", id=self.id, error=str(exc))

    async def _stop_hc(self) -> None:
        for proc in self._hc_processes:
            try:
                proc.terminate()
            except ProcessLookupError:
                pass
        self._hc_processes = []

    def remove_config_files(self, server_id: str | None = None) -> None:
        """Delete the `<id>.cfg` / `<id>.Arma3Profile` written for this server.

        They hold the hostname and passwords, so a renamed or deleted server
        must not leave them behind. *server_id* names a previous id.
        """
        from app.core.paths import game_dir

        name = server_id or self.id
        for path in (game_dir(self.settings) / f"{name}.cfg", game_dir(self.settings) / f"{name}.Arma3Profile"):
            try:
                path.unlink(missing_ok=True)
            except OSError as exc:
                log.warning("could not remove server config", path=str(path), error=str(exc))

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
