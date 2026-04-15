from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import structlog

from app.schemas.preset import LinkStatus

log = structlog.get_logger()


# CRITICAL: os.path.islink() returns False for Windows NTFS junctions.
# Must check FILE_ATTRIBUTE_REPARSE_POINT (0x400) on Windows.
# Use lstat() not stat() — stat() follows junctions and returns target attributes.
def _is_junction(path: Path) -> bool:
    if sys.platform == "win32":
        try:
            return bool(path.lstat().st_file_attributes & 0x400)
        except OSError:
            return False
    return path.is_symlink()


def _create_junction(link_path: Path, target: Path) -> bool:
    """Create a Windows junction or Linux symlink."""
    try:
        if sys.platform == "win32":
            result = subprocess.run(
                ["cmd", "/c", "mklink", "/J", str(link_path), str(target)],
                capture_output=True,
                text=True,
            )
            return result.returncode == 0
        else:
            os.symlink(str(target), str(link_path))
            return True
    except OSError as exc:
        log.error("create junction failed", link=str(link_path), error=str(exc))
        return False


def _remove_junction(link_path: Path) -> tuple[bool, str]:
    """Remove a junction/symlink safely.

    CRITICAL: Never use shutil.rmtree() on a junction — on Windows it follows
    the reparse point and deletes the actual mod folder contents.
    Use os.rmdir() for junctions, os.unlink() for symlinks.
    """
    try:
        if sys.platform == "win32":
            os.rmdir(link_path)  # rmdir removes the junction, not the target
        else:
            os.unlink(link_path)
        return True, ""
    except OSError as exc:
        return False, str(exc)


def get_mod_folders(group_dir: Path) -> list[Path]:
    if not group_dir.is_dir():
        return []
    return sorted(p for p in group_dir.iterdir() if p.is_dir() and p.name.startswith("@"))


def get_link_status(group_dir: Path, arma_dir: Path) -> list[LinkStatus]:
    results: list[LinkStatus] = []
    for mod_folder in get_mod_folders(group_dir):
        link_path = arma_dir / mod_folder.name
        results.append(
            LinkStatus(
                name=mod_folder.name,
                source_path=str(mod_folder),
                link_path=str(link_path),
                is_linked=_is_junction(link_path),
            )
        )
    return results


def link_group(group_dir: Path, arma_dir: Path) -> dict[str, int | list[str]]:
    linked = 0
    already_linked = 0
    failed = 0
    errors: list[str] = []

    for mod_folder in get_mod_folders(group_dir):
        link_path = arma_dir / mod_folder.name
        if _is_junction(link_path):
            already_linked += 1
            continue
        if _create_junction(link_path, mod_folder):
            linked += 1
        else:
            failed += 1
            errors.append(mod_folder.name)

    return {"linked": linked, "already_linked": already_linked, "failed": failed, "errors": errors}


def unlink_group(group_dir: Path, arma_dir: Path) -> dict[str, int | list[str]]:
    unlinked = 0
    not_linked = 0
    failed = 0
    errors: list[str] = []

    for mod_folder in get_mod_folders(group_dir):
        link_path = arma_dir / mod_folder.name
        if not _is_junction(link_path):
            not_linked += 1
            continue
        ok, err = _remove_junction(link_path)
        if ok:
            unlinked += 1
        else:
            failed += 1
            errors.append(f"{mod_folder.name}: {err}")

    return {"unlinked": unlinked, "not_linked": not_linked, "failed": failed, "errors": errors}
