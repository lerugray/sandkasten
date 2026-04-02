import { test, expect } from "@playwright/test";

test.describe("Slate Command design system", () => {
  test("home page — screenshot for visual review", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: "test-results/home-page.png", fullPage: true });
  });

  test("play page — screenshot of initial state", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: "test-results/play-page-dark.png", fullPage: true });
  });

  test("play page — light theme screenshot", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    await page.locator("button", { hasText: "LIGHT" }).click();
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: "test-results/play-page-light.png", fullPage: true });
  });

  test("play page — unit selected with detail panel", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    const unitButtons = page.locator(".w-80 button.w-full");
    await unitButtons.first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/play-page-unit-selected.png", fullPage: true });
  });

  test("play page — help panel screenshot", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    await page.locator("button[aria-label='Open help']").click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/play-page-help.png", fullPage: true });
  });

  test("editor page — screenshot", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: "test-results/editor-page.png", fullPage: true });
  });

  test("SANDKASTEN title uses blue accent, not green", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    const title = page.getByText("SANDKASTEN").first();
    const color = await title.evaluate((el) => getComputedStyle(el).color);
    // Should be blue-ish (terminal-green is now blue in Slate Command)
    // RGB for blue accent #3B82F6 = rgb(59, 130, 246)
    expect(color).toMatch(/rgb\(59,\s*130,\s*246\)/);
  });

  test("IBM Plex fonts are loaded", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    const title = page.getByText("SANDKASTEN").first();
    const fontFamily = await title.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(fontFamily.toLowerCase()).toContain("ibm plex");
  });

  test("map zoom controls are in bottom-right", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    const zoomIn = page.locator(".maplibregl-ctrl-zoom-in").first();
    if (await zoomIn.isVisible()) {
      const box = await zoomIn.boundingBox();
      const viewport = page.viewportSize();
      if (box && viewport) {
        // Should be in the right half and bottom half of the viewport
        expect(box.x).toBeGreaterThan(viewport.width / 2);
        expect(box.y).toBeGreaterThan(viewport.height / 2);
      }
    }
  });
});
