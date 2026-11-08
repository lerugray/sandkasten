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
    const label = ((await page.getByTestId("sim-toggle-pause").textContent()) ?? "").trim();
    if (/PLAY/i.test(label)) await page.getByTestId("sim-toggle-pause").click().catch(() => {});
    await page.waitForTimeout(400);
  }
  await expect(overlay).toBeVisible({ timeout: 1000 });
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
