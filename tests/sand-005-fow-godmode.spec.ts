import { test, expect } from "@playwright/test";

test.describe("sand-005 — Fog-of-war vs god-mode toggle", () => {
  test("god-mode ON reveals all units and removes uncertainty circles", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });

    const markers = page.locator(".maplibregl-marker");
    await expect(markers.first()).toBeVisible({ timeout: 10_000 });
    const before = await markers.count();

    // Toggle god mode with keyboard.
    await page.keyboard.press("g");

    await expect
      .poll(async () => markers.count(), { timeout: 10_000 })
      .toBeGreaterThan(before);

    // Uncertainty circles should be removed when fog-of-war is off.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const mapEl = document.querySelector(".maplibregl-map") as any;
            const map = mapEl?.__maplibreMap;
            if (!map) return { hasMap: false };
            return {
              hasMap: true,
              hasUncertaintySource: !!map.getSource("contact-uncertainty"),
              hasUncertaintyLine: !!map.getLayer("contact-uncertainty-line"),
              hasUncertaintyFill: !!map.getLayer("contact-uncertainty-fill"),
            };
          }),
        { timeout: 10_000 }
      )
      .toMatchObject({
        hasMap: true,
        hasUncertaintySource: false,
        hasUncertaintyLine: false,
        hasUncertaintyFill: false,
      });
  });
});

