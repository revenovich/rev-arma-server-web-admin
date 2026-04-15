from __future__ import annotations

from pathlib import Path

import humanize
import structlog

from app.core.config import Settings
from app.core.paths import LOGS_RETENTION, logs_dir
from app.schemas.log import LogSchema

log = structlog.get_logger()


def list_logs(settings: Settings) -> list[LogSchema]:
    directory = logs_dir(settings)
    if directory is None or not directory.exists():
        return []

    results: list[LogSchema] = []
    try:
        for entry in directory.iterdir():
            if not entry.is_file() or not entry.name.endswith(".rpt"):
                continue
            try:
                stat = entry.stat()
                results.append(
                    LogSchema(
                        name=entry.name,
                        path=str(entry),
                        size=stat.st_size,
                        formattedSize=humanize.naturalsize(stat.st_size),
                        created=stat.st_ctime.__format__("") if hasattr(stat.st_ctime, "__format__") else str(stat.st_ctime),
                        modified=stat.st_mtime.__format__("") if hasattr(stat.st_mtime, "__format__") else str(stat.st_mtime),
                    )
                )
            except OSError:
                pass
    except OSError as exc:
        log.error("logs scan failed", error=str(exc))

    # Descending by creation time — newest first
    results.sort(key=lambda entry: entry.created, reverse=True)
    return results


def get_log(filename: str, settings: Settings) -> LogSchema | None:
    for entry in list_logs(settings):
        if entry.name == filename:
            return entry
    return None


def delete_log(filename: str, settings: Settings) -> bool:
    entry = get_log(filename, settings)
    if entry is None:
        return False
    try:
        Path(entry.path).unlink()
        return True
    except OSError:
        return False


def cleanup_old_logs(settings: Settings) -> None:
    """Keep only the newest LOGS_RETENTION .rpt files (Linux only)."""
    if settings.type != "linux":
        return
    all_logs = list_logs(settings)
    for old in all_logs[LOGS_RETENTION:]:
        delete_log(old.name, settings)
