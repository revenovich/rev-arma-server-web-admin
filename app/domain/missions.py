from __future__ import annotations

from pathlib import Path

import humanize
import structlog

from app.core.config import Settings
from app.core.paths import missions_dir
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


async def save_upload(tmp_path: Path, filename: str, settings: Settings) -> None:
    dest = missions_dir(settings) / filename.lower()
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp_path.rename(dest)


async def delete_mission(filename: str, settings: Settings) -> None:
    target = missions_dir(settings) / filename
    if target.exists():
        target.unlink()
