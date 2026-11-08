import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { openPlay, clickGeo, runUntilResult, assertFrozen, GATE, type W } from "./helpers/sandPlay";

const OUT = path.join(process.cwd(), "docs", "verification", "sand-play-1-s409");

/** Ordinary player actions only: keyboard, buttons and real mouse clicks on the plot. No state is touched. */
async function orderShip(page: Page, rowText: string | RegExp, waypoints: { lng: number; lat: number }[], throttle: string) {
  await page.getByTestId("force-row").filter({ hasText: rowText }).first().click();
  await expect(page.getByTestId("order-panel")).toBeVisible();
  await page.getByTestId("order-add-waypoint").click();
  await expect(page.getByText("CLICK MAP TO PLACE WAYPOINT")).toBeVisible();
  for (const [i, w] of waypoints.entries()) {
    await clickGeo(page, w.lng, w.lat);
    await expect(page.getByTestId("order-waypoint-item")).toHaveCount(i + 1);
  }
  await page.keyboard.press("Escape"); // leave placement mode
  await page.getByTestId("order-throttle").filter({ hasText: throttle }).click();
}

const log: Record<string, unknown> = {};

async function finish(page: Page, name: string, orders: unknown) {
  await runUntilResult(page, 420_000);
  await expect(page.getByTestId("result-title")).toContainText(/VICTORY|COMPLETE/i);
  await expect(page.getByTestId("result-deciding")).toContainText(/Nimitz/);
  await expect(page.getByTestId("result-deciding")).toContainText(/gate/i);
  await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "complete");
  const record = await page.getByTestId("result-record").innerText();
  const clockText = await page.getByTestId("sim-clock").innerText();
  const renderer = await page.evaluate(() => (window as unknown as W).__sandPlot!.rendererInfo().renderer);
  log[name] = { orders, result: await page.getByTestId("result-title").innerText(), deciding: await page.getByTestId("result-deciding").innerText(), clock: clockText, record, renderer, godMode: await page.getByLabel("Toggle god mode").getAttribute("data-active") };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, `plan-${name}.json`), JSON.stringify(log[name], null, 2));
  await page.screenshot({ path: path.join(OUT, `plan-${name}-victory.png`) });
  await assertFrozen(page, { selected: false });
  // PLAY AGAIN: a fresh paused scenario with the briefing and default fog
  await page.getByTestId("play-again").click();
  await expect(page.getByTestId("briefing")).toBeVisible();
  await expect(page.getByTestId("sim-state")).toContainText(/HOLD/);
  await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
  await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "pending");
}

test.describe("SAND-PLAY-1: two distinct plans, played through the ordinary UI, reach a real victory", () => {
  test("plan A: the carrier alone, flank, straight at the gate", async ({ page }) => {
    test.setTimeout(540_000);
    await openPlay(page, "/play", { e2eHandle: true });
    // cold open: read the objective, then take command
    await expect(page.getByTestId("briefing-mission")).toContainText(/transit gate/i);
    await page.getByTestId("briefing-show-gate").click();
    await expect(page.getByTestId("briefing")).toBeHidden();
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
    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await page.getByTestId("sim-toggle-pause").click();
    await finish(page, "A-direct-flank", { carrier: [GATE.centre], throttle: "FLANK", speed: "60x" });
  });

  test("plan B: escorts ahead to the gate, the carrier by a southern dog-leg at full", async ({ page }) => {
    test.setTimeout(540_000);
    await openPlay(page, "/play", { e2eHandle: true });
    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
    const escortGoal = { lng: 56.5, lat: 26.6 };
    for (const row of [/Chosin/, /Mahan/, /Cole/]) await orderShip(page, row, [escortGoal], "FULL");
    await orderShip(page, /Nimitz/, [{ lng: 57.0, lat: 25.9 }, GATE.centre], "FULL");
    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await page.getByTestId("sim-toggle-pause").click();
    await finish(page, "B-escorted-dogleg", { escorts: [escortGoal], carrier: [{ lng: 57.0, lat: 25.9 }, GATE.centre], throttle: "FULL", speed: "60x" });
  });
});
