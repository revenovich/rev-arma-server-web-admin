import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SecurityTab } from "./SecurityTab";
import type { Server } from "@/types/api";

// SecurityTab reads extra fields via (server as unknown as Record<string, unknown>)
// These fields exist on the backend schema but not on the frontend Server type.
const mockServer: Server & Record<string, unknown> = {
  id: "server-1",
  title: "Test Server",
  port: 2302,
  password: null,
  admin_password: null,
  allowed_file_patching: 0,
  auto_start: false,
  battle_eye: true,
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
  kickDuplicate: false,
  serverCommandPassword: "",
  filePatchingExceptions: [],
  allowedLoadFileExtensions: [],
};

const mockUseServer = vi.fn();
const mockMutateAsync = vi.fn();
const mockMutate = vi.fn();

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "server-1" }),
}));

vi.mock("@/hooks/useServers", () => ({
  useServer: () => mockUseServer(),
  useUpdateServer: () => ({
    mutateAsync: mockMutateAsync,
    mutate: mockMutate,
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

function renderSecurityTab(overrides: { server?: Partial<Server & Record<string, unknown>>; isLoading?: boolean } = {}) {
  const queryClient = createTestQueryClient();

  const server = { ...mockServer, ...overrides.server };

  if (overrides.isLoading) {
    mockUseServer.mockReturnValue({ data: undefined, isLoading: true });
  } else {
    mockUseServer.mockReturnValue({ data: server, isLoading: false });
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <SecurityTab />
    </QueryClientProvider>,
  );
}

describe("SecurityTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMutateAsync.mockResolvedValue({});
  });

  it("shows loading skeletons while server data loads", () => {
    const { container } = renderSecurityTab({ isLoading: true });
    const skeletons = container.querySelectorAll("[data-slot=skeleton]");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Verify Signatures dropdown with default value", async () => {
    renderSecurityTab();
    await waitFor(() => {
      expect(screen.getByLabelText("Verify Signatures")).toBeInTheDocument();
    });
    const select = screen.getByLabelText("Verify Signatures") as HTMLSelectElement;
    expect(select.value).toBe("2");
  });

  it("renders Allowed File Patching dropdown with default value", async () => {
    renderSecurityTab();
    await waitFor(() => {
      expect(screen.getByLabelText("Allowed File Patching")).toBeInTheDocument();
    });
    const select = screen.getByLabelText("Allowed File Patching") as HTMLSelectElement;
    expect(select.value).toBe("0");
  });

  it("renders BattlEye switch checked when battle_eye is true", async () => {
    renderSecurityTab();
    await waitFor(() => {
      const switchEl = screen.getByRole("switch", { name: /battlEye/i });
      expect(switchEl).toBeChecked();
    });
  });

  it("renders Kick Duplicate switch unchecked when kickDuplicate is false", async () => {
    renderSecurityTab();
    await waitFor(() => {
      const switchEl = screen.getByRole("switch", { name: /kick duplicate/i });
      expect(switchEl).not.toBeChecked();
    });
  });

  it("renders Enable File Patching switch unchecked when file_patching is false", async () => {
    renderSecurityTab();
    await waitFor(() => {
      const switchEl = screen.getByRole("switch", { name: /enable file patching/i });
      expect(switchEl).not.toBeChecked();
    });
  });

  it("renders Server Command Password input", async () => {
    renderSecurityTab();
    await waitFor(() => {
      expect(screen.getByLabelText(/password for server commands/i)).toBeInTheDocument();
    });
  });

  it("renders section labels", async () => {
    renderSecurityTab();
    await waitFor(() => {
      expect(screen.getByText("Signatures & File Patching")).toBeInTheDocument();
      expect(screen.getByText("Anti-Cheat & Kick")).toBeInTheDocument();
      expect(screen.getByText("Server Command Password")).toBeInTheDocument();
      expect(screen.getByText("File Patching Details")).toBeInTheDocument();
    });
  });

  it("renders Save Changes button", async () => {
    renderSecurityTab();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });
  });

  it("calls mutateAsync with correct payload on Save", async () => {
    const user = userEvent.setup();
    renderSecurityTab();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        verify_signatures: 2,
        allowed_file_patching: 0,
        file_patching: false,
        battle_eye: true,
        kickDuplicate: 0,
        serverCommandPassword: null,
        filePatchingExceptions: [],
        allowedLoadFileExtensions: [],
      }),
    );
  });

  it("toggles BattlEye switch", async () => {
    const user = userEvent.setup();
    renderSecurityTab();

    await waitFor(() => {
      expect(screen.getByRole("switch", { name: /battlEye/i })).toBeInTheDocument();
    });

    const switchEl = screen.getByRole("switch", { name: /battlEye/i });
    expect(switchEl).toBeChecked();

    await user.click(switchEl);
    expect(switchEl).not.toBeChecked();
  });

  it("toggles File Patching switch", async () => {
    const user = userEvent.setup();
    renderSecurityTab();

    await waitFor(() => {
      expect(screen.getByRole("switch", { name: /enable file patching/i })).toBeInTheDocument();
    });

    const switchEl = screen.getByRole("switch", { name: /enable file patching/i });
    expect(switchEl).not.toBeChecked();

    await user.click(switchEl);
    expect(switchEl).toBeChecked();
  });

  it("changes Verify Signatures dropdown", async () => {
    const user = userEvent.setup();
    renderSecurityTab();

    await waitFor(() => {
      expect(screen.getByLabelText("Verify Signatures")).toBeInTheDocument();
    });

    const select = screen.getByLabelText("Verify Signatures") as HTMLSelectElement;
    await user.selectOptions(select, "0");
    expect(select.value).toBe("0");
  });

  it("renders textarea for file patching exceptions", async () => {
    renderSecurityTab();
    await waitFor(() => {
      expect(screen.getByLabelText(/file patching exceptions/i)).toBeInTheDocument();
    });
  });

  it("renders textarea for allowed load file extensions", async () => {
    renderSecurityTab();
    await waitFor(() => {
      expect(screen.getByLabelText(/allowed load file extensions/i)).toBeInTheDocument();
    });
  });

  it("initializes form with server data", async () => {
    renderSecurityTab({
      server: {
        verify_signatures: 1,
        allowed_file_patching: 2,
        file_patching: true,
        battle_eye: false,
        kickDuplicate: true,
        serverCommandPassword: "mypassword",
        filePatchingExceptions: ["@mod1", "@mod2"],
        allowedLoadFileExtensions: [".paa"],
      },
    });

    await waitFor(() => {
      const verifySelect = screen.getByLabelText("Verify Signatures") as HTMLSelectElement;
      expect(verifySelect.value).toBe("1");

      const filePatchingSelect = screen.getByLabelText("Allowed File Patching") as HTMLSelectElement;
      expect(filePatchingSelect.value).toBe("2");

      const filePatchingSwitch = screen.getByRole("switch", { name: /enable file patching/i });
      expect(filePatchingSwitch).toBeChecked();

      const battleEyeSwitch = screen.getByRole("switch", { name: /battlEye/i });
      expect(battleEyeSwitch).not.toBeChecked();
    });
  });
});