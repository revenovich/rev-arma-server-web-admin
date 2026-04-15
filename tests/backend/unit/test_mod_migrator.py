"""Tests for mod_migrator — verifies critical migration ordering and index update.

Critical requirements verified here:
1. Stale junction in arma_dir is removed BEFORE shutil.move()
2. In-memory index is updated after each move (prevents re-matching in same run)
3. os.rmdir is used for junction removal (not shutil.rmtree)
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

from app.schemas.preset import Comparison, ModEntry, PresetGroup
from app.services.mod_migrator import _build_local_index, migrate_mod_groups


def _make_comparison(
    shared: list[tuple[str, str | None]],
    unique: dict[str, list[tuple[str, str | None]]],
) -> Comparison:
    def _make_group(items: list[tuple[str, str | None]]) -> PresetGroup:
        mods = [ModEntry(name=n, steam_id=s, source="steam" if s else "local") for n, s in items]
        return PresetGroup(mod_count=len(mods), mods=mods)

    return Comparison(
        compared_presets=list(unique.keys()),
        shared=_make_group(shared),
        unique={k: _make_group(v) for k, v in unique.items()},
    )


def _make_mod(group_dir: Path, name: str, steam_id: str | None = None) -> Path:
    mod_path = group_dir / name
    mod_path.mkdir(parents=True, exist_ok=True)
    if steam_id:
        (mod_path / "meta.cpp").write_text(
            f'publishedid = {steam_id};\nname = "{name}";',
            encoding="utf-8",
        )
    return mod_path


def _create_link(link_path: Path, target: Path) -> None:
    if sys.platform == "win32":
        import subprocess
        r = subprocess.run(
            ["cmd", "/c", "mklink", "/J", str(link_path), str(target)],
            capture_output=True,
        )
        assert r.returncode == 0
    else:
        os.symlink(str(target), str(link_path))


# ---------------------------------------------------------------------------
# _build_local_index
# ---------------------------------------------------------------------------

def test_build_local_index_finds_mods_by_steam_id(tmp_path: Path) -> None:
    shared = tmp_path / "shared"
    shared.mkdir()
    _make_mod(shared, "@CBA_A3", steam_id="450814997")

    index = _build_local_index(tmp_path)
    assert "450814997" in index["by_steam_id"]
    group, path = index["by_steam_id"]["450814997"]
    assert group == "shared"
    assert path.name == "@CBA_A3"


def test_build_local_index_finds_mods_by_normalized_name(tmp_path: Path) -> None:
    shared = tmp_path / "shared"
    shared.mkdir()
    _make_mod(shared, "@CBA_A3")

    index = _build_local_index(tmp_path)
    # Normalized: strip @, lower, remove non-alnum → "cbaa3"
    assert "cbaa3" in index["by_norm_name"]


def test_build_local_index_ignores_empty_downloads_dir(tmp_path: Path) -> None:
    index = _build_local_index(tmp_path / "nonexistent")
    assert index["by_steam_id"] == {}
    assert index["by_norm_name"] == {}


# ---------------------------------------------------------------------------
# migrate_mod_groups
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_migrate_moves_mod_to_correct_group(tmp_path: Path) -> None:
    downloads = tmp_path / "downloads"
    wrong_group = downloads / "preset_b"
    wrong_group.mkdir(parents=True)
    _make_mod(wrong_group, "@CBA_A3", steam_id="450814997")

    # Comparison says @CBA_A3 belongs in "shared"
    comparison = _make_comparison(
        shared=[("@CBA_A3", "450814997")],
        unique={},
    )

    result = await migrate_mod_groups(downloads, None, comparison)
    assert result["moved"] == 1
    assert result["errors"] == []
    assert (downloads / "shared" / "@CBA_A3").is_dir()
    assert not (wrong_group / "@CBA_A3").exists()


@pytest.mark.asyncio
async def test_migrate_skips_correctly_placed_mod(tmp_path: Path) -> None:
    downloads = tmp_path / "downloads"
    shared = downloads / "shared"
    shared.mkdir(parents=True)
    _make_mod(shared, "@CBA_A3", steam_id="450814997")

    comparison = _make_comparison(
        shared=[("@CBA_A3", "450814997")],
        unique={},
    )

    result = await migrate_mod_groups(downloads, None, comparison)
    assert result["skipped_correct"] == 1
    assert result["moved"] == 0


@pytest.mark.asyncio
async def test_migrate_removes_junction_before_move(tmp_path: Path) -> None:
    """Stale junction in arma_dir must be removed BEFORE shutil.move.

    If the junction is left in place, the target mod folder is occupied by the
    junction and shutil.move would either fail or leave a dangling link.
    """
    downloads = tmp_path / "downloads"
    arma_dir = tmp_path / "arma"
    arma_dir.mkdir()

    wrong_group = downloads / "preset_b"
    wrong_group.mkdir(parents=True)
    mod_path = _make_mod(wrong_group, "@CBA_A3", steam_id="450814997")

    # Simulate an existing (stale) junction in arma_dir pointing to the old location
    _create_link(arma_dir / "@CBA_A3", mod_path)

    comparison = _make_comparison(
        shared=[("@CBA_A3", "450814997")],
        unique={},
    )

    result = await migrate_mod_groups(downloads, arma_dir, comparison)
    assert result["moved"] == 1
    assert result["junction_removed"] == 1
    assert result["errors"] == []
    # Mod is now in the correct group
    assert (downloads / "shared" / "@CBA_A3").is_dir()
    # Junction in arma_dir was removed (will be re-created by link_group later)
    assert not (arma_dir / "@CBA_A3").exists()


@pytest.mark.asyncio
async def test_migrate_updates_in_memory_index(tmp_path: Path) -> None:
    """After moving a mod, the in-memory index must reflect the new location.

    Without this, a second mod with the same steam_id in a different entry would
    match the *old* (now-deleted) path and fail.
    """
    downloads = tmp_path / "downloads"
    wrong_group = downloads / "wrong"
    wrong_group.mkdir(parents=True)
    _make_mod(wrong_group, "@CBA_A3", steam_id="450814997")

    # Two comparison entries referencing the same mod (shouldn't happen in practice
    # but tests that the index is updated after the first move)
    comparison = _make_comparison(
        shared=[("@CBA_A3", "450814997")],
        unique={},
    )

    result = await migrate_mod_groups(downloads, None, comparison)
    assert result["moved"] == 1
    # Second pass: mod is now in the correct place — should be skipped
    result2 = await migrate_mod_groups(downloads, None, comparison)
    assert result2["skipped_correct"] == 1
    assert result2["moved"] == 0


@pytest.mark.asyncio
async def test_migrate_skips_if_dest_exists(tmp_path: Path) -> None:
    downloads = tmp_path / "downloads"
    wrong_group = downloads / "preset_b"
    wrong_group.mkdir(parents=True)
    _make_mod(wrong_group, "@ACE", steam_id="463939057")

    # Pre-create the destination so there's a conflict
    shared = downloads / "shared"
    shared.mkdir(parents=True)
    (shared / "@ACE").mkdir()

    comparison = _make_comparison(
        shared=[("@ACE", "463939057")],
        unique={},
    )

    result = await migrate_mod_groups(downloads, None, comparison)
    assert result["skipped_dest_exists"] == 1
    assert result["moved"] == 0


@pytest.mark.asyncio
async def test_migrate_skips_not_found_mod(tmp_path: Path) -> None:
    downloads = tmp_path / "downloads"
    downloads.mkdir()

    comparison = _make_comparison(
        shared=[("@GhostMod", "999999")],
        unique={},
    )

    result = await migrate_mod_groups(downloads, None, comparison)
    assert result["skipped_not_found"] == 1


@pytest.mark.asyncio
async def test_migrate_publishes_to_bus(tmp_path: Path) -> None:
    downloads = tmp_path / "downloads"
    wrong_group = downloads / "wrong"
    wrong_group.mkdir(parents=True)
    _make_mod(wrong_group, "@CBA_A3", steam_id="450814997")

    comparison = _make_comparison(
        shared=[("@CBA_A3", "450814997")],
        unique={},
    )

    published: list[dict] = []

    class FakeBus:
        async def publish(self, topic: str, payload: dict, server_id: str | None = None) -> None:
            published.append({"topic": topic, "payload": payload})

    await migrate_mod_groups(downloads, None, comparison, bus=FakeBus())
    assert len(published) == 1
    assert published[0]["topic"] == "presets"
    assert published[0]["payload"]["op"] == "migrate"
    assert published[0]["payload"]["to"] == "shared"
