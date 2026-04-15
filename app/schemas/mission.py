from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class MissionSchema(BaseModel):
    name: str
    missionName: str
    worldName: str
    size: int
    sizeFormatted: str
    dateCreated: datetime
    dateModified: datetime
