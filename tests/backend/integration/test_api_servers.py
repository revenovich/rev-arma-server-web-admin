"""Integration tests for /api/servers — golden-file parity with Node.js responses."""
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_FIXTURE = [
    {
        "title": "Test Server",
        "port": 9520,
        "auto_start": False,
        "battle_eye": True,
        "max_players": 32,
        "mods": ["@CBA_A3"],
        "missions": [],
        "parameters": [],
    }
]


@pytest.fixture()
def client_with_servers(tmp_path):
    """App with a pre-populated servers.json."""
    import json as _json

    from app.main import create_app

    config_file = tmp_path / "config.json"
    config_file.write_text(
        _json.dumps({"game": "arma3", "path": str(tmp_path), "type": "linux"}),
        encoding="utf-8",
    )
    servers_json = tmp_path / "servers.json"
    servers_json.write_text(_json.dumps(_FIXTURE), encoding="utf-8")

    from unittest.mock import patch
    with patch("app.domain.manager.SERVERS_JSON", servers_json):
        app = create_app(config_path=config_file)
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c


def test_list_servers_returns_200(client_with_servers: TestClient) -> None:
    resp = client_with_servers.get("/api/servers/")
    assert resp.status_code == 200


def test_list_servers_returns_array(client_with_servers: TestClient) -> None:
    resp = client_with_servers.get("/api/servers/")
    data = resp.json()
    assert isinstance(data, list)


def test_list_servers_has_loaded_server(client_with_servers: TestClient) -> None:
    resp = client_with_servers.get("/api/servers/")
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Test Server"


def test_list_servers_includes_runtime_fields(client_with_servers: TestClient) -> None:
    """Response must include 'id' and 'pid' — runtime fields not in servers.json."""
    resp = client_with_servers.get("/api/servers/")
    data = resp.json()
    server = data[0]
    assert "id" in server
    assert "pid" in server


def test_get_server_by_id(client_with_servers: TestClient) -> None:
    servers = client_with_servers.get("/api/servers/").json()
    server_id = servers[0]["id"]
    resp = client_with_servers.get(f"/api/servers/{server_id}")
    assert resp.status_code == 200
    assert resp.json()["title"] == "Test Server"


def test_get_server_not_found(client_with_servers: TestClient) -> None:
    resp = client_with_servers.get("/api/servers/nonexistent-id")
    assert resp.status_code == 404


def test_create_server(tmp_path: Path) -> None:
    import json as _json
    from unittest.mock import patch

    from app.main import create_app

    config_file = tmp_path / "config.json"
    config_file.write_text(
        _json.dumps({"game": "arma3", "path": str(tmp_path), "type": "linux"}),
        encoding="utf-8",
    )
    servers_json = tmp_path / "servers.json"

    with patch("app.domain.manager.SERVERS_JSON", servers_json):
        app = create_app(config_path=config_file)
        with TestClient(app) as c:
            payload = {"title": "New Server", "port": 9540}
            resp = c.post("/api/servers/", json=payload)
            assert resp.status_code == 201
            data = resp.json()
            assert data["title"] == "New Server"
            assert "id" in data


def test_create_server_persists_to_disk(tmp_path: Path) -> None:
    import json as _json
    from unittest.mock import patch

    from app.main import create_app

    config_file = tmp_path / "config.json"
    config_file.write_text(
        _json.dumps({"game": "arma3", "path": str(tmp_path), "type": "linux"}),
        encoding="utf-8",
    )
    servers_json = tmp_path / "servers.json"

    with patch("app.domain.manager.SERVERS_JSON", servers_json):
        app = create_app(config_path=config_file)
        with TestClient(app) as c:
            c.post("/api/servers/", json={"title": "Persisted", "port": 9520})

        saved = _json.loads(servers_json.read_text())
        assert any(s["title"] == "Persisted" for s in saved)


def test_delete_server(tmp_path: Path) -> None:
    import json as _json
    from unittest.mock import patch

    from app.main import create_app

    config_file = tmp_path / "config.json"
    config_file.write_text(
        _json.dumps({"game": "arma3", "path": str(tmp_path), "type": "linux"}),
        encoding="utf-8",
    )
    servers_json = tmp_path / "servers.json"
    servers_json.write_text(_json.dumps(_FIXTURE), encoding="utf-8")

    with patch("app.domain.manager.SERVERS_JSON", servers_json):
        app = create_app(config_path=config_file)
        with TestClient(app) as c:
            server_id = c.get("/api/servers/").json()[0]["id"]
            resp = c.delete(f"/api/servers/{server_id}")
            assert resp.status_code == 200

            remaining = c.get("/api/servers/").json()
            assert remaining == []


def test_list_servers_empty_when_no_file(tmp_path: Path) -> None:
    import json as _json
    from unittest.mock import patch

    from app.main import create_app

    config_file = tmp_path / "config.json"
    config_file.write_text(
        _json.dumps({"game": "arma3", "path": str(tmp_path), "type": "linux"}),
        encoding="utf-8",
    )
    servers_json = tmp_path / "servers.json"  # does not exist

    with patch("app.domain.manager.SERVERS_JSON", servers_json):
        app = create_app(config_path=config_file)
        with TestClient(app) as c:
            resp = c.get("/api/servers/")
            assert resp.status_code == 200
            assert resp.json() == []
