import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ServerCard } from "@/components/servers/ServerCard";
import type { Server } from "@/types/api";

const mockStartMutate = vi.fn();
const mockStopMutate = vi.fn();
const mockCloneMutate = vi.fn();

vi.mock("@/hooks/useServers", () => ({
  useStartServer: vi.fn(() => ({ mutate: mockStartMutate, isPending: false })),
  useStopServer: vi.fn(() => ({ mutate: mockStopMutate, isPending: false })),
  useCreateServer: vi.fn(() => ({ mutate: mockCloneMutate, isPending: false })),
}));

const ONLINE_SERVER: Server = {
  id: "online-server",
  title: "Test Server",
  port: 2302,
  password: null,
  admin_password: null,
  auto_start: false,
  battle_eye: true,
  file_patching: false,
  forcedDifficulty: null,
  allowed_file_patching: 0,
  max_players: 40,
  missions: [],
  mods: [],
  motd: null,
  number_of_headless_clients: 0,
  parameters: [],
  persistent: true,
  von: true,
  verify_signatures: 2,
  additionalConfigurationOptions: null,
  pid: 999,
  state: { online: true, players: 25, maxPlayers: 40, mission: "co_10.invasion", map: "Stratis" },
};

const OFFLINE_SERVER: Server = {
  ...ONLINE_SERVER,
  id: "offline-server",
  title: "Offline Server",
  persistent: false,
  pid: null,
  state: null,
};

function renderCard(server: Server) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: "/", element: <ServerCard server={server} /> }],
    { initialEntries: ["/"] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("ServerCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders server title", () => {
    renderCard(ONLINE_SERVER);
    expect(screen.getByText("Test Server")).toBeInTheDocument();
  });

  it("renders player count", () => {
    renderCard(ONLINE_SERVER);
    expect(screen.getByText("25/40")).toBeInTheDocument();
  });

  it("renders port badge", () => {
    renderCard(ONLINE_SERVER);
    expect(screen.getByText(":2302")).toBeInTheDocument();
  });

  it("renders mission for online server", () => {
    renderCard(ONLINE_SERVER);
    expect(screen.getByText("co_10.invasion")).toBeInTheDocument();
  });

  it("shows Persistent badge when server is persistent", () => {
    renderCard(ONLINE_SERVER);
    expect(screen.getByText("Persistent")).toBeInTheDocument();
  });

  it("does not show Persistent badge when not persistent", () => {
    renderCard(OFFLINE_SERVER);
    expect(screen.queryByText("Persistent")).not.toBeInTheDocument();
  });

  it("title area links to server detail info tab", () => {
    renderCard(ONLINE_SERVER);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/servers/online-server/info");
  });

  it("uses default max_players when state is null", () => {
    renderCard(OFFLINE_SERVER);
    expect(screen.getByText("0/40")).toBeInTheDocument();
  });

  // ── NEW: action buttons ──────────────────────────────────────────────────

  it("renders a Stop button when server is online", () => {
    renderCard(ONLINE_SERVER);
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });

  it("renders a Start button when server is offline", () => {
    renderCard(OFFLINE_SERVER);
    expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
  });

  it("renders a Clone button on every card", () => {
    renderCard(ONLINE_SERVER);
    expect(screen.getByRole("button", { name: /clone/i })).toBeInTheDocument();
  });

  it("Stop button calls stopServer mutate", () => {
    renderCard(ONLINE_SERVER);
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(mockStopMutate).toHaveBeenCalledTimes(1);
  });

  it("Start button calls startServer mutate", () => {
    renderCard(OFFLINE_SERVER);
    fireEvent.click(screen.getByRole("button", { name: /start/i }));
    expect(mockStartMutate).toHaveBeenCalledTimes(1);
  });

  it("Clone button calls createServer mutate with Copy of title", () => {
    renderCard(ONLINE_SERVER);
    fireEvent.click(screen.getByRole("button", { name: /clone/i }));
    expect(mockCloneMutate).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Copy of Test Server" }),
    );
  });

  it("action buttons do not navigate (are not links)", () => {
    renderCard(ONLINE_SERVER);
    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn.tagName).toBe("BUTTON");
    }
  });
});
