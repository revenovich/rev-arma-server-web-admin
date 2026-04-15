import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { Server } from "@/types/api";
import { OverviewScreen } from "./OverviewScreen";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

const MOCK_SERVERS: Server[] = [
  {
    id: "test-server-1",
    title: "Operation Arrowhead",
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
    pid: 1234,
    state: { online: true, players: 12, maxPlayers: 32, mission: "co_10.koth", map: "Altis" },
  },
  {
    id: "test-server-2",
    title: "PvP Warfare",
    port: 2304,
    password: "secret",
    admin_password: "admin",
    auto_start: true,
    battle_eye: true,
    file_patching: false,
    forcedDifficulty: "Regular",
    allowed_file_patching: 0,
    max_players: 64,
    missions: [],
    mods: ["@cba_a3", "@ace"],
    motd: "Welcome!",
    number_of_headless_clients: 2,
    parameters: [],
    persistent: true,
    von: true,
    verify_signatures: 2,
    additionalConfigurationOptions: null,
    pid: null,
    state: null,
  },
];

function renderOverview(mocks: { servers?: Server[]; error?: boolean } = {}) {
  const queryClient = createTestQueryClient();

  const fetchMock = vi.fn().mockImplementation((input: string | Request) => {
    const url = typeof input === "string" ? input : input.url;
    if (url.includes("/api/servers")) {
      if (mocks.error) {
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          json: () => Promise.resolve({ detail: "fail" }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mocks.servers ?? MOCK_SERVERS),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
  });

  vi.stubGlobal("fetch", fetchMock);

  const router = createMemoryRouter(
    [{ path: "/", element: <OverviewScreen /> }],
    { initialEntries: ["/"] },
  );

  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  return { ...result, fetchMock, queryClient };
}

describe("OverviewScreen", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders server cards after loading", async () => {
    renderOverview();

    await waitFor(() => {
      expect(screen.getByText("Operation Arrowhead")).toBeInTheDocument();
    });

    expect(screen.getByText("PvP Warfare")).toBeInTheDocument();
  });

  it("shows player count for online servers", async () => {
    renderOverview();

    await waitFor(() => {
      expect(screen.getByText("12/32")).toBeInTheDocument();
    });
  });

  it("shows port badge on each card", async () => {
    renderOverview();

    await waitFor(() => {
      expect(screen.getByText(":2302")).toBeInTheDocument();
    });
    expect(screen.getByText(":2304")).toBeInTheDocument();
  });

  it("shows mission name for online servers", async () => {
    renderOverview();

    await waitFor(() => {
      expect(screen.getByText("co_10.koth")).toBeInTheDocument();
    });
  });

  it("shows Running for online servers and Stopped for offline", async () => {
    renderOverview();

    await waitFor(() => {
      expect(screen.getByText("Running")).toBeInTheDocument();
    });
    expect(screen.getByText("Stopped")).toBeInTheDocument();
  });

  it("shows Persistent badge for persistent servers", async () => {
    renderOverview();

    await waitFor(() => {
      expect(screen.getByText("Persistent")).toBeInTheDocument();
    });
  });

  it("shows empty state when no servers exist", async () => {
    renderOverview({ servers: [] });

    await waitFor(() => {
      expect(screen.getByText("No servers yet")).toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    renderOverview({ error: true });

    await waitFor(() => {
      expect(screen.getByText("Failed to load servers")).toBeInTheDocument();
    });
  });

  it("navigates to server detail on card click", async () => {
    renderOverview();

    await waitFor(() => {
      expect(screen.getByText("Operation Arrowhead")).toBeInTheDocument();
    });

    const link = screen.getByRole("link", { name: /operation arrowhead/i });
    expect(link).toHaveAttribute("href", "/servers/test-server-1/info");
  });
});