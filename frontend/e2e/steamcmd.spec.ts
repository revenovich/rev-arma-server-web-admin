import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockWebSocket } from "./helpers/api-mocks";

test.beforeEach(async ({ page }) => {
  await mockWebSocket(page);
  await mockApiRoutes(page);
});

test.describe("SteamCMD Screen", () => {
  test("renders installation status when SteamCMD is installed", async ({ page }) => {
    await page.goto("/steamcmd");

    await expect(page.getByRole("heading", { name: "SteamCMD" })).toBeVisible();
    await expect(page.getByText("Installation Status")).toBeVisible();
    await expect(page.getByText("v1.0.0")).toBeVisible();
    await expect(page.getByText("Installed")).toBeVisible();
  });

  test("shows not installed state", async ({ page }) => {
    // Override version endpoint - register BEFORE goto so it wins (LIFO)
    await page.route("/api/steamcmd/version", (route) =>
      route.fulfill({ json: { installed: false, version: null } }),
    );
    await page.goto("/steamcmd");

    await expect(page.getByText("Not Installed")).toBeVisible();
  });

  test("Install button triggers install API call", async ({ page }) => {
    let installCalled = false;
    // Register specific route AFTER beforeEach routes — last-registered wins (LIFO)
    await page.route("**/api/steamcmd/install", (route) => {
      installCalled = true;
      return route.fulfill({ json: { status: "ok" } });
    });

    await page.goto("/steamcmd");

    const installBtn = page.getByRole("button", { name: "Install" });
    await expect(installBtn).toBeVisible();
    await installBtn.click();

    await page.waitForTimeout(300);
    expect(installCalled).toBe(true);
  });

  test("Update button triggers update API call", async ({ page }) => {
    let updateCalled = false;
    await page.route("**/api/steamcmd/update", (route) => {
      updateCalled = true;
      return route.fulfill({ json: { status: "ok" } });
    });

    await page.goto("/steamcmd");

    const updateBtn = page.getByRole("button", { name: "Update" });
    await expect(updateBtn).toBeVisible();
    await updateBtn.click();

    await page.waitForTimeout(300);
    expect(updateCalled).toBe(true);
  });

  test("branch selector shows stable and development options", async ({ page }) => {
    await page.goto("/steamcmd");

    // "Branch" section label (rendered as <p class="section-label">)
    await expect(page.locator("p.section-label", { hasText: "Branch" })).toBeVisible();
    // The select element has Stable/Development options
    await expect(page.getByRole("option", { name: "Stable (public)" })).toBeAttached();
    await expect(page.getByRole("option", { name: "Development" })).toBeAttached();
  });

  test("Switch Branch button triggers branch API call", async ({ page }) => {
    let branchCalled = false;
    await page.route("**/api/steamcmd/branch", (route) => {
      branchCalled = true;
      return route.fulfill({ json: { status: "ok" } });
    });

    await page.goto("/steamcmd");

    await page.getByRole("button", { name: "Switch Branch" }).click();
    await page.waitForTimeout(300);
    expect(branchCalled).toBe(true);
  });

  test("shows error state when steamcmd version API fails", async ({ page }) => {
    await page.route("**/api/steamcmd/version", (route) =>
      route.fulfill({ status: 500, json: { detail: "error" } }),
    );

    await page.goto("/steamcmd");
    await expect(page.getByText(/failed to load steamcmd status/i)).toBeVisible();
  });
});
