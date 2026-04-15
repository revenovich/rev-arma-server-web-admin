"""Shared pytest fixtures."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def app(tmp_path):
    """Create a FastAPI app with a minimal config, scoped to a temp directory."""
    import json

    config_file = tmp_path / "config.json"
    config_file.write_text(
        json.dumps({"game": "arma3", "path": str(tmp_path), "type": "linux"}),
        encoding="utf-8",
    )
    return create_app(config_path=config_file)


@pytest.fixture()
def client(app):
    """HTTP test client — auth disabled (empty credentials in config)."""
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
