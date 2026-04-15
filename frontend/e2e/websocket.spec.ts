import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockServer, mockWebSocket } from "./helpers/api-mocks";

test.describe("WebSocket live updates", () => {
  test("server_state event updates player count on overview", async ({ page }) => {
    const wsMock = await mockWebSocket(page);
    await mockApiRoutes(page, { servers: [mockServer] });
    await page.goto("/");

    const main = page.locator("main");
    // Initially 0 players
    await expect(main.getByText("0/64")).toBeVisible();

    // Push a server_state update
    wsMock.send({
      type: "server_state",
      serverId: "server-1",
      payload: { online: true, players: 8, maxPlayers: 64, mission: "altis_life", map: "Altis" },
    });

    // Player count should update to 8/64
    await expect(main.getByText("8/64")).toBeVisible();
  });

  test("server_state online=true shows Running status", async ({ page }) => {
    const wsMock = await mockWebSocket(page);
    await mockApiRoutes(page, { servers: [mockServer] });
    await page.goto("/");

    const main = page.locator("main");
    await expect(main.getByText("Stopped")).toBeVisible();

    wsMock.send({
      type: "server_state",
      serverId: "server-1",
      payload: { online: true, players: 3, maxPlayers: 64, mission: null, map: null },
    });

    await expect(main.getByText("Running")).toBeVisible();
  });

  test("server_state online=false shows Stopped status", async ({ page }) => {
    const wsMock = await mockWebSocket(page);

    // Start with an online server
    const onlineServer = {
      ...mockServer,
      state: { online: true, players: 5, maxPlayers: 64, mission: null, map: null },
      pid: 9999,
    };
    await mockApiRoutes(page, { servers: [onlineServer] });
    await page.goto("/");

    const main = page.locator("main");
    await expect(main.getByText("Running")).toBeVisible();

    // Push offline state
    wsMock.send({
      type: "server_state",
      serverId: "server-1",
      payload: { online: false, players: 0, maxPlayers: 64, mission: null, map: null },
    });

    await expect(main.getByText("Stopped")).toBeVisible();
  });

  test("servers event replaces the full server list in cache", async ({ page }) => {
    const wsMock = await mockWebSocket(page);
    await mockApiRoutes(page, { servers: [mockServer] });
    await page.goto("/");

    const main = page.locator("main");
    await expect(main.getByText("My Arma Server")).toBeVisible();

    // Push a full servers update with new title
    wsMock.send({
      type: "servers",
      serverId: null,
      payload: [{ ...mockServer, title: "Updated Via WS" }],
    });

    await expect(main.getByText("Updated Via WS")).toBeVisible();
    await expect(main.getByText("My Arma Server")).not.toBeVisible();
  });

  test("app connects to WebSocket on load", async ({ page }) => {
    let wsConnected = false;

    await page.routeWebSocket("**/ws", (ws) => {
      wsConnected = true;
      ws.onMessage(() => {});
    });

    await mockApiRoutes(page);
    await page.goto("/");

    // Wait for WS to connect
    await page.waitForTimeout(500);
    expect(wsConnected).toBe(true);
  });

  test("sidebar shows live status dots for online servers", async ({ page }) => {
    const wsMock = await mockWebSocket(page);
    await mockApiRoutes(page, { servers: [mockServer] });
    await page.goto("/");

    // Initially offline — at least one Offline dot exists
    await expect(page.getByLabel("Offline").first()).toBeVisible();

    // Push online state
    wsMock.send({
      type: "server_state",
      serverId: "server-1",
      payload: { online: true, players: 1, maxPlayers: 64, mission: null, map: null },
    });

    // After update, Online dot should appear
    await expect(page.getByLabel("Online").first()).toBeVisible();
  });
});
