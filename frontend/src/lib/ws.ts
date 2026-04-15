/**
 * WebSocket client for real-time updates from the FastAPI backend.
 *
 * Protocol:
 * - Connect to /ws
 * - Server sends initial snapshot messages (servers, mods, missions, settings)
 * - Server sends incremental updates via EventBus publish
 * - Server sends {"type": "ping"} every 30s; client should respond or treat as keepalive
 * - Client reconnects with exponential backoff + jitter on disconnect
 */

type WsEventHandler = (event: WsEvent) => void;

interface WsEvent {
  type: string;
  serverId: string | null;
  payload: unknown;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
const RECONNECT_JITTER_MS = 500;

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const handlers = new Set<WsEventHandler>();

function getWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

function scheduleReconnect() {
  const delay = Math.min(
    RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts) + Math.random() * RECONNECT_JITTER_MS,
    RECONNECT_MAX_MS,
  );
  reconnectAttempts++;
  reconnectTimer = setTimeout(connect, delay);
}

export function connect(): void {
  // Clean up existing connection
  if (ws) {
    ws.onopen = null;
    ws.onclose = null;
    ws.onerror = null;
    ws.onmessage = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
    ws = null;
  }

  // Clear any pending reconnect
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  try {
    ws = new WebSocket(getWsUrl());
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    reconnectAttempts = 0;
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const data: WsEvent = JSON.parse(event.data);
      // Ignore ping messages
      if (data.type === "ping") return;
      // Notify all handlers
      for (const handler of handlers) {
        try {
          handler(data);
        } catch {
          // Swallow handler errors
        }
      }
    } catch {
      // Ignore malformed messages
    }
  };

  ws.onclose = () => {
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = () => {
    // onclose will fire after this, triggering reconnect
  };
}

export function disconnect(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempts = 0;

  if (ws) {
    ws.onclose = null; // Prevent reconnect
    ws.close();
    ws = null;
  }
}

export function subscribe(handler: WsEventHandler): () => void {
  handlers.add(handler);

  // Auto-connect on first subscriber
  if (handlers.size === 1) {
    connect();
  }

  // Return unsubscribe function
  return () => {
    handlers.delete(handler);
    // Auto-disconnect when no subscribers
    if (handlers.size === 0) {
      disconnect();
    }
  };
}

export function isConnected(): boolean {
  return ws?.readyState === WebSocket.OPEN;
}

/** @internal Reset all state — for testing only. */
export function reset(): void {
  disconnect();
  handlers.clear();
}