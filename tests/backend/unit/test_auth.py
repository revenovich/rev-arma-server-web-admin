"""Unit tests for app.api authentication / lockout logic."""
from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient


def _make_client(tmp_path: Path, *, username: str = "", password: str = "") -> TestClient:
    from app.main import create_app

    config_file = tmp_path / "config.json"
    config_file.write_text(
        json.dumps({
            "game": "arma3",
            "path": str(tmp_path),
            "type": "linux",
            "auth": {"username": username, "password": password},
        }),
        encoding="utf-8",
    )
    app = create_app(config_path=config_file)
    return TestClient(app, raise_server_exceptions=True)


# ---------------------------------------------------------------------------
# Auth disabled (no credentials configured)
# ---------------------------------------------------------------------------

def test_no_auth_allows_access(tmp_path: Path) -> None:
    with _make_client(tmp_path) as c:
        resp = c.get("/api/logs/")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Auth enabled — correct credentials
# ---------------------------------------------------------------------------

def test_correct_credentials_allowed(tmp_path: Path) -> None:
    with _make_client(tmp_path, username="admin", password="secret") as c:
        resp = c.get("/api/logs/", auth=("admin", "secret"))
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Auth enabled — wrong credentials
# ---------------------------------------------------------------------------

def test_wrong_credentials_rejected(tmp_path: Path) -> None:
    with _make_client(tmp_path, username="admin", password="secret") as c:
        resp = c.get("/api/logs/", auth=("admin", "wrong"))
    assert resp.status_code == 401


def test_no_credentials_rejected_when_auth_enabled(tmp_path: Path) -> None:
    with _make_client(tmp_path, username="admin", password="secret") as c:
        resp = c.get("/api/logs/")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Basic challenge: browsers answer `WWW-Authenticate: Basic` with their own
# login dialog, which hides the SPA's "Invalid username or password" error.
# The SPA marks its requests with X-Requested-With (frontend/src/lib/api.ts).
# ---------------------------------------------------------------------------

def test_spa_request_with_wrong_credentials_gets_no_basic_challenge(tmp_path: Path) -> None:
    import app.api as auth_module

    auth_module._fail_counts.clear()
    auth_module._fail_times.clear()
    with _make_client(tmp_path, username="admin", password="secret") as c:
        wrong = c.get("/api/servers/", auth=("admin", "wrong"), headers={"X-Requested-With": "XMLHttpRequest"})
        missing = c.get("/api/servers/", headers={"X-Requested-With": "XMLHttpRequest"})
    auth_module._fail_counts.clear()
    auth_module._fail_times.clear()

    assert wrong.status_code == 401
    assert "www-authenticate" not in wrong.headers
    assert missing.status_code == 401
    assert "www-authenticate" not in missing.headers


def test_plain_browser_request_still_gets_basic_challenge(tmp_path: Path) -> None:
    """Download links are plain navigations; the challenge lets the browser prompt for them."""
    with _make_client(tmp_path, username="admin", password="secret") as c:
        resp = c.get("/api/logs/x.rpt/download")
    assert resp.status_code == 401
    assert resp.headers["www-authenticate"] == "Basic"


# ---------------------------------------------------------------------------
# IP lockout after repeated failures
# ---------------------------------------------------------------------------

def test_lockout_after_repeated_failures(tmp_path: Path) -> None:
    """After 5 consecutive failures from the same IP, the 6th should be 429."""
    import app.api as auth_module

    # Reset lockout state for clean test
    auth_module._fail_counts.clear()
    auth_module._fail_times.clear()

    with _make_client(tmp_path, username="admin", password="secret") as c:
        for _ in range(5):
            c.get("/api/logs/", auth=("admin", "bad"))
        resp = c.get("/api/logs/", auth=("admin", "bad"))

    assert resp.status_code == 429

    # Cleanup lockout state so subsequent tests aren't affected
    auth_module._fail_counts.clear()
    auth_module._fail_times.clear()


def test_successful_auth_resets_fail_counter(tmp_path: Path) -> None:
    """A successful auth should clear the failure counter."""
    import app.api as auth_module

    auth_module._fail_counts.clear()
    auth_module._fail_times.clear()

    with _make_client(tmp_path, username="admin", password="secret") as c:
        for _ in range(3):
            c.get("/api/logs/", auth=("admin", "bad"))
        # Correct credentials reset counter
        resp = c.get("/api/logs/", auth=("admin", "secret"))
        assert resp.status_code == 200
        # Should not be locked out now
        resp = c.get("/api/logs/", auth=("admin", "bad"))
        assert resp.status_code == 401  # not 429

    auth_module._fail_counts.clear()
    auth_module._fail_times.clear()


# ---------------------------------------------------------------------------
# GET /api/auth endpoint — auth_required probe
# ---------------------------------------------------------------------------


def test_auth_endpoint_returns_false_when_no_credentials(tmp_path: Path) -> None:
    """GET /api/auth should return {auth_required: false} when no credentials configured."""
    with _make_client(tmp_path) as c:
        resp = c.get("/api/auth")
    assert resp.status_code == 200
    assert resp.json() == {"auth_required": False}


def test_auth_endpoint_returns_true_when_credentials_configured(tmp_path: Path) -> None:
    """GET /api/auth should return {auth_required: true} when credentials are set."""
    with _make_client(tmp_path, username="admin", password="secret") as c:
        resp = c.get("/api/auth")
    assert resp.status_code == 200
    assert resp.json() == {"auth_required": True}
