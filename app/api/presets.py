from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from app.api import require_auth
from app.core.config import Settings
from app.schemas.preset import Comparison, MissingReport
from app.services import (
    mod_cleaner,
    mod_fetcher,
    mod_linker,
    mod_migrator,
    mod_reporter,
    mod_updater,
    preset_compare,
    preset_parser,
)

router = APIRouter(prefix="/api/presets", dependencies=[Depends(require_auth)])

# In-memory store — a real deployment would persist these to disk
_presets: dict[str, Any] = {}          # source_file → Preset dict
_comparison: Comparison | None = None
_missing_report: MissingReport | None = None


def _get_settings(request: Request) -> Settings:
    return request.app.state.settings


def _downloads_dir(settings: Settings) -> Path:
    return Path(settings.path) / "downloads"


def _arma_dir(settings: Settings) -> Path:
    return Path(settings.path)


# --- Preset upload & management ---

@router.post("/upload", status_code=201)
async def upload_presets(
    files: Annotated[list[UploadFile], File()],
    settings: Annotated[Settings, Depends(_get_settings)],
) -> list[dict[str, Any]]:
    global _presets
    results = []
    for upload in files:
        content = await upload.read()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".html") as tmp:
            tmp.write(content)
            tmp_path = Path(tmp.name)
        preset = preset_parser.parse_modlist_html(tmp_path)
        tmp_path.unlink(missing_ok=True)
        _presets[preset.source_file] = preset.model_dump()
        results.append(_presets[preset.source_file])
    return results


@router.get("/")
def list_presets() -> list[dict[str, Any]]:
    return list(_presets.values())


@router.get("/comparison")
def get_comparison() -> dict[str, Any]:
    if _comparison is None:
        raise HTTPException(status_code=404, detail="No comparison available")
    return _comparison.model_dump()


@router.post("/compare")
def compare(body: dict[str, list[str]]) -> dict[str, Any]:
    global _comparison
    names = body.get("presets", [])
    if len(names) < 2:
        raise HTTPException(status_code=400, detail="At least 2 preset names required")
    selected = []
    for name in names:
        p = _presets.get(name)
        if p is None:
            raise HTTPException(status_code=404, detail=f"Preset '{name}' not found")
        from app.schemas.preset import Preset
        selected.append(Preset(**p))
    _comparison = preset_compare.compare_presets(*selected)
    return _comparison.model_dump()


# --- Caddy / mod operations ---

@router.post("/fetch")
async def fetch_mods(
    body: dict[str, Any],
    request: Request,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    if _comparison is None:
        raise HTTPException(status_code=400, detail="Run /compare first")
    if not settings.caddy.base_url:
        raise HTTPException(status_code=400, detail="caddy.base_url not configured")

    auth = (settings.caddy.username, settings.caddy.password)
    bus = request.app.state.bus
    downloads = _downloads_dir(settings)

    async def progress(current: int, total: int, name: str) -> None:
        await bus.publish("presets", {"op": "fetch_index", "current": current, "total": total, "name": name})

    index = await mod_fetcher.build_server_index(
        settings.caddy.base_url, auth,
        progress_fn=lambda c, t, n: request.app.state.loop.create_task(progress(c, t, n))  # type: ignore[attr-defined]
    )

    results: list[dict[str, Any]] = []
    all_mods = list(_comparison.shared.mods)
    for group in _comparison.unique.values():
        all_mods.extend(group.mods)

    for mod in all_mods:
        group_name = "shared" if mod in _comparison.shared.mods else _find_group(mod)
        folder_url = mod_fetcher.find_mod_folder(mod.name, mod.steam_id, index)
        if folder_url is None:
            results.append({"mod": mod.name, "status": "not_on_server"})
            continue
        dest = downloads / group_name / mod.name
        stats = await mod_fetcher.download_mod_folder(
            folder_url, dest, auth,
            on_file=lambda r, n, dl: None,
        )
        results.append({"mod": mod.name, "group": group_name, **stats})

    return {"results": results}


def _find_group(mod: Any) -> str:
    if _comparison is None:
        return "shared"
    for group_name, group in _comparison.unique.items():
        if mod in group.mods:
            return group_name
    return "shared"


@router.get("/link-status")
def link_status(
    settings: Annotated[Settings, Depends(_get_settings)],
) -> list[dict[str, Any]]:
    downloads = _downloads_dir(settings)
    arma = _arma_dir(settings)
    results = []
    if downloads.exists():
        for group_dir in sorted(downloads.iterdir()):
            if not group_dir.is_dir():
                continue
            for item in mod_linker.get_link_status(group_dir, arma):
                results.append({**item.model_dump(), "group": group_dir.name})
    return results


@router.post("/link")
def link(
    body: dict[str, str],
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    group = body.get("group", "shared")
    group_dir = _downloads_dir(settings) / group
    return mod_linker.link_group(group_dir, _arma_dir(settings))


@router.post("/unlink")
def unlink(
    body: dict[str, str],
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    group = body.get("group", "shared")
    group_dir = _downloads_dir(settings) / group
    return mod_linker.unlink_group(group_dir, _arma_dir(settings))


@router.post("/migrate")
async def migrate(
    request: Request,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    if _comparison is None:
        raise HTTPException(status_code=400, detail="Run /compare first")
    return await mod_migrator.migrate_mod_groups(
        _downloads_dir(settings),
        _arma_dir(settings),
        _comparison,
        bus=request.app.state.bus,
    )


@router.post("/clean-orphans")
def clean_orphans(
    body: dict[str, bool],
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    if _comparison is None:
        raise HTTPException(status_code=400, detail="Run /compare first")
    orphans = mod_cleaner.find_orphan_folders(_downloads_dir(settings), _comparison)
    deleted: list[str] = []
    if body.get("delete", False):
        for o in orphans:
            if mod_cleaner.delete_orphan(str(o["path"])):
                deleted.append(str(o["path"]))
    return {"orphans": orphans, "deleted": deleted}


@router.get("/missing-report")
async def missing_report(
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    global _missing_report
    if _comparison is None:
        raise HTTPException(status_code=400, detail="Run /compare first")
    if not settings.caddy.base_url:
        raise HTTPException(status_code=400, detail="caddy.base_url not configured")
    auth = (settings.caddy.username, settings.caddy.password)
    index = await mod_fetcher.build_server_index(settings.caddy.base_url, auth)
    _missing_report = mod_reporter.build_missing_report(_comparison, index)
    return _missing_report.model_dump(mode="json")


@router.post("/sync-missing")
async def sync_missing(
    request: Request,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    if _missing_report is None:
        raise HTTPException(status_code=400, detail="Run /missing-report first")
    if not settings.caddy.base_url:
        raise HTTPException(status_code=400, detail="caddy.base_url not configured")

    auth = (settings.caddy.username, settings.caddy.password)
    index = await mod_fetcher.build_server_index(settings.caddy.base_url, auth)
    downloads = _downloads_dir(settings)
    results = []

    for missing in _missing_report.missing_mods:
        folder_url = mod_fetcher.find_mod_folder(missing.name, missing.steam_id, index)
        if folder_url is None:
            results.append({"mod": missing.name, "status": "still_missing"})
            continue
        dest = downloads / missing.group / missing.name
        stats = await mod_fetcher.download_mod_folder(folder_url, dest, auth)
        results.append({"mod": missing.name, "group": missing.group, **stats})

    return {"results": results}


@router.post("/update-mods")
async def update_mods(
    body: dict[str, str],
    request: Request,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    if not settings.caddy.base_url:
        raise HTTPException(status_code=400, detail="caddy.base_url not configured")

    group = body.get("group", "shared")
    mod_name = body.get("mod", "")
    auth = (settings.caddy.username, settings.caddy.password)
    index = await mod_fetcher.build_server_index(settings.caddy.base_url, auth)

    dest = _downloads_dir(settings) / group / mod_name
    folder_url = mod_fetcher.find_mod_folder(mod_name, None, index)
    if folder_url is None:
        raise HTTPException(status_code=404, detail="Mod not found on server")

    return await mod_updater.update_mod_folder(
        folder_url, dest, auth,
        bus=request.app.state.bus,
        mod_name=mod_name,
    )


@router.get("/check-names")
async def check_names(
    settings: Annotated[Settings, Depends(_get_settings)],
) -> list[dict[str, Any]]:
    """Diagnostic: compare local folder names vs server canonical names."""
    if not settings.caddy.base_url:
        raise HTTPException(status_code=400, detail="caddy.base_url not configured")

    import re

    from app.schemas.preset import NameCheckResult

    def _norm(s: str) -> str:
        return re.sub(r"[^a-z0-9]", "", s.lstrip("@").lower())

    auth = (settings.caddy.username, settings.caddy.password)
    index = await mod_fetcher.build_server_index(settings.caddy.base_url, auth)
    server_folders: dict[str, str] = {}
    for item in index.get("folders", []):
        if item.get("is_dir"):
            server_folders[_norm(item["name"])] = item["name"]
            server_folders[item["name"].lower()] = item["name"]

    downloads = _downloads_dir(settings)
    results: list[dict[str, Any]] = []

    from app.services.mod_linker import get_mod_folders
    for group_dir in downloads.iterdir() if downloads.exists() else []:
        if not group_dir.is_dir():
            continue
        for mod_folder in get_mod_folders(group_dir):
            local_name = mod_folder.name

            steam_id = None
            meta = mod_folder / "meta.cpp"
            if meta.exists():
                import re as _re
                text = meta.read_text(encoding="utf-8", errors="replace")
                m = _re.search(r"publishedid\s*=\s*(\d+)", text, _re.IGNORECASE)
                if m:
                    steam_id = m.group(1)

            server_canonical = None
            method = None
            # Four-level match: exact → case_insensitive → normalized → steam_id
            if local_name in server_folders.values():
                method = "exact"
                server_canonical = local_name
            elif local_name.lower() in server_folders:
                method = "case_insensitive"
                server_canonical = server_folders[local_name.lower()]
            elif _norm(local_name) in server_folders:
                method = "normalized"
                server_canonical = server_folders[_norm(local_name)]
            elif steam_id and steam_id in index.get("by_steam_id", {}):
                method = "steam_id"
                url = index["by_steam_id"][steam_id]
                server_canonical = url.rstrip("/").rsplit("/", 1)[-1]

            mismatch = method != "exact" and server_canonical is not None
            results.append(
                NameCheckResult(
                    folder=local_name,
                    steam_id_local=steam_id,
                    server_canonical=server_canonical,
                    match_method=method,
                    mismatch=mismatch,
                    suggested_rename=server_canonical if mismatch else None,
                ).model_dump()
            )

    return results


# NOTE: /{name} must be the LAST GET route so that specific named routes
# (link-status, missing-report, check-names) are matched first.
@router.get("/{name}")
def get_preset(name: str) -> dict[str, Any]:
    p = _presets.get(name)
    if p is None:
        raise HTTPException(status_code=404, detail="Preset not found")
    return p
