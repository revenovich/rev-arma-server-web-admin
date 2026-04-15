"""Tests for mod_linker — symlink/junction creation, removal, and status detection.

The critical correctness requirement:
  - On Windows: junction detection uses st_file_attributes & 0x400 (NOT os.path.islink)
  - Junction removal uses os.rmdir() (NOT shutil.rmtree — which follows the junction and
    deletes actual mod content on Windows)
  - On Linux/Mac: symlinks are used instead of junctions

All tests use tmp_path fixtures — never touch a real arma installation.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

from app.services.mod_linker import (
    _is_junction,
    _remove_junction,
    get_link_status,
    get_mod_folders,
    link_group,
    unlink_group,
)

# ---------------------------------------------------------------------------
# Helper — create a real symlink (Linux/Mac) or a Windows junction
# ---------------------------------------------------------------------------

def _create_link(link_path: Path, target: Path) -> None:
    """Create the appropriate link type for the current platform."""
    if sys.platform == "win32":
        import subprocess
        result = subprocess.run(
            ["cmd", "/c", "mklink", "/J", str(link_path), str(target)],
            capture_output=True,
        )
        assert result.returncode == 0, f"mklink failed: {result.stderr}"
    else:
        os.symlink(str(target), str(link_path))


# ---------------------------------------------------------------------------
# _is_junction
# ---------------------------------------------------------------------------

@pytest.mark.skipif(sys.platform != "win32", reason="Windows-only: junction attribute check")
def test_is_junction_detects_windows_junction(tmp_path: Path) -> None:
    target = tmp_path / "@CBA_A3"
    target.mkdir()
    link = tmp_path / "link_to_cba"
    _create_link(link, target)

    # The critical invariant: _is_junction must return True for a real Windows junction
    assert _is_junction(link) is True


@pytest.mark.skipif(sys.platform != "win32", reason="Windows-only")
def test_is_junction_false_for_plain_dir(tmp_path: Path) -> None:
    d = tmp_path / "plain_dir"
    d.mkdir()
    assert _is_junction(d) is False


@pytest.mark.skipif(sys.platform == "win32", reason="Linux/Mac symlink path")
def test_is_junction_detects_symlink_on_linux(tmp_path: Path) -> None:
    target = tmp_path / "@CBA_A3"
    target.mkdir()
    link = tmp_path / "link"
    os.symlink(str(target), str(link))
    assert _is_junction(link) is True


@pytest.mark.skipif(sys.platform == "win32", reason="Linux/Mac path")
def test_is_junction_false_for_regular_dir(tmp_path: Path) -> None:
    d = tmp_path / "regular"
    d.mkdir()
    assert _is_junction(d) is False


def test_is_junction_false_for_nonexistent(tmp_path: Path) -> None:
    assert _is_junction(tmp_path / "does_not_exist") is False


# ---------------------------------------------------------------------------
# _remove_junction  — must NOT use shutil.rmtree
# ---------------------------------------------------------------------------

@pytest.mark.skipif(sys.platform == "win32", reason="Uses os.unlink on non-Windows")
def test_remove_junction_unlinks_symlink_only(tmp_path: Path) -> None:
    """On non-Windows, _remove_junction must call os.unlink (not shutil.rmtree)."""
    target = tmp_path / "@ACE"
    target.mkdir()
    link = tmp_path / "link"
    os.symlink(str(target), str(link))

    ok, err = _remove_junction(link)
    assert ok is True
    assert err == ""
    # Link is gone but target must still exist
    assert not link.exists()
    assert target.exists()


@pytest.mark.skipif(sys.platform != "win32", reason="Windows os.rmdir path")
def test_remove_junction_uses_rmdir_not_rmtree_on_windows(tmp_path: Path) -> None:
    """On Windows, _remove_junction must use os.rmdir — never shutil.rmtree."""
    target = tmp_path / "@ACE"
    target.mkdir()
    sentinel = target / "important_file.pbo"
    sentinel.write_text("do not delete", encoding="utf-8")

    link = tmp_path / "link"
    _create_link(link, target)

    ok, err = _remove_junction(link)
    assert ok is True
    # Junction is gone but the target directory and its content are intact
    assert not link.exists()
    assert target.exists()
    assert sentinel.exists(), "shutil.rmtree would have deleted this — os.rmdir must be used"


def test_remove_junction_returns_error_for_nonexistent(tmp_path: Path) -> None:
    ok, err = _remove_junction(tmp_path / "ghost_junction")
    assert ok is False
    assert err != ""


# ---------------------------------------------------------------------------
# get_mod_folders
# ---------------------------------------------------------------------------

def test_get_mod_folders_only_returns_at_prefixed_dirs(tmp_path: Path) -> None:
    (tmp_path / "@CBA_A3").mkdir()
    (tmp_path / "@ACE").mkdir()
    (tmp_path / "downloads").mkdir()  # should be excluded
    (tmp_path / "readme.txt").touch()  # should be excluded

    folders = get_mod_folders(tmp_path)
    names = [p.name for p in folders]
    assert "@CBA_A3" in names
    assert "@ACE" in names
    assert "downloads" not in names


def test_get_mod_folders_sorted(tmp_path: Path) -> None:
    (tmp_path / "@Zebra").mkdir()
    (tmp_path / "@Alpha").mkdir()
    (tmp_path / "@Middle").mkdir()

    folders = get_mod_folders(tmp_path)
    names = [p.name for p in folders]
    assert names == sorted(names)


def test_get_mod_folders_missing_dir(tmp_path: Path) -> None:
    assert get_mod_folders(tmp_path / "nonexistent") == []


# ---------------------------------------------------------------------------
# get_link_status
# ---------------------------------------------------------------------------

def test_get_link_status_unlinked(tmp_path: Path) -> None:
    group_dir = tmp_path / "shared"
    group_dir.mkdir()
    arma_dir = tmp_path / "arma"
    arma_dir.mkdir()

    (group_dir / "@CBA_A3").mkdir()

    statuses = get_link_status(group_dir, arma_dir)
    assert len(statuses) == 1
    assert statuses[0].name == "@CBA_A3"
    assert statuses[0].is_linked is False


def test_get_link_status_linked(tmp_path: Path) -> None:
    group_dir = tmp_path / "shared"
    group_dir.mkdir()
    arma_dir = tmp_path / "arma"
    arma_dir.mkdir()

    mod = group_dir / "@CBA_A3"
    mod.mkdir()
    _create_link(arma_dir / "@CBA_A3", mod)

    statuses = get_link_status(group_dir, arma_dir)
    assert len(statuses) == 1
    assert statuses[0].is_linked is True


# ---------------------------------------------------------------------------
# link_group / unlink_group
# ---------------------------------------------------------------------------

def test_link_group_creates_links(tmp_path: Path) -> None:
    group_dir = tmp_path / "shared"
    group_dir.mkdir()
    arma_dir = tmp_path / "arma"
    arma_dir.mkdir()

    (group_dir / "@CBA_A3").mkdir()
    (group_dir / "@ACE").mkdir()

    result = link_group(group_dir, arma_dir)
    assert result["linked"] == 2
    assert result["failed"] == 0


def test_link_group_skips_already_linked(tmp_path: Path) -> None:
    group_dir = tmp_path / "shared"
    group_dir.mkdir()
    arma_dir = tmp_path / "arma"
    arma_dir.mkdir()

    mod = group_dir / "@CBA_A3"
    mod.mkdir()
    _create_link(arma_dir / "@CBA_A3", mod)

    result = link_group(group_dir, arma_dir)
    assert result["already_linked"] == 1
    assert result["linked"] == 0


def test_unlink_group_removes_links(tmp_path: Path) -> None:
    group_dir = tmp_path / "shared"
    group_dir.mkdir()
    arma_dir = tmp_path / "arma"
    arma_dir.mkdir()

    mod = group_dir / "@CBA_A3"
    mod.mkdir()
    _create_link(arma_dir / "@CBA_A3", mod)

    result = unlink_group(group_dir, arma_dir)
    assert result["unlinked"] == 1
    assert result["failed"] == 0
    # Mod source dir still exists
    assert mod.exists()


def test_unlink_group_skips_not_linked(tmp_path: Path) -> None:
    group_dir = tmp_path / "shared"
    group_dir.mkdir()
    arma_dir = tmp_path / "arma"
    arma_dir.mkdir()

    (group_dir / "@CBA_A3").mkdir()
    # No link created

    result = unlink_group(group_dir, arma_dir)
    assert result["not_linked"] == 1
    assert result["unlinked"] == 0
