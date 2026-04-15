from __future__ import annotations

from pathlib import Path

import httpx
import structlog

log = structlog.get_logger()

_WORKSHOP_DOWNLOAD_URL = (
    "https://steamcommunity.com/sharedfiles/filedetails/?id={item_id}"
)
_WORKSHOP_API_URL = (
    "https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/"
)


async def get_workshop_file_info(item_id: str) -> dict[str, str] | None:
    """Fetch Steam Workshop metadata for a given item ID."""
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                _WORKSHOP_API_URL,
                data={"itemcount": "1", "publishedfileids[0]": item_id},
            )
            resp.raise_for_status()
            data = resp.json()
            details = data["response"]["publishedfiledetails"][0]
            return {
                "title": details.get("title", ""),
                "description": details.get("description", ""),
                "file_url": details.get("file_url", ""),
                "filename": details.get("filename", ""),
            }
    except Exception as exc:
        log.error("workshop api failed", item_id=item_id, error=str(exc))
        return None


async def download_workshop_mission(item_id: str, missions_dir: Path) -> bool:
    """Download a Workshop mission .pbo to the missions directory.

    Workshop mission downloads require the Steam client or SteamCMD with
    a logged-in account. This is a best-effort implementation using the
    file_url from the Workshop API.
    """
    info = await get_workshop_file_info(item_id)
    if info is None or not info.get("file_url"):
        log.warning("no direct download URL for workshop item", item_id=item_id)
        return False

    file_url = info["file_url"]
    # Use only the basename from the Steam API to prevent path traversal
    raw_filename = info.get("filename") or f"{item_id}.pbo"
    filename = Path(raw_filename).name or f"{item_id}.pbo"
    dest = missions_dir / filename.lower()

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("GET", file_url) as resp:
                resp.raise_for_status()
                dest.parent.mkdir(parents=True, exist_ok=True)
                with dest.open("wb") as f:
                    async for chunk in resp.aiter_bytes(65536):
                        f.write(chunk)
        return True
    except Exception as exc:
        log.error("workshop download failed", item_id=item_id, error=str(exc))
        return False
