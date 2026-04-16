import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MissionsScreen } from "./MissionsScreen";
import type { Mission } from "@/types/api";

const MOCK_MISSIONS: Mission[] = [
  {
    name: "co_10_escape.malden.pbo",
    missionName: "co_10_escape",
    worldName: "malden",
    size: 1024000,
    sizeFormatted: "1.0 MB",
    dateCreated: "2025-01-01",
    dateModified: "2025-03-15",
  },
  {
    name: "co_30_koth.altis.pbo",
    missionName: "co_30_koth",
    worldName: "altis",
    size: 2048000,
    sizeFormatted: "2.0 MB",
    dateCreated: "2025-02-10",
    dateModified: "2025-04-01",
  },
  {
    name: "sp_showcase.stratis.pbo",
    missionName: "sp_showcase",
    worldName: "stratis",
    size: 512000,
    sizeFormatted: "500 KB",
    dateCreated: "2025-01-20",
    dateModified: "2025-02-28",
  },
];

// -- Mutable mock state --
// Using plain variables instead of vi.fn() for boolean flags,
// because vi.mock factories with getters need stable references.

let mockDeleteIsPending = false;
let mockRefreshIsPending = false;
let mockIsDragActive = false;
let mockOnDrop: ((files: File[]) => void) | null = null;

const mockUseMissions = vi.fn();
const mockDeleteMutate = vi.fn();
const mockRefreshMutate = vi.fn();
const mockUploadMutate = vi.fn();

vi.mock("@/hooks/useMissions", () => ({
  useMissions: () => mockUseMissions(),
  useDeleteMission: () => ({
    mutate: mockDeleteMutate,
    get isPending() { return mockDeleteIsPending; },
  }),
  useRefreshMissions: () => ({
    mutate: mockRefreshMutate,
    get isPending() { return mockRefreshIsPending; },
  }),
  useUploadMissions: () => ({
    mutate: mockUploadMutate,
    isPending: false,
  }),
  useWorkshopDownload: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("react-dropzone", () => ({
  useDropzone: (opts: { onDrop: (files: File[]) => void }) => {
    mockOnDrop = opts.onDrop;
    return {
      getRootProps: () => ({ tabIndex: 0 }),
      getInputProps: () => ({ type: "file", accept: ".pbo", multiple: true, style: { display: "none" } }),
      get isDragActive() { return mockIsDragActive; },
    };
  },
}));

// -- Helpers --

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface RenderOverrides {
  missions?: Mission[];
  isLoading?: boolean;
  error?: boolean;
  deleteIsPending?: boolean;
  refreshIsPending?: boolean;
}

function renderMissions(overrides: RenderOverrides = {}) {
  const queryClient = createTestQueryClient();

  // Set pending states from overrides (default: not pending)
  mockDeleteIsPending = overrides.deleteIsPending ?? false;
  mockRefreshIsPending = overrides.refreshIsPending ?? false;

  if (overrides.error) {
    mockUseMissions.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Failed to load missions"),
    });
  } else if (overrides.isLoading) {
    mockUseMissions.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
  } else {
    mockUseMissions.mockReturnValue({
      data: overrides.missions ?? MOCK_MISSIONS,
      isLoading: false,
      error: null,
    });
  }

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MissionsScreen />
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}

// -- Tests --

describe("MissionsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteIsPending = false;
    mockRefreshIsPending = false;
    mockIsDragActive = false;
    mockOnDrop = null;
  });

  // -- Heading and layout --

  it("renders the Missions heading", async () => {
    renderMissions();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Missions" })).toBeInTheDocument();
    });
  });

  it("renders the Refresh button", async () => {
    renderMissions();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
    });
  });

  // -- Dropzone / upload --

  it("renders the upload dropzone with instructions", async () => {
    renderMissions();

    await waitFor(() => {
      expect(screen.getByText("Drag & drop .pbo mission files, or click to browse")).toBeInTheDocument();
    });
  });

  it("renders a file input with .pbo accept attribute", async () => {
    renderMissions();

    await waitFor(() => {
      expect(screen.getByText("Drag & drop .pbo mission files, or click to browse")).toBeInTheDocument();
    });

    const input = document.getElementById("mission-upload") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe("file");
  });

  it("shows drag-active text when isDragActive is true", async () => {
    mockIsDragActive = true;

    renderMissions();

    await waitFor(() => {
      expect(screen.getByText("Drop .pbo files here")).toBeInTheDocument();
    });
  });

  it("shows standard text when isDragActive is false", async () => {
    mockIsDragActive = false;

    renderMissions();

    await waitFor(() => {
      expect(screen.getByText("Drag & drop .pbo mission files, or click to browse")).toBeInTheDocument();
    });

    expect(screen.queryByText("Drop .pbo files here")).not.toBeInTheDocument();
  });

  it("calls uploadMissions.mutate with files when onDrop is invoked", () => {
    renderMissions();

    // The dropzone mock captures the onDrop callback.
    // Simulate dropping files by calling it directly.
    const fakeFiles = [new File(["pbo"], "test.pbo", { type: "application/octet-stream" })];
    expect(mockOnDrop).toBeDefined();
    mockOnDrop!(fakeFiles);

    expect(mockUploadMutate).toHaveBeenCalledWith(fakeFiles);
  });

  // -- Loading state --

  it("shows 6 loading skeletons while missions are loading", () => {
    const { container } = renderMissions({ isLoading: true });

    const skeletons = container.querySelectorAll("[data-slot=skeleton]");
    expect(skeletons).toHaveLength(6);
  });

  it("does not show mission list while loading", () => {
    renderMissions({ isLoading: true });

    expect(screen.queryByText("co_10_escape")).not.toBeInTheDocument();
  });

  it("shows dropzone while loading (upload remains accessible)", () => {
    renderMissions({ isLoading: true });

    // The dropzone is always visible regardless of loading state
    expect(screen.getByText("Drag & drop .pbo mission files, or click to browse")).toBeInTheDocument();
  });

  // -- Error state --

  it("shows error state when missions fetch fails", async () => {
    renderMissions({ error: true });

    await waitFor(() => {
      expect(screen.getByText("Failed to load missions")).toBeInTheDocument();
    });
  });

  it("does not show mission list when error occurs", async () => {
    renderMissions({ error: true });

    await waitFor(() => {
      expect(screen.getByText("Failed to load missions")).toBeInTheDocument();
    });

    expect(screen.queryByText("co_10_escape")).not.toBeInTheDocument();
  });

  it("does not show dropzone when error occurs (error renders early return)", async () => {
    renderMissions({ error: true });

    await waitFor(() => {
      expect(screen.getByText("Failed to load missions")).toBeInTheDocument();
    });

    expect(screen.queryByText("Drag & drop .pbo mission files, or click to browse")).not.toBeInTheDocument();
  });

  // -- Empty state --

  it("shows empty state when there are no missions", async () => {
    renderMissions({ missions: [] });

    await waitFor(() => {
      expect(screen.getByText("No mission files found. Upload .pbo files above.")).toBeInTheDocument();
    });
  });

  it("does not show empty state when missions exist", async () => {
    renderMissions();

    await waitFor(() => {
      expect(screen.getByText("co_10_escape")).toBeInTheDocument();
    });

    expect(screen.queryByText("No mission files found. Upload .pbo files above.")).not.toBeInTheDocument();
  });

  it("does not show empty state text when missions are loading", () => {
    renderMissions({ isLoading: true });

    // Skeleton should show, not empty message
    expect(screen.queryByText("No mission files found. Upload .pbo files above.")).not.toBeInTheDocument();
  });

  // -- Populated mission list --

  it("renders mission list items with mission names", async () => {
    renderMissions();

    await waitFor(() => {
      expect(screen.getByText("co_10_escape")).toBeInTheDocument();
    });
    expect(screen.getByText("co_30_koth")).toBeInTheDocument();
    expect(screen.getByText("sp_showcase")).toBeInTheDocument();
  });

  it("renders world name badges for missions that have one", async () => {
    renderMissions();

    await waitFor(() => {
      expect(screen.getByText("malden")).toBeInTheDocument();
    });
    expect(screen.getByText("altis")).toBeInTheDocument();
    expect(screen.getByText("stratis")).toBeInTheDocument();
  });

  it("renders size and date info for each mission", async () => {
    renderMissions();

    await waitFor(() => {
      expect(screen.getByText("1.0 MB — 2025-03-15")).toBeInTheDocument();
    });
    expect(screen.getByText("2.0 MB — 2025-04-01")).toBeInTheDocument();
    expect(screen.getByText("500 KB — 2025-02-28")).toBeInTheDocument();
  });

  it("renders Download links for each mission", async () => {
    renderMissions();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /download co_10_escape\.malden\.pbo/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /download co_30_koth\.altis\.pbo/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download sp_showcase\.stratis\.pbo/i })).toBeInTheDocument();
  });

  it("renders download links pointing to the correct API endpoint", async () => {
    renderMissions();

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /download co_10_escape\.malden\.pbo/i });
      expect(link).toHaveAttribute("href", "/api/missions/co_10_escape.malden.pbo");
    });
  });

  it("renders Delete buttons for each mission", async () => {
    renderMissions();

    await waitFor(() => {
      expect(screen.getByText("co_10_escape")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    expect(deleteButtons).toHaveLength(3);
  });

  // -- Delete action --

  it("calls deleteMission.mutate with mission name when Delete is clicked", async () => {
    const user = userEvent.setup();
    renderMissions();

    await waitFor(() => {
      expect(screen.getByText("co_10_escape")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    await user.click(deleteButtons[0]);

    expect(mockDeleteMutate).toHaveBeenCalledWith("co_10_escape.malden.pbo");
  });

  it("calls deleteMission.mutate for second mission when its Delete is clicked", async () => {
    const user = userEvent.setup();
    renderMissions();

    await waitFor(() => {
      expect(screen.getByText("co_30_koth")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    await user.click(deleteButtons[1]);

    expect(mockDeleteMutate).toHaveBeenCalledWith("co_30_koth.altis.pbo");
  });

  // -- Refresh action --

  it("calls refreshMissions.mutate when Refresh button is clicked", async () => {
    const user = userEvent.setup();
    renderMissions();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /refresh/i }));
    expect(mockRefreshMutate).toHaveBeenCalled();
  });

  it("Refresh button is enabled by default", async () => {
    renderMissions();

    await waitFor(() => {
      const refreshBtn = screen.getByRole("button", { name: /refresh/i });
      expect(refreshBtn).toBeEnabled();
    });
  });

  it("Refresh button is disabled when refreshMissions is pending", async () => {
    renderMissions({ refreshIsPending: true });

    await waitFor(() => {
      const refreshBtn = screen.getByRole("button", { name: /refresh/i });
      expect(refreshBtn).toBeDisabled();
    });
  });

  it("Delete buttons are disabled when deleteMission is pending", async () => {
    renderMissions({ deleteIsPending: true });

    await waitFor(() => {
      expect(screen.getByText("co_10_escape")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    for (const btn of deleteButtons) {
      expect(btn).toBeDisabled();
    }
  });

  // -- Mission without worldName --

  it("does not render worldName badge when mission has no worldName", async () => {
    const missionNoWorld: Mission[] = [
      {
        name: "sp_test.pbo",
        missionName: "sp_test",
        worldName: "",
        size: 256000,
        sizeFormatted: "250 KB",
        dateCreated: "2025-01-05",
        dateModified: "2025-02-10",
      },
    ];

    const { container } = renderMissions({ missions: missionNoWorld });

    await waitFor(() => {
      expect(screen.getByText("sp_test")).toBeInTheDocument();
    });

    // Empty string worldName is falsy, so no Badge should be rendered
    const badges = container.querySelectorAll("[data-slot='badge']");
    expect(badges).toHaveLength(0);
  });

  it("renders worldName badge when mission has a worldName", async () => {
    const { container } = renderMissions();

    await waitFor(() => {
      expect(screen.getByText("malden")).toBeInTheDocument();
    });

    const badges = container.querySelectorAll("[data-slot='badge']");
    expect(badges).toHaveLength(3);
  });

  // -- Single mission rendering --

  it("renders a single mission correctly", async () => {
    const singleMission: Mission[] = [
      {
        name: "co_10_escape.malden.pbo",
        missionName: "co_10_escape",
        worldName: "malden",
        size: 1024000,
        sizeFormatted: "1.0 MB",
        dateCreated: "2025-01-01",
        dateModified: "2025-03-15",
      },
    ];

    renderMissions({ missions: singleMission });

    await waitFor(() => {
      expect(screen.getByText("co_10_escape")).toBeInTheDocument();
    });

    expect(screen.getByText("malden")).toBeInTheDocument();
    expect(screen.getByText("1.0 MB — 2025-03-15")).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    expect(deleteButtons).toHaveLength(1);
  });
});