import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { routes } from "@/router";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderWithRouter(initialPath = "/") {
  const queryClient = createTestQueryClient();

  // Stub fetch for data-fetching screens
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: string | Request) => {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/servers")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(null) });
    }),
  );

  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return result;
}

function getPageHeading() {
  return screen.getByRole("heading", { level: 1 });
}

describe("Router", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders overview at root path", async () => {
    renderWithRouter("/");
    await waitFor(() => {
      expect(getPageHeading()).toHaveTextContent("Servers");
    });
  });

  it("renders server detail at /servers/:id", async () => {
    renderWithRouter("/servers/test-server");
    // Server detail loads async — wait for the heading to appear
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "Info" })).toBeInTheDocument();
    });
  });

  it("renders mods screen at /mods", () => {
    renderWithRouter("/mods");
    expect(getPageHeading()).toHaveTextContent("Mods");
  });

  it("renders missions screen at /missions", () => {
    renderWithRouter("/missions");
    expect(getPageHeading()).toHaveTextContent("Missions");
  });

  it("renders logs screen at /logs", () => {
    renderWithRouter("/logs");
    expect(getPageHeading()).toHaveTextContent("Logs");
  });

  it("renders settings screen at /settings", () => {
    renderWithRouter("/settings");
    expect(getPageHeading()).toHaveTextContent("Settings");
  });

  it("renders steamcmd screen at /steamcmd", () => {
    renderWithRouter("/steamcmd");
    expect(getPageHeading()).toHaveTextContent("SteamCMD");
  });

  it("renders presets screen at /presets", () => {
    renderWithRouter("/presets");
    expect(getPageHeading()).toHaveTextContent("Presets");
  });

  it("renders preset detail at /presets/:id", () => {
    renderWithRouter("/presets/my-preset");
    expect(getPageHeading()).toHaveTextContent("Preset Detail");
  });

  it("navigates from root to mods via sidebar", async () => {
    const user = userEvent.setup();
    renderWithRouter("/");
    await user.click(screen.getByRole("link", { name: /mods/i }));
    expect(getPageHeading()).toHaveTextContent("Mods");
  });
});