import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { stripIntersections, openPlay, clickGeo, sessionState, wegoState, autopauseOff, runUntilResult, GATE, type W } from "./helpers/sandPlay";

const OUT = path.join(process.cwd(), "docs", "verification", "sand-combat-1-s409");
const SIZES = [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }];

/** Real mouse/keyboard play. Where a check needs the live session it only reads it (the two fixtures in the fog test say so). */

async function pickWeGo(page: Page, minutes: 1 | 5 | 15) {
  await expect(page.getByTestId("briefing")).toBeVisible();
  await page.getByTestId("mode-wego").click();
  await page.getByTestId(`turn-length-${minutes}`).click();
  await expect(page.getByTestId(`turn-length-${minutes}`)).toHaveAttribute("aria-pressed", "true");
}

async function takeCommand(page: Page) {
  await page.getByTestId("briefing-show-gate").click();
  await expect(page.getByTestId("briefing")).toBeHidden();
  await page.waitForTimeout(3500);
}

const phaseOf = (page: Page) => page.getByTestId("turn-panel").getAttribute("data-phase");
const waitPhase = (page: Page, phase: string, timeout = 120_000) =>
  expect(page.getByTestId("turn-panel")).toHaveAttribute("data-phase", phase, { timeout });

async function orderShip(page: Page, rowText: string | RegExp, waypoints: { lng: number; lat: number }[], throttle: string) {
  await page.getByTestId("force-row").filter({ hasText: rowText }).first().click();
  await expect(page.getByTestId("order-panel")).toBeVisible();
  await page.getByTestId("order-add-waypoint").click();
  await expect(page.getByText("CLICK MAP TO PLACE WAYPOINT")).toBeVisible();
  if (waypoints[0].lat > 26.4) {
    await page.getByTestId("mission-focus-gate").click();
    await page.waitForTimeout(3500);
  }
  for (const [i, w] of waypoints.entries()) {
    await clickGeo(page, w.lng, w.lat);
    await expect(page.getByTestId("order-waypoint-item")).toHaveCount(i + 1);
  }
  await page.keyboard.press("Escape");
  await page.getByTestId("order-throttle").filter({ hasText: throttle }).click();
}

/** What the selector offered when the order was accepted (S3-7): the option the player chose, by contact id and shown text. */
let lastStaged: { shooter: string; contactId: string; optionText: string } | null = null;

async function stageFire(page: Page): Promise<string | null> {
  const names = ["Hornet 101", "Hornet 102", "USS Cole", "USS Mahan", "USS Chosin", "USS Nitze", "USS Nimitz"];
  for (const name of names) {
    const row = page.getByTestId("force-row").filter({ hasText: name }).first();
    if (!(await row.isVisible())) continue;
    await row.click();
    const select = page.getByTestId("order-engage-contact");
    if (!(await select.isVisible().catch(() => false))) continue;
    const options = await select.locator("option").count();
    for (let i = 1; i < options; i++) {
      await select.selectOption({ index: i });
      const chosen = await select.locator("option").nth(i);
      const contactId = (await chosen.getAttribute("value")) ?? "";
      const optionText = ((await chosen.textContent()) ?? "").trim();
      await page.getByTestId("order-engage").click();
      if ((await page.getByTestId("order-engage-feedback").getAttribute("data-ok")) === "true") {
        lastStaged = { shooter: name, contactId, optionText };
        return name;
      }
    }
  }
  return null;
}

const setSpeed = (page: Page, label: string) => page.getByTestId("sim-speed").filter({ hasText: label }).click();

async function commitAndResolve(page: Page) {
  await page.getByTestId("cmd-commit").click({ timeout: 20_000 });
  await expect.poll(async () => (await wegoState(page)).phase, { timeout: 20_000 }).not.toBe("planning");
  await expect
    .poll(async () => ((await page.getByTestId("result-overlay").isVisible()) ? "result" : await phaseOf(page)), { timeout: 240_000, intervals: [500] })
    .toMatch(/review|result/);
}

/** Two sizes, DPR 2, hashed into one manifest. The viewport is restored afterwards. */
async function shotBoth(page: Page, name: string) {
  mkdirSync(OUT, { recursive: true });
  const vp = page.viewportSize()!;
  const manifestPath = path.join(OUT, "frames.json");
  const manifest: Record<string, { sha256: string; bytes: number; viewport: string; dpr: number }> = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  for (const s of SIZES) {
    await page.setViewportSize(s);
    await page.waitForTimeout(900);
    const file = `${s.width}x${s.height}-${name}.png`;
    const buf = await page.screenshot({ path: path.join(OUT, file) });
    manifest[file] = { sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length, viewport: `${s.width}x${s.height}`, dpr: await page.evaluate(() => window.devicePixelRatio) };
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  await page.setViewportSize(vp);
  await page.waitForTimeout(500);
}

type Row = { id: string; type: string; tag: string; text: string };
const rowsOnPage = (page: Page): Promise<Row[]> =>
  page.getByTestId("combat-log-entry").evaluateAll((els) =>
    els.map((e) => ({ id: e.getAttribute("data-source-id") ?? "", type: e.getAttribute("data-event-type") ?? "", tag: e.getAttribute("data-tag") ?? "", text: (e as HTMLElement).innerText })),
  );
const windowText = async (page: Page) => (await page.getByTestId("record-window").innerText()).replace(/\s+/g, " ").trim();
const totalOf = async (page: Page) => Number(/ OF (\d+)/.exec(await windowText(page))?.[1] ?? "0");

async function openCombat(page: Page) {
  await page.getByTestId("sidebar-tab-combat").click();
  await expect(page.getByTestId("combat-record")).toBeVisible();
}

async function goFirst(page: Page) {
  const first = page.getByTestId("record-first");
  if (await first.isEnabled()) await first.click();
}

/** Walks every page of the current filter, oldest first, and returns all rows. */
async function allPages(page: Page): Promise<Row[]> {
  await goFirst(page);
  const all: Row[] = [];
  for (let guard = 0; guard < 80; guard++) {
    all.push(...(await rowsOnPage(page)));
    if (await page.getByTestId("record-next").isDisabled()) break;
    await page.getByTestId("record-next").click();
  }
  return all;
}

/** What the live session says the player may read: the same own-involvement rule, recomputed in the page, read-only. */
async function expectedEligible(page: Page): Promise<number> {
  return page.evaluate(() => {
    const snap = ((window as unknown as W).__sandSession as unknown as { snapshot(): any }).snapshot();
    const side = snap.gameState.scenario.playerSide as string;
    const own = new Set<string>(snap.gameState.sides.flatMap((s: any) => s.units).filter((u: any) => u.side === side).map((u: any) => u.id));
    const ev = (snap.combatState?.combatLog ?? []).filter((e: any) => e.side === side || (e.targetId && own.has(e.targetId)) || (e.unitId && own.has(e.unitId))).length;
    const msg = (snap.eventState?.messages ?? []).filter((m: any) => m.side === side).length;
    return ev + msg;
  });
}

/** No enemy unit id or true name may be readable (text, attributes) in the player's record surfaces while GOD is off. */
async function assertNoLeak(page: Page, surfaces: string[]) {
  const hidden = await page.evaluate(() => {
    const snap = ((window as unknown as W).__sandSession as unknown as { snapshot(): any }).snapshot();
    const side = snap.gameState.scenario.playerSide as string;
    const enemy = snap.gameState.sides.flatMap((s: any) => s.units).filter((u: any) => u.side !== side);
    return { ids: enemy.map((u: any) => u.id as string), names: enemy.map((u: any) => u.name as string) };
  });
  for (const tid of surfaces) {
    const loc = page.getByTestId(tid);
    if ((await loc.count()) === 0) continue;
    const html = await loc.first().evaluate((el) => el.outerHTML + "\n" + (el as HTMLElement).innerText);
    for (const id of hidden.ids) expect(html, `${tid} leaks enemy id ${id}`).not.toContain(id);
    for (const n of hidden.names) expect(html.toUpperCase(), `${tid} leaks enemy name ${n}`).not.toContain(n.toUpperCase());
  }
}

const SURFACES = ["combat-record", "turn-review", "result-overlay", "teletype"];

/** Everything on the debrief that proves own damage and losses are real, cross-checked with the session. */
async function debriefFacts(page: Page) {
  const facts = await page.evaluate(() => {
    const snap = ((window as unknown as W).__sandSession as unknown as { snapshot(): any }).snapshot();
    const side = snap.gameState.scenario.playerSide as string;
    const own = snap.gameState.sides.flatMap((s: any) => s.units).filter((u: any) => u.side === side);
    return { total: own.length, lost: own.filter((u: any) => u.damageState === "destroyed").map((u: any) => u.name), mk: own.filter((u: any) => u.damageState === "mission-kill").map((u: any) => u.name), dmg: own.filter((u: any) => u.damageState === "damaged").map((u: any) => u.name) };
  });
  const cond = (await page.getByTestId("result-condition").innerText()).replace(/\s+/g, " ");
  expect(cond).toContain(`${facts.lost.length} LOST`);
  expect(cond).toContain(`${facts.mk.length} MISSION KILL`);
  expect(cond).toContain(`${facts.dmg.length} DAMAGED`);
  const affected = facts.lost.length + facts.mk.length + facts.dmg.length > 0 ? (await page.getByTestId("result-affected").innerText()).replace(/\s+/g, " ") : "";
  for (const n of facts.lost) expect(affected.toUpperCase()).toContain(`${n.toUpperCase()} LOST`);
  for (const n of facts.mk) expect(affected.toUpperCase()).toContain(`${n.toUpperCase()} MISSION KILL`);
  for (const n of facts.dmg) expect(affected.toUpperCase()).toContain(`${n.toUpperCase()} DAMAGED`);
  return { ...facts, condition: cond, affected, losses: (await page.getByTestId("result-losses").innerText()).replace(/\s+/g, " ") };
}

/** From the debrief: VIEW RECORD, check the whole run is there, filter, come back to the same result. */
async function debriefRecordFlow(page: Page, tag: string, facts: Awaited<ReturnType<typeof debriefFacts>>) {
  const previewText = (await page.getByTestId("result-record-count").innerText()).replace(/\s+/g, " ");
  const before = await sessionState(page);
  await page.getByTestId("debrief-view-record").click();
  await expect(page.getByTestId("result-overlay")).toBeHidden();
  await expect(page.getByTestId("combat-record")).toBeVisible();
  await expect(page.getByTestId("record-return")).toContainText(/BACK TO DEBRIEF/);
  // opening the record changed neither clock, mode nor result
  const after = await sessionState(page);
  expect(after.simTime).toBe(before.simTime);
  expect(after.result).toBe(before.result);
  expect(after.isPaused).toBe(before.isPaused);
  const total = await totalOf(page);
  expect(total).toBe(await expectedEligible(page));
  const pages = await allPages(page);
  expect(pages.length).toBe(total);
  expect(new Set(pages.map((r) => r.id)).size).toBe(total);
  await assertNoLeak(page, SURFACES);
  // older activity: page one of a run longer than a page
  await goFirst(page);
  const firstWindow = await windowText(page);
  await shotBoth(page, `${tag}-record-older-activity`);
  // own-unit filter on an affected unit (or the first own unit when nothing was hurt)
  const chip = page.getByTestId("record-affected").first();
  const unitId = (await chip.count()) ? await chip.getAttribute("data-unit-id") : await page.getByTestId("record-unit").locator("option").nth(1).getAttribute("value");
  await page.getByTestId("record-unit").selectOption(unitId!);
  const filtered = await totalOf(page);
  expect(filtered).toBeLessThanOrEqual(total);
  const filteredRows = await allPages(page);
  expect(filteredRows.length).toBe(filtered);
  await shotBoth(page, `${tag}-record-own-unit-filter`);
  await page.getByTestId("record-unit").selectOption("");
  expect(await totalOf(page)).toBe(total);
  // return to exactly the held result, never a new run
  await page.getByTestId("record-return").click();
  await expect(page.getByTestId("result-overlay")).toBeVisible();
  await expect(page.getByTestId("result-title")).toBeVisible();
  expect((await sessionState(page)).result).toBe(before.result);
  return { previewText, total, firstWindow, filtered, filterUnit: unitId, firstRows: pages.slice(0, 3), lastRows: pages.slice(-3), facts };
}

async function cleanReplay(page: Page, tag: string) {
  await page.getByTestId("play-again").click();
  await expect(page.getByTestId("briefing")).toBeVisible();
  await expect(page.getByTestId("mission-status")).toHaveAttribute("data-status", "pending");
  await page.getByTestId("sidebar-tab-combat").click();
  await expect(page.getByTestId("record-window")).toContainText("SHOWING 0 OF 0");
  await expect(page.getByTestId("record-empty")).toContainText(/NOTHING ON THE RECORD YET/);
  await expect(page.getByTestId("record-cat-all")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("record-unit")).toHaveValue("");
  await expect(page.getByTestId("record-return")).toHaveCount(0);
  await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
  await shotBoth(page, `${tag}-replay-clean`);
}

const REPORT: Record<string, unknown> = {};
function save(name: string, data: unknown) {
  mkdirSync(OUT, { recursive: true });
  REPORT[name] = data;
  writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 2));
}

test.describe("SAND-COMBAT-1: the whole fight, read through the ordinary UI", () => {
  test("plan A (direct flank), WeGo: staged ENGAGE, CANCEL, commit, review, inspection, record, debrief", async ({ browser }, info) => {
    test.setTimeout(1_200_000);
    mkdirSync(OUT, { recursive: true });
    const ctx = await browser.newContext({ viewport: SIZES[0], deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const log: Record<string, unknown> = { plan: "A direct/flank, WeGo 5 min" };
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
      const renderer = await page.evaluate(() => (window as unknown as W).__sandPlot!.rendererInfo().renderer);
      info.annotations.push({ type: "renderer", description: renderer });
      log.renderer = renderer;
      await pickWeGo(page, 5);
      await takeCommand(page);
      await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
      await page.getByTestId("mission-focus-unit").click();
      await page.getByTestId("order-add-waypoint").click();
      await page.getByTestId("mission-focus-gate").click();
      await page.waitForTimeout(3500);
      await clickGeo(page, GATE.centre.lng, GATE.centre.lat);
      await expect(page.getByTestId("order-waypoint-item")).toHaveCount(1);
      await page.keyboard.press("Escape");
      await page.getByTestId("order-throttle").filter({ hasText: "FLANK" }).click();
      await setSpeed(page, "60x");

      // opening the record and operating its controls from the keyboard commits and advances nothing
      await waitPhase(page, "planning");
      const s0 = await sessionState(page);
      const w0 = await wegoState(page);
      await openCombat(page);
      for (const id of ["record-cat-combat", "record-cat-intel", "record-cat-all"]) {
        await page.getByTestId(id).focus();
        await page.keyboard.press("Enter");
        await page.keyboard.press("Space");
      }
      await page.getByTestId("record-unit").focus();
      await page.keyboard.press("Enter");
      await page.getByTestId("record-first").focus().catch(() => {});
      const s1 = await sessionState(page);
      const w1 = await wegoState(page);
      expect(s1.simTime).toBe(s0.simTime);
      expect(s1.orders).toBe(s0.orders);
      expect(w1).toMatchObject({ mode: "wego", phase: "planning", turnsCommitted: 0, intents: 0 });
      expect(w1.simTime).toBe(w0.simTime);
      await expect(page.getByTestId("record-empty")).toBeVisible();
      await page.getByTestId("sidebar-tab-forces").click();

      let reviewed = false;
      let staged = false;
      let stagedTurn = 0;
      let stagedExpect: { shooter: string; contactId: string; optionText: string } | null = null;
      let stagedRowText = "";
      const turnLog: unknown[] = [];
      for (let n = 1; n <= 40; n++) {
        if (await page.getByTestId("result-overlay").isVisible()) break;
        await waitPhase(page, "planning");
        await page.getByTestId("sidebar-tab-forces").click();
        if (!staged) {
          const w = await wegoState(page);
          if (w.contacts.some((c) => c.cls !== "unknown")) {
            const shooter = await stageFire(page);
            if (shooter) {
              staged = true;
              await expect(page.getByTestId("staged-fire")).toHaveCount(1);
              const first = lastStaged!;
              const number = /\b(\d{4})\b/.exec(first.optionText)?.[1];
              const rowText1 = (await page.getByTestId("staged-fire").innerText()).replace(/\s+/g, " ");
              if (number) expect(rowText1, "staged row shows the number the selector offered").toContain(number);
              await expect(page.getByTestId("staged-fire")).toHaveAttribute("data-contact-id", first.contactId);
              await shotBoth(page, "A-staged-engage");
              await page.getByTestId("staged-cancel").click();
              await expect(page.getByTestId("staged-fire")).toHaveCount(0);
              await shotBoth(page, "A-staged-engage-cancelled");
              expect(await stageFire(page)).not.toBeNull();
              await expect(page.getByTestId("staged-fire")).toHaveCount(1);
              const restaged = lastStaged!;
              const rowText2 = (await page.getByTestId("staged-fire").innerText()).replace(/\s+/g, " ");
              log.staged = { turn: n, shooter, selectorOption: first.optionText, stagedRow: rowText1, contactId: first.contactId, restagedOption: restaged.optionText, restagedRow: rowText2, restagedContactId: restaged.contactId };
              stagedTurn = n;
              stagedExpect = restaged;
              stagedRowText = rowText2;
            }
          }
        }
        const logBefore = (await sessionState(page)).log;
        await commitAndResolve(page);
        if (await page.getByTestId("result-overlay").isVisible()) break;
        await expect(page.getByTestId("turn-review")).toBeVisible();
        const after = await sessionState(page);
        const preview = (await page.getByTestId("review-record-count").innerText()).replace(/\s+/g, " ");
        const entry: Record<string, unknown> = {
          turn: n,
          eventsThisTurn: after.log - logBefore,
          preview,
          losses: (await page.getByTestId("review-losses").innerText()).replace(/\s+/g, " "),
          damage: (await page.getByTestId("review-damage").innerText()).replace(/\s+/g, " "),
        };
        expect(await page.getByTestId("turn-review").locator(".tx-result-line").count()).toBeLessThanOrEqual(8);
        if (n === stagedTurn && stagedExpect) {
          // S3-3: the receipt of the staged ENGAGE is read in the held review, before NEXT TURN
          const receipts = page.getByTestId("review-fire-item");
          await expect(receipts).toHaveCount(1);
          const status = await receipts.first().getAttribute("data-status");
          expect(["launched", "refused"]).toContain(status);
          expect(await receipts.first().getAttribute("data-contact-id")).toBe(stagedExpect.contactId);
          const text = (await receipts.first().innerText()).replace(/\s+/g, " ");
          const number = /\b(\d{4})\b/.exec(stagedExpect.optionText)?.[1];
          if (number) expect(text, "receipt names the same track number the selector and staged row showed").toContain(number);
          expect(text).toMatch(status === "launched" ? /LAUNCHED/ : /REFUSED, /);
          entry.fireReceipt = { turn: n, shooter: stagedExpect.shooter, shooterId: await receipts.first().getAttribute("data-shooter-id"), contactId: stagedExpect.contactId, selectorOption: stagedExpect.optionText, stagedRow: stagedRowText, status, text };
          log.fireReceipt = entry.fireReceipt;
          await shotBoth(page, "A-review-fire-receipt");
        }
        await assertNoLeak(page, SURFACES);
        if (!reviewed && (after.log - logBefore > 0 || staged)) {
          reviewed = true;
          await shotBoth(page, "A-review-omitted-preview-and-record-access");
          // inspect an own platform during REVIEW: read-only, orders stay locked
          const rv = await sessionState(page);
          await page.getByTestId("force-row").filter({ hasText: /Nimitz/ }).first().click();
          await expect(page.getByTestId("detail-panel")).toBeVisible();
          await expect(page.getByTestId("orders-locked")).toBeVisible();
          await expect(page.getByTestId("order-panel")).toHaveCount(0);
          await expect(page.getByTestId("cmd-engage")).toBeDisabled();
          await expect(page.getByTestId("cmd-commit")).toHaveCount(0);
          await expect(page.getByTestId("turn-review")).toBeVisible();
          const tr = await page.getByTestId("turn-review").boundingBox();
          const dp = await page.getByTestId("detail-panel").boundingBox();
          expect(tr!.x + tr!.width).toBeLessThanOrEqual(dp!.x + 1);
          await shotBoth(page, "A-review-inspect-own-platform");
          const afterInspect = await sessionState(page);
          expect(afterInspect.simTime).toBe(rv.simTime);
          expect(afterInspect.orders).toBe(rv.orders);
          // VIEW RECORD holds the review; the record opens on the last resolved turn
          await page.getByTestId("review-view-record").click();
          await expect(page.getByTestId("turn-review")).toBeHidden();
          await expect(page.getByTestId("review-hold-strip")).toBeVisible();
          // S3-4: the hold strip crosses no title, panel or control at either size
          const stripProof: Record<string, unknown> = {};
          for (const size of SIZES) {
            await page.setViewportSize(size);
            await page.waitForTimeout(700);
            const r = await stripIntersections(page, "review-hold-strip");
            stripProof[`${size.width}x${size.height}`] = r;
            expect(r.hits, `${size.width}x${size.height} hold strip intersects ${r.hits.join(", ")}`).toEqual([]);
            expect(r.clipped).toBe(false);
          }
          await page.setViewportSize(SIZES[0]);
          await page.waitForTimeout(500);
          log.holdStrip = stripProof;
          await expect(page.getByTestId("record-scope-turn")).toHaveAttribute("aria-pressed", "true");
          const held = await sessionState(page);
          expect(held.simTime).toBe(rv.simTime);
          expect((await wegoState(page)).phase).toBe("review");
          const turnRows = await allPages(page);
          expect(turnRows.length).toBe(await totalOf(page));
          await shotBoth(page, "A-record-last-turn");
          await page.getByTestId("record-scope-run").click();
          expect(await totalOf(page)).toBe(await expectedEligible(page));
          await page.getByTestId("record-return").click();
          await expect(page.getByTestId("turn-review")).toBeVisible();
          expect((await wegoState(page)).phase).toBe("review"); // back to the held review, not NEXT TURN
          await expect(page.getByTestId("turn-panel")).toHaveAttribute("data-phase", "review");
          entry.recordCheck = { turnRows: turnRows.length, firstTurnRows: turnRows.slice(0, 4) };
        }
        turnLog.push(entry);
        await page.getByTestId("cmd-next-turn").click();
      }
      log.turns = turnLog;
      await expect(page.getByTestId("result-title")).toContainText(/VICTORY|COMPLETE|DEFEAT/i, { timeout: 30_000 });
      log.result = await page.getByTestId("result-title").innerText();
      log.deciding = await page.getByTestId("result-deciding").innerText();
      expect(await page.getByLabel("Toggle god mode").getAttribute("data-active")).toBe("false");
      await assertNoLeak(page, SURFACES);
      const facts = await debriefFacts(page);
      await shotBoth(page, "A-real-debrief");
      log.debrief = await debriefRecordFlow(page, "A", facts);
      await cleanReplay(page, "A");
      save("plan-A-direct-flank-wego", log);
    } finally {
      await ctx.close();
    }
  });

  test("plan B (escorted dog-leg), continuous: record, debrief, record flow, clean replay", async ({ browser }, info) => {
    test.setTimeout(900_000);
    mkdirSync(OUT, { recursive: true });
    const ctx = await browser.newContext({ viewport: SIZES[0], deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const log: Record<string, unknown> = { plan: "B escorts + dog-leg, continuous" };
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      const renderer = await page.evaluate(() => (window as unknown as W).__sandPlot!.rendererInfo().renderer);
      info.annotations.push({ type: "renderer", description: renderer });
      log.renderer = renderer;
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("briefing")).toBeHidden();
      await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
      const escortGoal = { lng: 56.5, lat: 26.6 };
      for (const row of [/Chosin/, /Mahan/, /Cole/]) await orderShip(page, row, [escortGoal], "FULL");
      await orderShip(page, /Nimitz/, [{ lng: 57.0, lat: 25.9 }, GATE.centre], "FULL");
      await autopauseOff(page);

      // opening the record does not start or stop the clock
      const s0 = await sessionState(page);
      await openCombat(page);
      const s1 = await sessionState(page);
      expect(s1.simTime).toBe(s0.simTime);
      expect(s1.isPaused).toBe(true);
      await page.getByTestId("sidebar-tab-forces").click();

      await setSpeed(page, "60x");
      await page.getByTestId("sim-toggle-pause").click();
      await runUntilResult(page, 480_000);
      log.result = await page.getByTestId("result-title").innerText();
      log.deciding = await page.getByTestId("result-deciding").innerText();
      expect(await page.getByLabel("Toggle god mode").getAttribute("data-active")).toBe("false");
      await assertNoLeak(page, SURFACES);
      const facts = await debriefFacts(page);
      await shotBoth(page, "B-real-debrief");
      // the six command families stay locked after the result
      for (const id of ["cmd-engage", "cmd-roe", "sim-toggle-pause"]) await expect(page.getByTestId(id)).toBeDisabled();
      log.debrief = await debriefRecordFlow(page, "B", facts);
      await cleanReplay(page, "B");
      save("plan-B-escorted-dogleg-continuous", log);
    } finally {
      await ctx.close();
    }
  });

  test("fog, GOD, paging, place-keeping, empty filters, reset (own fixtures, continuous)", async ({ browser }) => {
    test.setTimeout(600_000);
    const ctx = await browser.newContext({ viewport: SIZES[0], deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    try {
      await openPlay(page, "/play", { e2eHandle: true });
      await page.keyboard.press("Escape");
      await autopauseOff(page);

      // fixture: enemy C-802s fall on four escorts (never the objective carrier), dice fixed so no defence rolls succeed
      const inject = (count: number) =>
        page.evaluate((n) => {
          const s = (window as unknown as W).__sandSession as any;
          const units = s.gameState.sides.flatMap((x: any) => x.units);
          const side = s.gameState.scenario.playerSide;
          const targets = units.filter((u: any) => u.side === side && u.id !== "us-cvn-1" && /^us-(ddg|cg|ffg)/.test(u.id));
          const weapon = { name: "C-802 Noor", type: "asm", rangeKm: 120, speedKts: 530, pkAir: 0, pkSurface: 90, quantity: 4, warheadDamage: 167, seekerType: "active-radar" };
          const wifs = Array.from({ length: n }, (_, i) => {
            const t = targets[i % targets.length];
            return { id: `e2e-fixture-${Math.round(performance.now())}-${i}`, name: weapon.name, launchedBy: "ir-fac-1", launchedBySide: "Iran", targetId: t.id, position: { ...t.position }, heading: 0, speedKts: 530, rangeRemainingKm: 120, weapon, seekerActive: true, seekerRangeKm: 10 };
          });
          s.combatState = { ...s.combatState, weaponsInFlight: [...s.combatState.weaponsInFlight, ...wifs] };
          (window as any).__origRandom = (window as any).__origRandom ?? Math.random;
          Math.random = () => 0.7;
          return targets.length;
        }, count);

      await openCombat(page);
      expect(await inject(24)).toBeGreaterThan(0);
      await setSpeed(page, "10x");
      await page.getByTestId("sim-toggle-pause").click();
      await expect.poll(() => totalOf(page), { timeout: 120_000 }).toBeGreaterThan(20);
      await page.getByTestId("sim-toggle-pause").click(); // hold
      await expect(page.getByTestId("sim-state")).toContainText(/HOLD/);

      // incoming weapons carry the generic label and no raw ids or true names
      const wifText = await page.getByTestId("weapon-row").allInnerTexts();
      for (const t of wifText) expect(t).toMatch(/INCOMING WEAPON|C-802/);
      await assertNoLeak(page, SURFACES);
      const total = await totalOf(page);
      expect(total).toBe(await expectedEligible(page));

      // paging is honest: window text matches what is drawn, and every row is reachable exactly once
      await goFirst(page);
      expect(await windowText(page)).toMatch(/^SHOWING 1-20 OF \d+/);
      expect((await rowsOnPage(page)).length).toBe(20);
      const firstId = (await rowsOnPage(page))[0].id;
      const pages = await allPages(page);
      expect(pages.length).toBe(total);
      expect(new Set(pages.map((r) => r.id)).size).toBe(total);
      // names are readable, not enum words
      const tags = new Set(pages.map((r) => r.tag));
      for (const t of tags) expect(["LAUNCH", "DEFENDED", "HIT", "MISS", "DAMAGED", "LOST", "KILL", "INTERCEPT", "INTEL"]).toContain(t);

      // NEW ACTIVITY keeps the reader's place
      await goFirst(page);
      expect(await inject(6)).toBeGreaterThan(0);
      await page.getByTestId("sim-toggle-pause").click();
      await expect.poll(() => page.getByTestId("record-new").count(), { timeout: 60_000 }).toBe(1);
      await page.getByTestId("sim-toggle-pause").click();
      expect(await windowText(page)).toMatch(/^SHOWING 1-20 OF \d+/);
      expect((await rowsOnPage(page))[0].id).toBe(firstId);
      await expect(page.getByTestId("record-new")).toContainText(/NEW ACTIVITY \+\d+/);
      await page.getByTestId("record-new").click();
      const latest = await windowText(page);
      expect(latest).toMatch(new RegExp(`OF ${await totalOf(page)}`));
      await expect(page.getByTestId("record-next")).toBeDisabled();
      await page.evaluate(() => { const w = window as any; if (w.__origRandom) Math.random = w.__origRandom; });

      // empty filter explains itself and CLEAR FILTERS recovers
      const carrierValue = await page.getByTestId("record-unit").locator("option", { hasText: /NIMITZ/ }).getAttribute("value");
      await page.getByTestId("record-unit").selectOption(carrierValue!);
      await expect(page.getByTestId("record-empty")).toContainText(/NO ENTRIES MATCH THE ACTIVE FILTER.*NIMITZ/i);
      await expect(page.getByTestId("record-window")).toContainText("SHOWING 0 OF 0");
      await page.getByTestId("record-clear").click();
      expect(await totalOf(page)).toBeGreaterThan(20);
      await page.getByTestId("record-cat-intel").click();
      const intelRows = await allPages(page);
      for (const r of intelRows) expect(r.type).toBe("intel");
      await page.getByTestId("record-cat-combat").click();
      for (const r of await allPages(page)) expect(r.type).not.toBe("intel");
      await page.getByTestId("record-cat-all").click();

      // GOD is visibly separate and gone the moment it is switched off
      const ordinary = await totalOf(page);
      await page.getByLabel("Toggle god mode").click();
      await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "true");
      const godRows = await page.locator('[data-testid="combat-log-entry"].is-god').count();
      await page.getByLabel("Toggle god mode").click();
      await expect(page.getByLabel("Toggle god mode")).toHaveAttribute("data-active", "false");
      await expect(page.locator('[data-testid="combat-log-entry"].is-god')).toHaveCount(0);
      await expect(page.getByTestId("record-god-count")).toHaveCount(0);
      expect(await totalOf(page)).toBe(ordinary);
      await assertNoLeak(page, SURFACES);
      void godRows;

      // RESET clears every piece of record state
      await page.getByTestId("record-cat-combat").click();
      await goFirst(page);
      await page.getByTestId("cmd-reset").click();
      await openCombat(page);
      await expect(page.getByTestId("record-window")).toContainText("SHOWING 0 OF 0");
      await expect(page.getByTestId("record-cat-all")).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("record-unit")).toHaveValue("");
    } finally {
      await ctx.close();
    }
  });

  test("demo, snapshot, demo, legacy: the record belongs to the run it was read from", async ({ page }) => {
    test.setTimeout(300_000);
    await openPlay(page, "/play", { e2eHandle: true });
    await page.keyboard.press("Escape");
    await openCombat(page);
    await expect(page.getByTestId("record-window")).toContainText("SHOWING 0 OF 0");
    await page.goto("/play?scenario=snapshot");
    await page.waitForFunction(() => !!(window as unknown as W).__sandPlot, null, { timeout: 90_000 });
    await page.keyboard.press("Escape");
    await openCombat(page);
    await expect(page.getByTestId("record-window")).toContainText("SHOWING 0 OF 0");
    await expect(page.getByTestId("record-scope-turn")).toHaveCount(0);
    await page.goto("/play");
    await page.waitForFunction(() => !!(window as unknown as W).__sandPlot, null, { timeout: 90_000 });
    await page.keyboard.press("Escape");
    await openCombat(page);
    await expect(page.getByTestId("record-window")).toContainText("SHOWING 0 OF 0");
    await page.goto("/play?map=legacy");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByTestId("combat-record")).toHaveCount(0);
  });
});
