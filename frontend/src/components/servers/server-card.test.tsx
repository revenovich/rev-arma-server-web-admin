import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ServerCard } from "@/components/servers/ServerCard";
import type { Server } from "@/types/api";

const ONLINE_SERVER: Server = {
  id: "online-server",
  title: "Test Server",
  port: 9520,
  password: null,
  admin_password: null,
  auto_start: false,
  battle_eye: true,
  file_patching: false,
  forcedDifficulty: null,
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
  const router = createMemoryRouter(
    [{ path: "/", element: <ServerCard server={server} /> }],
    { initialEntries: ["/"] },
  );
  return render(<RouterProvider router={router} />);
}

describe("ServerCard", () => {
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
    expect(screen.getByText(":9520")).toBeInTheDocument();
  });

  it("renders mission for online server", () => {
    renderCard(ONLINE_SERVER);
    expect(screen.getByText("co_10.invasion")).toBeInTheDocument();
  });

  it("shows Running for online server", () => {
    renderCard(ONLINE_SERVER);
    expect(screen.getByText("Running")).toBeInTheDocument();
  });

  it("shows Stopped for offline server", () => {
    renderCard(OFFLINE_SERVER);
    expect(screen.getByText("Stopped")).toBeInTheDocument();
  });

  it("shows Persistent badge when server is persistent", () => {
    renderCard(ONLINE_SERVER);
    expect(screen.getByText("Persistent")).toBeInTheDocument();
  });

  it("does not show Persistent badge when not persistent", () => {
    renderCard(OFFLINE_SERVER);
    expect(screen.queryByText("Persistent")).not.toBeInTheDocument();
  });

  it("links to server detail info tab", () => {
    renderCard(ONLINE_SERVER);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/servers/online-server/info");
  });

  it("uses default max_players when state is null", () => {
    renderCard(OFFLINE_SERVER);
    expect(screen.getByText("0/40")).toBeInTheDocument();
  });
});