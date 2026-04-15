import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockServer, mockWebSocket } from "./helpers/api-mocks";

test.beforeEach(async ({ page }) => {
  await mockWebSocket(page);
  await mockApiRoutes(page);
});

// ── Tab navigation ────────────────────────────────────────────────────────────

test.describe("Server Detail — tab navigation", () => {
  test("renders server title and all tabs", async ({ page }) => {
    await page.goto("/servers/server-1/info");

    await expect(page.getByRole("heading", { name: "My Arma Server" })).toBeVisible();

    const tabs = ["Info", "Missions", "Mods", "Difficulty", "Network", "Security", "Advanced", "Headless"];
    for (const tab of tabs) {
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }
  });

  test("clicking a tab updates the URL", async ({ page }) => {
    await page.goto("/servers/server-1/info");

    await page.getByRole("tab", { name: "Difficulty" }).click();
    await expect(page).toHaveURL("/servers/server-1/difficulty");

    await page.getByRole("tab", { name: "Network" }).click();
    await expect(page).toHaveURL("/servers/server-1/network");

    await page.getByRole("tab", { name: "Security" }).click();
    await expect(page).toHaveURL("/servers/server-1/security");
  });

  test("back arrow navigates to overview", async ({ page }) => {
    await page.goto("/servers/server-1/info");
    await page.getByRole("link", { name: "Back to servers" }).click();
    await expect(page).toHaveURL("/");
  });

  test("shows error state when server not found", async ({ page }) => {
    await page.route("/api/servers/bad-id", (route) =>
      route.fulfill({ status: 404, json: { detail: "Not found" } }),
    );
    await page.goto("/servers/bad-id/info");
    await expect(page.getByText(/failed to load server/i)).toBeVisible();
  });
});

// ── Info tab form ─────────────────────────────────────────────────────────────

test.describe("Server Detail — Info tab form", () => {
  test("populates form fields from server data", async ({ page }) => {
    await page.goto("/servers/server-1/info");

    await expect(page.getByLabel(/server name/i)).toHaveValue("My Arma Server");
    await expect(page.getByLabel(/port/i)).toHaveValue("9520");
    await expect(page.getByLabel(/max players/i)).toHaveValue("64");
  });

  test("saves form changes and shows success toast", async ({ page }) => {
    let savedPayload: Record<string, unknown> | null = null;
    await page.route("/api/servers/server-1", (route) => {
      if (route.request().method() === "PUT") {
        savedPayload = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
        return route.fulfill({ json: { ...mockServer, ...savedPayload } });
      }
      return route.fulfill({ json: mockServer });
    });

    await page.goto("/servers/server-1/info");

    const titleInput = page.getByLabel(/server name/i);
    await titleInput.clear();
    await titleInput.fill("Updated Server Name");

    await page.getByRole("button", { name: /save/i }).click();

    // Toast confirmation
    await expect(page.getByText("Server updated")).toBeVisible();
    expect(savedPayload?.title).toBe("Updated Server Name");
  });

  test("shows validation error for empty server name", async ({ page }) => {
    await page.goto("/servers/server-1/info");

    const titleInput = page.getByLabel(/server name/i);
    await titleInput.clear();
    await titleInput.blur();

    await expect(page.getByText(/server name is required/i)).toBeVisible();
  });
});

// ── Difficulty tab ────────────────────────────────────────────────────────────

test.describe("Server Detail — Difficulty tab", () => {
  test("shows difficulty preset selector", async ({ page }) => {
    await page.goto("/servers/server-1/difficulty");
    await expect(page.getByLabel(/forced difficulty/i)).toBeVisible();
    await expect(page.getByRole("option", { name: "Regular" })).toBeAttached();
    await expect(page.getByRole("option", { name: "Custom" })).toBeAttached();
  });

  test("Custom preset reveals difficulty flags", async ({ page }) => {
    await page.goto("/servers/server-1/difficulty");

    // Flags should NOT be visible initially (Regular preset)
    await expect(page.getByText("Difficulty Flags")).not.toBeVisible();

    // Select Custom
    await page.selectOption("#difficulty-select", "Custom");

    // Flags section should now appear
    await expect(page.getByText("Difficulty Flags")).toBeVisible();
    await expect(page.getByRole("switch", { name: /reduced damage/i })).toBeVisible();
    await expect(page.getByRole("switch", { name: /stamina bar/i })).toBeVisible();
    await expect(page.getByRole("switch", { name: /weapon crosshair/i })).toBeVisible();
  });

  test("toggling a difficulty flag updates its state", async ({ page }) => {
    await page.goto("/servers/server-1/difficulty");
    await page.selectOption("#difficulty-select", "Custom");

    const reducedDamageSwitch = page.getByRole("switch", { name: /reduced damage/i });
    await expect(reducedDamageSwitch).toBeVisible();

    // Initially unchecked
    await expect(reducedDamageSwitch).not.toBeChecked();
    await reducedDamageSwitch.click();
    await expect(reducedDamageSwitch).toBeChecked();

    // Toggle back
    await reducedDamageSwitch.click();
    await expect(reducedDamageSwitch).not.toBeChecked();
  });

  test("Custom preset shows AI skill inputs", async ({ page }) => {
    await page.goto("/servers/server-1/difficulty");
    await page.selectOption("#difficulty-select", "Custom");

    await expect(page.getByLabel(/ai skill/i)).toBeVisible();
    await expect(page.getByLabel(/ai precision/i)).toBeVisible();
  });

  test("switching back from Custom hides flags", async ({ page }) => {
    await page.goto("/servers/server-1/difficulty");
    await page.selectOption("#difficulty-select", "Custom");
    await expect(page.getByText("Difficulty Flags")).toBeVisible();

    await page.selectOption("#difficulty-select", "Veteran");
    await expect(page.getByText("Difficulty Flags")).not.toBeVisible();
  });

  test("saves difficulty preset", async ({ page }) => {
    let savedDifficulty: string | null = null;
    await page.route("/api/servers/server-1", (route) => {
      if (route.request().method() === "PUT") {
        const body = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
        savedDifficulty = body.forcedDifficulty as string;
        return route.fulfill({ json: { ...mockServer, ...body } });
      }
      return route.fulfill({ json: mockServer });
    });

    await page.goto("/servers/server-1/difficulty");
    await page.selectOption("#difficulty-select", "Veteran");
    await page.getByRole("button", { name: /save changes/i }).click();

    await expect(page.getByText("Server updated")).toBeVisible();
    expect(savedDifficulty).toBe("Veteran");
  });
});

// ── Network tab ───────────────────────────────────────────────────────────────

test.describe("Server Detail — Network tab", () => {
  test("renders bandwidth preset buttons", async ({ page }) => {
    await page.goto("/servers/server-1/network");

    await expect(page.getByRole("button", { name: "Home 1Mbps" })).toBeVisible();
    await expect(page.getByRole("button", { name: "VPS 10Mbps" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Dedicated 100Mbps" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Unlimited" })).toBeVisible();
  });

  test("applying a bandwidth preset updates form fields", async ({ page }) => {
    await page.goto("/servers/server-1/network");

    // Apply VPS preset
    await page.getByRole("button", { name: "VPS 10Mbps" }).click();

    // MaxMsgSend should update to 512
    const maxMsgInput = page.getByLabel(/max messages sent/i);
    await expect(maxMsgInput).toHaveValue("512");

    // MinBandwidth should update
    const minBwInput = page.getByLabel(/min bandwidth/i);
    await expect(minBwInput).toHaveValue("1310720");
  });

  test("applying Unlimited preset sets MaxMsgSend to 4096", async ({ page }) => {
    await page.goto("/servers/server-1/network");

    await page.getByRole("button", { name: "Unlimited" }).click();

    const maxMsgInput = page.getByLabel(/max messages sent/i);
    await expect(maxMsgInput).toHaveValue("4096");
  });

  test("saves network settings and shows success toast", async ({ page }) => {
    await page.goto("/servers/server-1/network");
    await page.getByRole("button", { name: "VPS 10Mbps" }).click();
    await page.getByRole("button", { name: /save changes/i }).click();

    await expect(page.getByText("Server updated")).toBeVisible();
  });

  test("manual field edits are reflected in form", async ({ page }) => {
    await page.goto("/servers/server-1/network");

    const maxPingInput = page.getByLabel(/max ping kick/i);
    await maxPingInput.fill("150");
    await expect(maxPingInput).toHaveValue("150");
  });
});
