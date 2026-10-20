from __future__ import annotations

import tempfile
from pathlib import Path, PureWindowsPath
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from app.api import require_auth
from app.core.config import Settings
from app.domain import missions as missions_domain
from app.services import workshop as workshop_svc

router = APIRouter(prefix="/api/missions", dependencies=[Depends(require_auth)])

_MAX_FILE_SIZE = 512 * 1024 * 1024  # 512 MB per file


def _get_settings(request: Request) -> Settings:
    return request.app.state.settings


@router.get("/")
async def list_missions(
    settings: Annotated[Settings, Depends(_get_settings)],
) -> list[dict[str, Any]]:
    result = await missions_domain.list_missions(settings)
    return [m.model_dump(mode="json") for m in result]


@router.post("/", status_code=201)
async def upload_missions(
    request: Request,
    files: Annotated[list[UploadFile], File()],
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    if len(files) > 64:
        raise HTTPException(status_code=400, detail="Maximum 64 files per upload")

    # Check every file before storing any, so a bad one doesn't leave half an upload
    contents: list[tuple[str, bytes]] = []
    for upload in files:
        filename = upload.filename or "mission.pbo"
        base = PureWindowsPath(filename).name
        if not base.lower().endswith(".pbo"):
            raise HTTPException(status_code=400, detail=f"Only .pbo files can be uploaded ('{filename}')")
        if base.lower() == ".pbo":
            raise HTTPException(status_code=400, detail=f"'{filename}' has no mission name")
        content = await upload.read()
        if not content:
            raise HTTPException(status_code=400, detail=f"'{filename}' is empty")
        if len(content) > _MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"File '{filename}' exceeds 512 MB limit")
        contents.append((filename, content))

    uploaded: list[str] = []
    for filename, content in contents:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pbo") as tmp:
            tmp.write(content)
            tmp_path = Path(tmp.name)
        try:
            uploaded.append(await missions_domain.save_upload(tmp_path, filename, settings))
        finally:
            tmp_path.unlink(missing_ok=True)  # no-op once moved; cleans up a refused save

    await request.app.state.bus.publish("missions", None)
    return {"uploaded": uploaded}


@router.get("/{filename}")
async def download_mission(
    filename: str,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> FileResponse:
    path = missions_domain.mission_path(filename, settings)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Mission not found")
    return FileResponse(str(path), filename=filename)


@router.delete("/{filename}")
async def delete_mission(
    filename: str,
    request: Request,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    if not await missions_domain.delete_mission(filename, settings):
        raise HTTPException(status_code=404, detail="Mission not found")
    await request.app.state.bus.publish("missions", None)
    return {"deleted": filename}


@router.post("/refresh")
async def refresh_missions(
    request: Request,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> list[dict[str, Any]]:
    result = await missions_domain.list_missions(settings)
    await request.app.state.bus.publish("missions", None)
    return [m.model_dump(mode="json") for m in result]


@router.post("/workshop")
async def download_workshop(
    body: dict[str, str],
    request: Request,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    item_id = body.get("id", "").strip()
    if not item_id:
        raise HTTPException(status_code=400, detail="Workshop item ID required")
    if not item_id.isdigit():
        raise HTTPException(status_code=400, detail="Workshop item ID must be a number")
    from app.core.paths import missions_dir
    ok = await workshop_svc.download_workshop_mission(item_id, missions_dir(settings))
    if not ok:
        raise HTTPException(status_code=502, detail="Workshop download failed")
    await request.app.state.bus.publish("missions", None)
    return {"ok": True, "id": item_id}
