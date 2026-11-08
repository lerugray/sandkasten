import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { openPlay, clickGeo, sessionState, wegoState, autopauseOff, runUntilResult, GATE, type W } from "./helpers/sandPlay";

const OUT = path.join(process.cwd(), "docs", "verification", "sand-victory-1-s409");
const SIZES = [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }];

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

const phaseOf = (page: Page) => page.getByTestId("turn-panel").getAttribute("data-phase");
const waitPhase = (page: Page, phase: string, timeout = 120_000) =>
  expect(page.getByTestId("turn-panel")).toHaveAttribute("data-phase", phase, { timeout });
const setSpeed = (page: Page, label: string) => page.getByTestId("sim-speed").filter({ hasText: label }).click();

async function orderShip(page: Page, rowText: string | RegExp, waypoints: { lng: number; lat: number }[], throttle: string) {
  await page.getByTestId("force-row").filter({ hasText: rowText }).first().click();
  await expect(page.getByTestId("order-panel")).toBeVisible();
  await page.getByTestId("order-add-waypoint").click();
  await expect(page.getByText("CLICK MAP TO PLACE WAYPOINT")).toBeVisible();
  if (waypoints[0].lat > 26.4) {
    await page.getByTestId("mission-focus-gate").click();
    await page.waitForTimeout(3500);
  }
  for (const [i, w] of waypoints.entries()) {
    await clickGeo(page, w.lng, w.lat);
    await expect(page.getByTestId("order-waypoint-item")).toHaveCount(i + 1);
  }
  await page.keyboard.press("Escape");
  await page.getByTestId("order-throttle").filter({ hasText: throttle }).click();
}

async function debriefRead(page: Page) {
  const txt = async (id: string) => (await page.getByTestId(id).innerText()).replace(/\s+/g, " ").trim();
  return {
    title: await txt("result-title"),
    message: await txt("result-message"),
    deciding: await txt("result-deciding"),
    score: await txt("result-score"),
    losses: await txt("result-losses"),
    condition: await txt("result-condition"),
    record: await txt("result-record-count"),
  };
}

async function sessionFacts(page: Page) {
  return page.evaluate(() => {
    const snap = ((window as unknown as W).__sandSession as any).snapshot();
    const side = snap.gameState.scenario.playerSide as string;
    const own = snap.gameState.sides.flatMap((s: any) => s.units).filter((u: any) => u.side === side);
    const res = snap.eventState?.scenarioResult;
    return {
      result: res?.result ?? null,
      source: res?.source ?? null,
      score: { ...snap.gameState.score },
      simTime: snap.gameState.simTime as number,
      ownStates: Object.fromEntries(own.map((u: any) => [u.name, u.damageState])),
      godMode: snap.gameState.godMode ?? null,
      fired: [...(snap.eventState?.firedEvents ?? [])],
      orders: [...snap.gameState.orders.entries()].filter(([id]: any) => own.some((u: any) => u.id === id)).map(([id, o]: any) => [id, (o.waypoints ?? []).length, o.throttle ?? null]),
    };
  });
}

test.describe("SAND-VICTORY-1: two real wins with different orders, the second after PLAY AGAIN", () => {
  test("direct/flank continuous, then escorted dog-leg WeGo", async ({ browser }, info) => {
    test.setTimeout(2_400_000);
    mkdirSync(OUT, { recursive: true });
    const ctx = await browser.newContext({ viewport: SIZES[0], deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const log: Record<string, unknown> = {};
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      const renderer = await page.evaluate(() => (window as unknown as W).__sandPlot!.rendererInfo().renderer);
      info.annotations.push({ type: "renderer", description: renderer });
      log.renderer = renderer;
      await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
      await expect(page.getByTestId("briefing-mission")).toContainText(/transit gate/i);
      await shotBoth(page, "play-briefing");

      // --- run 1: continuous, direct flank: Nimitz alone, straight to the gate at flank
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("briefing")).toBeHidden();
      await page.getByTestId("mission-focus-unit").click();
      await page.getByTestId("order-add-waypoint").click();
      await page.getByTestId("mission-focus-gate").click();
      await page.waitForTimeout(3500);
      await clickGeo(page, GATE.centre.lng, GATE.centre.lat);
      await expect(page.getByTestId("order-waypoint-item")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await page.getByTestId("order-throttle").filter({ hasText: "FLANK" }).click();
      await autopauseOff(page);
      await setSpeed(page, "60x");
      await page.getByTestId("sim-toggle-pause").click();
      await runUntilResult(page, 600_000);
      const run1 = { orders: "Nimitz only, one waypoint at the gate centre, FLANK, continuous 60x", debrief: await debriefRead(page), facts: await sessionFacts(page) };
      log.run1 = run1;
      expect(await page.getByLabel("Toggle god mode").getAttribute("data-active")).toBe("false");
      await shotBoth(page, "play1-debrief");

      // --- PLAY AGAIN: a clean paused run, then different orders in WeGo
      await page.getByTestId("play-again").click();
      await expect(page.getByTestId("briefing")).toBeVisible();
      await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "pending");
      const fresh = await sessionFacts(page);
      expect(fresh.result).toBeNull();
      expect(fresh.score["US Navy"] ?? 0).toBe(0);
      log.freshAfterReplay = fresh;
      await page.getByTestId("mode-wego").click();
      await page.getByTestId("turn-length-5").click();
      await page.getByTestId("briefing-show-gate").click();
      await expect(page.getByTestId("briefing")).toBeHidden();
      await page.waitForTimeout(3500);
      const escortGoal = { lng: 56.5, lat: 26.6 };
      for (const row of [/Chosin/, /Mahan/, /Cole/]) await orderShip(page, row, [escortGoal], "FULL");
      await orderShip(page, /Nimitz/, [{ lng: 57.0, lat: 25.9 }, GATE.centre], "FULL");
      await setSpeed(page, "60x");
      await shotBoth(page, "play2-orders");
      let turns = 0;
      for (let n = 1; n <= 70; n++) {
        if (await page.getByTestId("result-overlay").isVisible()) break;
        await waitPhase(page, "planning");
        await page.getByTestId("cmd-commit").click({ timeout: 20_000 });
        await expect.poll(async () => (await wegoState(page)).phase, { timeout: 20_000 }).not.toBe("planning");
        await expect
          .poll(async () => ((await page.getByTestId("result-overlay").isVisible()) ? "result" : await phaseOf(page)), { timeout: 240_000, intervals: [500] })
          .toMatch(/review|result/);
        turns = n;
        if (await page.getByTestId("result-overlay").isVisible()) break;
        await page.getByTestId("cmd-next-turn").click();
      }
      await expect(page.getByTestId("result-overlay")).toBeVisible();
      const run2 = { orders: "Chosin, Mahan, Cole to (56.5, 26.6) FULL; Nimitz dog-leg via (57.0, 25.9) to the gate, FULL; WeGo 5 min", turns, debrief: await debriefRead(page), facts: await sessionFacts(page) };
      log.run2 = run2;
      expect(await page.getByLabel("Toggle god mode").getAttribute("data-active")).toBe("false");
      await shotBoth(page, "play2-debrief");
      expect(run1.facts.orders).not.toEqual(run2.facts.orders);
      expect(Object.keys(run2.facts).length).toBeGreaterThan(0);
      const after = await sessionState(page);
      log.run2End = { simTime: after.simTime, result: after.result };
    } finally {
      writeFileSync(path.join(OUT, "two-plays.json"), JSON.stringify(log, null, 2));
      await ctx.close();
    }
  });
});
