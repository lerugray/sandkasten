#!/usr/bin/env node
// Frame captures for the Three.js play view. Needs the dev server on :3001.
// Host-specific browser settings come from the environment, never from this
// file (they differ per machine):
//   CHROMIUM_EXECUTABLE  optional path to a Chromium / headless shell binary
//   CHROMIUM_ARGS        optional extra launch flags, space separated
// Usage: node capture.mjs [quick|full] [outDir]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const { chromium } = require(path.join(repo, "node_modules/playwright"));

const mode = process.argv[2] ?? "quick";
const outDir = path.resolve(process.argv[3] ?? path.join(path.dirname(new URL(import.meta.url).pathname), "frames"));
const BASE = process.env.BASE_URL ?? "http://localhost:3001";
fs.mkdirSync(outDir, { recursive: true });

const launch = () =>
  chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
    args: (process.env.CHROMIUM_ARGS ?? "").split(/\s+/).filter(Boolean),
  });

const plot = (page, fn, arg) =>
  page.evaluate(
    ([src, a]) => {
      const h = document.querySelector('[data-testid="tactical-plot"]')?.__plot;
      return h ? new Function("h", "a", `return (${src})(h, a)`)(h, a) : null;
    },
    [fn.toString(), arg],
  );

async function open(context, errors) {
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE}/play`);
  await page.getByTestId("plot-canvas").waitFor({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  return page;
}

async function autopauseOff(page) {
  await page.getByRole("button", { name: "Autopause settings" }).click();
  const t = page.getByTestId("autopause-toggle-enabled");
  if (((await t.textContent()) ?? "").trim() === "ON") await t.click();
  await page.keyboard.press("Escape");
}

async function runToSalvo(page) {
  // run fast until the first weapons are in the air, then drop to 10x
  await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
  await page.getByTestId("sim-toggle-pause").click();
  await page.waitForFunction(
    () => (document.querySelector('[data-testid="tactical-plot"]')?.__plot?.getSource("weapon-tracks")?.features ?? []).length >= 4,
    null,
    { timeout: 240_000, polling: 100 },
  );
  await page.getByTestId("sim-speed").filter({ hasText: "10x" }).click();
}

async function quick() {
  const errors = [];
  const browser = await launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await open(context, errors);
  await page.screenshot({ path: path.join(outDir, "quick-initial.png") });
  await autopauseOff(page);
  await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
  await page.getByTestId("sim-toggle-pause").click();
  await page.waitForTimeout(Number(process.env.QUICK_RUN_MS ?? 20000));
  await page.screenshot({ path: path.join(outDir, "quick-running.png") });
  await page.getByTestId("force-row").nth(1).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, "quick-selected.png") });
  await page.keyboard.press("t");
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(outDir, "quick-tilt.png") });
  console.log(JSON.stringify({ renderer: await plot(page, (h) => h.rendererInfo()), errors }, null, 2));
  await browser.close();
}

const fpsOver = (page, ms) =>
  page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const dts = [];
        let last = 0;
        let end = 0;
        const step = (t) => {
          if (last) dts.push(t - last);
          else end = t + ms;
          last = t;
          if (t < end || !end) requestAnimationFrame(step);
          else resolve(dts);
        };
        requestAnimationFrame(step);
      }),
    ms,
  );

function fpsLine(label, dts) {
  const sorted = [...dts].sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return `${label}: frames ${dts.length}, median ${(1000 / q(0.5)).toFixed(1)} fps, 5th percentile ${(1000 / q(0.95)).toFixed(1)} fps, worst frame ${sorted[sorted.length - 1].toFixed(1)} ms`;
}

async function modeContext(browser, m, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, ...opts });
  await context.addInitScript((mm) => window.localStorage.setItem("sandkasten.display", mm), m);
  return context;
}

async function densest(page) {
  const tracks = await plot(page, (h) => h.trackScreens());
  const contacts = tracks.filter((t) => t.kind === "contact");
  let best = contacts[0], bestN = -1;
  for (const c of contacts) {
    const n = contacts.filter((o) => Math.hypot(o.x - c.x, o.y - c.y) < 120).length;
    if (n > bestN) { bestN = n; best = c; }
  }
  return { best, bestN };
}

async function full() {
  const errors = [];
  const browser = await launch();
  const fpsLines = [];
  const audits = [];

  for (const m of ["crt", "current", "offsig"]) {
    const context = await modeContext(browser, m);
    const page = await open(context, errors);
    if (m === "crt") {
      const info = await plot(page, (h) => h.rendererInfo());
      fs.writeFileSync(
        path.join(outDir, "renderer.txt"),
        `UNMASKED_RENDERER_WEBGL: ${info.renderer}\nUNMASKED_VENDOR_WEBGL: ${info.vendor}\nVERSION: ${info.version}\n` +
          `browser: ${browser.version()}\nviewport: 1440x900 DPR 2\nserver: ${BASE}\n`,
      );
      await page.screenshot({ path: path.join(outDir, "briefing.png") });
    }
    await autopauseOff(page);
    await runToSalvo(page);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(outDir, `${m}-first-screen.png`) });

    // fps: adaptive scale at DPR 2, then forced render scale 0.6
    fpsLines.push(fpsLine(`${m} DPR 2 (scale ${await plot(page, (h) => h.renderScale())})`, await fpsOver(page, 10_000)));
    await plot(page, (h) => h.setRenderScale(0.6));
    fpsLines.push(fpsLine(`${m} DPR 2 x render scale 0.6`, await fpsOver(page, 10_000)));
    await plot(page, (h) => h.setRenderScale(null));

    await page.getByTestId("sim-toggle-pause").click(); // hold for the stills
    await page.getByTestId("force-row").nth(1).click();
    await page.keyboard.down("Shift");
    await page.getByTestId("force-row").nth(0).click();
    await page.keyboard.up("Shift");
    await page.getByTestId("force-row").nth(1).click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outDir, `${m}-unit-selected.png`) });

    await page.keyboard.press("Escape");
    await page.keyboard.press("s");
    await page.keyboard.press("t");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, `${m}-tilt-3d.png`) });

    // dense case: still tilted, sensors off, zoomed onto the tightest contact group
    await page.keyboard.press("s");
    const { best, bestN } = await densest(page);
    if (best) {
      await page.mouse.move(best.x, best.y);
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, -110);
        await page.waitForTimeout(90);
      }
    }
    await page.getByTestId("sim-toggle-pause").click();
    await page.waitForTimeout(2500);
    await page.getByTestId("sim-toggle-pause").click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(outDir, `${m}-dense-tilt.png`) });
    audits.push(`${m} dense-tilt (${bestN} contacts within 120 px): ${JSON.stringify({ ...(await plot(page, (h) => h.labelAudit())), layout: undefined })}`);
    await context.close();
  }

  // hornet pair close-up, CRT: run until the two Hornets are closest on screen
  {
    const context = await modeContext(browser, "crt");
    const page = await open(context, errors);
    await autopauseOff(page);
    await page.getByTestId("sim-speed").filter({ hasText: "10x" }).click();
    await page.getByTestId("sim-toggle-pause").click();
    let bestD = Infinity, t0 = Date.now();
    while (Date.now() - t0 < 40_000) {
      await page.waitForTimeout(120);
      const tr = await plot(page, (h) => h.trackScreens());
      const a = tr.find((t) => t.key === "unit:us-fa18-1"), b = tr.find((t) => t.key === "unit:us-fa18-2");
      if (!a || !b) break;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < bestD) bestD = d;
      else if (d > bestD + 6 && Date.now() - t0 > 3000) break; // they have started to open again
    }
    await page.getByTestId("sim-toggle-pause").click();
    const tr = await plot(page, (h) => h.trackScreens());
    const a = tr.find((t) => t.key === "unit:us-fa18-1"), b = tr.find((t) => t.key === "unit:us-fa18-2");
    if (a && b) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      await page.mouse.move(mx, my);
      for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, -110);
        await page.waitForTimeout(90);
      }
      await page.waitForTimeout(1500);
      const tr2 = await plot(page, (h) => h.trackScreens());
      const a2 = tr2.find((t) => t.key === "unit:us-fa18-1"), b2 = tr2.find((t) => t.key === "unit:us-fa18-2");
      const cx = (a2.x + b2.x) / 2, cy = (a2.y + b2.y) / 2;
      const clip = { x: Math.max(0, Math.min(1440 - 640, cx - 320)), y: Math.max(0, Math.min(900 - 400, cy - 200)), width: 640, height: 400 };
      await page.screenshot({ path: path.join(outDir, "hornet-pair.png"), clip });
      audits.push(`hornet-pair (closest ${bestD.toFixed(0)} px before zoom): ${JSON.stringify({ ...(await plot(page, (h) => h.labelAudit())), layout: undefined })}`);
    }
    await context.close();
  }

  // font comparison: the same CRT screen in Px437 IBM VGA and in VT323
  for (const f of ["px437", "vt323"]) {
    const context = await modeContext(browser, "crt", { deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(`${BASE}/play${f === "vt323" ? "?crtfont=vt323" : ""}`);
    await page.getByTestId("plot-canvas").waitFor({ timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1000);
    await autopauseOff(page);
    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await page.getByTestId("sim-toggle-pause").click();
    await page.waitForTimeout(9000);
    await page.getByTestId("sim-toggle-pause").click();
    await page.getByTestId("force-row").nth(1).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, `.font-${f}.png`) });
    await context.close();
  }
  // without ffmpeg on the host, the two halves stay as .font-*.png to stitch elsewhere
  try {
    execFileSync(process.env.FFMPEG ?? "ffmpeg", [
      "-y", "-v", "error", "-i", path.join(outDir, ".font-px437.png"), "-i", path.join(outDir, ".font-vt323.png"),
      "-filter_complex", "hstack=inputs=2", path.join(outDir, "font-compare.png"),
    ]);
    fs.rmSync(path.join(outDir, ".font-px437.png"));
    fs.rmSync(path.join(outDir, ".font-vt323.png"));
  } catch (e) {
    console.log(`font-compare not stitched (${String(e).split("\n")[0]}); halves kept`);
  }

  // mode switch: one moment of the fight, cycled through the three modes
  {
    const context = await modeContext(browser, "crt", { deviceScaleFactor: 1 });
    const page = await open(context, errors);
    await autopauseOff(page);
    await runToSalvo(page);
    await page.waitForTimeout(2500);
    await page.getByTestId("sim-toggle-pause").click(); // the same moment in every mode
    const fdir = fs.mkdtempSync(path.join(outDir, ".frames-"));
    const frames = [];
    const cdp = await context.newCDPSession(page);
    cdp.on("Page.screencastFrame", async (f) => {
      const file = path.join(fdir, `f${String(frames.length).padStart(5, "0")}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, "base64"));
      frames.push({ file, t: f.metadata.timestamp });
      await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 });
    await page.waitForTimeout(2200);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("v");
      await page.waitForTimeout(2600);
    }
    await cdp.send("Page.stopScreencast");
    await context.close();
    const lines = [];
    for (let i = 0; i < frames.length; i++) {
      const dur = i + 1 < frames.length ? frames[i + 1].t - frames[i].t : 1 / 30;
      lines.push(`file '${frames[i].file}'`, `duration ${Math.max(0.001, dur).toFixed(4)}`);
    }
    if (frames.length) lines.push(`file '${frames[frames.length - 1].file}'`);
    const list = path.join(fdir, "list.txt");
    fs.writeFileSync(list, lines.join("\n") + "\n");
    try {
      execFileSync(process.env.FFMPEG ?? "ffmpeg", [
        "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list,
        "-vf", "fps=30,format=yuv420p", "-c:v", "libvpx-vp9", "-b:v", "5M", "-an", path.join(outDir, "mode-switch.webm"),
      ]);
      fs.rmSync(fdir, { recursive: true, force: true });
    } catch (e) {
      // keep the frames and their concat list (with paths) to encode elsewhere
      fs.renameSync(fdir, path.join(outDir, ".mode-switch-frames"));
      console.log(`mode-switch not encoded (${String(e).split("\n")[0]}); frames kept`);
    }
    console.log(`mode-switch.webm: ${frames.length} frames`);
  }

  fs.writeFileSync(path.join(outDir, "fps.txt"), `server ${BASE}; 1440x900, DPR 2, 10 s of requestAnimationFrame each, sim at 10x with weapons in flight\n` + fpsLines.join("\n") + "\n");
  fs.writeFileSync(path.join(outDir, "label-audit-at-capture.txt"), audits.join("\n") + "\n");
  fs.writeFileSync(path.join(outDir, "console-errors.txt"), errors.length ? errors.join("\n") + "\n" : "none\n");
  console.log(fpsLines.join("\n"));
  console.log(JSON.stringify({ errors }, null, 2));
  await browser.close();
}

// dense: CRT, tilted, paused at a moment when at least six contacts crowd together
async function dense() {
  const errors = [];
  const browser = await launch();
  const context = await modeContext(browser, "crt");
  const page = await open(context, errors);
  await autopauseOff(page);
  await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
  await page.getByTestId("sim-toggle-pause").click();
  let found = { best: null, bestN: -1 };
  const t0 = Date.now();
  while (Date.now() - t0 < 180_000) {
    await page.waitForTimeout(1000);
    found = await densest(page);
    if (found.bestN >= 6) break;
  }
  await page.getByTestId("sim-toggle-pause").click();
  await page.keyboard.press("t");
  await page.waitForTimeout(2500);
  const { best, bestN } = await densest(page);
  if (best) {
    await page.mouse.move(best.x, best.y);
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, -110);
      await page.waitForTimeout(150);
    }
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(outDir, "crt-dense-tilt.png") });
  const audit = await plot(page, (h) => h.labelAudit());
  fs.writeFileSync(
    path.join(outDir, "crt-dense-tilt.txt"),
    `crt-dense-tilt.png: paused when ${found.bestN} contacts were within 120 px (${bestN} after tilt)\n` +
      `${JSON.stringify({ ...audit, layout: undefined })}\nconsole errors: ${errors.length ? errors.join(" | ") : "none"}\n`,
  );
  console.log(found.bestN, bestN, JSON.stringify({ ...audit, layout: undefined }));
  await browser.close();
}

await (mode === "full" ? full() : mode === "dense" ? dense() : quick());
