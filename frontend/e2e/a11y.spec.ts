/**
 * Step 58 — Accessibility audit.
 *
 * Runs axe-core against every main screen and asserts zero
 * critical or serious violations (the CI gate).
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockApiRoutes, mockServer, mockWebSocket } from "./helpers/api-mocks";

// ── Screens to audit ──────────────────────────────────────────────────────────

const SCREENS = [
  { name: "Overview", path: "/" },
  { name: "Server Detail — Info", path: "/servers/server-1/info" },
  { name: "Server Detail — Difficulty", path: "/servers/server-1/difficulty" },
  { name: "Server Detail — Network", path: "/servers/server-1/network" },
  { name: "Server Detail — Security", path: "/servers/server-1/security" },
  { name: "Server Detail — Advanced", path: "/servers/server-1/advanced" },
  { name: "Server Detail — Headless", path: "/servers/server-1/headless" },
  { name: "Mods", path: "/mods" },
  { name: "Missions", path: "/missions" },
  { name: "Logs", path: "/logs" },
  { name: "Settings", path: "/settings" },
  { name: "SteamCMD", path: "/steamcmd" },
  { name: "Presets", path: "/presets" },
] as const;

// ── Shared setup ──────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await mockWebSocket(page);
  await mockApiRoutes(page, { servers: [mockServer] });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

for (const screen of SCREENS) {
  test(`a11y — ${screen.name}`, async ({ page }) => {
    await page.goto(screen.path);

    // Wait for loading states to resolve so axe audits the real content
    await page
      .waitForFunction(
        () => document.querySelectorAll('[data-slot="skeleton"]').length === 0,
        { timeout: 5000 },
      )
      .catch(() => {
        // Proceed even if skeletons persist
      });

    const results = await new AxeBuilder({ page })
      // Exclude third-party iframes (if any) and the hidden aria-live regions
      .exclude("#axe-exclude")
      .analyze();

    // Collect critical and serious violations only
    const blocking = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    );

    if (blocking.length > 0) {
      // Pretty-print violations to make failures actionable
      const report = blocking
        .map(
          (v) =>
            `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
            v.nodes
              .slice(0, 3)
              .map((n) => `  • ${n.html}`)
              .join("\n"),
        )
        .join("\n\n");

      expect.soft(blocking, `Accessibility violations on "${screen.name}":\n${report}`).toHaveLength(0);
    }

    // Always assert — will fail if soft assertions captured violations
    expect(blocking).toHaveLength(0);
  });
}
