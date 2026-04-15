from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request

from app.api import require_auth
from app.core.config import Settings
from app.domain.settings import get_settings_schema

router = APIRouter(prefix="/api/settings", dependencies=[Depends(require_auth)])


def _get_settings(request: Request) -> Settings:
    return request.app.state.settings


@router.get("/")
def get_settings(
    settings: Annotated[Settings, Depends(_get_settings)],
) -> dict[str, Any]:
    return get_settings_schema(settings).model_dump()
