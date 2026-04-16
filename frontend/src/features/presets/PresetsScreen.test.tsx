import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PresetsScreen } from "./PresetsScreen";
import type { Preset } from "@/types/api";

const MOCK_PRESETS: Preset[] = [
  {
    preset_name: "King of the Hill",
    source_file: "koth.html",
    mod_count: 12,
    mods: [
      { name: "@CBA_A3", source: "steam", url: null, steam_id: "450814997" },
      { name: "@ace", source: "steam", url: null, steam_id: "463939057" },
    ],
  },
  {
    preset_name: "Antistasi",
    source_file: "antistasi.html",
    mod_count: 8,
    mods: [
      { name: "@CBA_A3", source: "steam", url: null, steam_id: "450814997" },
    ],
  },
];

const mockUsePresets = vi.fn();
const mockMutateUpload = vi.fn();
const mockMutateDelete = vi.fn();

vi.mock("@/hooks/usePresets", () => ({
  usePresets: () => mockUsePresets(),
  useUploadPresets: () => ({
    mutate: mockMutateUpload,
    isPending: false,
  }),
  useDeletePreset: () => ({
    mutate: mockMutateDelete,
    isPending: false,
  }),
}));

vi.mock("react-dropzone", () => ({
  useDropzone: () => ({
    getRootProps: () => ({ role: "button", tabIndex: 0, "aria-label": "Upload preset files" }),
    getInputProps: () => ({ type: "file", accept: "text/html", multiple: true, style: { display: "none" } }),
    isDragActive: false,
  }),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderPresets(overrides: { presets?: Preset[]; isLoading?: boolean; error?: boolean } = {}) {
  const queryClient = createTestQueryClient();

  if (overrides.error) {
    mockUsePresets.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to load presets"),
    });
  } else if (overrides.isLoading) {
    mockUsePresets.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
  } else {
    mockUsePresets.mockReturnValue({
      data: overrides.presets ?? MOCK_PRESETS,
      isLoading: false,
      error: null,
    });
  }

  const result = render(
    <QueryClientProvider client={queryClient}>
      <PresetsScreen />
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}

describe("PresetsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Presets heading", async () => {
    renderPresets();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Presets" })).toBeInTheDocument();
    });
  });

  it("renders the dropzone with upload instructions", async () => {
    renderPresets();

    await waitFor(() => {
      expect(screen.getByText("Drag & drop Arma 3 Launcher .html preset exports")).toBeInTheDocument();
    });
  });

  it("renders the dropzone as a button element", async () => {
    renderPresets();

    await waitFor(() => {
      const dropzone = screen.getByRole("button", { name: /upload preset files/i });
      expect(dropzone).toBeInTheDocument();
    });
  });

  it("renders preset list items with names and mod counts", async () => {
    renderPresets();

    await waitFor(() => {
      expect(screen.getByText("King of the Hill")).toBeInTheDocument();
    });
    expect(screen.getByText("12 mods")).toBeInTheDocument();
    expect(screen.getByText("Antistasi")).toBeInTheDocument();
    expect(screen.getByText("8 mods")).toBeInTheDocument();
  });

  it("renders a Delete button for each preset", async () => {
    renderPresets();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete king of the hill/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /delete antistasi/i })).toBeInTheDocument();
  });

  it("calls deletePreset.mutate with source_file when Delete is clicked", async () => {
    const user = userEvent.setup();
    renderPresets();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete king of the hill/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /delete king of the hill/i }));
    expect(mockMutateDelete).toHaveBeenCalledWith("koth.html");
  });

  it("renders a Load button for each preset", async () => {
    renderPresets();

    await waitFor(() => {
      // Use exact text match — /load/i also matches "Upload" in the dropzone aria-label
      const loadButtons = screen.getAllByRole("button").filter(
        (btn) => btn.textContent === "Load",
      );
      expect(loadButtons).toHaveLength(2);
    });
  });

  it("shows loading skeletons while presets are loading", () => {
    const { container } = renderPresets({ isLoading: true });

    // Skeleton component renders with data-slot="skeleton"
    const skeletons = container.querySelectorAll("[data-slot=skeleton]");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows error state when preset fetch fails", async () => {
    renderPresets({ error: true });

    await waitFor(() => {
      expect(screen.getByText("Failed to load presets")).toBeInTheDocument();
    });
  });

  it("shows empty state when there are no presets", async () => {
    renderPresets({ presets: [] });

    await waitFor(() => {
      expect(screen.getByText("No presets yet. Upload an Arma 3 Launcher .html preset export.")).toBeInTheDocument();
    });
  });

  it("does not show empty state when presets exist", async () => {
    renderPresets();

    await waitFor(() => {
      expect(screen.getByText("King of the Hill")).toBeInTheDocument();
    });

    expect(screen.queryByText(/no presets yet/i)).not.toBeInTheDocument();
  });

  it("does not show preset list when loading", () => {
    renderPresets({ isLoading: true });

    expect(screen.queryByText("King of the Hill")).not.toBeInTheDocument();
  });

  it("does not show preset list when error occurs", async () => {
    renderPresets({ error: true });

    await waitFor(() => {
      expect(screen.getByText("Failed to load presets")).toBeInTheDocument();
    });

    expect(screen.queryByText("King of the Hill")).not.toBeInTheDocument();
  });
});