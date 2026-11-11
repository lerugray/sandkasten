import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { openPlay, runUntilResultOnSimClock, sessionState, type W } from "./helpers/sandPlay";

const OUT = path.join(process.cwd(), "docs", "verification", "sand-threat-1-t438");
// SAND_E2E_CPU_THROTTLE=<n> slows the page's CPU n times (Chromium DevTools), to prove the run on a slow machine.
const CPU_THROTTLE = Number(process.env.SAND_E2E_CPU_THROTTLE ?? 0);
// Every do-nothing run on record loses between T+2.1 h and T+2.6 h of game time; a run still undecided at T+4 h is a miss.
const MAX_SIM_HOURS = 4;

/**
 * SAND-THREAT-1 proof 5. A passive player loses the shipped Hormuz scenario through the ordinary UI: read the briefing,
 * give no order to any unit, pick the top speed, press play, and press play again whenever the game pauses itself.
 * Nothing is injected and the dice are the browser's own.
 *
 * The wait is on the GAME clock (SAND-THREAT-1 FIX3): the run ends when the scenario's rules end it, however long the
 * machine takes to get there, and fails if the game clock passes T+4 h with no result. The first version waited 480 s of
 * wall time, which a slow host spent on the ~130 autopause resumes of the missile attack before the carrier was lost.
 */
test.describe("SAND-THREAT-1: a passive run reaches the real DEFEAT debrief", () => {
  test("no orders, 60x, play: USS Nimitz is destroyed by the Iranian missile boats and the debrief says so", async ({ page }) => {
    test.setTimeout(1_800_000);
    await openPlay(page, "/play", { e2eHandle: true });
    if (CPU_THROTTLE > 1) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });
    }

    await expect(page.getByTestId("briefing")).toBeVisible();
    await expect(page.getByTestId("briefing-mission")).toContainText(/transit gate/i);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("briefing")).toBeHidden();
    await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");

    const before = await sessionState(page);
    expect(before.result).toBeNull();

    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await page.getByTestId("sim-toggle-pause").click();
    const run = await runUntilResultOnSimClock(page, { maxSimHours: MAX_SIM_HOURS, wallCapMs: 1_500_000 });

    await expect(page.getByTestId("result-title")).toContainText(/DEFEAT/i);
    await expect(page.getByTestId("result-deciding")).toContainText(/Nimitz/i);
    await expect(page.getByTestId("result-deciding")).toContainText(/destroyed/i);
    await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "failed");

    // How the run was lost, read from the live session: the scenario's own rule, on damage Iranian units did in combat.
    const facts = await page.evaluate(() => {
      const s = (window as unknown as W).__sandSession as unknown as { snapshot(): any };
      const snap = s.snapshot();
      const g = snap.gameState;
      const units = g.sides.flatMap((x: any) => x.units);
      const sideOf = new Map<string, string>(units.map((u: any) => [u.id, u.side]));
      const nimitz = units.find((u: any) => u.id === "us-cvn-1");
      const hits = snap.combatState.combatLog.filter((e: any) => e.type === "hit" && e.targetId === "us-cvn-1");
      const launchers = [...new Set<string>(hits.map((e: any) => e.unitId))];
      return {
        result: snap.eventState.scenarioResult.result as string,
        decidedBy: snap.eventState.scenarioResult.source?.event as string,
        elapsedHours: (g.simTime - g.scenario.startTime) / 3.6e6,
        nimitzState: nimitz.damageState as string,
        nimitzDamage: Math.round(nimitz.damage ?? 0),
        hitsOnNimitz: hits.length as number,
        missileHits: hits.filter((e: any) => String(e.description).startsWith("C-802")).length as number,
        launchers,
        launcherSides: [...new Set(launchers.map((id) => sideOf.get(id) ?? "unknown"))],
        // a passive run: no US unit was ever given a route, a throttle change or a doctrine order
        usOrders: units
          .filter((u: any) => u.side === "US Navy")
          .map((u: any) => g.orders.get(u.id))
          .filter((o: any) => o && (o.waypoints.length > 0 || o.doctrine !== undefined || o.throttle !== 2)).length as number,
        nativeDice: /\[native code\]/.test(Function.prototype.toString.call(Math.random)),
      };
    });

    expect(facts.result).toBe("defeat");
    expect(facts.decidedBy).toBe("Carrier Lost");
    expect(facts.nimitzState).toBe("destroyed");
    expect(facts.hitsOnNimitz).toBeGreaterThan(50);
    expect(facts.missileHits).toBeGreaterThan(0);
    expect(facts.launcherSides).toEqual(["Iran"]);
    expect(facts.launchers.every((id) => id.startsWith("ir-"))).toBe(true);
    expect(facts.launchers.some((id) => id.startsWith("ir-pc-"))).toBe(true);
    expect(facts.usOrders).toBe(0);
    expect(facts.nativeDice).toBe(true);
    expect(facts.elapsedHours).toBeLessThan(MAX_SIM_HOURS);

    const debrief = {
      title: await page.getByTestId("result-title").innerText(),
      deciding: await page.getByTestId("result-deciding").innerText(),
      clock: await page.getByTestId("sim-clock").innerText(),
      renderer: await page.evaluate(() => (window as unknown as W).__sandPlot!.rendererInfo().renderer),
    };
    mkdirSync(OUT, { recursive: true });
    // a throttled run keeps its own receipt beside the ordinary one
    const tag = CPU_THROTTLE > 1 ? `-cpu${CPU_THROTTLE}x` : "";
    const wait = { on: "game clock", maxSimHours: MAX_SIM_HOURS, cpuThrottle: CPU_THROTTLE > 1 ? CPU_THROTTLE : 1, wallSeconds: run.wallSeconds, resumes: run.resumes };
    writeFileSync(path.join(OUT, `passive-defeat${tag}.json`), JSON.stringify({ orders: "none", speed: "60x", wait, debrief, facts }, null, 2));
    await page.screenshot({ path: path.join(OUT, `passive-defeat-debrief${tag}.png`) });
  });
});
