from __future__ import annotations

from pydantic import BaseModel


class SettingsSchema(BaseModel):
    game: str
    path: str
    port: int
    host: str
    type: str
    prefix: str
    suffix: str
    parameters: list[str]
    serverMods: list[str]
    admins: list[str]
    logFormat: str
    additionalConfigurationOptions: str
