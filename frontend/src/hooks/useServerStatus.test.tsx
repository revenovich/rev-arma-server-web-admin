import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useServerStatus } from "@/hooks/useServerStatus";
import { reset } from "@/lib/ws";
import type { Server, ServerState } from "@/types/api";

// Mock WebSocket
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

  _open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  _receive(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

let mockSockets: MockWebSocket[] = [];
let queryClient: QueryClient;

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe("useServerStatus", () => {
  beforeEach(() => {
    mockSockets = [];
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

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
    vi.restoreAllMocks();
  });

  it("patches server list on 'servers' event", async () => {
    const servers: Server[] = [
      { id: "a", title: "Server A", port: 9520, state: { online: false }, pid: null } as Server,
    ];
    queryClient.setQueryData(["servers"], []);

    renderHook(() => useServerStatus(), { wrapper: createWrapper() });

    // Wait for useEffect to subscribe
    await waitFor(() => expect(mockSockets.length).toBe(1));

    const ws = mockSockets[0];
    ws._open();
    ws._receive({ type: "servers", serverId: null, payload: servers });

    expect(queryClient.getQueryData(["servers"])).toEqual(servers);
  });

  it("patches individual server on 'server' event", async () => {
    const original: Server[] = [
      { id: "a", title: "Old", port: 9520, state: { online: false }, pid: null } as Server,
    ];
    const updated: Server = { id: "a", title: "New", port: 9520, state: { online: true }, pid: 123 } as Server;
    queryClient.setQueryData(["servers"], original);

    renderHook(() => useServerStatus(), { wrapper: createWrapper() });

    await waitFor(() => expect(mockSockets.length).toBe(1));

    const ws = mockSockets[0];
    ws._open();
    ws._receive({ type: "server", serverId: "a", payload: updated });

    const cached = queryClient.getQueryData<Server[]>(["servers"]);
    expect(cached?.[0].title).toBe("New");
    expect(queryClient.getQueryData(["servers", "a"])).toEqual(updated);
  });

  it("patches server state on 'server_state' event", async () => {
    const original: Server[] = [
      { id: "a", title: "Server A", port: 9520, state: { online: false }, pid: null } as Server,
    ];
    const newState: ServerState = { online: true, players: 5, maxPlayers: 32 };
    queryClient.setQueryData(["servers"], original);

    renderHook(() => useServerStatus(), { wrapper: createWrapper() });

    await waitFor(() => expect(mockSockets.length).toBe(1));

    const ws = mockSockets[0];
    ws._open();
    ws._receive({ type: "server_state", serverId: "a", payload: newState });

    const cached = queryClient.getQueryData<Server[]>(["servers"]);
    expect(cached?.[0].state).toEqual(newState);
  });

  it("invalidates mods query on 'mods' event", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    renderHook(() => useServerStatus(), { wrapper: createWrapper() });

    await waitFor(() => expect(mockSockets.length).toBe(1));

    const ws = mockSockets[0];
    ws._open();
    ws._receive({ type: "mods", serverId: null, payload: null });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["mods"] });
  });

  it("unsubscribes on unmount", async () => {
    const { unmount } = renderHook(() => useServerStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(mockSockets.length).toBe(1));
    unmount();
  });
});