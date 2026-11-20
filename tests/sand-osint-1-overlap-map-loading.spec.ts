import { test, expect, type Page } from "@playwright/test";
import { findOverlaps } from "./helpers/overlap";
import { collectMapBoxes, openMap, settleMap, stubTileHost, ABU_MUSA_VIEW, BANDAR_ABBAS_VIEW, DHAFRA_VIEW, GULF_VIEW, QESHM_VIEW, UDEID_VIEW } from "./helpers/mapViews";

/**
 * SAND-THREAT-1 FIX3: on /map nothing overlaps WHILE a new view is still loading its base map.
 *
 * The layout of site labels, site symbols and unit symbols used to be solved again only when MapLibre went idle, and
 * idle waits for every base-map tile. Until then a label could lie on a facility symbol that had already appeared: after
 * the zoom to Qeshm the "Khalij Fars" plate lay on the Qeshm airport symbol (apt-ir-0057) for as long as the tiles took.
 * On a slow host that outlasted the settle time of the zero-overlap spec, which is how it was found.
 *
 * This spec needs no tile server: the tile host is answered locally, and the base-map tiles of each view are HELD until
 * the view has been checked, so the map cannot go idle first. It then releases them and checks the settled view too.
 */

const DENSE = new Set(["qeshm", "dhafra", "udeid"]);
const VIEWS: [string, { center: [number, number]; zoom: number }][] = [
  ["gulf", GULF_VIEW],
  ["qeshm", QESHM_VIEW], // zoom in from z6.3 to z9: the airport symbol appears beside the Khalij Fars radar
  ["dhafra", DHAFRA_VIEW],
  ["udeid", UDEID_VIEW], // a pan at the same zoom: no zoomend
  ["gulf", GULF_VIEW], // back out below z9, where the renderer decides which facility symbols are drawn
  ["abu-musa-sharjah-dubai", ABU_MUSA_VIEW],
  ["zoomed-bandar-abbas", BANDAR_ABBAS_VIEW],
];

async function overlapsNow(page: Page, id: string) {
  let boxes = await collectMapBoxes(page);
  // from z9 facility symbols may stack on each other by design (see the zero-overlap spec); every other pair counts
  if (DENSE.has(id)) boxes = boxes.map((b) => (b.kind === "facility-icon" ? { ...b, group: "facility-stack" } : b));
  return { boxes, overlaps: findOverlaps(boxes) };
}

for (const [w, h] of [[1440, 900], [1920, 1080]]) {
  test(`/map has zero overlaps while a view is still loading, at ${w}x${h}`, async ({ page }) => {
    test.setTimeout(300_000);
    const tiles = await stubTileHost(page);
    await page.setViewportSize({ width: w, height: h });
    await openMap(page);
    await settleMap(page, 3000);

    const failures: string[] = [];
    for (const [id, view] of VIEWS) {
      tiles.hold();
      await page.evaluate((v) => (window as unknown as { __sandMap: { jumpTo(o: unknown): void } }).__sandMap.jumpTo({ center: v.center, zoom: v.zoom, pitch: 0, bearing: 0 }), view);
      // give the facility symbols of the new view time to appear; the base map cannot, its tiles are held
      await page.waitForTimeout(3000);
      // while the tiles of a new zoom level are held the map is not idle: the state a player looks at on a slow connection
      // (a view whose tiles are already cached has nothing to wait for)
      const stillLoading = !(await page.evaluate(() => (window as unknown as { __sandMap: { loaded(): boolean } }).__sandMap.loaded()));
      // The layout has to clear every overlap WITHOUT the map going idle. A slow machine may need a moment longer, so
      // look again for up to 20 s; the old layout never cleared them while the tiles were held.
      let loading = await overlapsNow(page, id);
      for (const t0 = Date.now(); loading.overlaps.length && Date.now() - t0 < 20_000; ) {
        await page.waitForTimeout(500);
        loading = await overlapsNow(page, id);
      }
      if (loading.overlaps.length) failures.push(`${id} z${view.zoom}, ${stillLoading ? "still loading" : "tiles cached"}:\n  ${loading.overlaps.join("\n  ")}`);
      if (id === "qeshm") {
        // the check must not pass because the map had already settled, or because nothing was drawn
        expect(stillLoading, "qeshm: base-map tiles are still held").toBe(true);
        expect(await page.evaluate(() => (window as unknown as { __sandMap: { loaded(): boolean } }).__sandMap.loaded()), "qeshm: the map has not settled yet").toBe(false);
        expect(loading.boxes.some((b) => b.kind === "facility-icon" && b.id === "apt-ir-0057"), "Qeshm airport symbol is drawn").toBe(true);
        expect(loading.boxes.some((b) => b.kind === "site-label" && b.id === "radar-ir-khalij-fars"), "Khalij Fars label is drawn").toBe(true);
      }
      tiles.release();
      await settleMap(page);
      const settled = await overlapsNow(page, id);
      if (settled.overlaps.length) failures.push(`${id} z${view.zoom}, settled:\n  ${settled.overlaps.join("\n  ")}`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
}
