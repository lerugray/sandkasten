import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { clickGeo, autopauseOff, type W } from "./helpers/sandPlay";
import { openPlayLite, saveViaUi, loadViaUi } from "./helpers/saveEvidence";

// SAND-MISSIONS-1: the player can create PATROL, STRIKE and INTERCEPT missions, assign own units
// or launched aircraft to them, and watch the existing mission logic carry them out — in
// continuous time, in WeGo turns, and across a save/resume mid-mission.

const OUT = path.join(process.cwd(), "docs", "verification", "sand-missions-1-s467");
const CHECKPOINT = path.join(OUT, "mid-mission.sandsave.json");

const CHOSIN = "us-cg-1";
const NIMITZ = "us-cvn-1";
const HORNET = 10006;

/** Read the live player-mission and launched-aircraft state through the test-build handle. */
async function missionFacts(page: Page) {
  return page.evaluate(() => {
    const snap = (window as unknown as W).__sandSession as unknown as { snapshot(): any };
    const g = snap.snapshot().gameState;
    const units = g.sides.flatMap((s: any) => s.units);
    return {
      simTime: g.simTime as number,
      paused: g.isPaused as boolean,
      missions: (g.playerMissions ?? []).map((m: any) => ({
        id: m.id as string,
        name: m.name as string,
        type: m.type as string,
        assigned: [...(m.assignedUnitIds ?? [])] as string[],
        inProgress: [...(m.inProgressUnitIds ?? [])] as string[],
        refPoints: m.referencePoints as { lng: number; lat: number }[],
      })),
      units: units.map((u: any) => ({
        id: u.id as string,
        name: u.name as string,
        side: u.side as string,
        pos: u.position as { lng: number; lat: number },
        airStatus: (u.airStatus ?? null) as string | null,
        host: (u.hostUnitId ?? null) as string | null,
        recovering: !!u.recovering,
        fuel: (u.fuelRemainingMs ?? null) as number | null,
      })),
      orders: Object.fromEntries([...g.orders.entries()].map(([id, o]: any) => [id, {
        wp: (o.waypoints ?? []).map((w: any) => [w.position.lng, w.position.lat]),
        throttle: o.throttle,
      }])) as Record<string, { wp: [number, number][]; throttle: number }>,
      airWing: (units.find((u: any) => u.id === "us-cvn-1")?.airWing ?? []) as { platformId: number; count: number; readyAtMs: number }[],
    };
  });
}

async function pauseClock(page: Page) {
  if (!(await missionFacts(page)).paused) await page.getByTestId("sim-toggle-pause").click();
  await expect.poll(async () => (await missionFacts(page)).paused, { timeout: 30_000 }).toBe(true);
}

async function playClock(page: Page) {
  if ((await missionFacts(page)).paused) await page.getByTestId("sim-toggle-pause").click();
  await expect.poll(async () => (await missionFacts(page)).paused, { timeout: 30_000 }).toBe(false);
}

/** Poll the live session until `pred` holds; resume a default autopause when it stops the clock. */
async function waitMissions(
  page: Page,
  pred: (a: Awaited<ReturnType<typeof missionFacts>>) => boolean,
  timeout = 180_000,
): Promise<Awaited<ReturnType<typeof missionFacts>>> {
  const t0 = Date.now();
  let a = await missionFacts(page);
  while (Date.now() - t0 < timeout) {
    if (pred(a)) return a;
    if (a.paused) {
      const label = ((await page.getByTestId("sim-toggle-pause").textContent({ timeout: 2000 }).catch(() => null)) ?? "").trim();
      if (/PLAY|RESUME/i.test(label)) await page.getByTestId("sim-toggle-pause").click({ timeout: 2000 }).catch(() => {});
    }
    await page.waitForTimeout(200);
    a = await missionFacts(page);
  }
  throw new Error(`mission condition not met after ${timeout} ms; last: ${JSON.stringify(a)}`);
}

/**
 * Advance the live session's sim clock by exactly `simMs` in one synchronous block, held around the
 * advance. On a software-rendered host the real-time tick loop is too uneven to pause at a precise
 * mid-flight moment; driving the clock directly makes the save genuinely mid-mission.
 */
async function advanceSim(page: Page, simMs: number) {
  await page.evaluate((ms) => {
    const s = (window as unknown as W).__sandSession as unknown as {
      gameState: { isPaused: boolean; speed: number };
      tick: (dtMs: number) => boolean;
    };
    const speed = s.gameState.speed || 1;
    s.gameState.isPaused = false;
    let remaining = ms;
    while (remaining > 0) {
      const dt = Math.min(2000, remaining / speed);
      s.tick(dt);
      remaining -= dt * speed;
    }
    s.gameState.isPaused = true;
  }, simMs);
}

async function takeCommand(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("briefing")).toBeHidden();
}

async function createMissionDraft(page: Page, kind: "patrol" | "strike" | "intercept", points: [number, number][]) {
  const testId = `mission-new-${kind}`;
  await page.getByTestId(testId).click();
  await expect(page.getByTestId("mission-draft-banner")).toBeVisible();
  for (const [lng, lat] of points) await clickGeo(page, lng, lat);
  await page.getByTestId("mission-create").click();
  await expect(page.getByTestId("mission-draft-banner")).toBeHidden();
}

async function selectForce(page: Page, text: string) {
  await page.getByTestId("force-row").filter({ hasText: text }).first().click();
}

test.describe("SAND-MISSIONS-1 continuous: PATROL, STRIKE, INTERCEPT", () => {
  test("a ship assigned to a PATROL steams toward its patrol reference points", async ({ page }) => {
    test.setTimeout(360_000);
    await openPlayLite(page, "/play", { e2eHandle: true });
    await takeCommand(page);
    await autopauseOff(page);

    const start = (await missionFacts(page)).units.find((u) => u.id === CHOSIN)!.pos;
    await createMissionDraft(page, "patrol", [[57.0, 25.6], [57.6, 25.1]]);
    await expect(page.getByTestId("player-mission-row")).toHaveCount(1);

    await selectForce(page, "Chosin");
    await page.locator('[data-testid="order-assign-mission"]').filter({ hasText: "ASSIGN" }).first().click();
    await expect(page.getByTestId("mission-feedback")).toContainText(/assigned/i);
    expect((await missionFacts(page)).missions[0].assigned).toContain(CHOSIN);

    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await playClock(page);
    // The mission logic routes the ship (a patrol leg, or a prosecution leg toward a detected contact),
    // then the movement model carries it. Either way it is the mission driving the unit.
    await waitMissions(page, (a) => {
      const o = a.orders[CHOSIN];
      const p = a.units.find((u) => u.id === CHOSIN)!.pos;
      const moved = Math.abs(p.lng - start.lng) + Math.abs(p.lat - start.lat) > 0.01;
      return moved && !!o && o.wp.length > 0;
    });

    expect((await missionFacts(page)).orders[CHOSIN].wp.length).toBeGreaterThan(0);
  });

  test("an aircraft launched onto a STRIKE flies to the target point, then returns", async ({ page }) => {
    test.setTimeout(360_000);
    await openPlayLite(page, "/play", { e2eHandle: true });
    await takeCommand(page);
    await autopauseOff(page);

    await createMissionDraft(page, "strike", [[57.9, 25.8]]);
    await selectForce(page, "Nimitz");
    await page.getByTestId("order-launch-mission").first().click();
    await expect(page.getByTestId("mission-feedback")).toContainText(/launching/i);

    const facts0 = await missionFacts(page);
    expect(facts0.missions[0].assigned).toHaveLength(1);
    const airId = facts0.missions[0].assigned[0];
    expect(facts0.airWing.find((s) => s.platformId === HORNET)!.count).toBe(3);

    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await playClock(page);
    // Launch delay elapses, then the aircraft flies toward the strike reference point.
    await waitMissions(page, (a) => {
      const u = a.units.find((x) => x.id === airId);
      return !!u && u.airStatus === "airborne";
    });
    const target = (await missionFacts(page)).missions[0].refPoints[0];
    await waitMissions(page, (a) => {
      const u = a.units.find((x) => x.id === airId);
      return !!u && Math.abs(u.pos.lng - target.lng) + Math.abs(u.pos.lat - target.lat) < 0.05;
    });

    // Strike done: it turns for the carrier and eventually lands aboard again.
    await waitMissions(page, (a) => a.units.every((u) => u.id !== airId) && a.airWing.find((s) => s.platformId === HORNET)!.count === 4);
  });

  test("an aircraft launched onto an INTERCEPT/CAP orbits its station", async ({ page }) => {
    test.setTimeout(360_000);
    await openPlayLite(page, "/play", { e2eHandle: true });
    await takeCommand(page);
    await autopauseOff(page);

    await createMissionDraft(page, "intercept", [[56.9, 25.9]]);
    await selectForce(page, "Nimitz");
    await page.getByTestId("order-launch-mission").first().click();
    await expect(page.getByTestId("mission-feedback")).toContainText(/launching/i);

    const airId = (await missionFacts(page)).missions[0].assigned[0];
    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await playClock(page);
    await waitMissions(page, (a) => {
      const u = a.units.find((x) => x.id === airId);
      return !!u && u.airStatus === "airborne";
    });
    const station = (await missionFacts(page)).missions[0].refPoints[0];
    // The CAP generator orbits a box around the station; the aircraft must close on it.
    await waitMissions(page, (a) => {
      const u = a.units.find((x) => x.id === airId);
      return !!u && Math.abs(u.pos.lng - station.lng) + Math.abs(u.pos.lat - station.lat) < 0.5;
    });
  });
});

test.describe("SAND-MISSIONS-1 WeGo: missions resolve in the turn loop", () => {
  test("plan a PATROL assignment and a STRIKE launch, then resolve each turn", async ({ page }) => {
    test.setTimeout(600_000);
    await openPlayLite(page, "/play", { e2eHandle: true });
    await expect(page.getByTestId("briefing")).toBeVisible();
    await page.getByTestId("mode-wego").click();
    await page.getByTestId("turn-length-5").click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("briefing")).toBeHidden();

    const phase = () => page.getByTestId("turn-panel").getAttribute("data-phase");
    const commitAndResolve = async () => {
      await page.getByTestId("cmd-commit").click();
      await expect.poll(async () => await phase(), { timeout: 240_000 }).not.toBe("planning");
      await expect.poll(async () => await phase(), { timeout: 240_000 }).toMatch(/review|result/);
    };

    // Turn 1 planning: create a PATROL mission and assign Chosin, then commit.
    await expect.poll(async () => await phase(), { timeout: 30_000 }).toBe("planning");
    const start = (await missionFacts(page)).units.find((u) => u.id === CHOSIN)!.pos;
    await createMissionDraft(page, "patrol", [[57.0, 25.6], [57.6, 25.1]]);
    await selectForce(page, "Chosin");
    await page.getByTestId("order-assign-mission").first().click();
    await expect(page.getByTestId("mission-feedback")).toContainText(/assigned/i);
    await commitAndResolve();

    // The patrol assignment generated the ship's route during the burst: it has moved.
    expect((await missionFacts(page)).missions[0].assigned).toContain(CHOSIN);
    const moved = await missionFacts(page);
    const chosin = moved.units.find((u) => u.id === CHOSIN)!;
    expect(Math.abs(chosin.pos.lng - start.lng) + Math.abs(chosin.pos.lat - start.lat)).toBeGreaterThan(0.005);

    await page.getByTestId("cmd-next-turn").click();
    await expect.poll(async () => await phase(), { timeout: 30_000 }).toBe("planning");

    // Turn 2 planning: create a STRIKE mission and launch a Hornet onto it, then commit.
    await createMissionDraft(page, "strike", [[57.9, 25.8]]);
    await selectForce(page, "Nimitz");
    const strikeId = (await missionFacts(page)).missions[1].id;
    await page.locator(`[data-testid="order-launch-mission"][data-mission-id="${strikeId}"]`).click();
    await expect(page.getByTestId("mission-feedback")).toContainText(/launching/i);
    expect((await missionFacts(page)).missions[1].assigned).toHaveLength(1);
    await commitAndResolve();

    // After the burst the launched aircraft is airborne (the launch delay elapsed inside the turn).
    const airId = (await missionFacts(page)).missions.find((m) => m.id === strikeId)!.assigned[0];
    const resolved = await missionFacts(page);
    expect(resolved.units.find((u) => u.id === airId)!.airStatus).toBe("airborne");
  });
});

test.describe("SAND-MISSIONS-1 save mid-mission: resume and finish the strike", () => {
  test("a strike in flight survives a save and load, then lands aboard the carrier", async ({ browser }) => {
    test.setTimeout(420_000);
    mkdirSync(OUT, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true });
    const page = await ctx.newPage();
    try {
      await openPlayLite(page, "/play", { e2eHandle: true });
      await takeCommand(page);
      await autopauseOff(page);

      await createMissionDraft(page, "strike", [[57.9, 25.8]]);
      await selectForce(page, "Nimitz");
      await page.getByTestId("order-launch-mission").first().click();
      await expect(page.getByTestId("mission-feedback")).toContainText(/launching/i);
      await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
      const airId = (await missionFacts(page)).missions[0].assigned[0];
      // Advance just past the launch delay while held: the aircraft is airborne and still outbound.
      await advanceSim(page, 40_000);
      const mid = await missionFacts(page);
      expect(mid.units.find((u) => u.id === airId)!.airStatus).toBe("airborne");
      expect(mid.missions[0].assigned).toContain(airId);
      expect(mid.airWing.find((s) => s.platformId === HORNET)!.count).toBe(3);

      // Save the running battle (already paused), then resume from the actual file.
      const name = await saveViaUi(page, CHECKPOINT);
      expect(name).toMatch(/^sandkasten-hormuz-T\+\d\dh\d\dm-\d{8}-\d{6}\.sandsave\.json$/);
      const L = await loadViaUi(page, CHECKPOINT);
      expect(L.preview).toContain("STRAIT OF HORMUZ STANDOFF");
      await L.confirm();

      // The restored battle still holds the mission and the airborne strike aircraft.
      const restored = await missionFacts(page);
      expect(restored.missions).toHaveLength(1);
      expect(restored.missions[0].assigned).toContain(airId);
      expect(restored.units.find((u) => u.id === airId)!.airStatus).toBe("airborne");
      expect(restored.airWing.find((s) => s.platformId === HORNET)!.count).toBe(3);

      // The resumed mission finishes: the aircraft reaches the target, turns home, and lands.
      await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
      await playClock(page);
      await waitMissions(page, (a) => a.units.every((u) => u.id !== airId) && a.airWing.find((s) => s.platformId === HORNET)!.count === 4);
    } finally {
      await ctx.close();
    }
  });
});
