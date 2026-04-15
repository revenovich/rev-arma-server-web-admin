from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ModSchema(BaseModel):
    name: str
    size: int
    formattedSize: str
    modFile: Any = None
    steamMeta: Any = None
