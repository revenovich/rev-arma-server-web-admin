import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { Server } from "@/types/api";
import { ServerDetailScreen } from "./ServerDetailScreen";

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

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: string | Request) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/servers/my-server")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(MOCK_SERVER),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
    }),
  );

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
    vi.restoreAllMocks();
  });

  it("renders server title after loading", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText("My Arma Server")).toBeInTheDocument();
    });
  });

  it("renders all tab triggers", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Info" })).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: "Missions" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Mods" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Difficulty" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Network" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Security" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Advanced" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Headless" })).toBeInTheDocument();
  });

  it("renders back link to servers overview", async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByLabelText("Back to servers")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Back to servers")).toHaveAttribute("href", "/");
  });

  it("shows Info tab as active by default", async () => {
    renderDetail();
    await waitFor(() => {
      const infoTab = screen.getByRole("tab", { name: "Info" });
      expect(infoTab).toHaveAttribute("data-active");
    });
  });

  it("shows Difficulty tab as active when navigated to it", async () => {
    renderDetail("/servers/my-server/difficulty");
    await waitFor(() => {
      const diffTab = screen.getByRole("tab", { name: "Difficulty" });
      expect(diffTab).toHaveAttribute("data-active");
    });
  });
});