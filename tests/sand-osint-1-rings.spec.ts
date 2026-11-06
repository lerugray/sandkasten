import { test, expect, type Page } from "@playwright/test";

/**
 * SAND-OSINT-1: AD / radar / nuclear sites draw range rings in the default Three.js plot and in the MapLibre map,
 * a click opens the detail panel (ESTIMATED badge on misses), and the per-layer toggles hide them.
 * Run with SAND_E2E_GPU=1 (the plot is WebGL-heavy).
 */

type Plot = {
  drawnOsint(): { sites: number; rings: number; labels: number; total: number };
  osintScreen(id: string): { x: number; y: number } | null;
  focusOsint(id: string, dist?: number): void;
  view(): { dist: number };
};
declare global {
  interface Window {
    __sandPlot?: Plot;
  }
}

async function openPlot(page: Page) {
  await page.goto("/play");
  await page.waitForFunction(() => !!window.__sandPlot, null, { timeout: 60_000 });
  await page.getByTestId("briefing").click({ timeout: 10_000 }).catch(() => {});
  await page.waitForFunction(() => (window.__sandPlot?.drawnOsint().sites ?? 0) > 0, null, { timeout: 15_000 });
}

test.describe("SAND-OSINT-1 /play plot", () => {
  test("rings render for AD and radar sites; layer toggles hide and show them", async ({ page }) => {
    await openPlot(page);
    const d = await page.evaluate(() => window.__sandPlot!.drawnOsint());
    expect(d.total).toBe(14);
    expect(d.sites).toBe(14);
    // 800 km cap: the 3000 km Sepehr and 1000 km TPY-2 rings wait for a selection
    expect(d.rings).toBeGreaterThanOrEqual(10);
    await page.getByTestId("plot-toggle-osint-ad").click();
    await expect.poll(() => page.evaluate(() => window.__sandPlot!.drawnOsint().sites)).toBe(5);
    await page.getByTestId("plot-toggle-osint-radar").click();
    await page.getByTestId("plot-toggle-osint-nuclear").click();
    await expect.poll(() => page.evaluate(() => window.__sandPlot?.drawnOsint().sites ?? 0)).toBe(0);
    await page.getByTestId("plot-toggle-osint-ad").click();
    await expect.poll(() => page.evaluate(() => window.__sandPlot!.drawnOsint().sites)).toBe(9);
  });

  test("clicking an S-300 site opens the panel with the ESTIMATED range; X closes it", async ({ page }) => {
    await openPlot(page);
    await page.evaluate(() => window.__sandPlot!.focusOsint("ad-ir-s300-bandar-abbas", 60));
    await expect.poll(() => page.evaluate(() => window.__sandPlot!.view().dist), { timeout: 10_000 }).toBeLessThan(80);
    await page.waitForTimeout(2500);
    const host = (await page.getByTestId("tactical-plot").boundingBox())!;
    const s = (await page.evaluate(() => window.__sandPlot!.osintScreen("ad-ir-s300-bandar-abbas")))!;
    await page.mouse.click(host.x + s.x, host.y + s.y);
    const panel = page.getByTestId("osint-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("osint-system")).toContainText("S-300");
    await expect(page.getByTestId("osint-side")).toContainText("Iran");
    await expect(page.getByTestId("osint-range")).toContainText("200 km");
    await expect(page.getByTestId("osint-estimated")).toBeVisible();
    await expect(page.getByTestId("osint-platform")).toContainText("no record");
    await expect(page.getByTestId("osint-source")).toContainText(/CSIS|Wikipedia/);
    await page.getByTestId("osint-panel-close").click();
    await expect(panel).toBeHidden();
  });

  test("the credit line names the OSINT sources", async ({ page }) => {
    await openPlot(page);
    await expect(page.getByTestId("plot-attribution")).toContainText("Auftragstaktik");
  });
});

test.describe("SAND-OSINT-1 MapLibre map", () => {
  test("map toggles exist and a facility with OSINT fields shows them in its panel", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".maplibregl-canvas", { timeout: 30_000 });
    for (const k of ["ad", "radar", "nuclear"]) await expect(page.getByTestId(`map-toggle-osint-${k}`)).toBeVisible();
    await page.getByTestId("map-toggle-osint-ad").click();
    await page.getByTestId("map-toggle-osint-ad").click();
  });
});
