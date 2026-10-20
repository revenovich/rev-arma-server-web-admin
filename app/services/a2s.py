from __future__ import annotations

from typing import Any

import a2s
import structlog

log = structlog.get_logger()

# Steam query (A2S) port relative to the game port. Arma 2/OA and Arma 3 answer
# on game port + 1, as Gamedig assumed in the Node app. Older titles (Arma 1,
# OFP, CWA) only speak GameSpy, so A2S fails for them whatever the port.
_QUERY_PORT_OFFSETS: dict[str, int] = {
    "arma3": 1,
    "arma3_x64": 1,
    "arma2oa": 1,
    "arma2": 1,
}


def query_port(game: str, port: int) -> int:
    """Return the A2S query port for a server of *game* on game port *port*."""
    return port + _QUERY_PORT_OFFSETS.get(game, 0)


async def query_status(game: str, host: str, port: int) -> dict[str, Any] | None:
    """Query an Arma server via A2S protocol.

    *port* is the game port; the query port is derived from it per game.
    Returns a status dict or None on timeout / error.
    """
    address = (host, query_port(game, port))
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
        log.debug("a2s query failed", host=host, port=address[1], error=str(exc))
        return None
