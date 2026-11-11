import { expect, type Page } from "@playwright/test";

export type PlayDebug = {
  frames(): number;
  project(lng: number, lat: number): { x: number; y: number };
  unproject(x: number, y: number): { lng: number; lat: number } | null;
  rendererInfo(): { renderer: string; vendor: string; version: string };
  drawnAreas(): { areas: number; labels: number };
  areaScreen(id: string): { x: number; y: number }[] | null;
  focusArea(id: string): void;
  view(): { dist: number };
  drawnTracks(): { units: number; contacts: number };
  occupancy(): { x: number; y: number; w: number; h: number; kind: string }[];
};
export type W = { __sandPlot?: PlayDebug; __SAND_E2E__?: boolean; __sandSession?: Record<string, unknown> };

export const GATE = { id: "transit-gate", south: 26.5, north: 26.8, west: 56.2, east: 56.7, centre: { lng: 56.45, lat: 26.65 } };

export async function openPlay(page: Page, url = "/play", opts: { e2eHandle?: boolean } = {}) {
  if (opts.e2eHandle) await page.addInitScript(() => { (window as unknown as W).__SAND_E2E__ = true; });
  await page.goto(url, { timeout: 120_000 });
  await page.waitForFunction(() => !!(window as unknown as W).__sandPlot, null, { timeout: 90_000 });
  await page.waitForFunction(() => ((window as unknown as W).__sandPlot?.frames() ?? 0) > 30, null, { timeout: 60_000 });
}

/** Turn the autopause off the way a player would, so a long unattended run is not stopped by it. */
export async function autopauseOff(page: Page) {
  await page.getByLabel("Autopause settings").click();
  const t = page.getByTestId("autopause-toggle-enabled");
  if (((await t.textContent()) ?? "").trim() === "ON") await t.click();
  await page.keyboard.press("Escape");
}

/** True when the plot itself (not a panel or HUD element) is under the projected point. */
async function plotHitAt(page: Page, lng: number, lat: number) {
  return page.evaluate(([a, b]) => {
    const h = document.querySelector('[data-testid="tactical-plot"]') as HTMLElement;
    const r = h.getBoundingClientRect();
    const p = (window as unknown as W).__sandPlot!.project(a, b);
    const x = r.left + p.x, y = r.top + p.y;
    if (p.x < 8 || p.y < 8 || p.x > r.width - 8 || p.y > r.height - 8) return false;
    const el = document.elementFromPoint(x, y);
    return !!el && h.contains(el) && !el.closest("[data-plot-occluder]");
  }, [lng, lat] as const);
}

/** A real mouse click at a geographic position. The map is zoomed out with the wheel, as a player would, until the spot is clickable. */
export async function clickGeo(page: Page, lng: number, lat: number) {
  const box = await page.getByTestId("tactical-plot").boundingBox();
  if (!box) throw new Error("plot host not found");
  for (let i = 0; i < 8 && !(await plotHitAt(page, lng, lat)); i++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(900);
  }
  const p = await page.evaluate(([a, b]) => (window as unknown as W).__sandPlot!.project(a, b), [lng, lat] as const);
  await page.mouse.click(box.x + p.x, box.y + p.y);
}

/** Resume whenever a (default) autopause stops the clock, until the result overlay appears. */
export async function runUntilResult(page: Page, timeoutMs: number) {
  const overlay = page.getByTestId("result-overlay");
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (await overlay.isVisible()) return;
    const label = ((await page.getByTestId("sim-toggle-pause").textContent({ timeout: 2000 }).catch(() => null)) ?? "").trim();
    if (/PLAY/i.test(label)) await page.getByTestId("sim-toggle-pause").click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  await expect(overlay).toBeVisible({ timeout: 1000 });
}

/** What the game clock and the scenario rules say right now, read from the live session (needs the E2E handle). */
async function simClock(page: Page) {
  return page.evaluate(() => {
    const s = (window as unknown as W).__sandSession as unknown as { snapshot(): any };
    const snap = s.snapshot();
    const g = snap.gameState;
    return {
      simHours: (g.simTime - new Date(g.scenario.startTime).getTime()) / 3.6e6,
      paused: g.isPaused as boolean,
      result: (snap.eventState?.scenarioResult?.result ?? null) as string | null,
    };
  });
}

export type SimClockRun = { resumes: number; wallSeconds: number; simHours: number };

/**
 * Run a continuous game to its result on the GAME clock, not the wall clock. PLAY is pressed (the real button) every
 * time the game pauses itself, and the wait ends when the session has a result. A slow machine only makes this take
 * longer; it cannot turn a result that the rules do reach into a failure.
 *
 * It fails when the game clock passes `maxSimHours` with no result (a real miss: the rules did not end the scenario),
 * when the clock stands still for `stallMs` while the game says it is running (a hang), or at `wallCapMs` overall.
 * Needs the E2E handle.
 */
export async function runUntilResultOnSimClock(
  page: Page,
  opts: { maxSimHours: number; wallCapMs?: number; stallMs?: number },
): Promise<SimClockRun> {
  const wallCapMs = opts.wallCapMs ?? 1_500_000;
  const stallMs = opts.stallMs ?? 120_000;
  const play = page.getByTestId("sim-toggle-pause");
  const t0 = Date.now();
  let resumes = 0;
  let lastSim = -Infinity;
  let lastAdvance = t0;
  let simHours = 0;
  for (;;) {
    const now = await simClock(page);
    simHours = now.simHours;
    if (now.result) break;
    if (now.simHours >= opts.maxSimHours) {
      throw new Error(`no scenario result by T+${now.simHours.toFixed(2)} h of game time (limit T+${opts.maxSimHours} h): the rules did not end this run`);
    }
    const wall = Date.now() - t0;
    if (wall > wallCapMs) {
      throw new Error(`no scenario result after ${Math.round(wall / 1000)} s of wall time; the game clock had reached T+${now.simHours.toFixed(2)} h after ${resumes} resumes`);
    }
    if (now.simHours > lastSim) {
      lastSim = now.simHours;
      lastAdvance = Date.now();
    }
    if (now.paused) {
      // the game paused itself (autopause): press PLAY once the button offers it, as a player would
      await expect(play).toHaveText(/PLAY/i, { timeout: 60_000 });
      await play.click({ timeout: 60_000 });
      resumes++;
      lastAdvance = Date.now();
      continue;
    }
    if (Date.now() - lastAdvance > stallMs) {
      throw new Error(`the game clock stood still at T+${now.simHours.toFixed(2)} h for ${Math.round(stallMs / 1000)} s while running`);
    }
    // wait for the next thing a player would react to: the game pausing itself or ending
    await page
      .waitForFunction(() => {
        const snap = ((window as unknown as W).__sandSession as unknown as { snapshot(): any }).snapshot();
        return snap.gameState.isPaused || !!snap.eventState?.scenarioResult;
      }, null, { polling: 100, timeout: 5000 })
      .catch(() => {});
  }
  // the session has its result; the debrief is the next render
  await expect(page.getByTestId("result-overlay")).toBeVisible({ timeout: 120_000 });
  return { resumes, wallSeconds: Math.round((Date.now() - t0) / 100) / 10, simHours };
}

/** Counts live window listeners and intervals so a replay can prove nothing accumulates. */
export async function installProbes(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __probe: { listeners: Map<string, number>; intervals: Set<number> } };
    const listeners = new Map<string, number>();
    const intervals = new Set<number>();
    const seen = new WeakMap<object, Set<string>>();
    const add = window.addEventListener.bind(window);
    const rem = window.removeEventListener.bind(window);
    window.addEventListener = ((type: string, fn: EventListenerOrEventListenerObject, opts?: unknown) => {
      const key = type + ":" + String(opts && typeof opts === "object" ? JSON.stringify(opts) : !!opts);
      const set = seen.get(fn as object) ?? new Set();
      if (!set.has(key)) { set.add(key); seen.set(fn as object, set); listeners.set(type, (listeners.get(type) ?? 0) + 1); }
      return add(type, fn, opts as AddEventListenerOptions);
    }) as typeof window.addEventListener;
    window.removeEventListener = ((type: string, fn: EventListenerOrEventListenerObject, opts?: unknown) => {
      const key = type + ":" + String(opts && typeof opts === "object" ? JSON.stringify(opts) : !!opts);
      const set = seen.get(fn as object);
      if (set?.delete(key)) listeners.set(type, (listeners.get(type) ?? 1) - 1);
      return rem(type, fn, opts as EventListenerOptions);
    }) as typeof window.removeEventListener;
    const si = window.setInterval.bind(window);
    const ci = window.clearInterval.bind(window);
    window.setInterval = ((fn: TimerHandler, ms?: number, ...a: unknown[]) => { const id = si(fn, ms, ...a); intervals.add(id as unknown as number); return id; }) as typeof window.setInterval;
    window.clearInterval = ((id?: number) => { if (id !== undefined) intervals.delete(id); return ci(id); }) as typeof window.clearInterval;
    w.__probe = { listeners, intervals };
  });
}

export async function probeCounts(page: Page) {
  return page.evaluate(() => {
    const p = (window as unknown as { __probe: { listeners: Map<string, number>; intervals: Set<number> } }).__probe;
    return { keydown: p.listeners.get("keydown") ?? 0, total: [...p.listeners.values()].reduce((a, b) => a + b, 0), intervals: p.intervals.size };
  });
}

/** Everything a stray command could change, read from the live session (needs the E2E handle). */
export async function sessionState(page: Page) {
  return page.evaluate(() => {
    const s = (window as unknown as W).__sandSession as unknown as { snapshot(): any };
    const snap = s.snapshot();
    const g = snap.gameState;
    const units = g.sides.flatMap((x: any) => x.units);
    return {
      simTime: g.simTime as number,
      isPaused: g.isPaused as boolean,
      speed: g.speed as number,
      orders: JSON.stringify([...g.orders.entries()]),
      units: JSON.stringify(units.map((u: any) => [u.id, u.position, u.damageState, u.speed, u.heading])),
      result: (snap.eventState?.scenarioResult?.result ?? null) as string | null,
      messages: (snap.eventState?.messages?.length ?? 0) as number,
      flight: (snap.combatState?.weaponsInFlight?.length ?? 0) as number,
      log: (snap.combatState?.combatLog?.length ?? 0) as number,
      feedback: JSON.stringify(snap.orderFeedback ?? null),
    };
  });
}

/** Thirty C-802s arrive on the carrier through the production combat path; the dice are fixed so no defence rolls succeed. */
export async function injectKillOnCarrier(page: Page) {
  await page.evaluate(() => {
    const s = (window as unknown as W).__sandSession as any;
    const nim = s.gameState.sides.flatMap((x: any) => x.units).find((u: any) => u.id === "us-cvn-1");
    const weapon = { name: "C-802 Noor", type: "asm", rangeKm: 120, speedKts: 530, pkAir: 0, pkSurface: 90, quantity: 4, warheadDamage: 167, seekerType: "active-radar" };
    const wifs = Array.from({ length: 30 }, (_, i) => ({
      id: `e2e-fixture-${i}`, name: weapon.name, launchedBy: "ir-fac-1", launchedBySide: "Iran", targetId: "us-cvn-1",
      position: { ...nim.position }, heading: 0, speedKts: 530, rangeRemainingKm: 120, weapon, seekerActive: true, seekerRangeKm: 10,
    }));
    s.combatState = { ...s.combatState, weaponsInFlight: [...s.combatState.weaponsInFlight, ...wifs] };
    (window as any).__origRandom = Math.random;
    Math.random = () => 0.7;
  });
}

export async function restoreDice(page: Page) {
  await page.evaluate(() => { const w = window as any; if (w.__origRandom) Math.random = w.__origRandom; });
}

/** After a result nothing may change: keys, buttons and map clicks are all refused. */
export async function assertFrozen(page: Page, opts: { selected?: boolean } = { selected: true }) {
  const before = await sessionState(page);
  await page.keyboard.press("Space");
  for (const k of ["1", "2", "3", "4", "5", "6", "e", "r", "x", "c", "f"]) await page.keyboard.press(k);
  await page.keyboard.press("Shift+Space");
  for (const id of ["sim-toggle-pause", "cmd-engage", "cmd-roe"]) {
    await expect(page.getByTestId(id)).toBeDisabled();
    await page.getByTestId(id).click({ force: true, trial: false }).catch(() => {});
  }
  for (const sp of await page.getByTestId("sim-speed").all()) await sp.click({ force: true }).catch(() => {});
  await page.getByTestId("sidebar-tab-forces").evaluate((el) => (el as HTMLElement).click());
  if (opts.selected) await expect(page.getByTestId("orders-locked")).toBeVisible();
  await expect(page.getByTestId("order-panel")).toHaveCount(0);
  // map handlers: a plain click, a shift-click and a click on the gate itself
  await clickGeo(page, 56.9, 26.2);
  await clickGeo(page, GATE.centre.lng, GATE.centre.lat);
  await page.waitForTimeout(1500);
  const after = await sessionState(page);
  expect(after.simTime).toBe(before.simTime);
  expect(after.isPaused).toBe(true);
  expect(after.speed).toBe(before.speed);
  expect(after.orders).toBe(before.orders);
  expect(after.units).toBe(before.units);
  expect(after.result).toBe(before.result);
  expect(after.flight).toBe(before.flight);
  expect(after.log).toBe(before.log);
  await expect(page.getByTestId("sim-state")).toContainText(/ENDED/);
  await expect(page.getByTestId("sim-state")).not.toContainText(/HOLD/);
}


/** Screen bounding box of a drawn area, from the plot's own projection of its polygon. */
export async function areaBox(page: Page, id: string) {
  const pts = await page.evaluate((i) => (window as unknown as W).__sandPlot!.areaScreen(i), id);
  if (!pts) return null;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), w: Math.max(...xs) - Math.min(...xs) };
}

/** The WeGo turn state, read from the live session (needs the E2E handle). */
export async function wegoState(page: Page) {
  return page.evaluate(() => {
    const s = (window as unknown as W).__sandSession as unknown as { snapshot(): any };
    const snap = s.snapshot();
    const w = snap.wego;
    return w
      ? {
          mode: snap.mode as string,
          phase: w.phase as string,
          turnNumber: snap.gameState.turnNumber as number,
          turnsCommitted: w.turnsCommitted as number,
          turnStart: w.turnStart as number,
          turnEnd: w.turnEnd as number,
          simTime: snap.gameState.simTime as number,
          intents: w.intents.length as number,
          paused: snap.gameState.isPaused as boolean,
          speed: snap.gameState.speed as number,
          contacts: snap.gameState.contacts.map((c: any) => ({ id: c.id, cls: c.classification })) as { id: string; cls: string }[],
        }
      : { mode: snap.mode as string, phase: null, turnNumber: 0, turnsCommitted: 0, turnStart: 0, turnEnd: 0, simTime: snap.gameState.simTime as number, intents: 0, paused: true, speed: 1, contacts: [] };
  });
}

/** Every visible title, panel, control or button whose box crosses the given strip's box (the strip's own children excluded). */
export async function stripIntersections(page: Page, testId: string) {
  return page.evaluate((id) => {
    const strip = document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    if (!strip) return { present: false as const, strip: null, hits: [] as string[], clipped: false };
    const s = strip.getBoundingClientRect();
    const hits: string[] = [];
    const sel = ".tx-top, .tx-top-right, .tx-left, .tx-right, .tx-cmd, .tx-cmd-right, .tx-panel, .tx-banner, button, select, input, [role=dialog]";
    for (const el of document.querySelectorAll(sel)) {
      if (el === strip || strip.contains(el) || el.contains(strip)) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      if (s.left < b.right && s.right > b.left && s.top < b.bottom && s.bottom > b.top) {
        hits.push(`${el.tagName.toLowerCase()}${el.getAttribute("data-testid") ? `[${el.getAttribute("data-testid")}]` : `.${String(el.className).split(" ")[0]}`}`);
      }
    }
    const clipped = s.left < 0 || s.right > window.innerWidth || s.top < 0 || s.bottom > window.innerHeight;
    return { present: true as const, strip: { x: s.x, y: s.y, w: s.width, h: s.height }, hits, clipped };
  }, testId);
}
