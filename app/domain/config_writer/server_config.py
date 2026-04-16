from __future__ import annotations

from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.schemas.server import ServerSchema


def write_server_cfg(schema: ServerSchema, settings: Settings, dest: Path) -> None:
    """Write server.cfg from a ServerSchema.

    Field mapping mirrors arma-server npm package output so existing golden-file
    tests can diff against Node-generated configs.
    """
    lines: list[str] = []

    def s(val: str | None) -> str:
        return f'"{val}"' if val else '""'

    def arr(items: list[Any]) -> str:
        quoted = ", ".join(f'"{x}"' for x in items)
        return "{" + quoted + "}"

    # Identity
    title = schema.title
    if settings.prefix:
        title = settings.prefix + title
    if settings.suffix:
        title = title + settings.suffix
    lines.append(f"hostname = {s(title)};")
    lines.append(f"password = {s(schema.password)};")
    lines.append(f"passwordAdmin = {s(schema.admin_password)};")
    lines.append(f"maxPlayers = {schema.max_players};")

    if schema.motd:
        motd_lines = schema.motd.split("\n")
        motd_arr = ", ".join(f'"{ln}"' for ln in motd_lines)
        lines.append(f"motd[] = {{{motd_arr}}};")
        lines.append("motdInterval = 5;")

    # Admins
    admin_arr = arr(settings.admins) if settings.admins else "{}"
    lines.append(f"admins[] = {admin_arr};")

    # Headless clients
    hc_count = schema.number_of_headless_clients
    if hc_count > 0:
        lines.append('headlessClients[] = {"127.0.0.1"};')
        lines.append('localClient[] = {"127.0.0.1"};')

    # Network / security
    lines.append(f"persistent = {1 if schema.persistent else 0};")
    lines.append(f"disableVoN = {0 if schema.von else 1};")
    lines.append(f"verifySignatures = {schema.verify_signatures};")
    lines.append(f"allowedFilePatching = {schema.allowed_file_patching or 1};")
    lines.append(f"battleye = {1 if schema.battle_eye else 0};")

    if schema.forcedDifficulty:
        lines.append(f"forcedDifficulty = {s(schema.forcedDifficulty)};")

    # Missions rotation
    if schema.missions:
        lines.append("")
        lines.append("class Missions {")
        for i, mission in enumerate(schema.missions, start=1):
            template = mission.get("template", "") if isinstance(mission, dict) else str(mission)
            difficulty = mission.get("difficulty", "Regular") if isinstance(mission, dict) else "Regular"
            params = mission.get("params", []) if isinstance(mission, dict) else []
            lines.append(f"    class Mission_{i} {{")
            lines.append(f'        template = "{template}";')
            lines.append(f'        difficulty = "{difficulty}";')
            for param in params:
                lines.append(f"        {param};")
            lines.append("    };")
        lines.append("};")

    # Additional raw options appended at end
    global_extra = settings.additional_configuration_options or ""
    local_extra = schema.additionalConfigurationOptions or ""
    extra = "\n".join(filter(None, [global_extra, local_extra]))
    if extra:
        lines.append("")
        lines.append(extra)

    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text("\n".join(lines) + "\n", encoding="utf-8")
