from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

import structlog
from pydantic import ValidationError

from app.core.config import Settings
from app.core.paths import SERVERS_JSON
from app.schemas.server import ServerSchema

if TYPE_CHECKING:
    from app.domain.server import Server
    from app.services.pubsub import EventBus

log = structlog.get_logger()

# Keys the API adds to a server's JSON (Server.to_json); never stored
_RUNTIME_KEYS = ("id", "pid", "state")

# Arma uses the game port and the next four (query, Steam, VON), so two
# servers' game ports must be at least this far apart
PORT_SPAN = 5
_FIRST_PORT = 2302
_PORT_STEP = 10  # 2302, 2312, ... the usual spacing between Arma servers
_MAX_PORT = 65535 - (PORT_SPAN - 1)

_LIMITS: dict[str, tuple[int, int]] = {
    "port": (1, _MAX_PORT),
    "max_players": (0, 1024),
    "number_of_headless_clients": (0, 64),
}


class InvalidServerError(ValueError):
    """The server record is malformed (HTTP 422)."""


class ServerConflictError(ValueError):
    """The record clashes with another server's id or ports (HTTP 409)."""


def _validate(data: dict[str, Any]) -> ServerSchema:
    try:
        schema = ServerSchema(**data)
    except ValidationError as exc:
        problems = "; ".join(
            f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in exc.errors()
        )
        raise InvalidServerError(problems) from exc
    for field, (low, high) in _LIMITS.items():
        value = getattr(schema, field)
        if not low <= value <= high:
            raise InvalidServerError(f"{field} must be between {low} and {high}")
    return schema


def _strip_runtime(data: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in data.items() if k not in _RUNTIME_KEYS}


class Manager:
    def __init__(self, settings: Settings, bus: EventBus) -> None:
        self.settings = settings
        self.bus = bus
        self._servers: dict[str, Server] = {}  # id → Server

    @property
    def servers(self) -> list[Server]:
        return sorted(self._servers.values(), key=lambda s: s.title.lower())

    def get(self, server_id: str) -> Server | None:
        return self._servers.get(server_id)

    def free_port(self) -> int:
        """First port from 2302 (in steps of 10) that no server's ports overlap."""
        port = _FIRST_PORT
        while port <= _MAX_PORT:
            if self._port_clash(port) is None:
                return port
            port += _PORT_STEP
        raise ServerConflictError("No free port left")

    def _port_clash(self, port: int, ignore: Server | None = None) -> Server | None:
        for other in self._servers.values():
            if other is not ignore and abs(other.port - port) < PORT_SPAN:
                return other
        return None

    def _check(self, schema: ServerSchema, current: Server | None = None) -> str:
        """Id for *schema*; raises if it is empty or clashes with another server."""
        from app.domain.server import make_id

        server_id = make_id(schema.title)
        if not server_id:
            raise InvalidServerError("title must contain at least one letter or digit")
        existing = self._servers.get(server_id)
        if existing is not None and existing is not current:
            raise ServerConflictError(f"A server named '{existing.title}' already exists")
        clash = self._port_clash(schema.port, ignore=current)
        if clash is not None:
            raise ServerConflictError(
                f"Port {schema.port} overlaps '{clash.title}' on port {clash.port} "
                f"(each server uses its port and the next {PORT_SPAN - 1})"
            )
        return server_id

    def add(self, data: dict[str, Any]) -> Server:
        """Create a server. Raises InvalidServerError or ServerConflictError."""
        from app.domain.server import Server

        data = _strip_runtime(data)
        if "port" not in data:
            data["port"] = self.free_port()
        schema = _validate(data)
        self._check(schema)
        server = Server(schema, self.settings, self.bus)
        self._servers[server.id] = server
        self.save()
        return server

    def update(self, server_id: str, data: dict[str, Any]) -> Server | None:
        """Merge *data* into a server. Raises InvalidServerError or ServerConflictError."""
        server = self._servers.get(server_id)
        if server is None:
            return None
        schema = _validate({**server.to_persisted_dict(), **_strip_runtime(data)})
        new_id = self._check(schema, current=server)
        old_id = server.id
        server.replace_schema(schema)
        if new_id != old_id:
            del self._servers[old_id]
            self._servers[new_id] = server
            server.remove_config_files(old_id)
        self.save()
        return server

    def remove(self, server_id: str) -> Server | None:
        server = self._servers.pop(server_id, None)
        if server is None:
            return None
        self.save()
        server.remove_config_files()
        if server.pid:
            import asyncio
            asyncio.create_task(server.stop())
        return server

    def load(self) -> None:
        from app.domain.server import Server

        if not SERVERS_JSON.exists():
            log.info("servers.json not found, starting fresh")
            return
        try:
            records: list[dict[str, Any]] = json.loads(
                SERVERS_JSON.read_text(encoding="utf-8")
            )
            for data in records:
                schema = ServerSchema(**_strip_runtime(data))
                server = Server(schema, self.settings, self.bus)
                self._servers[server.id] = server
            log.info("servers loaded", count=len(self._servers))
        except Exception as exc:
            log.error("failed to load servers.json", error=str(exc))

    def save(self) -> None:
        """Write sorted server list back to servers.json (byte-compatible round-trip)."""
        data = [s.to_persisted_dict() for s in self.servers]
        try:
            SERVERS_JSON.write_text(json.dumps(data), encoding="utf-8")
        except OSError as exc:
            log.error("failed to save servers.json", error=str(exc))

    async def auto_start(self) -> None:
        for server in self.servers:
            if server.auto_start:
                await server.start()
