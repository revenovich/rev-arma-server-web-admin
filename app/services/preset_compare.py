from __future__ import annotations

from app.schemas.preset import Comparison, ModEntry, Preset, PresetGroup


def _mod_key(mod: ModEntry) -> str:
    """Identity key: steam_id first, display name fallback."""
    return mod.steam_id or mod.name


def compare_presets(*presets: Preset) -> Comparison:
    """Compare 2+ presets and return shared / unique breakdown."""
    if len(presets) < 2:
        raise ValueError("compare_presets requires at least 2 presets")

    # Build a set of keys per preset
    keys_per_preset: list[set[str]] = [
        {_mod_key(m) for m in p.mods} for p in presets
    ]
    # Mods present in ALL presets
    shared_keys = keys_per_preset[0].intersection(*keys_per_preset[1:])

    # Build lookup: key → ModEntry (first occurrence wins)
    all_mods: dict[str, ModEntry] = {}
    for preset in presets:
        for mod in preset.mods:
            k = _mod_key(mod)
            if k not in all_mods:
                all_mods[k] = mod

    shared_mods = [all_mods[k] for k in sorted(shared_keys)]
    unique: dict[str, PresetGroup] = {}
    for preset, keys in zip(presets, keys_per_preset):
        unique_keys = keys - shared_keys
        unique_mods = [all_mods[k] for k in sorted(unique_keys)]
        unique[preset.preset_name] = PresetGroup(
            mod_count=len(unique_mods), mods=unique_mods
        )

    return Comparison(
        compared_presets=[p.preset_name for p in presets],
        shared=PresetGroup(mod_count=len(shared_mods), mods=shared_mods),
        unique=unique,
    )
