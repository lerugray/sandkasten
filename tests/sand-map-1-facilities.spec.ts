import { test, expect, type Page } from "@playwright/test";

/**
 * SAND-MAP-1: real-world facility layer, runway-to-scale detail panel,
 * globe / terrain / satellite toggles on the MapLibre map (`/`).
 */

type AnyMap = {
  getZoom(): number;
  getCenter(): { lng: number; lat: number };
  jumpTo(o: { center?: [number, number]; zoom?: number; pitch?: number }): void;
  style: { projection: { transitionState: number } };
  getTerrain(): { source: string } | null;
  getLayoutProperty(id: string, p: string): unknown;
  getLayer(id: string): unknown;
  isStyleLoaded(): boolean;
  loaded(): boolean;
  project(l: [number, number]): { x: number; y: number };
  getCanvas(): HTMLCanvasElement;
  queryRenderedFeatures(g?: unknown, o?: unknown): { properties: Record<string, unknown> }[];
  once(ev: string, cb: () => void): void;
  getStyle(): { layers: { id: string }[] };
};

// 0 = mercator, 1 = globe. MapLibre 5.21 exposes no public getter for the evaluated projection.
const globeness = (page: Page) => withMap(page, (m) => m.style.projection.transitionState);

const withMap = <T>(page: Page, fn: (m: AnyMap) => T) =>
  page.evaluate(`(${fn.toString()})(document.querySelector(".maplibregl-map").__maplibreMap)`) as Promise<T>;

async function openMap(page: Page) {
  await page.goto("/");
  await page.waitForSelector(".maplibregl-canvas", { timeout: 30_000 });
  await page.waitForFunction(() => {
    const m = (document.querySelector(".maplibregl-map") as unknown as { __maplibreMap?: AnyMap }).__maplibreMap;
    return !!m && !!m.getLayer("facility-points-t0");
  }, null, { timeout: 30_000 });
}

async function settle(page: Page) {
  await page.waitForFunction(() => {
    const m = (document.querySelector(".maplibregl-map") as unknown as { __maplibreMap: AnyMap }).__maplibreMap;
    return m.isStyleLoaded();
  });
  await page.waitForTimeout(1500);
}

test.describe("SAND-MAP-1 facilities + globe/terrain", () => {
  test("facility layer builds with tiered symbol layers and OSM attribution", async ({ page }) => {
    await openMap(page);
    const layers = await withMap(page, (m) => m.getStyle().layers.map((l) => l.id).filter((i) => i.startsWith("facility")));
    expect(layers).toEqual(
      expect.arrayContaining(["facility-areas-fill", "facility-runways", "facility-points-t0", "facility-points-t3", "facility-labels-t0"]),
    );
    await expect(page.getByTestId("map-attribution")).toContainText("OpenStreetMap contributors");
    await expect(page.getByTestId("map-attribution")).toContainText("OurAirports");
    await settle(page);
    const rendered = await withMap(page, (m) => m.queryRenderedFeatures(undefined, { layers: ["facility-points-t0"] }).length);
    expect(rendered).toBeGreaterThan(3);
  });

  test("clicking Oghab 44 opens the panel with runways and based units", async ({ page }) => {
    await openMap(page);
    await withMap(page, (m) => m.jumpTo({ center: [55.52, 28.05], zoom: 11 }));
    await settle(page);
    const pt = (await page.evaluate(`(function(){
      var m = document.querySelector(".maplibregl-map").__maplibreMap;
      var fs = m.queryRenderedFeatures(undefined, { layers: ["facility-points-t0","facility-points-t1","facility-points-t2","facility-points-t3"] })
        .filter(function(f){ return f.properties.id === "apt-ir-0161"; });
      if (!fs.length) return null;
      var p = m.project(fs[0].geometry.coordinates);
      var r = m.getCanvas().getBoundingClientRect();
      return { x: r.left + p.x, y: r.top + p.y };
    })()`)) as { x: number; y: number } | null;
    expect(pt, "Oghab 44 symbol should be rendered").not.toBeNull();
    await page.mouse.click(pt!.x, pt!.y);
    const panel = page.getByTestId("facility-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("facility-panel-title")).toContainText("Oghab");
    await expect(page.getByTestId("facility-runway-row")).toHaveCount(2);
    await expect(panel).toContainText("2,437 m");
    await expect(page.getByTestId("facility-base-unit").first()).toBeVisible();
    await page.getByTestId("facility-panel-close").click();
    await expect(panel).toBeHidden();
  });

  test("facilities toggle hides and shows the layer", async ({ page }) => {
    await openMap(page);
    const toggle = page.getByTestId("map-toggle-facilities");
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(await withMap(page, (m) => m.getLayoutProperty("facility-points-t0", "visibility"))).toBe("none");
    await toggle.click();
    expect(await withMap(page, (m) => m.getLayoutProperty("facility-points-t0", "visibility"))).toBe("visible");
  });

  test("globe projection toggles; terrain and satellite switch on", async ({ page }) => {
    await openMap(page);
    await withMap(page, (m) => m.jumpTo({ zoom: 3.5 }));
    await expect.poll(() => globeness(page)).toBe(1);
    await page.getByTestId("map-toggle-globe").click();
    await expect.poll(() => globeness(page)).toBe(0);
    await page.getByTestId("map-toggle-globe").click();
    await expect.poll(() => globeness(page)).toBe(1);

    expect(await withMap(page, (m) => m.getTerrain())).toBeNull();
    await page.getByTestId("map-toggle-terrain").click();
    await expect.poll(() => withMap(page, (m) => m.getTerrain()?.source ?? null)).toBe("terrain-dem");
    expect(await withMap(page, (m) => m.getLayoutProperty("terrain-hillshade", "visibility"))).toBe("visible");

    await page.getByTestId("map-toggle-satellite").click();
    expect(await withMap(page, (m) => m.getLayoutProperty("sentinel2-cloudless-layer", "visibility"))).toBe("visible");
    await page.getByTestId("map-toggle-satellite").click();
    expect(await withMap(page, (m) => m.getLayoutProperty("sentinel2-cloudless-layer", "visibility"))).toBe("none");
  });

  test("projection is flat at tactical zoom and globe when zoomed out", async ({ page }) => {
    await openMap(page);
    await expect.poll(() => globeness(page)).toBe(0);
    await withMap(page, (m) => m.jumpTo({ zoom: 3.5 }));
    await expect.poll(() => globeness(page)).toBe(1);
  });
});
