from __future__ import annotations

from pydantic import BaseModel


class LogSchema(BaseModel):
    name: str
    path: str
    size: int
    formattedSize: str
    created: str
    modified: str
