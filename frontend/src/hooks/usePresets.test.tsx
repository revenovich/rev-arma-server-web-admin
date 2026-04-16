import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePresets, useUploadPresets, useDeletePreset } from "@/hooks/usePresets";
import { api } from "@/lib/api";
import type { Preset } from "@/types/api";
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

const mockPreset: Preset = {
  preset_name: "test-preset",
  source_file: "test.html",
  mod_count: 5,
  mods: [
    { name: "@mod1", source: "local", url: null, steam_id: "12345" },
  ],
};

describe("usePresets", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.get).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches presets successfully", async () => {
    const presets = [mockPreset];
    vi.mocked(api.get).mockResolvedValueOnce(presets);

    const { result } = renderHook(() => usePresets(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(presets);
    expect(api.get).toHaveBeenCalledWith("/presets/");
  });

  it("handles fetch error", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => usePresets(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});

describe("useUploadPresets", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.upload).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads preset files and invalidates queries", async () => {
    const uploaded: Preset[] = [mockPreset];
    vi.mocked(api.upload).mockResolvedValueOnce(uploaded);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUploadPresets(), {
      wrapper: createWrapper(),
    });

    const file = new File(["<html>preset</html>"], "preset.html", { type: "text/html" });

    await act(async () => {
      await result.current.mutateAsync([file]);
    });

    expect(api.upload).toHaveBeenCalledWith("/presets/upload", expect.any(FormData));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["presets"] });
  });

  it("passes files as FormData in upload call", async () => {
    const uploaded: Preset[] = [mockPreset];
    vi.mocked(api.upload).mockResolvedValueOnce(uploaded);

    const { result } = renderHook(() => useUploadPresets(), {
      wrapper: createWrapper(),
    });

    const file = new File(["<html>preset</html>"], "preset.html", { type: "text/html" });

    await act(async () => {
      await result.current.mutateAsync([file]);
    });

    const callArgs = vi.mocked(api.upload).mock.calls[0];
    const formData = callArgs[1] as FormData;
    expect(formData.has("files")).toBe(true);
  });

  it("shows error toast on failure", async () => {
    vi.mocked(api.upload).mockRejectedValueOnce(new Error("Upload failed"));

    const { result } = renderHook(() => useUploadPresets(), {
      wrapper: createWrapper(),
    });

    const file = new File(["<html>bad</html>"], "bad.html", { type: "text/html" });

    await act(async () => {
      try {
        await result.current.mutateAsync([file]);
      } catch {
        // Expected error
      }
    });

    expect(api.upload).toHaveBeenCalledWith("/presets/upload", expect.any(FormData));
  });
});

describe("useDeletePreset", () => {
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.mocked(api.del).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes a preset and invalidates queries", async () => {
    vi.mocked(api.del).mockResolvedValueOnce(undefined);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDeletePreset(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync("test-preset");
    });

    expect(api.del).toHaveBeenCalledWith("/presets/test-preset");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["presets"] });
  });

  it("encodes preset name with special characters", async () => {
    vi.mocked(api.del).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDeletePreset(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync("my preset & co");
    });

    expect(api.del).toHaveBeenCalledWith("/presets/my%20preset%20%26%20co");
  });

  it("shows error toast on failure", async () => {
    vi.mocked(api.del).mockRejectedValueOnce(new Error("Delete failed"));

    const { result } = renderHook(() => useDeletePreset(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync("fail-preset");
      } catch {
        // Expected error
      }
    });

    expect(api.del).toHaveBeenCalledWith("/presets/fail-preset");
  });
});