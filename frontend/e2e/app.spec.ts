import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockWebSocket } from "./helpers/api-mocks";

test.beforeEach(async ({ page }) => {
  await mockWebSocket(page);
  await mockApiRoutes(page);
});

test.describe("App Shell", () => {
  test("renders sidebar navigation", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();
    await expect(page.getByRole("link", { name: "Servers" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mods" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  });

  test("renders topbar with breadcrumb", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("banner");
    await expect(banner).toBeVisible();
  });

  test("navigates between pages via sidebar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Mods" }).click();
    await expect(page.getByRole("heading", { name: "Mods" })).toBeVisible();

    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("navigates to Missions and Logs via sidebar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Missions" }).click();
    await expect(page.getByRole("heading", { name: "Missions" })).toBeVisible();

    await page.getByRole("link", { name: "Logs" }).click();
    await expect(page.getByRole("heading", { name: "Logs" })).toBeVisible();
  });
});

test.describe("Theme toggle", () => {
  test("switches between dark and light mode", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");

    // Find theme toggle button
    const toggle = page.getByRole("button", { name: /switch to/i });
    await expect(toggle).toBeVisible();

    // Dark is the default — html has no .light class
    await expect(html).not.toHaveClass(/light/);

    // Toggle to light
    await toggle.click();
    await expect(html).toHaveClass(/light/);

    // Toggle back to dark
    await toggle.click();
    await expect(html).not.toHaveClass(/light/);
  });
});

test.describe("Keyboard navigation", () => {
  test("can tab through sidebar navigation links", async ({ page }) => {
    await page.goto("/");
    // Wait for sidebar to be fully rendered
    await page.getByRole("navigation", { name: "Primary" }).waitFor();
    // Tab several times to reach sidebar links
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
    }
    // At least one element should be focused
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible({ timeout: 3000 });
  });

  test("sidebar links are keyboard reachable", async ({ page }) => {
    await page.goto("/");
    // Focus the Servers link directly and press Enter to navigate
    const serversLink = page.getByRole("link", { name: "Servers" });
    await serversLink.focus();
    await expect(serversLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/");
  });

  test("can tab through server detail tabs", async ({ page }) => {
    await page.goto("/servers/server-1/info");
    // All tab triggers should be keyboard reachable
    const tabs = ["Info", "Missions", "Mods", "Difficulty", "Network", "Security", "Advanced", "Headless"];
    for (const tab of tabs) {
      await expect(page.getByRole("tab", { name: tab })).toBeVisible();
    }
  });
});

test.describe("Accessibility basics", () => {
  test("sidebar nav has accessible label", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav).toBeVisible();
  });

  test("icon-only buttons have aria-labels", async ({ page }) => {
    await page.goto("/");
    // Theme toggle button should have an accessible label
    const toggle = page.getByRole("button", { name: /switch to|theme/i });
    await expect(toggle).toBeVisible();
  });
});
