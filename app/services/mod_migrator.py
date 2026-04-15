from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import Any

import structlog

from app.schemas.preset import Comparison
from app.services.mod_linker import _is_junction, _remove_junction

log = structlog.get_logger()


def _normalize_name(name: str) -> str:
    name = name.lstrip("@").lower()
    return re.sub(r"[^a-z0-9]", "", name)


def _read_steam_id(folder: Path) -> str | None:
    meta = folder / "meta.cpp"
    if not meta.exists():
        return None
    try:
        text = meta.read_text(encoding="utf-8", errors="replace")
        m = re.search(r"publishedid\s*=\s*(\d+)", text, re.IGNORECASE)
        return m.group(1) if m else None
    except OSError:
        return None


def _build_local_index(downloads: Path) -> dict[str, Any]:
    """Scan disk for existing mod folders in all group subdirs.

    Returns:
        {
            "by_steam_id": {sid: (group_name, path)},
            "by_norm_name": {norm: (group_name, path)},
        }
    """
    by_steam_id: dict[str, tuple[str, Path]] = {}
    by_norm_name: dict[str, tuple[str, Path]] = {}

    if not downloads.is_dir():
        return {"by_steam_id": by_steam_id, "by_norm_name": by_norm_name}

    for group_dir in downloads.iterdir():
        if not group_dir.is_dir() or _is_junction(group_dir):
            continue
        for mod_folder in group_dir.iterdir():
            if not mod_folder.is_dir():
                continue
            norm = _normalize_name(mod_folder.name)
            steam_id = _read_steam_id(mod_folder)
            if steam_id:
                by_steam_id[steam_id] = (group_dir.name, mod_folder)
            by_norm_name[norm] = (group_dir.name, mod_folder)

    return {"by_steam_id": by_steam_id, "by_norm_name": by_norm_name}


def _build_target_list(comparison: Comparison) -> list[tuple[str, str | None, str]]:
    """Flatten comparison to (new_group, steam_id, mod_name) list."""
    targets: list[tuple[str, str | None, str]] = []

    for mod in comparison.shared.mods:
        targets.append(("shared", mod.steam_id, mod.name))

    for group_name, group in comparison.unique.items():
        for mod in group.mods:
            targets.append((group_name, mod.steam_id, mod.name))

    return targets


async def migrate_mod_groups(
    downloads: Path,
    arma_dir: Path | None,
    comparison: Comparison,
    bus: Any | None = None,
) -> dict[str, Any]:
    """Move mod folders to match comparison grouping.

    CRITICAL:
    - Remove stale junction BEFORE shutil.move() to avoid leaving dangling links
    - Update in-memory index after each move so later targets don't re-match
    - Never call shutil.rmtree() on a junction
    """
    index = _build_local_index(downloads)
    targets = _build_target_list(comparison)

    moved = 0
    junction_removed = 0
    skipped_correct = 0
    skipped_dest_exists = 0
    skipped_not_found = 0
    errors: list[str] = []

    for new_group, steam_id, mod_name in targets:
        # Locate on disk
        entry: tuple[str, Path] | None = None
        if steam_id and steam_id in index["by_steam_id"]:
            entry = index["by_steam_id"][steam_id]
        else:
            norm = _normalize_name(mod_name)
            entry = index["by_norm_name"].get(norm)

        if entry is None:
            skipped_not_found += 1
            continue

        current_group, current_path = entry

        if current_group == new_group:
            skipped_correct += 1
            continue

        dest_group_dir = downloads / new_group
        dest_group_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_group_dir / current_path.name

        if dest_path.exists() or _is_junction(dest_path):
            skipped_dest_exists += 1
            continue

        # Remove stale junction in arma_dir BEFORE moving so it can be recreated
        if arma_dir:
            link_path = arma_dir / current_path.name
            if _is_junction(link_path):
                ok, err = _remove_junction(link_path)
                if ok:
                    junction_removed += 1
                else:
                    errors.append(f"remove junction {current_path.name}: {err}")

        try:
            shutil.move(str(current_path), str(dest_path))
            moved += 1

            if bus:
                await bus.publish(
                    "presets",
                    {"op": "migrate", "mod": current_path.name, "from": current_group, "to": new_group},
                )

            # Update in-memory index so later iterations don't re-match
            if steam_id and steam_id in index["by_steam_id"]:
                index["by_steam_id"][steam_id] = (new_group, dest_path)
            norm = _normalize_name(current_path.name)
            if norm in index["by_norm_name"]:
                index["by_norm_name"][norm] = (new_group, dest_path)

        except OSError as exc:
            errors.append(f"move {current_path.name}: {exc}")

    return {
        "moved": moved,
        "junction_removed": junction_removed,
        "skipped_correct": skipped_correct,
        "skipped_dest_exists": skipped_dest_exists,
        "skipped_not_found": skipped_not_found,
        "errors": errors,
    }
