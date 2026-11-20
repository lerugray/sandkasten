import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { clickGeo, autopauseOff, type W } from "./helpers/sandPlay";
import { openPlayLite, saveViaUi, loadViaUi } from "./helpers/saveEvidence";

// SAND-AIR-1: the player can launch an aircraft from the carrier, fly it on the existing
// movement model, recover it aboard, and launch again once turnaround is done. Continuous
// and WeGo both use the same sim clock; a mid-sortie save restores an airborne aircraft.

const OUT = path.join(process.cwd(), "docs", "verification", "sand-air-1-s467");
const CHECKPOINT = path.join(OUT, "mid-sortie.sandsave.json");

/** Read the live air-operations state through the test-build handle. */
async function airFacts(page: Page) {
  return page.evaluate(() => {
    const snap = (window as unknown as W).__sandSession as unknown as { snapshot(): any };
    const g = snap.snapshot().gameState;
    const units = g.sides.flatMap((s: any) => s.units);
    const host = units.find((u: any) => u.id === "us-cvn-1");
    const launched = units
      .filter((u: any) => u.hostUnitId)
      .map((u: any) => ({ id: u.id, name: u.name, airStatus: u.airStatus, fuel: u.fuelRemainingMs, host: u.hostUnitId, pos: u.position, heading: u.heading }));
    return {
      simTime: g.simTime as number,
      paused: g.isPaused as boolean,
      launched,
      airWing: (host?.airWing ?? []) as { platformId: number; count: number; readyAtMs: number; turnaroundMs: number }[],
      hostPos: host?.position as { lng: number; lat: number },
    };
  });
}

const HORNET = 10006;

async function pauseClock(page: Page) {
  if (!(await airFacts(page)).paused) await page.getByTestId("sim-toggle-pause").click();
  await expect.poll(async () => (await airFacts(page)).paused, { timeout: 30_000 }).toBe(true);
}

async function playClock(page: Page) {
  if ((await airFacts(page)).paused) await page.getByTestId("sim-toggle-pause").click();
  await expect.poll(async () => (await airFacts(page)).paused, { timeout: 30_000 }).toBe(false);
}

/** Poll the live session until `pred` holds; when a default autopause stops the clock, resume it. */
async function waitAir(page: Page, pred: (a: Awaited<ReturnType<typeof airFacts>>) => boolean, timeout = 180_000): Promise<Awaited<ReturnType<typeof airFacts>>> {
  const t0 = Date.now();
  let a = await airFacts(page);
  while (Date.now() - t0 < timeout) {
    if (pred(a)) return a;
    if (a.paused) {
      const label = ((await page.getByTestId("sim-toggle-pause").textContent({ timeout: 2000 }).catch(() => null)) ?? "").trim();
      if (/PLAY/i.test(label)) await page.getByTestId("sim-toggle-pause").click({ timeout: 2000 }).catch(() => {});
    }
    await page.waitForTimeout(200);
    a = await airFacts(page);
  }
  throw new Error(`air condition not met after ${timeout} ms; last: ${JSON.stringify(a)}`);
}

/** The row of the first launched aircraft (its id is minted at runtime). */
function launchedRow(page: Page) {
  return page.locator('[data-testid="force-row"][data-unit-id^="air-"]');
}

async function takeCommand(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("briefing")).toBeHidden();
}

async function selectNimitz(page: Page) {
  await page.getByTestId("force-row").filter({ hasText: "Nimitz" }).first().click();
  await expect(page.getByTestId("order-air-ops")).toBeVisible();
}

test.describe("SAND-AIR-1 continuous: launch, fly, recover, relaunch", () => {
  test("a Super Hornet leaves the deck, flies a waypoint, lands, and is relaunched", async ({ page }) => {
    test.setTimeout(360_000);
    await openPlayLite(page, "/play", { e2eHandle: true });
    await takeCommand(page);
    await autopauseOff(page);
    await selectNimitz(page);

    const hornet = page.locator('[data-testid="air-slot"][data-platform-id="10006"]');
    await expect(hornet).toContainText("Super Hornet");
    await expect(hornet).toContainText("× 4");

    // launch
    await hornet.getByTestId("air-launch").click();
    await expect(page.getByTestId("air-feedback")).toContainText(/launching/i);
    await expect(launchedRow(page)).toHaveCount(1);
    expect((await airFacts(page)).airWing.find((s) => s.platformId === HORNET)!.count).toBe(3);

    // run the clock until the launch delay elapses and the aircraft is airborne
    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await playClock(page);
    await waitAir(page, (a) => a.launched.some((u) => u.airStatus === "airborne"));

    // fly it: pause, give the launched aircraft a waypoint far from where it is, then run until it arrives
    await pauseClock(page);
    const launchPos = (await airFacts(page)).launched[0].pos;
    const target = { lng: launchPos.lng + 0.6, lat: launchPos.lat + 0.4 };
    await launchedRow(page).click();
    await page.getByTestId("order-add-waypoint").click();
    await clickGeo(page, target.lng, target.lat);
    await page.keyboard.press("Escape");
    await playClock(page);
    await waitAir(page, (a) => {
      const p = a.launched[0]?.pos;
      return !!p && Math.abs(p.lng - target.lng) < 0.05 && Math.abs(p.lat - target.lat) < 0.05;
    });

    // recover: order the airborne aircraft back to its host
    await pauseClock(page);
    await launchedRow(page).click();
    await page.getByTestId("air-recover").click();
    await expect(page.getByTestId("air-feedback")).toContainText(/returning/i);
    await playClock(page);
    const landed = await waitAir(page, (a) => a.launched.length === 0 && a.airWing.find((s) => s.platformId === HORNET)!.count === 4);

    // parked again: the recovered aircraft is in turnaround, so the slot's next launch is in the future
    expect(landed.airWing.find((s) => s.platformId === HORNET)!.readyAtMs).toBeGreaterThan(landed.simTime);
    await waitAir(page, (a) => a.airWing.find((s) => s.platformId === HORNET)!.readyAtMs <= a.simTime);
    await pauseClock(page);
    await selectNimitz(page);
    await hornet.getByTestId("air-launch").click();
    await expect(page.getByTestId("air-feedback")).toContainText(/launching/i);
    await expect(launchedRow(page)).toHaveCount(1);
  });
});

test.describe("SAND-AIR-1 WeGo: launch and recover in the turn loop", () => {
  test("plan a launch, resolve it airborne, plan a recovery, then relaunch after turnaround", async ({ page }) => {
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

    // Turn 1 planning: launch a Super Hornet, then give the new aircraft a nearby waypoint so it
    // flies a short hop and holds near the carrier rather than running away on the launch heading.
    await expect.poll(async () => await phase(), { timeout: 30_000 }).toBe("planning");
    await selectNimitz(page);
    await page.locator('[data-testid="air-slot"][data-platform-id="10006"]').getByTestId("air-launch").click();
    await expect(page.getByTestId("air-feedback")).toContainText(/launching/i);
    expect((await airFacts(page)).launched).toHaveLength(1);
    await launchedRow(page).click();
    await page.getByTestId("order-add-waypoint").click();
    await clickGeo(page, 57.45, 25.16);
    await page.keyboard.press("Escape");
    await commitAndResolve();

    // After the burst the launch delay has elapsed: the aircraft is airborne and has moved.
    expect((await airFacts(page)).launched[0].airStatus).toBe("airborne");
    expect((await airFacts(page)).launched[0].pos).not.toEqual({ lng: 57.5, lat: 25.2 });
    await page.getByTestId("cmd-next-turn").click();
    await expect.poll(async () => await phase(), { timeout: 30_000 }).toBe("planning");

    // Turn 2 planning: recover it, then resolve; it lands and starts its turnaround.
    await launchedRow(page).click();
    await page.getByTestId("air-recover").click();
    await expect(page.getByTestId("air-feedback")).toContainText(/returning/i);
    await commitAndResolve();
    await expect.poll(async () => (await airFacts(page)).launched.length, { timeout: 30_000 }).toBe(0);
    expect((await airFacts(page)).airWing.find((s) => s.platformId === HORNET)!.count).toBe(4);
    await page.getByTestId("cmd-next-turn").click();
    await expect.poll(async () => await phase(), { timeout: 30_000 }).toBe("planning");

    // Turn 3 planning: the recovered aircraft has finished turnaround, so the slot is ready again.
    await selectNimitz(page);
    await expect(page.locator('[data-testid="air-slot"][data-platform-id="10006"]').getByTestId("air-launch")).toContainText("LAUNCH");
    await page.locator('[data-testid="air-slot"][data-platform-id="10006"]').getByTestId("air-launch").click();
    await expect(page.getByTestId("air-feedback")).toContainText(/launching/i);
    await expect(launchedRow(page)).toHaveCount(1);
  });
});

test.describe("SAND-AIR-1 save mid-sortie: resume and recover", () => {
  test("an airborne sortie survives a save and load, then lands aboard the carrier", async ({ browser }) => {
    test.setTimeout(420_000);
    mkdirSync(OUT, { recursive: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true });
    const page = await ctx.newPage();
    try {
      await openPlayLite(page, "/play", { e2eHandle: true });
      await takeCommand(page);
      await autopauseOff(page);
      await selectNimitz(page);
      await page.locator('[data-testid="air-slot"][data-platform-id="10006"]').getByTestId("air-launch").click();
      await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
      await playClock(page);
      await waitAir(page, (a) => a.launched.some((u) => u.airStatus === "airborne"));

      // save the running battle (the checkpoint pauses it), then resume from the actual file
      const name = await saveViaUi(page, CHECKPOINT);
      expect(name).toMatch(/^sandkasten-hormuz-T\+\d\dh\d\dm-\d{8}-\d{6}\.sandsave\.json$/);
      const L = await loadViaUi(page, CHECKPOINT);
      expect(L.preview).toContain("STRAIT OF HORMUZ STANDOFF");
      await L.confirm();

      // the restored battle still holds the airborne aircraft, exactly where it was left
      const restored = await airFacts(page);
      expect(restored.launched).toHaveLength(1);
      expect(restored.launched[0].airStatus).toBe("airborne");
      expect(restored.airWing.find((s) => s.platformId === HORNET)!.count).toBe(3);

      // recover it and let it land aboard
      await launchedRow(page).click();
      await page.getByTestId("air-recover").click();
      await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
      await playClock(page);
      await waitAir(page, (a) => a.launched.length === 0 && a.airWing.find((s) => s.platformId === HORNET)!.count === 4);

      // and the resumed carrier can turn it around and launch it again
      await waitAir(page, (a) => a.airWing.find((s) => s.platformId === HORNET)!.readyAtMs <= a.simTime);
      await pauseClock(page);
      await selectNimitz(page);
      await page.locator('[data-testid="air-slot"][data-platform-id="10006"]').getByTestId("air-launch").click();
      await expect(page.getByTestId("air-feedback")).toContainText(/launching/i);
      await expect(launchedRow(page)).toHaveCount(1);
    } finally {
      await ctx.close();
    }
  });
});
