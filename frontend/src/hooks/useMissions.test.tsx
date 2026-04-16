import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useMissions,
  useDeleteMission,
  useRefreshMissions,
  useWorkshopDownload,
  useUploadMissions,
} from "@/hooks/useMissions";
import { api } from "@/lib/api";
import type { Mission } from "@/types/api";
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

const mockMission: Mission = {
  name: "co_10_escape.altis.pbo",
  missionName: "co_10_escape",
  worldName: "altis",
  size: 1024,
  sizeFormatted: "1 KB",
  dateCreated: "2025-01-01",
  dateModified: "2025-01-02",
};

describe("useMissions", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.get).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches missions successfully", async () => {
    const missions = [mockMission];
    vi.mocked(api.get).mockResolvedValueOnce(missions);

    const { result } = renderHook(() => useMissions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(missions);
    expect(api.get).toHaveBeenCalledWith("/missions/");
  });

  it("handles fetch error", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useMissions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});

describe("useDeleteMission", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.del).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes a mission and invalidates queries", async () => {
    vi.mocked(api.del).mockResolvedValueOnce(undefined);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeleteMission(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync("co_10_escape.altis.pbo");
    });

    expect(api.del).toHaveBeenCalledWith("/missions/co_10_escape.altis.pbo");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["missions"] });
  });

  it("calls API and handles error on failure", async () => {
    vi.mocked(api.del).mockRejectedValueOnce(new Error("Delete failed"));

    const { result } = renderHook(() => useDeleteMission(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync("fail.pbo");
      } catch {
        // Expected error
      }
    });

    expect(api.del).toHaveBeenCalledWith("/missions/fail.pbo");
  });
});

describe("useRefreshMissions", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.post).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes missions and updates cache", async () => {
    const refreshed: Mission[] = [
      { ...mockMission, name: "new_mission.altis.pbo", missionName: "new_mission" },
    ];
    vi.mocked(api.post).mockResolvedValueOnce(refreshed);

    const { result } = renderHook(() => useRefreshMissions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(api.post).toHaveBeenCalledWith("/missions/refresh");
    expect(queryClient.getQueryData(["missions"])).toEqual(refreshed);
  });

  it("calls API and handles error on failure", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Refresh failed"));

    const { result } = renderHook(() => useRefreshMissions(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync();
      } catch {
        // Expected error
      }
    });

    expect(api.post).toHaveBeenCalledWith("/missions/refresh");
  });
});

describe("useWorkshopDownload", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.post).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts workshop download and invalidates missions", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ ok: true, id: "12345" });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useWorkshopDownload(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync("12345");
    });

    expect(api.post).toHaveBeenCalledWith("/missions/workshop/", { id: "12345" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["missions"] });
  });

  it("calls API and handles error on failure", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Download failed"));

    const { result } = renderHook(() => useWorkshopDownload(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync("99999");
      } catch {
        // Expected error
      }
    });

    expect(api.post).toHaveBeenCalledWith("/missions/workshop/", { id: "99999" });
  });
});

describe("useUploadMissions", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.upload).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads mission files and invalidates queries", async () => {
    const uploaded = { uploaded: ["mission1.pbo", "mission2.pbo"] };
    vi.mocked(api.upload).mockResolvedValueOnce(uploaded);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUploadMissions(), {
      wrapper: createWrapper(),
    });

    const file1 = new File(["content1"], "mission1.pbo", { type: "application/octet-stream" });
    const file2 = new File(["content2"], "mission2.pbo", { type: "application/octet-stream" });

    await act(async () => {
      await result.current.mutateAsync([file1, file2]);
    });

    expect(api.upload).toHaveBeenCalledWith("/missions/", expect.any(FormData));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["missions"] });
  });

  it("passes files as FormData with correct field name", async () => {
    const uploaded = { uploaded: ["mission1.pbo"] };
    vi.mocked(api.upload).mockResolvedValueOnce(uploaded);

    const { result } = renderHook(() => useUploadMissions(), {
      wrapper: createWrapper(),
    });

    const file = new File(["content"], "mission1.pbo", { type: "application/octet-stream" });

    await act(async () => {
      await result.current.mutateAsync([file]);
    });

    const callArgs = vi.mocked(api.upload).mock.calls[0];
    const formData = callArgs[1] as FormData;
    expect(formData.has("files")).toBe(true);
  });

  it("calls API and handles error on failure", async () => {
    vi.mocked(api.upload).mockRejectedValueOnce(new Error("Upload failed"));

    const { result } = renderHook(() => useUploadMissions(), {
      wrapper: createWrapper(),
    });

    const file = new File(["content"], "fail.pbo", { type: "application/octet-stream" });

    await act(async () => {
      try {
        await result.current.mutateAsync([file]);
      } catch {
        // Expected error
      }
    });

    expect(api.upload).toHaveBeenCalledWith("/missions/", expect.any(FormData));
  });
});