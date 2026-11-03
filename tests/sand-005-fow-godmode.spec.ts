import { test, expect } from "@playwright/test";

test.describe("sand-005 — Fog-of-war vs god-mode toggle", () => {
  test("god-mode ON reveals all units and removes uncertainty circles", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });

    const markers = page.locator('[data-testid="plot-track"]');
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
            const plotEl = document.querySelector('[data-testid="tactical-plot"]') as any;
            const plot = plotEl?.__plot;
            if (!plot) return { hasPlot: false };
            return {
              hasPlot: true,
              hasUncertaintySource: !!plot.getSource("contact-uncertainty"),
              hasUncertaintyLine: !!plot.getLayer("contact-uncertainty-line"),
              hasUncertaintyFill: !!plot.getLayer("contact-uncertainty-fill"),
            };
          }),
        { timeout: 10_000 }
      )
      .toMatchObject({
        hasPlot: true,
        hasUncertaintySource: false,
        hasUncertaintyLine: false,
        hasUncertaintyFill: false,
      });
  });
});

