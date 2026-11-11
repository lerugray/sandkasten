import { test, expect } from "@playwright/test";
import { findOverlaps } from "./helpers/overlap";
import { collectMapBoxes, outlineWaterShare, stubTileHost, walkMapViews } from "./helpers/mapViews";
import facilityData from "../data/facilities/hormuz.json";

const DENSE = new Set(["qeshm", "dhafra", "udeid"]);
const OUTLINES: Record<string, string[]> = {
  havadarya: ["apt-oikp"],
  "bandar-abbas-outline": ["apt-oikb"],
};
const polygon = (id: string) => (facilityData.facilities as unknown as { id: string; polygon?: [number, number][] }[]).find((f) => f.id === id)?.polygon ?? [];

/**
 * SAND-OSINT-1: on the MapLibre /map view no site label, unit symbol, OSINT / facility icon or piece of footer chrome
 * overlaps another, in every view the walk visits, at both review viewports.
 * Run with SAND_E2E_GPU=1. On a machine that cannot reach the tile server set SAND_E2E_STUB_TILES=1: the tile host is
 * then answered locally with empty tiles (the outline-on-land check has no base-map water to test against and passes).
 */

for (const [w, h] of [[1440, 900], [1920, 1080]]) {
  test(`/map has zero overlaps at ${w}x${h}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: w, height: h });
    if (process.env.SAND_E2E_STUB_TILES) await stubTileHost(page);
    const failures: string[] = [];
    await walkMapViews(page, async (view) => {
      let boxes = await collectMapBoxes(page);
      // At z9+ facility symbols are drawn with icon-allow-overlap, so catalogued places a few metres apart (Abu Dhabi's
      // airfields, Doha's heliports) stack on each other by design. Those three extra views check every OTHER pair.
      if (DENSE.has(view.id)) boxes = boxes.map((b) => (b.kind === "facility-icon" ? { ...b, group: "facility-stack" } : b));
      const labels = boxes.filter((b) => b.kind === "site-label").length;
      const overlaps = findOverlaps(boxes);
      if (process.env.SAND_PROBE) console.log(`${w}x${h} ${view.id}: ${boxes.length} boxes, ${labels} site labels, ${overlaps.length} overlaps`);
      // outline-on-land: the facility outlines the view is about must sit on the base map's land
      for (const id of OUTLINES[view.id] ?? []) {
        const [res] = Object.values(await outlineWaterShare(page, { [id]: polygon(id) }));
        if (process.env.SAND_PROBE) console.log(`${w}x${h} ${view.id}: outline ${id} ${res.inView} vertices in view, ${(res.share * 100).toFixed(0)}% on water`);
        if (res.inView < 5) failures.push(`${view.label}: outline ${id} has only ${res.inView} vertices in view`);
        else if (res.share > 0.15) failures.push(`${view.label}: outline ${id} has ${(res.share * 100).toFixed(0)}% of its vertices on water`);
      }
      // every site label sits on an opaque plate that gives its text >= 4.5:1, over any basemap (satellite included)
      if (view.id === "satellite" || view.id === "bushehr-satellite") {
        const bad = await page.evaluate(() => {
          const lum = (c: string) => {
            const m = c.match(/[\d.]+/g)!.map(Number);
            const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
            return { l: 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]), a: m[3] ?? 1 };
          };
          const out: string[] = [];
          document.querySelectorAll<HTMLElement>("[data-osint-label-id]").forEach((el) => {
            const cs = getComputedStyle(el);
            const fg = lum(cs.color), bg = lum(cs.backgroundColor);
            const ratio = (Math.max(fg.l, bg.l) + 0.05) / (Math.min(fg.l, bg.l) + 0.05);
            if (bg.a < 1 || ratio < 4.5) out.push(`${el.dataset.osintLabelId}: ratio ${ratio.toFixed(2)}, plate alpha ${bg.a}`);
          });
          return out;
        });
        if (bad.length) failures.push(`${view.label}: label contrast\n  ${bad.join("\n  ")}`);
      }
      if (overlaps.length) failures.push(`${view.label} (${view.id}):\n  ${overlaps.join("\n  ")}`);
    });
    expect(failures, failures.join("\n")).toEqual([]);
  });
}
