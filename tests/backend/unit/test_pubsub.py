"""Unit tests for app.services.pubsub.EventBus."""
from __future__ import annotations

import asyncio

import pytest

from app.services.pubsub import EventBus, _QUEUE_MAX


@pytest.mark.asyncio
async def test_publish_delivers_to_subscriber() -> None:
    bus = EventBus()
    q = bus.subscribe()
    await bus.publish("servers", {"hello": "world"})
    msg = q.get_nowait()
    assert msg["type"] == "servers"
    assert msg["payload"] == {"hello": "world"}
    assert msg["serverId"] is None


@pytest.mark.asyncio
async def test_publish_with_server_id() -> None:
    bus = EventBus()
    q = bus.subscribe()
    await bus.publish("status", "online", server_id="abc-123")
    msg = q.get_nowait()
    assert msg["serverId"] == "abc-123"


@pytest.mark.asyncio
async def test_multiple_subscribers_all_receive() -> None:
    bus = EventBus()
    q1 = bus.subscribe()
    q2 = bus.subscribe()
    await bus.publish("test", "hello")
    assert not q1.empty()
    assert not q2.empty()


@pytest.mark.asyncio
async def test_unsubscribe_stops_delivery() -> None:
    bus = EventBus()
    q = bus.subscribe()
    bus.unsubscribe(q)
    await bus.publish("test", None)
    assert q.empty()


@pytest.mark.asyncio
async def test_unsubscribe_nonexistent_is_noop() -> None:
    bus = EventBus()
    q: asyncio.Queue = asyncio.Queue()
    bus.unsubscribe(q)  # Should not raise


@pytest.mark.asyncio
async def test_full_queue_drops_oldest() -> None:
    bus = EventBus()
    q = bus.subscribe()
    # Fill the queue to capacity
    for i in range(_QUEUE_MAX):
        await q.put({"type": "fill", "i": i})
    assert q.full()

    # Publishing to a full queue should drop oldest and add new
    await bus.publish("overflow", "new_msg")
    assert not q.empty()

    # Drain and check the last message is the new one
    items = []
    while not q.empty():
        items.append(q.get_nowait())
    assert items[-1]["type"] == "overflow"
    assert items[-1]["payload"] == "new_msg"


@pytest.mark.asyncio
async def test_no_subscribers_publish_is_noop() -> None:
    bus = EventBus()
    # Should not raise when no subscribers
    await bus.publish("nobody", "listening")
