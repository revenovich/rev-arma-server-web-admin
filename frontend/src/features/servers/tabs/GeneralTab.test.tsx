import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GeneralTab } from "./GeneralTab";
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

function renderGeneralTab(overrides: { server?: Partial<Server>; isLoading?: boolean } = {}) {
  const queryClient = createTestQueryClient();
  const server = { ...mockServer, ...overrides.server };

  if (overrides.isLoading) {
    mockUseServer.mockReturnValue({ data: undefined, isLoading: true });
  } else {
    mockUseServer.mockReturnValue({ data: server, isLoading: false });
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <GeneralTab />
    </QueryClientProvider>,
  );
}

describe("GeneralTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});
  });

  it("shows loading skeletons while server data loads", () => {
    const { container } = renderGeneralTab({ isLoading: true });
    const skeletons = container.querySelectorAll("[data-slot=skeleton]");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Identity section", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByText("Identity")).toBeInTheDocument();
    });
  });

  it("renders Passwords section", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByText("Passwords")).toBeInTheDocument();
    });
  });

  it("renders Players & Options section", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByText("Players & Options")).toBeInTheDocument();
    });
  });

  it("renders Server Name input", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByLabelText("Server Name *")).toBeInTheDocument();
    });
  });

  it("renders Port input", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByLabelText("Port")).toBeInTheDocument();
    });
  });

  it("renders Player Password input", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByLabelText("Player Password")).toBeInTheDocument();
    });
  });

  it("renders Admin Password input", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByLabelText("Admin Password")).toBeInTheDocument();
    });
  });

  it("renders Max Players input", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByLabelText("Max Players")).toBeInTheDocument();
    });
  });

  it("renders Persistent switch unchecked by default", async () => {
    renderGeneralTab();
    await waitFor(() => {
      const switchEl = screen.getByRole("switch", { name: /persistent/i });
      expect(switchEl).not.toBeChecked();
    });
  });

  it("renders Voice Over Network switch checked by default", async () => {
    renderGeneralTab();
    await waitFor(() => {
      const switchEl = screen.getByRole("switch", { name: /voice over network/i });
      expect(switchEl).toBeChecked();
    });
  });

  it("renders Auto Start switch unchecked by default", async () => {
    renderGeneralTab();
    await waitFor(() => {
      const switchEl = screen.getByRole("switch", { name: /auto start/i });
      expect(switchEl).not.toBeChecked();
    });
  });

  it("renders Save Changes button (initially disabled)", async () => {
    renderGeneralTab();
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /save changes/i });
      expect(btn).toBeDisabled();
    });
  });

  it("initializes form with server data", async () => {
    renderGeneralTab({
      server: { title: "My Arma Server", port: 2402, max_players: 64, persistent: true },
    });

    await waitFor(() => {
      const titleInput = screen.getByLabelText("Server Name *") as HTMLInputElement;
      expect(titleInput.value).toBe("My Arma Server");

      const portInput = screen.getByLabelText("Port") as HTMLInputElement;
      expect(portInput.value).toBe("2402");
    });
  });
});