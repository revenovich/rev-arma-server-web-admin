from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ModEntry(BaseModel):
    name: str
    source: str  # "steam" | "local" | "unknown"
    url: str | None = None
    steam_id: str | None = None


class Preset(BaseModel):
    preset_name: str
    source_file: str
    mod_count: int
    mods: list[ModEntry]


class PresetGroup(BaseModel):
    mod_count: int
    mods: list[ModEntry]


class Comparison(BaseModel):
    compared_presets: list[str]
    shared: PresetGroup
    unique: dict[str, PresetGroup]


class MissingMod(BaseModel):
    name: str
    steam_id: str | None = None
    url: str | None = None
    # "shared" or a preset name — sync-missing uses this to choose the target download folder
    group: str


class MissingReport(BaseModel):
    generated_at: datetime
    total_mods: int
    on_server: int
    missing: int
    missing_mods: list[MissingMod]


class LinkStatus(BaseModel):
    name: str
    source_path: str
    link_path: str
    is_linked: bool


class NameCheckResult(BaseModel):
    folder: str
    steam_id_local: str | None = None
    server_canonical: str | None = None
    # "exact" | "case_insensitive" | "normalized" | "steam_id" | None (not found)
    match_method: str | None = None
    mismatch: bool = False
    suggested_rename: str | None = None
