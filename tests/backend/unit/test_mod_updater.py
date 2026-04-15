"""Unit tests for app.services.mod_updater.update_mod_folder."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.services.mod_updater import update_mod_folder


async def _noop_download(url: str, dest: Path, auth: tuple) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(b"x" * 100)
    return 100


# ---------------------------------------------------------------------------
# All files already up-to-date
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_mod_folder_all_skipped(tmp_path: Path) -> None:
    """When local file has same size as server, it should be skipped."""
    local_file = tmp_path / "addons" / "mod.pbo"
    local_file.parent.mkdir(parents=True)
    local_file.write_bytes(b"x" * 512)

    server_files = [("addons/mod.pbo", "http://cdn/addons/mod.pbo", 512)]

    with patch("app.services.mod_updater.list_mod_files", new_callable=AsyncMock, return_value=server_files), \
         patch("app.services.mod_updater.download_file", new_callable=AsyncMock) as mock_dl:
        result = await update_mod_folder("http://cdn/", tmp_path, auth=("", ""))

    assert result["files_skipped"] == 1
    assert result["files_downloaded"] == 0
    mock_dl.assert_not_called()


# ---------------------------------------------------------------------------
# Missing file downloaded
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_mod_folder_downloads_missing(tmp_path: Path) -> None:
    server_files = [("addons/new.pbo", "http://cdn/addons/new.pbo", 200)]

    with patch("app.services.mod_updater.list_mod_files", new_callable=AsyncMock, return_value=server_files), \
         patch("app.services.mod_updater.download_file", new_callable=AsyncMock, side_effect=_noop_download):
        result = await update_mod_folder("http://cdn/", tmp_path, auth=("", ""))

    assert result["files_downloaded"] == 1
    assert result["bytes_downloaded"] == 100


# ---------------------------------------------------------------------------
# Stale file (size mismatch) re-downloaded
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_mod_folder_redownloads_stale(tmp_path: Path) -> None:
    local_file = tmp_path / "addons" / "stale.pbo"
    local_file.parent.mkdir(parents=True)
    local_file.write_bytes(b"old" * 10)

    server_files = [("addons/stale.pbo", "http://cdn/addons/stale.pbo", 9999)]

    with patch("app.services.mod_updater.list_mod_files", new_callable=AsyncMock, return_value=server_files), \
         patch("app.services.mod_updater.download_file", new_callable=AsyncMock, side_effect=_noop_download):
        result = await update_mod_folder("http://cdn/", tmp_path, auth=("", ""))

    assert result["files_downloaded"] == 1


# ---------------------------------------------------------------------------
# Orphan local file removed
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_mod_folder_removes_orphan(tmp_path: Path) -> None:
    orphan = tmp_path / "addons" / "orphan.pbo"
    orphan.parent.mkdir(parents=True)
    orphan.write_bytes(b"orphan")

    # Server reports no files at this path
    server_files: list = []

    with patch("app.services.mod_updater.list_mod_files", new_callable=AsyncMock, return_value=server_files):
        result = await update_mod_folder("http://cdn/", tmp_path, auth=("", ""))

    assert result["files_removed"] == 1
    assert not orphan.exists()


# ---------------------------------------------------------------------------
# Download error captured in errors list
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_mod_folder_error_captured(tmp_path: Path) -> None:
    server_files = [("addons/bad.pbo", "http://cdn/addons/bad.pbo", 100)]

    with patch("app.services.mod_updater.list_mod_files", new_callable=AsyncMock, return_value=server_files), \
         patch("app.services.mod_updater.download_file", new_callable=AsyncMock, side_effect=OSError("network error")):
        result = await update_mod_folder("http://cdn/", tmp_path, auth=("", ""))

    assert len(result["errors"]) == 1
    assert "network error" in result["errors"][0]


# ---------------------------------------------------------------------------
# Unknown server size (size=0) — no comparison, always download
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_mod_folder_unknown_size_always_downloads(tmp_path: Path) -> None:
    local_file = tmp_path / "addons" / "unknown.pbo"
    local_file.parent.mkdir(parents=True)
    local_file.write_bytes(b"existing")

    # size=0 → skip size comparison → should re-download
    server_files = [("addons/unknown.pbo", "http://cdn/addons/unknown.pbo", 0)]

    with patch("app.services.mod_updater.list_mod_files", new_callable=AsyncMock, return_value=server_files), \
         patch("app.services.mod_updater.download_file", new_callable=AsyncMock, side_effect=_noop_download):
        result = await update_mod_folder("http://cdn/", tmp_path, auth=("", ""))

    assert result["files_skipped"] == 1  # size=0 → skip comparison → treat as up-to-date


# ---------------------------------------------------------------------------
# Bus events published
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_mod_folder_publishes_to_bus(tmp_path: Path) -> None:
    server_files = [("mod.pbo", "http://cdn/mod.pbo", 10)]
    mock_bus = AsyncMock()

    with patch("app.services.mod_updater.list_mod_files", new_callable=AsyncMock, return_value=server_files), \
         patch("app.services.mod_updater.download_file", new_callable=AsyncMock, side_effect=_noop_download):
        await update_mod_folder("http://cdn/", tmp_path, auth=("", ""), bus=mock_bus, mod_name="@ACE")

    mock_bus.publish.assert_called_once()
    call_args = mock_bus.publish.call_args
    assert call_args[0][0] == "presets"
    assert call_args[0][1]["mod"] == "@ACE"
