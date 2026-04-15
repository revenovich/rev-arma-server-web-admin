from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request

from app.api import require_auth
from app.core.config import Settings
from app.services import steamcmd as steamcmd_svc

router = APIRouter(prefix="/api/steamcmd", dependencies=[Depends(require_auth)])


def _get_settings(request: Request) -> Settings:
    return request.app.state.settings


@router.post("/install")
async def install(
    body: dict[str, str],
    request: Request,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    return await steamcmd_svc.install_server(
        game=body.get("game", settings.game),
        install_path=body.get("path", settings.path),
        branch=body.get("branch", "public"),
        bus=request.app.state.bus,
    )


@router.post("/update")
async def update(
    body: dict[str, str],
    request: Request,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    return await steamcmd_svc.update_server(
        game=body.get("game", settings.game),
        install_path=body.get("path", settings.path),
        branch=body.get("branch", "public"),
        bus=request.app.state.bus,
    )


@router.post("/branch")
async def switch_branch(
    body: dict[str, str],
    request: Request,
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    return await steamcmd_svc.update_server(
        game=body.get("game", settings.game),
        install_path=body.get("path", settings.path),
        branch=body.get("branch", "public"),
        bus=request.app.state.bus,
    )


@router.get("/version")
async def get_version(
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    version = await steamcmd_svc.get_installed_version(settings.path)
    return {"version": version}
