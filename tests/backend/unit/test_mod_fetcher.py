"""Tests for mod_fetcher — covers Caddy JSON guard, file-size=0 behaviour,
backslash normalisation, steam-id-first mod matching, and unsafe listing names.

All HTTP calls are mocked — no real Caddy server needed.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
import respx

from app.core.paths import UnsafePathError
from app.services.mod_fetcher import (
    _list_dir,
    _normalize_name,
    download_mod_folder,
    find_mod_folder,
    list_mod_files,
    list_mod_updates,
)

# ---------------------------------------------------------------------------
# _normalize_name — aggressive normalization
# ---------------------------------------------------------------------------

def test_normalize_strips_at_sign() -> None:
    assert _normalize_name("@CBA_A3") == "cbaa3"


def test_normalize_lowercases() -> None:
    assert _normalize_name("@ACE") == "ace"


def test_normalize_removes_non_alphanumeric() -> None:
    assert _normalize_name("@US_Gear_Units_IFA3") == "usgearunitsifa3"


def test_normalize_handles_no_at() -> None:
    assert _normalize_name("CBA_A3") == "cbaa3"


def test_normalize_empty() -> None:
    assert _normalize_name("") == ""


def test_normalize_digits_preserved() -> None:
    assert _normalize_name("@Mod123") == "mod123"


# ---------------------------------------------------------------------------
# _list_dir — Caddy JSON guard
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_dir_plain_list_response() -> None:
    """Caddy normally returns a plain JSON array. Must pass through directly."""
    items = [{"name": "@CBA_A3", "is_dir": True, "size": 0}]

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = items

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    result = await _list_dir("http://server/", mock_client)
    assert result == items


@pytest.mark.asyncio
async def test_list_dir_wrapped_response() -> None:
    """Some Caddy versions wrap the list in {items: [...]}. Must extract correctly."""
    items = [{"name": "@ACE", "is_dir": True, "size": 0}]
    wrapped = {"items": items, "path": "/mods/"}

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = wrapped

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    result = await _list_dir("http://server/", mock_client)
    assert result == items


@pytest.mark.asyncio
async def test_list_dir_empty_wrapped_response() -> None:
    """Wrapped response with no items key returns empty list."""
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"path": "/empty/"}

    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    result = await _list_dir("http://server/", mock_client)
    assert result == []


# ---------------------------------------------------------------------------
# find_mod_folder — steam_id first, normalized name fallback
# ---------------------------------------------------------------------------

def test_find_mod_folder_by_steam_id() -> None:
    index: dict[str, Any] = {
        "by_steam_id": {"450814997": "http://server/@cba_a3/"},
        "by_name": {"cba_a3": "http://server/@CBA_a3_different/"},
        "folders": [],
    }
    # steam_id match must take priority over name match
    url = find_mod_folder("@CBA_A3", "450814997", index)
    assert url == "http://server/@cba_a3/"


def test_find_mod_folder_fallback_to_name() -> None:
    index: dict[str, Any] = {
        "by_steam_id": {},
        "by_name": {"cbaa3": "http://server/@cba_a3/"},
        "folders": [],
    }
    url = find_mod_folder("@CBA_A3", None, index)
    assert url == "http://server/@cba_a3/"


def test_find_mod_folder_not_found() -> None:
    index: dict[str, Any] = {"by_steam_id": {}, "by_name": {}, "folders": []}
    url = find_mod_folder("@GhostMod", "999", index)
    assert url is None


def test_find_mod_folder_steam_id_none_uses_name() -> None:
    index: dict[str, Any] = {
        "by_steam_id": {"450814997": "http://server/@cba_a3/"},
        "by_name": {"cbaa3": "http://server/@cba_a3/"},
        "folders": [],
    }
    # steam_id=None means skip steam lookup even if the index has an entry
    url = find_mod_folder("@CBA_A3", None, index)
    assert url == "http://server/@cba_a3/"


# ---------------------------------------------------------------------------
# list_mod_updates — file size=0 treated as unknown (skip comparison)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_mod_updates_size_zero_skipped(tmp_path: Path) -> None:
    """server_size=0 means Caddy doesn't know the size — must NOT flag as stale."""
    local_file = tmp_path / "test.pbo"
    local_file.write_bytes(b"x" * 1000)  # 1000 bytes locally

    # Server reports size=0 — truthiness check: if not server_size → skip
    server_files = [("test.pbo", "http://server/test.pbo", 0)]

    with patch("app.services.mod_fetcher.list_mod_files", AsyncMock(return_value=server_files)):
        stale = await list_mod_updates("http://server/", tmp_path, ("user", "pass"))

    # Must NOT be in stale list — size=0 means unknown, not actually 0 bytes
    assert stale == []


@pytest.mark.asyncio
async def test_list_mod_updates_missing_file_is_stale(tmp_path: Path) -> None:
    """Files that don't exist locally must always be in the stale list."""
    server_files = [("missing.pbo", "http://server/missing.pbo", 500)]

    with patch("app.services.mod_fetcher.list_mod_files", AsyncMock(return_value=server_files)):
        stale = await list_mod_updates("http://server/", tmp_path, ("user", "pass"))

    assert len(stale) == 1
    assert stale[0][0] == "missing.pbo"


@pytest.mark.asyncio
async def test_list_mod_updates_size_mismatch_is_stale(tmp_path: Path) -> None:
    local_file = tmp_path / "mod.pbo"
    local_file.write_bytes(b"x" * 100)

    server_files = [("mod.pbo", "http://server/mod.pbo", 200)]  # server has 200, local has 100

    with patch("app.services.mod_fetcher.list_mod_files", AsyncMock(return_value=server_files)):
        stale = await list_mod_updates("http://server/", tmp_path, ("user", "pass"))

    assert len(stale) == 1


@pytest.mark.asyncio
async def test_list_mod_updates_matching_size_not_stale(tmp_path: Path) -> None:
    local_file = tmp_path / "mod.pbo"
    local_file.write_bytes(b"x" * 500)

    server_files = [("mod.pbo", "http://server/mod.pbo", 500)]

    with patch("app.services.mod_fetcher.list_mod_files", AsyncMock(return_value=server_files)):
        stale = await list_mod_updates("http://server/", tmp_path, ("user", "pass"))

    assert stale == []


# ---------------------------------------------------------------------------
# Backslash normalisation in relative paths
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_mod_updates_backslash_path_normalised(tmp_path: Path) -> None:
    """Server may return paths with backslashes on Windows — must be normalised to /."""
    # Create a nested local file
    sub = tmp_path / "subdir"
    sub.mkdir()
    local_file = sub / "file.bisign"
    local_file.write_bytes(b"data" * 50)  # 200 bytes

    # Server returns backslash-separated path
    rel_with_backslash = "subdir\\file.bisign"
    server_files = [(rel_with_backslash, "http://server/subdir/file.bisign", 200)]

    with patch("app.services.mod_fetcher.list_mod_files", AsyncMock(return_value=server_files)):
        stale = await list_mod_updates("http://server/", tmp_path, ("user", "pass"))

    # After normalisation, subdir/file.bisign exists locally at 200 bytes → not stale
    assert stale == []


# ---------------------------------------------------------------------------
# Listing names are untrusted: they must never place a file outside dest_path.
# Caddy is mocked at the HTTP level so _walk, list_mod_files and download_file
# all run for real.
# ---------------------------------------------------------------------------

CADDY = "http://cdn.test/mods/"
ACE = CADDY + "@ace/"
AUTH = ("user", "pass")


def _listing(router: respx.Router, url: str, items: list[dict[str, Any]]) -> None:
    router.get(url).mock(return_value=httpx.Response(200, json=items))


def _serve_any_file(router: respx.Router) -> respx.Route:
    """Answer every other GET on the host with file bytes (registered last, so listings win)."""
    return router.get(url__startswith="http://cdn.test/").mock(
        return_value=httpx.Response(200, content=b"pwned")
    )


def _files_outside(root: Path, dest: Path) -> list[Path]:
    return [p for p in root.rglob("*") if p.is_file() and dest not in p.parents]


@pytest.mark.asyncio
async def test_walk_strips_caddy_trailing_slash_on_dirs() -> None:
    """Caddy lists directories as ``addons/``; that must not be rejected or doubled."""
    with respx.mock() as router:
        _listing(router, ACE, [
            {"name": "addons/", "is_dir": True, "size": 4096},
            {"name": "mod.cpp", "is_dir": False, "size": 4},
        ])
        _listing(router, ACE + "addons/", [{"name": "ace_main.pbo", "is_dir": False, "size": 3}])
        files = await list_mod_files(ACE, AUTH)

    assert files == [
        ("addons/ace_main.pbo", ACE + "addons/ace_main.pbo", 3),
        ("mod.cpp", ACE + "mod.cpp", 4),
    ]


@pytest.mark.parametrize(
    "entry",
    [
        {"name": "../evil.txt", "is_dir": False},
        {"name": "..\\evil.dll", "is_dir": False},
        {"name": "addons/../../evil.dll", "is_dir": False},
        {"name": "/etc/passwd", "is_dir": False},
        {"name": "C:evil.dll", "is_dir": False},
        {"name": "C:\\evil.dll", "is_dir": False},
        {"name": "evil\0.dll", "is_dir": False},
        {"name": "", "is_dir": False},
        {"name": "..", "is_dir": True},
        {"name": "../", "is_dir": True},
        {"name": ".", "is_dir": True},
        {"name": "addons//", "is_dir": True},
        {"name": "addons/", "is_dir": False},  # only directories get the slash stripped
    ],
)
@pytest.mark.asyncio
async def test_walk_rejects_unsafe_listing_names(entry: dict[str, Any]) -> None:
    with respx.mock(assert_all_called=False) as router:
        _listing(router, ACE, [{"name": "mod.cpp", "is_dir": False, "size": 4}, entry])
        with pytest.raises(UnsafePathError):
            await list_mod_files(ACE, AUTH)
        # Rejected without following the entry anywhere.
        assert [str(c.request.url) for c in router.calls] == [ACE]


@pytest.mark.asyncio
async def test_walk_rejects_unsafe_name_in_subfolder() -> None:
    with respx.mock() as router:
        _listing(router, ACE, [{"name": "addons/", "is_dir": True}])
        _listing(router, ACE + "addons/", [{"name": "..\\..\\evil.dll", "is_dir": False}])
        with pytest.raises(UnsafePathError):
            await list_mod_files(ACE, AUTH)


@pytest.mark.asyncio
async def test_download_mod_folder_writes_caddy_listing_into_dest(tmp_path: Path) -> None:
    dest = tmp_path / "downloads" / "shared" / "@ace"
    with respx.mock(assert_all_called=False) as router:
        _listing(router, ACE, [
            {"name": "addons/", "is_dir": True},
            {"name": "mod.cpp", "is_dir": False, "size": 5},
        ])
        _listing(router, ACE + "addons/", [{"name": "ace_main.pbo", "is_dir": False, "size": 5}])
        _serve_any_file(router)
        stats = await download_mod_folder(ACE, dest, AUTH)

    assert stats["files_downloaded"] == 2
    assert (dest / "addons" / "ace_main.pbo").read_bytes() == b"pwned"
    assert (dest / "mod.cpp").read_bytes() == b"pwned"
    assert _files_outside(tmp_path, dest) == []


@pytest.mark.asyncio
async def test_download_mod_folder_rejects_dotdot_file(tmp_path: Path) -> None:
    dest = tmp_path / "downloads" / "shared" / "@ace"
    with respx.mock(assert_all_called=False) as router:
        _listing(router, ACE, [
            {"name": "mod.cpp", "is_dir": False, "size": 5},
            {"name": "../evil.txt", "is_dir": False, "size": 5},
        ])
        files = _serve_any_file(router)
        with pytest.raises(UnsafePathError):
            await download_mod_folder(ACE, dest, AUTH)

    assert not files.called  # not even the valid mod.cpp: the listing as a whole is refused
    assert not dest.exists()
    assert _files_outside(tmp_path, dest) == []


@pytest.mark.asyncio
async def test_download_mod_folder_rejects_dotdot_dir(tmp_path: Path) -> None:
    dest = tmp_path / "downloads" / "shared" / "@ace"
    with respx.mock(assert_all_called=False) as router:
        _listing(router, ACE, [{"name": "..", "is_dir": True}])
        # Where the ".." folder's listing would be fetched from (httpx collapses @ace/../).
        _listing(router, CADDY, [{"name": "evil.dll", "is_dir": False, "size": 5}])
        files = _serve_any_file(router)
        with pytest.raises(UnsafePathError):
            await download_mod_folder(ACE, dest, AUTH)

    assert not files.called
    assert _files_outside(tmp_path, dest) == []


@pytest.mark.asyncio
async def test_download_mod_folder_rejects_symlink_out_of_dest(tmp_path: Path) -> None:
    """Valid names, but dest/addons links outside: ensure_within must refuse it."""
    dest = tmp_path / "downloads" / "shared" / "@ace"
    outside = tmp_path / "outside"
    outside.mkdir()
    dest.mkdir(parents=True)
    try:
        (dest / "addons").symlink_to(outside, target_is_directory=True)
    except OSError:
        pytest.skip("symlinks not permitted here")

    with respx.mock(assert_all_called=False) as router:
        _listing(router, ACE, [
            {"name": "mod.cpp", "is_dir": False, "size": 5},
            {"name": "addons/", "is_dir": True},
        ])
        _listing(router, ACE + "addons/", [{"name": "evil.dll", "is_dir": False, "size": 5}])
        files = _serve_any_file(router)
        with pytest.raises(UnsafePathError):
            await download_mod_folder(ACE, dest, AUTH)

    assert not files.called
    assert list(outside.iterdir()) == []
    assert not (dest / "mod.cpp").exists()


@pytest.mark.asyncio
async def test_download_mod_folder_rejects_backslash_traversal_from_listing(tmp_path: Path) -> None:
    """Even if a listing source skips _walk, the \\ → / normalisation can't escape dest."""
    dest = tmp_path / "downloads" / "shared" / "@ace"
    server_files = [("..\\evil.txt", "http://cdn.test/evil.txt", 5)]
    with patch("app.services.mod_fetcher.list_mod_files", AsyncMock(return_value=server_files)), \
         patch("app.services.mod_fetcher.download_file", AsyncMock()) as dl:
        with pytest.raises(UnsafePathError):
            await download_mod_folder(ACE, dest, AUTH)

    dl.assert_not_called()
