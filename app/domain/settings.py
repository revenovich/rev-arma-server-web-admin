from __future__ import annotations

from app.core.config import Settings
from app.schemas.settings import SettingsSchema


def get_settings_schema(settings: Settings) -> SettingsSchema:
    """Expose all config keys to the frontend — not just game/path/type."""
    return SettingsSchema(
        game=settings.game,
        path=settings.path,
        port=settings.port,
        host=settings.host,
        type=settings.type,
        prefix=settings.prefix,
        suffix=settings.suffix,
        parameters=settings.parameters,
        serverMods=settings.server_mods,
        admins=settings.admins,
        logFormat=settings.log_format,
        additionalConfigurationOptions=settings.additional_configuration_options,
    )
