"""Integration tests for /api/logs."""
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


@pytest.fixture()
def client_with_log(tmp_path: Path) -> tuple[TestClient, Path]:
    from app.main import create_app

    config_file = tmp_path / "config.json"
    config_file.write_text(
        json.dumps({"game": "arma3", "path": str(tmp_path), "type": "linux"}),
        encoding="utf-8",
    )
    log_dir = tmp_path / "logs"
    log_dir.mkdir()
    log_file = log_dir / "arma3server_2024.rpt"
    log_file.write_text("server crashed\nrestarting", encoding="utf-8")

    app = create_app(config_path=config_file)
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c, tmp_path


# ---------------------------------------------------------------------------
# GET /api/logs/
# ---------------------------------------------------------------------------

def test_list_logs_empty(client: TestClient) -> None:
    resp = client.get("/api/logs/")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_logs_returns_entry(client_with_log: tuple) -> None:
    c, _ = client_with_log
    resp = c.get("/api/logs/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "arma3server_2024.rpt"
    assert data[0]["size"] > 0
    assert "formattedSize" in data[0]
    assert "path" in data[0]


# ---------------------------------------------------------------------------
# GET /api/logs/{filename}/view
# ---------------------------------------------------------------------------

def test_view_log_returns_text(client_with_log: tuple) -> None:
    c, _ = client_with_log
    resp = c.get("/api/logs/arma3server_2024.rpt/view")
    assert resp.status_code == 200
    assert "server crashed" in resp.text


def test_view_log_not_found(client: TestClient) -> None:
    resp = client.get("/api/logs/ghost.rpt/view")
    assert resp.status_code == 404


def test_view_log_invalid_mode(client_with_log: tuple) -> None:
    c, _ = client_with_log
    resp = c.get("/api/logs/arma3server_2024.rpt/invalid")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# GET /api/logs/{filename}/download
# ---------------------------------------------------------------------------

def test_download_log_returns_file(client_with_log: tuple) -> None:
    c, _ = client_with_log
    resp = c.get("/api/logs/arma3server_2024.rpt/download")
    assert resp.status_code == 200
    assert b"server crashed" in resp.content


def test_download_log_not_found(client: TestClient) -> None:
    resp = client.get("/api/logs/ghost.rpt/download")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/logs/{filename}
# ---------------------------------------------------------------------------

def test_delete_log_success(client_with_log: tuple) -> None:
    c, tmp_path = client_with_log
    resp = c.delete("/api/logs/arma3server_2024.rpt")
    assert resp.status_code == 200
    assert resp.json()["deleted"] == "arma3server_2024.rpt"
    assert not (tmp_path / "logs" / "arma3server_2024.rpt").exists()


def test_delete_log_not_found(client: TestClient) -> None:
    resp = client.delete("/api/logs/ghost.rpt")
    assert resp.status_code == 404


def test_view_log_oserror_returns_500(client_with_log: tuple) -> None:
    """If the log file can't be read (e.g., permissions), the handler returns 500."""
    from unittest.mock import patch, mock_open
    c, _ = client_with_log
    with patch("builtins.open", side_effect=OSError("permission denied")):
        resp = c.get("/api/logs/arma3server_2024.rpt/view")
    assert resp.status_code == 500
