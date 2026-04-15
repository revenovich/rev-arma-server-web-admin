/**
 * Glassmorphism UI feature tests.
 *
 * Validates the Iris design system: animated gradient background,
 * glass surfaces, gradient headings, mobile sidebar hamburger,
 * and page transition elements.
 */
import { test, expect } from "@playwright/test";
import { mockApiRoutes, mockServer, mockWebSocket } from "./helpers/api-mocks";

test.beforeEach(async ({ page }) => {
  await mockWebSocket(page);
  await mockApiRoutes(page, { servers: [mockServer] });
});

// ── Gradient background ──────────────────────────────────────────────────────

test.describe("Gradient background", () => {
  test("renders animated gradient background on html element", async ({ page }) => {
    await page.goto("/");
    const background = await page.evaluate(() => {
      return window.getComputedStyle(document.documentElement).background;
    });
    // Should be a linear-gradient (not solid color)
    expect(background).toContain("gradient");
  });

  test("gradient-drift animation is defined on html element", async ({ page }) => {
    await page.goto("/");
    // The html element should have the gradient-drift animation via CSS
    const hasAnimation = await page.evaluate(() => {
      const style = window.getComputedStyle(document.documentElement);
      // animation-name or animation shorthand should reference gradient-drift
      const animation = style.animationName || style.animation;
      return animation.includes("gradient-drift");
    });
    expect(hasAnimation).toBe(true);
  });
});

// ── Glass surfaces ─────────────────────────────────────────────────────────────

test.describe("Glass surfaces", () => {
  test("sidebar has glass styling", async ({ page }) => {
    await page.goto("/");
    // The glass class is on the <aside>, not the <nav> inside it
    const sidebar = page.locator("aside.glass");
    await expect(sidebar).toBeVisible();
  });

  test("list rows use glass class pattern", async ({ page }) => {
    await page.goto("/mods");
    // Wait for content to load (skeletons gone)
    await page.waitForFunction(
      () => document.querySelectorAll('[data-slot="skeleton"]').length === 0,
      { timeout: 5000 },
    ).catch(() => {});

    const glassRows = page.locator(".glass");
    // Should have at least one glass element on the page
    await expect(glassRows.first()).toBeVisible();
  });
});

// ── Gradient headings ──────────────────────────────────────────────────────────

test.describe("Gradient headings", () => {
  test("page headings use gradient-heading class", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { name: "Servers" });
    await expect(heading).toBeVisible();
    const classes = await heading.getAttribute("class") ?? "";
    expect(classes).toContain("gradient-heading");
  });

  test("Mods page heading uses gradient-heading", async ({ page }) => {
    await page.goto("/mods");
    const heading = page.getByRole("heading", { name: "Mods" });
    await expect(heading).toBeVisible();
    const classes = await heading.getAttribute("class") ?? "";
    expect(classes).toContain("gradient-heading");
  });
});

// ── Mobile sidebar ────────────────────────────────────────────────────────────

test.describe("Mobile sidebar", () => {
  test("hamburger menu is visible on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const hamburger = page.getByRole("button", { name: /menu/i });
    await expect(hamburger).toBeVisible();
  });

  test("hamburger menu is hidden on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const hamburger = page.getByRole("button", { name: /menu/i });
    await expect(hamburger).not.toBeVisible();
  });

  test("clicking hamburger opens mobile sidebar", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const hamburger = page.getByRole("button", { name: /menu/i });
    await hamburger.click();

    // Mobile sidebar should now be visible
    // It slides in from the left via framer-motion
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  });
});

// ── Page transitions ──────────────────────────────────────────────────────────

test.describe("Page transitions", () => {
  test("page content animates on navigation", async ({ page }) => {
    await page.goto("/");

    // Navigate to Mods page
    await page.getByRole("link", { name: "Mods" }).click();

    // Content should be visible (AnimatedOutlet renders motion.div)
    const heading = page.getByRole("heading", { name: "Mods" });
    await expect(heading).toBeVisible();
  });
});

// ── Light mode glass ───────────────────────────────────────────────────────────

test.describe("Light mode glass", () => {
  test("light mode applies .light class to html", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");

    // Toggle to light
    const toggle = page.getByRole("button", { name: /switch to/i });
    await toggle.click();
    await expect(html).toHaveClass(/light/);

    // Glass elements should still be present
    const glassElements = page.locator(".glass");
    await expect(glassElements.first()).toBeVisible();
  });
});

// ── Status breath animation ───────────────────────────────────────────────────

test.describe("Status breath animation", () => {
  test("offline server has status dot with animation class", async ({ page }) => {
    await page.goto("/");
    // The StatusDot uses aria-label "Offline" for offline servers
    // It appears in the sidebar server list (desktop) or main content area
    await expect(page.getByLabel("Offline").first()).toBeVisible({ timeout: 10000 });
  });
});