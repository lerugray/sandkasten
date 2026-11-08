import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { openPlay, sessionState, autopauseOff, runUntilResult, injectKillOnCarrier, restoreDice, type W } from "./helpers/sandPlay";

const OUT = path.join(process.cwd(), "docs", "verification", "sand-victory-1-s409");
const SIZES = [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }];

/** Fixtures write scripted endings into the live session's event list (read by the UI exactly as a scenario's own are). */
async function addEnding(page: Page, ev: Record<string, unknown>, score?: Record<string, number>) {
  await page.evaluate(([e, sc]) => {
    const s = (window as unknown as W).__sandSession as any;
    s.eventState = { ...s.eventState, events: [...s.eventState.events, e] };
    if (sc) s.gameState = { ...s.gameState, score: { ...s.gameState.score, ...sc } };
  }, [ev, score ?? null] as const);
}

const ending = (name: string, result: "victory" | "defeat" | "draw", side: string, threshold: number, message: string) => ({
  name, repeatable: false, triggers: [{ type: "SideScore", side, threshold, comparison: "gte" }], conditions: [],
  actions: [{ type: "EndScenario", result, message }],
});

async function shotBoth(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  const vp = page.viewportSize()!;
  const manifestPath = path.join(OUT, "frames.json");
  const manifest: Record<string, unknown> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  for (const s of SIZES) {
    await page.setViewportSize(s);
    await page.waitForTimeout(900);
    const file = `${s.width}x${s.height}-${name}.png`;
    const buf = await page.screenshot({ path: path.join(OUT, file) });
    manifest[file] = { sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length, viewport: `${s.width}x${s.height}`, dpr: await page.evaluate(() => window.devicePixelRatio) };
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  await page.setViewportSize(vp);
  await page.waitForTimeout(500);
}

const runLive = async (page: Page) => {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("briefing")).toBeHidden();
  await autopauseOff(page);
  await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
  const label = ((await page.getByTestId("sim-toggle-pause").textContent()) ?? "").trim();
  if (/PLAY/i.test(label)) await page.getByTestId("sim-toggle-pause").click();
};

type Fresh = { score: Record<string, number>; result: string | null; fired: number; eventNames: string[]; simTime: number; log: number };
const freshState = (page: Page): Promise<Fresh> =>
  page.evaluate(() => {
    const snap = ((window as unknown as W).__sandSession as any).snapshot();
    return {
      score: { ...snap.gameState.score },
      result: snap.eventState?.scenarioResult?.result ?? null,
      fired: snap.eventState?.firedEvents?.size ?? 0,
      eventNames: (snap.eventState?.events ?? []).map((e: any) => e.name),
      simTime: snap.gameState.simTime,
      log: snap.combatState.combatLog.length,
    };
  });

test.describe("SAND-VICTORY-1: which rule ended the run, the score beside it, and a clean second run", () => {
  test("a scripted score ending names its rule, shows the score, and PLAY AGAIN starts fresh", async ({ browser }) => {
    test.setTimeout(400_000);
    const ctx = await browser.newContext({ viewport: SIZES[0], deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      const base = await freshState(page);
      const baseNames = base.eventNames;
      // briefing before the run: the shipped pair is stated, nothing else is claimed
      await expect(page.getByTestId("briefing-mission")).toContainText(/transit gate/i);
      await addEnding(page, ending("Fixture Score Win", "victory", "US Navy", 40, "Fixture: score line reached."), { "US Navy": 40 });
      await runLive(page);
      await runUntilResult(page, 120_000);
      await expect(page.getByTestId("result-title")).toContainText("VICTORY");
      await expect(page.getByTestId("result-deciding")).toContainText(/Ending rule met/i);
      await expect(page.getByTestId("result-deciding")).toContainText(/score/i);
      await expect(page.getByTestId("result-deciding")).not.toContainText(/entered the transit gate/i);
      await expect(page.getByTestId("result-score")).toContainText(/US NAVY 40/);
      await expect(page.getByTestId("result-score-note")).toContainText(/SCORE DECIDED/i);
      // internal event names are never player text
      expect(await page.getByTestId("result-overlay").innerText()).not.toContain("Fixture Score Win");
      await shotBoth(page, "fixture-score-victory-debrief");
      const finished = await freshState(page);
      expect(finished.result).toBe("victory");

      await page.getByTestId("play-again").click();
      await expect(page.getByTestId("briefing")).toBeVisible();
      await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "pending");
      const again = await freshState(page);
      expect(again.result).toBeNull();
      expect(again.score["US Navy"] ?? 0).toBe(0);
      expect(again.fired).toBeLessThanOrEqual(base.fired);
      expect(again.eventNames).toEqual(baseNames);
      expect(again.simTime).toBe(base.simTime);
      expect(again.log).toBe(0);
      await expect(page.getByTestId("result-overlay")).toHaveCount(0);
      await expect(page.getByTestId("briefing-mission")).toContainText(/transit gate/i);
    } finally {
      await ctx.close();
    }
  });

  test("a scripted draw and a combat-loss defeat each name their own rule", async ({ browser }) => {
    test.setTimeout(400_000);
    const ctx = await browser.newContext({ viewport: SIZES[0], deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      await addEnding(page, ending("Fixture Stalemate", "draw", "Iran", 5, "Fixture: stalemate."), { Iran: 5 });
      await runLive(page);
      await runUntilResult(page, 120_000);
      await expect(page.getByTestId("result-title")).toContainText("DRAW");
      await expect(page.getByTestId("result-deciding")).toContainText(/Ending rule met/i);
      await expect(page.getByTestId("result-score")).toContainText(/IRAN 5/);
      await expect(page.getByTestId("result-score-note")).toContainText(/SCORE DECIDED/i);
      await shotBoth(page, "fixture-score-draw-debrief");

      await page.getByTestId("play-again").click();
      await expect(page.getByTestId("briefing")).toBeVisible();
      expect((await freshState(page)).score.Iran ?? 0).toBe(0);

      // the carrier is destroyed by the production combat path: the shipped transit-loss rule, not a score
      await runLive(page);
      await injectKillOnCarrier(page);
      await runUntilResult(page, 240_000);
      await restoreDice(page);
      await expect(page.getByTestId("result-title")).toContainText("DEFEAT");
      await expect(page.getByTestId("result-deciding")).toContainText(/destroyed/i);
      await expect(page.getByTestId("result-score-note")).toContainText(/TALLY/i);
      await expect(page.getByTestId("result-score")).toBeVisible();
      await shotBoth(page, "fixture-carrier-loss-defeat-debrief");
      const lost = await sessionState(page);
      expect(lost.result).toBe("defeat");
    } finally {
      await ctx.close();
    }
  });

  test("the debrief, the final-record view and the hold strip never overlap each other", async ({ browser }) => {
    test.setTimeout(400_000);
    const ctx = await browser.newContext({ viewport: SIZES[0], deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      await addEnding(page, ending("Fixture Score Win", "victory", "US Navy", 1, "Fixture."), { "US Navy": 1 });
      await runLive(page);
      await runUntilResult(page, 120_000);
      for (const size of SIZES) {
        await page.setViewportSize(size);
        await page.waitForTimeout(700);
        await page.getByTestId("review-record").click().catch(() => {});
        await expect(page.getByTestId("result-strip")).toBeVisible();
        const boxes = await page.evaluate(() => {
          const r = (id: string) => {
            const e = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
            if (!e) return null;
            const b = e.getBoundingClientRect();
            return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom };
          };
          const strip = r("result-strip");
          const out: Record<string, unknown> = { strip, vw: window.innerWidth };
          const others: Record<string, ReturnType<typeof r>> = {};
          for (const id of ["tx-right", "mission-panel", "sim-toggle-pause", "sim-state"]) others[id] = r(id);
          for (const el of document.querySelectorAll(".tx-right, .tx-title, .tx-topbar")) {
            const b = el.getBoundingClientRect();
            others[el.className.toString().split(" ")[0]] = { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom };
          }
          out.others = others;
          return out;
        });
        const strip = boxes.strip as { x: number; y: number; right: number; bottom: number };
        for (const [name, o] of Object.entries(boxes.others as Record<string, { x: number; y: number; right: number; bottom: number } | null>)) {
          if (!o) continue;
          const overlap = strip.x < o.right && strip.right > o.x && strip.y < o.bottom && strip.bottom > o.y;
          expect(overlap, `${size.width}x${size.height}: result strip overlaps ${name}`).toBe(false);
        }
        await shotBoth(page, `strip-${size.width}-final-record`);
        await page.getByTestId("play-again").first().focus();
      }
    } finally {
      await ctx.close();
    }
  });
});
