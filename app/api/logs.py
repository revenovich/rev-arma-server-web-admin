from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, PlainTextResponse

from app.api import require_auth
from app.core.config import Settings
from app.domain import logs as logs_domain

router = APIRouter(prefix="/api/logs", dependencies=[Depends(require_auth)])


def _get_settings(request: Request) -> Settings:
    return request.app.state.settings


@router.get("/")
def list_logs(
    settings: Annotated[Settings, Depends(_get_settings)],
) -> list[dict[str, Any]]:
    return [entry.model_dump() for entry in logs_domain.list_logs(settings)]


@router.delete("/{filename}")
def delete_log(
    filename: str,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    ok = logs_domain.delete_log(filename, settings)
    if not ok:
        raise HTTPException(status_code=404, detail="Log file not found")
    return {"deleted": filename}


@router.get("/{filename}/{mode}")
def get_log(
    filename: str,
    mode: str,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> Any:
    if mode not in ("view", "download"):
        raise HTTPException(status_code=400, detail="mode must be 'view' or 'download'")

    entry = logs_domain.get_log(filename, settings)
    if entry is None:
        raise HTTPException(status_code=404, detail="Log file not found")

    if mode == "download":
        return FileResponse(entry.path, filename=filename)

    try:
        with open(entry.path, encoding="utf-8", errors="replace") as fh:
            text = fh.read()
    except OSError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return PlainTextResponse(text)
