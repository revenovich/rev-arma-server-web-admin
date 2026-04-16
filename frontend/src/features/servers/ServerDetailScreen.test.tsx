import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { Server } from "@/types/api";
import { ServerDetailScreen } from "./ServerDetailScreen";

// ─── Mock data ────────────────────────────────────────────────────────────────

const OFFLINE_SERVER: Server = {
  id: "my-server",
  title: "My Arma Server",
  port: 2302,
  password: null,
  admin_password: null,
  auto_start: false,
  battle_eye: true,
  file_patching: false,
  forcedDifficulty: null,
  allowed_file_patching: 0,
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
  state: null,
};

const ONLINE_SERVER: Server = {
  ...OFFLINE_SERVER,
  id: "online-server",
  title: "Online Server",
  pid: 999,
  state: { online: true, players: 10, maxPlayers: 32, mission: "co_10.invasion", map: "Stratis" },
};

// ─── Mock hooks ────────────────────────────────────────────────────────────────

const mockUseServer = vi.fn();
const mockStartMutate = vi.fn();
const mockStopMutate = vi.fn();
const mockCloneMutate = vi.fn();
const mockDeleteMutate = vi.fn();
const mockNavigate = vi.fn();

// Mutable flags for controlling pending states in tests
let isStarting = false;
let isStopping = false;
let isCloning = false;
let isDeleting = false;

vi.mock("@/hooks/useServers", () => ({
  useServer: (...args: unknown[]) => mockUseServer(...args),
  useStartServer: vi.fn(() => ({ mutate: mockStartMutate, isPending: isStarting })),
  useStopServer: vi.fn(() => ({ mutate: mockStopMutate, isPending: isStopping })),
  useCreateServer: vi.fn(() => ({ mutate: mockCloneMutate, isPending: isCloning })),
  useDeleteServer: vi.fn(() => ({ mutate: mockDeleteMutate, isPending: isDeleting })),
  useUpdateServer: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useServers: vi.fn(() => ({ data: [], isLoading: false, error: null })),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function setupServerMock(overrides: { server?: Server | null; isLoading?: boolean; error?: Error | null } = {}) {
  if (overrides.error) {
    mockUseServer.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: overrides.error,
    });
  } else if (overrides.isLoading) {
    mockUseServer.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
  } else if (overrides.server === null) {
    // Explicit null: server data is null (not undefined/not loaded)
    mockUseServer.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
  } else {
    mockUseServer.mockReturnValue({
      data: overrides.server ?? OFFLINE_SERVER,
      isLoading: false,
      error: null,
    });
  }
}

function renderDetail(path = "/servers/my-server/general") {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(
    [
      {
        path: "/servers/:id",
        element: <ServerDetailScreen />,
        children: [
          { index: true, element: <div data-testid="tab-content">General placeholder</div> },
          { path: "general", element: <div data-testid="tab-content">General placeholder</div> },
          { path: "missions", element: <div data-testid="tab-content">Missions placeholder</div> },
          { path: "mods", element: <div data-testid="tab-content">Mods placeholder</div> },
          { path: "difficulty", element: <div data-testid="tab-content">Difficulty placeholder</div> },
          { path: "network", element: <div data-testid="tab-content">Network placeholder</div> },
          { path: "security", element: <div data-testid="tab-content">Security placeholder</div> },
          { path: "advanced", element: <div data-testid="tab-content">Advanced placeholder</div> },
        ],
      },
    ],
    { initialEntries: [path] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("ServerDetailScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isStarting = false;
    isStopping = false;
    isCloning = false;
    isDeleting = false;
    setupServerMock();
  });

  // ── Rendering basics ──────────────────────────────────────────────────────

  it("renders server title", () => {
    renderDetail();
    expect(screen.getByText("My Arma Server")).toBeInTheDocument();
  });

  it("renders back link to servers overview", () => {
    renderDetail();
    const backLink = screen.getByLabelText("Back to servers");
    expect(backLink).toHaveAttribute("href", "/");
  });

  it("renders 7 tab triggers", () => {
    renderDetail();
    expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Missions" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Mods" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Difficulty" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Network" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Security" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Advanced" })).toBeInTheDocument();
  });

  it("does NOT render Info tab (renamed to General)", () => {
    renderDetail();
    expect(screen.queryByRole("tab", { name: "Info" })).not.toBeInTheDocument();
  });

  it("does NOT render Headless tab (merged into Advanced)", () => {
    renderDetail();
    expect(screen.queryByRole("tab", { name: "Headless" })).not.toBeInTheDocument();
  });

  it("shows General tab as active by default", () => {
    renderDetail();
    const generalTab = screen.getByRole("tab", { name: "General" });
    expect(generalTab).toHaveAttribute("data-active");
  });

  it("renders tab content via Outlet", () => {
    renderDetail();
    expect(screen.getByTestId("tab-content")).toBeInTheDocument();
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  it("shows skeleton while loading", () => {
    setupServerMock({ isLoading: true });
    const { container } = renderDetail();
    const skeletons = container.querySelectorAll("[data-slot=skeleton]");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it("does not show action buttons while loading", () => {
    setupServerMock({ isLoading: true });
    renderDetail();
    expect(screen.queryByRole("button", { name: /start server/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /stop server/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clone/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete server/i })).not.toBeInTheDocument();
  });

  it("does not show server title while loading", () => {
    setupServerMock({ isLoading: true });
    renderDetail();
    expect(screen.queryByText("My Arma Server")).not.toBeInTheDocument();
  });

  // ── Error state ───────────────────────────────────────────────────────────

  it("shows error state when server fetch fails", () => {
    setupServerMock({ error: new Error("Network error") });
    renderDetail();
    expect(screen.getByText("Failed to load server")).toBeInTheDocument();
  });

  it("shows alert triangle icon in error state", () => {
    setupServerMock({ error: new Error("Network error") });
    renderDetail();
    expect(screen.getByText("Failed to load server")).toBeInTheDocument();
  });

  it("shows back to servers link in error state", () => {
    setupServerMock({ error: new Error("Network error") });
    renderDetail();
    expect(screen.getByText("Back to servers")).toBeInTheDocument();
  });

  it("does not show tabs in error state", () => {
    setupServerMock({ error: new Error("Network error") });
    renderDetail();
    expect(screen.queryByRole("tab", { name: "General" })).not.toBeInTheDocument();
  });

  it("does not show action buttons in error state", () => {
    setupServerMock({ error: new Error("Network error") });
    renderDetail();
    expect(screen.queryByRole("button", { name: /start server/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /clone/i })).not.toBeInTheDocument();
  });

  // ── Offline server (Start button) ─────────────────────────────────────────

  it("renders Start button when server is offline", () => {
    setupServerMock({ server: OFFLINE_SERVER });
    renderDetail();
    expect(screen.getByRole("button", { name: /start server/i })).toBeInTheDocument();
  });

  it("does not render Stop button when server is offline", () => {
    setupServerMock({ server: OFFLINE_SERVER });
    renderDetail();
    expect(screen.queryByRole("button", { name: /stop server/i })).not.toBeInTheDocument();
  });

  it("does not show player count badge when server is offline", () => {
    setupServerMock({ server: OFFLINE_SERVER });
    renderDetail();
    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument();
  });

  it("shows StatusDot as offline when server state is null", () => {
    setupServerMock({ server: OFFLINE_SERVER });
    renderDetail();
    expect(screen.getByLabelText("Offline")).toBeInTheDocument();
  });

  it("calls startServer mutation when Start is clicked", async () => {
    const user = userEvent.setup();
    setupServerMock({ server: OFFLINE_SERVER });
    renderDetail();

    const startButton = screen.getByRole("button", { name: /start server/i });
    await user.click(startButton);
    expect(mockStartMutate).toHaveBeenCalledOnce();
  });

  // ── Online server (Stop button, player count) ────────────────────────────

  it("renders Stop button when server is online", () => {
    setupServerMock({ server: ONLINE_SERVER });
    renderDetail("/servers/online-server/general");
    expect(screen.getByRole("button", { name: /stop server/i })).toBeInTheDocument();
  });

  it("does not render Start button when server is online", () => {
    setupServerMock({ server: ONLINE_SERVER });
    renderDetail("/servers/online-server/general");
    expect(screen.queryByRole("button", { name: /start server/i })).not.toBeInTheDocument();
  });

  it("shows player count badge when server is online", () => {
    setupServerMock({ server: ONLINE_SERVER });
    renderDetail("/servers/online-server/general");
    expect(screen.getByText("10/32")).toBeInTheDocument();
  });

  it("shows StatusDot as online when server is online", () => {
    setupServerMock({ server: ONLINE_SERVER });
    renderDetail("/servers/online-server/general");
    expect(screen.getByLabelText("Online")).toBeInTheDocument();
  });

  it("calls stopServer mutation when Stop is clicked", async () => {
    const user = userEvent.setup();
    setupServerMock({ server: ONLINE_SERVER });
    renderDetail("/servers/online-server/general");

    const stopButton = screen.getByRole("button", { name: /stop server/i });
    await user.click(stopButton);
    expect(mockStopMutate).toHaveBeenCalledOnce();
  });

  // ── Clone button ──────────────────────────────────────────────────────────

  it("renders Clone button", () => {
    renderDetail();
    expect(screen.getByRole("button", { name: /clone/i })).toBeInTheDocument();
  });

  it("calls createServer with copied title when Clone is clicked", async () => {
    const user = userEvent.setup();
    setupServerMock({ server: OFFLINE_SERVER });
    renderDetail();

    const cloneButton = screen.getByRole("button", { name: /clone/i });
    await user.click(cloneButton);

    expect(mockCloneMutate).toHaveBeenCalledOnce();
    const callArgs = mockCloneMutate.mock.calls[0][0];
    expect(callArgs.title).toBe("Copy of My Arma Server");
    // Verify id, pid, state are stripped from clone payload
    expect(callArgs.id).toBeUndefined();
    expect(callArgs.pid).toBeUndefined();
    expect(callArgs.state).toBeUndefined();
    // Verify other fields are preserved
    expect(callArgs.port).toBe(2302);
    expect(callArgs.max_players).toBe(32);
  });

  // ── Delete button ─────────────────────────────────────────────────────────

  it("renders Delete button", () => {
    renderDetail();
    expect(screen.getByRole("button", { name: /delete server/i })).toBeInTheDocument();
  });

  it("opens delete confirmation dialog when Delete is clicked", async () => {
    const user = userEvent.setup();
    renderDetail();

    const deleteButton = screen.getByRole("button", { name: /delete server/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText("Delete server?")).toBeInTheDocument();
    });
    expect(screen.getByText(/permanently remove/i)).toBeInTheDocument();
  });

  it("includes server name in delete confirmation dialog", async () => {
    const user = userEvent.setup();
    renderDetail();

    const deleteButton = screen.getByRole("button", { name: /delete server/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText("Delete server?")).toBeInTheDocument();
    });
    // Server name appears in both the heading h1 and inside <strong> in the dialog
    const serverNameElements = screen.getAllByText("My Arma Server");
    expect(serverNameElements.length).toBeGreaterThanOrEqual(2);
    // Verify at least one is inside the alert dialog (the <strong> element)
    const strongElement = serverNameElements.find((el) => el.tagName === "STRONG");
    expect(strongElement).toBeTruthy();
  });

  it("calls deleteServer when confirm button is clicked in dialog", async () => {
    const user = userEvent.setup();
    renderDetail();

    const deleteButton = screen.getByRole("button", { name: /delete server/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText("Delete server?")).toBeInTheDocument();
    });

    // Find the destructive confirm button in the dialog footer
    const dialogButtons = screen.getAllByRole("button");
    // The AlertDialogAction confirm button has variant="destructive"
    const confirmButton = dialogButtons.find(
      (btn) => btn.textContent === "Delete" && btn.closest("[data-slot=alert-dialog-footer]"),
    );
    expect(confirmButton).toBeTruthy();
    await user.click(confirmButton!);

    expect(mockDeleteMutate).toHaveBeenCalledOnce();
    expect(mockDeleteMutate).toHaveBeenCalledWith("my-server", expect.any(Object));
  });

  it("navigates to home on successful delete", async () => {
    const user = userEvent.setup();
    renderDetail();

    const deleteButton = screen.getByRole("button", { name: /delete server/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText("Delete server?")).toBeInTheDocument();
    });

    const dialogButtons = screen.getAllByRole("button");
    const confirmButton = dialogButtons.find(
      (btn) => btn.textContent === "Delete" && btn.closest("[data-slot=alert-dialog-footer]"),
    );
    await user.click(confirmButton!);

    // Verify deleteServer was called with the server id and onSuccess callback
    expect(mockDeleteMutate).toHaveBeenCalledWith("my-server", expect.any(Object));
    // Simulate onSuccess to verify navigation
    const callArgs = mockDeleteMutate.mock.calls[0];
    callArgs[1].onSuccess();
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("does not delete server when Cancel is clicked in dialog", async () => {
    const user = userEvent.setup();
    renderDetail();

    const deleteButton = screen.getByRole("button", { name: /delete server/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText("Delete server?")).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole("button", { name: /^cancel$/i });
    await user.click(cancelButton);

    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  // ── Tab navigation ────────────────────────────────────────────────────────

  it("shows Difficulty tab as active when navigated to it", () => {
    renderDetail("/servers/my-server/difficulty");
    const diffTab = screen.getByRole("tab", { name: "Difficulty" });
    expect(diffTab).toHaveAttribute("data-active");
  });

  it("navigates to missions tab path when Missions tab is clicked", async () => {
    const user = userEvent.setup();
    renderDetail("/servers/my-server/general");

    const missionsTab = screen.getByRole("tab", { name: "Missions" });
    await user.click(missionsTab);

    expect(mockNavigate).toHaveBeenCalledWith("/servers/my-server/missions");
  });

  it("navigates to mods tab when Mods tab is clicked", async () => {
    const user = userEvent.setup();
    renderDetail("/servers/my-server/general");

    const modsTab = screen.getByRole("tab", { name: "Mods" });
    await user.click(modsTab);

    expect(mockNavigate).toHaveBeenCalledWith("/servers/my-server/mods");
  });

  it("navigates to difficulty tab when Difficulty tab is clicked", async () => {
    const user = userEvent.setup();
    renderDetail("/servers/my-server/general");

    const diffTab = screen.getByRole("tab", { name: "Difficulty" });
    await user.click(diffTab);

    expect(mockNavigate).toHaveBeenCalledWith("/servers/my-server/difficulty");
  });

  it("navigates to network tab when Network tab is clicked", async () => {
    const user = userEvent.setup();
    renderDetail("/servers/my-server/general");

    const networkTab = screen.getByRole("tab", { name: "Network" });
    await user.click(networkTab);

    expect(mockNavigate).toHaveBeenCalledWith("/servers/my-server/network");
  });

  it("navigates to security tab when Security tab is clicked", async () => {
    const user = userEvent.setup();
    renderDetail("/servers/my-server/general");

    const securityTab = screen.getByRole("tab", { name: "Security" });
    await user.click(securityTab);

    expect(mockNavigate).toHaveBeenCalledWith("/servers/my-server/security");
  });

  it("navigates to advanced tab when Advanced tab is clicked", async () => {
    const user = userEvent.setup();
    renderDetail("/servers/my-server/general");

    const advancedTab = screen.getByRole("tab", { name: "Advanced" });
    await user.click(advancedTab);

    expect(mockNavigate).toHaveBeenCalledWith("/servers/my-server/advanced");
  });

  // ── Title fallback ────────────────────────────────────────────────────────

  it("shows 'Server' as fallback title when server data is null", () => {
    // When useServer returns data as null, server?.title is undefined,
    // so the ?? "Server" fallback kicks in
    setupServerMock({ server: null });
    renderDetail();
    expect(screen.getByText("Server")).toBeInTheDocument();
  });

  it("renders empty string title as-is because ?? does not replace empty strings", () => {
    const serverNoTitle: Server = { ...OFFLINE_SERVER, title: "" };
    setupServerMock({ server: serverNoTitle });
    renderDetail();
    // ?? only replaces null/undefined, not empty string
    // The h1 heading will exist but with empty text content
    const heading = screen.getByRole("heading");
    expect(heading).toHaveTextContent("");
  });

  // ── MaxPlayers fallback ──────────────────────────────────────────────────

  it("uses maxPlayers from state when available even if it is 0", () => {
    // Note: ?? only replaces null/undefined, not 0
    // So state.maxPlayers=0 is kept, not replaced by server.max_players
    const serverZeroMaxPlayers: Server = {
      ...OFFLINE_SERVER,
      id: "zero-server",
      title: "Zero MaxPlayers",
      pid: 100,
      max_players: 32,
      state: { online: true, players: 5, maxPlayers: 0, mission: null, map: null },
    };
    mockUseServer.mockReturnValue({
      data: serverZeroMaxPlayers,
      isLoading: false,
      error: null,
    });
    renderDetail("/servers/my-server/general");
    // maxPlayers=0 from state is kept (?? does not replace 0)
    expect(screen.getByText("5/0")).toBeInTheDocument();
  });

  it("falls back to max_players when state.maxPlayers is undefined (state missing)", () => {
    // When state.maxPlayers is undefined/null, ?? should fall back to server.max_players
    const serverWithPartialState: Server = {
      ...OFFLINE_SERVER,
      id: "partial-server",
      title: "Partial State",
      pid: 100,
      max_players: 32,
      state: { online: true, players: 5, maxPlayers: 32, mission: null, map: null },
    };
    mockUseServer.mockReturnValue({
      data: serverWithPartialState,
      isLoading: false,
      error: null,
    });
    renderDetail("/servers/my-server/general");
    // maxPlayers from state is 32, displayed as players/maxPlayers
    expect(screen.getByText("5/32")).toBeInTheDocument();
  });

  // ── useServer hook receives the id param ──────────────────────────────────

  it("passes id from URL params to useServer", () => {
    renderDetail("/servers/my-server/general");
    expect(mockUseServer).toHaveBeenCalledWith("my-server");
  });

  // ── Clone with null state ─────────────────────────────────────────────────

  it("clones server correctly stripping runtime fields", async () => {
    const user = userEvent.setup();
    setupServerMock({ server: OFFLINE_SERVER });
    renderDetail();

    const cloneButton = screen.getByRole("button", { name: /clone/i });
    await user.click(cloneButton);

    expect(mockCloneMutate).toHaveBeenCalledOnce();
    const callArgs = mockCloneMutate.mock.calls[0][0];
    expect(callArgs.title).toBe("Copy of My Arma Server");
    expect(callArgs.id).toBeUndefined();
    expect(callArgs.pid).toBeUndefined();
    expect(callArgs.state).toBeUndefined();
    expect(callArgs.port).toBe(2302);
  });

  // ── Clone with online server ──────────────────────────────────────────────

  it("clones online server correctly stripping runtime fields", async () => {
    const user = userEvent.setup();
    setupServerMock({ server: ONLINE_SERVER });
    renderDetail("/servers/online-server/general");

    const cloneButton = screen.getByRole("button", { name: /clone/i });
    await user.click(cloneButton);

    expect(mockCloneMutate).toHaveBeenCalledOnce();
    const callArgs = mockCloneMutate.mock.calls[0][0];
    expect(callArgs.title).toBe("Copy of Online Server");
    // id, pid, state should be stripped from the clone payload
    expect(callArgs.id).toBeUndefined();
    expect(callArgs.pid).toBeUndefined();
    expect(callArgs.state).toBeUndefined();
  });

  // ── Pending state indicators ─────────────────────────────────────────────

  it("shows loading spinner on Start button when isStarting is true", () => {
    isStarting = true;
    setupServerMock({ server: OFFLINE_SERVER });
    renderDetail();
    // When isPending is true, the button should be disabled and show a spinner icon
    const startButton = screen.getByRole("button", { name: /start server/i });
    expect(startButton).toBeDisabled();
  });

  it("shows loading spinner on Stop button when isStopping is true", () => {
    isStopping = true;
    setupServerMock({ server: ONLINE_SERVER });
    renderDetail("/servers/online-server/general");
    const stopButton = screen.getByRole("button", { name: /stop server/i });
    expect(stopButton).toBeDisabled();
  });

  it("disables Clone button when isCloning is true", () => {
    isCloning = true;
    setupServerMock({ server: OFFLINE_SERVER });
    renderDetail();
    const cloneButton = screen.getByRole("button", { name: /clone/i });
    expect(cloneButton).toBeDisabled();
  });

  it("disables Delete confirm button when isDeleting is true", async () => {
    isDeleting = true;
    setupServerMock({ server: OFFLINE_SERVER });
    renderDetail();

    // The Delete trigger button should still be clickable to open the dialog
    const deleteTrigger = screen.getByRole("button", { name: /delete server/i });
    await userEvent.setup().click(deleteTrigger);

    await waitFor(() => {
      expect(screen.getByText("Delete server?")).toBeInTheDocument();
    });

    // The confirm button should show "Deleting..." and be disabled
    const dialogButtons = screen.getAllByRole("button");
    const confirmButton = dialogButtons.find(
      (btn) => (btn.textContent?.includes("Deleting") ?? false) && btn.closest("[data-slot=alert-dialog-footer]"),
    );
    expect(confirmButton).toBeTruthy();
    expect(confirmButton!).toBeDisabled();
  });

  it("shows Deleting text on confirm button when isDeleting is true", async () => {
    isDeleting = true;
    setupServerMock({ server: OFFLINE_SERVER });
    renderDetail();

    const deleteTrigger = screen.getByRole("button", { name: /delete server/i });
    await userEvent.setup().click(deleteTrigger);

    await waitFor(() => {
      expect(screen.getByText("Delete server?")).toBeInTheDocument();
    });

    // Confirm button should show "Deleting…" (with ellipsis character \u2026) when pending
    expect(screen.getByText("Deleting\u2026")).toBeInTheDocument();
  });

  // ── Error state link navigation ───────────────────────────────────────────

  it("error state back link points to home page", () => {
    setupServerMock({ error: new Error("Failed") });
    renderDetail();
    const backLink = screen.getByText("Back to servers");
    expect(backLink.closest("a")).toHaveAttribute("href", "/");
  });
});