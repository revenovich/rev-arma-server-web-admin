import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useServerStatus } from "@/hooks/useServerStatus";
import { subscribe } from "@/lib/ws";
import type { Server, ServerState } from "@/types/api";
import type { ReactNode } from "react";

// ─── Mock the WebSocket client ─────────────────────────────────────────────

vi.mock("@/lib/ws", () => ({
  subscribe: vi.fn(),
}));

let queryClient: QueryClient;

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ─── Test data factories ────────────────────────────────────────────────────

function makeServer(overrides: Partial<Server> = {}): Server {
  return {
    id: "server-1",
    title: "Test Server",
    port: 2302,
    password: null,
    admin_password: null,
    allowed_file_patching: null,
    auto_start: false,
    battle_eye: false,
    file_patching: false,
    forcedDifficulty: null,
    max_players: 64,
    missions: [],
    mods: [],
    motd: null,
    number_of_headless_clients: 0,
    parameters: [],
    persistent: false,
    von: true,
    verify_signatures: 0,
    additionalConfigurationOptions: null,
    pid: null,
    state: null,
    ...overrides,
  };
}

function makeServerState(overrides: Partial<ServerState> = {}): ServerState {
  return {
    online: true,
    players: 5,
    maxPlayers: 64,
    mission: "co_10_escape.altis",
    map: "altis",
    ...overrides,
  };
}

/**
 * Capture the callback that useServerStatus passes to subscribe().
 * Returns a function that sends an event through that captured callback.
 */
function captureSubscribeCallback(): (event: unknown) => void {
  let callback: (event: unknown) => void = () => {};
  vi.mocked(subscribe).mockImplementation((cb: (event: unknown) => void) => {
    callback = cb;
    return vi.fn(); // return a mock unsubscribe function
  });
  return (event: unknown) => callback(event);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useServerStatus", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(subscribe).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Subscription lifecycle ──────────────────────────────────────────────

  it("subscribes to WebSocket events on mount", () => {
    renderHook(() => useServerStatus(), { wrapper: createWrapper() });

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(expect.any(Function));
  });

  it("unsubscribes on unmount by calling the returned unsubscribe function", () => {
    const mockUnsubscribe = vi.fn();
    vi.mocked(subscribe).mockReturnValue(mockUnsubscribe);

    const { unmount } = renderHook(() => useServerStatus(), {
      wrapper: createWrapper(),
    });

    expect(subscribe).toHaveBeenCalledTimes(1);

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("subscribes again if hook is remounted after unmount", () => {
    vi.mocked(subscribe).mockReturnValue(vi.fn());

    const { unmount } = renderHook(() => useServerStatus(), {
      wrapper: createWrapper(),
    });

    expect(subscribe).toHaveBeenCalledTimes(1);
    unmount();

    renderHook(() => useServerStatus(), { wrapper: createWrapper() });

    expect(subscribe).toHaveBeenCalledTimes(2);
  });

  // ── "servers" event: full server list replacement ─────────────────────────

  describe("servers event", () => {
    it("replaces the servers query cache with the full list", () => {
      const sendEvent = captureSubscribeCallback();
      const servers = [makeServer({ id: "s1" }), makeServer({ id: "s2" })];

      // Seed existing cache data to confirm it gets replaced
      queryClient.setQueryData(["servers"], [makeServer({ id: "old" })]);

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "servers", serverId: null, payload: servers });

      expect(queryClient.getQueryData(["servers"])).toEqual(servers);
    });

    it("sets servers query cache to empty array when payload is empty", () => {
      const sendEvent = captureSubscribeCallback();

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "servers", serverId: null, payload: [] });

      expect(queryClient.getQueryData(["servers"])).toEqual([]);
    });
  });

  // ── "server" event: single server patch ───────────────────────────────────

  describe("server event", () => {
    it("patches a single server in the list cache by id", () => {
      const sendEvent = captureSubscribeCallback();
      const original = makeServer({ id: "s1", title: "Original" });
      const updated = makeServer({ id: "s1", title: "Updated" });
      const other = makeServer({ id: "s2", title: "Other" });

      queryClient.setQueryData(["servers"], [original, other]);

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "server", serverId: null, payload: updated });

      const cached = queryClient.getQueryData<Server[]>(["servers"])!;
      expect(cached).toHaveLength(2);
      expect(cached.find((s) => s.id === "s1")!.title).toBe("Updated");
      expect(cached.find((s) => s.id === "s2")!.title).toBe("Other");
    });

    it("sets the individual server query cache for the updated server", () => {
      const sendEvent = captureSubscribeCallback();
      const updated = makeServer({ id: "s1", title: "Updated" });

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "server", serverId: null, payload: updated });

      expect(queryClient.getQueryData(["servers", "s1"])).toEqual(updated);
    });

    it("does not crash when the list cache is undefined", () => {
      const sendEvent = captureSubscribeCallback();
      const updated = makeServer({ id: "s1" });

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      // No prior cache data -- old is undefined
      sendEvent({ type: "server", serverId: null, payload: updated });

      // The list cache should remain undefined (not crash)
      expect(queryClient.getQueryData(["servers"])).toBeUndefined();
      // But the individual cache should still be set
      expect(queryClient.getQueryData(["servers", "s1"])).toEqual(updated);
    });
  });

  // ── "server_state" event: state + pid patching ────────────────────────────

  describe("server_state event", () => {
    it("patches server state into the list cache when server is online", () => {
      const sendEvent = captureSubscribeCallback();
      const server = makeServer({ id: "s1", pid: 1234, state: null });
      const state = makeServerState({ online: true, players: 10 });

      queryClient.setQueryData(["servers"], [server]);

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "server_state", serverId: "s1", payload: state });

      const cached = queryClient.getQueryData<Server[]>(["servers"])!;
      expect(cached[0].state).toEqual(state);
      // pid should remain 1234 since state.online is true
      expect(cached[0].pid).toBe(1234);
    });

    it("sets pid to null in list cache when server goes offline", () => {
      const sendEvent = captureSubscribeCallback();
      const server = makeServer({ id: "s1", pid: 1234, state: null });
      const offlineState = makeServerState({ online: false, players: 0 });

      queryClient.setQueryData(["servers"], [server]);

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "server_state", serverId: "s1", payload: offlineState });

      const cached = queryClient.getQueryData<Server[]>(["servers"])!;
      expect(cached[0].state).toEqual(offlineState);
      // pid should be null since state.online is false
      expect(cached[0].pid).toBeNull();
    });

    it("patches the individual server query cache with state", () => {
      const sendEvent = captureSubscribeCallback();
      const server = makeServer({ id: "s1", pid: 1234 });
      const state = makeServerState({ online: true });

      queryClient.setQueryData(["servers", "s1"], server);

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "server_state", serverId: "s1", payload: state });

      const cached = queryClient.getQueryData<Server>(["servers", "s1"])!;
      expect(cached.state).toEqual(state);
      expect(cached.pid).toBe(1234);
    });

    it("sets pid to null on individual server cache when offline", () => {
      const sendEvent = captureSubscribeCallback();
      const server = makeServer({ id: "s1", pid: 9999 });
      const offlineState = makeServerState({ online: false });

      queryClient.setQueryData(["servers", "s1"], server);

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "server_state", serverId: "s1", payload: offlineState });

      const cached = queryClient.getQueryData<Server>(["servers", "s1"])!;
      expect(cached.state).toEqual(offlineState);
      expect(cached.pid).toBeNull();
    });

    it("does nothing when serverId is null (early break)", () => {
      const sendEvent = captureSubscribeCallback();
      const server = makeServer({ id: "s1", pid: 1234 });
      const state = makeServerState({ online: true });

      queryClient.setQueryData(["servers"], [server]);

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "server_state", serverId: null, payload: state });

      // Cache should remain unchanged since serverId is null (early break)
      const cached = queryClient.getQueryData<Server[]>(["servers"])!;
      expect(cached[0].state).toBeNull();
      expect(cached[0].pid).toBe(1234);
    });

    it("does nothing when serverId is undefined", () => {
      const sendEvent = captureSubscribeCallback();
      const server = makeServer({ id: "s1", pid: 1234 });

      queryClient.setQueryData(["servers"], [server]);

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      // serverId is missing entirely (undefined)
      sendEvent({
        type: "server_state",
        serverId: undefined as unknown as string,
        payload: makeServerState(),
      });

      const cached = queryClient.getQueryData<Server[]>(["servers"])!;
      expect(cached[0].state).toBeNull();
    });

    it("does not crash when list cache is undefined", () => {
      const sendEvent = captureSubscribeCallback();

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "server_state", serverId: "s1", payload: makeServerState() });

      // Should not throw; cache remains undefined
      expect(queryClient.getQueryData(["servers"])).toBeUndefined();
    });

    it("does not crash when individual server cache is undefined", () => {
      const sendEvent = captureSubscribeCallback();

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "server_state", serverId: "s1", payload: makeServerState() });

      expect(queryClient.getQueryData(["servers", "s1"])).toBeUndefined();
    });

    it("does not modify other servers in the list", () => {
      const sendEvent = captureSubscribeCallback();
      const server1 = makeServer({ id: "s1", pid: 111 });
      const server2 = makeServer({ id: "s2", pid: 222 });
      const state = makeServerState({ online: true, players: 42 });

      queryClient.setQueryData(["servers"], [server1, server2]);

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "server_state", serverId: "s1", payload: state });

      const cached = queryClient.getQueryData<Server[]>(["servers"])!;
      expect(cached[0].state).toEqual(state);
      expect(cached[0].pid).toBe(111);
      // server2 should be untouched
      expect(cached[1].state).toBeNull();
      expect(cached[1].pid).toBe(222);
    });
  });

  // ── Invalidation events ──────────────────────────────────────────────────

  describe("mods event", () => {
    it("invalidates the mods query", () => {
      const sendEvent = captureSubscribeCallback();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "mods", serverId: null, payload: null });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["mods"] });
    });
  });

  describe("missions event", () => {
    it("invalidates the missions query", () => {
      const sendEvent = captureSubscribeCallback();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "missions", serverId: null, payload: null });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["missions"] });
    });
  });

  describe("logs event", () => {
    it("invalidates the logs query", () => {
      const sendEvent = captureSubscribeCallback();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "logs", serverId: null, payload: null });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["logs"] });
    });
  });

  describe("settings event", () => {
    it("invalidates the settings query", () => {
      const sendEvent = captureSubscribeCallback();
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "settings", serverId: null, payload: null });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["settings"] });
    });
  });

  // ── Unknown event types ──────────────────────────────────────────────────

  describe("unknown event type", () => {
    it("does not modify any cache for unrecognized event types", () => {
      const sendEvent = captureSubscribeCallback();
      const servers = [makeServer()];
      queryClient.setQueryData(["servers"], servers);

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      renderHook(() => useServerStatus(), { wrapper: createWrapper() });
      sendEvent({ type: "unknown_type", serverId: null, payload: {} });

      // Cache should be unchanged
      expect(queryClient.getQueryData(["servers"])).toEqual(servers);
      // No invalidation should have been called
      expect(invalidateSpy).not.toHaveBeenCalled();
    });
  });

  // ── Reactivity: queryClient change triggers re-subscription ──────────────

  describe("queryClient dependency", () => {
    it("re-subscribes when queryClient reference changes", () => {
      const firstUnsubscribe = vi.fn();
      vi.mocked(subscribe).mockReturnValue(firstUnsubscribe);

      // Use a mutable ref so the wrapper can read the current client
      let currentClient = queryClient;

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={currentClient}>{children}</QueryClientProvider>
      );

      const { rerender } = renderHook(() => useServerStatus(), {
        wrapper,
      });

      expect(subscribe).toHaveBeenCalledTimes(1);

      // Change the client reference
      const newClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      currentClient = newClient;

      // Force a re-render with the new client
      rerender();

      // Should have subscribed again due to the dependency change
      expect(subscribe).toHaveBeenCalledTimes(2);
      // The first subscription should have been unsubscribed
      expect(firstUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });
});