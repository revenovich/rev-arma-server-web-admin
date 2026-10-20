from __future__ import annotations

import shutil
from pathlib import Path, PureWindowsPath

import humanize
import structlog

from app.core.config import Settings
from app.core.paths import missions_dir, safe_join
from app.schemas.mission import MissionSchema

log = structlog.get_logger()


async def list_missions(settings: Settings) -> list[MissionSchema]:
    directory = missions_dir(settings)
    if not directory.exists():
        return []

    results: list[MissionSchema] = []
    try:
        entries = list(directory.iterdir())
    except OSError as exc:
        log.error("missions scan failed", error=str(exc))
        return []

    for entry in entries:
        if not entry.is_file():
            continue
        try:
            stat = entry.stat()
            stem = entry.stem  # filename without last extension (.pbo)
            world_ext = Path(stem).suffix  # e.g. ".Stratis"
            mission_name = Path(stem).stem  # e.g. "co_10_escape"
            world_name = world_ext.lstrip(".")

            results.append(
                MissionSchema(
                    name=entry.name,
                    missionName=mission_name,
                    worldName=world_name,
                    size=stat.st_size,
                    sizeFormatted=humanize.naturalsize(stat.st_size),
                    dateCreated=stat.st_ctime,
                    dateModified=stat.st_mtime,
                )
            )
        except OSError:
            pass

    return results


def mission_path(filename: str, settings: Settings) -> Path:
    """Path of *filename* in mpmissions; raises UnsafePathError if it would leave it."""
    return safe_join(missions_dir(settings), filename)


async def save_upload(tmp_path: Path, filename: str, settings: Settings) -> str:
    """Move an uploaded temp file into mpmissions and return the name it was stored as.

    Only the last component of the client-supplied filename is kept (either separator
    style), so ``../../x.pbo`` and ``C:\\x.pbo`` are both stored as ``x.pbo``.
    """
    name = PureWindowsPath(filename).name.lower()
    directory = missions_dir(settings)
    # Replace a file that differs only in case (e.g. one copied in by hand as
    # dm_test.VR.pbo) instead of storing a second copy next to it
    if directory.is_dir():
        for entry in directory.iterdir():
            if entry.name.lower() == name and entry.is_file():
                name = entry.name
                break
    dest = mission_path(name, settings)
    dest.parent.mkdir(parents=True, exist_ok=True)
    # shutil.move falls back to copy+delete when the temp dir is on another
    # filesystem or drive, where rename() fails with EXDEV / WinError 17.
    shutil.move(str(tmp_path), str(dest))
    return name


async def delete_mission(filename: str, settings: Settings) -> bool:
    """Delete *filename*; False when there is no such mission."""
    target = mission_path(filename, settings)
    if not target.is_file():
        return False
    target.unlink()
    return True
