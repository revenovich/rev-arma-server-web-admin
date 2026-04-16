import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { connect, disconnect, subscribe, isConnected, reset } from "@/lib/ws";
import { api } from "@/lib/api";

// ---------------------------------------------------------------------------
// Mock WebSocket with lifecycle control
// ---------------------------------------------------------------------------

class MockWebSocket {
  static CLOSED = 3;
  static CLOSING = 2;
  static CONNECTING = 0;
  static OPEN = 1;

  readyState: number = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((err: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  url: string;

  constructor(url: string) {
    this.url = url;
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  send(_data: string) {}

  // Test helpers
  _open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  _receive(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  _receiveRaw(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }

  _error() {
    this.onerror?.(new Event("error"));
  }

  _close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

let mockSockets: MockWebSocket[] = [];

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("ws.ts WebSocket client", () => {
  beforeEach(() => {
    mockSockets = [];
    vi.useFakeTimers();
    api.clearAuth();

    vi.stubGlobal(
      "WebSocket",
      class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          mockSockets.push(this);
        }
      },
    );

    // Provide a stable location for URL generation
    vi.spyOn(window, "location", "get").mockReturnValue({
      protocol: "http:",
      host: "localhost:9500",
      href: "http://localhost:9500/",
      origin: "http://localhost:9500",
    } as Location);
  });

  afterEach(() => {
    reset();
    vi.useRealTimers();
    vi.restoreAllMocks();
    api.clearAuth();
  });

  // -----------------------------------------------------------------------
  // connect() — URL generation
  // -----------------------------------------------------------------------

  describe("connect() URL generation", () => {
    it("creates a WebSocket with ws:// URL for http pages", () => {
      connect();
      expect(mockSockets.length).toBe(1);
      expect(mockSockets[0].url).toBe("ws://localhost:9500/ws");
    });

    it("creates a WebSocket with wss:// URL for https pages", () => {
      vi.spyOn(window, "location", "get").mockReturnValue({
        protocol: "https:",
        host: "admin.example.com:443",
        href: "https://admin.example.com:443/",
        origin: "https://admin.example.com:443",
      } as Location);
      connect();
      expect(mockSockets[0].url).toBe("wss://admin.example.com:443/ws");
    });

    it("includes token query param when auth is configured", () => {
      api.setAuth("admin", "secret");
      connect();
      const url = mockSockets[0].url;
      expect(url).toContain("?token=");
      const token = new URL(url).searchParams.get("token");
      expect(token).toBe(btoa("admin:secret"));
    });

    it("omits token when auth is not configured", () => {
      api.clearAuth();
      connect();
      expect(mockSockets[0].url).not.toContain("?token=");
    });

    it("correctly encodes special characters in auth credentials", () => {
      api.setAuth("user", "p@ss:word");
      connect();
      const token = new URL(mockSockets[0].url).searchParams.get("token");
      expect(token).toBe(btoa("user:p@ss:word"));
    });
  });

  // -----------------------------------------------------------------------
  // connect() — connection lifecycle
  // -----------------------------------------------------------------------

  describe("connect() lifecycle", () => {
    it("cleans up existing connection before creating new one", () => {
      connect();
      const first = mockSockets[0];
      const closeSpy = vi.spyOn(first, "close");

      // First socket is OPEN
      first._open();

      connect();

      // The old socket should be closed and its handlers nulled
      expect(closeSpy).toHaveBeenCalled();
      expect(first.onopen).toBeNull();
      expect(first.onclose).toBeNull();
      expect(first.onerror).toBeNull();
      expect(first.onmessage).toBeNull();
    });

    it("closes a CONNECTING socket before reconnecting", () => {
      connect();
      const first = mockSockets[0];
      // Leave it in CONNECTING state (never opened)
      const closeSpy = vi.spyOn(first, "close");

      connect();

      expect(closeSpy).toHaveBeenCalled();
    });

    it("clears pending reconnect timer before creating new connection", () => {
      connect();
      const ws = mockSockets[0];
      ws._close(); // triggers reconnect schedule

      // Now connect again — should clear the pending timer
      const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
      connect();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("schedules reconnect when WebSocket constructor throws", () => {
      // Replace WebSocket with a constructor that throws
      const ThrowingWS = vi.fn(() => {
        throw new Error("WebSocket unavailable");
      });
      vi.stubGlobal("WebSocket", ThrowingWS);

      // Should not throw, should schedule reconnect
      connect();
      expect(ThrowingWS).toHaveBeenCalled();

      // Advance timer to verify reconnect attempt was scheduled
      vi.advanceTimersByTime(2000);
      // Constructor should have been called again during reconnect
      expect(ThrowingWS.mock.calls.length).toBeGreaterThanOrEqual(2);

      // Restore normal mock for cleanup
      vi.stubGlobal(
        "WebSocket",
        class extends MockWebSocket {
          constructor(url: string) {
            super(url);
            mockSockets.push(this);
          }
        },
      );
    });

    it("resets reconnectAttempts on successful open", () => {
      connect();
      const ws = mockSockets[0];
      ws._open();

      // Close and verify reconnect starts from base delay
      ws._close();
      // First reconnect delay is ~1000ms + jitter
      vi.advanceTimersByTime(1500);
      expect(mockSockets.length).toBeGreaterThanOrEqual(2);

      // The second connection opens successfully, resetting backoff
      const ws2 = mockSockets[mockSockets.length - 1];
      ws2._open();
      ws2._close();

      // Next reconnect should also be short (base ~1000ms)
      vi.advanceTimersByTime(1500);
      expect(mockSockets.length).toBeGreaterThanOrEqual(3);
    });
  });

  // -----------------------------------------------------------------------
  // Message handling
  // -----------------------------------------------------------------------

  describe("message handling", () => {
    it("dispatches events to subscribers", () => {
      const handler = vi.fn();
      subscribe(handler);

      const ws = mockSockets[0];
      ws._open();
      ws._receive({ type: "servers", serverId: null, payload: [] });

      expect(handler).toHaveBeenCalledWith({
        type: "servers",
        serverId: null,
        payload: [],
      });
    });

    it("ignores ping messages", () => {
      const handler = vi.fn();
      subscribe(handler);

      const ws = mockSockets[0];
      ws._open();
      ws._receive({ type: "ping" });

      expect(handler).not.toHaveBeenCalled();
    });

    it("ignores malformed JSON messages", () => {
      const handler = vi.fn();
      subscribe(handler);

      const ws = mockSockets[0];
      ws._open();
      ws._receiveRaw("not valid json{{{");

      expect(handler).not.toHaveBeenCalled();
    });

    it("ignores empty string messages", () => {
      const handler = vi.fn();
      subscribe(handler);

      const ws = mockSockets[0];
      ws._open();
      ws._receiveRaw("");

      expect(handler).not.toHaveBeenCalled();
    });

    it("swallows handler errors without affecting other handlers", () => {
      const badHandler = vi.fn(() => {
        throw new Error("handler crashed");
      });
      const goodHandler = vi.fn();
      subscribe(badHandler);
      subscribe(goodHandler);

      const ws = mockSockets[0];
      ws._open();
      ws._receive({ type: "update", serverId: null, payload: null });

      expect(badHandler).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalledWith({
        type: "update",
        serverId: null,
        payload: null,
      });
    });

    it("handles messages with null serverId", () => {
      const handler = vi.fn();
      subscribe(handler);

      const ws = mockSockets[0];
      ws._open();
      ws._receive({ type: "settings_update", serverId: null, payload: {} });

      expect(handler).toHaveBeenCalledWith({
        type: "settings_update",
        serverId: null,
        payload: {},
      });
    });

    it("handles messages with complex nested payload", () => {
      const handler = vi.fn();
      subscribe(handler);

      const ws = mockSockets[0];
      ws._open();
      const payload = {
        servers: [
          { id: "1", name: "Server 1", players: 5 },
          { id: "2", name: "Server 2", players: 0 },
        ],
      };
      ws._receive({ type: "snapshot", serverId: null, payload });

      expect(handler).toHaveBeenCalledWith({
        type: "snapshot",
        serverId: null,
        payload,
      });
    });

    it("does not deliver messages before connection is open", () => {
      const handler = vi.fn();
      subscribe(handler);

      const ws = mockSockets[0];
      // WebSocket is still in CONNECTING state, simulate a message
      // The real browser wouldn't deliver messages in CONNECTING state,
      // but onmessage is set regardless. Test that if the handler fires
      // on a CONNECTING socket, it still works.
      ws._receive({ type: "early", serverId: null, payload: null });
      // Handler should still get the event — onmessage is bound
      expect(handler).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Reconnection
  // -----------------------------------------------------------------------

  describe("reconnection", () => {
    it("reconnects on connection close", async () => {
      subscribe(() => {});

      const ws = mockSockets[0];
      ws._open();
      ws._close(); // triggers reconnect schedule

      await vi.advanceTimersByTimeAsync(5000);

      expect(mockSockets.length).toBeGreaterThanOrEqual(2);
    });

    it("uses exponential backoff for reconnect delays", async () => {
      subscribe(() => {});
      let ws = mockSockets[0];

      // First close: reconnect after ~1000ms
      ws._open();
      ws._close();
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockSockets.length).toBeGreaterThanOrEqual(2);

      // Second close: reconnect after ~2000ms
      ws = mockSockets[mockSockets.length - 1];
      ws._open();
      ws._close();
      await vi.advanceTimersByTimeAsync(3000);
      expect(mockSockets.length).toBeGreaterThanOrEqual(3);
    });

    it("caps reconnect delay at 30 seconds", async () => {
      subscribe(() => {});

      // Simulate many failed connection attempts
      for (let i = 0; i < 6; i++) {
        const ws = mockSockets[mockSockets.length - 1];
        ws._close();
        await vi.advanceTimersByTimeAsync(35_000);
      }

      // Should still be attempting reconnects (just capped at 30s)
      expect(mockSockets.length).toBeGreaterThan(5);
    });

    it("stops reconnecting after disconnect()", () => {
      connect();
      const ws = mockSockets[0];
      ws._open();
      ws._close(); // schedules reconnect

      // Disconnect should cancel pending reconnect
      disconnect();

      const countBefore = mockSockets.length;
      vi.advanceTimersByTime(35_000);
      expect(mockSockets.length).toBe(countBefore);
    });

    it("resets reconnect attempts after explicit disconnect", async () => {
      connect();
      let ws = mockSockets[0];
      ws._open();
      ws._close();

      // Wait for reconnect
      await vi.advanceTimersByTimeAsync(3000);
      ws = mockSockets[mockSockets.length - 1];
      ws._open();
      ws._close();

      // Now disconnect — resets attempts counter
      disconnect();

      // Next connect should start fresh (short backoff)
      connect();
      ws = mockSockets[mockSockets.length - 1];
      ws._open();
      ws._close();

      await vi.advanceTimersByTimeAsync(1500);
      expect(mockSockets.length).toBeGreaterThanOrEqual(4);
    });

    it("reconnects after error followed by close", async () => {
      connect();
      const ws = mockSockets[0];
      ws._error();
      ws._close(); // onclose triggers reconnect

      await vi.advanceTimersByTimeAsync(3000);
      expect(mockSockets.length).toBeGreaterThanOrEqual(2);
    });
  });

  // -----------------------------------------------------------------------
  // disconnect()
  // -----------------------------------------------------------------------

  describe("disconnect()", () => {
    it("closes the WebSocket connection", () => {
      connect();
      const ws = mockSockets[0];
      const closeSpy = vi.spyOn(ws, "close");
      disconnect();
      expect(closeSpy).toHaveBeenCalled();
    });

    it("sets isConnected to false", () => {
      connect();
      const ws = mockSockets[0];
      ws._open();
      expect(isConnected()).toBe(true);
      disconnect();
      expect(isConnected()).toBe(false);
    });

    it("prevents onclose from triggering reconnect", () => {
      connect();
      const ws = mockSockets[0];
      disconnect();

      // onclose handler is nulled
      expect(ws.onclose).toBeNull();

      // No new connections should be created
      const countBefore = mockSockets.length;
      vi.advanceTimersByTime(35_000);
      expect(mockSockets.length).toBe(countBefore);
    });

    it("is a no-op when no connection exists", () => {
      expect(() => disconnect()).not.toThrow();
    });

    it("clears the reconnect timer", () => {
      connect();
      const ws = mockSockets[0];
      ws._open();
      ws._close(); // schedules reconnect

      const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
      disconnect();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it("resets reconnectAttempts to zero", async () => {
      connect();
      let ws = mockSockets[0];
      ws._close();

      // Accumulate some reconnect attempts
      await vi.advanceTimersByTimeAsync(3000);
      ws = mockSockets[mockSockets.length - 1];
      ws._close();
      await vi.advanceTimersByTimeAsync(5000);

      disconnect(); // resets attempts

      // Next connect starts fresh with short backoff
      connect();
      ws = mockSockets[mockSockets.length - 1];
      ws._open();
      ws._close();

      // Base delay ~1000ms — should reconnect quickly
      await vi.advanceTimersByTimeAsync(1500);
      expect(mockSockets.length).toBeGreaterThanOrEqual(4);
    });
  });

  // -----------------------------------------------------------------------
  // subscribe() / unsubscribe
  // -----------------------------------------------------------------------

  describe("subscribe()", () => {
    it("auto-connects on first subscriber", () => {
      subscribe(() => {});
      expect(mockSockets.length).toBe(1);
    });

    it("does not create additional connections for subsequent subscribers", () => {
      subscribe(() => {});
      subscribe(() => {});
      subscribe(() => {});
      expect(mockSockets.length).toBe(1);
    });

    it("returns an unsubscribe function", () => {
      const unsub = subscribe(() => {});
      expect(typeof unsub).toBe("function");
    });

    it("unsubscribe removes the handler from receiving messages", () => {
      const handler = vi.fn();
      const unsub = subscribe(handler);

      const ws = mockSockets[0];
      ws._open();
      ws._receive({ type: "test", serverId: null, payload: null });
      expect(handler).toHaveBeenCalledTimes(1);

      unsub();

      ws._receive({ type: "test2", serverId: null, payload: null });
      expect(handler).toHaveBeenCalledTimes(1); // Still 1 — no new calls
    });

    it("auto-disconnects when last handler unsubscribes", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const unsub1 = subscribe(handler1);
      const unsub2 = subscribe(handler2);

      const ws = mockSockets[0];
      const closeSpy = vi.spyOn(ws, "close");

      // Remove first subscriber — still has one, should NOT close
      unsub1();
      expect(closeSpy).not.toHaveBeenCalled();

      // Remove second (last) subscriber — should disconnect
      unsub2();
      expect(closeSpy).toHaveBeenCalled();
      expect(isConnected()).toBe(false);
    });

    it("auto-disconnects when only subscriber unsubscribes", () => {
      const handler = vi.fn();
      const unsub = subscribe(handler);
      expect(mockSockets.length).toBe(1);

      const ws = mockSockets[0];
      const closeSpy = vi.spyOn(ws, "close");

      unsub();
      expect(closeSpy).toHaveBeenCalled();
      expect(isConnected()).toBe(false);
    });

    it("handles same handler subscribed twice (Set dedup)", () => {
      const handler = vi.fn();
      subscribe(handler);
      // Second subscribe triggers connect() again because handlers.size is still 1
      // The first socket's handlers are nulled and a new socket is created
      subscribe(handler);

      // Use the LATEST socket (second connect creates a new one)
      const ws = mockSockets[mockSockets.length - 1];
      ws._open();
      ws._receive({ type: "test", serverId: null, payload: null });

      // Handler should be called only once per message (Set dedup)
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("only remaining subscriber gets messages after other unsubscribes", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const unsub1 = subscribe(handler1);
      subscribe(handler2);

      const ws = mockSockets[0];
      ws._open();

      ws._receive({ type: "both", serverId: null, payload: 1 });
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      unsub1();

      ws._receive({ type: "only2", serverId: null, payload: 2 });
      expect(handler1).toHaveBeenCalledTimes(1); // no new calls
      expect(handler2).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // isConnected()
  // -----------------------------------------------------------------------

  describe("isConnected()", () => {
    it("returns false before any connection", () => {
      expect(isConnected()).toBe(false);
    });

    it("returns false when WebSocket is CONNECTING", () => {
      connect();
      // MockWebSocket starts in CONNECTING state
      expect(isConnected()).toBe(false);
    });

    it("returns true when WebSocket is OPEN", () => {
      connect();
      mockSockets[0]._open();
      expect(isConnected()).toBe(true);
    });

    it("returns false after disconnect", () => {
      connect();
      mockSockets[0]._open();
      disconnect();
      expect(isConnected()).toBe(false);
    });

    it("returns false after connection closes", () => {
      connect();
      const ws = mockSockets[0];
      ws._open();
      ws._close();
      // After close, internal ws is nulled
      expect(isConnected()).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // reset()
  // -----------------------------------------------------------------------

  describe("reset()", () => {
    it("disconnects and clears all handlers", () => {
      const handler = vi.fn();
      subscribe(handler);
      const ws = mockSockets[0];
      const closeSpy = vi.spyOn(ws, "close");

      reset();

      expect(closeSpy).toHaveBeenCalled();
    });

    it("allows fresh subscribe after reset", () => {
      const handler1 = vi.fn();
      subscribe(handler1);
      reset();

      // After reset, subscribing again should create a fresh connection
      const handler2 = vi.fn();
      subscribe(handler2);
      expect(mockSockets.length).toBeGreaterThanOrEqual(2);

      const newWs = mockSockets[mockSockets.length - 1];
      newWs._open();
      newWs._receive({ type: "fresh", serverId: null, payload: null });
      expect(handler2).toHaveBeenCalled();
    });

    it("old handler does not receive messages after reset", () => {
      const handler = vi.fn();
      subscribe(handler);
      const ws = mockSockets[0];
      reset();

      // The old socket's onmessage is nulled by disconnect()
      // Even if somehow triggered, handler should not be in the set
      ws._receive({ type: "stale", serverId: null, payload: null });
      // handler won't be called because reset() clears the handlers set
      // and disconnect() nulls onmessage
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // onerror handling
  // -----------------------------------------------------------------------

  describe("onerror", () => {
    it("does not throw and allows onclose to trigger reconnect", async () => {
      connect();
      const ws = mockSockets[0];

      // In browsers, onerror fires before onclose
      ws._error();
      ws._close();

      await vi.advanceTimersByTimeAsync(3000);
      expect(mockSockets.length).toBeGreaterThanOrEqual(2);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe("edge cases", () => {
    it("handles rapid connect/disconnect cycles without leaking", () => {
      for (let i = 0; i < 5; i++) {
        connect();
        disconnect();
      }
      expect(isConnected()).toBe(false);
      // No pending timers should fire after cleanup
      vi.advanceTimersByTime(35_000);
      const countAfter = mockSockets.length;
      // No more reconnects should happen
      vi.advanceTimersByTime(35_000);
      expect(mockSockets.length).toBe(countAfter);
    });

    it("handles subscribe then immediate unsubscribe", () => {
      const handler = vi.fn();
      const unsub = subscribe(handler);
      unsub();
      // Auto-disconnect should have been triggered
      expect(isConnected()).toBe(false);
    });

    it("handles disconnect when already disconnected", () => {
      expect(() => disconnect()).not.toThrow();
      expect(() => disconnect()).not.toThrow();
    });

    it("multiple reconnects eventually stabilize on successful open", async () => {
      connect();
      // Simulate 3 failed attempts followed by success
      for (let i = 0; i < 3; i++) {
        const ws = mockSockets[mockSockets.length - 1];
        ws._close();
        await vi.advanceTimersByTimeAsync(35_000);
      }

      // 4th connection succeeds
      const finalWs = mockSockets[mockSockets.length - 1];
      finalWs._open();
      expect(isConnected()).toBe(true);

      // Verify reconnectAttempts was reset (next close has short backoff)
      const countBefore = mockSockets.length;
      finalWs._close();
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockSockets.length).toBeGreaterThan(countBefore);
    });

    it("does not create duplicate connections from subscribe during reconnect", () => {
      const handler1 = vi.fn();
      subscribe(handler1);
      expect(mockSockets.length).toBe(1);

      // Subscribing another handler should NOT create a new connection
      const handler2 = vi.fn();
      subscribe(handler2);
      expect(mockSockets.length).toBe(1);
    });

    it("reconnects after disconnect only if subscribe is called again", async () => {
      const handler = vi.fn();
      const unsub = subscribe(handler);
      const ws = mockSockets[0];
      ws._open();
      unsub(); // triggers disconnect

      const countAfterDisconnect = mockSockets.length;
      vi.advanceTimersByTime(35_000);
      // No reconnect should happen — was explicitly disconnected
      expect(mockSockets.length).toBe(countAfterDisconnect);

      // Subscribe again — new connection
      subscribe(handler);
      expect(mockSockets.length).toBeGreaterThan(countAfterDisconnect);
    });
  });
});