from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request

from app.api import require_auth
from app.core.config import Settings
from app.domain import mods as mods_domain

router = APIRouter(prefix="/api/mods", dependencies=[Depends(require_auth)])


def _get_settings(request: Request) -> Settings:
    return request.app.state.settings


@router.get("/")
def list_mods(
    settings: Annotated[Settings, Depends(_get_settings)],
) -> list[dict[str, Any]]:
    return [m.model_dump() for m in mods_domain.list_mods(settings)]
