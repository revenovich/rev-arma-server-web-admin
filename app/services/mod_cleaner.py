from __future__ import annotations

from pathlib import Path

from app.schemas.preset import Comparison
from app.services.mod_linker import _is_junction


def _folder_size(path: Path) -> int:
    total = 0
    try:
        for f in path.rglob("*"):
            if f.is_file():
                total += f.stat().st_size
    except OSError:
        pass
    return total


def find_orphan_folders(
    downloads: Path,
    comparison: Comparison,
) -> list[dict[str, str | int]]:
    """Find mod folders on disk that are no longer referenced in comparison."""
    referenced: set[str] = set()
    for mod in comparison.shared.mods:
        referenced.add(mod.name.lower().lstrip("@"))
        if mod.steam_id:
            referenced.add(mod.steam_id)
    for group in comparison.unique.values():
        for mod in group.mods:
            referenced.add(mod.name.lower().lstrip("@"))
            if mod.steam_id:
                referenced.add(mod.steam_id)

    orphans: list[dict[str, str | int]] = []
    if not downloads.is_dir():
        return orphans

    for group_dir in downloads.iterdir():
        if not group_dir.is_dir() or _is_junction(group_dir):
            continue
        for mod_folder in group_dir.iterdir():
            if not mod_folder.is_dir():
                continue
            name_key = mod_folder.name.lower().lstrip("@")
            if name_key not in referenced:
                orphans.append(
                    {
                        "path": str(mod_folder),
                        "group": group_dir.name,
                        "name": mod_folder.name,
                        "size": _folder_size(mod_folder),
                    }
                )

    return orphans


def delete_orphan(path: str) -> bool:
    """Delete an orphaned mod folder.

    CRITICAL: Check it is not a junction before deleting.
    Never use shutil.rmtree on a junction.
    """
    import shutil

    target = Path(path)
    if not target.exists():
        return False
    if _is_junction(target):
        return False  # Never rmtree a junction
    shutil.rmtree(target)
    return True
