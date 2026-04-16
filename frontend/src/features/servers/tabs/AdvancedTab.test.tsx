import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdvancedTab } from "./AdvancedTab";
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

function renderAdvancedTab(overrides: { server?: Partial<Server>; isLoading?: boolean } = {}) {
  const queryClient = createTestQueryClient();
  const server = { ...mockServer, ...overrides.server };

  if (overrides.isLoading) {
    mockUseServer.mockReturnValue({ data: undefined, isLoading: true });
  } else {
    mockUseServer.mockReturnValue({ data: server, isLoading: false });
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <AdvancedTab />
    </QueryClientProvider>,
  );
}

describe("AdvancedTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});
  });

  it("shows loading skeletons while server data loads", () => {
    const { container } = renderAdvancedTab({ isLoading: true });
    const skeletons = container.querySelectorAll("[data-slot=skeleton]");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Launch Parameters section", async () => {
    renderAdvancedTab();
    await waitFor(() => {
      expect(screen.getByText("Launch Parameters")).toBeInTheDocument();
    });
  });

  it("renders Message of the Day section", async () => {
    renderAdvancedTab();
    await waitFor(() => {
      expect(screen.getByText("Message of the Day")).toBeInTheDocument();
    });
  });

  it("renders Headless Clients section", async () => {
    renderAdvancedTab();
    await waitFor(() => {
      expect(screen.getByText("Headless Clients")).toBeInTheDocument();
    });
  });

  it("renders Additional Configuration section", async () => {
    renderAdvancedTab();
    await waitFor(() => {
      expect(screen.getByText("Additional Configuration")).toBeInTheDocument();
    });
  });

  it("renders Save Changes button", async () => {
    renderAdvancedTab();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });
  });

  it("adds a parameter when Add button is clicked", async () => {
    const user = userEvent.setup();
    renderAdvancedTab();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("-mod @CBA_A3 or -world Altis")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("-mod @CBA_A3 or -world Altis");
    await user.type(input, "-port 2302");
    await user.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getAllByText("-port 2302").length).toBeGreaterThanOrEqual(1);
  });

  it("removes a parameter when X button is clicked", async () => {
    const user = userEvent.setup();
    renderAdvancedTab({
      server: { parameters: ["-world Altis"] },
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /remove -world Altis/i })).toBeInTheDocument();
    });

    const removeBtn = screen.getByRole("button", { name: /remove -world Altis/i });
    await user.click(removeBtn);

    expect(screen.queryByRole("button", { name: /remove -world Altis/i })).not.toBeInTheDocument();
  });

  it("adds parameter on Enter key", async () => {
    const user = userEvent.setup();
    renderAdvancedTab();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("-mod @CBA_A3 or -world Altis")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("-mod @CBA_A3 or -world Altis");
    await user.type(input, "-world Altis");
    await user.keyboard("{Enter}");

    expect(screen.getAllByText("-world Altis").length).toBeGreaterThanOrEqual(1);
  });

  it("does not add empty parameter", async () => {
    const user = userEvent.setup();
    renderAdvancedTab();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /add/i }));
    // No parameter chips should be added
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("renders MOTD textarea", async () => {
    renderAdvancedTab();
    await waitFor(() => {
      expect(screen.getByLabelText("MOTD (one line per message)")).toBeInTheDocument();
    });
  });

  it("renders Headless Clients number input", async () => {
    renderAdvancedTab();
    await waitFor(() => {
      expect(screen.getByLabelText(/number of headless clients/i)).toBeInTheDocument();
    });
  });

  it("calls mutateAsync on Save Changes", async () => {
    const user = userEvent.setup();
    renderAdvancedTab();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(mockMutateAsync).toHaveBeenCalled();
  });

  it("initializes form with server data including parameters", async () => {
    renderAdvancedTab({
      server: { parameters: ["-port 2302", "-world Altis"], motd: "Welcome!" },
    });

    await waitFor(() => {
      expect(screen.getAllByText("-port 2302").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("-world Altis").length).toBeGreaterThanOrEqual(1);
    });
  });
});