from __future__ import annotations

import hmac
import time
from collections import defaultdict
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from app.core.config import get_settings

_security = HTTPBasic(auto_error=False)

# Simple in-process failed-attempt tracker to slow brute force.
# Resets on restart — sufficient for the admin-tool threat model.
_fail_counts: dict[str, int] = defaultdict(int)
_fail_times: dict[str, float] = {}
_LOCKOUT_THRESHOLD = 5
_LOCKOUT_SECONDS = 60.0


def require_auth(
    credentials: Annotated[HTTPBasicCredentials | None, Depends(_security)],
    request: Request,
) -> None:
    """Enforce HTTP Basic Auth if configured; allow through if auth fields are empty."""
    settings = get_settings()
    cfg_user = settings.auth.username
    cfg_pass = settings.auth.password

    if not cfg_user and not cfg_pass:
        return  # Auth disabled

    # IP-based lockout after repeated failures
    client_ip = request.client.host if request and request.client else "unknown"
    if _fail_counts[client_ip] >= _LOCKOUT_THRESHOLD:
        elapsed = time.monotonic() - _fail_times.get(client_ip, 0)
        if elapsed < _LOCKOUT_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed attempts — try again later",
            )
        # Lockout expired — reset
        _fail_counts[client_ip] = 0

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Basic"},
        )

    user_ok = hmac.compare_digest(credentials.username.encode(), cfg_user.encode())
    pass_ok = hmac.compare_digest(credentials.password.encode(), cfg_pass.encode())

    if not (user_ok and pass_ok):
        _fail_counts[client_ip] += 1
        _fail_times[client_ip] = time.monotonic()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Basic"},
        )

    # Successful auth — reset failure counter
    _fail_counts[client_ip] = 0
