from __future__ import annotations

import asyncio
import base64
import hmac
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api import _fail_counts, _fail_times, _LOCKOUT_SECONDS, _LOCKOUT_THRESHOLD
from app.core.config import get_settings

router = APIRouter()


def _check_ws_auth(websocket: WebSocket) -> bool:
    """Validate auth for WebSocket connections.

    Browsers cannot set custom headers on WebSocket upgrade requests,
    so we support two methods:
    1. Standard Authorization header (for programmatic clients)
    2. Base64 token in the ``token`` query parameter (for browser clients)
       e.g. ``ws://host/ws?token=base64(user:pass)``
    """
    settings = get_settings()
    cfg_user = settings.auth.username
    cfg_pass = settings.auth.password

    if not cfg_user and not cfg_pass:
        return True  # Auth disabled

    client_ip = websocket.client.host if websocket.client else "unknown"

    # Honour the same lockout as HTTP auth
    if _fail_counts[client_ip] >= _LOCKOUT_THRESHOLD:
        elapsed = time.monotonic() - _fail_times.get(client_ip, 0)
        if elapsed < _LOCKOUT_SECONDS:
            return False
        _fail_counts[client_ip] = 0

    # Try Authorization header first (programmatic clients)
    auth_header = websocket.headers.get("authorization", "")
    credentials = ""
    if auth_header.lower().startswith("basic "):
        credentials = auth_header[6:]
    else:
        # Fallback: token query parameter (browser WS clients)
        token = websocket.query_params.get("token", "")
        if token:
            credentials = token

    if not credentials:
        _fail_counts[client_ip] += 1
        _fail_times[client_ip] = time.monotonic()
        return False

    try:
        decoded = base64.b64decode(credentials).decode("utf-8")
        username, _, password = decoded.partition(":")
    except Exception:
        _fail_counts[client_ip] += 1
        _fail_times[client_ip] = time.monotonic()
        return False

    user_ok = hmac.compare_digest(username.encode(), cfg_user.encode())
    pass_ok = hmac.compare_digest(password.encode(), cfg_pass.encode())
    if user_ok and pass_ok:
        _fail_counts[client_ip] = 0
        return True
    _fail_counts[client_ip] += 1
    _fail_times[client_ip] = time.monotonic()
    return False


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    if not _check_ws_auth(websocket):
        await websocket.close(code=1008)  # 1008 = Policy Violation
        return

    await websocket.accept()

    app = websocket.app
    bus = app.state.bus

    q = bus.subscribe()
    try:
        # Push current state so the client starts fully hydrated
        await _send_initial_snapshot(websocket, app)

        # Stream bus events until the client disconnects
        while True:
            try:
                msg: dict[str, Any] = await asyncio.wait_for(q.get(), timeout=30.0)
                await websocket.send_json(msg)
            except (TimeoutError, asyncio.TimeoutError):
                # Keepalive ping — prevents proxy / load-balancer idle timeouts
                # Note: asyncio.TimeoutError != builtin TimeoutError in Python 3.9
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        bus.unsubscribe(q)


async def _send_initial_snapshot(websocket: WebSocket, app: Any) -> None:
    """Push the current state of every major resource so the client hydrates without polling."""
    from app.domain import missions as missions_domain
    from app.domain import mods as mods_domain
    from app.domain.settings import get_settings_schema

    settings = app.state.settings
    manager = app.state.manager

    # servers — include runtime fields (id, pid, state)
    servers_data = [s.to_json() for s in manager.servers]
    await websocket.send_json({"type": "servers", "serverId": None, "payload": servers_data})

    # mods
    try:
        mods_data = [m.model_dump() for m in mods_domain.list_mods(settings)]
    except Exception:
        mods_data = []
    await websocket.send_json({"type": "mods", "serverId": None, "payload": mods_data})

    # missions — use mode="json" so datetime fields become ISO strings, not Python objects
    try:
        missions_data = [m.model_dump(mode="json") for m in await missions_domain.list_missions(settings)]
    except Exception:
        missions_data = []
    await websocket.send_json({"type": "missions", "serverId": None, "payload": missions_data})

    # settings (public config subset)
    settings_data = get_settings_schema(settings).model_dump()
    await websocket.send_json({"type": "settings", "serverId": None, "payload": settings_data})
