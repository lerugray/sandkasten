import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { openPlay, clickGeo, sessionState, wegoState, autopauseOff, injectKillOnCarrier, restoreDice, GATE, type W } from "./helpers/sandPlay";

const OUT = path.join(process.cwd(), "docs", "verification", "sand-wego-1-s409");
const SIZES = [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }];

/** Real mouse/keyboard play only. Where a check needs the live session it only reads it. */

async function pickWeGo(page: Page, minutes: 1 | 5 | 15) {
  await expect(page.getByTestId("briefing")).toBeVisible();
  await expect(page.getByTestId("mode-continuous")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("mode-wego").click();
  await expect(page.getByTestId("mode-wego")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId(`turn-length-${minutes}`).click();
  await expect(page.getByTestId(`turn-length-${minutes}`)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("mode-explain")).toContainText(/WeGo vs AI/);
}

async function takeCommand(page: Page) {
  await page.getByTestId("briefing-show-gate").click();
  await expect(page.getByTestId("briefing")).toBeHidden();
  await page.waitForTimeout(3500); // the camera glide to the gate finishes before any map click
}

async function phaseOf(page: Page) {
  return page.getByTestId("turn-panel").getAttribute("data-phase");
}

async function waitPhase(page: Page, phase: string, timeout = 120_000) {
  await expect(page.getByTestId("turn-panel")).toHaveAttribute("data-phase", phase, { timeout });
}

async function orderShip(page: Page, rowText: string | RegExp, waypoints: { lng: number; lat: number }[], throttle: string) {
  await page.getByTestId("force-row").filter({ hasText: rowText }).first().click();
  await expect(page.getByTestId("order-panel")).toBeVisible();
  await page.getByTestId("order-add-waypoint").click();
  await expect(page.getByText("CLICK MAP TO PLACE WAYPOINT")).toBeVisible();
  if (waypoints[0].lat > 26.4) {
    // selecting a ship re-centres the camera on it; bring the gate back into view, as a player would
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

/** Stage one fire order the way a player does: pick a shooter, pick a held contact, press ENGAGE. */
async function stageFire(page: Page): Promise<string | null> {
  const names = ["Hornet 101", "Hornet 102", "USS Cole", "USS Mahan", "USS Chosin", "USS Nitze", "USS Nimitz"];
  for (const name of names) {
    const row = page.getByTestId("force-row").filter({ hasText: name }).first();
    if (!(await row.isVisible())) continue;
    await row.click();
    const select = page.getByTestId("order-engage-contact");
    if (!(await select.isVisible().catch(() => false))) continue;
    const options = await select.locator("option").count();
    for (let i = 1; i < options; i++) {
      await select.selectOption({ index: i });
      await page.getByTestId("order-engage").click();
      if ((await page.getByTestId("order-engage-feedback").getAttribute("data-ok")) === "true") return name;
    }
  }
  return null;
}

async function setSpeed(page: Page, label: string) {
  await page.getByTestId("sim-speed").filter({ hasText: label }).click();
}

/** Commit with the button, then wait for the bounded resolution to finish into review (or a result). */
async function commitAndResolve(page: Page) {
  await page.getByTestId("cmd-commit").click();
  await expect.poll(async () => (await wegoState(page)).phase, { timeout: 20_000 }).not.toBe("planning");
  await expect
    .poll(async () => ((await page.getByTestId("result-overlay").isVisible()) ? "result" : await phaseOf(page)), { timeout: 240_000, intervals: [500] })
    .toMatch(/review|result/);
}

/** A mid-run check that every control the planning phase offers is dead while turns resolve or are reviewed. */
async function assertCommandLock(page: Page, phase: "resolving" | "review") {
  const before = await sessionState(page);
  const wBefore = await wegoState(page);
  await page.getByTestId("force-row").nth(1).click();
  await page.getByTestId("force-row").nth(0).click();
  await expect(page.getByTestId("orders-locked")).toBeVisible();
  await expect(page.getByTestId("order-panel")).toHaveCount(0);
  await expect(page.getByTestId("cmd-engage")).toBeDisabled();
  await expect(page.getByTestId("cmd-roe")).toBeDisabled();
  await expect(page.getByTestId("cmd-commit")).toHaveCount(0);
  for (const k of ["e", "r", "x", "c", "f", "1", "2", "3", "4", "5", "6"]) await page.keyboard.press(k);
  await clickGeo(page, 56.9, 26.2);
  await clickGeo(page, GATE.centre.lng, GATE.centre.lat);
  await expect(page.getByTestId("order-panel")).toHaveCount(0);
  const after = await sessionState(page);
  // while resolving, units legitimately consume reached waypoints; what must never appear is a waypoint from the stray click
  const stray = (o: string) => (JSON.parse(o) as [string, { waypoints: { position: { lng: number; lat: number } }[] }][]).some(([, ord]) => ord.waypoints.some((w) => Math.abs(w.position.lng - 56.9) < 0.03 && Math.abs(w.position.lat - 26.2) < 0.03));
  expect(stray(after.orders)).toBe(false);
  if (phase === "review") expect(after.orders).toBe(before.orders);
  const wAfter = await wegoState(page);
  expect(wAfter.intents).toBe(wBefore.intents);
  if (phase === "review") {
    expect(after.simTime).toBe(before.simTime);
    expect(after.units).toBe(before.units);
    await page.keyboard.press("Space");
    expect((await sessionState(page)).simTime).toBe(before.simTime);
    await expect(page.getByTestId("sim-toggle-pause")).toHaveCount(0);
  }
}

async function shotBoth(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  const vp = page.viewportSize()!;
  for (const s of SIZES) {
    await page.setViewportSize(s);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `${s.width}x${s.height}-${name}.png`) });
  }
  await page.setViewportSize(vp);
  await page.waitForTimeout(500);
}

type RunLog = { turns: number; queued: { turn: number; shooter: string; logBeforeCommit: number; logAfterStage: number; simAfterStage: number; simBeforeCommit: number; logAfterTurn: number }[]; minutes: number };

/**
 * Plays turns through the ordinary UI until a result overlay shows. When queueFire is set, the first time a held contact allows it a manual
 * ENGAGE is staged, the page waits real time to show nothing happens, and only the commit executes it.
 */
async function playOut(page: Page, minutes: number, queueFire: boolean, maxTurns = 40): Promise<RunLog> {
  const log: RunLog = { turns: 0, queued: [], minutes };
  let queuedOnce = false;
  for (let n = 1; n <= maxTurns; n++) {
    if (await page.getByTestId("result-overlay").isVisible()) break;
    await waitPhase(page, "planning");
    if (queueFire && !queuedOnce) {
      const w = await wegoState(page);
      if (w.contacts.some((c) => c.cls !== "unknown")) {
        const s0 = await sessionState(page);
        const shooter = await stageFire(page);
        if (shooter) {
          const s1 = await sessionState(page);
          await expect(page.getByTestId("staged-fire")).toHaveCount(1);
          await page.waitForTimeout(2500);
          const s2 = await sessionState(page);
          // staged only: no launch, no clock, no weapon in flight while the plan is open
          expect(s2.simTime).toBe(s0.simTime);
          expect(s2.log).toBe(s0.log);
          expect(s2.flight).toBe(s0.flight);
          expect(await phaseOf(page)).toBe("planning");
          await commitAndResolve(page);
          const s3 = await sessionState(page);
          log.queued.push({ turn: n, shooter, logAfterStage: s1.log, logBeforeCommit: s2.log, simAfterStage: s1.simTime, simBeforeCommit: s2.simTime, logAfterTurn: s3.log });
          expect(s3.log).toBeGreaterThan(s2.log);
          queuedOnce = true;
          log.turns = n;
          if (await page.getByTestId("result-overlay").isVisible()) break;
          await page.getByTestId("cmd-next-turn").click();
          continue;
        }
        await page.getByTestId("staged-count").waitFor();
      }
    }
    await commitAndResolve(page);
    log.turns = n;
    if (await page.getByTestId("result-overlay").isVisible()) break;
    await expect(page.getByTestId("turn-review")).toBeVisible();
    await page.getByTestId("cmd-next-turn").click();
  }
  return log;
}

test.describe("SAND-WEGO-1: the turn loop and the command lock", () => {
  test("mode choice, planning, a queued ENGAGE that waits, commit, resolution lock, review, next turn", async ({ page }) => {
    test.setTimeout(420_000);
    await openPlay(page, "/play", { e2eHandle: true });
    await pickWeGo(page, 1);
    await takeCommand(page);

    // planning: time is held, no clock control, orders open
    await waitPhase(page, "planning");
    await expect(page.getByTestId("turn-tag")).toContainText(/TURN 1.*1 MIN/i);
    await expect(page.getByTestId("sim-state")).toContainText(/PLANNING/);
    await expect(page.getByTestId("sim-toggle-pause")).toHaveCount(0);
    const w0 = await wegoState(page);
    expect(w0).toMatchObject({ mode: "wego", phase: "planning", turnNumber: 1, turnsCommitted: 0, paused: true });
    // the mode is locked once chosen: the briefing offers it, play does not change it
    await page.keyboard.press("Space");
    await page.waitForTimeout(1500);
    expect((await wegoState(page)).simTime).toBe(w0.simTime);

    // simultaneous orders: two ships get orders in the same planning phase, nothing moves until commit
    const before = await sessionState(page);
    await orderShip(page, /Nimitz/, [GATE.centre], "FLANK");
    await orderShip(page, /Chosin/, [{ lng: 56.5, lat: 26.6 }], "FULL");
    const planned = await sessionState(page);
    expect(planned.simTime).toBe(before.simTime);
    expect(planned.units).toBe(before.units);
    expect(planned.orders).not.toBe(before.orders);
    await setSpeed(page, "60x");

    // commit by keyboard: Enter from the page, not the button
    await page.locator("body").click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.keyboard.press("Enter");
    await waitPhase(page, "resolving", 20_000);
    await expect(page.getByTestId("sim-state")).toContainText(/RESOLVING/);
    await assertCommandLock(page, "resolving");
    await waitPhase(page, "review", 120_000);
    const w1 = await wegoState(page);
    expect(w1.turnEnd - w1.turnStart).toBe(60_000);
    expect(w1.simTime).toBe(w1.turnEnd);
    expect(w1.turnsCommitted).toBe(1);
    await expect(page.getByTestId("turn-review")).toBeVisible();
    await expect(page.getByTestId("review-contacts")).toBeVisible();
    await expect(page.getByTestId("sim-state")).toContainText(/REVIEW/);
    const after = await sessionState(page);
    expect(after.units).not.toBe(planned.units); // both ordered ships moved during the same resolution
    await assertCommandLock(page, "review");

    // next turn opens planning again; the committed orders persist and can be changed
    await page.getByTestId("review-next-turn").click();
    await waitPhase(page, "planning", 10_000);
    expect(await wegoState(page)).toMatchObject({ phase: "planning", turnNumber: 2, turnsCommitted: 1 });

    // run more one-minute turns until a held contact lets a manual ENGAGE be staged; it must wait for the commit
    let staged: string | null = null;
    for (let n = 2; n <= 24 && !staged; n++) {
      await waitPhase(page, "planning");
      const w = await wegoState(page);
      if (w.contacts.some((c) => c.cls !== "unknown")) staged = await stageFire(page);
      if (staged) break;
      await commitAndResolve(page);
      if (await page.getByTestId("result-overlay").isVisible()) break;
      await page.getByTestId("cmd-next-turn").click();
    }
    expect(staged, "a manual ENGAGE could be staged on a held contact").not.toBeNull();
    await expect(page.getByTestId("staged-fire")).toHaveCount(1);
    const s1 = await sessionState(page);
    await page.waitForTimeout(2500);
    const s2 = await sessionState(page);
    expect(s2.simTime).toBe(s1.simTime);
    expect(s2.log).toBe(s1.log);
    expect(s2.flight).toBe(s1.flight);
    // cancel and re-stage proves a staged order is reversible before commit
    await page.getByTestId("staged-cancel").click();
    await expect(page.getByTestId("staged-fire")).toHaveCount(0);
    expect(await stageFire(page)).not.toBeNull();
    await expect(page.getByTestId("staged-fire")).toHaveCount(1);
    await commitAndResolve(page);
    const s3 = await sessionState(page);
    expect(s3.log).toBeGreaterThan(s2.log);
    if (!(await page.getByTestId("result-overlay").isVisible())) {
      await expect(page.getByTestId("review-fire")).toBeVisible();
    }
    mkdirSync(OUT, { recursive: true });
    writeFileSync(path.join(OUT, "flow-queued-fire.json"), JSON.stringify({ shooter: staged, stagedAt: s1, waitedAt: s2, afterCommit: s3 }, null, 2));
  });

  test("both sides stay in fog: the review lists only what the player's side saw", async ({ page }) => {
    test.setTimeout(240_000);
    await openPlay(page, "/play", { e2eHandle: true });
    await pickWeGo(page, 5);
    await takeCommand(page);
    await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
    await orderShip(page, /Nimitz/, [GATE.centre], "FLANK");
    await setSpeed(page, "60x");
    await commitAndResolve(page);
    const w = await wegoState(page);
    expect(w.turnEnd - w.turnStart).toBe(300_000);
    // the review's contact line counts what the player's own contact store holds, never the AI's order of battle
    const held = await page.getByTestId("review-contacts").innerText();
    expect(held).toContain(`CONTACTS HELD ${w.contacts.length}`);
    const text = (await page.getByTestId("turn-review").innerText()).toLowerCase();
    for (const secret of ["boghammar 50", "tn2000", "tn8803"]) {
      if (!w.contacts.length) expect(text).not.toContain(secret);
    }
    await page.getByTestId("review-next-turn").click();
    await waitPhase(page, "planning", 10_000);
    // the god-mode toggle still works and is off by default in both modes
    await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
  });
});

test.describe("SAND-WEGO-1: two real victories through the ordinary UI (GOD off)", () => {
  test("plan A: the carrier alone, flank, straight at the gate (with a queued ENGAGE)", async ({ browser }, info) => {
    test.setTimeout(900_000);
    mkdirSync(OUT, { recursive: true });
    const ctx = await browser.newContext({ viewport: SIZES[0], deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
      const renderer = await page.evaluate(() => (window as unknown as W).__sandPlot!.rendererInfo().renderer);
      info.annotations.push({ type: "renderer", description: renderer });
      await pickWeGo(page, 5);
      await shotBoth(page, "1-briefing-mode-choice");
      await takeCommand(page);
      await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
      await page.getByTestId("mission-focus-unit").click();
      await expect(page.getByTestId("order-panel")).toBeVisible();
      await page.getByTestId("order-add-waypoint").click();
      await page.getByTestId("mission-focus-gate").click();
      await page.waitForTimeout(3500);
      await clickGeo(page, GATE.centre.lng, GATE.centre.lat);
      await expect(page.getByTestId("order-waypoint-item")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await page.getByTestId("order-throttle").filter({ hasText: "FLANK" }).click();
      await setSpeed(page, "60x");
      await shotBoth(page, "2-planning-orders-gate");

      const run = await playOut(page, 5, true);
      await expect(page.getByTestId("result-title")).toContainText(/VICTORY|COMPLETE/i, { timeout: 30_000 });
      await expect(page.getByTestId("result-deciding")).toContainText(/Nimitz/);
      await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "complete");
      await expect(page.getByTestId("result-turns")).toBeVisible();
      expect(run.queued.length).toBe(1);
      const record = await page.getByTestId("result-record").innerText();
      const result = {
        plan: "A direct flank",
        turns: run.turns,
        queued: run.queued,
        result: await page.getByTestId("result-title").innerText(),
        deciding: await page.getByTestId("result-deciding").innerText(),
        turnsLine: await page.getByTestId("result-turns").innerText(),
        clock: await page.getByTestId("sim-clock").innerText(),
        record,
        renderer,
        godMode: await page.getByLabel("Toggle god mode").getAttribute("data-active"),
        state: await wegoState(page),
      };
      writeFileSync(path.join(OUT, "victory-A-direct-flank.json"), JSON.stringify(result, null, 2));
      await shotBoth(page, "5-victory-debrief-A");
      await expect(page.getByTestId("sim-state")).toContainText(/ENDED/);
      await expect(page.getByTestId("sim-state")).not.toContainText(/HOLD/);
      // clean replay
      await page.getByTestId("play-again").click();
      await expect(page.getByTestId("briefing")).toBeVisible();
      await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "pending");
      const w = await wegoState(page);
      expect(w).toMatchObject({ phase: "planning", turnNumber: 1, turnsCommitted: 0, intents: 0 });
      const s = await sessionState(page);
      expect(s.result).toBeNull();
      await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
      await shotBoth(page, "7-replay-start");
    } finally {
      await ctx.close();
    }
  });

  test("plan B: escorts ahead to the gate, the carrier by a southern dog-leg at full", async ({ browser }, info) => {
    test.setTimeout(900_000);
    mkdirSync(OUT, { recursive: true });
    const ctx = await browser.newContext({ viewport: SIZES[0], deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      const renderer = await page.evaluate(() => (window as unknown as W).__sandPlot!.rendererInfo().renderer);
      info.annotations.push({ type: "renderer", description: renderer });
      await pickWeGo(page, 5);
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("briefing")).toBeHidden();
      await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
      const escortGoal = { lng: 56.5, lat: 26.6 };
      for (const row of [/Chosin/, /Mahan/, /Cole/]) await orderShip(page, row, [escortGoal], "FULL");
      await orderShip(page, /Nimitz/, [{ lng: 57.0, lat: 25.9 }, GATE.centre], "FULL");
      await setSpeed(page, "60x");

      // capture the lock while turn 1 resolves and the review that follows, in the real UI at both sizes
      await page.getByTestId("cmd-commit").click();
      await waitPhase(page, "resolving", 20_000);
      await shotBoth(page, "3-resolving-lock");
      await waitPhase(page, "review", 120_000);
      await shotBoth(page, "4-review");
      await page.getByTestId("cmd-next-turn").click();

      const run = await playOut(page, 5, false, 60);
      await expect(page.getByTestId("result-title")).toContainText(/VICTORY|COMPLETE/i, { timeout: 30_000 });
      await expect(page.getByTestId("result-deciding")).toContainText(/Nimitz/);
      await expect(page.getByTestId("result-deciding")).toContainText(/gate/i);
      const result = {
        plan: "B escorts + dog-leg",
        turns: run.turns + 1,
        result: await page.getByTestId("result-title").innerText(),
        deciding: await page.getByTestId("result-deciding").innerText(),
        turnsLine: await page.getByTestId("result-turns").innerText(),
        clock: await page.getByTestId("sim-clock").innerText(),
        record: await page.getByTestId("result-record").innerText(),
        renderer,
        godMode: await page.getByLabel("Toggle god mode").getAttribute("data-active"),
        state: await wegoState(page),
      };
      writeFileSync(path.join(OUT, "victory-B-escorted-dogleg.json"), JSON.stringify(result, null, 2));
      await shotBoth(page, "6-victory-debrief-B");
    } finally {
      await ctx.close();
    }
  });

  test("a defeat resolves through the same turn path, then PLAY AGAIN replays cleanly", async ({ browser }) => {
    test.setTimeout(300_000);
    mkdirSync(OUT, { recursive: true });
    const ctx = await browser.newContext({ viewport: SIZES[0], deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      await pickWeGo(page, 1);
      await takeCommand(page);
      await orderShip(page, /Nimitz/, [GATE.centre], "FLANK");
      await setSpeed(page, "60x");
      await injectKillOnCarrier(page);
      await page.getByTestId("cmd-commit").click();
      await expect(page.getByTestId("result-overlay")).toBeVisible({ timeout: 120_000 });
      await restoreDice(page);
      await expect(page.getByTestId("result-title")).toContainText(/DEFEAT|FAIL|LOST/i);
      await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "failed");
      await expect(page.getByTestId("sim-state")).toContainText(/ENDED/);
      await expect(page.getByTestId("sim-state")).not.toContainText(/HOLD/);
      await expect(page.getByTestId("cmd-commit")).toHaveCount(0);
      await shotBoth(page, "8-defeat-debrief");
      const s = await sessionState(page);
      await page.keyboard.press("Space");
      await page.keyboard.press("e");
      await page.waitForTimeout(1200);
      expect((await sessionState(page)).simTime).toBe(s.simTime);
      await page.getByTestId("play-again").click();
      await expect(page.getByTestId("briefing")).toBeVisible();
      expect(await wegoState(page)).toMatchObject({ phase: "planning", turnNumber: 1, turnsCommitted: 0, intents: 0 });
      expect((await sessionState(page)).result).toBeNull();
      await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "pending");
    } finally {
      await ctx.close();
    }
  });
});

test.describe("SAND-WEGO-1: the continuous and snapshot routes stay continuous", () => {
  test("demo, then the real snapshot, then the demo again, and legacy: no WeGo controls or state leak", async ({ page }) => {
    test.setTimeout(300_000);
    const noWeGo = async () => {
      for (const id of ["turn-panel", "turn-tag", "cmd-commit", "cmd-next-turn", "turn-review", "staged-count", "mode-explain"]) {
        await expect(page.getByTestId(id), id).toHaveCount(0);
      }
    };
    // demo default is continuous
    await openPlay(page, "/play", { e2eHandle: true });
    await expect(page.getByTestId("mode-continuous")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("briefing")).toBeHidden();
    await noWeGo();
    expect(await wegoState(page)).toMatchObject({ mode: "continuous", phase: null });
    await expect(page.getByTestId("sim-state")).toContainText(/HOLD/);
    await autopauseOff(page);
    await setSpeed(page, "10x");
    await page.getByTestId("sim-toggle-pause").click();
    await expect(page.getByTestId("sim-state")).toContainText(/RUN/);
    const t0 = (await sessionState(page)).simTime;
    await expect.poll(async () => (await sessionState(page)).simTime, { timeout: 15_000 }).toBeGreaterThan(t0);

    // pick WeGo on a fresh demo session, then go to the snapshot: it must not inherit the mode
    await page.goto("/play?scenario=snapshot");
    await page.waitForFunction(() => !!(window as unknown as W).__sandPlot, null, { timeout: 90_000 });
    await expect(page.getByTestId("briefing")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("mode-wego")).toHaveCount(0);
    await expect(page.getByTestId("mode-continuous-only")).toBeVisible();
    await noWeGo();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("briefing")).toBeHidden();
    await noWeGo();

    await page.goto("/play");
    await page.waitForFunction(() => !!(window as unknown as W).__sandPlot, null, { timeout: 90_000 });
    await expect(page.getByTestId("mode-wego")).toBeVisible();
    await expect(page.getByTestId("mode-continuous")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("mode-wego").click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("turn-panel")).toHaveAttribute("data-phase", "planning");

    await page.goto("/play?scenario=snapshot");
    await page.waitForFunction(() => !!(window as unknown as W).__sandPlot, null, { timeout: 90_000 });
    await expect(page.getByTestId("mode-wego")).toHaveCount(0);
    await noWeGo();

    await page.goto("/play");
    await page.waitForFunction(() => !!(window as unknown as W).__sandPlot, null, { timeout: 90_000 });
    await expect(page.getByTestId("mode-continuous")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await noWeGo();

    // legacy MapLibre view
    await page.goto("/play?map=legacy");
    await expect(page.locator("body")).toBeVisible();
    await noWeGo();
    await expect(page.getByTestId("mode-wego")).toHaveCount(0);
    await page.goto("/play?map=legacy&scenario=snapshot");
    await expect(page.locator("body")).toBeVisible();
    await noWeGo();
  });
});

async function minFont(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return { min: 0, n: 0 };
    let min = 99, n = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.textContent?.trim()) continue;
      const el = t.parentElement!;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === "hidden") continue;
      min = Math.min(min, parseFloat(getComputedStyle(el).fontSize));
      n++;
    }
    return { min, n };
  }, selector);
}

test.describe("SAND-WEGO-1: look inspection at 1440x900 and 1920x1080, DPR 2", () => {
  for (const size of SIZES) {
    test(`flat and tilted gate, phase panels, font floors at ${size.width}x${size.height}`, async ({ browser }, info) => {
      test.setTimeout(300_000);
      mkdirSync(OUT, { recursive: true });
      const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const fontLog: Record<string, unknown> = {};
      try {
        await openPlay(page, "/play", { e2eHandle: true });
        expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
        const renderer = await page.evaluate(() => (window as unknown as W).__sandPlot!.rendererInfo().renderer);
        info.annotations.push({ type: "renderer", description: renderer });
        fontLog.renderer = renderer;
        await pickWeGo(page, 5);
        fontLog.briefing = await minFont(page, '[data-testid="briefing"]');
        await takeCommand(page);
        await page.getByTestId("mission-focus-gate").click();
        await page.waitForTimeout(3500);
        fontLog.planning = await minFont(page, '[data-testid="turn-panel"]');
        await orderShip(page, /Nimitz/, [GATE.centre], "FLANK");
        await setSpeed(page, "60x");
        await page.screenshot({ path: path.join(OUT, `${size.width}x${size.height}-9-gate-flat.png`) });
        await page.keyboard.press("t");
        await page.waitForTimeout(3500);
        await page.screenshot({ path: path.join(OUT, `${size.width}x${size.height}-10-gate-tilted.png`) });
        await page.keyboard.press("t");
        await page.waitForTimeout(1500);
        await page.getByTestId("cmd-commit").click();
        await waitPhase(page, "review", 120_000);
        fontLog.review = await minFont(page, '[data-testid="turn-review"]');
        fontLog.statusStrip = await minFont(page, '[data-testid="sim-state"]');
        const rv = (await page.getByTestId("turn-review").boundingBox())!;
        const vp = page.viewportSize()!;
        expect(rv.x + rv.width).toBeLessThanOrEqual(vp.width);
        expect(rv.y + rv.height).toBeLessThanOrEqual(vp.height);
        for (const [k, v] of Object.entries(fontLog)) {
          if (k === "renderer") continue;
          const f = v as { min: number; n: number };
          expect(f.n, k).toBeGreaterThan(0);
          expect(f.min, `${k} smallest font`).toBeGreaterThanOrEqual(12);
        }
        writeFileSync(path.join(OUT, `fonts-${size.width}x${size.height}.json`), JSON.stringify(fontLog, null, 2));
      } finally {
        await ctx.close();
      }
    });
  }
});
