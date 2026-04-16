"""Unit tests for app.api.ws._check_ws_auth()."""
from __future__ import annotations

import base64
import time
from unittest.mock import MagicMock

import pytest

import app.api as auth_module
from app.api.ws import _check_ws_auth


def _mock_ws(
    headers: dict[str, str] | None = None,
    query_params: dict[str, str] | None = None,
    client_host: str = "127.0.0.1",
) -> MagicMock:
    ws = MagicMock()
    ws.headers = headers or {}
    ws.query_params = query_params or {}
    ws.client = MagicMock()
    ws.client.host = client_host
    return ws


@pytest.fixture(autouse=True)
def _reset_lockout() -> None:
    auth_module._fail_counts.clear()
    auth_module._fail_times.clear()
    yield
    auth_module._fail_counts.clear()
    auth_module._fail_times.clear()


# ---------------------------------------------------------------------------
# Auth disabled — no credentials configured
# ---------------------------------------------------------------------------


def test_check_ws_auth_disabled(tmp_path) -> None:
    """When no credentials are configured, auth is always accepted."""
    import json

    from app.core.config import get_settings

    config_file = tmp_path / "config.json"
    config_file.write_text(
        json.dumps({"game": "arma3", "path": str(tmp_path), "type": "linux"}),
        encoding="utf-8",
    )
    # Patch get_settings to return config with no auth
    from unittest.mock import patch

    from app.core.config import Settings

    settings = Settings(game="arma3", path=str(tmp_path), type="linux")
    with patch("app.api.ws.get_settings", return_value=settings):
        ws = _mock_ws()
        assert _check_ws_auth(ws) is True


# ---------------------------------------------------------------------------
# Auth enabled — correct credentials via header
# ---------------------------------------------------------------------------


def test_check_ws_auth_correct_basic_header(tmp_path) -> None:
    """Correct Basic auth header should pass."""
    from unittest.mock import patch

    from app.core.config import Settings

    settings = Settings(
        game="arma3",
        path=str(tmp_path),
        type="linux",
        auth={"username": "admin", "password": "secret"},
    )
    with patch("app.api.ws.get_settings", return_value=settings):
        creds = base64.b64encode(b"admin:secret").decode()
        ws = _mock_ws(headers={"authorization": f"Basic {creds}"})
        assert _check_ws_auth(ws) is True


# ---------------------------------------------------------------------------
# Auth enabled — correct credentials via token query param
# ---------------------------------------------------------------------------


def test_check_ws_auth_correct_token_param(tmp_path) -> None:
    """Correct Base64 token in query param should pass."""
    from unittest.mock import patch

    from app.core.config import Settings

    settings = Settings(
        game="arma3",
        path=str(tmp_path),
        type="linux",
        auth={"username": "admin", "password": "secret"},
    )
    with patch("app.api.ws.get_settings", return_value=settings):
        token = base64.b64encode(b"admin:secret").decode()
        ws = _mock_ws(query_params={"token": token})
        assert _check_ws_auth(ws) is True


# ---------------------------------------------------------------------------
# Auth enabled — wrong credentials
# ---------------------------------------------------------------------------


def test_check_ws_auth_wrong_credentials(tmp_path) -> None:
    """Wrong credentials should be rejected."""
    from unittest.mock import patch

    from app.core.config import Settings

    settings = Settings(
        game="arma3",
        path=str(tmp_path),
        type="linux",
        auth={"username": "admin", "password": "secret"},
    )
    with patch("app.api.ws.get_settings", return_value=settings):
        creds = base64.b64encode(b"admin:wrong").decode()
        ws = _mock_ws(headers={"authorization": f"Basic {creds}"})
        assert _check_ws_auth(ws) is False


# ---------------------------------------------------------------------------
# Auth enabled — no credentials at all
# ---------------------------------------------------------------------------


def test_check_ws_auth_no_credentials(tmp_path) -> None:
    """No credentials should be rejected when auth is enabled."""
    from unittest.mock import patch

    from app.core.config import Settings

    settings = Settings(
        game="arma3",
        path=str(tmp_path),
        type="linux",
        auth={"username": "admin", "password": "secret"},
    )
    with patch("app.api.ws.get_settings", return_value=settings):
        ws = _mock_ws()
        assert _check_ws_auth(ws) is False


# ---------------------------------------------------------------------------
# Auth enabled — lockout after repeated failures
# ---------------------------------------------------------------------------


def test_check_ws_auth_lockout(tmp_path) -> None:
    """After 5 failures from the same IP, auth should be locked out."""
    from unittest.mock import patch

    from app.core.config import Settings

    settings = Settings(
        game="arma3",
        path=str(tmp_path),
        type="linux",
        auth={"username": "admin", "password": "secret"},
    )
    with patch("app.api.ws.get_settings", return_value=settings):
        bad_creds = base64.b64encode(b"admin:wrong").decode()
        # 5 failures
        for _ in range(5):
            ws = _mock_ws(headers={"authorization": f"Basic {bad_creds}"})
            _check_ws_auth(ws)
        # 6th should be locked out even with correct credentials
        good_creds = base64.b64encode(b"admin:secret").decode()
        ws = _mock_ws(headers={"authorization": f"Basic {good_creds}"})
        assert _check_ws_auth(ws) is False


# ---------------------------------------------------------------------------
# Auth enabled — invalid base64 token
# ---------------------------------------------------------------------------


def test_check_ws_auth_invalid_base64(tmp_path) -> None:
    """Malformed base64 token should be rejected."""
    from unittest.mock import patch

    from app.core.config import Settings

    settings = Settings(
        game="arma3",
        path=str(tmp_path),
        type="linux",
        auth={"username": "admin", "password": "secret"},
    )
    with patch("app.api.ws.get_settings", return_value=settings):
        ws = _mock_ws(query_params={"token": "not-valid-base64!!!"})
        assert _check_ws_auth(ws) is False


# ---------------------------------------------------------------------------
# Auth enabled — successful auth resets fail counter
# ---------------------------------------------------------------------------


def test_check_ws_auth_success_resets_counter(tmp_path) -> None:
    """A successful auth should reset the failure counter for that IP."""
    from unittest.mock import patch

    from app.core.config import Settings

    settings = Settings(
        game="arma3",
        path=str(tmp_path),
        type="linux",
        auth={"username": "admin", "password": "secret"},
    )
    with patch("app.api.ws.get_settings", return_value=settings):
        bad_creds = base64.b64encode(b"admin:wrong").decode()
        good_creds = base64.b64encode(b"admin:secret").decode()

        # 3 failures
        for _ in range(3):
            ws = _mock_ws(headers={"authorization": f"Basic {bad_creds}"})
            _check_ws_auth(ws)

        # Successful auth resets counter
        ws = _mock_ws(headers={"authorization": f"Basic {good_creds}"})
        assert _check_ws_auth(ws) is True

        # Should NOT be locked out — counter was reset
        ws = _mock_ws(headers={"authorization": f"Basic {bad_creds}"})
        assert _check_ws_auth(ws) is False  # rejected but not 429