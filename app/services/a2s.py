from __future__ import annotations

from typing import Any

import a2s
import structlog

log = structlog.get_logger()


async def query_status(game: str, host: str, port: int) -> dict[str, Any] | None:
    """Query an Arma server via A2S protocol.

    Returns a status dict or None on timeout / error.
    """
    address = (host, port)
    try:
        info = await a2s.ainfo(address)
        players = await a2s.aplayers(address)
        return {
            "online": True,
            "players": len(players),
            "maxPlayers": info.max_players,
            "mission": info.game,
            "map": info.map_name,
            "name": info.server_name,
        }
    except Exception as exc:
        log.debug("a2s query failed", host=host, port=port, error=str(exc))
        return None
