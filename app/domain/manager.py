from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

import structlog

from app.core.config import Settings
from app.core.paths import SERVERS_JSON
from app.schemas.server import ServerSchema

if TYPE_CHECKING:
    from app.domain.server import Server
    from app.services.pubsub import EventBus

log = structlog.get_logger()


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

    def add(self, data: dict[str, Any]) -> Server:
        from app.domain.server import Server

        schema = ServerSchema(**data)
        server = Server(schema, self.settings, self.bus)
        self._servers[server.id] = server
        self.save()
        return server

    def update(self, server_id: str, data: dict[str, Any]) -> Server | None:
        server = self._servers.get(server_id)
        if server is None:
            return None
        old_id = server.id
        server.update(data)
        if server.id != old_id:
            del self._servers[old_id]
            self._servers[server.id] = server
        self.save()
        return server

    def remove(self, server_id: str) -> Server | None:
        server = self._servers.pop(server_id, None)
        if server is None:
            return None
        self.save()
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
                schema = ServerSchema(**data)
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
