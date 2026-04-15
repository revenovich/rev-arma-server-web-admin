/**
 * Step 57 — Visual regression screenshots.
 *
 * Captures every main screen at 1280 and 1440 viewport widths,
 * in both dark and light themes.
 *
 * Run `npx playwright test e2e/screenshots.spec.ts --update-snapshots`
 * to regenerate the baseline images.
 */
import { test, expect, type Page } from "@playwright/test";
import { mockApiRoutes, mockServer, mockWebSocket } from "./helpers/api-mocks";

// ── Helpers ───────────────────────────────────────────────────────────────────

const WIDTHS = [1280, 1440] as const;
const THEMES = ["dark", "light"] as const;
const THEME_KEY = "arma-admin-theme";

async function setupMocks(page: Page) {
  await mockWebSocket(page);
  await mockApiRoutes(page, { servers: [mockServer] });
}

async function setTheme(page: Page, theme: "dark" | "light") {
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: THEME_KEY, value: theme },
  );
  // Dark is the default (no class). Light mode adds .light class.
  await page.evaluate((isLight) => {
    document.documentElement.classList.toggle("light", isLight);
  }, theme === "light");
}

async function waitForSettled(page: Page) {
  // Wait for skeletons to disappear (data loaded)
  await page.waitForFunction(
    () => document.querySelectorAll('[data-slot="skeleton"]').length === 0,
    { timeout: 5000 },
  ).catch(() => {
    // If skeletons persist (loading never resolves), proceed anyway
  });
  // Small pause to let CSS animations settle
  await page.waitForTimeout(150);
}

// ── Screens to screenshot ─────────────────────────────────────────────────────

const SCREENS = [
  { name: "overview", path: "/" },
  { name: "server-detail-info", path: "/servers/server-1/info" },
  { name: "server-detail-difficulty", path: "/servers/server-1/difficulty" },
  { name: "server-detail-network", path: "/servers/server-1/network" },
  { name: "mods", path: "/mods" },
  { name: "missions", path: "/missions" },
  { name: "logs", path: "/logs" },
  { name: "settings", path: "/settings" },
  { name: "steamcmd", path: "/steamcmd" },
] as const;

// ── Tests ─────────────────────────────────────────────────────────────────────

for (const width of WIDTHS) {
  for (const theme of THEMES) {
    test.describe(`Screenshots — ${width}px ${theme}`, () => {
      test.beforeEach(async ({ page }) => {
        await setupMocks(page);
        page.setDefaultTimeout(10_000);
      });

      for (const screen of SCREENS) {
        test(`${screen.name}`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(screen.path);
          await setTheme(page, theme);
          await waitForSettled(page);

          await expect(page).toHaveScreenshot(
            `${screen.name}-${width}-${theme}.png`,
            {
              fullPage: false,
              animations: "disabled",
              maxDiffPixelRatio: 0.02, // 2% pixel diff tolerance
            },
          );
        });
      }
    });
  }
}
