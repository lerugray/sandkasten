import { test, expect, type Page } from "@playwright/test";

/**
 * SAND-MAP-2: the default /play plot draws the real Hormuz facilities, a click opens the facility panel,
 * units show their home base, and no view needs a vendor key (no "API KEY" watermark, no failed tile requests).
 */

type Plot = {
  drawnFacilities(): { symbols: number; runways: number; labels: number; total: number };
  facilityScreen(id: string): { x: number; y: number } | null;
  focusFacility(id: string): void;
  clickAt(x: number, y: number, shift?: boolean): void;
  view(): { dist: number };
  frames(): number;
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
  await page.waitForFunction(() => (window.__sandPlot?.drawnFacilities().symbols ?? 0) > 0, null, { timeout: 15_000 });
}

test.describe("SAND-MAP-2 default /play facilities", () => {
  test("the plot draws facility symbols and runways", async ({ page }) => {
    await openPlot(page);
    const d = await page.evaluate(() => window.__sandPlot!.drawnFacilities());
    expect(d.total).toBeGreaterThan(500);
    expect(d.symbols).toBeGreaterThan(100);
    expect(d.runways).toBeGreaterThan(150);
    expect(d.labels).toBeGreaterThan(0);
    await expect(page.getByTestId("plot-canvas")).toBeVisible();
  });

  test("the plot shows persistent OSM / OurAirports credits", async ({ page }) => {
    await openPlot(page);
    const credit = page.getByTestId("plot-attribution");
    await expect(credit).toBeVisible();
    await expect(credit).toContainText("OpenStreetMap contributors");
    await expect(credit).toContainText("OurAirports");
  });

  test("clicking Oghab 44 opens the facility panel with runways; X closes it", async ({ page }) => {
    await openPlot(page);
    await page.evaluate(() => window.__sandPlot!.focusFacility("apt-ir-0161"));
    await expect.poll(() => page.evaluate(() => window.__sandPlot!.view().dist), { timeout: 10_000 }).toBeLessThan(30);
    await page.waitForTimeout(2500);
    const host = (await page.getByTestId("tactical-plot").boundingBox())!;
    const s = (await page.evaluate(() => window.__sandPlot!.facilityScreen("apt-ir-0161")))!;
    await page.mouse.click(host.x + s.x, host.y + s.y);
    const panel = page.getByTestId("facility-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("facility-panel-title")).toContainText("Oghab");
    await expect(page.getByTestId("facility-runway-row")).toHaveCount(1);
    await expect(panel).toContainText("2,733 m");
    await page.getByTestId("facility-panel-close").click();
    await expect(panel).toBeHidden();
  });

  test("clicking a military airbase at close zoom opens its panel (Havadarya)", async ({ page }) => {
    await openPlot(page);
    await page.evaluate(() => window.__sandPlot!.focusFacility("apt-oikp"));
    await expect.poll(() => page.evaluate(() => window.__sandPlot!.view().dist), { timeout: 10_000 }).toBeLessThan(40);
    await page.waitForTimeout(2500);
    const host = (await page.getByTestId("tactical-plot").boundingBox())!;
    const s = (await page.evaluate(() => window.__sandPlot!.facilityScreen("apt-oikp")))!;
    await page.mouse.click(host.x + s.x, host.y + s.y);
    await expect(page.getByTestId("facility-panel-title")).toContainText("Havadarya");
  });

  test("a unit based at a facility lists its home base in the unit panel (god mode)", async ({ page }) => {
    await openPlot(page);
    await page.keyboard.press("g");
    const block = page.locator('[data-testid="plot-track"][data-unit-id="ir-f4-2"]');
    await expect(block).toBeVisible({ timeout: 10_000 });
    const host = (await page.getByTestId("tactical-plot").boundingBox())!;
    const b = (await block.boundingBox())!;
    await page.evaluate(([x, y]) => window.__sandPlot!.clickAt(x, y), [b.x + b.width / 2 - host.x, b.y + b.height / 2 - host.y]);
    await expect(page.getByTestId("detail-panel")).toBeVisible();
    await expect(page.getByTestId("detail-home-base")).toContainText("Havadarya");
    await expect(page.getByTestId("detail-home-base")).toContainText("08");
    await page.getByTestId("detail-home-base-link").click();
    await expect(page.getByTestId("facility-panel-title")).toContainText("Havadarya");
    await expect(page.getByTestId("facility-base-unit").first()).toContainText("Phantom");
  });
});

// Every view: no vendor-key watermark text, no failed or error responses from any tile, glyph or style host,
// and the basemap does not come from CARTO.
const VIEWS: { name: string; url: string; theme?: "light"; sat?: boolean }[] = [
  { name: "map (/)", url: "/" },
  { name: "map light theme", url: "/", theme: "light" },
  { name: "map with satellite", url: "/", sat: true },
  { name: "/play?map=legacy", url: "/play?map=legacy" },
  { name: "/editor", url: "/editor" },
  { name: "/play plot", url: "/play" },
];

test.describe("SAND-MAP-2 keyless base map on every view", () => {
  for (const v of VIEWS) {
    test(`no API KEY text and no failed requests: ${v.name}`, async ({ page }) => {
      test.setTimeout(90_000);
      const bad: string[] = [];
      const hosts = new Set<string>();
      page.on("response", (r) => {
        const u = new URL(r.url());
        hosts.add(u.host);
        if (r.status() >= 400 && u.hostname !== "localhost") bad.push(`${r.status()} ${r.url()}`);
      });
      page.on("requestfailed", (r) => {
        if (!r.url().startsWith("data:") && !r.failure()?.errorText.includes("ABORTED")) bad.push(`FAILED ${r.url()}`);
      });
      await page.goto(v.url);
      await page.waitForSelector("canvas", { timeout: 30_000 });
      if (v.theme === "light") await page.getByRole("button", { name: /LIGHT/i }).click();
      if (v.sat) await page.getByTestId("map-toggle-satellite").click();
      await page.waitForTimeout(v.url.startsWith("/play") && !v.url.includes("legacy") ? 2000 : 6000);
      expect(await page.locator("body").innerText()).not.toMatch(/API KEY/i);
      expect([...hosts].filter((h) => /cartocdn|carto\.com/.test(h))).toEqual([]);
      expect(bad).toEqual([]);
    });
  }

  test("OpenFreeMap tiles load and OSM attribution shows; satellite adds EOX credit with its licence", async ({ page }) => {
    const tiles: number[] = [];
    page.on("response", (r) => {
      if (r.url().includes("tiles.openfreemap.org/planet/") && r.url().endsWith(".pbf")) tiles.push(r.status());
    });
    await page.goto("/");
    await page.waitForSelector(".maplibregl-canvas", { timeout: 30_000 });
    await expect.poll(() => tiles.length, { timeout: 30_000 }).toBeGreaterThan(0);
    expect(tiles.every((s) => s === 200)).toBe(true);
    const attrib = page.locator(".maplibregl-ctrl-attrib");
    await expect(attrib).toContainText("OpenFreeMap");
    await expect(attrib).toContainText("OpenStreetMap contributors");
    await expect(page.getByTestId("map-attribution")).toContainText("OpenStreetMap");
    await expect(page.getByTestId("map-satellite-credit")).toHaveCount(0);

    await page.getByTestId("map-toggle-satellite").click();
    await expect(page.getByTestId("map-satellite-credit")).toContainText("CC BY-NC-SA 4.0");
    await expect(page.getByTestId("map-satellite-credit")).toContainText("EOX");
    await expect(attrib).toContainText("Sentinel-2 cloudless");
    await expect(attrib).toContainText("CC BY-NC-SA 4.0");
    await page.getByTestId("map-toggle-satellite").click();
    await expect(page.getByTestId("map-satellite-credit")).toHaveCount(0);
  });
});
