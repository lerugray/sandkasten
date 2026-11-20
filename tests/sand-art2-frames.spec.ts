// SAND-ART2 frame tool: the seven fixed-site plot glyphs (airbase, heliport, naval base, port; air defence, radar,
// nuclear). It shoots the same named poses of the default /play chart for a BEFORE, a CONTROL and an AFTER set, and
// beside every frame it writes what the forbidden-pixel and text gates need: the icon rectangles, every occupancy
// box, every label, every visible string with its line rectangles, and what a click on each icon picks.
//
//   SAND_ART2_SET=before|control|after SAND_ART2_OUT=<dir> npx playwright test tests/sand-art2-frames.spec.ts
//   SAND_ART2_SET=perf-<label>  measures the heavy pose for 10 s instead (frames, draw calls, texture uploads)
//
// Without SAND_ART2_SET the spec is skipped: it is a capture tool, not a pass/fail gate of the ordinary battery.
//
// The scene is frozen by the harness, not by product code. The plot's animation clock (performance.now and the rAF
// timestamp) is replaced by a virtual clock that stands still unless the test steps it, one sixtieth of a second per
// displayed frame. Every camera move is therefore the same sequence of steps in every run, so two captures of the
// same tree can be compared pixel for pixel. The glyph textures on the sheet are the canvases the production
// drawers (iconTexture, glyphTexture) made in this page, read back from the page; nothing is redrawn here.
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const SET = process.env.SAND_ART2_SET ?? "";
const OUT = process.env.SAND_ART2_OUT ?? path.join(process.cwd(), "docs", "art-fable-r2-fixed-sites", SET || "after");
const PERF = SET.startsWith("perf");

test.skip(!SET, "capture tool: set SAND_ART2_SET=before|control|after (or perf-<label>) to run it");
test.describe.configure({ mode: "serial" });

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** IDs come from the checked-in data (data/facilities/hormuz.json, data/osint/hormuz.json). */
const IDS = {
  bandarAbbasIntl: "apt-oikb",
  havadarya: "apt-oikp",
  kish: "apt-oibk",
  fujairah: "apt-omfj",
  adBandarAbbas: "ad-ir-s300-bandar-abbas", // estimated ring, 200 km
  adQeshm: "ad-ir-3khordad-qeshm",
  adDhafraThaad: "ad-us-thaad-dhafra",
  radarKhalijFars: "radar-ir-khalij-fars",
  radarSepehr: "radar-ir-sepehr",
  radarUdeid: "radar-us-tpy2-udeid",
  nucBushehr: "nuc-ir-bushehr-reactor", // measured ring, 20 km
  nucBarakah: "nuc-ae-barakah",
};

async function installHarness(page: Page, gl = false) {
  await page.addInitScript((countGl) => {
    const w = window as Any;
    const raf = window.requestAnimationFrame.bind(window);
    const st = { vt: 1000, left: 0, done: null as null | (() => void), shown: 0, free: false };
    const real = performance.now.bind(performance);
    let lastTs = -1;
    performance.now = () => (st.free ? real() : st.vt);
    window.requestAnimationFrame = (cb: FrameRequestCallback) =>
      raf((ts) => {
        if (st.free) { st.shown += ts !== lastTs ? 1 : 0; lastTs = ts; cb(real()); return; }
        if (ts !== lastTs) {
          lastTs = ts;
          st.shown++;
          if (st.left > 0) {
            st.vt += 1000 / 60;
            st.left--;
            if (st.left === 0 && st.done) { const d = st.done; st.done = null; setTimeout(d, 0); }
          }
        }
        cb(st.vt);
      });
    // every canvas the page makes, with the call stack that made it: the glyph drawers are found by name
    const ce = document.createElement.bind(document);
    const made: { el: HTMLCanvasElement; stack: string }[] = [];
    document.createElement = ((tag: string, o?: ElementCreationOptions) => {
      const el = ce(tag, o);
      if (String(tag).toLowerCase() === "canvas") made.push({ el: el as HTMLCanvasElement, stack: new Error().stack ?? "" });
      return el;
    }) as typeof document.createElement;
    const gls = { draws: 0, texCreate: 0, texDelete: 0, texUpload: 0 };
    if (countGl) {
      for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype] as Any[]) {
        for (const [name, key] of [
          ["drawArrays", "draws"], ["drawElements", "draws"], ["drawArraysInstanced", "draws"], ["drawElementsInstanced", "draws"], ["drawRangeElements", "draws"],
          ["createTexture", "texCreate"], ["deleteTexture", "texDelete"], ["texImage2D", "texUpload"], ["texSubImage2D", "texUpload"], ["texStorage2D", "texUpload"],
        ] as const) {
          const orig = proto[name];
          if (typeof orig !== "function") continue;
          proto[name] = function (this: unknown, ...a: unknown[]) { (gls as Any)[key]++; return orig.apply(this, a); };
        }
      }
    }
    w.__art2 = {
      st,
      gls,
      step: (n: number) => new Promise<void>((res) => { st.done = res; st.left = n; }),
      canvasCount: () => made.length,
      textures: () =>
        made
          .map((m, i) => ({ i, fn: /iconTexture/.test(m.stack) ? "iconTexture" : /glyphTexture/.test(m.stack) ? "glyphTexture" : "", el: m.el }))
          .filter((m) => m.fn)
          .map((m) => ({ i: m.i, fn: m.fn, w: m.el.width, h: m.el.height, url: m.el.toDataURL("image/png") })),
    };
  }, gl);
}

const plot = <T>(page: Page, fn: (p: Any) => T) => page.evaluate(`(${fn.toString()})(window.__sandPlot)`) as Promise<T>;
const step = (page: Page, n: number) => page.evaluate((k) => (window as Any).__art2.step(k), n);

/** Let React flush with the clock held, then run the plot a fixed number of frames, then hold again. */
async function settle(page: Page, frames = 300) {
  await page.waitForTimeout(500);
  await step(page, frames);
  await page.waitForTimeout(300);
  await step(page, 30);
  await page.waitForTimeout(250);
}

async function open(page: Page, size: { width: number; height: number }, gl = false) {
  await page.setViewportSize(size);
  await installHarness(page, gl);
  await page.goto("/play", { timeout: 120_000 });
  await page.waitForFunction(() => !!(window as Any).__sandPlot, null, { timeout: 90_000 });
  await page.waitForFunction(() => ((window as Any).__sandPlot?.frames() ?? 0) > 30, null, { timeout: 60_000 });
  await expect(page.getByTestId("briefing")).toBeVisible();
  await page.waitForTimeout(1500);
}

async function closeBriefing(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("briefing")).toBeHidden();
  // the teletype finishes typing on its own (wall) clock
  await page.waitForTimeout(4000);
}

/** Every visible text node in document order, whole (no first-line shortcut, no digit masking), with its line boxes. */
async function readDom(page: Page) {
  return page.evaluate(() => {
    const out: { s: string; r: number[][]; at: string }[] = [];
    const vis = (el: Element) => {
      const cs = getComputedStyle(el);
      return !(cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0);
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const el = t.parentElement;
      const s = t.textContent ?? "";
      if (!el || !s.trim() || el.closest("script, style, noscript")) continue;
      let hidden = false;
      for (let a: Element | null = el; a; a = a.parentElement) if (!vis(a)) { hidden = true; break; }
      if (hidden) continue;
      const range = document.createRange();
      range.selectNodeContents(t);
      const r = [...range.getClientRects()].filter((q) => q.width > 0 && q.height > 0).map((q) => [q.left, q.top, q.width, q.height].map((v) => Math.round(v * 100) / 100));
      if (!r.length) continue;
      out.push({ s, r, at: (el.closest("[data-testid]")?.getAttribute("data-testid") ?? "") + "/" + String(el.className).split(" ")[0] });
    }
    return out;
  });
}

type Box = { kind: string; id: string; x: number; y: number; w: number; h: number };

function tools(page: Page, vp: string) {
  mkdirSync(OUT, { recursive: true });
  const poses: string[] = [];
  const shot = async (name: string, note: string, opts: { picks?: boolean; ids?: string[] } = {}) => {
    const file = `${name}-${vp}`;
    const state = await page.evaluate((ids) => {
      const p = (window as Any).__sandPlot;
      const host = document.querySelector('[data-testid="tactical-plot"]')!.getBoundingClientRect();
      return {
        host: { x: host.left, y: host.top, w: host.width, h: host.height },
        dpr: window.devicePixelRatio,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        view: p.view(),
        clock: (window as Any).__art2.st.vt,
        renderer: p.rendererInfo(),
        facilities: p.drawnFacilities(),
        osint: p.drawnOsint(),
        tracks: p.drawnTracks(),
        occupancy: p.occupancy(),
        labels: p.labels(),
        labelOwners: p.labelOwners(),
        centres: Object.fromEntries(ids.map((i: string) => [i, p.facilityScreen(i) ?? p.osintScreen(i)])),
        panels: {
          facility: document.querySelector('[data-testid="facility-panel"]')?.textContent ?? null,
          osint: document.querySelector('[data-testid="osint-panel"]')?.textContent ?? null,
        },
      };
    }, opts.ids ?? Object.values(IDS));
    const dom = await readDom(page);
    await page.screenshot({ path: path.join(OUT, `${file}.png`) });
    let picks: { kind: string; id: string; x: number; y: number; picked: string }[] | undefined;
    if (opts.picks) {
      // what a click on each icon centre opens: the production pick path, run after the frame is taken
      picks = [];
      const icons = (state.occupancy as Box[]).filter((b) => b.kind === "facility-icon" || b.kind === "osint-icon").slice(0, 14);
      for (const b of icons) {
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        await page.evaluate(([x, y]) => (window as Any).__sandPlot.clickAt(x, y), [cx, cy]);
        await page.waitForTimeout(350);
        const picked = await page.evaluate(() => {
          const f = document.querySelector('[data-testid="facility-panel-title"]')?.textContent;
          const o = document.querySelector('[data-testid="osint-panel-title"]')?.textContent;
          return f ? `facility:${f}` : o ? `osint:${o}` : "none";
        });
        picks.push({ kind: b.kind, id: b.id, x: cx, y: cy, picked });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      }
    }
    writeFileSync(path.join(OUT, `${file}.json`), JSON.stringify({ pose: name, vp, note, ...state, picks, dom }, null, 1));
    poses.push(file);
    const kinds: Record<string, number> = {};
    for (const b of state.occupancy as Box[]) kinds[b.kind] = (kinds[b.kind] ?? 0) + 1;
    console.log(`POSE ${file} dist=${state.view.dist.toFixed(2)} tilt=${state.view.tilt} boxes=${JSON.stringify(kinds)} fac=${JSON.stringify(state.facilities)} osint=${JSON.stringify(state.osint)} dom=${dom.length}`);
  };
  const focusFac = async (id: string, dist?: number) => {
    await plot(page, (p) => p.tilt(false));
    await page.evaluate(([i, d]) => {
      const p = (window as Any).__sandPlot;
      p.focusFacility(i);
      if (d) p.setDist(d);
    }, [id, dist ?? 0] as const);
    await settle(page);
  };
  const focusOsint = async (id: string, dist: number) => {
    await page.evaluate(([i, d]) => { const p = (window as Any).__sandPlot; p.focusOsint(i, d); p.setDist(d); }, [id, dist] as const);
    await settle(page);
  };
  const clickIcon = async (id: string) => {
    const host = (await page.getByTestId("tactical-plot").boundingBox())!;
    const s = await page.evaluate((i) => { const p = (window as Any).__sandPlot; return p.facilityScreen(i) ?? p.osintScreen(i); }, id);
    await page.mouse.click(host.x + s.x, host.y + s.y);
    await settle(page, 90);
  };
  const clear = async () => {
    for (let i = 0; i < 3; i++) await page.keyboard.press("Escape");
    await page.mouse.move(5, 5);
    await settle(page, 30);
  };
  const setToggle = async (id: string, on: boolean) => {
    const b = page.getByTestId(`plot-toggle-osint-${id}`);
    if (((await b.getAttribute("aria-pressed")) === "true") !== on) await b.click();
  };
  const osintToggle = async (id: string, on: boolean) => {
    await setToggle(id, on);
    await page.mouse.move(5, 5);
    await settle(page, 60);
  };
  const osintToggles = async (on: boolean) => {
    for (const id of ["ad", "radar", "nuclear"]) await setToggle(id, on);
    await page.mouse.move(5, 5);
    await settle(page, 60);
  };
  return { shot, focusFac, focusOsint, clickIcon, clear, osintToggle, osintToggles, poses };
}

/** The production glyph textures of this page, written as PNGs (the 64 px source the plot samples). */
async function saveTextures(page: Page) {
  const tex = await page.evaluate(() => (window as Any).__art2.textures() as { i: number; fn: string; w: number; h: number; url: string }[]);
  const icon = tex.filter((t) => t.fn === "iconTexture");
  const glyph = tex.filter((t) => t.fn === "glyphTexture");
  // the plot may be built more than once (React strict mode in dev): each build draws the same textures again
  expect(icon.length % 4, `iconTexture canvases: ${icon.length}`).toBe(0);
  expect(glyph.length % 3, `glyphTexture canvases: ${glyph.length}`).toBe(0);
  expect(icon.length).toBeGreaterThan(0);
  expect(glyph.length).toBeGreaterThan(0);
  const names = { iconTexture: ["airbase", "heliport", "naval_base", "port"], glyphTexture: ["ad", "radar", "nuclear"] } as const;
  const dir = path.join(OUT, "textures");
  mkdirSync(dir, { recursive: true });
  const manifest: Record<string, { fn: string; w: number; h: number; builds: number; identicalAcrossBuilds: boolean }> = {};
  for (const [fn, list] of [["iconTexture", icon], ["glyphTexture", glyph]] as const) {
    const per = names[fn].length;
    names[fn].forEach((kind, k) => {
      const all = list.filter((_, j) => j % per === k);
      const last = all[all.length - 1];
      writeFileSync(path.join(dir, `${kind}.png`), Buffer.from(last.url.split(",")[1], "base64"));
      manifest[kind] = { fn, w: last.w, h: last.h, builds: all.length, identicalAcrossBuilds: all.every((t) => t.url === last.url) };
    });
  }
  writeFileSync(path.join(dir, "textures.json"), JSON.stringify(manifest, null, 1));
  console.log(`TEXTURES ${JSON.stringify(manifest)}`);
}

async function poses1920(page: Page) {
  const t = tools(page, "1920");
  await open(page, { width: 1920, height: 1080 });
  await settle(page, 120);
  await t.shot("00-briefing", "cold boot, briefing on screen as first seen");
  await closeBriefing(page);
  await settle(page, 360);
  await t.shot("01-cold-chart", "cold chart after the briefing is closed");
  await saveTextures(page);

  // crowded: Bandar Abbas / Havadarya with co-located facilities and OSINT sites
  await t.focusOsint(IDS.adBandarAbbas, 150);
  await t.shot("02-bandar-abbas-crowded", "Bandar Abbas and Havadarya, dist 150 km: co-located facilities, AD and radar", { picks: true });
  await t.focusOsint(IDS.adBandarAbbas, 60);
  await t.shot("03-bandar-abbas-close", "Bandar Abbas and Havadarya, dist 60 km: heliports, naval base, port, airbases, AD");

  // selected AD: its estimated (dashed) ring and the selection ring; Bushehr's measured (solid) nuclear ring in view
  await t.focusOsint(IDS.adBandarAbbas, 700);
  await t.clickIcon(IDS.adBandarAbbas);
  await t.shot("04-ad-selected-rings", "ad-ir-s300-bandar-abbas selected at 700 km: estimated dashed rings, selection ring, panel");
  await t.clear();

  // No single view of the checked-in data holds all seven kinds at a scale that draws heliports: the nuclear sites have
  // no radar, port or naval base within one screen. Frame 02 holds six kinds; these hold the seventh with AD beside it.
  await t.focusOsint(IDS.nucBushehr, 380);
  await t.shot("05-bushehr-nuclear-wide", "Bushehr reactor at 380 km (the widest scale that still draws heliports): nuclear, two AD sites, airbases, heliports");
  // (Bushehr lies west of the theater's pan limit, so its closest framing is this one, left of centre)
  await t.focusOsint(IDS.nucBushehr, 200);
  await t.shot("06-bushehr-nuclear-close", "Bushehr at 200 km: nuclear with measured 20 km ring, two co-located AD sites, facilities", { picks: true });
  await t.focusOsint(IDS.radarKhalijFars, 120);
  await t.shot("07-radar-khalij-fars", "radar-ir-khalij-fars at 120 km: radar symbol on its true position");
  await t.focusOsint(IDS.nucBarakah, 120);
  await t.shot("08-barakah-nuclear", "nuc-ae-barakah at 120 km: coalition-tint nuclear site with its heliports");
  // glow-fringe calibration: the same camera with only the NUC layer switched off (one isolated symbol removed)
  await t.osintToggle("nuclear", false);
  await t.shot("08b-barakah-nuc-off", "fringe calibration: same camera as 08, NUC layer off");
  await t.osintToggle("nuclear", true);
  await t.focusOsint(IDS.radarUdeid, 150);
  await t.shot("09-udeid-radar-ad", "Al Udeid at 150 km: coalition radar and AD beside the airbase");

  // runways: protected geometry
  await t.focusFac(IDS.kish);
  await t.shot("10-kish-two-runways", "Kish close view: two runways, symbol withdrawn");
  await t.focusFac(IDS.fujairah);
  await t.shot("11-fujairah-construction", "Fujairah close view: construction strip");
  await t.focusFac(IDS.havadarya);
  await t.clickIcon(IDS.havadarya);
  await t.shot("12-havadarya-panel", "Havadarya selected: facility panel open");
  await t.clear();

  // tilt
  await t.focusOsint(IDS.adBandarAbbas, 150);
  await plot(page, (p) => p.tilt(true));
  await settle(page, 300);
  await t.shot("13-bandar-abbas-tilt", "Bandar Abbas at 150 km, tilted");
  await plot(page, (p) => p.tilt(false));
  await settle(page, 300);

  // negative controls: OSINT layers off (facility glyphs only), then a view with no fixed-site glyph on screen at all
  await t.osintToggles(false);
  await t.shot("14-bandar-abbas-osint-off", "Bandar Abbas at 150 km with the three OSINT layers switched off");
  await page.getByTestId("force-row").filter({ hasText: "USS Nimitz" }).first().click();
  await plot(page, (p) => p.setDist(40));
  await settle(page, 420);
  await t.shot("15-control-no-glyphs", "layers-off control: OSINT off, carrier group at 40 km in open water, no fixed-site glyph on screen");
  await t.clear();
  await t.osintToggles(true);
  writeFileSync(path.join(OUT, "poses-1920.json"), JSON.stringify(t.poses, null, 1));
}

async function posesSmall(page: Page, size: { width: number; height: number }) {
  const t = tools(page, String(size.width));
  await open(page, size);
  await closeBriefing(page);
  await settle(page, 360);
  await t.shot("01-cold-chart", "cold chart after the briefing is closed");
  await t.focusOsint(IDS.adBandarAbbas, 150);
  await t.shot("02-bandar-abbas-crowded", "Bandar Abbas and Havadarya, dist 150 km");
  await t.focusOsint(IDS.nucBushehr, 380);
  await t.shot("05-bushehr-nuclear-wide", "Bushehr reactor at 380 km (the widest scale that still draws heliports): nuclear, two AD sites, airbases, heliports");
  await t.focusOsint(IDS.nucBushehr, 200);
  await t.shot("06-bushehr-nuclear-close", "Bushehr at 200 km");
  writeFileSync(path.join(OUT, `poses-${size.width}.json`), JSON.stringify(t.poses, null, 1));
}

test.describe("SAND-ART2 frames", () => {
  test.skip(PERF, "perf run");
  test.use({ deviceScaleFactor: 2 });

  test("1920x1080 DPR 2: every named pose", async ({ page }) => {
    test.setTimeout(900_000);
    await poses1920(page);
  });
  for (const size of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }]) {
    test(`${size.width}x${size.height} DPR 2: fit and legibility poses`, async ({ page }) => {
      test.setTimeout(600_000);
      await posesSmall(page, size);
    });
  }
});

test.describe("SAND-ART2 performance", () => {
  test.skip(!PERF, "set SAND_ART2_SET=perf-<label>");
  test.use({ deviceScaleFactor: 2 });

  test("heavy pose, 10 s on the real clock", async ({ page }) => {
    test.setTimeout(300_000);
    const t = tools(page, "1920");
    await open(page, { width: 1920, height: 1080 }, true);
    await closeBriefing(page);
    await settle(page, 200);
    await t.focusOsint(IDS.adBandarAbbas, 150);
    // release the virtual clock: the plot runs on the real one for the measurement
    await page.evaluate(() => { (window as Any).__art2.st.free = true; });
    await page.waitForTimeout(3000);
    const read = () => page.evaluate(() => {
      const a = (window as Any).__art2;
      // performance.now is the real monotonic clock here (the virtual clock was released above); Date.now is kept
      // beside it because the wall clock of a WSL guest can step during a run
      return { t: performance.now(), wall: Date.now(), frames: (window as Any).__sandPlot.frames() as number, shown: a.st.shown as number, canvases: a.canvasCount() as number, ...a.gls } as Record<string, number>;
    });
    const a = await read();
    await page.waitForTimeout(10_000);
    const b = await read();
    const frames = b.frames - a.frames;
    const ms = b.t - a.t;
    const res = {
      set: SET,
      pose: "Bandar Abbas at 150 km (02-bandar-abbas-crowded), 1920x1080 DPR 2",
      renderer: await plot(page, (p) => p.rendererInfo()),
      ms: Math.round(ms), wallMs: b.wall - a.wall, frames,
      fps: Math.round((frames / ms) * 100000) / 100,
      frameIntervalMs: Math.round((ms / frames) * 100) / 100,
      drawCallsPerFrame: Math.round(((b.draws - a.draws) / frames) * 100) / 100,
      texturesCreatedDuring: b.texCreate - a.texCreate,
      texturesDeletedDuring: b.texDelete - a.texDelete,
      textureUploadsDuring: b.texUpload - a.texUpload,
      canvasesCreatedDuring: b.canvases - a.canvases,
      texturesCreatedTotal: b.texCreate,
      texturesLive: b.texCreate - b.texDelete,
    };
    mkdirSync(OUT, { recursive: true });
    writeFileSync(path.join(OUT, `${SET}.json`), JSON.stringify(res, null, 1));
    console.log(`PERF ${JSON.stringify(res)}`);
    expect(frames).toBeGreaterThan(0);
  });
});
