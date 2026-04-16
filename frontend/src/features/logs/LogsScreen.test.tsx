import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LogsScreen } from "./LogsScreen";
import type { LogEntry } from "@/types/api";

const MOCK_LOGS: LogEntry[] = [
  {
    name: "Arma3_2026-04-15_10-30-00.rpt",
    path: "/logs/Arma3_2026-04-15_10-30-00.rpt",
    size: 2048576,
    formattedSize: "2.0 MB",
    created: "2026-04-15T10:30:00Z",
    modified: "2026-04-15 12:45:00",
  },
  {
    name: "Arma3_2026-04-14_08-15-00.rpt",
    path: "/logs/Arma3_2026-04-14_08-15-00.rpt",
    size: 512000,
    formattedSize: "500.0 KB",
    created: "2026-04-14T08:15:00Z",
    modified: "2026-04-14 09:20:00",
  },
  {
    name: "Arma3_2026-04-13_16-00-00.rpt",
    path: "/logs/Arma3_2026-04-13_16-00-00.rpt",
    size: 0,
    formattedSize: "0 B",
    created: "2026-04-13T16:00:00Z",
    modified: "2026-04-13 16:05:00",
  },
];

const mockApiGet = vi.fn();
const mockApiDel = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    del: (...args: unknown[]) => mockApiDel(...args),
  },
  ApiError: class ApiError extends Error {
    status: number;
    statusText: string;
    body: unknown;
    constructor(status: number, statusText: string, body: unknown) {
      super(statusText);
      this.name = "ApiError";
      this.status = status;
      this.statusText = statusText;
      this.body = body;
    }
  },
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderLogs(overrides: { logs?: LogEntry[]; isLoading?: boolean; error?: boolean } = {}) {
  const queryClient = createTestQueryClient();

  if (overrides.error) {
    mockApiGet.mockRejectedValue(new Error("Network error"));
  } else if (overrides.isLoading) {
    mockApiGet.mockReturnValue(new Promise(() => {}));
  } else {
    mockApiGet.mockResolvedValue(overrides.logs ?? MOCK_LOGS);
  }

  mockApiDel.mockResolvedValue(null);

  const result = render(
    <QueryClientProvider client={queryClient}>
      <LogsScreen />
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}

describe("LogsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the Server Logs heading", async () => {
    renderLogs();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Server Logs" })).toBeInTheDocument();
    });
  });

  it("shows skeleton rows while loading", () => {
    const { container } = renderLogs({ isLoading: true });

    const skeletons = container.querySelectorAll("[data-slot=skeleton]");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows error state when log fetch fails", async () => {
    renderLogs({ error: true });

    await waitFor(() => {
      expect(screen.getByText("Failed to load logs")).toBeInTheDocument();
    });
  });

  it("shows empty state when there are no log files", async () => {
    renderLogs({ logs: [] });

    await waitFor(() => {
      expect(
        screen.getByText("No log files found. Logs appear after running a server."),
      ).toBeInTheDocument();
    });
  });

  it("renders log entries with file names", async () => {
    renderLogs();

    await waitFor(() => {
      expect(screen.getByText("Arma3_2026-04-15_10-30-00.rpt")).toBeInTheDocument();
    });
    expect(screen.getByText("Arma3_2026-04-14_08-15-00.rpt")).toBeInTheDocument();
    expect(screen.getByText("Arma3_2026-04-13_16-00-00.rpt")).toBeInTheDocument();
  });

  it("renders formatted size and modified date for each log", async () => {
    renderLogs();

    await waitFor(() => {
      expect(screen.getByText(/2\.0 MB/)).toBeInTheDocument();
    });
    expect(screen.getByText(/500\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/0 B/)).toBeInTheDocument();

    expect(screen.getByText(/2026-04-15 12:45:00/)).toBeInTheDocument();
    expect(screen.getByText(/2026-04-14 09:20:00/)).toBeInTheDocument();
    expect(screen.getByText(/2026-04-13 16:05:00/)).toBeInTheDocument();
  });

  it("renders a Download link for each log entry", async () => {
    renderLogs();

    await waitFor(() => {
      const downloadLinks = screen.getAllByRole("link", { name: /download/i });
      expect(downloadLinks).toHaveLength(3);
    });
  });

  it("download link points to the correct API URL", async () => {
    renderLogs();

    await waitFor(() => {
      const downloadLinks = screen.getAllByRole("link", { name: /download/i });
      expect(downloadLinks[0]).toHaveAttribute(
        "href",
        "/api/logs/Arma3_2026-04-15_10-30-00.rpt/download",
      );
      expect(downloadLinks[1]).toHaveAttribute(
        "href",
        "/api/logs/Arma3_2026-04-14_08-15-00.rpt/download",
      );
      expect(downloadLinks[2]).toHaveAttribute(
        "href",
        "/api/logs/Arma3_2026-04-13_16-00-00.rpt/download",
      );
    });
  });

  it("renders a Delete button for each log entry", async () => {
    renderLogs();

    await waitFor(() => {
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      expect(deleteButtons).toHaveLength(3);
    });
  });

  it("calls api.del with the correct log name when Delete is clicked", async () => {
    const user = userEvent.setup();
    renderLogs();

    await waitFor(() => {
      expect(screen.getByText("Arma3_2026-04-15_10-30-00.rpt")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    expect(mockApiDel).toHaveBeenCalledWith("/logs/Arma3_2026-04-15_10-30-00.rpt");
  });

  it("re-enables Delete button after mutation settles", async () => {
    const user = userEvent.setup();
    // Resolve delete immediately so onSettled fires and clears deletingFile
    mockApiDel.mockResolvedValue(null);
    renderLogs();

    await waitFor(() => {
      expect(screen.getByText("Arma3_2026-04-15_10-30-00.rpt")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    // After the mutation settles, the button should be re-enabled
    // (deletingFile is cleared in onSettled)
    await waitFor(() => {
      const buttons = screen.getAllByRole("button", { name: /delete/i });
      expect(buttons[0]).not.toBeDisabled();
    });
  });

  it("invalidates logs query after successful delete", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderLogs();

    await waitFor(() => {
      expect(screen.getByText("Arma3_2026-04-15_10-30-00.rpt")).toBeInTheDocument();
    });

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["logs"] });
    });
  });

  it("does not show empty state when log entries exist", async () => {
    renderLogs();

    await waitFor(() => {
      expect(screen.getByText("Arma3_2026-04-15_10-30-00.rpt")).toBeInTheDocument();
    });

    expect(screen.queryByText(/no log files found/i)).not.toBeInTheDocument();
  });

  it("does not show log list when loading", () => {
    renderLogs({ isLoading: true });

    expect(screen.queryByText("Arma3_2026-04-15_10-30-00.rpt")).not.toBeInTheDocument();
  });

  it("does not show log list when error occurs", async () => {
    renderLogs({ error: true });

    await waitFor(() => {
      expect(screen.getByText("Failed to load logs")).toBeInTheDocument();
    });

    expect(screen.queryByText("Arma3_2026-04-15_10-30-00.rpt")).not.toBeInTheDocument();
  });

  it("calls api.get with /logs/ endpoint", async () => {
    renderLogs();

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith("/logs/");
    });
  });

  it("renders FileText icon in empty state", async () => {
    renderLogs({ logs: [] });

    await waitFor(() => {
      expect(screen.getByText(/no log files found/i)).toBeInTheDocument();
    });

    // The FileText icon renders as an SVG within the empty state container
    const emptyStateContainer = screen.getByText(/no log files found/i).closest("div");
    const svg = emptyStateContainer?.querySelector("svg");
    expect(svg).toBeTruthy();
  });
});