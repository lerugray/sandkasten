import { test, expect } from "@playwright/test";

// Reads what the plot actually drew on its last frame (not the input it was given).
async function plotState(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const plotEl = document.querySelector('[data-testid="tactical-plot"]') as any;
    const plot = plotEl?.__plot;
    if (!plot) return { hasPlot: false };
    return {
      hasPlot: true,
      hasUncertaintySource: !!plot.getSource("contact-uncertainty"),
      hasUncertaintyLine: !!plot.getLayer("contact-uncertainty-line"),
      hasUncertaintyFill: !!plot.getLayer("contact-uncertainty-fill"),
      drawnUnits: plot.drawnTracks().units as number,
    };
  });
}

test.describe("sand-005 — Fog-of-war vs god-mode toggle", () => {
  test("god-mode ON reveals all units and removes uncertainty circles", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });

    const markers = page.locator('[data-testid="plot-track"]');
    await expect(markers.first()).toBeVisible({ timeout: 10_000 });

    // Run until fog-of-war contacts with drawn uncertainty circles exist, so
    // the god-mode check below has something to remove.
    await page.getByLabel("Autopause settings").click();
    const autopauseToggle = page.getByTestId("autopause-toggle-enabled");
    if (((await autopauseToggle.textContent()) ?? "").trim() === "ON") await autopauseToggle.click();
    await page.keyboard.press("Escape");
    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await page.getByTestId("sim-toggle-pause").click(); // PLAY
    await expect
      .poll(async () => plotState(page), { timeout: 60_000 })
      .toMatchObject({ hasPlot: true, hasUncertaintySource: true, hasUncertaintyLine: true, hasUncertaintyFill: true });
    await page.getByTestId("sim-toggle-pause").click(); // PAUSE
    await expect(page.getByTestId("sim-toggle-pause")).toHaveText("PLAY");

    const before = await markers.count();
    const drawnBefore = ((await plotState(page)) as { drawnUnits: number }).drawnUnits;

    // Toggle god mode with keyboard.
    await page.keyboard.press("g");

    await expect
      .poll(async () => markers.count(), { timeout: 10_000 })
      .toBeGreaterThan(before);
    await expect
      .poll(async () => ((await plotState(page)) as { drawnUnits: number }).drawnUnits, { timeout: 10_000 })
      .toBeGreaterThan(drawnBefore);

    // Uncertainty circles should be removed when fog-of-war is off.
    await expect
      .poll(async () => plotState(page), { timeout: 10_000 })
      .toMatchObject({
        hasPlot: true,
        hasUncertaintySource: false,
        hasUncertaintyLine: false,
        hasUncertaintyFill: false,
      });
  });
});
