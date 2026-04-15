"""Tests for mod_fetcher — covers Caddy JSON guard, file-size=0 behaviour,
backslash normalisation, and steam-id-first mod matching.

All HTTP calls are mocked — no real Caddy server needed.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.mod_fetcher import (
    _list_dir,
    _normalize_name,
    find_mod_folder,
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
