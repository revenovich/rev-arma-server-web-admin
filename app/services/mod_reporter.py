from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.schemas.preset import Comparison, MissingMod, MissingReport


def build_missing_report(
    comparison: Comparison,
    server_index: dict[str, Any],
) -> MissingReport:
    """Cross-reference all mods in comparison against server index.

    The "group" field on each missing mod is critical — sync_missing uses it
    to decide which download subfolder to place the mod in.
    """
    all_mods: list[tuple[str, str | None, str | None, str]] = []  # (name, steam_id, url, group)
    for mod in comparison.shared.mods:
        all_mods.append((mod.name, mod.steam_id, mod.url, "shared"))
    for group_name, group in comparison.unique.items():
        for mod in group.mods:
            all_mods.append((mod.name, mod.steam_id, mod.url, group_name))

    missing_mods: list[MissingMod] = []
    on_server = 0

    for name, steam_id, url, group in all_mods:
        found = False
        if steam_id and steam_id in server_index.get("by_steam_id", {}):
            found = True
        elif _normalize_name(name) in server_index.get("by_name", {}):
            found = True

        if found:
            on_server += 1
        else:
            missing_mods.append(
                MissingMod(name=name, steam_id=steam_id, url=url, group=group)
            )

    return MissingReport(
        generated_at=datetime.now(tz=timezone.utc),
        total_mods=len(all_mods),
        on_server=on_server,
        missing=len(missing_mods),
        missing_mods=missing_mods,
    )


def _normalize_name(name: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]", "", name.lstrip("@").lower())
