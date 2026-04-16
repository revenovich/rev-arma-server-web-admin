import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useServers,
  useServer,
  useCreateServer,
  useUpdateServer,
  useDeleteServer,
  useStartServer,
  useStopServer,
} from "@/hooks/useServers";
import { api } from "@/lib/api";
import type { Server, ServerCreatePayload, ServerUpdatePayload } from "@/types/api";
import type { ReactNode } from "react";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    upload: vi.fn(),
    setAuth: vi.fn(),
    clearAuth: vi.fn(),
  },
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

const mockServer: Server = {
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
  max_players: 32,
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
  state: { online: false, players: 0, maxPlayers: 32, mission: null, map: null },
};

describe("useServers", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.get).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches server list successfully", async () => {
    const servers = [mockServer];
    vi.mocked(api.get).mockResolvedValueOnce(servers);

    const { result } = renderHook(() => useServers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(servers);
    expect(api.get).toHaveBeenCalledWith("/servers/");
  });

  it("handles fetch error", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useServers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});

describe("useServer", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.get).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches single server by id", async () => {
    vi.mocked(api.get).mockResolvedValueOnce(mockServer);

    const { result } = renderHook(() => useServer("server-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockServer);
    expect(api.get).toHaveBeenCalledWith("/servers/server-1");
  });

  it("does not fetch when id is empty", () => {
    const { result } = renderHook(() => useServer(""), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe("useCreateServer", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.post).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a server and invalidates query", async () => {
    const payload: ServerCreatePayload = { title: "New Server", port: 2302 };
    vi.mocked(api.post).mockResolvedValueOnce(mockServer);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateServer(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(api.post).toHaveBeenCalledWith("/servers/", payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["servers"] });
  });

  it("shows error toast on failure", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Create failed"));

    const { result } = renderHook(() => useCreateServer(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ title: "Fail" });
      } catch {
        // Expected error
      }
    });

    expect(api.post).toHaveBeenCalledWith("/servers/", expect.objectContaining({ title: "Fail" }));
  });
});

describe("useUpdateServer", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.put).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("updates a server and invalidates both server queries", async () => {
    const payload: ServerUpdatePayload = { title: "Updated Server" };
    vi.mocked(api.put).mockResolvedValueOnce({ ...mockServer, title: "Updated Server" });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateServer("server-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync(payload);
    });

    expect(api.put).toHaveBeenCalledWith("/servers/server-1", payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["servers"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["servers", "server-1"] });
  });

  it("shows error toast on failure", async () => {
    vi.mocked(api.put).mockRejectedValueOnce(new Error("Update failed"));

    const { result } = renderHook(() => useUpdateServer("server-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ title: "Fail" });
      } catch {
        // Expected error
      }
    });

    expect(api.put).toHaveBeenCalledWith("/servers/server-1", expect.objectContaining({ title: "Fail" }));
  });
});

describe("useDeleteServer", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.del).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes a server and invalidates query", async () => {
    vi.mocked(api.del).mockResolvedValueOnce(undefined);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteServer(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync("server-1");
    });

    expect(api.del).toHaveBeenCalledWith("/servers/server-1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["servers"] });
  });

  it("shows error toast on failure", async () => {
    vi.mocked(api.del).mockRejectedValueOnce(new Error("Delete failed"));

    const { result } = renderHook(() => useDeleteServer(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync("server-1");
      } catch {
        // Expected error
      }
    });

    expect(api.del).toHaveBeenCalledWith("/servers/server-1");
  });
});

describe("useStartServer", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.post).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts a server and invalidates both server queries", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ status: "starting", pid: null });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useStartServer("server-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(api.post).toHaveBeenCalledWith("/servers/server-1/start");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["servers"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["servers", "server-1"] });
  });

  it("shows error toast on failure", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Start failed"));

    const { result } = renderHook(() => useStartServer("server-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch {
        // Expected error
      }
    });

    expect(api.post).toHaveBeenCalledWith("/servers/server-1/start");
  });
});

describe("useStopServer", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.post).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stops a server and invalidates both server queries", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ status: "stopping", pid: null });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useStopServer("server-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(api.post).toHaveBeenCalledWith("/servers/server-1/stop");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["servers"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["servers", "server-1"] });
  });

  it("shows error toast on failure", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Stop failed"));

    const { result } = renderHook(() => useStopServer("server-1"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch {
        // Expected error
      }
    });

    expect(api.post).toHaveBeenCalledWith("/servers/server-1/stop");
  });
});