"""Integration tests for /api/presets — basic state-machine and error paths."""
from __future__ import annotations

import io
import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

import app.api.presets as presets_module


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
