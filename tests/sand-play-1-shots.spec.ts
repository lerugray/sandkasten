import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { openPlay, areaBox, runUntilResult, injectKillOnCarrier, restoreDice, GATE, type W } from "./helpers/sandPlay";

const OUT = path.join(process.cwd(), "docs", "verification", "sand-play-1-s409");
const SIZES = [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }];

/** Smallest rendered font among the visible text under `selector`, and the smallest among the named body-text elements. */
async function fonts(page: Page, selector: string, bodyIds: string[]) {
  return page.evaluate(([sel, ids]) => {
    const root = document.querySelector(sel as string);
    if (!root) return { all: 0, body: 0, n: 0 };
    let all = 99, n = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.textContent?.trim()) continue;
      const el = t.parentElement!;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (getComputedStyle(el).visibility === "hidden") continue;
      all = Math.min(all, parseFloat(getComputedStyle(el).fontSize));
      n++;
    }
    let body = 99;
    for (const id of ids as string[]) {
      for (const el of document.querySelectorAll(`[data-testid="${id}"]`)) {
        if (el.getBoundingClientRect().width === 0) continue;
        body = Math.min(body, parseFloat(getComputedStyle(el).fontSize));
      }
    }
    return { all, body, n };
  }, [selector, bodyIds] as const);
}

async function fits(page: Page, testId: string) {
  const r = await page.getByTestId(testId).boundingBox();
  const vp = page.viewportSize()!;
  expect(r, testId).not.toBeNull();
  expect(r!.x).toBeGreaterThanOrEqual(0);
  expect(r!.y).toBeGreaterThanOrEqual(0);
  expect(r!.x + r!.width).toBeLessThanOrEqual(vp.width);
  expect(r!.y + r!.height).toBeLessThanOrEqual(vp.height);
  // nothing inside is clipped by the card
  const clipped = await page.getByTestId(testId).evaluate((el) => el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY === "hidden");
  expect(clipped, `${testId} clips its content`).toBe(false);
}

for (const size of SIZES) {
  test(`pixel inspection at ${size.width}x${size.height} DPR 2`, async ({ browser }, info) => {
    // 1920×1080 DPR 2 under software GL routinely needs >4 min wall time on cpu landbat hosts.
    test.setTimeout(size.width >= 1920 ? 420_000 : 300_000);
    mkdirSync(OUT, { recursive: true });
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const shot = (name: string) => page.screenshot({ path: path.join(OUT, `${size.width}x${size.height}-${name}.png`) });
    const canvas = async () => (await page.locator("canvas").first().boundingBox())!;
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
      const renderer = await page.evaluate(() => (window as unknown as W).__sandPlot!.rendererInfo().renderer);
      info.annotations.push({ type: "renderer", description: renderer });
      const c0 = await canvas();

      // 1. briefing
      await expect(page.getByTestId("briefing")).toBeVisible();
      await page.waitForTimeout(1500);
      await fits(page, "briefing");
      let f = await fonts(page, '[data-testid="briefing"]', ["briefing-mission"]);
      expect(f.all).toBeGreaterThanOrEqual(12);
      expect(f.body).toBeGreaterThanOrEqual(14);
      await shot("1-briefing");
      expect(await canvas()).toEqual(c0);

      // 2. focused objective
      await page.getByTestId("briefing-show-gate").click();
      await expect(page.getByTestId("briefing")).toBeHidden();
      await page.waitForTimeout(4000);
      f = await fonts(page, '[data-testid="mission-panel"]', ["mission-win", "mission-lose", "mission-progress"]);
      expect(f.all).toBeGreaterThanOrEqual(12);
      expect(f.body).toBeGreaterThanOrEqual(14);
      const a = (await areaBox(page, "transit-gate"))!;
      expect(a.w).toBeGreaterThan(100);
      // the gate label does not overlap the HUD chrome or another plot label
      const occ = await page.evaluate(() => (window as unknown as W).__sandPlot!.occupancy());
      const objBoxes = occ.filter((b) => (b as { group?: string }).group === "objective" || b.kind === "label");
      expect(objBoxes.length).toBeGreaterThan(0);
      await shot("2-objective-focused");
      expect(await canvas()).toEqual(c0);

      // 3. victory debrief: place the living carrier in the gate while held, then one production tick
      // decides. Unpausing first (pre-THREAT-1 order) opens the CSG under the picket line and the
      // first detection tick autopauses before the write; the clock never reaches UnitEntersArea.
      await page.evaluate((c) => {
        const s = (window as unknown as W).__sandSession as any;
        const u = s.gameState.sides.flatMap((x: any) => x.units).find((x: any) => x.id === "us-cvn-1");
        u.position = { lng: c.lng, lat: c.lat };
      }, GATE.centre);
      await page.getByTestId("sim-toggle-pause").click();
      await runUntilResult(page, 40_000);
      await expect(page.getByTestId("result-title")).toContainText(/VICTORY|COMPLETE/i);
      await page.waitForTimeout(600);
      await fits(page, "result-overlay");
      f = await fonts(page, '[data-testid="result-overlay"]', ["result-message", "result-deciding", "result-record"]);
      expect(f.all).toBeGreaterThanOrEqual(12);
      expect(f.body).toBeGreaterThanOrEqual(14);
      await shot("3-victory-debrief");
      expect(await canvas()).toEqual(c0);

      // 4. replay start
      await page.getByTestId("play-again").click();
      await expect(page.getByTestId("briefing")).toBeVisible();
      await page.waitForTimeout(2500);
      await shot("4-replay-start");
      expect(await canvas()).toEqual(c0);

      // 5. defeat debrief
      await page.keyboard.press("Escape");
      await page.getByTestId("sim-toggle-pause").click();
      await injectKillOnCarrier(page);
      await runUntilResult(page, 40_000);
      await restoreDice(page);
      await expect(page.getByTestId("result-title")).toContainText(/DEFEAT|LOST|FAILED/i);
      await page.waitForTimeout(600);
      await fits(page, "result-overlay");
      f = await fonts(page, '[data-testid="result-overlay"]', ["result-message", "result-deciding", "result-record"]);
      expect(f.all).toBeGreaterThanOrEqual(12);
      expect(f.body).toBeGreaterThanOrEqual(14);
      await shot("5-defeat-debrief");
      expect(await canvas()).toEqual(c0);
    } finally {
      await ctx.close();
    }
  });
}
