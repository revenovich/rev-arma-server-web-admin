"""Integration tests for /api/presets — basic state-machine and error paths."""
from __future__ import annotations

import io
import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

import app.api.presets as presets_module
from app.schemas.preset import (
    Comparison,
    MissingMod,
    MissingReport,
    ModEntry,
    PresetGroup,
)


@pytest.fixture(autouse=True)
def reset_presets_state() -> None:
    """Reset module-level state before each test."""
    presets_module._presets.clear()
    presets_module._comparison = None
    presets_module._missing_report = None
    yield
    presets_module._presets.clear()
    presets_module._comparison = None
    presets_module._missing_report = None


@pytest.fixture()
def client(tmp_path: Path) -> TestClient:
    from app.main import create_app

    config_file = tmp_path / "config.json"
    config_file.write_text(
        json.dumps({"game": "arma3", "path": str(tmp_path), "type": "linux"}),
        encoding="utf-8",
    )
    app = create_app(config_path=config_file)
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


# ---------------------------------------------------------------------------
# GET /api/presets/ — list
# ---------------------------------------------------------------------------

def test_list_presets_empty(client: TestClient) -> None:
    resp = client.get("/api/presets/")
    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# GET /api/presets/comparison — no comparison yet
# ---------------------------------------------------------------------------

def test_get_comparison_not_found(client: TestClient) -> None:
    resp = client.get("/api/presets/comparison")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/presets/compare — validation errors
# ---------------------------------------------------------------------------

def test_compare_less_than_two_presets(client: TestClient) -> None:
    resp = client.post("/api/presets/compare", json={"presets": ["only_one"]})
    assert resp.status_code == 400


def test_compare_preset_not_found(client: TestClient) -> None:
    resp = client.post("/api/presets/compare", json={"presets": ["alpha", "beta"]})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/presets/{name} — not found
# ---------------------------------------------------------------------------

def test_get_preset_not_found(client: TestClient) -> None:
    resp = client.get("/api/presets/ghost")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/presets/{name} — delete preset
# ---------------------------------------------------------------------------

def test_delete_preset_not_found(client: TestClient) -> None:
    resp = client.delete("/api/presets/ghost")
    assert resp.status_code == 404


def test_delete_preset_success(client: TestClient) -> None:
    from app.schemas.preset import ModEntry, Preset

    preset = Preset(
        preset_name="Test Preset",
        source_file="test_preset.html",
        mod_count=1,
        mods=[ModEntry(name="ACE", source="steam", steam_id="123")],
    )
    presets_module._presets["test_preset.html"] = preset.model_dump()
    resp = client.delete("/api/presets/test_preset.html")
    assert resp.status_code == 200
    assert resp.json()["deleted"] == "test_preset.html"
    assert "test_preset.html" not in presets_module._presets


# ---------------------------------------------------------------------------
# GET /api/presets/link-status — no downloads dir returns empty
# ---------------------------------------------------------------------------

def test_link_status_empty(client: TestClient) -> None:
    resp = client.get("/api/presets/link-status")
    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# POST /api/presets/link — delegates to mod_linker
# ---------------------------------------------------------------------------

def test_link_calls_linker(client: TestClient) -> None:
    with patch("app.api.presets.mod_linker.link_group", return_value={"linked": 0, "skipped": 0}):
        resp = client.post("/api/presets/link", json={"group": "shared"})
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /api/presets/unlink — delegates to mod_linker
# ---------------------------------------------------------------------------

def test_unlink_calls_linker(client: TestClient) -> None:
    with patch("app.api.presets.mod_linker.unlink_group", return_value={"unlinked": 0}):
        resp = client.post("/api/presets/unlink", json={"group": "shared"})
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /api/presets/migrate — requires comparison
# ---------------------------------------------------------------------------

def test_migrate_requires_comparison(client: TestClient) -> None:
    resp = client.post("/api/presets/migrate")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/presets/clean-orphans — requires comparison
# ---------------------------------------------------------------------------

def test_clean_orphans_requires_comparison(client: TestClient) -> None:
    resp = client.post("/api/presets/clean-orphans", json={})
    assert resp.status_code == 400


def test_clean_orphans_with_comparison_no_delete(client: TestClient) -> None:
    from app.schemas.preset import Comparison, PresetGroup

    presets_module._comparison = Comparison(
        compared_presets=["A"],
        shared=PresetGroup(mod_count=0, mods=[]),
        unique={},
    )
    resp = client.post("/api/presets/clean-orphans", json={"delete": False})
    assert resp.status_code == 200
    data = resp.json()
    assert "orphans" in data
    assert "deleted" in data


# ---------------------------------------------------------------------------
# GET /api/presets/missing-report — requires comparison and caddy config
# ---------------------------------------------------------------------------

def test_missing_report_requires_comparison(client: TestClient) -> None:
    resp = client.get("/api/presets/missing-report")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/presets/sync-missing — requires missing_report
# ---------------------------------------------------------------------------

def test_sync_missing_requires_missing_report(client: TestClient) -> None:
    resp = client.post("/api/presets/sync-missing")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/presets/update-mods — requires caddy.base_url
# ---------------------------------------------------------------------------

def test_update_mods_no_caddy_url(client: TestClient) -> None:
    resp = client.post("/api/presets/update-mods", json={"mod": "@ACE"})
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# GET /api/presets/check-names — requires caddy.base_url
# ---------------------------------------------------------------------------

def test_check_names_no_caddy_url(client: TestClient) -> None:
    resp = client.get("/api/presets/check-names")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# POST /api/presets/upload — upload valid HTML preset
# ---------------------------------------------------------------------------

def test_upload_preset(client: TestClient) -> None:
    # Minimal valid ArmA preset HTML (what the parser expects)
    html = """<?xml version="1.0" encoding="utf-8"?>
<html>
<head><title>Arma 3 - Preset Test</title></head>
<body>
<div id="mod-list">
<table>
<tr data-type="ModContainer">
  <td data-type="DisplayName">@CBA_A3</td>
  <td><a href="http://steamcommunity.com/sharedfiles/filedetails/?id=450814997" data-type="Link">Steam</a></td>
</tr>
</table>
</div>
</body>
</html>"""
    resp = client.post(
        "/api/presets/upload",
        files=[("files", ("test.html", io.BytesIO(html.encode()), "text/html"))],
    )
    assert resp.status_code == 201
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1


# ---------------------------------------------------------------------------
# Path traversal (S0): names from the request body or from uploaded presets
# become folder names under downloads/ and must not step outside it.
# ---------------------------------------------------------------------------

CADDY = "http://caddy.test/mods/"


@pytest.fixture()
def caddy_client(client: TestClient) -> TestClient:
    client.app.state.settings.caddy.base_url = CADDY
    return client


def _mock_caddy_ace(router: respx.Router) -> None:
    """Caddy listing with one mod folder, ``@ace``, holding a single file."""
    router.get(CADDY).mock(
        return_value=httpx.Response(200, json=[{"name": "@ace", "is_dir": True}])
    )
    router.get(CADDY + "@ace/meta.cpp").mock(return_value=httpx.Response(404))
    router.get(CADDY + "@ace/").mock(
        return_value=httpx.Response(200, json=[{"name": "mod.cpp", "is_dir": False, "size": 4}])
    )
    router.get(CADDY + "@ace/mod.cpp").mock(return_value=httpx.Response(200, content=b"name"))


def _make_comparison(shared: list[ModEntry], unique: dict[str, list[ModEntry]]) -> Comparison:
    return Comparison(
        compared_presets=list(unique),
        shared=PresetGroup(mod_count=len(shared), mods=shared),
        unique={k: PresetGroup(mod_count=len(v), mods=v) for k, v in unique.items()},
    )


def _assert_game_dir_untouched(tmp_path: Path) -> None:
    """Only config.json and downloads/ (if created) may exist in the game dir."""
    assert (tmp_path / "config.json").exists()
    assert sorted(p.name for p in tmp_path.iterdir()) in (
        ["config.json"],
        ["config.json", "downloads"],
    )


def test_update_mods_valid_name_downloads_into_group(
    caddy_client: TestClient, tmp_path: Path
) -> None:
    with respx.mock(assert_all_called=False) as router:
        _mock_caddy_ace(router)
        resp = caddy_client.post(
            "/api/presets/update-mods", json={"group": "shared", "mod": "@ace"}
        )
    assert resp.status_code == 200
    assert resp.json()["files_downloaded"] == 1
    assert (tmp_path / "downloads" / "shared" / "@ace" / "mod.cpp").read_bytes() == b"name"


@pytest.mark.parametrize(
    "body",
    [
        {"group": "shared", "mod": "@ace/../../.."},  # resolves to the game dir itself
        {"group": "shared", "mod": "@ace\\..\\..\\.."},
        {"group": "../..", "mod": "@ace"},
        {"group": "/etc", "mod": "@ace"},
        {"group": "C:\\Windows", "mod": "@ace"},
        {"group": "shared", "mod": ".."},
        {"group": "shared", "mod": ""},
    ],
)
def test_update_mods_rejects_traversal(
    caddy_client: TestClient, tmp_path: Path, body: dict[str, str]
) -> None:
    sentinel = tmp_path / "arma3server_x64"
    sentinel.write_bytes(b"game binary")
    with respx.mock(assert_all_called=False) as router:
        _mock_caddy_ace(router)
        resp = caddy_client.post("/api/presets/update-mods", json=body)
        assert not router.calls  # rejected before contacting Caddy
    assert resp.status_code == 400
    assert sentinel.read_bytes() == b"game binary"
    assert (tmp_path / "config.json").exists()


@pytest.mark.parametrize("endpoint", ["link", "unlink"])
@pytest.mark.parametrize("group", ["..", "../..", "shared/../..", "..\\..", "/etc", "C:\\Windows"])
def test_link_unlink_reject_traversal(client: TestClient, endpoint: str, group: str) -> None:
    with patch(f"app.api.presets.mod_linker.{endpoint}_group") as linker:
        resp = client.post(f"/api/presets/{endpoint}", json={"group": group})
    assert resp.status_code == 400
    linker.assert_not_called()


def test_migrate_rejects_traversal_in_preset_name(client: TestClient, tmp_path: Path) -> None:
    shared = tmp_path / "downloads" / "shared"
    (shared / "@good").mkdir(parents=True)
    (shared / "@cba").mkdir()
    presets_module._comparison = _make_comparison(
        shared=[],
        unique={
            "A": [ModEntry(name="@good", source="local")],
            "../escaped": [ModEntry(name="@cba", source="local")],
        },
    )
    resp = client.post("/api/presets/migrate")
    assert resp.status_code == 400
    # Nothing moved, not even the valid target listed before the bad one.
    assert (shared / "@good").is_dir()
    assert (shared / "@cba").is_dir()
    _assert_game_dir_untouched(tmp_path)


@pytest.mark.parametrize(
    ("group", "mod_name"),
    [("shared", "@ace/../../.."), ("../escaped", "@ace"), ("shared", "..\\..\\escaped")],
)
def test_fetch_rejects_traversal_in_preset_names(
    caddy_client: TestClient, tmp_path: Path, group: str, mod_name: str
) -> None:
    mods = [ModEntry(name=mod_name, source="local")]
    if group == "shared":
        presets_module._comparison = _make_comparison(shared=mods, unique={"A": [], "B": []})
    else:
        presets_module._comparison = _make_comparison(shared=[], unique={group: mods, "B": []})
    with respx.mock(assert_all_called=False) as router:
        _mock_caddy_ace(router)
        resp = caddy_client.post("/api/presets/fetch", json={})
        assert not router.calls
    assert resp.status_code == 400
    _assert_game_dir_untouched(tmp_path)


@pytest.mark.parametrize(
    ("group", "mod_name"),
    [("shared", "@ace/../../.."), ("../escaped", "@ace")],
)
def test_sync_missing_rejects_traversal(
    caddy_client: TestClient, tmp_path: Path, group: str, mod_name: str
) -> None:
    presets_module._missing_report = MissingReport(
        generated_at=datetime.now(tz=timezone.utc),
        total_mods=1,
        on_server=0,
        missing=1,
        missing_mods=[MissingMod(name=mod_name, group=group)],
    )
    with respx.mock(assert_all_called=False) as router:
        _mock_caddy_ace(router)
        resp = caddy_client.post("/api/presets/sync-missing")
        assert not router.calls
    assert resp.status_code == 400
    _assert_game_dir_untouched(tmp_path)
