import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { disconnect, subscribe, isConnected, reset } from "@/lib/ws";

// Mock WebSocket with manual lifecycle control
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

  _error() {
    this.onerror?.(new Event("error"));
  }
}

let mockSockets: MockWebSocket[] = [];

describe("ws.ts WebSocket client", () => {
  beforeEach(() => {
    mockSockets = [];
    vi.useFakeTimers();

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

  afterEach(() => {
    reset();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("connects on first subscriber", () => {
    subscribe(() => {});
    expect(mockSockets.length).toBe(1);
  });

  it("disconnects when last subscriber unsubscribes", () => {
    const unsub = subscribe(() => {});
    unsub();
    expect(isConnected()).toBe(false);
  });

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

  it("supports multiple subscribers", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const unsub1 = subscribe(handler1);
    subscribe(handler2);

    const ws = mockSockets[0];
    ws._open();
    ws._receive({ type: "server", serverId: "abc", payload: { id: "abc" } });

    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();

    unsub1();
  });

  it("reconnects on connection close", async () => {
    subscribe(() => {});

    const ws = mockSockets[0];
    ws._open();
    ws.close(); // Trigger onclose → scheduleReconnect

    // Advance past reconnect delay (base 1s + jitter)
    await vi.advanceTimersByTimeAsync(5000);

    expect(mockSockets.length).toBeGreaterThanOrEqual(2);
  });

  it("resets reconnect attempts on successful open", () => {
    subscribe(() => {});

    const ws = mockSockets[0];
    ws._open();

    expect(isConnected()).toBe(true);
  });

  it("does not reconnect after explicit disconnect", () => {
    subscribe(() => {});

    const ws = mockSockets[0];
    ws._open();

    disconnect();

    // Advance time — no reconnect should happen
    vi.advanceTimersByTime(30000);

    expect(mockSockets.length).toBe(1);
  });
});