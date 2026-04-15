from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from app.api import require_auth
from app.core.config import Settings
from app.domain import missions as missions_domain
from app.services import workshop as workshop_svc

router = APIRouter(prefix="/api/missions", dependencies=[Depends(require_auth)])


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
    _MAX_FILE_SIZE = 512 * 1024 * 1024  # 512 MB per file

    if len(files) > 64:
        raise HTTPException(status_code=400, detail="Maximum 64 files per upload")

    uploaded: list[str] = []
    for upload in files:
        filename = upload.filename or "mission.pbo"
        if not filename.lower().endswith(".pbo"):
            continue
        content = await upload.read()
        if len(content) > _MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail=f"File '{filename}' exceeds 512 MB limit")
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pbo") as tmp:
            tmp.write(content)
            tmp_path = Path(tmp.name)
        await missions_domain.save_upload(tmp_path, filename, settings)
        uploaded.append(filename.lower())

    await request.app.state.bus.publish("missions", None)
    return {"uploaded": uploaded}


@router.get("/{filename}")
async def download_mission(
    filename: str,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> FileResponse:
    from app.core.paths import missions_dir
    base = missions_dir(settings).resolve()
    path = (base / filename).resolve()
    if not str(path).startswith(str(base)):
        raise HTTPException(status_code=400, detail="Invalid filename")
    if not path.exists():
        raise HTTPException(status_code=404, detail="Mission not found")
    return FileResponse(str(path), filename=filename)


@router.delete("/{filename}")
async def delete_mission(
    filename: str,
    request: Request,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    from app.core.paths import missions_dir
    base = missions_dir(settings).resolve()
    path = (base / filename).resolve()
    if not str(path).startswith(str(base)):
        raise HTTPException(status_code=400, detail="Invalid filename")
    await missions_domain.delete_mission(filename, settings)
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
