import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { clickGeo, autopauseOff, runUntilResult, installProbes, probeCounts, GATE, type W } from "./helpers/sandPlay";
import { openPlayLite as openPlay, OUT, SIZES, shotBoth, saveViaUi, loadViaUi, facts, clockText, godOff, localOnly } from "./helpers/saveEvidence";

// SAND-SAVE-1: real player path through the real controls. The checkpoint file below is the one the browser downloaded.
const CHECKPOINT = path.join(OUT, "real-checkpoint.sandsave.json");
const setSpeed = (page: Page, label: string) => page.getByTestId("sim-speed").filter({ hasText: label }).click();

async function ctxFor(browser: import("@playwright/test").Browser, size = SIZES[0]) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, acceptDownloads: true });
  return { ctx, page: await ctx.newPage() };
}

async function debrief(page: Page) {
  const txt = async (id: string) => (await page.getByTestId(id).innerText()).replace(/\s+/g, " ").trim();
  return { title: await txt("result-title"), message: await txt("result-message"), deciding: await txt("result-deciding"), score: await txt("result-score"), losses: await txt("result-losses") };
}

test.describe.configure({ mode: "serial" });

test.describe("SAND-SAVE-1 real play, save, close, reopen, resume", () => {
  test("play Hormuz into a nontrivial mid-battle checkpoint with ordinary controls and download it", async ({ browser }, info) => {
    test.setTimeout(900_000);
    mkdirSync(OUT, { recursive: true });
    const { ctx, page } = await ctxFor(browser);
    const log: Record<string, unknown> = {};
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      log.renderer = await page.evaluate(() => (window as unknown as W).__sandPlot!.rendererInfo().renderer);
      info.annotations.push({ type: "renderer", description: String(log.renderer) });
      await godOff(page);
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("briefing")).toBeHidden();
      // the orders a player gives: Nimitz alone, one waypoint at the gate, FLANK
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
      // run until shots have been fired and spent: a nontrivial checkpoint, not a cold start
      await expect
        .poll(async () => {
          const f = await facts(page);
          return f.result ? "ended" : f.log >= 10 && Object.keys(f.expended).length > 0 ? "ready" : "running";
        }, { timeout: 420_000, intervals: [400] })
        .not.toBe("running");
      const before = await facts(page);
      expect(before.result).toBeNull();
      // SAVE while time is running: it must pause at the checkpoint itself
      expect(before.isPaused).toBe(false);
      const name = await saveViaUi(page, CHECKPOINT);
      const afterSave = await facts(page);
      expect(afterSave.isPaused).toBe(true);
      await expect(page.getByTestId("sim-state")).toContainText("HOLD");
      expect(name).toMatch(/^sandkasten-hormuz-T\+\d\dh\d\dm-\d{8}-\d{6}\.sandsave\.json$/);
      await expect(page.getByTestId("save-notice")).toContainText(/cannot see where it went|cannot confirm/i);
      await expect(page.getByTestId("save-notice")).toContainText(/media/i);
      log.fileName = name;
      log.fileBytes = statSync(CHECKPOINT).size;
      log.atSave = { clock: await clockText(page), simTime: afterSave.simTime, elapsedH: afterSave.elapsedH, log: afterSave.log, expended: afterSave.expended, playerContacts: afterSave.playerContacts, otherContacts: afterSave.otherContacts, weaponsInFlight: afterSave.weaponsInFlight, units: afterSave.units, ownStates: afterSave.ownStates, orders: afterSave.orders, fired: afterSave.fired, score: afterSave.score };
      expect(afterSave.otherContacts).toBeGreaterThan(0); // the AI's picture is in the file (it is a save)...
      await shotBoth(page, "save-notice");
      // the file itself: versioned JSON, the whole thing is data
      const file = JSON.parse(readFileSync(CHECKPOINT, "utf8"));
      expect(file.format).toBe("sandkasten-battle-save");
      expect(file.version).toBe(1);
      expect(file.configId).toBe("hormuz");
      log.fileHead = { format: file.format, version: file.version, configId: file.configId, configRevision: file.configRevision };
    } finally {
      writeFileSync(path.join(OUT, "real-checkpoint-log.json"), JSON.stringify(log, null, 2));
      await ctx.close(); // the tab is closed: nothing of the run survives except the file
    }
  });

  test("a fresh page loads the actual file paused, with the saved clock, orders and fog, and plays on to a real victory", async ({ browser }, info) => {
    test.setTimeout(1_500_000);
    const saved = JSON.parse(readFileSync(path.join(OUT, "real-checkpoint-log.json"), "utf8"));
    const netSeen: string[] = [];
    const attempts: Record<string, unknown>[] = [];
    let won = false;
    for (let attempt = 1; attempt <= 3 && !won; attempt++) {
      const { ctx, page } = await ctxFor(browser);
      try {
        await localOnly(page, netSeen);
        await installProbes(page);
        await openPlay(page, "/play", { e2eHandle: true });
        await godOff(page);
        await expect(page.getByTestId("briefing")).toBeVisible(); // a brand-new run, before the load
        const L = await loadViaUi(page, CHECKPOINT);
        expect(L.preview).toContain("STRAIT OF HORMUZ STANDOFF");
        expect(L.preview).toMatch(/MISSION CLOCK T\+\d\d:\d\d:\d\d/);
        expect(L.preview).toContain("IN PROGRESS");
        if (attempt === 1) await shotBoth(page, "load-dialog-preview");
        await L.confirm();

        // paused, at the saved moment, nothing run on wall time
        const f0 = await facts(page);
        expect(f0.isPaused).toBe(true);
        expect(f0.simTime).toBe(saved.atSave.simTime);
        await expect(page.getByTestId("sim-state")).toContainText("HOLD");
        expect(await clockText(page)).toBe(saved.atSave.clock);
        await godOff(page);
        await expect(page.getByTestId("briefing")).toBeHidden(); // mid-run, not a start-of-run briefing
        await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "pending");
        expect(f0.log).toBe(saved.atSave.log);
        expect(f0.units).toBe(saved.atSave.units);
        expect(f0.expended).toEqual(saved.atSave.expended);
        expect(f0.orders).toEqual(saved.atSave.orders);
        expect(f0.fired).toEqual(saved.atSave.fired);
        expect(f0.score).toEqual(saved.atSave.score);
        await page.waitForTimeout(3000);
        expect((await facts(page)).simTime).toBe(f0.simTime); // time did not pass while paused
        // default fog: the contact list is the player's picture, not the AI's store
        expect(await page.getByTestId("contact-row").count()).toBeLessThanOrEqual(f0.playerContacts);
        // no stale alarm: no autopause cue or HOLD traffic line from the discarded session
        await expect(page.getByTestId("autopause-reason")).toHaveCount(0);
        await expect(page.getByTestId("teletype-line").filter({ hasText: "AUTOPAUSE" })).toHaveCount(0);

        if (attempt === 1) {
          // the resumed focused objective with a selected unit and real orders, flat then tilted
          await page.getByTestId("mission-focus-unit").click();
          await page.getByTestId("mission-focus-gate").click();
          await page.waitForTimeout(3500);
          await expect(page.getByTestId("order-panel")).toBeVisible();
          await expect(page.getByTestId("order-waypoint-item")).toHaveCount(1);
          await shotBoth(page, "resumed-objective-flat");
          await page.keyboard.press("t");
          await page.waitForTimeout(2500);
          await shotBoth(page, "resumed-objective-tilt");
          await page.keyboard.press("t");
          await page.waitForTimeout(1500);
          // reading the briefing: selecting its text must not close it (B recalls it)
          await page.keyboard.press("b");
          await expect(page.getByTestId("briefing")).toBeVisible();
          await page.locator(".tx-briefing-text").click({ clickCount: 3 });
          await expect(page.getByTestId("briefing")).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(page.getByTestId("briefing")).toBeHidden();
        }

        // resume with the real controls
        const probes0 = await probeCounts(page);
        await autopauseOff(page);
        await setSpeed(page, "60x");
        await page.getByTestId("sim-toggle-pause").click();
        await runUntilResult(page, 700_000);
        const f1 = await facts(page);
        const d = await debrief(page);
        const probes1 = await probeCounts(page);
        const rec: Record<string, unknown> = { attempt, resumedFrom: saved.atSave.clock, result: f1.result, elapsedH: f1.elapsedH, debrief: d, probes0, probes1, fired: f1.fired };
        // nothing refilled, nothing repeated
        for (const [u, w] of Object.entries(saved.atSave.expended as Record<string, Record<string, number>>)) {
          for (const [n, c] of Object.entries(w)) expect(f1.expended[u]?.[n] ?? 0).toBeGreaterThanOrEqual(c);
        }
        expect(new Set(f1.fired).size).toBe(f1.fired.length);
        attempts.push(rec);
        if (f1.result === "victory") {
          won = true;
          expect(d.title).toContain("VICTORY");
          expect(d.deciding.toLowerCase()).not.toMatch(/afloat.*\(afloat/); // S3 #4: no doubled wording
          await expect(page.getByTestId("autopause-reason")).toHaveCount(0); // S3 #5
          await expect(page.getByTestId("teletype-line").filter({ hasText: "AUTOPAUSE" })).toHaveCount(0);
          await shotBoth(page, "resumed-real-victory-debrief");
        }
      } finally {
        await ctx.close();
      }
    }
    writeFileSync(path.join(OUT, "resumed-run.json"), JSON.stringify({ attempts, externalRequestsBlocked: [...new Set(netSeen)] }, null, 2));
    expect(won, "a resumed run from the real checkpoint reached a real victory").toBe(true);
    info.annotations.push({ type: "attempts", description: String(attempts.length) });
  });

  test("the same unchanged checkpoint, reloaded with a materially different plan (dog-leg at full, radar toggled)", async ({ browser }) => {
    test.setTimeout(1_500_000);
    const before = readFileSync(CHECKPOINT, "utf8");
    const { ctx, page } = await ctxFor(browser);
    const commands: string[] = [];
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      const L = await loadViaUi(page, CHECKPOINT);
      await L.confirm();
      const f0 = await facts(page);
      await page.getByTestId("mission-focus-unit").click();
      await expect(page.getByTestId("order-panel")).toBeVisible();
      await page.getByTestId("order-clear-waypoints").click();
      commands.push("Nimitz: CLEAR WAYPOINTS (the saved plan was one waypoint at the gate)");
      await page.getByTestId("order-add-waypoint").click();
      await page.getByTestId("mission-focus-gate").click();
      await page.waitForTimeout(3500);
      for (const [i, w] of [{ lng: 57.0, lat: 25.9 }, GATE.centre].entries()) {
        await clickGeo(page, w.lng, w.lat);
        await expect(page.getByTestId("order-waypoint-item")).toHaveCount(i + 1);
        commands.push(`Nimitz: waypoint ${i + 1} at ${w.lng}E ${w.lat}N`);
      }
      await page.keyboard.press("Escape");
      await page.getByTestId("order-throttle").filter({ hasText: "FULL" }).click();
      commands.push("Nimitz: throttle FULL (the saved plan was FLANK)");
      await page.getByTestId("order-toggle-radar").click();
      commands.push("Nimitz: radar toggled (EMCON change)");
      const f1 = await facts(page);
      expect(JSON.stringify(f1.orders)).not.toBe(JSON.stringify(f0.orders));
      await autopauseOff(page);
      await setSpeed(page, "60x");
      await page.getByTestId("sim-toggle-pause").click();
      await runUntilResult(page, 900_000);
      const end = await facts(page);
      const d = await debrief(page);
      await shotBoth(page, "second-plan-debrief");
      writeFileSync(path.join(OUT, "second-plan.json"), JSON.stringify({ checkpoint: "real-checkpoint.sandsave.json (unchanged)", commands, result: end.result, elapsedH: end.elapsedH, debrief: d, ordersAtStart: f0.orders, ordersAfterCommands: f1.orders }, null, 2));
      expect(["victory", "defeat"]).toContain(end.result);
    } finally {
      await ctx.close();
    }
    expect(readFileSync(CHECKPOINT, "utf8")).toBe(before); // loading and playing never alters the saved file
  });
});
