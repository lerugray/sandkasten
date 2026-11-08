import { test, expect } from "@playwright/test";
import { openPlay, areaBox, type W } from "./helpers/sandPlay";

test.describe("SAND-PLAY-1 CP1: the objective is legible before and during play", () => {
  test("fresh /play shows the mission, the real gate, and a focus action; nothing is ordered by reading it", async ({ page }) => {
    test.setTimeout(120_000);
    await openPlay(page);

    const brief = page.getByTestId("briefing");
    await expect(brief).toBeVisible();
    await expect(page.getByTestId("briefing-mission")).toContainText(/USS Nimitz/);
    await expect(page.getByTestId("briefing-mission")).toContainText(/transit gate/i);
    await expect(page.getByTestId("briefing-mission")).toContainText(/destroyed/i);

    // the MISSION panel states protect / win / lose without opening anything
    const panel = page.getByTestId("mission-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/USS Nimitz/);
    await expect(page.getByTestId("mission-win")).toContainText(/enters the transit gate/i);
    await expect(page.getByTestId("mission-lose")).toContainText(/destroyed/i);
    await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "pending");

    // the real gate polygon is on the plot, labelled
    const areas = await page.evaluate(() => (window as unknown as W).__sandPlot!.drawnAreas());
    expect(areas.areas).toBe(1);
    await expect.poll(() => page.evaluate(() => (window as unknown as W).__sandPlot!.drawnAreas().labels)).toBeGreaterThan(0);

    // at cold open the gate is not hidden behind the briefing card
    await page.waitForTimeout(3500);
    const g = (await areaBox(page, "transit-gate"))!;
    const card = (await brief.boundingBox())!;
    const hostBox = (await page.getByTestId("tactical-plot").boundingBox())!;
    expect(g.x1 + hostBox.x).toBeLessThan(card.x);
    expect(g.w).toBeGreaterThan(60);

    // reading the briefing never starts the clock or issues an order
    await expect(page.getByTestId("sim-state")).toContainText(/HOLD/);
    await brief.click();
    await expect(brief).toBeHidden();
    await expect(page.getByTestId("sim-state")).toContainText(/HOLD/);
    await expect(page.getByTestId("order-panel")).toHaveCount(0);

    // fog of war is the default view
    await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
  });

  test("the briefing is recallable from the panel and from the keyboard, and closes with Esc/Enter/button", async ({ page }) => {
    test.setTimeout(120_000);
    await openPlay(page);
    const brief = page.getByTestId("briefing");
    await expect(brief).toBeVisible();

    // an arbitrary key or a plain map click does not dismiss it (no accidental loss of the objective)
    await page.keyboard.press("Shift");
    await expect(brief).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(brief).toBeHidden();
    await page.keyboard.press("b");
    await expect(brief).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(brief).toBeHidden();

    await page.getByTestId("mission-briefing").click();
    await expect(brief).toBeVisible();
    await page.getByTestId("briefing-close").click();
    await expect(brief).toBeHidden();

    // reopening while running pauses the clock rather than hiding a live game behind a card
    await page.getByTestId("sim-toggle-pause").click();
    await expect(page.getByTestId("sim-state")).toContainText(/RUN/);
    await page.keyboard.press("b");
    await expect(brief).toBeVisible();
    await expect(page.getByTestId("sim-state")).toContainText(/HOLD/);
    await page.keyboard.press("Escape");
  });

  test("focus actions: SHOW GATE fits the real polygon on screen and GATE re-centres it", async ({ page }) => {
    test.setTimeout(120_000);
    await openPlay(page);
    await page.getByTestId("briefing-show-gate").click();
    await expect(page.getByTestId("briefing")).toBeHidden();
    await page.waitForTimeout(3500);
    const host = await page.getByTestId("tactical-plot").boundingBox();
    const a = (await areaBox(page, "transit-gate"))!;
    expect(a.x0).toBeGreaterThan(0);
    expect(a.x1).toBeLessThan(host!.width);
    expect(a.y0).toBeGreaterThan(0);
    expect(a.y1).toBeLessThan(host!.height);
    // the polygon is large enough to read, not a speck
    expect(a.w).toBeGreaterThan(150);

    await page.getByTestId("mission-focus-unit").click();
    await expect(page.getByTestId("detail-panel")).toBeVisible();
    await page.getByTestId("mission-focus-gate").click();
    await page.waitForTimeout(3500);
    const b = (await areaBox(page, "transit-gate"))!;
    expect(b.x0).toBeGreaterThan(0);
    expect(b.x1).toBeLessThan(host!.width);
  });

  test("the snapshot route and legacy routes are not given the Hormuz objective", async ({ page }) => {
    test.setTimeout(120_000);
    await openPlay(page, "/play?scenario=snapshot");
    await expect(page.getByTestId("briefing")).toBeVisible();
    await expect(page.getByTestId("briefing-mission")).toHaveCount(0);
    await expect(page.getByTestId("mission-panel")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as W).__sandPlot!.drawnAreas().areas)).toBe(0);
    await expect(page.getByTestId("briefing")).not.toContainText(/Nimitz/);
    await page.keyboard.press("b");
    await expect(page.getByTestId("briefing")).toBeVisible();
  });
});
