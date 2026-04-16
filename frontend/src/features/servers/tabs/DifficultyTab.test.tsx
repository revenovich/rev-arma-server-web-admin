import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DifficultyTab } from "./DifficultyTab";
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
  forcedDifficulty: "Regular",
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

function renderDifficultyTab(overrides: { server?: Partial<Server>; isLoading?: boolean } = {}) {
  const queryClient = createTestQueryClient();
  const server = { ...mockServer, ...overrides.server };

  if (overrides.isLoading) {
    mockUseServer.mockReturnValue({ data: undefined, isLoading: true });
  } else {
    mockUseServer.mockReturnValue({ data: server, isLoading: false });
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <DifficultyTab />
    </QueryClientProvider>,
  );
}

describe("DifficultyTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});
  });

  it("shows loading skeletons while server data loads", () => {
    const { container } = renderDifficultyTab({ isLoading: true });
    const skeletons = container.querySelectorAll("[data-slot=skeleton]");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Difficulty Preset section", async () => {
    renderDifficultyTab();
    await waitFor(() => {
      expect(screen.getByText("Difficulty Preset")).toBeInTheDocument();
    });
  });

  it("renders the Forced Difficulty dropdown", async () => {
    renderDifficultyTab();
    await waitFor(() => {
      expect(screen.getByLabelText("Forced Difficulty")).toBeInTheDocument();
    });
  });

  it("renders preset options", async () => {
    renderDifficultyTab();
    await waitFor(() => {
      expect(screen.getByText("Recruit")).toBeInTheDocument();
      expect(screen.getByText("Regular")).toBeInTheDocument();
      expect(screen.getByText("Veteran")).toBeInTheDocument();
      expect(screen.getByText("Custom")).toBeInTheDocument();
    });
  });

  it("initializes with server forcedDifficulty value", async () => {
    renderDifficultyTab({ server: { forcedDifficulty: "Veteran" } });
    await waitFor(() => {
      const select = screen.getByLabelText("Forced Difficulty") as HTMLSelectElement;
      expect(select.value).toBe("Veteran");
    });
  });

  it("does not show custom difficulty flags when preset is not Custom", async () => {
    renderDifficultyTab();
    await waitFor(() => {
      expect(screen.getByLabelText("Forced Difficulty")).toBeInTheDocument();
    });
    expect(screen.queryByText("Difficulty Flags")).not.toBeInTheDocument();
  });

  it("shows custom difficulty flags when Custom is selected", async () => {
    const user = userEvent.setup();
    renderDifficultyTab();

    await waitFor(() => {
      expect(screen.getByLabelText("Forced Difficulty")).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Forced Difficulty") as HTMLSelectElement;
    await user.selectOptions(select, "Custom");

    await waitFor(() => {
      expect(screen.getByText("Difficulty Flags")).toBeInTheDocument();
    });
  });

  it("shows AI Skill inputs when Custom is selected", async () => {
    const user = userEvent.setup();
    renderDifficultyTab();

    await waitFor(() => {
      expect(screen.getByLabelText("Forced Difficulty")).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Forced Difficulty") as HTMLSelectElement;
    await user.selectOptions(select, "Custom");

    await waitFor(() => {
      expect(screen.getByLabelText("AI Skill (0–1)")).toBeInTheDocument();
      expect(screen.getByLabelText("AI Precision (0–1)")).toBeInTheDocument();
    });
  });

  it("renders Save Changes button", async () => {
    renderDifficultyTab();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });
  });

  it("calls mutateAsync on save with forcedDifficulty", async () => {
    const user = userEvent.setup();
    renderDifficultyTab();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ forcedDifficulty: "Regular" }),
    );
  });

  it("sends Custom forcedDifficulty when Custom is selected", async () => {
    const user = userEvent.setup();
    renderDifficultyTab();

    await waitFor(() => {
      expect(screen.getByLabelText("Forced Difficulty")).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Forced Difficulty") as HTMLSelectElement;
    await user.selectOptions(select, "Custom");

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ forcedDifficulty: "Custom" }),
    );
  });

  it("renders all difficulty flag switches when Custom is selected", async () => {
    const user = userEvent.setup();
    renderDifficultyTab();

    await waitFor(() => {
      expect(screen.getByLabelText("Forced Difficulty")).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Forced Difficulty") as HTMLSelectElement;
    await user.selectOptions(select, "Custom");

    await waitFor(() => {
      expect(screen.getByText("Reduced Damage")).toBeInTheDocument();
      expect(screen.getByText("Stamina Bar")).toBeInTheDocument();
      expect(screen.getByText("Weapon Crosshair")).toBeInTheDocument();
      expect(screen.getByText("Vision Aid")).toBeInTheDocument();
    });
  });
});