import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { findOverlaps } from "./helpers/overlap";
import { VIEWPORTS, type PlotDebug } from "./helpers/plotViews";
import { collectMapBoxes, jump, openMap, settleMap, BUSHEHR_VIEW, BANDAR_ABBAS_VIEW } from "./helpers/mapViews";

/**
 * SAND-OSINT-1 verification frames. Every frame the lane report cites is taken here, and the zero-overlap check
 * (label / data block / unit symbol / site icon / scale bar, measured from the real DOM and symbol rects) runs on
 * each one at the moment of the screenshot, and the spec fails if any frame has an overlap.
 * Set SAND_CAPTURE=1 to write the PNGs (DPR 2) into docs/verification; without it the spec is skipped.
 */
type W = { __sandPlot?: PlotDebug & { facilityScreen(id: string): { x: number; y: number } | null; osintScreen(id: string): { x: number; y: number } | null } };
const OUT = path.resolve(__dirname, "../docs/verification");
test.skip(!process.env.SAND_CAPTURE, "set SAND_CAPTURE=1 to capture the verification frames");
test.use({ deviceScaleFactor: 2 });

const plot = (page: Page) => page.evaluate(() => (window as unknown as W).__sandPlot!.occupancy());
async function openPlot(page: Page, url: string) {
  await page.goto(url, { timeout: 120_000 });
  await page.waitForFunction(() => !!(window as unknown as W).__sandPlot, null, { timeout: 60_000 });
  await page.waitForFunction(() => ((window as unknown as W).__sandPlot?.frames() ?? 0) > 30, null, { timeout: 30_000 });
  await page.waitForTimeout(2000);
}
const dismiss = async (page: Page) => { await page.getByTestId("briefing").click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(800); };
const focusFac = async (page: Page, id: string) => {
  await page.evaluate((i) => (window as unknown as W).__sandPlot!.focusFacility(i), id);
  await page.waitForTimeout(4500);
};

for (const vp of VIEWPORTS) {
  const sz = `${vp.width}x${vp.height}`;
  test(`verification frames at ${sz}`, async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize(vp);
    const failures: string[] = [];
    const frame = async (rel: string, boxes: { kind: string; id: string; x: number; y: number; w: number; h: number; group?: string }[]) => {
      const o = findOverlaps(boxes);
      const kinds: Record<string, number> = {};
      for (const b of boxes) kinds[b.kind] = (kinds[b.kind] ?? 0) + 1;
      console.log(`FRAME ${rel.replace("SZ", sz)} boxes=${JSON.stringify(kinds)} overlaps=${o.length}`);
      if (o.length) failures.push(`${rel.replace("SZ", sz)}: ${o.length} overlaps\n  ${o.join("\n  ")}`);
      await page.screenshot({ path: path.join(OUT, rel.replace("SZ", sz)) });
    };
    const plotFrame = async (rel: string) => frame(rel, await plot(page));

    // ---- /play plot, the demo scenario
    await openPlot(page, "/play");
    await plotFrame("sand-map-1-s403/05-play-cold-boot-SZ.png"); // briefing on screen, as first seen
    await dismiss(page);
    await focusFac(page, "apt-oikb");
    await plotFrame("sand-map-1-s403/06-play-facilities-SZ.png");
    await focusFac(page, "apt-oikp");
    const host = (await page.getByTestId("tactical-plot").boundingBox())!;
    const s = await page.evaluate(() => (window as unknown as W).__sandPlot!.facilityScreen("apt-oikp"));
    await page.mouse.click(host.x + s!.x, host.y + s!.y);
    await page.waitForTimeout(1200);
    await plotFrame("sand-map-1-s403/07-play-havadarya-panel-SZ.png");
    await page.getByTestId("facility-panel-close").click({ timeout: 3000 }).catch(() => {});
    await focusFac(page, "apt-ir-0069");
    await plotFrame("sand-osint-1-s403/04-play-gahkom-dar-SZ.png");
    await page.evaluate(() => (window as unknown as W).__sandPlot!.focusOsint("ad-ir-s300-bandar-abbas", 700));
    await page.waitForTimeout(4500);
    const o = await page.evaluate(() => (window as unknown as W).__sandPlot!.osintScreen("ad-ir-s300-bandar-abbas"));
    await page.mouse.click(host.x + o!.x, host.y + o!.y);
    await page.waitForTimeout(1500);
    await plotFrame("sand-osint-1-s403/01-plot-ad-rings-SZ.png");

    // ---- /play snapshot: the briefing is the first thing on screen
    await openPlot(page, "/play?scenario=snapshot");
    await expect(page.getByTestId("briefing")).toBeVisible();
    await plotFrame("sand-osint-1-s403/02-snapshot-scenario-SZ.png");
    await dismiss(page);
    await page.waitForTimeout(3500);
    await plotFrame("sand-osint-1-s403/02b-snapshot-traffic-SZ.png");
    await page.evaluate(() => (window as unknown as W).__sandPlot!.focusOsint("ad-ir-3khordad-qeshm", 60));
    await page.waitForTimeout(4500);
    await plotFrame("sand-osint-1-s403/02c-snapshot-qeshm-SZ.png");

    // ---- /map
    await openMap(page);
    await settleMap(page, 3000);
    const home = await page.evaluate(() => { const m = (window as unknown as { __sandMap: { getCenter(): { lng: number; lat: number }; getZoom(): number } }).__sandMap; const c = m.getCenter(); return { center: [c.lng, c.lat] as [number, number], zoom: m.getZoom() }; });
    await frame("sand-map-1-s403/01-map-tactical-SZ.png", await collectMapBoxes(page));
    await jump(page, BANDAR_ABBAS_VIEW, 4000);
    await frame("sand-map-1-s403/02-map-zoomed-bandar-abbas-SZ.png", await collectMapBoxes(page));
    await page.getByTestId("map-toggle-terrain").click();
    await settleMap(page, 5000);
    await frame("sand-map-1-s403/03-map-terrain-SZ.png", await collectMapBoxes(page));
    await page.getByTestId("map-toggle-terrain").click();
    await page.getByTestId("map-toggle-satellite").click();
    await settleMap(page, 6000);
    await frame("sand-map-1-s403/04-map-satellite-credit-SZ.png", await collectMapBoxes(page));
    await page.getByTestId("map-toggle-satellite").click();
    await jump(page, home, 4000);
    await frame("sand-osint-1-s403/03-map-osint-SZ.png", await collectMapBoxes(page));
    await jump(page, BUSHEHR_VIEW, 4000);
    await frame("sand-osint-1-s403/05-map-bushehr-SZ.png", await collectMapBoxes(page));

    expect(failures, failures.join("\n")).toEqual([]);
  });
}
