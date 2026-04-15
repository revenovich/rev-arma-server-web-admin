from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AuthConfig(BaseModel):
    username: str = ""
    password: str = ""


class CaddyConfig(BaseModel):
    base_url: str = ""
    username: str = ""
    password: str = ""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="ARMA_",
        env_nested_delimiter="__",
        case_sensitive=False,
        extra="ignore",
    )

    # Core — mirrors config.js keys
    game: str = "arma3"
    path: str = ""
    port: int = 9500
    host: str = "0.0.0.0"
    type: str = "linux"  # linux | windows | wine
    prefix: str = ""
    suffix: str = ""
    log_format: str = "dev"
    additional_configuration_options: str = ""
    parameters: list[str] = []
    server_mods: list[str] = []
    admins: list[str] = []
    auth: AuthConfig = AuthConfig()

    # Preset pipeline — Caddy file server (optional)
    caddy: CaddyConfig = CaddyConfig()

    @field_validator("type")
    @classmethod
    def validate_platform(cls, v: str) -> str:
        if v not in {"linux", "windows", "wine"}:
            raise ValueError("type must be linux, windows, or wine")
        return v


_settings: Settings | None = None


def load_settings(config_path: Path | None = None) -> Settings:
    global _settings

    path = config_path or Path("config.json")
    if path.exists():
        raw: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
        _settings = Settings(**_normalize_keys(raw))
    else:
        _settings = Settings()

    return _settings


def get_settings() -> Settings:
    if _settings is None:
        return load_settings()
    return _settings


# Map config.js camelCase keys → pydantic snake_case fields
_KEY_MAP: dict[str, str] = {
    "logFormat": "log_format",
    "additionalConfigurationOptions": "additional_configuration_options",
    "serverMods": "server_mods",
}


def _normalize_keys(raw: dict[str, Any]) -> dict[str, Any]:
    return {_KEY_MAP.get(k, k): v for k, v in raw.items()}
