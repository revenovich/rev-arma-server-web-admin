"""Unit tests for app.services.mod_updater.update_mod_folder."""
from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
import pytest
import respx

from app.core.paths import UnsafePathError
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


# ---------------------------------------------------------------------------
# Untrusted Caddy listings (mocked at the HTTP level): an unsafe name must stop
# the update before it writes outside dest_path or removes any local file.
# ---------------------------------------------------------------------------

CADDY = "http://cdn.test/mods/"
ACE = CADDY + "@ace/"


def _listing(router: respx.Router, url: str, items: list[dict[str, Any]]) -> None:
    router.get(url).mock(return_value=httpx.Response(200, json=items))


def _serve_any_file(router: respx.Router) -> respx.Route:
    return router.get(url__startswith="http://cdn.test/").mock(
        return_value=httpx.Response(200, content=b"pwned")
    )


def _files_outside(root: Path, dest: Path) -> list[Path]:
    return [p for p in root.rglob("*") if p.is_file() and dest not in p.parents]


@pytest.fixture()
def mod_dir(tmp_path: Path) -> Path:
    """An installed mod: one file the listing below keeps, one it no longer has."""
    dest = tmp_path / "downloads" / "shared" / "@ace"
    (dest / "addons").mkdir(parents=True)
    (dest / "addons" / "ace_main.pbo").write_bytes(b"main")
    (dest / "addons" / "ace_old.pbo").write_bytes(b"old")
    return dest


def _snapshot(dest: Path) -> dict[str, bytes]:
    return {str(p.relative_to(dest)): p.read_bytes() for p in dest.rglob("*") if p.is_file()}


@pytest.mark.asyncio
async def test_update_mod_folder_keeps_subfolder_files_from_caddy_listing(
    mod_dir: Path, tmp_path: Path
) -> None:
    """Caddy lists dirs as ``addons/``; files below must match their local copies, not be removed."""
    with respx.mock(assert_all_called=False) as router:
        _listing(router, ACE, [{"name": "addons/", "is_dir": True}])
        _listing(router, ACE + "addons/", [{"name": "ace_main.pbo", "is_dir": False, "size": 4}])
        files = _serve_any_file(router)
        result = await update_mod_folder(ACE, mod_dir, auth=("", ""))

    assert not files.called
    assert result["files_skipped"] == 1
    assert result["files_removed"] == 1  # only ace_old.pbo, which the server dropped
    assert (mod_dir / "addons" / "ace_main.pbo").read_bytes() == b"main"
    assert not (mod_dir / "addons" / "ace_old.pbo").exists()
    assert _files_outside(tmp_path, mod_dir) == []


@pytest.mark.parametrize(
    "listings",
    [
        # A file named ../evil.txt next to a valid folder.
        {
            ACE: [
                {"name": "addons/", "is_dir": True},
                {"name": "../evil.txt", "is_dir": False, "size": 5},
            ],
            ACE + "addons/": [{"name": "ace_main.pbo", "is_dir": False, "size": 4}],
        },
        # A folder named ".." whose listing (fetched from the collapsed URL) holds evil.dll.
        {
            ACE: [{"name": "..", "is_dir": True}],
            CADDY: [{"name": "evil.dll", "is_dir": False, "size": 5}],
        },
        # The same inside a subfolder, Caddy-style with a trailing slash.
        {
            ACE: [{"name": "addons/", "is_dir": True}],
            ACE + "addons/": [
                {"name": "ace_main.pbo", "is_dir": False, "size": 4},
                {"name": "../", "is_dir": True},
            ],
        },
    ],
    ids=["dotdot-file", "dotdot-dir", "nested-dotdot-dir"],
)
@pytest.mark.asyncio
async def test_update_mod_folder_unsafe_listing_writes_and_removes_nothing(
    mod_dir: Path, tmp_path: Path, listings: dict[str, list[dict[str, Any]]]
) -> None:
    before = _snapshot(mod_dir)
    with respx.mock(assert_all_called=False) as router:
        for url, items in listings.items():
            _listing(router, url, items)
        files = _serve_any_file(router)
        with pytest.raises(UnsafePathError):
            await update_mod_folder(ACE, mod_dir, auth=("", ""))

    assert not files.called
    assert _snapshot(mod_dir) == before  # ace_old.pbo survives too: no removal pass ran
    assert _files_outside(tmp_path, mod_dir) == []


@pytest.mark.asyncio
async def test_update_mod_folder_rejects_symlink_out_of_dest(mod_dir: Path, tmp_path: Path) -> None:
    """Valid names, but a subfolder links outside dest: abort before downloading or removing."""
    outside = tmp_path / "outside"
    outside.mkdir()
    try:
        (mod_dir / "keys").symlink_to(outside, target_is_directory=True)
    except OSError:
        pytest.skip("symlinks not permitted here")
    before = _snapshot(mod_dir)

    with respx.mock(assert_all_called=False) as router:
        _listing(router, ACE, [{"name": "keys/", "is_dir": True}])
        _listing(router, ACE + "keys/", [{"name": "evil.bikey", "is_dir": False, "size": 5}])
        files = _serve_any_file(router)
        with pytest.raises(UnsafePathError):
            await update_mod_folder(ACE, mod_dir, auth=("", ""))

    assert not files.called
    assert list(outside.iterdir()) == []
    assert _snapshot(mod_dir) == before


@pytest.mark.asyncio
async def test_update_mod_folder_rejects_backslash_traversal_from_listing(
    mod_dir: Path,
) -> None:
    """The \\ → / normalisation must not turn a listing entry into ../ outside dest."""
    before = _snapshot(mod_dir)
    server_files = [("..\\evil.txt", "http://cdn.test/evil.txt", 5)]
    with patch("app.services.mod_updater.list_mod_files", new_callable=AsyncMock, return_value=server_files), \
         patch("app.services.mod_updater.download_file", new_callable=AsyncMock) as mock_dl:
        with pytest.raises(UnsafePathError):
            await update_mod_folder("http://cdn/", mod_dir, auth=("", ""))

    mock_dl.assert_not_called()
    assert _snapshot(mod_dir) == before
