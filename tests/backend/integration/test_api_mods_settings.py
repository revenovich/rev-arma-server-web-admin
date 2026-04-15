"""Integration tests for /api/mods and /api/settings."""
from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


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
# GET /api/mods/
# ---------------------------------------------------------------------------

def test_list_mods_empty(client: TestClient) -> None:
    resp = client.get("/api/mods/")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_mods_with_mod(client: TestClient, tmp_path: Path) -> None:
    # Create a mod folder with addons dir
    mod_dir = tmp_path / "@CBA_A3" / "addons"
    mod_dir.mkdir(parents=True)
    (mod_dir / "cba.pbo").write_bytes(b"pbo")

    resp = client.get("/api/mods/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "@CBA_A3"


# ---------------------------------------------------------------------------
# GET /api/settings/
# ---------------------------------------------------------------------------

def test_get_settings_returns_schema(client: TestClient) -> None:
    resp = client.get("/api/settings/")
    assert resp.status_code == 200
    data = resp.json()
    # SettingsSchema has these fields
    assert "game" in data
    assert "path" in data
