from __future__ import annotations

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter(prefix="/api")


@router.get("/auth")
def auth_status() -> dict[str, bool]:
    """Returns whether authentication is required. No credentials needed to call this."""
    settings = get_settings()
    required = bool(settings.auth.username and settings.auth.password)
    return {"auth_required": required}
