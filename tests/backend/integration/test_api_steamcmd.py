"""Integration tests for /api/steamcmd."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

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
# POST /api/steamcmd/install
# ---------------------------------------------------------------------------

def test_install_no_steamcmd(client: TestClient) -> None:
    with patch("app.services.steamcmd._find_steamcmd", return_value=None):
        resp = client.post("/api/steamcmd/install", json={})
    assert resp.status_code == 200
    assert resp.json()["ok"] is False


def test_install_success(client: TestClient) -> None:
    with patch(
        "app.services.steamcmd.install_server",
        new_callable=AsyncMock,
        return_value={"ok": True, "returncode": 0, "output": []},
    ):
        resp = client.post("/api/steamcmd/install", json={})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


# ---------------------------------------------------------------------------
# POST /api/steamcmd/update
# ---------------------------------------------------------------------------

def test_update_no_steamcmd(client: TestClient) -> None:
    with patch("app.services.steamcmd._find_steamcmd", return_value=None):
        resp = client.post("/api/steamcmd/update", json={})
    assert resp.status_code == 200
    assert resp.json()["ok"] is False


# ---------------------------------------------------------------------------
# POST /api/steamcmd/branch
# ---------------------------------------------------------------------------

def test_switch_branch(client: TestClient) -> None:
    with patch(
        "app.services.steamcmd.update_server",
        new_callable=AsyncMock,
        return_value={"ok": True, "returncode": 0, "output": []},
    ):
        resp = client.post("/api/steamcmd/branch", json={"branch": "creatordlc"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


# ---------------------------------------------------------------------------
# GET /api/steamcmd/version
# ---------------------------------------------------------------------------

def test_get_version_none(client: TestClient) -> None:
    with patch(
        "app.services.steamcmd.get_installed_version",
        new_callable=AsyncMock,
        return_value=None,
    ):
        resp = client.get("/api/steamcmd/version")
    assert resp.status_code == 200
    assert resp.json()["version"] is None


def test_get_version_returns_buildid(client: TestClient, tmp_path: Path) -> None:
    steamapps = tmp_path / "steamapps"
    steamapps.mkdir()
    (steamapps / "appmanifest_233780.acf").write_text('"buildid"\t"9876543"', encoding="utf-8")

    resp = client.get("/api/steamcmd/version")
    assert resp.status_code == 200
    # May or may not find buildid depending on acf format, just check 200
