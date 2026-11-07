import type { Page } from "@playwright/test";
import type { Box } from "./overlap";

/** Box as reported by `window.__sandPlot.occupancy()`: host-relative CSS px, only what is visible on screen. */
export type OccBox = Box & { kind: "label" | "block" | "unit" | "facility-icon" | "osint-icon" | "scale"; group?: string };

export type PlotDebug = {
  occupancy(): OccBox[];
  scaleInChrome(): boolean;
  labelOwners(): { text: string; owner: string; nearest: string; leader: boolean }[];
  focusFacility(id: string): void;
  focusOsint(id: string, dist?: number): void;
  view(): { dist: number };
  drawnTracks(): { units: number; contacts: number };
  frames(): number;
};
type W = { __sandPlot?: PlotDebug };

export const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

export interface PlotViewSpec {
  /** short slug, also usable as a screenshot name */
  id: string;
  title: string;
  /** Drive the page into this view. `fresh` is true when the previous view used another URL. */
  enter(page: Page): Promise<void>;
}

async function openPlot(page: Page, url: string) {
  await page.goto(url, { timeout: 120_000 });
  await page.waitForFunction(() => !!(window as unknown as W).__sandPlot, null, { timeout: 60_000 });
  await page.getByTestId("briefing").click({ timeout: 10_000 }).catch(() => {});
  await page.waitForFunction(() => ((window as unknown as W).__sandPlot?.frames() ?? 0) > 30, null, { timeout: 30_000 });
}

const focusFacility = (id: string): PlotViewSpec["enter"] => async (page) => {
  await page.evaluate((i) => (window as unknown as W).__sandPlot!.focusFacility(i), id);
  await page.waitForTimeout(4500);
};

/** The views the overlap proof walks. They run in order on one page, switching URL where the view says so. */
export const PLOT_VIEWS: (PlotViewSpec & { url: string })[] = [
  {
    id: "cold-boot", title: "/play cold boot", url: "/play",
    enter: async (page) => { await page.waitForTimeout(3500); },
  },
  { id: "fac-oikb", title: "facility focus apt-oikb", url: "/play", enter: focusFacility("apt-oikb") },
  { id: "fac-oikp", title: "facility focus apt-oikp", url: "/play", enter: focusFacility("apt-oikp") },
  { id: "fac-ir-0069", title: "facility focus apt-ir-0069", url: "/play", enter: focusFacility("apt-ir-0069") },
  {
    id: "osint-bandar-abbas", title: "OSINT focus ad-ir-s300-bandar-abbas at 700 km", url: "/play",
    enter: async (page) => {
      await page.evaluate(() => (window as unknown as W).__sandPlot!.focusOsint("ad-ir-s300-bandar-abbas", 700));
      await page.waitForTimeout(4500);
    },
  },
  {
    id: "snapshot", title: "/play?scenario=snapshot default zoom", url: "/play?scenario=snapshot",
    enter: async (page) => { await page.waitForTimeout(4000); },
  },
  {
    id: "snapshot-qeshm", title: "snapshot, OSINT focus ad-ir-3khordad-qeshm at 60 km", url: "/play?scenario=snapshot",
    enter: async (page) => {
      await page.evaluate(() => (window as unknown as W).__sandPlot!.focusOsint("ad-ir-3khordad-qeshm", 60));
      await page.waitForTimeout(4500);
    },
  },
];

/**
 * Walk every view in order on the page's current viewport and hand each to `onView` once it has settled.
 * A capture script can use this to screenshot the same views the overlap test checks.
 */
export async function walkPlotViews(
  page: Page,
  onView: (view: PlotViewSpec, boxes: OccBox[]) => Promise<void> | void,
  only?: string[],
) {
  let url = "";
  for (const v of PLOT_VIEWS) {
    if (only && !only.includes(v.id)) continue;
    if (v.url !== url) {
      await openPlot(page, v.url);
      url = v.url;
    }
    await v.enter(page);
    const boxes = await page.evaluate(() => (window as unknown as W).__sandPlot!.occupancy());
    await onView(v, boxes);
  }
}
