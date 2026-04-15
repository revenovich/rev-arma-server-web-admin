import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { Server } from "@/types/api";
import { ServerDetailScreen } from "./ServerDetailScreen";

const mockStartMutate = vi.fn();
const mockStopMutate = vi.fn();
const mockCloneMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock("@/hooks/useServers", () => ({
  useServer: vi.fn((id: string) => ({
    data: id === "online-server" ? ONLINE_SERVER : MOCK_SERVER,
    isLoading: false,
    error: null,
  })),
  useStartServer: vi.fn(() => ({ mutate: mockStartMutate, isPending: false })),
  useStopServer: vi.fn(() => ({ mutate: mockStopMutate, isPending: false })),
  useCreateServer: vi.fn(() => ({ mutate: mockCloneMutate, isPending: false })),
  useDeleteServer: vi.fn(() => ({ mutate: mockDeleteMutate, isPending: false })),
}));

const MOCK_SERVER: Server = {
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
  ...MOCK_SERVER,
  id: "online-server",
  title: "Online Server",
  pid: 999,
  state: { online: true, players: 10, maxPlayers: 32, mission: "co_10.invasion", map: "Stratis" },
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderDetail(path = "/servers/my-server/info") {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(
    [
      {
        path: "/servers/:id",
        element: <ServerDetailScreen />,
        children: [
          { index: true, element: <div data-testid="tab-content">Info placeholder</div> },
          { path: "info", element: <div data-testid="tab-content">Info placeholder</div> },
          { path: "missions", element: <div data-testid="tab-content">Missions placeholder</div> },
          { path: "mods", element: <div data-testid="tab-content">Mods placeholder</div> },
          { path: "difficulty", element: <div data-testid="tab-content">Difficulty placeholder</div> },
          { path: "network", element: <div data-testid="tab-content">Network placeholder</div> },
          { path: "security", element: <div data-testid="tab-content">Security placeholder</div> },
          { path: "advanced", element: <div data-testid="tab-content">Advanced placeholder</div> },
          { path: "headless", element: <div data-testid="tab-content">Headless placeholder</div> },
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

describe("ServerDetailScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders server title", () => {
    renderDetail();
    expect(screen.getByText("My Arma Server")).toBeInTheDocument();
  });

  it("renders all tab triggers", () => {
    renderDetail();
    expect(screen.getByRole("tab", { name: "Info" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Missions" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Mods" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Difficulty" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Network" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Security" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Advanced" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Headless" })).toBeInTheDocument();
  });

  it("renders back link to servers overview", () => {
    renderDetail();
    expect(screen.getByLabelText("Back to servers")).toHaveAttribute("href", "/");
  });

  it("shows Info tab as active by default", () => {
    renderDetail();
    const infoTab = screen.getByRole("tab", { name: "Info" });
    expect(infoTab).toHaveAttribute("data-active");
  });

  it("shows Difficulty tab as active when navigated to it", () => {
    renderDetail("/servers/my-server/difficulty");
    const diffTab = screen.getByRole("tab", { name: "Difficulty" });
    expect(diffTab).toHaveAttribute("data-active");
  });

  // ── NEW: header controls ─────────────────────────────────────────────────

  it("renders Start button when server is offline", () => {
    renderDetail("/servers/my-server/info");
    expect(screen.getByRole("button", { name: /start server/i })).toBeInTheDocument();
  });

  it("renders Stop button when server is online", () => {
    renderDetail("/servers/online-server/info");
    expect(screen.getByRole("button", { name: /stop server/i })).toBeInTheDocument();
  });

  it("renders Clone button", () => {
    renderDetail();
    expect(screen.getByRole("button", { name: /clone/i })).toBeInTheDocument();
  });

  it("renders Delete button", () => {
    renderDetail();
    expect(screen.getByRole("button", { name: /delete server/i })).toBeInTheDocument();
  });

  it("shows player count in header", () => {
    renderDetail("/servers/online-server/info");
    expect(screen.getByText("10/32")).toBeInTheDocument();
  });
});
