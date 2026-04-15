import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockMission, mockWebSocket } from "./helpers/api-mocks";

test.beforeEach(async ({ page }) => {
  await mockWebSocket(page);
  await mockApiRoutes(page);
});

test.describe("Missions Screen", () => {
  test("renders mission list from API", async ({ page }) => {
    await page.goto("/missions");

    await expect(page.getByRole("heading", { name: "Missions" })).toBeVisible();
    await expect(page.getByText("altis_life.Altis.pbo")).toBeVisible();
  });

  test("shows empty state when no missions", async ({ page }) => {
    await mockApiRoutes(page, { missions: [] });
    await page.goto("/missions");

    await expect(page.getByRole("heading", { name: "Missions" })).toBeVisible();
    // Dropzone (now a <label>) should still be visible
    await expect(page.locator("label[for='mission-upload']")).toBeVisible();
    await expect(page.getByText("No mission files found")).toBeVisible();
  });

  test("upload dropzone is visible and labelled", async ({ page }) => {
    await page.goto("/missions");

    // Dropzone is now a <label> element
    const dropzone = page.locator("label[for='mission-upload']");
    await expect(dropzone).toBeVisible();
    await expect(dropzone).toContainText(/drag & drop|click to browse/i);
  });

  test("uploading a file calls the missions API", async ({ page }) => {
    let uploadCalled = false;
    await page.route("/api/missions", (route) => {
      if (route.request().method() === "POST") {
        uploadCalled = true;
        return route.fulfill({ json: { status: "ok" } });
      }
      return route.fulfill({ json: [mockMission] });
    });

    await page.goto("/missions");

    // Trigger via the hidden file input directly (label click opens chooser)
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.locator("#mission-upload").evaluate((el: HTMLElement) => el.click()),
    ]);
    await fileChooser.setFiles({
      name: "test_mission.Altis.pbo",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("fake pbo content"),
    });

    await page.waitForTimeout(300);
    expect(uploadCalled).toBe(true);
  });

  test("Refresh button is visible", async ({ page }) => {
    await page.goto("/missions");
    await expect(page.getByRole("button", { name: /refresh/i })).toBeVisible();
  });
});
