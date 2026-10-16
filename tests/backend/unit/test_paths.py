"""Unit tests for the path-safety helpers in app.core.paths."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

from app.core.paths import UnsafePathError, ensure_within, safe_join, validate_name


@pytest.mark.parametrize(
    "name",
    ["@ace", "@CBA_A3", "CUP Terrains - Core", "RHS: USAF", "shared", "co_10.Altis.pbo", "...pbo"],
)
def test_validate_name_accepts_single_components(name: str) -> None:
    assert validate_name(name) == name


@pytest.mark.parametrize(
    "name",
    [
        "",
        ".",
        "..",
        "@ace/../../..",
        "@ace\\..\\..\\..",
        "a/b",
        "a\\b",
        "/etc",
        "C:\\Windows",
        "C:relative",
        "\\\\server\\share",
        "bad\0name",
    ],
)
def test_validate_name_rejects_traversal(name: str) -> None:
    with pytest.raises(UnsafePathError):
        validate_name(name)


def test_ensure_within_accepts_child(tmp_path: Path) -> None:
    child = tmp_path / "mpmissions" / "a.pbo"
    assert ensure_within(tmp_path / "mpmissions", child) == child


def test_ensure_within_rejects_sibling_with_shared_prefix(tmp_path: Path) -> None:
    # The old str.startswith() check accepted this.
    with pytest.raises(UnsafePathError):
        ensure_within(tmp_path / "mpmissions", tmp_path / "mpmissions_old" / "a.pbo")


def test_ensure_within_rejects_base_itself(tmp_path: Path) -> None:
    with pytest.raises(UnsafePathError):
        ensure_within(tmp_path / "downloads", tmp_path / "downloads" / "shared" / "..")


@pytest.mark.skipif(sys.platform == "win32", reason="Creating symlinks needs privileges on Windows")
def test_ensure_within_rejects_symlink_escape(tmp_path: Path) -> None:
    base = tmp_path / "downloads"
    base.mkdir()
    (base / "shared").symlink_to(tmp_path)
    with pytest.raises(UnsafePathError):
        safe_join(base, "shared", "config.json")


def test_safe_join_returns_unresolved_join(tmp_path: Path) -> None:
    assert safe_join(tmp_path, "downloads", "@ace") == tmp_path / "downloads" / "@ace"


def test_safe_join_rejects_bad_component(tmp_path: Path) -> None:
    with pytest.raises(UnsafePathError):
        safe_join(tmp_path, "shared", "@ace/../../..")
