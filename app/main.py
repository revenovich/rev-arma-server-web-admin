from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import structlog
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import load_settings
from app.core.logging import AccessLogMiddleware, configure_logging

log = structlog.get_logger()

_FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"


def create_app(config_path: Path | None = None) -> FastAPI:
    settings = load_settings(config_path)
    configure_logging(settings.log_format)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        from app.domain.manager import Manager
        from app.services.pubsub import EventBus

        bus = EventBus()
        manager = Manager(settings, bus)

        app.state.settings = settings
        app.state.bus = bus
        app.state.manager = manager

        # Load persisted servers then start any marked auto-start
        manager.load()
        await manager.auto_start()

        log.info("startup complete", port=settings.port)
        yield

        # Graceful shutdown — stop running servers
        for server in manager.servers:
            if server.pid is not None:
                await server.stop()
        log.info("shutdown complete")

    app = FastAPI(
        title="Arma Server Web Admin",
        version="3.0.0",
        lifespan=lifespan,
        # Disable automatic /docs redirect so the SPA can own the root
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(AccessLogMiddleware)

    _register_routes(app)
    _mount_frontend(app)

    return app


def _register_routes(app: FastAPI) -> None:
    from app.api import logs, missions, mods, presets, servers, settings, steamcmd, ws

    app.include_router(servers.router)
    app.include_router(missions.router)
    app.include_router(mods.router)
    app.include_router(logs.router)
    app.include_router(settings.router)
    app.include_router(steamcmd.router)
    app.include_router(presets.router)
    app.include_router(ws.router)


def _mount_frontend(app: FastAPI) -> None:
    if _FRONTEND_DIST.is_dir():
        # Serve pre-built Vite bundle; SPA fallback is handled by the catch-all below
        app.mount(
            "/assets",
            StaticFiles(directory=_FRONTEND_DIST / "assets"),
            name="assets",
        )

        @app.get("/{full_path:path}", include_in_schema=False)
        async def spa_fallback(full_path: str) -> Any:
            index = _FRONTEND_DIST / "index.html"
            from fastapi.responses import HTMLResponse

            return HTMLResponse(index.read_text(encoding="utf-8"))
    else:
        # Frontend not built yet — return a 200 placeholder so health checks pass
        @app.get("/", include_in_schema=False)
        async def placeholder() -> JSONResponse:
            return JSONResponse(
                {"status": "ok", "message": "Frontend not built. Run: cd frontend && npm run build"}
            )


# Module-level app instance so `uvicorn app.main:app` works without --factory.
# For custom config paths, use `uvicorn app.main:create_app --factory`.
app = create_app()
