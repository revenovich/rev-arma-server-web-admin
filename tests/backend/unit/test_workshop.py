"""Unit tests for app.services.workshop."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import respx
import httpx

from app.services.workshop import (
    _WORKSHOP_API_URL,
    download_workshop_mission,
    get_workshop_file_info,
)


# ---------------------------------------------------------------------------
# get_workshop_file_info
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_workshop_file_info_success() -> None:
    payload = {
        "response": {
            "publishedfiledetails": [{
                "title": "ArmA 3 Escape",
                "description": "A great mission",
                "file_url": "https://cdn.example.com/escape.pbo",
                "filename": "co_10_escape.altis.pbo",
            }]
        }
    }
    with respx.mock:
        respx.post(_WORKSHOP_API_URL).mock(return_value=httpx.Response(200, json=payload))
        result = await get_workshop_file_info("450814997")

    assert result is not None
    assert result["title"] == "ArmA 3 Escape"
    assert result["filename"] == "co_10_escape.altis.pbo"


@pytest.mark.asyncio
async def test_get_workshop_file_info_http_error_returns_none() -> None:
    with respx.mock:
        respx.post(_WORKSHOP_API_URL).mock(return_value=httpx.Response(503))
        result = await get_workshop_file_info("999")
    assert result is None


@pytest.mark.asyncio
async def test_get_workshop_file_info_network_error_returns_none() -> None:
    with respx.mock:
        respx.post(_WORKSHOP_API_URL).mock(side_effect=httpx.ConnectError("timeout"))
        result = await get_workshop_file_info("999")
    assert result is None


# ---------------------------------------------------------------------------
# download_workshop_mission
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_download_no_file_url_returns_false(tmp_path: Path) -> None:
    with patch(
        "app.services.workshop.get_workshop_file_info",
        new_callable=AsyncMock,
        return_value={"title": "test", "file_url": "", "filename": "", "description": ""},
    ):
        result = await download_workshop_mission("123", tmp_path)
    assert result is False


@pytest.mark.asyncio
async def test_download_info_none_returns_false(tmp_path: Path) -> None:
    with patch(
        "app.services.workshop.get_workshop_file_info",
        new_callable=AsyncMock,
        return_value=None,
    ):
        result = await download_workshop_mission("123", tmp_path)
    assert result is False


@pytest.mark.asyncio
async def test_download_success(tmp_path: Path) -> None:
    info = {
        "title": "Escape",
        "file_url": "https://cdn.example.com/escape.pbo",
        "filename": "escape.pbo",
        "description": "",
    }
    pbo_content = b"fake pbo content"

    with patch(
        "app.services.workshop.get_workshop_file_info",
        new_callable=AsyncMock,
        return_value=info,
    ), respx.mock:
        respx.get("https://cdn.example.com/escape.pbo").mock(
            return_value=httpx.Response(200, content=pbo_content)
        )
        result = await download_workshop_mission("123", tmp_path)

    assert result is True
    dest = tmp_path / "escape.pbo"
    assert dest.exists()
    assert dest.read_bytes() == pbo_content


@pytest.mark.asyncio
async def test_download_sanitizes_filename_path_traversal(tmp_path: Path) -> None:
    """filename from API containing path components should be stripped to basename."""
    info = {
        "title": "Evil",
        "file_url": "https://cdn.example.com/evil.pbo",
        "filename": "../../evil.pbo",
        "description": "",
    }
    with patch(
        "app.services.workshop.get_workshop_file_info",
        new_callable=AsyncMock,
        return_value=info,
    ), respx.mock:
        respx.get("https://cdn.example.com/evil.pbo").mock(
            return_value=httpx.Response(200, content=b"x")
        )
        result = await download_workshop_mission("123", tmp_path)

    assert result is True
    # File should be inside tmp_path, not above it
    assert (tmp_path / "evil.pbo").exists()


@pytest.mark.asyncio
async def test_download_http_error_returns_false(tmp_path: Path) -> None:
    info = {
        "title": "Bad",
        "file_url": "https://cdn.example.com/bad.pbo",
        "filename": "bad.pbo",
        "description": "",
    }
    with patch(
        "app.services.workshop.get_workshop_file_info",
        new_callable=AsyncMock,
        return_value=info,
    ), respx.mock:
        respx.get("https://cdn.example.com/bad.pbo").mock(
            return_value=httpx.Response(404)
        )
        result = await download_workshop_mission("123", tmp_path)

    assert result is False
