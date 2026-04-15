"""Test that servers.json round-trips without data loss or field-name mutation."""
from __future__ import annotations

import json
from pathlib import Path

from app.schemas.server import ServerSchema

# A representative servers.json fixture that mirrors the Node.js app's output.
# Field names use the exact mix of camelCase / snake_case from the original app.
_FIXTURE: list[dict] = [
    {
        "title": "Main Server",
        "port": 2302,
        "additionalConfigurationOptions": "",
        "admin_password": "secret",
        "allowed_file_patching": 0,
        "auto_start": True,
        "battle_eye": True,
        "file_patching": False,
        "forcedDifficulty": "Custom",
        "max_players": 64,
        "missions": [{"name": "co_10.Stratis"}],
        "mods": ["@CBA_A3", "@ACE"],
        "motd": "Welcome",
        "number_of_headless_clients": 2,
        "parameters": ["-profiles=profiles"],
        "password": "join",
        "persistent": True,
        "von": False,
        "verify_signatures": 2,
    }
]


def test_schema_round_trip_preserves_all_fields() -> None:
    """model_dump() must reproduce every key that was loaded, with the same name."""
    schema = ServerSchema(**_FIXTURE[0])
    dumped = schema.model_dump(exclude_none=False)

    for key, value in _FIXTURE[0].items():
        assert key in dumped, f"Field '{key}' missing from model_dump()"
        assert dumped[key] == value, f"Field '{key}' changed: {value!r} → {dumped[key]!r}"


def test_manager_load_save_round_trip(tmp_path: Path) -> None:
    """load() → save() must produce byte-compatible output for a known fixture."""
    servers_json = tmp_path / "servers.json"
    servers_json.write_text(json.dumps(_FIXTURE), encoding="utf-8")

    from app.core.config import Settings
    from app.domain.manager import Manager
    from app.services.pubsub import EventBus

    settings = Settings(game="arma3", path=str(tmp_path), type="linux")
    bus = EventBus()

    import unittest.mock as mock

    with mock.patch("app.domain.manager.SERVERS_JSON", servers_json):
        mgr = Manager(settings, bus)
        mgr.load()

        assert len(mgr.servers) == 1
        server = mgr.servers[0]
        assert server.title == "Main Server"
        assert server.port == 2302

        # Now save and reload
        out_path = tmp_path / "servers_out.json"
        with mock.patch("app.domain.manager.SERVERS_JSON", out_path):
            mgr.save()

        reloaded = json.loads(out_path.read_text(encoding="utf-8"))
        assert len(reloaded) == 1
        record = reloaded[0]

        # Spot-check key preservation
        assert record["forcedDifficulty"] == "Custom"
        assert record["additionalConfigurationOptions"] == ""
        assert record["battle_eye"] is True
        assert record["mods"] == ["@CBA_A3", "@ACE"]


def test_manager_sorted_by_title(tmp_path: Path) -> None:
    """servers property returns servers sorted by title.lower()."""
    fixture = [
        {"title": "Zebra Server", "port": 2400},
        {"title": "Alpha Server", "port": 2302},
        {"title": "Middle Server", "port": 2350},
    ]
    servers_json = tmp_path / "servers.json"
    servers_json.write_text(json.dumps(fixture), encoding="utf-8")

    import unittest.mock as mock

    from app.core.config import Settings
    from app.domain.manager import Manager
    from app.services.pubsub import EventBus

    settings = Settings(game="arma3", path=str(tmp_path), type="linux")
    bus = EventBus()

    with mock.patch("app.domain.manager.SERVERS_JSON", servers_json):
        mgr = Manager(settings, bus)
        mgr.load()

    titles = [s.title for s in mgr.servers]
    assert titles == sorted(titles, key=str.lower)


def test_extra_fields_preserved(tmp_path: Path) -> None:
    """Unknown fields in servers.json (extra='allow') survive a round-trip."""
    fixture = [{"title": "Test", "port": 2302, "unknownFutureField": "value123"}]
    servers_json = tmp_path / "servers.json"
    servers_json.write_text(json.dumps(fixture), encoding="utf-8")

    import unittest.mock as mock

    from app.core.config import Settings
    from app.domain.manager import Manager
    from app.services.pubsub import EventBus

    settings = Settings(game="arma3", path=str(tmp_path), type="linux")
    bus = EventBus()

    out_path = tmp_path / "out.json"
    with mock.patch("app.domain.manager.SERVERS_JSON", servers_json):
        mgr = Manager(settings, bus)
        mgr.load()

    with mock.patch("app.domain.manager.SERVERS_JSON", out_path):
        mgr.save()

    reloaded = json.loads(out_path.read_text())
    assert reloaded[0].get("unknownFutureField") == "value123"
