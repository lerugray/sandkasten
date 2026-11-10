import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { openPlay, autopauseOff } from "./helpers/sandPlay";

/**
 * SAND-RC-FIX1: the two player-visible defects from the RC cold play, plus the small ones in the same files.
 * Ordinary player actions only: real clicks, real file choosers and downloads, real key presses.
 */
const OUT = path.join(process.cwd(), "test-results", "sand-rc-fix1");

// The play page runs on software GL in CI containers: opening it is slow, the checks after it are not.
test.describe.configure({ timeout: 240_000 });

// ---------------------------------------------------------------------------------------------
// Defect 1: editor LOAD
// ---------------------------------------------------------------------------------------------
async function openEditor(page: Page) {
  await page.goto("/editor", { timeout: 120_000 });
  await expect(page.getByTestId("editor-load")).toBeVisible({ timeout: 60_000 });
}

async function saveDownload(page: Page, file: string) {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByTestId("editor-save").click()]);
  await dl.saveAs(file);
  return JSON.parse(readFileSync(file, "utf8"));
}

async function loadFile(page: Page, file: string) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 10_000 }), page.getByTestId("editor-load").click()]);
  await chooser.setFiles(file);
}

test.describe("SAND-RC-FIX1 defect 1: editor LOAD", () => {
  test("LOAD opens a chooser, and a scenario saved by SAVE loads back unchanged", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openEditor(page);

    // a real edit through the settings panel, then SAVE
    await page.getByText("Scenario Settings").click();
    await page.locator("div.w-80 input").first().fill("Round Trip Strait");
    const saved = await saveDownload(page, path.join(OUT, "saved-1.json"));
    expect(saved.name).toBe("Round Trip Strait");

    // a fresh editor, then LOAD the file the player just saved
    await openEditor(page);
    await expect(page.getByText("New Scenario").first()).toBeVisible();
    await loadFile(page, path.join(OUT, "saved-1.json"));
    await expect(page.getByTestId("editor-file-message")).toContainText("Loaded Round Trip Strait");
    await expect(page.getByText("Round Trip Strait").first()).toBeVisible();

    // SAVE again: the same scenario comes back out
    const again = await saveDownload(page, path.join(OUT, "saved-2.json"));
    expect(again).toEqual(saved);
    expect(errors).toEqual([]);
  });

  test("a scenario with units loads and shows them in the forces list", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    const file = path.join(OUT, "with-units.json");
    writeFileSync(file, JSON.stringify({
      name: "Two Ships",
      description: "", briefing: "",
      theater: { center: { lng: 56.5, lat: 26.5 }, zoom: 7 },
      startTime: "2026-01-01T00:00:00.000Z",
      playerSide: "Side A",
      sides: [
        { name: "Side A", color: "#00aaff", isAI: false, units: [
          { id: "a1", name: "Alpha", platformId: 1, side: "Side A", position: { lng: 56.2, lat: 26.2 }, heading: 0, speed: 0, damageState: "undamaged" },
          { id: "a2", name: "Bravo", platformId: 1, side: "Side A", position: { lng: 56.3, lat: 26.3 }, heading: 0, speed: 0, damageState: "undamaged" },
        ] },
        { name: "Side B", color: "#ff4444", isAI: true, units: [] },
      ],
      referencePoints: [],
    }));
    await openEditor(page);
    await loadFile(page, file);
    await expect(page.getByTestId("editor-file-message")).toContainText("Loaded Two Ships");
    await expect(page.getByText("Side A (2)")).toBeVisible();
  });

  test("a file that is not a scenario (a battle save) is refused with a message, not the browser error page", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await openEditor(page);
    for (const [name, body] of [["battle.sandsave.json", { format: "sandkasten-save", clock: 123 }], ["list.json", [1, 2]], ["null.json", null]] as const) {
      const file = path.join(OUT, name);
      writeFileSync(file, JSON.stringify(body));
      await loadFile(page, file);
      await expect(page.getByTestId("editor-file-message")).toContainText(/not a scenario/i);
      await expect(page.getByText("This page couldn’t load")).toHaveCount(0);
      await expect(page.getByText("New Scenario").first()).toBeVisible(); // the editor still holds the blank scenario
    }
    // the editor still works afterwards: the same file picker opens again
    const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 10_000 }), page.getByTestId("editor-load").click()]);
    expect(chooser).toBeTruthy();
    expect(errors).toEqual([]);
  });
});

test.describe("SAND-RC-FIX2: editor LOAD refuses out-of-range positions", () => {
  test("a scenario with a unit at latitude 95 shows the message, no error page, editor untouched", async ({ page }) => {
    mkdirSync(OUT, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const file = path.join(OUT, "lat95.json");
    writeFileSync(file, JSON.stringify({
      name: "Off The Map", description: "", briefing: "",
      theater: { center: { lng: 56.5, lat: 26.5 }, zoom: 7 },
      startTime: "2026-01-01T00:00:00.000Z", playerSide: "Side A",
      sides: [
        { name: "Side A", color: "#00aaff", isAI: false, units: [
          { id: "a1", name: "Alpha", platformId: 1, side: "Side A", position: { lng: 56.2, lat: 95 }, heading: 0, speed: 0, damageState: "undamaged" },
        ] },
        { name: "Side B", color: "#ff4444", isAI: true, units: [] },
      ],
      referencePoints: [],
    }));
    await openEditor(page);
    await loadFile(page, file);
    await expect(page.getByTestId("editor-file-message")).toContainText(/off the map/i);
    await expect(page.getByText("This page couldn’t load")).toHaveCount(0);
    await expect(page.getByText("New Scenario").first()).toBeVisible();
    await expect(page.getByText("Off The Map")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Defect 2 + S3: the ORDERS panel
// ---------------------------------------------------------------------------------------------
type Box = { x: number; y: number; width: number; height: number };

async function boxes(page: Page, testId: string): Promise<Box[]> {
  return page.getByTestId(testId).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    }),
  );
}

/** Inside the viewport AND inside the scrolling sidebar body (so not clipped by it). */
async function visibleInSidebar(page: Page, testId: string) {
  return page.getByTestId(testId).evaluateAll((els) => {
    const body = document.querySelector(".tx-panel-body")!.getBoundingClientRect();
    return els.every((e) => {
      const r = e.getBoundingClientRect();
      return r.top >= body.top - 1 && r.bottom <= body.bottom + 1 && r.top >= 0 && r.bottom <= innerHeight;
    });
  });
}

async function takeCommand(page: Page) {
  await openPlay(page, "/play", { e2eHandle: true });
  await page.keyboard.press("Escape"); // close the briefing
  await expect(page.getByTestId("briefing")).toBeHidden();
}

async function selectNimitz(page: Page) {
  await page.getByTestId("force-row").filter({ hasText: /Nimitz/ }).first().click();
  await expect(page.getByTestId("order-panel")).toBeVisible();
}

/** Real map clicks, placed in the open water between the sidebar and the detail panel. */
async function clickWaypoints(page: Page, count: number) {
  const vw = page.viewportSize()!;
  const pts = [[0.36, 0.42], [0.42, 0.5], [0.48, 0.46], [0.54, 0.54], [0.5, 0.38]];
  for (let i = 0; i < count; i++) {
    await page.mouse.click(vw.width * pts[i][0], vw.height * pts[i][1]);
    await expect(page.getByTestId("order-waypoint-item")).toHaveCount(i + 1, { timeout: 10_000 });
  }
}

for (const size of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test.describe(`SAND-RC-FIX1 defect 2: ORDERS panel at ${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    test("(c) selecting a unit puts its ORDERS panel, through the ROE rows, inside the viewport", async ({ page }) => {
      await takeCommand(page);
      await selectNimitz(page);
      await expect(page.getByTestId("order-panel")).toBeVisible();
      expect(await visibleInSidebar(page, "order-throttle")).toBe(true);
      expect(await visibleInSidebar(page, "order-roe")).toBe(true);
      expect(await visibleInSidebar(page, "order-add-waypoint")).toBe(true);

      // another unit: same
      await page.getByTestId("force-row").filter({ hasText: /Hornet 101/ }).first().click();
      await expect(page.getByTestId("order-panel")).toContainText("Hornet 101");
      expect(await visibleInSidebar(page, "order-throttle")).toBe(true);
      expect(await visibleInSidebar(page, "order-roe")).toBe(true);
    });

    test("(b) adding 4 waypoints leaves the THROTTLE and ROE buttons exactly where they were", async ({ page }) => {
      await takeCommand(page);
      await selectNimitz(page);
      const before = { throttle: await boxes(page, "order-throttle"), roe: await boxes(page, "order-roe"), add: await boxes(page, "order-add-waypoint") };
      expect(before.throttle).toHaveLength(5);
      expect(before.roe).toHaveLength(3);

      await page.getByTestId("order-add-waypoint").click();
      await expect(page.getByText("CLICK MAP TO PLACE WAYPOINT")).toBeVisible();
      await clickWaypoints(page, 4);

      const after = { throttle: await boxes(page, "order-throttle"), roe: await boxes(page, "order-roe"), add: await boxes(page, "order-add-waypoint") };
      expect(after.throttle).toEqual(before.throttle);
      expect(after.roe).toEqual(before.roe);
      // the ADD WAYPOINT button changes its label (so its width), never its place
      expect(after.add.map(({ x, y, height }) => ({ x, y, height }))).toEqual(before.add.map(({ x, y, height }) => ({ x, y, height })));
      expect(await visibleInSidebar(page, "order-roe")).toBe(true);

      // the list is bounded: 4 entries, in a box that scrolls rather than grows
      const list = await boxes(page, "order-waypoints-list");
      expect(list).toHaveLength(1);
      expect(list[0].height).toBeLessThanOrEqual(110);

      // the click aimed at FLANK sets FLANK, and the click aimed at ROE FREE sets FREE
      await page.getByTestId("order-throttle").filter({ hasText: "FLANK" }).click();
      await expect(page.getByTestId("order-throttle").filter({ hasText: "FLANK" })).toHaveClass(/font-bold/);
      await page.getByTestId("order-roe").filter({ hasText: "FREE" }).click();
      await expect(page.getByTestId("order-roe").filter({ hasText: "FREE" })).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("order-roe").filter({ hasText: "HOLD" })).toHaveAttribute("aria-pressed", "false");
    });

    test("no black or clipped region after a visit to COMBAT; the sidebar body fills its panel", async ({ page }) => {
      await takeCommand(page);
      await selectNimitz(page);
      await page.getByTestId("order-add-waypoint").click();
      await clickWaypoints(page, 3);
      for (const tab of ["combat", "forces", "messages", "forces"]) {
        await page.getByTestId(`sidebar-tab-${tab}`).click();
        await expect(page.getByTestId(`sidebar-tab-${tab}`)).toHaveAttribute("data-active", "true");
        const geo = await page.evaluate(() => {
          const aside = document.querySelector('[data-testid="side-panel"]')!.getBoundingClientRect();
          const bodyEl = document.querySelector(".tx-panel-body") as HTMLElement;
          const body = bodyEl.getBoundingClientRect();
          const cue = document.querySelector('[data-testid="more-cue"]')!.getBoundingClientRect();
          return { gap: aside.bottom - cue.bottom, bodyToCue: cue.top - body.bottom, maxHeight: bodyEl.style.maxHeight, cueH: cue.height };
        });
        expect(geo.maxHeight).toBe(""); // nothing pins the body to a stale height
        expect(Math.abs(geo.gap)).toBeLessThanOrEqual(2); // the cue row ends at the panel's bottom edge
        expect(Math.abs(geo.bodyToCue)).toBeLessThanOrEqual(1); // and the body runs right down to it: no dead band
      }
      // back on FORCES with a unit selected: its controls are in view without any wheel scroll
      expect(await visibleInSidebar(page, "order-throttle")).toBe(true);
      expect(await visibleInSidebar(page, "order-roe")).toBe(true);
    });

    test("S3: re-clicking the selected unit shows its orders again; NIMITZ from COMBAT lands on FORCES", async ({ page }) => {
      await takeCommand(page);
      await selectNimitz(page);
      // scroll the orders out of view, then click the already-selected unit
      await page.locator(".tx-panel-body").evaluate((el) => { el.scrollTop = 0; });
      await page.getByTestId("force-row").filter({ hasText: /Nimitz/ }).first().click();
      expect(await visibleInSidebar(page, "order-roe")).toBe(true);

      await page.getByTestId("sidebar-tab-combat").click();
      await expect(page.getByTestId("order-panel")).toHaveCount(0);
      await page.getByTestId("mission-focus-unit").click();
      await expect(page.getByTestId("sidebar-tab-forces")).toHaveAttribute("data-active", "true");
      await expect(page.getByTestId("order-panel")).toBeVisible();
      expect(await visibleInSidebar(page, "order-roe")).toBe(true);
    });
  });
}

test.describe("SAND-RC-FIX1 S3: keys and tabs", () => {
  test("Space runs the clock after a sidebar button was clicked, and does not press the button; Enter still does", async ({ page }) => {
    await takeCommand(page);
    await autopauseOff(page);
    await selectNimitz(page);
    const add = page.getByTestId("order-add-waypoint");
    await add.click();
    await expect(add).toContainText("PLACING");
    await expect(page.getByTestId("sim-state")).toContainText(/HOLD/);

    await page.keyboard.press("Space"); // the button still has keyboard focus
    await expect(add).toContainText("PLACING"); // not re-pressed
    await expect(page.getByTestId("sim-state")).not.toContainText(/HOLD/); // the clock ran
    await page.keyboard.press("Space");
    await expect(page.getByTestId("sim-state")).toContainText(/HOLD/); // and Space pauses it again
    await expect(add).toContainText("PLACING");

    await page.keyboard.press("Enter"); // Enter still activates a focused button
    await expect(add).toContainText("ADD WAYPOINT");
  });

  test("every sidebar tab switches when clicked, including MEDIA, also after waypoints and a COMBAT visit", async ({ page }) => {
    await takeCommand(page);
    await selectNimitz(page);
    await page.getByTestId("order-add-waypoint").click();
    await clickWaypoints(page, 2);
    for (const tab of ["messages", "combat", "media", "forces", "media", "messages", "media"]) {
      await page.getByTestId(`sidebar-tab-${tab}`).click();
      for (const other of ["forces", "messages", "combat", "media"]) {
        await expect(page.getByTestId(`sidebar-tab-${other}`)).toHaveAttribute("data-active", other === tab ? "true" : "false");
      }
    }
  });
});
