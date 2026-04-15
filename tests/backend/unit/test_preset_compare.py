"""Unit tests for preset_compare.compare_presets."""
from __future__ import annotations

import pytest

from app.schemas.preset import ModEntry, Preset
from app.services.preset_compare import compare_presets, _mod_key


def _mod(name: str, steam_id: str | None = None) -> ModEntry:
    return ModEntry(name=name, steam_id=steam_id, source="steam")


def _preset(name: str, mods: list[ModEntry]) -> Preset:
    return Preset(preset_name=name, source_file=f"{name}.html", mod_count=len(mods), mods=mods)


# ---------------------------------------------------------------------------
# _mod_key
# ---------------------------------------------------------------------------

def test_mod_key_prefers_steam_id() -> None:
    assert _mod_key(_mod("@CBA_A3", steam_id="450814997")) == "450814997"


def test_mod_key_falls_back_to_name() -> None:
    assert _mod_key(_mod("@CBA_A3")) == "@CBA_A3"


# ---------------------------------------------------------------------------
# compare_presets — error cases
# ---------------------------------------------------------------------------

def test_compare_presets_requires_at_least_two() -> None:
    with pytest.raises(ValueError, match="at least 2"):
        compare_presets(_preset("solo", []))


# ---------------------------------------------------------------------------
# compare_presets — two presets with no overlap
# ---------------------------------------------------------------------------

def test_compare_presets_all_unique() -> None:
    a = _preset("A", [_mod("@ACE")])
    b = _preset("B", [_mod("@CBA")])
    result = compare_presets(a, b)

    assert result.shared.mod_count == 0
    assert result.shared.mods == []
    assert result.unique["A"].mod_count == 1
    assert result.unique["B"].mod_count == 1


# ---------------------------------------------------------------------------
# compare_presets — two presets with full overlap
# ---------------------------------------------------------------------------

def test_compare_presets_all_shared() -> None:
    mods = [_mod("@ACE", steam_id="123"), _mod("@CBA", steam_id="456")]
    a = _preset("A", mods)
    b = _preset("B", mods)
    result = compare_presets(a, b)

    assert result.shared.mod_count == 2
    assert result.unique["A"].mod_count == 0
    assert result.unique["B"].mod_count == 0


# ---------------------------------------------------------------------------
# compare_presets — partial overlap
# ---------------------------------------------------------------------------

def test_compare_presets_partial_overlap() -> None:
    shared_mod = _mod("@ACE", steam_id="111")
    a = _preset("A", [shared_mod, _mod("@ExclusiveA")])
    b = _preset("B", [shared_mod, _mod("@ExclusiveB")])
    result = compare_presets(a, b)

    assert result.shared.mod_count == 1
    assert result.shared.mods[0].name == "@ACE"
    assert result.unique["A"].mod_count == 1
    assert result.unique["A"].mods[0].name == "@ExclusiveA"
    assert result.unique["B"].mod_count == 1
    assert result.unique["B"].mods[0].name == "@ExclusiveB"


# ---------------------------------------------------------------------------
# compare_presets — steam_id-first identity (name differs but steam_id matches)
# ---------------------------------------------------------------------------

def test_compare_presets_uses_steam_id_for_identity() -> None:
    # Same steam_id, different display name → treated as same mod
    a = _preset("A", [_mod("@CBA_A3", steam_id="450814997")])
    b = _preset("B", [_mod("@Community Based Addons", steam_id="450814997")])
    result = compare_presets(a, b)
    assert result.shared.mod_count == 1


# ---------------------------------------------------------------------------
# compare_presets — three presets
# ---------------------------------------------------------------------------

def test_compare_presets_three_presets() -> None:
    common = _mod("@ACE", steam_id="111")
    a = _preset("A", [common, _mod("@ModA")])
    b = _preset("B", [common, _mod("@ModB")])
    c = _preset("C", [common, _mod("@ModC")])
    result = compare_presets(a, b, c)

    assert result.shared.mod_count == 1
    assert result.shared.mods[0].steam_id == "111"
    assert result.unique["A"].mod_count == 1
    assert result.unique["B"].mod_count == 1
    assert result.unique["C"].mod_count == 1
    assert result.compared_presets == ["A", "B", "C"]


# ---------------------------------------------------------------------------
# compare_presets — empty presets
# ---------------------------------------------------------------------------

def test_compare_presets_both_empty() -> None:
    a = _preset("A", [])
    b = _preset("B", [])
    result = compare_presets(a, b)
    assert result.shared.mod_count == 0


def test_compare_presets_one_empty() -> None:
    a = _preset("A", [_mod("@ACE")])
    b = _preset("B", [])
    result = compare_presets(a, b)
    assert result.shared.mod_count == 0
    assert result.unique["A"].mod_count == 1
