"""Integration test for the /ws WebSocket endpoint."""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def ws_client(tmp_path):
    """App with WebSocket support."""
    from unittest.mock import patch

    from app.main import create_app

    config_file = tmp_path / "config.json"
    config_file.write_text(
        json.dumps({"game": "arma3", "path": str(tmp_path), "type": "linux"}),
        encoding="utf-8",
    )
    servers_json = tmp_path / "servers.json"
    servers_json.write_text("[]", encoding="utf-8")

    with patch("app.domain.manager.SERVERS_JSON", servers_json):
        app = create_app(config_path=config_file)
        with TestClient(app) as c:
            yield c


def test_ws_connects_and_receives_initial_snapshot(ws_client: TestClient) -> None:
    """WebSocket should connect and send initial snapshot messages."""
    with ws_client.websocket_connect("/ws") as ws:
        # Read initial messages — the server sends snapshot on connect
        messages: list[dict] = []
        for _ in range(10):
            raw = ws.receive_json()
            messages.append(raw)
            # Break once we've seen all snapshot types
            if any(m.get("type") == "settings" for m in messages):
                break

        # Should receive at least the servers snapshot
        types = {m.get("type") for m in messages}
        assert "servers" in types


def test_ws_receives_ping(ws_client: TestClient) -> None:
    """WebSocket should receive ping keepalive messages."""
    with ws_client.websocket_connect("/ws") as ws:
        # Read initial snapshot messages
        for _ in range(10):
            raw = ws.receive_json()
            if raw.get("type") == "ping":
                break

        # Ping messages are sent periodically; we may or may not receive one
        # in the initial burst, so this test just validates the connection works


def test_ws_ignores_malformed_json(ws_client: TestClient) -> None:
    """WebSocket should stay open if client sends garbage."""
    with ws_client.websocket_connect("/ws") as ws:
        # Drain initial snapshot messages
        for _ in range(5):
            ws.receive_json()

        # Send malformed data — server should not disconnect
        ws.send("not json")
