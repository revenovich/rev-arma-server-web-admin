from __future__ import annotations

from enum import Enum
from typing import Any


class GameType(str, Enum):
    ARMA3 = "arma3"
    ARMA3_X64 = "arma3_x64"
    ARMA2OA = "arma2oa"
    ARMA2 = "arma2"
    ARMA1 = "arma1"
    OFP = "ofp"
    CWA = "cwa"
    OFP_RESISTANCE = "ofpresistance"


_arma3_features: dict[str, Any] = {
    "basic_cfg": True,
    "difficulty_profile": True,
    "von_codec": True,
    "headless_client": True,
    "workshop": True,
    "battleye": True,
    "anti_flood": True,
    "advanced_options": True,
    "scripting_hooks": True,
    "steamcmd_app_id": 233780,
}

GAME_FEATURES: dict[str, dict[str, Any]] = {
    "arma3": _arma3_features,
    "arma3_x64": {**_arma3_features},
    "arma2oa": {
        "basic_cfg": True,
        "difficulty_profile": True,
        "von_codec": False,
        "headless_client": True,
        "workshop": False,
        "battleye": True,
        "anti_flood": False,
        "advanced_options": False,
        "scripting_hooks": True,
        "steamcmd_app_id": 33910,
    },
    "arma2": {
        "basic_cfg": False,
        "difficulty_profile": False,
        "von_codec": False,
        "headless_client": False,
        "workshop": False,
        "battleye": False,
        "anti_flood": False,
        "advanced_options": False,
        "scripting_hooks": True,
        "steamcmd_app_id": 33910,
    },
    "arma1": {
        "basic_cfg": False,
        "difficulty_profile": False,
        "von_codec": False,
        "headless_client": False,
        "workshop": False,
        "battleye": False,
        "anti_flood": False,
        "advanced_options": False,
        "scripting_hooks": False,
        "steamcmd_app_id": None,
    },
    "ofp": {
        "basic_cfg": False,
        "difficulty_profile": False,
        "von_codec": False,
        "headless_client": False,
        "workshop": False,
        "battleye": False,
        "anti_flood": False,
        "advanced_options": False,
        "scripting_hooks": False,
        "steamcmd_app_id": None,
    },
    "cwa": {
        "basic_cfg": False,
        "difficulty_profile": False,
        "von_codec": False,
        "headless_client": False,
        "workshop": False,
        "battleye": False,
        "anti_flood": False,
        "advanced_options": False,
        "scripting_hooks": False,
        "steamcmd_app_id": None,
    },
    "ofpresistance": {
        "basic_cfg": False,
        "difficulty_profile": False,
        "von_codec": False,
        "headless_client": False,
        "workshop": False,
        "battleye": False,
        "anti_flood": False,
        "advanced_options": False,
        "scripting_hooks": False,
        "steamcmd_app_id": None,
    },
}

# Gamedig / A2S query type per game
QUERY_TYPES: dict[str, str] = {
    "arma1": "arma",
    "arma2": "arma2",
    "arma2oa": "arma2",
    "arma3": "arma3",
    "arma3_x64": "arma3",
    "cwa": "operationflashpoint",
    "ofp": "operationflashpoint",
    "ofpresistance": "operationflashpoint",
}


def get_features(game: str) -> dict[str, Any]:
    return GAME_FEATURES.get(game, GAME_FEATURES["arma3"])
