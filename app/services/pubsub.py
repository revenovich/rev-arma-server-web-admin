from __future__ import annotations

import asyncio
from typing import Any

_QUEUE_MAX = 64  # Drop oldest messages when a subscriber falls behind


class EventBus:
    """Async fan-out pub/sub — one asyncio.Queue per WebSocket connection."""

    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[dict[str, Any]]] = set()

    def subscribe(self) -> asyncio.Queue[dict[str, Any]]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=_QUEUE_MAX)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        self._subscribers.discard(q)

    async def publish(self, topic: str, payload: Any, server_id: str | None = None) -> None:
        msg = {"type": topic, "serverId": server_id, "payload": payload}
        for q in list(self._subscribers):
            if q.full():
                try:
                    q.get_nowait()  # Drop oldest — bounded back-pressure
                except asyncio.QueueEmpty:
                    pass
            await q.put(msg)
