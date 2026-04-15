"""Additional integration tests for /api/servers — update, config, start/stop."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch, AsyncMock

import pytest
from fastapi.testclient import TestClient

_FIXTURE = [
    {
        "title": "Test Server",
        "port": 2302,
        "auto_start": False,
        "battle_eye": True,
        "max_players": 32,
        "mods": [],
        "missions": [],
        "parameters": [],
    }
]


@pytest.fixture()
def client_with_server(tmp_path: Path) -> tuple[TestClient, str]:
    """App with one pre-populated server; yields (client, server_id)."""
    from app.main import create_app

    config_file = tmp_path / "config.json"
    config_file.write_text(
        json.dumps({"game": "arma3", "path": str(tmp_path), "type": "linux"}),
        encoding="utf-8",
    )
    servers_json = tmp_path / "servers.json"
    servers_json.write_text(json.dumps(_FIXTURE), encoding="utf-8")

    with patch("app.domain.manager.SERVERS_JSON", servers_json):
        app = create_app(config_path=config_file)
        with TestClient(app, raise_server_exceptions=True) as c:
            servers = c.get("/api/servers/").json()
            yield c, servers[0]["id"]


# ---------------------------------------------------------------------------
# PUT /api/servers/{id} — update
# ---------------------------------------------------------------------------

def test_update_server_changes_title(client_with_server: tuple) -> None:
    c, sid = client_with_server
    resp = c.put(f"/api/servers/{sid}", json={"title": "Renamed", "port": 2302})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Renamed"


def test_update_server_empty_title_rejected(client_with_server: tuple) -> None:
    c, sid = client_with_server
    resp = c.put(f"/api/servers/{sid}", json={"title": ""})
    assert resp.status_code == 400


def test_update_server_not_found(client_with_server: tuple) -> None:
    c, _ = client_with_server
    resp = c.put("/api/servers/ghost-id", json={"title": "Nope"})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/servers/{id}
# ---------------------------------------------------------------------------

def test_delete_server_not_found(client_with_server: tuple) -> None:
    c, _ = client_with_server
    resp = c.delete("/api/servers/ghost-id")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/servers/{id}/start — server not running
# ---------------------------------------------------------------------------

def test_start_server_not_running(client_with_server: tuple) -> None:
    c, sid = client_with_server
    # pid is None → attempt to start. Patch start() to avoid spawning a real process.
    with patch("app.domain.server.Server.start", new_callable=AsyncMock):
        resp = c.post(f"/api/servers/{sid}/start")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /api/servers/{id}/stop — server not running
# ---------------------------------------------------------------------------

def test_stop_server_not_running(client_with_server: tuple) -> None:
    c, sid = client_with_server
    # pid is None → already_stopped
    resp = c.post(f"/api/servers/{sid}/stop")
    assert resp.status_code == 200
    assert resp.json()["status"] == "already_stopped"


def test_start_stop_server_not_found(client_with_server: tuple) -> None:
    c, _ = client_with_server
    resp = c.post("/api/servers/ghost-id/start")
    assert resp.status_code == 404
    resp = c.post("/api/servers/ghost-id/stop")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/servers/{id}/config
# ---------------------------------------------------------------------------

def test_get_server_config(client_with_server: tuple) -> None:
    c, sid = client_with_server
    resp = c.get(f"/api/servers/{sid}/config")
    assert resp.status_code == 200
    data = resp.json()
    assert "title" in data


def test_get_server_config_not_found(client_with_server: tuple) -> None:
    c, _ = client_with_server
    resp = c.get("/api/servers/ghost-id/config")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/servers/{id}/config/defaults
# ---------------------------------------------------------------------------

def test_get_server_config_defaults(client_with_server: tuple) -> None:
    c, sid = client_with_server
    resp = c.get(f"/api/servers/{sid}/config/defaults")
    assert resp.status_code == 200
    data = resp.json()
    assert "steamcmd_app_id" in data


# ---------------------------------------------------------------------------
# PUT /api/servers/{id}/config
# ---------------------------------------------------------------------------

def test_update_server_config(client_with_server: tuple) -> None:
    c, sid = client_with_server
    resp = c.put(f"/api/servers/{sid}/config", json={"title": "Updated Title", "max_players": 64})
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Updated Title"


def test_update_server_config_not_found(client_with_server: tuple) -> None:
    c, _ = client_with_server
    resp = c.put("/api/servers/ghost-id/config", json={"title": "Nope"})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/servers/ — missing title
# ---------------------------------------------------------------------------

def test_create_server_missing_title_rejected(tmp_path: Path) -> None:
    from app.main import create_app

    config_file = tmp_path / "config.json"
    config_file.write_text(
        json.dumps({"game": "arma3", "path": str(tmp_path), "type": "linux"}),
        encoding="utf-8",
    )
    servers_json = tmp_path / "servers.json"

    with patch("app.domain.manager.SERVERS_JSON", servers_json):
        app = create_app(config_path=config_file)
        with TestClient(app, raise_server_exceptions=True) as c:
            resp = c.post("/api/servers/", json={"port": 2302})
    assert resp.status_code == 400
