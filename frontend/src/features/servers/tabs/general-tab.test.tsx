import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { Server } from "@/types/api";
import { GeneralTab } from "./GeneralTab";

const MOCK_SERVER: Server = {
  id: "test-server",
  title: "My Arma Server",
  port: 2302,
  password: "playerpass",
  admin_password: "adminpass",
  auto_start: true,
  battle_eye: true,
  file_patching: false,
  forcedDifficulty: null,
  allowed_file_patching: 0,
  max_players: 40,
  missions: [],
  mods: [],
  motd: "Welcome to the server",
  number_of_headless_clients: 0,
  parameters: [],
  persistent: true,
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

function renderGeneralTab(overrides: { server?: Partial<Server> } = {}) {
  const queryClient = createTestQueryClient();
  const server = { ...MOCK_SERVER, ...overrides.server };

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: string | Request) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/servers/test-server") && !url.includes("/config")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(server),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
    }),
  );

  const router = createMemoryRouter(
    [{ path: "/servers/:id", element: <GeneralTab /> }],
    { initialEntries: ["/servers/test-server"] },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("GeneralTab", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Identity and Passwords sections", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByText("Identity")).toBeInTheDocument();
    });
    expect(screen.getByText("Passwords")).toBeInTheDocument();
  });

  it("populates form with server data", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByLabelText("Server Name *")).toHaveValue("My Arma Server");
    });
    expect(screen.getByLabelText("Port")).toHaveValue(2302);
    expect(screen.getByLabelText("Max Players")).toHaveValue(40);
  });

  it("shows password fields", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByLabelText("Player Password")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Admin Password")).toBeInTheDocument();
  });

  it("renders Persistent, VON, and Auto Start switches", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByRole("switch", { name: "Persistent" })).toBeInTheDocument();
    });
    expect(screen.getByRole("switch", { name: "Voice Over Network" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Auto Start" })).toBeInTheDocument();
  });

  it("does NOT render BattlEye switch (moved to Security tab)", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByText("Identity")).toBeInTheDocument();
    });
    expect(screen.queryByRole("switch", { name: /battl/i })).not.toBeInTheDocument();
  });

  it("does NOT render Verify Signatures input (moved to Security tab)", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByText("Identity")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/verify.*signatures/i)).not.toBeInTheDocument();
  });

  it("does NOT render File Patching switch (moved to Security tab)", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByText("Identity")).toBeInTheDocument();
    });
    expect(screen.queryByRole("switch", { name: /file patching/i })).not.toBeInTheDocument();
  });

  it("does NOT render MOTD input (moved to Advanced tab)", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByText("Identity")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/message of the day/i)).not.toBeInTheDocument();
  });

  it("disables Save Changes when form is not dirty", async () => {
    renderGeneralTab();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
    });
  });

  it("shows validation error when title is cleared", async () => {
    const user = userEvent.setup();
    renderGeneralTab();

    await waitFor(() => {
      expect(screen.getByLabelText("Server Name *")).toHaveValue("My Arma Server");
    });

    const titleInput = screen.getByLabelText("Server Name *");
    await user.clear(titleInput);
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText("Server name is required")).toBeInTheDocument();
    });
  });
});