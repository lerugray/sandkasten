import type { Page } from "@playwright/test";
import type { Box } from "./overlap";

/**
 * Walks the MapLibre /map frames used by the overlap spec and by capture scripts.
 * `walkMapViews(page, cb)` opens `/`, then calls `cb(view)` once per view after the map has settled.
 */

export type MapBox = Box & { group?: string };

export type MapView = {
  id: string;
  /** shown in failure messages */
  label: string;
};

type AnyMap = {
  jumpTo(o: { center?: [number, number]; zoom?: number; pitch?: number; bearing?: number }): void;
  getZoom(): number;
  getCenter(): { lng: number; lat: number };
  loaded(): boolean;
  isStyleLoaded(): boolean;
};
type W = { __sandMap?: AnyMap };

export const BUSHEHR_VIEW = { center: [50.9, 28.88] as [number, number], zoom: 9 };
export const BANDAR_ABBAS_VIEW = { center: [55.709, 26.858] as [number, number], zoom: 8.1 };
export const ABU_MUSA_VIEW = { center: [55.3, 25.45] as [number, number], zoom: 8.2 };
/** Havadarya (OIKP) and the Bandar Abbas Intl (OIKB) outline. */
export const HAVADARYA_VIEW = { center: [56.17, 27.16] as [number, number], zoom: 12 };
export const BANDAR_ABBAS_INTL_VIEW = { center: [56.375, 27.2] as [number, number], zoom: 11 };

export const GULF_VIEW = { center: [53.5, 26.4] as [number, number], zoom: 6.3 };
export const QESHM_VIEW = { center: [56.0, 26.85] as [number, number], zoom: 9 };
export const DHAFRA_VIEW = { center: [54.5477, 24.2482] as [number, number], zoom: 10 };
export const UDEID_VIEW = { center: [51.315, 25.1173] as [number, number], zoom: 10 };

/**
 * Answers the base-map tile host locally, so a /map spec needs no tile server: a TileJSON, empty vector tiles and empty
 * glyph ranges (the terrain and satellite hosts get empty answers too). `hold()` keeps back every base-map tile asked
 * for from then on, as a slow connection would, until `release()`; while tiles are held the map cannot go idle.
 */
/** 1×1 PNG — empty 204 bodies made MapLibre throw `InvalidStateError: The source image could not be decoded` and left settleMap hung. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
/** 1×1 JPEG for the Sentinel raster host. */
const TINY_JPG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z",
  "base64",
);

export async function stubTileHost(page: Page) {
  let open: Promise<void> = Promise.resolve();
  let release = () => {};
  await page.route(/tiles\.openfreemap\.org\/planet$/, (r) =>
    r.fulfill({ contentType: "application/json", body: JSON.stringify({ tilejson: "3.0.0", tiles: ["https://tiles.openfreemap.org/planet/stub/{z}/{x}/{y}.pbf"], minzoom: 0, maxzoom: 14, vector_layers: [] }) }),
  );
  await page.route(/tiles\.openfreemap\.org\/planet\/stub\//, async (r) => {
    await open;
    await r.fulfill({ status: 204, body: "" }).catch(() => {});
  });
  await page.route(/tiles\.openfreemap\.org\/fonts\//, (r) => r.fulfill({ status: 200, contentType: "application/x-protobuf", body: "" }));
  // Raster / DEM must decode: a 204 empty body hung settleMap after InvalidStateError on image decode.
  await page.route(/s3\.amazonaws\.com\/elevation-tiles-prod\//, (r) =>
    r.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG }),
  );
  await page.route(/tiles\.maps\.eox\.at\//, (r) =>
    r.fulfill({ status: 200, contentType: "image/jpeg", body: TINY_JPG }),
  );
  return {
    hold() {
      release();
      open = new Promise<void>((ok) => { release = ok; });
    },
    release() {
      release();
    },
  };
}

export async function openMap(page: Page) {
  await page.goto("/");
  await page.waitForSelector(".maplibregl-canvas", { timeout: 30_000 });
  await page.waitForFunction(() => !!(window as unknown as W).__sandMap, null, { timeout: 30_000 });
  await page.waitForSelector("[data-osint-label-id]", { timeout: 30_000 });
}

/** Waits for tiles and style, then for the DOM layers (they relayout on zoomend / idle) to catch up. */
export async function settleMap(page: Page, ms = 2200) {
  try {
    await page.waitForFunction(() => {
      const m = (window as unknown as W).__sandMap!;
      return m.loaded() && m.isStyleLoaded();
    }, null, { timeout: 45_000 });
  } catch {
    // A failed raster/DEM decode can leave loaded() false while the style is up; layout still settles on idle.
    await page.waitForFunction(() => (window as unknown as W).__sandMap!.isStyleLoaded(), null, { timeout: 10_000 });
    await page.evaluate(() => {
      const m = (window as unknown as W).__sandMap as unknown as { fire?: (e: string) => void; triggerRepaint?: () => void };
      m.triggerRepaint?.();
    });
  }
  await page.waitForTimeout(ms);
}

export async function jump(page: Page, v: { center: [number, number]; zoom: number }, ms?: number) {
  await page.evaluate((a) => (window as unknown as W).__sandMap!.jumpTo({ center: a.center, zoom: a.zoom, pitch: 0, bearing: 0 }), v);
  await settleMap(page, ms);
}

async function toggle(page: Page, key: "terrain" | "satellite", on: boolean) {
  const btn = page.getByTestId(`map-toggle-${key}`);
  if ((await btn.getAttribute("aria-pressed")) !== String(on)) await btn.click();
  await settleMap(page, 3500);
}

/** Every box the overlap check cares about, host-relative CSS px. */
export async function collectMapBoxes(page: Page): Promise<MapBox[]> {
  return page.evaluate(() => {
    const map = (window as unknown as { __sandMap: AnyMap & { queryRenderedFeatures(g?: unknown, o?: unknown): { properties: Record<string, unknown>; geometry: { type: string; coordinates: number[] } }[]; project(l: number[]): { x: number; y: number }; getLayer(id: string): unknown } }).__sandMap;
    const host = (document.querySelector(".maplibregl-map") as HTMLElement).getBoundingClientRect();
    const out: (Box & { group?: string })[] = [];
    // map content is clipped to the map rect (the container hides the rest); chrome boxes are kept whole
    const push = (kind: string, id: string, r: { left: number; top: number; width: number; height: number }, group?: string, chrome = false) => {
      let x = r.left - host.left, y = r.top - host.top, w = r.width, h = r.height;
      if (!chrome) {
        const x1 = Math.max(0, x), y1 = Math.max(0, y), x2 = Math.min(host.width, x + w), y2 = Math.min(host.height, y + h);
        x = x1; y = y1; w = x2 - x1; h = y2 - y1;
      }
      if (w > 0 && h > 0) out.push({ kind, id, x, y, w, h, group: chrome ? "chrome" : group });
    };
    const shown = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0;
    };
    // site labels (DOM): tight rect of the text itself
    document.querySelectorAll<HTMLElement>("[data-osint-label-id]").forEach((el) => {
      if (!shown(el)) return;
      const rg = document.createRange();
      rg.selectNodeContents(el.firstChild ?? el);
      const t = rg.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      // the dark plate (2 px each side) is part of what the label covers
      push("site-label", el.dataset.osintLabelId!, { left: Math.min(t.left, b.left + 2) - 0, top: b.top, width: Math.max(t.width, b.width - 4), height: b.height });
    });
    // unit symbols: the symbol frame (the svg also holds the heading leader); contact markers: the marker box
    document.querySelectorAll<HTMLElement>(".unit-marker, .contact-marker").forEach((el) => {
      if (!shown(el)) return;
      const isContact = el.classList.contains("contact-marker");
      const svg = el.querySelector("svg");
      let r = (svg ?? el).getBoundingClientRect();
      const fw = Number(el.dataset.frameW), fh = Number(el.dataset.frameH);
      if (!isContact && svg && fw > 0 && fh > 0) {
        const cx = r.left + Number(el.dataset.anchorX), cy = r.top + Number(el.dataset.anchorY);
        r = new DOMRect(cx - fw / 2, cy - fh / 2, fw, fh);
      }
      push(isContact ? "contact" : "unit", el.dataset.unitId ?? el.dataset.contactId ?? el.title ?? "?", r);
    });
    // OSINT icons (DOM): the disc inside the image
    document.querySelectorAll<HTMLElement>("[data-osint-id]").forEach((el) => {
      if (!shown(el)) return;
      const r = (el.querySelector("img") ?? el).getBoundingClientRect();
      // the disc is 28/32 of the 32 px image
      const k = 28 / 32;
      push("osint-icon", el.dataset.osintId!, { left: r.left + (r.width * (1 - k)) / 2, top: r.top + (r.height * (1 - k)) / 2, width: r.width * k, height: r.height * k });
    });
    // facility icons live in the map canvas: rebuild their rects from the rendered features
    const z = map.getZoom();
    const stops: [number, number][] = [[4, 0.5], [8, 0.75], [12, 1]];
    const size = z <= 4 ? 0.5 : z >= 12 ? 1 : (() => { for (let i = 0; i < 2; i++) { const [z0, s0] = stops[i], [z1, s1] = stops[i + 1]; if (z <= z1) return s0 + ((z - z0) / (z1 - z0)) * (s1 - s0); } return 1; })();
    const layers = ["facility-points-t0", "facility-points-t1", "facility-points-t2", "facility-points-t3"].filter((l) => map.getLayer(l));
    const seen = new Set<string>();
    if (layers.length) {
      for (const f of map.queryRenderedFeatures(undefined, { layers })) {
        const id = String(f.properties.id);
        if (seen.has(id) || f.geometry.type !== "Point") continue;
        seen.add(id);
        const p = map.project(f.geometry.coordinates);
        const d = 28 * size;
        const x = p.x - d / 2 + host.left, y = p.y - d / 2 + host.top;
        push("facility-icon", id, { left: x, top: y, width: d, height: d });
      }
    }
    // chrome: footer bar, map toggles, zoom/attribution controls
    const bar = document.querySelector<HTMLElement>('[data-testid="map-statusbar"]');
    if (bar) push("footer", "statusbar", bar.getBoundingClientRect(), undefined, true);
    document.querySelectorAll<HTMLElement>('[data-testid="map-controls"] button').forEach((el) => push("toggle", el.dataset.testid ?? "", el.getBoundingClientRect(), undefined, true));
    document.querySelectorAll<HTMLElement>(".map-attrib-slot .maplibregl-ctrl, .maplibregl-ctrl-scale, .maplibregl-ctrl-bottom-right .maplibregl-ctrl, .maplibregl-ctrl-bottom-left .maplibregl-ctrl").forEach((el, i) => push("control", String(i), el.getBoundingClientRect(), undefined, true));
    // the attribution text, tight
    document.querySelectorAll<HTMLElement>('[data-testid="map-attribution"], [data-testid="map-satellite-credit"]').forEach((el) => {
      const rg = document.createRange();
      rg.selectNodeContents(el);
      for (const r of Array.from(rg.getClientRects())) push("credit", el.dataset.testid ?? "", r, undefined, true);
    });
    return out;
  });
}

/**
 * Share of a facility outline's vertices that fall on the base map's water, per id. The outline and the base map are both
 * OSM, so a vertex in the sea means the outline is drawn off the coast (a few vertices sit on the shore itself).
 */
export async function outlineWaterShare(page: Page, outlines: Record<string, [number, number][]>): Promise<Record<string, { share: number; inView: number }>> {
  return page.evaluate((o) => {
    type M = { project(l: number[]): { x: number; y: number }; getContainer(): HTMLElement; getStyle(): { layers: { id: string; type: string }[] }; queryRenderedFeatures(p: [number, number], o: { layers: string[] }): unknown[] };
    const map = (window as unknown as { __sandMap: M }).__sandMap;
    const layers = map.getStyle().layers.filter((l) => l.type === "fill" && l.id.endsWith("-water")).map((l) => l.id);
    const host = map.getContainer();
    const out: Record<string, { share: number; inView: number }> = {};
    for (const [id, ring] of Object.entries(o)) {
      let inView = 0, wet = 0;
      for (const ll of ring) {
        const p = map.project(ll);
        if (p.x < 0 || p.y < 0 || p.x > host.clientWidth || p.y > host.clientHeight) continue;
        inView++;
        if (map.queryRenderedFeatures([p.x, p.y], { layers }).length) wet++;
      }
      out[id] = { share: inView ? wet / inView : 0, inView };
    }
    return out;
  }, outlines);
}

export async function walkMapViews(page: Page, cb: (view: MapView) => Promise<void> | void, opts: { open?: boolean } = {}) {
  if (opts.open !== false) await openMap(page);
  await settleMap(page, 3000);
  const home = await page.evaluate(() => {
    const m = (window as unknown as W).__sandMap!;
    const c = m.getCenter();
    return { center: [c.lng, c.lat] as [number, number], zoom: m.getZoom() };
  });
  await cb({ id: "tactical", label: "map tactical default" });
  await jump(page, BANDAR_ABBAS_VIEW);
  await cb({ id: "zoomed-bandar-abbas", label: "zoomed Bandar Abbas" });
  await toggle(page, "terrain", true);
  await cb({ id: "terrain", label: "terrain on" });
  await toggle(page, "terrain", false);
  await toggle(page, "satellite", true);
  await cb({ id: "satellite", label: "satellite on" });
  await toggle(page, "satellite", false);
  await jump(page, home, 3000);
  await cb({ id: "osint-default", label: "OSINT default view" });
  await jump(page, ABU_MUSA_VIEW);
  await cb({ id: "abu-musa-sharjah-dubai", label: "Abu Musa / Sharjah / Dubai" });
  await jump(page, BUSHEHR_VIEW);
  await cb({ id: "bushehr", label: "Bushehr" });
  await jump(page, HAVADARYA_VIEW);
  await cb({ id: "havadarya", label: "Havadarya (OIKP)" });
  await jump(page, BANDAR_ABBAS_INTL_VIEW);
  await cb({ id: "bandar-abbas-outline", label: "Bandar Abbas Intl outline" });
  await jump(page, GULF_VIEW);
  await cb({ id: "gulf", label: "Gulf wide (z6.3)" });
  await jump(page, QESHM_VIEW);
  await cb({ id: "qeshm", label: "Qeshm / Khalij Fars" });
  await jump(page, DHAFRA_VIEW);
  await cb({ id: "dhafra", label: "Al Dhafra" });
  await jump(page, UDEID_VIEW);
  await cb({ id: "udeid", label: "Al Udeid" });
  // red site labels on the satellite basemap
  await jump(page, BUSHEHR_VIEW);
  await toggle(page, "satellite", true);
  await cb({ id: "bushehr-satellite", label: "Bushehr, satellite on" });
  await toggle(page, "satellite", false);
}
