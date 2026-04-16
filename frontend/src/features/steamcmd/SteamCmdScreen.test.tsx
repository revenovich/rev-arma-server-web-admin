import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SteamCmdScreen } from "./SteamCmdScreen";
import type { SteamCmdVersion } from "@/types/api";

const MOCK_VERSION_INSTALLED: SteamCmdVersion = {
  version: "1.2.3.4",
  installed: true,
};

const MOCK_VERSION_NOT_INSTALLED: SteamCmdVersion = {
  version: null,
  installed: false,
};

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock("@/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
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

function renderSteamCmd(overrides: { version?: SteamCmdVersion; error?: boolean } = {}) {
  const queryClient = createTestQueryClient();

  mockApiGet.mockImplementation((url: string) => {
    if (url === "/steamcmd/version") {
      if (overrides.error) {
        return Promise.reject(new Error("Network error"));
      }
      return Promise.resolve(overrides.version ?? MOCK_VERSION_INSTALLED);
    }
    return Promise.resolve(null);
  });

  mockApiPost.mockResolvedValue(null);

  const result = render(
    <QueryClientProvider client={queryClient}>
      <SteamCmdScreen />
    </QueryClientProvider>,
  );

  return { ...result, queryClient };
}

describe("SteamCmdScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows skeleton while loading version data", () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    const queryClient = createTestQueryClient();

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <SteamCmdScreen />
      </QueryClientProvider>,
    );

    // Skeleton component renders with data-slot="skeleton"
    const skeletons = container.querySelectorAll("[data-slot=skeleton]");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows error state when version fetch fails", async () => {
    renderSteamCmd({ error: true });

    await waitFor(() => {
      expect(screen.getByText("Failed to load SteamCMD status")).toBeInTheDocument();
    });
  });

  it("shows Installed badge when SteamCMD is installed", async () => {
    renderSteamCmd({ version: MOCK_VERSION_INSTALLED });

    await waitFor(() => {
      expect(screen.getByText("Installed")).toBeInTheDocument();
    });
  });

  it("shows version string when installed and version is present", async () => {
    renderSteamCmd({ version: MOCK_VERSION_INSTALLED });

    await waitFor(() => {
      expect(screen.getByText("v1.2.3.4")).toBeInTheDocument();
    });
  });

  it("shows Not Installed badge when SteamCMD is not installed", async () => {
    renderSteamCmd({ version: MOCK_VERSION_NOT_INSTALLED });

    await waitFor(() => {
      expect(screen.getByText("Not Installed")).toBeInTheDocument();
    });
  });

  it("does not show version string when version is null", async () => {
    renderSteamCmd({ version: MOCK_VERSION_NOT_INSTALLED });

    await waitFor(() => {
      expect(screen.getByText("Not Installed")).toBeInTheDocument();
    });

    expect(screen.queryByText(/^v\d/)).not.toBeInTheDocument();
  });

  it("renders Install button", async () => {
    renderSteamCmd();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^install$/i })).toBeInTheDocument();
    });
  });

  it("renders Update button", async () => {
    renderSteamCmd();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^update$/i })).toBeInTheDocument();
    });
  });

  it("calls api.post(/steamcmd/install) when Install is clicked", async () => {
    const user = userEvent.setup();
    renderSteamCmd();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^install$/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^install$/i }));
    expect(mockApiPost).toHaveBeenCalledWith("/steamcmd/install");
  });

  it("calls api.post(/steamcmd/update) when Update is clicked", async () => {
    const user = userEvent.setup();
    renderSteamCmd();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^update$/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^update$/i }));
    expect(mockApiPost).toHaveBeenCalledWith("/steamcmd/update");
  });

  it("renders branch selector with Stable (public) option", async () => {
    renderSteamCmd();

    await waitFor(() => {
      expect(screen.getByText("Stable (public)")).toBeInTheDocument();
    });
  });

  it("renders branch selector with Development option", async () => {
    renderSteamCmd();

    await waitFor(() => {
      expect(screen.getByText("Development")).toBeInTheDocument();
    });
  });

  it("renders Switch Branch button", async () => {
    renderSteamCmd();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /switch branch/i })).toBeInTheDocument();
    });
  });

  it("calls api.post with default public branch when Switch Branch is clicked", async () => {
    const user = userEvent.setup();
    renderSteamCmd();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /switch branch/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /switch branch/i }));
    expect(mockApiPost).toHaveBeenCalledWith("/steamcmd/branch", { branch: "public" });
  });

  it("calls api.post with development branch after selecting it", async () => {
    const user = userEvent.setup();
    renderSteamCmd();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /switch branch/i })).toBeInTheDocument();
    });

    const select = document.getElementById("branch-select") as HTMLSelectElement;
    expect(select).toBeTruthy();

    await user.selectOptions(select, "development");
    expect(select.value).toBe("development");

    await user.click(screen.getByRole("button", { name: /switch branch/i }));
    expect(mockApiPost).toHaveBeenCalledWith("/steamcmd/branch", { branch: "development" });
  });

  it("renders page heading SteamCMD", async () => {
    renderSteamCmd();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "SteamCMD" })).toBeInTheDocument();
    });
  });

  it("renders Installation Status section label", async () => {
    renderSteamCmd();

    await waitFor(() => {
      expect(screen.getByText("Installation Status")).toBeInTheDocument();
    });
  });

  it("renders Actions section label", async () => {
    renderSteamCmd();

    await waitFor(() => {
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });
  });

  it("renders Branch section label", async () => {
    renderSteamCmd();

    await waitFor(() => {
      expect(screen.getByText("Branch")).toBeInTheDocument();
    });
  });
});