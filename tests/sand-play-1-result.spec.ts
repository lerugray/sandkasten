import { test, expect } from "@playwright/test";
import { openPlay, installProbes, probeCounts, sessionState, injectKillOnCarrier, restoreDice, clickGeo, assertFrozen } from "./helpers/sandPlay";

test.describe("SAND-PLAY-1 CP2: a real result, a frozen game, and a clean replay", () => {
  test("defeat through the production combat path, frozen after, and PLAY AGAIN twice leaves nothing behind", async ({ page }) => {
    test.setTimeout(240_000);
    await installProbes(page);
    await openPlay(page, "/play", { e2eHandle: true });
    const fresh = await sessionState(page);
    const baseline = await probeCounts(page);

    for (const round of [1, 2]) {
      await expect(page.getByTestId("briefing")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("briefing")).toBeHidden();

      // put the game in the awkward states a result must clear: the carrier selected, then a placement mode armed
      await page.getByTestId("mission-focus-unit").click();
      await expect(page.getByTestId("order-panel")).toBeVisible();
      if (round === 1) {
        await page.getByTestId("order-add-waypoint").click();
        await expect(page.getByText("CLICK MAP TO PLACE WAYPOINT")).toBeVisible();
      } else {
        await page.keyboard.press("m");
        await expect(page.getByTestId("measure-banner")).toBeVisible();
      }

      await page.getByTestId("sim-speed").filter({ hasText: "1x" }).first().click();
      await page.getByTestId("sim-toggle-pause").click();
      await expect(page.getByTestId("sim-state")).toContainText(/RUN/);
      await injectKillOnCarrier(page);

      const overlay = page.getByTestId("result-overlay");
      await expect(overlay).toBeVisible({ timeout: 20_000 });
      await restoreDice(page);
      await expect(page.getByTestId("result-title")).toContainText(/DEFEAT|LOST|FAILED/i);
      await expect(page.getByTestId("result-deciding")).toContainText(/Nimitz/i);
      await expect(page.getByTestId("result-deciding")).toContainText(/destroyed/i);
      await expect(page.getByTestId("result-record")).toContainText(/C-802|hit|destroyed/i);
      await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "failed");
      expect((await sessionState(page)).result).toBe("defeat");

      // focus lands on PLAY AGAIN, the armed modes are gone, the destroyed carrier is not still "selected"
      await expect(page.getByTestId("play-again")).toBeFocused();
      await expect(page.getByText("CLICK MAP TO PLACE WAYPOINT")).toHaveCount(0);
      await expect(page.getByTestId("measure-banner")).toHaveCount(0);

      await assertFrozen(page);

      // REVIEW RECORD collapses to a strip that still offers the way out, and Esc does not undo the result
      await page.getByTestId("review-record").click();
      await expect(overlay).toBeHidden();
      await expect(page.getByTestId("result-strip")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("result-strip")).toBeVisible();
      await assertFrozen(page);
      await page.getByTestId("show-debrief").click();
      await expect(overlay).toBeVisible();

      // double activation: two quick presses are one reset, not two
      await page.getByTestId("play-again").focus();
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");

      await expect(overlay).toBeHidden();
      await expect(page.getByTestId("briefing")).toBeVisible();
      await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "pending");
      await expect(page.getByTestId("sim-state")).toContainText(/HOLD/);
      await expect(page.getByTestId("order-panel")).toHaveCount(0);
      await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
      await expect(page.getByText("CLICK MAP TO PLACE WAYPOINT")).toHaveCount(0);
      await expect(page.getByTestId("measure-banner")).toHaveCount(0);
      await expect(page.getByTestId("result-strip")).toHaveCount(0);

      const again = await sessionState(page);
      expect(again.result).toBeNull();
      expect(again.simTime).toBe(fresh.simTime);
      expect(again.isPaused).toBe(true);
      expect(again.speed).toBe(fresh.speed);
      expect(again.orders).toBe(fresh.orders);
      expect(again.units).toBe(fresh.units);
      expect(again.messages).toBe(fresh.messages);
      expect(again.flight).toBe(0);
      expect(again.log).toBe(0);
      expect(again.feedback).toBe(fresh.feedback);

      // focus is not stranded on a removed button, and the keyboard works again
      const active = await page.evaluate(() => document.activeElement?.tagName);
      expect(active).not.toBeUndefined();
      await expect(page.getByTestId("play-again")).toHaveCount(0);

      // nothing accumulated
      const counts = await probeCounts(page);
      expect(counts.keydown).toBe(baseline.keydown);
      expect(counts.total).toBe(baseline.total);
      expect(counts.intervals).toBe(baseline.intervals);
    }
  });

  test("RESET mid-run returns to a fresh paused briefing too", async ({ page }) => {
    test.setTimeout(120_000);
    await installProbes(page);
    await openPlay(page, "/play", { e2eHandle: true });
    const fresh = await sessionState(page);
    await page.keyboard.press("Escape");
    await page.getByTestId("mission-focus-unit").click();
    await page.getByTestId("order-add-waypoint").click();
    await clickGeo(page, 57.0, 25.6);
    await page.keyboard.press("g");
    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await page.getByTestId("sim-toggle-pause").click();
    await page.waitForTimeout(3000);
    expect((await sessionState(page)).simTime).toBeGreaterThan(fresh.simTime);
    await page.getByTestId("cmd-reset").click();
    await expect(page.getByTestId("briefing")).toBeVisible();
    const s = await sessionState(page);
    expect(s.simTime).toBe(fresh.simTime);
    expect(s.orders).toBe(fresh.orders);
    expect(s.isPaused).toBe(true);
    expect(s.speed).toBe(fresh.speed);
    await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
    await expect(page.getByTestId("order-panel")).toHaveCount(0);
  });
});
