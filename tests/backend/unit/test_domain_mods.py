"""Unit tests for app.domain.mods — list_mods, _folder_size, _read_steam_meta."""
from __future__ import annotations

from pathlib import Path

from app.core.config import Settings
from app.domain.mods import _folder_size, _read_mod_file, _read_steam_meta, list_mods


def _settings(tmp_path: Path) -> Settings:
    return Settings(game="arma3", path=str(tmp_path), type="linux")


def _make_mod(root: Path, name: str, *, addons: bool = True) -> Path:
    mod_path = root / name
    mod_path.mkdir(parents=True, exist_ok=True)
    if addons:
        (mod_path / "addons").mkdir()
        (mod_path / "addons" / "mod_file.pbo").write_bytes(b"pbo")
    return mod_path


# ---------------------------------------------------------------------------
# _folder_size
# ---------------------------------------------------------------------------

def test_folder_size_empty(tmp_path: Path) -> None:
    assert _folder_size(tmp_path) == 0


def test_folder_size_single_file(tmp_path: Path) -> None:
    (tmp_path / "file.txt").write_bytes(b"hello")
    assert _folder_size(tmp_path) == 5


def test_folder_size_nested(tmp_path: Path) -> None:
    sub = tmp_path / "sub"
    sub.mkdir()
    (sub / "a.bin").write_bytes(b"x" * 100)
    (tmp_path / "b.bin").write_bytes(b"y" * 50)
    assert _folder_size(tmp_path) == 150


def test_folder_size_nonexistent(tmp_path: Path) -> None:
    assert _folder_size(tmp_path / "ghost") == 0


# ---------------------------------------------------------------------------
# _read_steam_meta
# ---------------------------------------------------------------------------

def test_read_steam_meta_missing_file(tmp_path: Path) -> None:
    assert _read_steam_meta(tmp_path) is None


def test_read_steam_meta_parses_publishedid(tmp_path: Path) -> None:
    (tmp_path / "meta.cpp").write_text(
        'publishedid = 450814997;\nname = "CBA_A3";', encoding="utf-8"
    )
    result = _read_steam_meta(tmp_path)
    assert result is not None
    assert result["publishedId"] == "450814997"
    assert result["name"] == "CBA_A3"


def test_read_steam_meta_no_publishedid(tmp_path: Path) -> None:
    (tmp_path / "meta.cpp").write_text('name = "Unknown";', encoding="utf-8")
    result = _read_steam_meta(tmp_path)
    assert result is not None
    assert result["publishedId"] is None


# ---------------------------------------------------------------------------
# _read_mod_file
# ---------------------------------------------------------------------------

def test_read_mod_file_missing(tmp_path: Path) -> None:
    assert _read_mod_file(tmp_path) is None


def test_read_mod_file_parses_name(tmp_path: Path) -> None:
    (tmp_path / "mod.cpp").write_text('name = "ACE 3";', encoding="utf-8")
    result = _read_mod_file(tmp_path)
    assert result is not None
    assert result["name"] == "ACE 3"


# ---------------------------------------------------------------------------
# list_mods
# ---------------------------------------------------------------------------

def test_list_mods_empty_when_root_missing(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    result = list_mods(settings)
    assert result == []


def test_list_mods_returns_mod(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    _make_mod(tmp_path, "@CBA_A3")

    result = list_mods(settings)
    assert len(result) == 1
    assert result[0].name == "@CBA_A3"
    assert result[0].size > 0


def test_list_mods_multiple_sorted(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    _make_mod(tmp_path, "@ZMod")
    _make_mod(tmp_path, "@AMod")
    _make_mod(tmp_path, "@MMod")

    result = list_mods(settings)
    names = [r.name for r in result]
    assert names == sorted(names, key=str.lower)


def test_list_mods_no_addons_dir_not_returned(tmp_path: Path) -> None:
    """Mods without an addons/ subdirectory are not picked up by the glob."""
    settings = _settings(tmp_path)
    # Create mod folder without addons/
    (tmp_path / "@NoAddons").mkdir()

    result = list_mods(settings)
    assert result == []


def test_list_mods_has_formatted_size(tmp_path: Path) -> None:
    settings = _settings(tmp_path)
    _make_mod(tmp_path, "@ACE")

    result = list_mods(settings)
    assert result[0].formattedSize  # non-empty humanize string
