import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

/**
 * SAND-EDITOR-1: reference points and victory conditions in the scenario editor, and a scenario
 * built there plays to a real VICTORY and a real DEFEAT through the engine's own event evaluator.
 *
 * The play half uses the test-only E2E session handle to set a unit's damage state (the same state
 * the combat phase produces) and lets the shipped event evaluator fire the authored ending; the
 * debrief is the ordinary result overlay, not a fabricated result.
 */
const OUT = path.join(process.cwd(), "test-results", "sand-editor-1");
test.describe.configure({ timeout: 300_000 });

async function openEditor(page: Page) {
  await page.goto("/editor", { timeout: 120_000 });
  await expect(page.getByTestId("editor-load")).toBeVisible({ timeout: 60_000 });
}

async function loadFile(page: Page, file: string) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 10_000 }), page.getByTestId("editor-load").click()]);
  await chooser.setFiles(file);
  await expect(page.getByTestId("editor-file-message")).toContainText(/Loaded/i);
}

async function saveDownload(page: Page, file: string) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("editor-save").click()]);
  await dl.saveAs(file);
  return JSON.parse(readFileSync(file, "utf8"));
}

async function waitMapReady(page: Page) {
  await page.waitForFunction(
    () => {
      const m = (window as unknown as { __sandMap?: { isStyleLoaded?: () => boolean } }).__sandMap;
      return !!m && (m.isStyleLoaded?.() ?? false);
    },
    null,
    { timeout: 60_000 },
  );
}

/** A real mouse click on the MapLibre canvas at a fraction of its box. */
async function clickMap(page: Page, fx: number, fy: number) {
  await waitMapReady(page);
  const canvas = page.locator(".maplibregl-canvas").first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("map canvas has no box");
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

const SEED = {
  name: "Editor Win-Loss",
  description: "",
  briefing: "Destroy Bravo to win. Keep Alpha alive.",
  theater: { center: { lng: 56.5, lat: 26.5 }, zoom: 7 },
  startTime: "2026-01-01T00:00:00.000Z",
  playerSide: "Side A",
  sides: [
    {
      name: "Side A",
      color: "#00aaff",
      isAI: false,
      units: [
        { id: "a1", name: "Alpha", platformId: 10001, side: "Side A", position: { lng: 56.5, lat: 26.5 }, heading: 0, speed: 0, damageState: "undamaged" },
      ],
    },
    {
      name: "Side B",
      color: "#ff4444",
      isAI: true,
      units: [
        { id: "b1", name: "Bravo", platformId: 10013, side: "Side B", position: { lng: 57.0, lat: 27.0 }, heading: 0, speed: 0, damageState: "undamaged" },
      ],
    },
  ],
  referencePoints: [],
  victoryConditions: [],
};

test.describe("SAND-EDITOR-1 reference points and victory conditions (editor)", () => {
  test("create, name, move and delete a reference point; create an area", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    await openEditor(page);

    await page.getByTestId("editor-tool-reference-points").click();
    await expect(page.getByTestId("reference-points-panel")).toBeVisible();

    // A point: arm, click the map, then rename it.
    await page.getByTestId("refpoint-new-point").click();
    await expect(page.getByTestId("refpoint-placing")).toContainText("Click the map to place this point");
    await clickMap(page, 0.6, 0.55);
    await expect(page.getByTestId("refpoint-marker")).toHaveCount(1, { timeout: 15_000 });
    await page.getByTestId("refpoint-name").fill("Rally Point");
    await expect(page.locator('[data-testid="refpoint-marker"]', { hasText: "Rally Point" })).toBeVisible();

    // Move it: drag the marker, then the saved position differs from the placed one.
    const before = await saveDownload(page, path.join(OUT, "before-move.json"));
    const marker = page.getByTestId("refpoint-marker").first();
    const mbox = await marker.boundingBox();
    if (mbox) {
      await page.mouse.move(mbox.x + mbox.width / 2, mbox.y + mbox.height / 2);
      await page.mouse.down();
      await page.mouse.move(mbox.x + mbox.width / 2 + 120, mbox.y + mbox.height / 2 + 80, { steps: 20 });
      await page.mouse.up();
    }
    const after = await saveDownload(page, path.join(OUT, "after-move.json"));
    expect(after.referencePoints[0].points[0]).not.toEqual(before.referencePoints[0].points[0]);
    expect(after.referencePoints[0].name).toBe("Rally Point");

    // An area: three corners, then finish.
    await page.getByTestId("refpoint-new-area").click();
    await expect(page.getByTestId("refpoint-placing")).toBeVisible();
    await clickMap(page, 0.5, 0.6);
    await clickMap(page, 0.55, 0.62);
    await clickMap(page, 0.52, 0.66);
    await page.getByTestId("refpoint-finish-area").click();
    await expect(page.getByTestId("refpoint-placing")).toHaveCount(0);
    const saved = await saveDownload(page, path.join(OUT, "with-area.json"));
    const area = saved.referencePoints.find((r: { type: string }) => r.type === "area");
    expect(area).toBeTruthy();
    expect(area.points.length).toBeGreaterThanOrEqual(3);

    // Delete the point.
    const pointRow = page.getByTestId("refpoint-row").filter({ hasText: "Rally Point" });
    await pointRow.click();
    await pointRow.getByTestId("refpoint-delete").click();
    const afterDelete = await saveDownload(page, path.join(OUT, "after-delete.json"));
    expect(afterDelete.referencePoints.some((r: { name: string }) => r.name === "Rally Point")).toBe(false);
  });

  test("victory conditions are authored in plain words and survive save/load", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    const seed = path.join(OUT, "seed.json");
    writeFileSync(seed, JSON.stringify(SEED));
    await openEditor(page);
    await loadFile(page, seed);

    await page.getByTestId("editor-tool-victory-conditions").click();
    await expect(page.getByTestId("victory-conditions-panel")).toBeVisible();

    await page.getByTestId("victory-add").click();
    await page.getByTestId("victory-kind").selectOption("destroy-unit");
    await page.getByTestId("victory-unit").selectOption("b1");
    await page.getByTestId("victory-result").selectOption("victory");

    await page.getByTestId("victory-add").click();
    await page.getByTestId("victory-kind").selectOption("protect-unit");
    await page.getByTestId("victory-unit").selectOption("a1");

    await expect(page.getByTestId("victory-row").filter({ hasText: "Bravo is destroyed" })).toBeVisible();
    await expect(page.getByTestId("victory-row").filter({ hasText: "Alpha is destroyed" })).toBeVisible();

    const saved = await saveDownload(page, path.join(OUT, "with-victory.json"));
    expect(saved.victoryConditions).toHaveLength(2);
    expect(saved.victoryConditions.map((c: { kind: string }) => c.kind).sort()).toEqual(["destroy-unit", "protect-unit"]);

    // A fresh editor loads the same file back with the same conditions.
    await openEditor(page);
    await loadFile(page, path.join(OUT, "with-victory.json"));
    await page.getByTestId("editor-tool-victory-conditions").click();
    await expect(page.getByTestId("victory-row").filter({ hasText: "Bravo is destroyed" })).toBeVisible();
    await expect(page.getByTestId("victory-row").filter({ hasText: "Alpha is destroyed" })).toBeVisible();
  });
});

test.describe("SAND-EDITOR-1 a from-scratch scenario plays to VICTORY and DEFEAT", () => {
  test("the authored destroy-unit and protect-unit endings fire through the engine", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __SAND_E2E__?: boolean }).__SAND_E2E__ = true;
    });
    mkdirSync(OUT, { recursive: true });
    const seed = path.join(OUT, "play-seed.json");
    const scenario = {
      ...SEED,
      victoryConditions: [
        { id: "win", kind: "destroy-unit", result: "victory", message: "Bravo destroyed.", unitId: "b1" },
        { id: "lose", kind: "protect-unit", result: "defeat", message: "Alpha was lost.", unitId: "a1" },
      ],
    };
    writeFileSync(seed, JSON.stringify(scenario));

    await openEditor(page);
    await loadFile(page, seed);

    // PLAY hands the current scenario to the play screen through localStorage.
    await page.getByTestId("editor-play").click();
    await page.waitForFunction(() => !!(window as unknown as { __sandPlot?: unknown }).__sandPlot, null, { timeout: 120_000 });
    await page.waitForFunction(() => ((window as unknown as { __sandPlot?: { frames(): number } }).__sandPlot?.frames() ?? 0) > 30, null, { timeout: 90_000 });
    await page.waitForFunction(() => !!(window as unknown as { __sandSession?: unknown }).__sandSession, null, { timeout: 60_000 });

    // The briefing states the conditions in plain words (the protect/own-side line is the stated one).
    await expect(page.getByTestId("briefing")).toBeVisible();
    await page.keyboard.press("Escape");

    // --- VICTORY: destroy the enemy unit, exactly as the combat phase would leave it ---
    await page.evaluate(() => {
      const s = (window as unknown as { __sandSession: { gameState: { sides: { units: { id: string; damageState: string }[] }[] } } }).__sandSession;
      const u = s.gameState.sides.flatMap((x) => x.units).find((x) => x.id === "b1");
      if (!u) throw new Error("b1 missing");
      u.damageState = "destroyed";
    });
    await page.getByTestId("sim-toggle-pause").click();
    await expect(page.getByTestId("result-overlay")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("result-title")).toContainText("VICTORY");

    // --- DEFEAT: play again fresh, then lose the protected unit ---
    await page.getByTestId("play-again").click();
    await expect(page.getByTestId("result-overlay")).toBeHidden();
    await expect(page.getByTestId("briefing")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.evaluate(() => {
      const s = (window as unknown as { __sandSession: { gameState: { sides: { units: { id: string; damageState: string }[] }[] } } }).__sandSession;
      const u = s.gameState.sides.flatMap((x) => x.units).find((x) => x.id === "a1");
      if (!u) throw new Error("a1 missing");
      u.damageState = "destroyed";
    });
    await page.getByTestId("sim-toggle-pause").click();
    await expect(page.getByTestId("result-overlay")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("result-title")).toContainText("DEFEAT");
  });
});
