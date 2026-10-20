from __future__ import annotations

import base64
import binascii
import hmac
import time
from collections import defaultdict
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.core.config import get_settings

# Simple in-process failed-attempt tracker to slow brute force.
# Resets on restart — sufficient for the admin-tool threat model.
_fail_counts: dict[str, int] = defaultdict(int)
_fail_times: dict[str, float] = {}
_LOCKOUT_THRESHOLD = 5
_LOCKOUT_SECONDS = 60.0


def _challenge_headers(request: Request) -> dict[str, str] | None:
    """`WWW-Authenticate: Basic` for 401s, except on the SPA's own fetches.

    Browsers answer the challenge with their native login dialog, which would hide
    the login form's error message. The SPA marks its requests with
    X-Requested-With; plain navigations such as download links still get it.
    """
    if request.headers.get("x-requested-with", "").lower() == "xmlhttprequest":
        return None
    return {"WWW-Authenticate": "Basic"}


def decode_basic(value: str) -> tuple[str, str] | None:
    """`user:pass` from a Basic token, read as UTF-8 (what browsers and curl send).

    FastAPI's HTTPBasic decodes ASCII only, so any non-ASCII password failed.
    Falls back to Latin-1 for old clients; None when the token is malformed.
    """
    try:
        raw = base64.b64decode(value.strip(), validate=True)
    except (binascii.Error, ValueError):
        return None
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    user, sep, password = text.partition(":")
    if not sep:
        return None
    return user, password


def _basic_credentials(request: Request) -> tuple[str, str] | None:
    scheme, _, value = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() != "basic":
        return None
    return decode_basic(value)


def require_auth(
    credentials: Annotated[tuple[str, str] | None, Depends(_basic_credentials)],
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
            headers=_challenge_headers(request),
        )

    username, password = credentials
    user_ok = hmac.compare_digest(username.encode(), cfg_user.encode())
    pass_ok = hmac.compare_digest(password.encode(), cfg_pass.encode())

    if not (user_ok and pass_ok):
        _fail_counts[client_ip] += 1
        _fail_times[client_ip] = time.monotonic()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers=_challenge_headers(request),
        )

    # Successful auth — reset failure counter
    _fail_counts[client_ip] = 0
