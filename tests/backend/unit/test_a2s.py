"""Unit tests for app.services.a2s — query_status."""
from __future__ import annotations

import asyncio
import struct
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.a2s import query_port, query_status


@pytest.mark.asyncio
async def test_query_status_success() -> None:
    mock_info = MagicMock()
    mock_info.max_players = 64
    mock_info.game = "Escape"
    mock_info.map_name = "Altis"
    mock_info.server_name = "Test Server"

    mock_player = MagicMock()

    with patch("a2s.ainfo", new_callable=AsyncMock, return_value=mock_info), \
         patch("a2s.aplayers", new_callable=AsyncMock, return_value=[mock_player, mock_player]):
        result = await query_status("arma3", "127.0.0.1", 2302)

    assert result is not None
    assert result["online"] is True
    assert result["players"] == 2
    assert result["maxPlayers"] == 64
    assert result["mission"] == "Escape"
    assert result["map"] == "Altis"
    assert result["name"] == "Test Server"


@pytest.mark.asyncio
async def test_query_status_timeout_returns_none() -> None:
    with patch("a2s.ainfo", new_callable=AsyncMock, side_effect=TimeoutError("timed out")):
        result = await query_status("arma3", "127.0.0.1", 2302)

    assert result is None


@pytest.mark.asyncio
async def test_query_status_connection_error_returns_none() -> None:
    with patch("a2s.ainfo", new_callable=AsyncMock, side_effect=OSError("connection refused")):
        result = await query_status("arma3", "10.0.0.1", 2302)

    assert result is None


@pytest.mark.asyncio
async def test_query_status_no_players(tmp_path) -> None:
    mock_info = MagicMock()
    mock_info.max_players = 32
    mock_info.game = ""
    mock_info.map_name = ""
    mock_info.server_name = ""

    with patch("a2s.ainfo", new_callable=AsyncMock, return_value=mock_info), \
         patch("a2s.aplayers", new_callable=AsyncMock, return_value=[]):
        result = await query_status("arma3", "127.0.0.1", 2302)

    assert result is not None
    assert result["players"] == 0


# ── Query port (PROJECT_HEALTH P4) ───────────────────────────────────────────


@pytest.mark.parametrize(
    ("game", "expected"),
    [("arma3", 2303), ("arma3_x64", 2303), ("arma2oa", 2303), ("arma2", 2303), ("ofp", 2302)],
)
def test_query_port_offset_per_game(game: str, expected: int) -> None:
    assert query_port(game, 2302) == expected


class _FakeA2SServer(asyncio.DatagramProtocol):
    """Minimal A2S responder: answers A2S_INFO and A2S_PLAYER with one player."""

    def connection_made(self, transport: asyncio.BaseTransport) -> None:
        self.transport = transport  # type: ignore[assignment]

    def datagram_received(self, data: bytes, addr: tuple[str, int]) -> None:
        header = b"\xff\xff\xff\xff"
        kind = data[4]
        if kind == 0x54:  # A2S_INFO
            payload = (
                b"I\x11"
                + b"Live Server\x00" + b"Altis\x00" + b"Arma3\x00" + b"co10_Escape\x00"
                + struct.pack("<H", 0)
                + bytes([1, 40, 0]) + b"dw" + bytes([0, 0])
                + b"2.18\x00" + bytes([0])
            )
        elif kind == 0x55:  # A2S_PLAYER
            payload = b"D\x01" + b"\x00Rev\x00" + struct.pack("<if", 0, 1.0)
        else:
            return
        self.transport.sendto(header + payload, addr)  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_query_status_reaches_arma3_on_game_port_plus_one() -> None:
    """Real UDP round trip: an Arma 3 server answers A2S on game port + 1."""
    loop = asyncio.get_running_loop()
    transport, _ = await loop.create_datagram_endpoint(
        _FakeA2SServer, local_addr=("127.0.0.1", 0)
    )
    try:
        query = transport.get_extra_info("sockname")[1]
        result = await query_status("arma3", "127.0.0.1", query - 1)
    finally:
        transport.close()

    assert result is not None
    assert result["online"] is True
    assert result["players"] == 1
    assert result["maxPlayers"] == 40
    assert result["map"] == "Altis"
    assert result["mission"] == "co10_Escape"
