"""Unit tests for app.services.steamcmd."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.steamcmd import (
    STEAM_APP_IDS,
    _find_steamcmd,
    get_installed_version,
    install_server,
    update_server,
)


# ---------------------------------------------------------------------------
# STEAM_APP_IDS mapping
# ---------------------------------------------------------------------------

def test_steam_app_ids_has_arma3() -> None:
    assert "arma3" in STEAM_APP_IDS
    assert STEAM_APP_IDS["arma3"] == 233780


def test_steam_app_ids_has_arma2oa() -> None:
    assert "arma2oa" in STEAM_APP_IDS


# ---------------------------------------------------------------------------
# _find_steamcmd
# ---------------------------------------------------------------------------

def test_find_steamcmd_returns_none_when_not_installed() -> None:
    with patch("shutil.which", return_value=None):
        result = _find_steamcmd()
    assert result is None


def test_find_steamcmd_returns_path_when_found() -> None:
    with patch("shutil.which", side_effect=lambda name: "/usr/bin/steamcmd" if name == "steamcmd" else None):
        result = _find_steamcmd()
    assert result == "/usr/bin/steamcmd"


# ---------------------------------------------------------------------------
# install_server — early exits
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_install_server_unknown_game_returns_error() -> None:
    result = await install_server("unknowngame", "/tmp/server")
    assert result["ok"] is False
    assert "No Steam app ID" in result["error"]


@pytest.mark.asyncio
async def test_install_server_steamcmd_not_found_returns_error() -> None:
    with patch("app.services.steamcmd._find_steamcmd", return_value=None):
        result = await install_server("arma3", "/tmp/server")
    assert result["ok"] is False
    assert "steamcmd binary not found" in result["error"]


@pytest.mark.asyncio
async def test_install_server_success() -> None:
    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.stdout = AsyncMock()
    mock_proc.stdout.readline = AsyncMock(side_effect=[b"Downloading...\n", b""])
    mock_proc.wait = AsyncMock()

    with patch("app.services.steamcmd._find_steamcmd", return_value="/usr/bin/steamcmd"), \
         patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        result = await install_server("arma3", "/tmp/server")

    assert result["ok"] is True
    assert result["returncode"] == 0
    assert "Downloading..." in result["output"]


@pytest.mark.asyncio
async def test_install_server_failure_returncode() -> None:
    mock_proc = MagicMock()
    mock_proc.returncode = 1
    mock_proc.stdout = AsyncMock()
    mock_proc.stdout.readline = AsyncMock(side_effect=[b"Error!\n", b""])
    mock_proc.wait = AsyncMock()

    with patch("app.services.steamcmd._find_steamcmd", return_value="/usr/bin/steamcmd"), \
         patch("asyncio.create_subprocess_exec", return_value=mock_proc):
        result = await install_server("arma3", "/tmp/server")

    assert result["ok"] is False


@pytest.mark.asyncio
async def test_install_server_oserror() -> None:
    with patch("app.services.steamcmd._find_steamcmd", return_value="/usr/bin/steamcmd"), \
         patch("asyncio.create_subprocess_exec", side_effect=OSError("permission denied")):
        result = await install_server("arma3", "/tmp/server")

    assert result["ok"] is False
    assert "permission denied" in result["error"]


@pytest.mark.asyncio
async def test_install_server_beta_branch() -> None:
    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.stdout = AsyncMock()
    mock_proc.stdout.readline = AsyncMock(side_effect=[b""])
    mock_proc.wait = AsyncMock()

    captured_cmd: list[str] = []

    async def mock_exec(*args: str, **kwargs: object) -> MagicMock:
        captured_cmd.extend(args)
        return mock_proc

    with patch("app.services.steamcmd._find_steamcmd", return_value="steamcmd"), \
         patch("asyncio.create_subprocess_exec", side_effect=mock_exec):
        await install_server("arma3", "/tmp/server", branch="creatordlc")

    assert "+app_update_beta" in captured_cmd
    assert "creatordlc" in captured_cmd


# ---------------------------------------------------------------------------
# update_server delegates to install_server
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_server_delegates_to_install() -> None:
    with patch("app.services.steamcmd.install_server", new_callable=AsyncMock, return_value={"ok": True}) as mock_install:
        await update_server("arma3", "/srv")
    mock_install.assert_called_once_with("arma3", "/srv", branch="public", bus=None)


# ---------------------------------------------------------------------------
# get_installed_version
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_installed_version_no_steamapps(tmp_path: Path) -> None:
    result = await get_installed_version(str(tmp_path))
    assert result is None


@pytest.mark.asyncio
async def test_get_installed_version_reads_buildid(tmp_path: Path) -> None:
    steamapps = tmp_path / "steamapps"
    steamapps.mkdir()
    acf = steamapps / "appmanifest_233780.acf"
    acf.write_text('"buildid"\t\t"9876543"', encoding="utf-8")

    result = await get_installed_version(str(tmp_path))
    assert result == "9876543"


@pytest.mark.asyncio
async def test_get_installed_version_no_acf(tmp_path: Path) -> None:
    steamapps = tmp_path / "steamapps"
    steamapps.mkdir()

    result = await get_installed_version(str(tmp_path))
    assert result is None
