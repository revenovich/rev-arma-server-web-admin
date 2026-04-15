from __future__ import annotations

import os
import re
from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx
import structlog

log = structlog.get_logger()

# Aggressive normalization: strip @, lowercase, remove all non-alphanumeric.
# Must match exactly — "usgearunitsifa3" not just lower().strip().
def _normalize_name(name: str) -> str:
    name = name.lstrip("@").lower()
    return re.sub(r"[^a-z0-9]", "", name)


def _parse_meta_cpp(text: str) -> str | None:
    m = re.search(r"publishedid\s*=\s*(\d+)", text, re.IGNORECASE)
    return m.group(1) if m else None


def _folder_url(base: str, name: str) -> str:
    return base.rstrip("/") + "/" + name.strip("/") + "/"


def make_client(auth: tuple[str, str]) -> httpx.AsyncClient:
    return httpx.AsyncClient(auth=auth, timeout=httpx.Timeout(120.0))


async def _list_dir(url: str, client: httpx.AsyncClient) -> list[dict[str, Any]]:
    resp = await client.get(url, headers={"Accept": "application/json"})
    resp.raise_for_status()
    data = resp.json()
    # Guard against Caddy returning wrapped response instead of plain list
    return data if isinstance(data, list) else data.get("items", [])


async def build_server_index(
    base_url: str,
    auth: tuple[str, str],
    progress_fn: Callable[[int, int, str], None] | None = None,
) -> dict[str, Any]:
    """Scan Caddy server and build mod lookup tables.

    Returns:
        {
            "by_steam_id": {"450814997": "https://server/@cba_a3/"},
            "by_name": {"cbaa3": "https://server/@cba_a3/"},
            "folders": [...raw Caddy listing...],
        }
    """
    async with make_client(auth) as client:
        folders = await _list_dir(base_url, client)

    by_steam_id: dict[str, str] = {}
    by_name: dict[str, str] = {}
    mod_folders = [f for f in folders if f.get("is_dir", False)]

    async with make_client(auth) as client:
        for i, folder in enumerate(mod_folders):
            name = folder["name"]
            folder_url = _folder_url(base_url, name)

            if progress_fn:
                progress_fn(i + 1, len(mod_folders), name)

            # Try meta.cpp for steam ID
            try:
                resp = await client.get(folder_url + "meta.cpp")
                if resp.status_code == 200:
                    steam_id = _parse_meta_cpp(resp.text)
                    if steam_id:
                        by_steam_id[steam_id] = folder_url
            except httpx.RequestError:
                pass  # Fall back to name-based lookup

            by_name[_normalize_name(name)] = folder_url

    return {"by_steam_id": by_steam_id, "by_name": by_name, "folders": folders}


def find_mod_folder(mod_name: str, steam_id: str | None, index: dict[str, Any]) -> str | None:
    """Locate a mod on the server using steam_id first, normalized name fallback."""
    if steam_id and steam_id in index["by_steam_id"]:
        return index["by_steam_id"][steam_id]
    norm = _normalize_name(mod_name)
    return index["by_name"].get(norm)


async def _walk(
    url: str, client: httpx.AsyncClient, prefix: str = ""
) -> list[tuple[str, str, int]]:
    """Recursively list all files under a folder URL.

    Returns list of (relative_path, file_url, size).
    """
    items = await _list_dir(url, client)
    results: list[tuple[str, str, int]] = []
    for item in items:
        name = item["name"]
        rel = prefix + name
        if item.get("is_dir", False):
            sub = await _walk(url + name + "/", client, rel + "/")
            results.extend(sub)
        else:
            results.append((rel, url + name, item.get("size", 0)))
    return results


async def list_mod_files(
    folder_url: str, auth: tuple[str, str]
) -> list[tuple[str, str, int]]:
    async with make_client(auth) as client:
        return await _walk(folder_url, client)


async def list_mod_updates(
    folder_url: str,
    dest_path: Path,
    auth: tuple[str, str],
) -> list[tuple[str, str, int]]:
    """Return only stale / missing files (for incremental update)."""
    all_files = await list_mod_files(folder_url, auth)
    stale: list[tuple[str, str, int]] = []
    for rel_path, file_url, server_size in all_files:
        local = dest_path / rel_path.replace("/", os.sep if hasattr(os, "sep") else "/")
        if not local.exists():
            stale.append((rel_path, file_url, server_size))
        elif server_size and local.stat().st_size != server_size:
            # Truthy check: size=0 from server means "unknown", skip comparison
            stale.append((rel_path, file_url, server_size))
    return stale


async def download_file(
    url: str,
    dest: Path,
    auth: tuple[str, str],
    on_chunk: Callable[[int], None] | None = None,
) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    async with make_client(auth) as client:
        async with client.stream("GET", url) as resp:
            resp.raise_for_status()
            with dest.open("wb") as f:
                async for chunk in resp.aiter_bytes(chunk_size=65536):
                    f.write(chunk)
                    total += len(chunk)
                    if on_chunk:
                        on_chunk(len(chunk))
    return total


async def download_mod_folder(
    folder_url: str,
    dest_path: Path,
    auth: tuple[str, str],
    overwrite: bool = False,
    on_file: Callable[[str, int, bool], None] | None = None,
) -> dict[str, int]:
    files = await list_mod_files(folder_url, auth)
    downloaded = 0
    skipped = 0
    bytes_dl = 0

    for rel_path, file_url, server_size in files:
        # Normalize backslashes so local vs server path comparison works on Windows
        norm_rel = rel_path.replace("\\", "/")
        local = dest_path / Path(norm_rel)

        if local.exists() and not overwrite:
            skipped += 1
            if on_file:
                on_file(norm_rel, server_size, False)
            continue

        n = await download_file(file_url, local, auth)
        bytes_dl += n
        downloaded += 1
        if on_file:
            on_file(norm_rel, n, True)

    return {"files_downloaded": downloaded, "files_skipped": skipped, "bytes_downloaded": bytes_dl}
