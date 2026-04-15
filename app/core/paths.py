from __future__ import annotations

import os
from pathlib import Path

from app.core.config import Settings

# Mod directory glob — matches @-prefixed mods and Creator DLC folders
MOD_SCAN_GLOB = "**/{@*,csla,ef,gm,rf,spe,vn,ws}/addons"

SERVERS_JSON = Path("servers.json")
LOGS_RETENTION = 20

_GAME_LOG_FOLDERS: dict[str, str] = {
    "arma1": "ArmA",
    "arma2": "ArmA 2",
    "arma2oa": "ArmA 2 OA",
    "arma3": "Arma 3",
    "arma3_x64": "Arma 3",
}


def game_dir(settings: Settings) -> Path:
    return Path(settings.path)


def missions_dir(settings: Settings) -> Path:
    return game_dir(settings) / "mpmissions"


def logs_dir(settings: Settings) -> Path | None:
    platform = settings.type
    game = settings.game

    if platform == "linux":
        return game_dir(settings) / "logs"

    folder = _GAME_LOG_FOLDERS.get(game)
    if folder is None:
        return None

    if platform == "windows":
        local = os.environ.get("LOCALAPPDATA") or str(Path.home() / "AppData" / "Local")
        return Path(local) / folder

    if platform == "wine":
        user = os.environ.get("USER", "user")
        return (
            Path.home()
            / ".wine"
            / "drive_c"
            / "users"
            / user
            / "Local Settings"
            / "Application Data"
            / folder
        )

    return None
