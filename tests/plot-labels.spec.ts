import { test, expect } from "@playwright/test";

// Walks every drawn data block, leader and weapon line while a real fight
// runs at 60x, flat for 60 s and then tilted for 60 s, in each display mode,
// and counts violations of the label rules. Block rects come from the DOM;
// leaders, glyphs, missile heads and weapon lines from what the plot drew.

interface Audit {
  blocks: number;
  blockOverlaps: number;
  leaderThroughBlock: number;
  leaderCrossings: number;
  leaderThroughGlyph: number;
  weaponThroughBlock: number;
  ambiguousPairing: number;
  farBlockNoVisibleLeader: number;
  blockOverGlyph: number;
  blockOverMissileHead: number;
  gridOverlaps: number;
  keptHidden: number;
  glyphs: number;
  leaders: number;
  weaponLines: number;
  closestGlyphs: number;
  tilt: number;
  mode: string;
  layout: { key: string; form: string; side: number }[];
}

const VIOLATIONS = [
  "blockOverlaps",
  "leaderThroughBlock",
  "leaderCrossings",
  "leaderThroughGlyph",
  "weaponThroughBlock",
  "ambiguousPairing",
  "farBlockNoVisibleLeader",
  "blockOverGlyph",
  "blockOverMissileHead",
  "gridOverlaps",
  "keptHidden",
] as const;

for (const mode of ["crt", "current", "offsig"] as const) {
  test.describe(`Plot labels — declutter in a running fight (${mode})`, () => {
    test(`no overlaps, crossings, ambiguous pairs or covered symbols, flat and tilted (${mode})`, async ({ page }) => {
      test.setTimeout(300_000);
      await page.addInitScript((m) => window.localStorage.setItem("sandkasten.display", m), mode);
      await page.goto("/play");
      await expect(page.getByTestId("plot-canvas")).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("terminal-root")).toHaveAttribute("data-display-mode", mode);

      // run the fight uninterrupted with a selection (rings and ring labels on)
      await page.getByLabel("Autopause settings").click();
      const toggle = page.getByTestId("autopause-toggle-enabled");
      if (((await toggle.textContent()) ?? "").trim() === "ON") await toggle.click();
      await page.keyboard.press("Escape");
      await page.getByTestId("force-row").first().click();
      await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
      await page.getByTestId("sim-toggle-pause").click(); // PLAY

      const totals: Record<string, number> = Object.fromEntries(VIOLATIONS.map((k) => [k, 0]));
      const stats = {
        samples: 0, denseSamples: 0, weaponSamples: 0, leaderSamples: 0, maxBlocks: 0, minClosestGlyphs: Infinity,
        blockSamples: 0, formFlips: 0, sideFlips: 0,
      };
      const firstBad: Record<string, string> = {};

      const run = async (phase: string, ms: number) => {
        // camera is still for the whole phase: count how often a block changes form or side
        const last = new Map<string, { form: string; side: number }>();
        const end = Date.now() + ms;
        while (Date.now() < end) {
          await page.waitForTimeout(200);
          const a = (await page.evaluate(() =>
            (document.querySelector('[data-testid="tactical-plot"]') as any).__plot.labelAudit(),
          )) as Audit;
          stats.samples++;
          stats.maxBlocks = Math.max(stats.maxBlocks, a.blocks);
          if (a.closestGlyphs >= 0) stats.minClosestGlyphs = Math.min(stats.minClosestGlyphs, a.closestGlyphs);
          if (a.closestGlyphs >= 0 && a.closestGlyphs < 40) stats.denseSamples++;
          if (a.weaponLines > 0) stats.weaponSamples++;
          if (a.leaders > 0) stats.leaderSamples++;
          for (const k of VIOLATIONS) {
            totals[k] += a[k];
            if (a[k] > 0 && !firstBad[k]) firstBad[k] = `${phase}: ${JSON.stringify({ ...a, layout: undefined })}`;
          }
          for (const b of a.layout) {
            stats.blockSamples++;
            const prev = last.get(b.key);
            if (prev && prev.form !== b.form) stats.formFlips++;
            if (prev && prev.side !== b.side) stats.sideFlips++;
            last.set(b.key, { form: b.form, side: b.side });
          }
        }
      };

      await run("flat", 60_000);
      await page.keyboard.press("t");
      await expect
        .poll(() => page.evaluate(() => (document.querySelector('[data-testid="tactical-plot"]') as any).__plot.view().tilt))
        .toBeGreaterThan(0.95);
      await page.waitForTimeout(1500);
      await run("tilt", 60_000);

      console.log(`plot-labels audit [${mode}]: ${JSON.stringify({ ...stats, ...totals })}`);
      for (const k of Object.keys(firstBad)) console.log(`first ${k} [${mode}]: ${firstBad[k]}`);

      // the run has to have exercised the hard cases
      expect(stats.samples).toBeGreaterThan(300);
      expect(stats.denseSamples).toBeGreaterThan(0);
      expect(stats.weaponSamples).toBeGreaterThan(0);
      expect(stats.leaderSamples).toBeGreaterThan(0);
      // and broken none of the rules, ever
      expect(totals).toEqual(Object.fromEntries(VIOLATIONS.map((k) => [k, 0])));
      // with the camera still, blocks hold their form and side. At 60x a fighter
      // crosses ~18 px of screen a second, so some moves are forced; bound them
      // to under four per block per minute (measured rates are in NOTES)
      const blockMinutes = stats.blockSamples / (5 * 60);
      const flipRate = (stats.formFlips + stats.sideFlips) / Math.max(1, blockMinutes);
      console.log(`plot-labels flips per block-minute [${mode}]: ${flipRate.toFixed(2)}`);
      expect(flipRate).toBeLessThan(4);
    });
  });
}
