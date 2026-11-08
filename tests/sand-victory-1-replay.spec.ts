import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { openPlay, installProbes, probeCounts, sessionState, autopauseOff, runUntilResult, wegoState, type W } from "./helpers/sandPlay";

const OUT = path.join(process.cwd(), "docs", "verification", "sand-victory-1-s409");

const ending = (name: string, side: string, threshold: number, message: string) => ({
  name, repeatable: false, triggers: [{ type: "SideScore", side, threshold, comparison: "gte" }], conditions: [],
  actions: [{ type: "EndScenario", result: "victory", message }],
});

async function addEnding(page: Page, ev: Record<string, unknown>, score: Record<string, number>) {
  await page.evaluate(([e, sc]) => {
    const s = (window as unknown as W).__sandSession as any;
    s.eventState = { ...s.eventState, events: [...s.eventState.events, e] };
    s.gameState = { ...s.gameState, score: { ...s.gameState.score, ...sc } };
  }, [ev, score] as const);
}

const live = async (page: Page) => {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("briefing")).toBeHidden();
  await autopauseOff(page);
  await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
  const label = ((await page.getByTestId("sim-toggle-pause").textContent()) ?? "").trim();
  if (/PLAY/i.test(label)) await page.getByTestId("sim-toggle-pause").click();
};

const fresh = (page: Page) =>
  page.evaluate(() => {
    const snap = ((window as unknown as W).__sandSession as any).snapshot();
    return {
      score: { ...snap.gameState.score } as Record<string, number>,
      result: (snap.eventState?.scenarioResult?.result ?? null) as string | null,
      source: (snap.eventState?.scenarioResult?.source?.event ?? null) as string | null,
      fired: [...(snap.eventState?.firedEvents ?? [])] as string[],
      eventNames: (snap.eventState?.events ?? []).map((e: any) => e.name) as string[],
      intents: (snap.wego?.intents?.length ?? 0) as number,
      log: snap.combatState.combatLog.length as number,
      targetSelected: !!document.querySelector('[data-testid="staged-fire"]'),
    };
  });

test.describe("SAND-VICTORY-1: leaving and re-entering the review, and replaying cleanly", () => {
  test("debrief to record and back keeps the verdict; Enter replays, Space does not; two replays leave nothing behind", async ({ page }) => {
    test.setTimeout(420_000);
    await installProbes(page);
    await openPlay(page, "/play", { e2eHandle: true });
    const base = await fresh(page);
    const baseline = await probeCounts(page);
    const rounds: Record<string, unknown>[] = [];

    for (const round of [1, 2]) {
      await addEnding(page, ending(`Replay Fixture ${round}`, "US Navy", 1, `Replay fixture ${round}.`), { "US Navy": 1 });
      await live(page);
      await runUntilResult(page, 120_000);
      await expect(page.getByTestId("result-title")).toContainText("VICTORY");
      await expect(page.getByTestId("result-deciding")).toContainText(/Ending rule met/i);
      const verdict = (await page.getByTestId("result-deciding").innerText()).trim();
      const score = (await page.getByTestId("result-score").innerText()).trim();
      const played = await fresh(page);
      expect(played.source).toBe(`Replay Fixture ${round}`);
      expect(Number(/US NAVY (-?\d+)/.exec(score)?.[1])).toBe(played.score["US Navy"]);

      // debrief -> record: the strip stays, the record opens on the full run, and the way back is named
      await page.getByTestId("debrief-view-record").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("result-overlay")).toBeHidden();
      await expect(page.getByTestId("result-strip")).toBeVisible();
      await expect(page.getByTestId("combat-record")).toBeVisible();
      await expect(page.getByTestId("record-return")).toContainText(/BACK TO DEBRIEF/);
      // a record filter is a display choice made inside this run
      await page.getByTestId("record-cat-combat").click();
      await expect(page.getByTestId("record-cat-combat")).toHaveAttribute("aria-pressed", "true");

      // record -> debrief: the same verdict and the same score, nothing recomputed
      await page.getByTestId("record-return").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("result-overlay")).toBeVisible();
      expect((await page.getByTestId("result-deciding").innerText()).trim()).toBe(verdict);
      expect((await page.getByTestId("result-score").innerText()).trim()).toBe(score);

      // the strip route and the Space key: Space is the clock key and must not start a new run
      await page.getByTestId("review-record").click();
      await expect(page.getByTestId("result-strip")).toBeVisible();
      await page.getByTestId("show-debrief").click();
      await page.getByTestId("play-again").focus();
      await page.keyboard.press("Space");
      await expect(page.getByTestId("result-overlay")).toBeVisible();
      expect((await fresh(page)).result).toBe("victory");

      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("result-overlay")).toBeHidden();
      await expect(page.getByTestId("briefing")).toBeVisible();
      await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "pending");

      const again = await fresh(page);
      expect(again.result).toBeNull();
      expect(again.source).toBeNull();
      expect(again.score["US Navy"] ?? 0).toBe(0);
      expect(again.score["Iran"] ?? 0).toBe(0);
      expect(again.fired.filter((n) => n.startsWith("Replay Fixture"))).toEqual([]);
      expect(again.eventNames).toEqual(base.eventNames);
      expect(again.intents).toBe(0);
      expect(again.log).toBe(0);
      expect(again.targetSelected).toBe(false);

      // the record is empty and unfiltered in the new run
      await page.getByTestId("sidebar-tab-combat").click();
      await expect(page.getByTestId("record-window")).toContainText("SHOWING 0 OF 0");
      await expect(page.getByTestId("record-cat-all")).toHaveAttribute("aria-pressed", "true");
      await page.getByTestId("sidebar-tab-forces").click();

      const counts = await probeCounts(page);
      expect(counts.keydown).toBe(baseline.keydown);
      expect(counts.total).toBe(baseline.total);
      expect(counts.intervals).toBe(baseline.intervals);
      rounds.push({ round, verdict, score, sourceEvent: played.source, afterReplay: again, probes: counts });
    }
    mkdirSync(OUT, { recursive: true });
    writeFileSync(path.join(OUT, "replay-rounds.json"), JSON.stringify({ baselineProbes: baseline, baseEventNames: base.eventNames, rounds }, null, 2));
  });

  test("RESET after a result and RESET in a WeGo plan both return to a fresh briefing with no leftover orders", async ({ page }) => {
    test.setTimeout(300_000);
    await openPlay(page, "/play", { e2eHandle: true });
    const base = await fresh(page);
    const baseSession = await sessionState(page);

    // WeGo: choose the mode, plan an order, then RESET: the mode choice, the intent and the clock are all new
    await page.getByTestId("mode-wego").click();
    await expect(page.getByTestId("mode-wego")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("briefing")).toBeHidden();
    await page.getByTestId("mission-focus-unit").click();
    await page.getByTestId("order-add-waypoint").click();
    await page.keyboard.press("Escape");
    await page.getByTestId("cmd-reset").click();
    await expect(page.getByTestId("briefing")).toBeVisible();
    const w = await wegoState(page);
    expect(w.intents).toBe(0);
    expect(w.turnsCommitted).toBe(0);
    expect(w.simTime).toBe(baseSession.simTime);
    expect((await sessionState(page)).orders).toBe(baseSession.orders);

    // RESET after a result goes through the same path as PLAY AGAIN (the next run is chosen continuous)
    await page.getByTestId("mode-continuous").click();
    await expect(page.getByTestId("mode-continuous")).toHaveAttribute("aria-pressed", "true");
    await addEnding(page, ending("Reset Fixture", "US Navy", 1, "Reset fixture."), { "US Navy": 1 });
    await live(page);
    await runUntilResult(page, 120_000);
    await expect(page.getByTestId("result-title")).toContainText("VICTORY");
    await page.getByTestId("review-record").click();
    await expect(page.getByTestId("result-strip")).toBeVisible();
    await page.getByTestId("cmd-reset").click();
    await expect(page.getByTestId("result-strip")).toHaveCount(0);
    await expect(page.getByTestId("result-overlay")).toHaveCount(0);
    await expect(page.getByTestId("briefing")).toBeVisible();
    const again = await fresh(page);
    expect(again.result).toBeNull();
    expect(again.score["US Navy"] ?? 0).toBe(0);
    expect(again.eventNames).toEqual(base.eventNames);
    expect(again.log).toBe(0);
  });
});
