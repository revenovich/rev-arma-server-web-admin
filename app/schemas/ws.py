from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class WsEnvelope(BaseModel):
    type: str  # "servers" | "missions" | "mods" | "settings" | "presets"
    serverId: str | None = None
    payload: Any = None
