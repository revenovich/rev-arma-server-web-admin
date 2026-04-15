"""Unit tests for app.services.a2s — query_status."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.a2s import query_status


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
