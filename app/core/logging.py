from __future__ import annotations

import logging
import sys
import time
from collections.abc import Awaitable, Callable

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


def configure_logging(log_format: str = "dev") -> None:
    processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        # Note: add_logger_name only works with stdlib LoggerFactory (not PrintLoggerFactory)
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.ExceptionRenderer(),
    ]

    renderer: structlog.types.Processor
    if log_format == "dev":
        renderer = structlog.dev.ConsoleRenderer()
    else:
        renderer = structlog.processors.JSONRenderer()

    structlog.configure(
        processors=processors + [renderer],
        wrapper_class=structlog.make_filtering_bound_logger(logging.DEBUG),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(sys.stdout),
        cache_logger_on_first_use=True,
    )


class AccessLogMiddleware(BaseHTTPMiddleware):
    """Log every HTTP request — parity with morgan :method :url :status :response-time ms."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        ms = round((time.perf_counter() - start) * 1000, 1)

        auth_header = request.headers.get("authorization", "")
        user = ":basic-auth:" if auth_header.startswith("Basic ") else "anonymous"

        structlog.get_logger().info(
            "http",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            ms=ms,
            user=user,
        )
        return response
