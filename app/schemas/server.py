from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class ServerSchema(BaseModel):
    """Persisted server record — field names must match servers.json exactly.

    The original app uses a mix of snake_case and camelCase. These names are
    preserved verbatim so servers.json round-trips without data loss.
    """

    model_config = ConfigDict(extra="allow", populate_by_name=True)

    title: str
    port: int = 9520

    # Persisted as-is from the original Node.js app
    additionalConfigurationOptions: str | None = None
    admin_password: str | None = None
    allowed_file_patching: int | None = None
    auto_start: bool = False
    battle_eye: bool = True
    file_patching: bool = False
    forcedDifficulty: str | None = None
    max_players: int = 32
    missions: list[Any] = []
    mods: list[str] = []
    motd: str | None = None
    number_of_headless_clients: int = 0
    parameters: list[str] = []
    password: str | None = None
    persistent: bool = False
    von: bool = True
    verify_signatures: int = 2
