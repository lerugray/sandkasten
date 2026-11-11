// SAND-ART1 frame tool. Shoots every judged pose of the play screen at 1920x1080, DPR 2, with the visible
// strings and the one-word-last-line findings of each pose beside it. The same poses serve the BEFORE and the
// AFTER set, so the two can be laid side by side and their text diffed.
//
//   SAND_ART_SET=before|after npx playwright test tests/sand-art1-frames.spec.ts
//
// Without SAND_ART_SET the spec is skipped: it is a capture tool, not a pass/fail gate, and the ordinary battery
// must not overwrite the committed frames.
import { test, expect, type Page, type Browser } from "@playwright/test";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { openPlay, runUntilResult, injectKillOnCarrier, restoreDice, autopauseOff, GATE, type W } from "./helpers/sandPlay";

const SET = process.env.SAND_ART_SET ?? "";
const ROOT = path.join(process.cwd(), "docs", "handoffs", "sand-art-fable-r1-frames");
const OUT = path.join(ROOT, SET || "after");
const SIZE = { width: 1920, height: 1080 };

test.skip(!SET, "capture tool: set SAND_ART_SET=before|after to shoot the frames");
test.describe.configure({ mode: "parallel" });

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * A page-side clock the plot's animation loop reads: `freeze()` holds it on the next whole minute (every radar sweep
 * then sits at the same angle in both sets), `freezeIn(ms)` holds it a set time after now (an effect caught mid-burst).
 * Time never runs backwards: on release the clock carries on from where it was held.
 */
async function installClock(page: Page) {
  await page.addInitScript(() => {
    const w = window as Any;
    const raf = window.requestAnimationFrame.bind(window);
    const pnow = performance.now.bind(performance);
    const clock = { offset: 0, frozen: null as number | null, watch: null as null | (() => void) };
    const v = () => clock.frozen ?? pnow() + clock.offset;
    performance.now = () => v();
    window.requestAnimationFrame = (cb: FrameRequestCallback) => raf(() => { clock.watch?.(); cb(v()); });
    w.__art = {
      clock,
      freeze() { clock.frozen = (Math.floor(v() / 60000) + 1) * 60000; },
      freezeIn(ms: number) { clock.frozen = v() + ms; },
      release() { if (clock.frozen !== null) { clock.offset = clock.frozen - pnow(); clock.frozen = null; } },
      // set by runUntil(): checked after every sim tick while the clock runs; when true the sim is held on that tick
      until: null as null | ((s: Any) => boolean),
      done: false,
    };
    // The sim clock. The session ticks on a 50 ms interval and measures the gap with Date.now(); here every tick is
    // handed exactly 50 ms, so a run is the same sequence of ticks in every capture (with the dice fixed, the same
    // game). The stop condition is tested on the tick itself, not from the test's side of the wire.
    let vnow = Date.now();
    Date.now = () => vnow;
    const si = window.setInterval.bind(window);
    window.setInterval = ((fn: (...a: unknown[]) => void, ms?: number, ...rest: unknown[]) =>
      si(() => {
        if (ms === 50) vnow += 50;
        fn(...rest);
        const s = w.__sandSession;
        if (ms === 50 && s && w.__art.until && !s.gameState.isPaused && w.__art.until(s)) {
          s.pause();
          w.__art.until = null;
          w.__art.done = true;
        }
      }, ms)) as typeof window.setInterval;
  });
}

/** Hold the sim on the first tick where `cond` (source of `(session) => boolean`) is true. Arm it before the clock starts. */
async function arm(page: Page, cond: string) {
  await page.evaluate((src) => { const w = window as Any; w.__art.done = false; w.__art.until = (0, eval)(src); }, cond);
}
const held = (page: Page) => expect.poll(() => page.evaluate(() => (window as Any).__art.done), { timeout: 120_000, intervals: [100] }).toBe(true);
/** One press of PLAY, then the tick-exact stop. */
async function runUntil(page: Page, cond: string) {
  await arm(page, cond);
  await page.getByTestId("sim-toggle-pause").click();
  await held(page);
  await page.waitForTimeout(700); // the last state reaches the page and the plot
}
const fixDice = (page: Page) => page.evaluate(() => { const w = window as Any; if (!w.__origRandom) w.__origRandom = Math.random; Math.random = () => 0.7; });
const simTime = (page: Page) => page.evaluate(() => (window as Any).__sandSession.gameState.simTime as number);

/** Every visible string on the page, sorted, plus each text block whose last line holds a single word. */
async function readText(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="terminal-root"]') ?? document.body;
    const strings: string[] = [];
    const orphans: string[] = [];
    const vis = (el: Element) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const blocks = new Set<Element>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const el = t.parentElement;
      // A unit or contact data block has two forms, the full block and its first line alone; which one the plot's
      // declutter shows depends on what was measured and placed first (it keeps a block where it is while that
      // stays clear), so it differs between two runs of the same tree. The block is recorded by its first line.
      const raw = el?.classList.contains("tx-block") ? (t.textContent ?? "").split("\n")[0] : t.textContent ?? "";
      const s = raw.replace(/\s+/g, " ").trim();
      if (!s || !el) continue;
      let hidden = false;
      for (let a: Element | null = el; a && a !== root.parentElement; a = a.parentElement) {
        if (!vis(a)) { hidden = true; break; }
      }
      if (hidden) continue;
      strings.push(s);
      let b: Element | null = el;
      while (b && /^inline/.test(getComputedStyle(b).display) && getComputedStyle(b).display !== "inline-block" && getComputedStyle(b).display !== "inline-flex") b = b.parentElement;
      if (b) blocks.add(b);
    }
    for (const b of blocks) {
      if (getComputedStyle(b).whiteSpace.startsWith("pre") || getComputedStyle(b).whiteSpace === "nowrap") continue;
      // words with the line each sits on
      const lines = new Map<number, string[]>();
      const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      let own = true;
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const txt = n.textContent ?? "";
        const re = /\S+/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(txt))) {
          const r = document.createRange();
          r.setStart(n, m.index);
          r.setEnd(n, m.index + m[0].length);
          const pe = n.parentElement!;
          if (pe !== b && !/^inline/.test(getComputedStyle(pe).display)) { own = false; }
          // a word broken across two lines (at a hyphen) counts on both
          for (const rect of r.getClientRects()) {
            if (rect.width === 0) continue;
            const key = Math.round((rect.top + rect.height / 2) / 6);
            const arr = lines.get(key) ?? [];
            arr.push(m[0]);
            lines.set(key, arr);
          }
        }
      }
      if (!own || lines.size < 2) continue;
      const keys = [...lines.keys()].sort((p, q) => p - q);
      const last = lines.get(keys[keys.length - 1])!;
      if (last.length === 1) {
        const all = keys.flatMap((k) => lines.get(k)!).join(" ");
        orphans.push(`${(b.getAttribute("data-testid") ?? b.className ?? b.tagName).toString().slice(0, 40)} :: ...${all.slice(-70)} :: last line "${last[0]}"`);
      }
    }
    strings.sort();
    orphans.sort();
    return { strings, orphans };
  });
}

function poseTools(page: Page) {
  mkdirSync(path.join(OUT, "text"), { recursive: true });
  const plot = <T>(fn: (p: Any) => T) => page.evaluate(`(${fn.toString()})(window.__sandPlot)`) as Promise<T>;
  const shot = async (name: string, opts: { freeze?: boolean } = { freeze: true }) => {
    if (opts.freeze !== false) {
      await page.evaluate(() => (window as Any).__art.freeze());
      await page.waitForTimeout(350);
    }
    const text = await readText(page);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    writeFileSync(path.join(OUT, "text", `${name}.json`), JSON.stringify(text, null, 1));
    await page.evaluate(() => (window as Any).__art.release());
  };
  return { plot, shot };
}

async function open(browser: Browser, url = "/play") {
  const ctx = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await installClock(page);
  await openPlay(page, url, { e2eHandle: true });
  return { ctx, page };
}

const session = (page: Page, fn: string) => page.evaluate(`(${fn})(window.__sandSession)`);

/** Hormuz with the briefing closed on the opening theater view, clock held. */
async function start(page: Page) {
  await expect(page.getByTestId("briefing")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("briefing")).toBeHidden();
  await page.waitForTimeout(2500);
}

/** Put the camera over the carrier group at a set distance. */
async function overGroup(page: Page, dist: number, row = "USS Nimitz") {
  await page.getByTestId("force-row").filter({ hasText: row }).first().click();
  await page.evaluate((d) => (window as Any).__sandPlot.setDist(d), dist);
  await page.waitForTimeout(3200);
}

const CONTACTS = `(s) => {
  const t = s.gameState.simTime;
  const mk = (id, cls, lng, lat, unc, age, actual, name, hdg, spd, sensor) => ({
    id, detectedById: "us-cvn-1", actualUnitId: actual, side: "US Navy", classification: cls,
    position: { lng, lat }, positionUncertainty: unc, estimatedHeading: hdg, estimatedSpeed: spd,
    platformName: name, lastUpdateTime: t - age * 1000, lastFixTime: t - age * 1000, baseUncertainty: unc, sensorType: sensor,
  });
  const side = s.gameState.sides.find((x) => x.name === "US Navy") ?? s.gameState.sides[0];
  const list = [
    mk("art-c1", "unknown", 57.20, 25.62, 9, 0, "ir-pc-1", undefined, undefined, undefined, "esm"),
    mk("art-c2", "detected", 57.52, 25.66, 5, 0, "ir-pc-2", undefined, 200, 18, "radar"),
    mk("art-c3", "classified", 57.84, 25.62, 2, 0, "ir-fac-1", "Sina Class [Kaman-derived missile boat]", 210, 28, "radar"),
    mk("art-c4", "tracked", 58.10, 25.50, 0.4, 0, "ir-ff-1", "Bayandor Class [PF 103]", 230, 16, "radar"),
    mk("art-c5", "tracked", 57.95, 25.28, 0.4, 0, "ir-f4-1", "F-4E Phantom II", 250, 480, "radar"),
    mk("art-c6", "tracked", 57.86, 24.86, 0.4, 110, "ir-fac-2", "Sina Class [Kaman-derived missile boat]", 300, 30, "radar"),
    mk("art-c7", "unknown", 57.30, 24.80, 9, 150, "ir-fac-3", undefined, undefined, undefined, "esm"),
    mk("art-c8", "detected", 57.05, 25.05, 5, 70, "ir-f14-1", undefined, 90, 420, "radar"),
  ].map((c) => ({ ...c, side: side.name }));
  s.gameState = { ...s.gameState, contacts: list };
}`;

const MISSILES = (n: number, target: string, dmg = 167) => `(s) => {
  const tgt = s.gameState.sides.flatMap((x) => x.units).find((u) => u.id === "${target}");
  const weapon = { name: "C-802 Noor", type: "asm", rangeKm: 120, speedKts: 530, pkAir: 0, pkSurface: 90, quantity: 4, warheadDamage: ${dmg}, seekerType: "active-radar" };
  const own = { name: "RGM-84 Harpoon", type: "asm", rangeKm: 130, speedKts: 530, pkAir: 0, pkSurface: 85, quantity: 8, warheadDamage: 220, seekerType: "active-radar" };
  const wifs = Array.from({ length: ${n} }, (_, i) => {
    const brg = (20 + i * 9) * Math.PI / 180, d = 0.16 + i * 0.035;
    return { id: "art-in-" + i, name: weapon.name, launchedBy: "ir-fac-1", launchedBySide: "Iran", targetId: "${target}",
      position: { lng: tgt.position.lng + Math.sin(brg) * d, lat: tgt.position.lat + Math.cos(brg) * d }, heading: (200 + i * 9) % 360,
      speedKts: 530, rangeRemainingKm: 120, weapon, seekerActive: true, seekerRangeKm: 10 };
  });
  const out = [0, 1].map((i) => ({ id: "art-out-" + i, name: own.name, launchedBy: "us-cg-1", launchedBySide: "US Navy", targetId: "ir-ff-1",
    position: { lng: 57.38 + i * 0.07, lat: 25.38 + i * 0.05 }, heading: 75, speedKts: 530, rangeRemainingKm: 130, weapon: own, seekerActive: false, seekerRangeKm: 10 }));
  s.combatState = { ...s.combatState, weaponsInFlight: [...s.combatState.weaponsInFlight, ...wifs, ...out] };
  window.__origRandom = Math.random;
  Math.random = () => 0.7;
}`;

test("briefing, start, objective, selection, display modes", async ({ browser }, info) => {
  test.setTimeout(300_000);
  const { ctx, page } = await open(browser);
  const { plot, shot } = poseTools(page);
  try {
    info.annotations.push({ type: "renderer", description: await plot((p) => p.rendererInfo().renderer) });
    writeFileSync(path.join(OUT, "renderer.txt"), (await plot((p) => p.rendererInfo().renderer)) + "\n");
    await page.waitForTimeout(1800);
    await shot("01-briefing");
    await start(page);
    await shot("02-plot-start");
    await page.getByTestId("mission-focus-gate").click();
    await page.waitForTimeout(4000);
    await shot("03-objective-focused");
    await page.getByTestId("force-row").filter({ hasText: "USS Nimitz" }).first().click();
    await page.waitForTimeout(3500);
    await shot("04-own-unit-selected");
    await overGroup(page, 420);
    await shot("05-own-unit-selected-close");
    // hover: the pointer rests on another own unit (USS Chosin) while the carrier stays selected
    {
      const box = (await page.getByTestId("tactical-plot").boundingBox())!;
      const p = await page.evaluate(() => {
        const u = (window as Any).__sandSession.gameState.sides.flatMap((x: Any) => x.units).find((x: Any) => x.id === "us-cg-1");
        return (window as Any).__sandPlot.project(u.position.lng, u.position.lat);
      });
      await page.mouse.move(box.x + p.x + 30, box.y + p.y + 30);
      await page.mouse.move(box.x + p.x, box.y + p.y, { steps: 4 });
      await page.waitForTimeout(500);
      await shot("12-hover");
      await page.mouse.move(box.x + 700, box.y + 520);
    }
    // display modes, one at a time, over the carrier group
    await page.keyboard.press("s");
    await page.waitForTimeout(900);
    await shot("13-mode-sensors");
    await page.keyboard.press("t");
    await page.waitForTimeout(2600);
    await shot("14-mode-sensors-tilt");
    await page.keyboard.press("s");
    await page.evaluate(() => (window as Any).__sandPlot.setDist(900));
    await page.waitForTimeout(1500);
    await shot("15-mode-tilt");
    await page.keyboard.press("t");
    await page.waitForTimeout(2600);
    await page.keyboard.press("g");
    await page.keyboard.press("Escape");
    await page.evaluate(() => (window as Any).__sandPlot.setDist(1000));
    await page.waitForTimeout(1500);
    await shot("16-mode-god");
    await page.getByTestId("mission-focus-gate").click();
    await page.evaluate(() => (window as Any).__sandPlot.setDist(330));
    await page.waitForTimeout(4000);
    await shot("17-mode-god-close");
    await page.keyboard.press("g");
    await page.keyboard.press("m");
    const box = (await page.getByTestId("tactical-plot").boundingBox())!;
    await page.mouse.click(box.x + 900, box.y + 420);
    await page.mouse.click(box.x + 1320, box.y + 640);
    await page.waitForTimeout(700);
    await shot("18-mode-measure");
    await page.keyboard.press("m");
    for (const id of ["ad", "radar", "nuclear"]) await page.getByTestId(`plot-toggle-osint-${id}`).click();
    await page.waitForTimeout(900);
    await shot("19-mode-osint-off");
    for (const id of ["ad", "radar", "nuclear"]) await page.getByTestId(`plot-toggle-osint-${id}`).click();
    await plot((p) => p.focusFacility("apt-oikb"));
    await page.waitForTimeout(4500);
    await shot("20-facility-close");
    await page.keyboard.press("h");
    await page.waitForTimeout(600);
    await shot("21-help");
    await page.keyboard.press("Escape");
    await page.getByTestId("cmd-load").click();
    await page.waitForTimeout(600);
    await shot("22-battle-file-load");
  } finally {
    await ctx.close();
  }
});

test("contacts at each certainty state", async ({ browser }) => {
  test.setTimeout(200_000);
  const { ctx, page } = await open(browser);
  const { shot } = poseTools(page);
  try {
    await start(page);
    await session(page, CONTACTS);
    // two own ships hurt, so the damaged and mission-kill marks are in the frame too
    await session(page, `(s) => {
      const us = s.gameState.sides.flatMap((x) => x.units);
      us.find((u) => u.id === "us-ddg-2").damageState = "damaged";
      us.find((u) => u.id === "us-ffg-1").damageState = "mission-kill";
    }`);
    await overGroup(page, 330, "USS Mahan");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    await shot("06-contacts-certainty");
    await page.getByTestId("sidebar-tab-messages").click();
    await page.waitForTimeout(500);
    await shot("07-contacts-intel-tab");
  } finally {
    await ctx.close();
  }
});

test("missiles in flight, a hit, a kill", async ({ browser }) => {
  test.setTimeout(240_000);
  const { ctx, page } = await open(browser);
  const { shot } = poseTools(page);
  try {
    await start(page);
    await overGroup(page, 150, "USS Nimitz");
    await page.keyboard.press("Escape");
    await autopauseOff(page);
    // a launch: the plot's clock is held a quarter of a second after the weapons first appear on it
    await page.evaluate(() => {
      const w = window as Any;
      const heads = () => (w.__sandPlot.getSource("weapon-tracks")?.features ?? []).filter((f: Any) => f.geometry.type === "Point").length;
      w.__art.launched = false;
      w.__art.clock.watch = () => {
        if (heads() > 0 && !w.__art.launched) { w.__art.launched = true; w.__art.freezeIn(240); w.__art.clock.watch = null; }
      };
    });
    await session(page, MISSILES(5, "us-cvn-1"));
    await expect.poll(() => page.evaluate(() => (window as Any).__art.launched), { timeout: 20_000, intervals: [50] }).toBe(true);
    await page.waitForTimeout(400);
    await shot("07b-launch", { freeze: false });
    // twelve seconds of flight at 5x so the missiles have a trail behind them, then held
    await page.getByTestId("sim-speed").filter({ hasText: "5x" }).click();
    await runUntil(page, `(s) => s.gameState.simTime >= ${(await simTime(page)) + 12_000}`);
    await shot("08-missiles-in-flight");
    await page.getByTestId("sidebar-tab-combat").click();
    await page.waitForTimeout(400);
    await shot("09-missiles-combat-tab");
    // the first arrival: the sim holds on the tick of the hit; the plot's clock is held a fifth of a second into the burst
    await page.evaluate(() => {
      const w = window as Any;
      const heads = () => (w.__sandPlot.getSource("weapon-tracks")?.features ?? []).filter((f: Any) => f.geometry.type === "Point").length;
      let prev = heads();
      w.__art.hit = false;
      w.__art.clock.watch = () => {
        const n = heads();
        if (n < prev && !w.__art.hit) { w.__art.hit = true; w.__art.freezeIn(210); w.__art.clock.watch = null; }
        prev = n;
      };
    });
    await arm(page, `(s) => s.combatState.combatLog.some((e) => e.type === "hit")`);
    await page.getByTestId("sim-toggle-pause").click();
    await held(page);
    await expect.poll(() => page.evaluate(() => (window as Any).__art.hit), { timeout: 20_000, intervals: [50] }).toBe(true);
    await page.waitForTimeout(350);
    await shot("10-hit", { freeze: false });
    await restoreDice(page);
  } finally {
    await ctx.close();
  }
});

test("a kill", async ({ browser }) => {
  test.setTimeout(240_000);
  const { ctx, page } = await open(browser);
  const { shot } = poseTools(page);
  try {
    await start(page);
    await overGroup(page, 150, "USS Cole");
    await page.keyboard.press("Escape");
    await autopauseOff(page);
    await session(page, MISSILES(8, "us-ddg-2", 400));
    await page.getByTestId("sim-speed").filter({ hasText: "10x" }).click();
    await page.evaluate(() => {
      const w = window as Any;
      const units = () => w.__sandPlot.drawnTracks().units;
      let prev = units();
      w.__art.kill = false;
      w.__art.clock.watch = () => {
        const n = units();
        if (n < prev && !w.__art.kill) { w.__art.kill = true; w.__art.freezeIn(330); w.__art.clock.watch = null; }
        prev = n;
      };
    });
    await arm(page, `(s) => s.gameState.sides.flatMap((x) => x.units).find((u) => u.id === "us-ddg-2").damageState === "destroyed"`);
    await page.getByTestId("sim-toggle-pause").click();
    await held(page);
    await expect.poll(() => page.evaluate(() => (window as Any).__art.kill), { timeout: 20_000, intervals: [50] }).toBe(true);
    await page.waitForTimeout(350);
    await shot("11-kill", { freeze: false });
    await restoreDice(page);
  } finally {
    await ctx.close();
  }
});

test("WeGo planning, resolving, review", async ({ browser }) => {
  test.setTimeout(300_000);
  const { ctx, page } = await open(browser);
  const { shot } = poseTools(page);
  try {
    await expect(page.getByTestId("briefing")).toBeVisible();
    await page.getByTestId("mode-wego").click();
    await page.getByTestId("turn-length-5").click();
    await page.waitForTimeout(500);
    await shot("23-briefing-wego");
    await page.getByTestId("briefing-show-gate").click();
    await expect(page.getByTestId("briefing")).toBeHidden();
    await page.waitForTimeout(3800);
    await shot("24-wego-planning");
    // the burst is held 72 s of sim time in (tick-exact), shot, then let run to the review
    await fixDice(page);
    await arm(page, `(s) => s.gameState.simTime >= ${(await simTime(page)) + 72_000}`);
    await page.getByTestId("cmd-commit").click();
    await held(page);
    await page.waitForTimeout(700);
    expect(await page.getByTestId("turn-panel").getAttribute("data-phase")).toBe("resolving");
    await shot("25-wego-resolving");
    await page.getByTestId("sim-toggle-pause").click();
    await expect(page.getByTestId("turn-panel")).toHaveAttribute("data-phase", "review", { timeout: 200_000 });
    await page.waitForTimeout(1200);
    await shot("26-wego-review");
  } finally {
    await ctx.close();
  }
});

test("debrief: victory", async ({ browser }) => {
  test.setTimeout(240_000);
  const { ctx, page } = await open(browser);
  const { shot } = poseTools(page);
  try {
    await start(page);
    await autopauseOff(page);
    await fixDice(page);
    await page.evaluate((c) => {
      const s = (window as unknown as W).__sandSession as Any;
      const u = s.gameState.sides.flatMap((x: Any) => x.units).find((x: Any) => x.id === "us-cvn-1");
      u.position = { lng: c.lng, lat: c.lat };
    }, GATE.centre);
    await runUntilResult(page, 60_000);
    await restoreDice(page);
    await page.waitForTimeout(900);
    await shot("27-debrief-victory");
  } finally {
    await ctx.close();
  }
});

test("debrief: defeat", async ({ browser }) => {
  test.setTimeout(240_000);
  const { ctx, page } = await open(browser);
  const { shot } = poseTools(page);
  try {
    await start(page);
    await autopauseOff(page);
    await injectKillOnCarrier(page);
    await runUntilResult(page, 60_000);
    await restoreDice(page);
    await page.waitForTimeout(900);
    await shot("28-debrief-defeat");
    await page.getByTestId("review-record").click();
    await page.waitForTimeout(1200);
    await shot("29-defeat-plot-after");
  } finally {
    await ctx.close();
  }
});

test("snapshot scenario", async ({ browser }) => {
  test.setTimeout(200_000);
  const { ctx, page } = await open(browser, "/play?scenario=snapshot");
  const { shot } = poseTools(page);
  try {
    await page.waitForTimeout(1800);
    await shot("30-snapshot-briefing");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(3000);
    await shot("31-snapshot-plot");
  } finally {
    await ctx.close();
  }
});

/**
 * Frame time on the heaviest judged pose: god view, sensor coverage, tilt, the carrier selected, twelve missiles in
 * flight, clock held by the sim pause. Ten seconds of animation frames; the interval between frames and the time
 * spent inside the frame callback are both recorded.
 */
test("frame time, heaviest pose, 10 s", async ({ browser }) => {
  test.setTimeout(200_000);
  const ctx = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  try {
    await page.addInitScript(() => {
      const w = window as Any;
      const raf = window.requestAnimationFrame.bind(window);
      const m = { on: false, last: 0, gaps: [] as number[], cpu: [] as number[] };
      w.__ft = m;
      window.requestAnimationFrame = (cb: FrameRequestCallback) => raf((t) => {
        const a = performance.now();
        cb(t);
        if (m.on) {
          m.cpu.push(performance.now() - a);
          if (m.last) m.gaps.push(t - m.last);
          m.last = t;
        }
      });
    });
    await openPlay(page, "/play", { e2eHandle: true });
    await start(page);
    await session(page, CONTACTS);
    await session(page, MISSILES(12, "us-cvn-1"));
    await overGroup(page, 420);
    await page.keyboard.press("g");
    await page.keyboard.press("s");
    await page.keyboard.press("t");
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(OUT, "32-frame-time-pose.png") });
    await page.evaluate(() => { const m = (window as Any).__ft; m.gaps.length = 0; m.cpu.length = 0; m.last = 0; m.on = true; });
    await page.waitForTimeout(10_000);
    const r = await page.evaluate(() => {
      const m = (window as Any).__ft;
      m.on = false;
      const st = (a: number[]) => {
        const s = [...a].sort((p, q) => p - q);
        const mean = s.reduce((p, q) => p + q, 0) / Math.max(1, s.length);
        return { n: s.length, mean: +mean.toFixed(2), p50: +(s[Math.floor(s.length * 0.5)] ?? 0).toFixed(2), p95: +(s[Math.floor(s.length * 0.95)] ?? 0).toFixed(2), max: +(s[s.length - 1] ?? 0).toFixed(2) };
      };
      return { frame_ms: st(m.gaps), callback_ms: st(m.cpu), renderer: (window as Any).__sandPlot.rendererInfo().renderer };
    });
    mkdirSync(OUT, { recursive: true });
    const tag = process.env.SAND_ART_FT_TAG ? `-${process.env.SAND_ART_FT_TAG}` : "";
    writeFileSync(path.join(OUT, `frame-time${tag}.json`), JSON.stringify(r, null, 1) + "\n");
    console.log("FRAME-TIME", SET, JSON.stringify(r));
  } finally {
    await ctx.close();
  }
});
