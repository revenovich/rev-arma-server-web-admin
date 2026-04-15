import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockServer, mockWebSocket } from "./helpers/api-mocks";

test.describe("Overview Screen — server list", () => {
  test.beforeEach(async ({ page }) => {
    await mockWebSocket(page);
  });

  test("renders server cards from API", async ({ page }) => {
    await mockApiRoutes(page, { servers: [mockServer] });
    await page.goto("/");

    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: "Servers" })).toBeVisible();
    await expect(main.getByText("My Arma Server")).toBeVisible();
    // Port badge
    await expect(main.getByText(":2302")).toBeVisible();
  });

  test("renders multiple server cards", async ({ page }) => {
    const servers = [
      { ...mockServer, id: "s1", title: "Alpha Server", port: 2302 },
      { ...mockServer, id: "s2", title: "Bravo Server", port: 2312 },
    ];
    await mockApiRoutes(page, { servers });
    await page.goto("/");

    const main = page.locator("main");
    await expect(main.getByText("Alpha Server")).toBeVisible();
    await expect(main.getByText("Bravo Server")).toBeVisible();
  });

  test("shows empty state when no servers", async ({ page }) => {
    await mockApiRoutes(page, { servers: [] });
    await page.goto("/");

    const main = page.locator("main");
    await expect(main.getByText("No servers yet")).toBeVisible();
    await expect(main.getByText("Add your first Arma server")).toBeVisible();
    // Two "Add Server" buttons render when empty (header + empty-state CTA)
    await expect(main.getByRole("button", { name: "Add Server" }).first()).toBeVisible();
  });

  test("shows Add Server button when servers exist", async ({ page }) => {
    await mockApiRoutes(page, { servers: [mockServer] });
    await page.goto("/");

    // Topbar or main header contains the Add Server button
    await expect(page.getByRole("button", { name: "Add Server" }).first()).toBeVisible();
  });

  test("navigates to server detail on card click", async ({ page }) => {
    await mockApiRoutes(page, { servers: [mockServer] });
    await page.goto("/");

    // Click the server card link (in main content, not sidebar)
    await page.locator("main").getByText("My Arma Server").click();
    await expect(page).toHaveURL(`/servers/${mockServer.id}/info`);
  });

  test("shows error state when API fails", async ({ page }) => {
    // Override with error after setting up other mocks
    await mockApiRoutes(page, { servers: [] });
    await page.route("/api/servers", (route) => {
      return route.fulfill({ status: 500, json: { detail: "Internal Server Error" } });
    });
    await page.goto("/");

    await expect(page.getByText(/failed to load servers/i)).toBeVisible();
  });

  test("shows online status when server has state", async ({ page }) => {
    const onlineServer = {
      ...mockServer,
      state: { online: true, players: 12, maxPlayers: 64, mission: "altis_life", map: "Altis" },
      pid: 9999,
    };
    await mockApiRoutes(page, { servers: [onlineServer] });
    await page.goto("/");

    const main = page.locator("main");
    // Player count
    await expect(main.getByText("12/64")).toBeVisible();
    // Running status
    await expect(main.getByText("Running")).toBeVisible();
  });
});
