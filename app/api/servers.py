from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.api import require_auth
from app.domain.manager import Manager

router = APIRouter(prefix="/api/servers", dependencies=[Depends(require_auth)])


def _get_manager(request: Request) -> Manager:
    return request.app.state.manager


def _get_server_or_404(server_id: str, manager: Manager) -> Any:
    server = manager.get(server_id)
    if server is None:
        raise HTTPException(status_code=404, detail="Server not found")
    return server


@router.get("/")
async def list_servers(manager: Annotated[Manager, Depends(_get_manager)]) -> list[dict[str, Any]]:
    return [s.to_json() for s in manager.servers]


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_server(
    body: dict[str, Any],
    manager: Annotated[Manager, Depends(_get_manager)],
) -> dict[str, Any]:
    if not body.get("title"):
        raise HTTPException(status_code=400, detail="Server title cannot be empty")
    server = manager.add(body)
    await manager.bus.publish("servers", None)
    return server.to_json()


@router.get("/{server_id}")
async def get_server(
    server_id: str,
    manager: Annotated[Manager, Depends(_get_manager)],
) -> dict[str, Any]:
    return _get_server_or_404(server_id, manager).to_json()


@router.put("/{server_id}")
async def update_server(
    server_id: str,
    body: dict[str, Any],
    manager: Annotated[Manager, Depends(_get_manager)],
) -> dict[str, Any]:
    if not body.get("title"):
        raise HTTPException(status_code=400, detail="Server title cannot be empty")
    server = manager.update(server_id, body)
    if server is None:
        raise HTTPException(status_code=404, detail="Server not found")
    await manager.bus.publish("servers", None)
    return server.to_json()


@router.delete("/{server_id}")
async def delete_server(
    server_id: str,
    manager: Annotated[Manager, Depends(_get_manager)],
) -> dict[str, Any]:
    server = manager.remove(server_id)
    if server is None:
        raise HTTPException(status_code=404, detail="Server not found")
    await manager.bus.publish("servers", None)
    return server.to_json()


@router.post("/{server_id}/start")
async def start_server(
    server_id: str,
    manager: Annotated[Manager, Depends(_get_manager)],
) -> dict[str, Any]:
    server = _get_server_or_404(server_id, manager)
    if server.pid is not None:
        return {"status": "already_running", "pid": server.pid}
    await server.start()
    return {"status": "ok", "pid": server.pid}


@router.post("/{server_id}/stop")
async def stop_server(
    server_id: str,
    manager: Annotated[Manager, Depends(_get_manager)],
) -> dict[str, Any]:
    server = _get_server_or_404(server_id, manager)
    if server.pid is None:
        return {"status": "already_stopped", "pid": None}
    await server.stop()
    return {"status": "ok", "pid": server.pid}


# --- Config sub-resource ---

@router.get("/{server_id}/config")
async def get_server_config(
    server_id: str,
    manager: Annotated[Manager, Depends(_get_manager)],
) -> dict[str, Any]:
    server = _get_server_or_404(server_id, manager)
    return server.to_persisted_dict()


@router.put("/{server_id}/config")
async def update_server_config(
    server_id: str,
    body: dict[str, Any],
    manager: Annotated[Manager, Depends(_get_manager)],
) -> dict[str, Any]:
    server = _get_server_or_404(server_id, manager)
    server.update(body)
    manager.save()
    if server.pid is not None:
        server._write_configs()
    await manager.bus.publish("servers", None)
    return server.to_json()


@router.get("/{server_id}/config/defaults")
async def get_server_config_defaults(
    server_id: str,
    manager: Annotated[Manager, Depends(_get_manager)],
) -> dict[str, Any]:
    from app.schemas.game_types import get_features
    server = _get_server_or_404(server_id, manager)
    return get_features(server.settings.game)
