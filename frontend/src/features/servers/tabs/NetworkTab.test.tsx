import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NetworkTab } from "./NetworkTab";
import type { Server } from "@/types/api";

const mockServer: Server = {
  id: "server-1",
  title: "Test Server",
  port: 2302,
  password: null,
  admin_password: null,
  allowed_file_patching: 0,
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
  verify_signatures: 2,
  additionalConfigurationOptions: null,
  pid: null,
  state: { online: false, players: 0, maxPlayers: 32, mission: null, map: null },
};

const mockUseServer = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "server-1" }),
}));

vi.mock("@/hooks/useServers", () => ({
  useServer: () => mockUseServer(),
  useUpdateServer: () => ({
    mutateAsync: mockMutateAsync,
    mutate: vi.fn(),
    isPending: false,
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

function renderNetworkTab(overrides: { server?: Partial<Server>; isLoading?: boolean } = {}) {
  const queryClient = createTestQueryClient();
  const server = { ...mockServer, ...overrides.server };

  if (overrides.isLoading) {
    mockUseServer.mockReturnValue({ data: undefined, isLoading: true });
  } else {
    mockUseServer.mockReturnValue({ data: server, isLoading: false });
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <NetworkTab />
    </QueryClientProvider>,
  );
}

describe("NetworkTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});
  });

  it("shows loading skeletons while server data loads", () => {
    const { container } = renderNetworkTab({ isLoading: true });
    const skeletons = container.querySelectorAll("[data-slot=skeleton]");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Bandwidth Preset section", async () => {
    renderNetworkTab();
    await waitFor(() => {
      expect(screen.getByText("Bandwidth Preset")).toBeInTheDocument();
    });
  });

  it("renders all bandwidth preset buttons", async () => {
    renderNetworkTab();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Home 1Mbps" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "VPS 10Mbps" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Dedicated 100Mbps" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Unlimited" })).toBeInTheDocument();
    });
  });

  it("renders Connection Settings section", async () => {
    renderNetworkTab();
    await waitFor(() => {
      expect(screen.getByText("Connection Settings")).toBeInTheDocument();
    });
  });

  it("renders Network Quality section", async () => {
    renderNetworkTab();
    await waitFor(() => {
      expect(screen.getByText("Network Quality & Kick Thresholds")).toBeInTheDocument();
    });
  });

  it("renders Network Options section with switches", async () => {
    renderNetworkTab();
    await waitFor(() => {
      expect(screen.getByText("Network Options")).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: /loopback/i })).toBeInTheDocument();
      expect(screen.getByRole("switch", { name: /upnp/i })).toBeInTheDocument();
    });
  });

  it("renders Save Changes button", async () => {
    renderNetworkTab();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });
  });

  it("applies bandwidth preset values when preset button is clicked", async () => {
    const user = userEvent.setup();
    renderNetworkTab();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Unlimited" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Unlimited" }));

    // After clicking Unlimited, MaxMsgSend should be 4096
    await waitFor(() => {
      const maxMsgInput = screen.getByLabelText("Max Messages Sent") as HTMLInputElement;
      expect(maxMsgInput.value).toBe("4096");
    });
  });

  it("calls mutateAsync on Save Changes", async () => {
    const user = userEvent.setup();
    renderNetworkTab();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(mockMutateAsync).toHaveBeenCalled();
  });

  it("renders number input fields for connection settings", async () => {
    renderNetworkTab();
    await waitFor(() => {
      expect(screen.getByLabelText("Max Messages Sent")).toBeInTheDocument();
      expect(screen.getByLabelText("Max Bandwidth (Bps)")).toBeInTheDocument();
      expect(screen.getByLabelText("Min Bandwidth (Bps)")).toBeInTheDocument();
    });
  });

  it("renders number input fields for network quality", async () => {
    renderNetworkTab();
    await waitFor(() => {
      expect(screen.getByLabelText("Max Ping Kick (-1 = disabled)")).toBeInTheDocument();
      expect(screen.getByLabelText("Max Packet Loss Kick % (-1 = disabled)")).toBeInTheDocument();
      expect(screen.getByLabelText("Disconnect Timeout (s)")).toBeInTheDocument();
    });
  });

  it("toggles Loopback switch", async () => {
    const user = userEvent.setup();
    renderNetworkTab();

    await waitFor(() => {
      const switchEl = screen.getByRole("switch", { name: /loopback/i });
      expect(switchEl).toBeInTheDocument();
    });

    const switchEl = screen.getByRole("switch", { name: /loopback/i });
    expect(switchEl).not.toBeChecked();

    await user.click(switchEl);
    expect(switchEl).toBeChecked();
  });
});