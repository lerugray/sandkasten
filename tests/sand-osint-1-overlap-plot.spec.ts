import { test, expect } from "@playwright/test";
import { findOverlaps } from "./helpers/overlap";
import { VIEWPORTS, walkPlotViews, type PlotDebug } from "./helpers/plotViews";

/**
 * SAND-OSINT-1 zero-overlap proof for the default Three.js /play plot: at 1440x900 and 1920x1080, in every view
 * the reviewers looked at, no label, data block, unit symbol, facility icon, OSINT icon or the scale bar covers
 * another (measured from the real DOM rects and symbol sizes via window.__sandPlot.occupancy()).
 * Run with SAND_E2E_GPU=1 (the plot is WebGL-heavy).
 */
for (const vp of VIEWPORTS) {
  test(`no overlaps among labels, blocks, symbols, icons and the scale bar at ${vp.width}x${vp.height}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(vp);
    const seen: string[] = [];
    await walkPlotViews(page, async (view, boxes) => {
      const kinds = new Set(boxes.map((b) => b.kind));
      seen.push(view.id);
      // the check must not pass because the plot drew nothing
      expect.soft(kinds.has("label"), `${view.id}: labels present`).toBe(true);
      expect.soft(kinds.has("scale"), `${view.id}: scale bar present`).toBe(true);
      expect.soft(boxes.filter((b) => b.kind === "scale")[0]?.h ?? 0, `${view.id}: scale bar visible`).toBeGreaterThan(8);
      expect.soft(await page.evaluate(() => (window as unknown as { __sandPlot: PlotDebug }).__sandPlot.scaleInChrome()), `${view.id}: scale bar sits inside opaque chrome`).toBe(true);
      // the default-zoom snapshot view is full of traffic: units and their data blocks must be in the measured set
      if (view.id === "snapshot") {
        expect.soft(boxes.filter((b) => b.kind === "unit").length, `${view.id}: unit symbols present`).toBeGreaterThan(20);
        expect.soft(boxes.filter((b) => b.kind === "block").length, `${view.id}: data blocks present`).toBeGreaterThan(5);
      }
      const counts: Record<string, number> = {};
      for (const b of boxes) counts[b.kind] = (counts[b.kind] ?? 0) + 1;
      test.info().annotations.push({ type: `${view.id}@${vp.width}`, description: JSON.stringify(counts) });
      console.log(`${view.id}@${vp.width}x${vp.height} ${JSON.stringify(counts)}`);
      // a site label that is not beside its own nearest icon must carry a leader to it
      const owners = await page.evaluate(() => (window as unknown as { __sandPlot: PlotDebug }).__sandPlot.labelOwners());
      const stray = owners.filter((o) => o.owner !== o.nearest && !o.leader).map((o) => `${o.text} (${o.owner}, nearest ${o.nearest})`);
      expect.soft(stray, `${view.id}: labels beside a foreign icon without a leader`).toEqual([]);
      const overlaps = findOverlaps(boxes);
      expect.soft(overlaps, `${view.title} @ ${vp.width}x${vp.height}: ${overlaps.length} overlapping pairs\n${overlaps.join("\n")}`).toEqual([]);
    });
    expect(seen.length).toBe(7);
  });
}
