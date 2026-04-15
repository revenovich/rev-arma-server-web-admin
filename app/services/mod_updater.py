from __future__ import annotations

from pathlib import Path
from typing import Any

import structlog

from app.services.mod_fetcher import download_file, list_mod_files

log = structlog.get_logger()


async def update_mod_folder(
    folder_url: str,
    dest_path: Path,
    auth: tuple[str, str],
    bus: Any | None = None,
    mod_name: str = "",
) -> dict[str, int | list[str]]:
    """Re-download stale/missing files within a mod folder.

    Also removes local files no longer present on the server
    (stale .pbo / .bisign cleanup — distinct from orphan folder cleanup).

    Backslash normalization is applied when comparing local paths against
    server paths so Windows paths match the server's forward-slash listing.
    """
    server_files = await list_mod_files(folder_url, auth)
    server_rel: dict[str, tuple[str, int]] = {
        rel.replace("\\", "/"): (url, size) for rel, url, size in server_files
    }

    downloaded = 0
    skipped = 0
    removed = 0
    bytes_dl = 0
    errors: list[str] = []

    # Download stale / missing files
    for rel_path, (file_url, server_size) in server_rel.items():
        local = dest_path / Path(rel_path)
        needs_dl = not local.exists()
        if not needs_dl and server_size:  # size=0 means unknown — skip comparison
            needs_dl = local.stat().st_size != server_size

        if not needs_dl:
            skipped += 1
            continue

        try:
            n = await download_file(file_url, local, auth)
            bytes_dl += n
            downloaded += 1
            if bus:
                await bus.publish(
                    "presets",
                    {"op": "update_mods", "mod": mod_name, "file": rel_path, "bytes": n},
                )
        except Exception as exc:
            errors.append(f"{rel_path}: {exc}")

    # Remove local files absent from server
    if dest_path.exists():
        for local_file in dest_path.rglob("*"):
            if not local_file.is_file():
                continue
            rel = str(local_file.relative_to(dest_path)).replace("\\", "/")
            if rel not in server_rel:
                try:
                    local_file.unlink()
                    removed += 1
                    log.info("orphan file removed", path=rel, mod=mod_name)
                except OSError as exc:
                    errors.append(f"remove {rel}: {exc}")

    return {
        "files_downloaded": downloaded,
        "files_skipped": skipped,
        "files_removed": removed,
        "bytes_downloaded": bytes_dl,
        "errors": errors,
    }
