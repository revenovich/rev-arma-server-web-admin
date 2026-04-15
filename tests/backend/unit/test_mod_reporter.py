"""Unit tests for mod_reporter.build_missing_report."""
from __future__ import annotations

from app.schemas.preset import Comparison, ModEntry, MissingReport, PresetGroup
from app.services.mod_reporter import build_missing_report, _normalize_name


def _mod(name: str, steam_id: str | None = None) -> ModEntry:
    return ModEntry(name=name, steam_id=steam_id, source="steam")


def _comparison(
    shared_mods: list[ModEntry] | None = None,
    unique: dict[str, list[ModEntry]] | None = None,
) -> Comparison:
    shared_mods = shared_mods or []
    unique_groups: dict[str, PresetGroup] = {}
    for name, mods in (unique or {}).items():
        unique_groups[name] = PresetGroup(mod_count=len(mods), mods=mods)
    return Comparison(
        compared_presets=list((unique or {}).keys()),
        shared=PresetGroup(mod_count=len(shared_mods), mods=shared_mods),
        unique=unique_groups,
    )


# ---------------------------------------------------------------------------
# _normalize_name
# ---------------------------------------------------------------------------

def test_normalize_name_strips_at() -> None:
    assert _normalize_name("@CBA_A3") == "cbaa3"


def test_normalize_name_strips_special_chars() -> None:
    assert _normalize_name("@ACE 3") == "ace3"


def test_normalize_name_lowercases() -> None:
    assert _normalize_name("@RHS_AFRF") == "rhsafrf"


# ---------------------------------------------------------------------------
# build_missing_report — all on server
# ---------------------------------------------------------------------------

def test_build_missing_report_all_found_by_steam_id() -> None:
    cmp = _comparison(shared_mods=[_mod("@ACE", steam_id="111")])
    index = {"by_steam_id": {"111": "http://server/@ace/"}, "by_name": {}}
    report = build_missing_report(cmp, index)

    assert report.total_mods == 1
    assert report.on_server == 1
    assert report.missing == 0
    assert report.missing_mods == []


def test_build_missing_report_all_found_by_name() -> None:
    cmp = _comparison(shared_mods=[_mod("@CBA_A3")])
    index = {"by_steam_id": {}, "by_name": {"cbaa3": "http://server/@cba_a3/"}}
    report = build_missing_report(cmp, index)

    assert report.on_server == 1
    assert report.missing == 0


# ---------------------------------------------------------------------------
# build_missing_report — some missing
# ---------------------------------------------------------------------------

def test_build_missing_report_missing_mod() -> None:
    cmp = _comparison(shared_mods=[_mod("@MissingMod", steam_id="999")])
    index = {"by_steam_id": {}, "by_name": {}}
    report = build_missing_report(cmp, index)

    assert report.missing == 1
    assert report.on_server == 0
    assert report.missing_mods[0].name == "@MissingMod"
    assert report.missing_mods[0].group == "shared"


def test_build_missing_report_unique_group_preserved() -> None:
    cmp = _comparison(unique={"preset_a": [_mod("@UniqueA")]})
    index = {"by_steam_id": {}, "by_name": {}}
    report = build_missing_report(cmp, index)

    assert report.missing == 1
    assert report.missing_mods[0].group == "preset_a"


def test_build_missing_report_mixed() -> None:
    cmp = _comparison(
        shared_mods=[_mod("@ACE", steam_id="111"), _mod("@Ghost")],
        unique={"A": [_mod("@UniqueOnA")]},
    )
    index = {"by_steam_id": {"111": "url"}, "by_name": {}}
    report = build_missing_report(cmp, index)

    assert report.total_mods == 3
    assert report.on_server == 1
    assert report.missing == 2
    missing_names = {m.name for m in report.missing_mods}
    assert "@Ghost" in missing_names
    assert "@UniqueOnA" in missing_names


# ---------------------------------------------------------------------------
# build_missing_report — empty comparison
# ---------------------------------------------------------------------------

def test_build_missing_report_empty_comparison() -> None:
    cmp = _comparison()
    report = build_missing_report(cmp, {"by_steam_id": {}, "by_name": {}})
    assert report.total_mods == 0
    assert report.on_server == 0
    assert report.missing == 0


# ---------------------------------------------------------------------------
# build_missing_report — report structure
# ---------------------------------------------------------------------------

def test_build_missing_report_has_generated_at() -> None:
    from datetime import datetime
    cmp = _comparison()
    report = build_missing_report(cmp, {"by_steam_id": {}, "by_name": {}})
    assert isinstance(report.generated_at, datetime)
