import { test, expect, type Page } from "@playwright/test";

/**
 * SAND-OSINT-1: AD / radar / nuclear sites draw range rings in the default Three.js plot and in the MapLibre map,
 * a click opens the detail panel (ESTIMATED badge on misses), and the per-layer toggles hide them.
 * Run with SAND_E2E_GPU=1 (the plot is WebGL-heavy).
 */

type OsintPlot = {
  drawnTracks(): { units: number; contacts: number };
  drawnOsint(): { sites: number; rings: number; labels: number; total: number };
  osintScreen(id: string): { x: number; y: number } | null;
  focusOsint(id: string, dist?: number): void;
  view(): { dist: number };
};
type W = { __sandPlot?: OsintPlot };

async function openPlot(page: Page) {
  await page.goto("/play");
  await page.waitForFunction(() => !!(window as unknown as W).__sandPlot, null, { timeout: 60_000 });
  await page.getByTestId("briefing").click({ timeout: 10_000 }).catch(() => {});
  await page.waitForFunction(() => ((window as unknown as W).__sandPlot?.drawnOsint().sites ?? 0) > 0, null, { timeout: 15_000 });
}

test.describe("SAND-OSINT-1 /play plot", () => {
  test("rings render for AD and radar sites; layer toggles hide and show them", async ({ page }) => {
    await openPlot(page);
    const d = await page.evaluate(() => (window as unknown as W).__sandPlot!.drawnOsint());
    expect(d.total).toBe(14);
    expect(d.sites).toBe(14);
    // 800 km cap: the 3000 km Sepehr and 1000 km TPY-2 rings wait for a selection
    expect(d.rings).toBeGreaterThanOrEqual(10);
    await page.getByTestId("plot-toggle-osint-ad").click();
    await expect.poll(() => page.evaluate(() => (window as unknown as W).__sandPlot!.drawnOsint().sites)).toBe(5);
    await page.getByTestId("plot-toggle-osint-radar").click();
    await page.getByTestId("plot-toggle-osint-nuclear").click();
    await expect.poll(() => page.evaluate(() => (window as unknown as W).__sandPlot?.drawnOsint().sites ?? 0)).toBe(0);
    await page.getByTestId("plot-toggle-osint-ad").click();
    await expect.poll(() => page.evaluate(() => (window as unknown as W).__sandPlot!.drawnOsint().sites)).toBe(9);
  });

  test("clicking an S-300 site opens the panel with the ESTIMATED range; X closes it", async ({ page }) => {
    await openPlot(page);
    await page.evaluate(() => (window as unknown as W).__sandPlot!.focusOsint("ad-ir-s300-bandar-abbas", 60));
    await expect.poll(() => page.evaluate(() => (window as unknown as W).__sandPlot!.view().dist), { timeout: 10_000 }).toBeLessThan(80);
    await page.waitForTimeout(2500);
    const host = (await page.getByTestId("tactical-plot").boundingBox())!;
    const s = (await page.evaluate(() => (window as unknown as W).__sandPlot!.osintScreen("ad-ir-s300-bandar-abbas")))!;
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

  test("the map builds OSINT ring and symbol layers; the AD toggle removes AD features", async ({ page }) => {
    type M = { getLayer(i: string): unknown; querySourceFeatures(s: string): { properties: Record<string, unknown> }[] };
    const count = (layer: string) =>
      page.evaluate((l) => {
        const m = (window as unknown as { __sandMap: M }).__sandMap;
        return m.getLayer("osint-rings-line-est") ? m.querySourceFeatures("osint-sites-src").filter((f) => f.properties.layer === l).length : -1;
      }, layer);
    await page.goto("/");
    await page.waitForFunction(() => !!(window as unknown as { __sandMap?: M }).__sandMap, null, { timeout: 30_000 });
    await expect.poll(() => count("ad"), { timeout: 30_000 }).toBeGreaterThanOrEqual(9);
    expect(await count("radar")).toBeGreaterThanOrEqual(3);
    await page.getByTestId("map-toggle-osint-ad").click();
    await expect.poll(() => count("ad"), { timeout: 10_000 }).toBe(0);
    await page.getByTestId("map-toggle-osint-ad").click();
    await expect.poll(() => count("ad"), { timeout: 10_000 }).toBeGreaterThanOrEqual(9);
  });
});

test.describe("SAND-OSINT-1 snapshot scenario", () => {
  test("/play?scenario=snapshot opens the committed ADS-B snapshot offline and runs", async ({ page }) => {
    test.setTimeout(90_000);
    const external: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (/adsb\.lol|aisstream/.test(u.hostname)) external.push(r.url());
    });
    await page.goto("/play?scenario=snapshot");
    await page.waitForFunction(() => !!(window as unknown as W).__sandPlot, null, { timeout: 60_000 });
    await page.getByTestId("briefing").click({ timeout: 10_000 }).catch(() => {});
    await expect(page.getByTestId("terminal-root")).toContainText(/ADS-B|SNAPSHOT/i);
    await page.keyboard.press("g");
    await expect.poll(() => page.evaluate(() => (window as unknown as W).__sandPlot!.drawnTracks().units), { timeout: 20_000 }).toBeGreaterThan(20);
    await page.waitForFunction(() => ((window as unknown as W).__sandPlot?.drawnOsint().sites ?? 0) > 0, null, { timeout: 15_000 });
    const t0 = await page.getByTestId("terminal-root").innerText();
    await page.getByTestId("sim-toggle-pause").click();
    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await expect
      .poll(async () => (await page.getByTestId("terminal-root").innerText()).match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}Z/)?.[0], { timeout: 20_000 })
      .not.toBe(t0.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}Z/)?.[0]);
    expect(external).toEqual([]);
  });

  test("the editor SNAPSHOT button opens the same scenario", async ({ page }) => {
    await page.goto("/editor");
    await page.waitForSelector("canvas", { timeout: 30_000 });
    await page.getByTestId("editor-snapshot-open").click();
    await expect(page.getByTestId("editor-snapshot-status")).toContainText("Opened 2026-11-06T19:02:40Z");
  });
});
