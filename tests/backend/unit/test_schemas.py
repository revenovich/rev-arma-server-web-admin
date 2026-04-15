"""Schema validation and serialisation tests."""
from __future__ import annotations

from datetime import timezone

from app.schemas.preset import Comparison, MissingMod, MissingReport, ModEntry, Preset, PresetGroup
from app.schemas.server import ServerSchema

# --- ServerSchema ---

def test_server_schema_defaults() -> None:
    s = ServerSchema(title="Test")
    assert s.port == 2302
    assert s.auto_start is False
    assert s.battle_eye is True
    assert s.mods == []


def test_server_schema_rejects_nothing_extra() -> None:
    """extra='allow' means unknown fields are stored, not rejected."""
    s = ServerSchema(title="Test", someNewField="hello")
    assert s.model_extra.get("someNewField") == "hello"  # type: ignore[union-attr]


def test_server_schema_camel_field_names_preserved() -> None:
    data = {"title": "T", "forcedDifficulty": "Custom", "additionalConfigurationOptions": "-skipIntro"}
    s = ServerSchema(**data)
    dumped = s.model_dump()
    assert dumped["forcedDifficulty"] == "Custom"
    assert dumped["additionalConfigurationOptions"] == "-skipIntro"


# --- ModEntry / Preset ---

def test_mod_entry_optional_fields() -> None:
    m = ModEntry(name="@CBA_A3", source="unknown")
    assert m.steam_id is None
    assert m.url is None
    assert m.source == "unknown"


def test_preset_construction() -> None:
    mods = [
        ModEntry(name="@CBA_A3", steam_id="450814997", source="steam"),
        ModEntry(name="@ACE", steam_id="463939057", source="steam"),
    ]
    p = Preset(preset_name="My Preset", source_file="my_preset.html", mod_count=2, mods=mods)
    assert p.mod_count == 2
    assert p.mods[0].name == "@CBA_A3"


# --- Comparison ---

def test_comparison_structure() -> None:
    shared = PresetGroup(mod_count=1, mods=[ModEntry(name="@CBA_A3", steam_id="450814997", source="steam")])
    unique = {
        "preset_a": PresetGroup(mod_count=1, mods=[ModEntry(name="@ACE", source="steam")]),
        "preset_b": PresetGroup(mod_count=1, mods=[ModEntry(name="@ACRE2", source="steam")]),
    }
    c = Comparison(compared_presets=["preset_a", "preset_b"], shared=shared, unique=unique)
    assert len(c.shared.mods) == 1
    assert "preset_a" in c.unique


# --- MissingReport ---

def test_missing_report_group_field_present() -> None:
    """The 'group' field on MissingMod is critical — sync-missing uses it to place downloads."""
    m = MissingMod(name="@SomeMod", steam_id="123456", group="shared")
    assert m.group == "shared"


def test_missing_report_serialisation() -> None:
    from datetime import datetime

    report = MissingReport(
        generated_at=datetime.now(tz=timezone.utc),
        total_mods=10,
        on_server=8,
        missing=2,
        missing_mods=[
            MissingMod(name="@Mod1", steam_id="111", group="preset_a"),
            MissingMod(name="@Mod2", steam_id="222", group="shared"),
        ],
    )
    d = report.model_dump(mode="json")
    assert d["missing"] == 2
    assert d["missing_mods"][0]["group"] == "preset_a"
