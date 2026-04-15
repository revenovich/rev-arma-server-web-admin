"""Unit tests for app.services.mod_cleaner."""
from __future__ import annotations

from pathlib import Path

import pytest

from app.schemas.preset import Comparison, ModEntry, PresetGroup
from app.services.mod_cleaner import delete_orphan, find_orphan_folders


def _comparison(
    shared: list[ModEntry] | None = None,
    unique: dict[str, list[ModEntry]] | None = None,
) -> Comparison:
    shared = shared or []
    unique_groups: dict[str, PresetGroup] = {}
    for name, mods in (unique or {}).items():
        unique_groups[name] = PresetGroup(mod_count=len(mods), mods=mods)
    return Comparison(
        compared_presets=list((unique or {}).keys()),
        shared=PresetGroup(mod_count=len(shared), mods=shared),
        unique=unique_groups,
    )


def _mod(name: str, steam_id: str | None = None) -> ModEntry:
    return ModEntry(name=name, source="steam", steam_id=steam_id)


# ---------------------------------------------------------------------------
# find_orphan_folders
# ---------------------------------------------------------------------------

def test_find_orphans_no_downloads_dir(tmp_path: Path) -> None:
    cmp = _comparison()
    result = find_orphan_folders(tmp_path / "downloads", cmp)
    assert result == []


def test_find_orphans_empty_comparison_all_orphaned(tmp_path: Path) -> None:
    downloads = tmp_path / "downloads"
    group = downloads / "main"
    group.mkdir(parents=True)
    (group / "@CBA_A3").mkdir()
    (group / "@ACE").mkdir()

    cmp = _comparison()
    result = find_orphan_folders(downloads, cmp)
    names = {r["name"] for r in result}
    assert "@CBA_A3" in names
    assert "@ACE" in names


def test_find_orphans_referenced_mod_not_returned(tmp_path: Path) -> None:
    downloads = tmp_path / "downloads"
    group = downloads / "main"
    group.mkdir(parents=True)
    (group / "@CBA_A3").mkdir()
    (group / "@ACE").mkdir()

    cmp = _comparison(shared=[_mod("@CBA_A3")])
    result = find_orphan_folders(downloads, cmp)
    names = {r["name"] for r in result}
    assert "@CBA_A3" not in names
    assert "@ACE" in names


def test_find_orphans_referenced_by_steam_id_not_returned(tmp_path: Path) -> None:
    downloads = tmp_path / "downloads"
    group = downloads / "main"
    group.mkdir(parents=True)
    (group / "450814997").mkdir()  # folder named by steam ID

    cmp = _comparison(shared=[_mod("@CBA_A3", steam_id="450814997")])
    result = find_orphan_folders(downloads, cmp)
    assert result == []


def test_find_orphans_unique_group_referenced(tmp_path: Path) -> None:
    downloads = tmp_path / "downloads"
    group = downloads / "main"
    group.mkdir(parents=True)
    (group / "@ACE").mkdir()

    cmp = _comparison(unique={"preset_a": [_mod("@ACE")]})
    result = find_orphan_folders(downloads, cmp)
    assert result == []


def test_find_orphans_skips_non_directories(tmp_path: Path) -> None:
    downloads = tmp_path / "downloads"
    group = downloads / "main"
    group.mkdir(parents=True)
    (group / "readme.txt").write_text("x")

    cmp = _comparison()
    result = find_orphan_folders(downloads, cmp)
    # Non-dirs are skipped
    assert result == []


def test_find_orphans_result_structure(tmp_path: Path) -> None:
    downloads = tmp_path / "downloads"
    group = downloads / "main"
    group.mkdir(parents=True)
    (group / "@RHS").mkdir()

    cmp = _comparison()
    result = find_orphan_folders(downloads, cmp)
    assert len(result) == 1
    assert result[0]["name"] == "@RHS"
    assert result[0]["group"] == "main"
    assert "path" in result[0]
    assert "size" in result[0]


# ---------------------------------------------------------------------------
# delete_orphan
# ---------------------------------------------------------------------------

def test_delete_orphan_removes_directory(tmp_path: Path) -> None:
    target = tmp_path / "orphan"
    target.mkdir()
    (target / "file.pbo").write_bytes(b"x")

    ok = delete_orphan(str(target))
    assert ok is True
    assert not target.exists()


def test_delete_orphan_nonexistent_returns_false(tmp_path: Path) -> None:
    ok = delete_orphan(str(tmp_path / "ghost"))
    assert ok is False


def test_delete_orphan_skips_junction(tmp_path: Path) -> None:
    target = tmp_path / "junction_dir"
    target.mkdir()

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("app.services.mod_cleaner._is_junction", lambda p: True)
        ok = delete_orphan(str(target))

    assert ok is False
    assert target.exists()  # not deleted
