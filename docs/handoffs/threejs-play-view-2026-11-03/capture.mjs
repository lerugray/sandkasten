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

async function full() {
  const errors = [];
  const browser = await launch();

  // stills: 1440x900 at DPR 2
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await open(context, errors);
    const info = await plot(page, (h) => h.rendererInfo());
    fs.writeFileSync(
      path.join(outDir, "renderer.txt"),
      `UNMASKED_RENDERER_WEBGL: ${info.renderer}\nUNMASKED_VENDOR_WEBGL: ${info.vendor}\nVERSION: ${info.version}\n` +
        `browser: ${browser.version()}\nviewport: 1440x900 DPR 2\n`,
    );
    await autopauseOff(page);
    await runToSalvo(page);
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(outDir, "first-screen.png") });

    // fps over 10 s while the salvo plays out at 10x
    const fps = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const dts = [];
          let last = performance.now();
          const end = last + 10_000;
          const step = (t) => {
            dts.push(t - last);
            last = t;
            if (t < end) requestAnimationFrame(step);
            else resolve(dts.slice(1));
          };
          requestAnimationFrame((t) => {
            last = t;
            requestAnimationFrame(step);
          });
        }),
    );
    const sorted = [...fps].sort((a, b) => a - b);
    const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    const median = 1000 / q(0.5);
    const p5 = 1000 / q(0.95); // 5th-percentile fps = 95th-percentile frame time
    fs.writeFileSync(
      path.join(outDir, "fps.txt"),
      `window: 10 s of requestAnimationFrame on /play, 1440x900 DPR 2, sim at 10x with weapons in flight\n` +
        `frames: ${fps.length}\nmedian fps: ${median.toFixed(1)}\n5th percentile fps: ${p5.toFixed(1)}\n` +
        `median frame ms: ${q(0.5).toFixed(2)}\n95th percentile frame ms: ${q(0.95).toFixed(2)}\nworst frame ms: ${sorted[sorted.length - 1].toFixed(2)}\n`,
    );

    await page.getByTestId("sim-toggle-pause").click(); // hold for the stills
    await page.getByTestId("force-row").nth(1).click();
    await page.keyboard.down("Shift");
    await page.getByTestId("force-row").nth(0).click();
    await page.keyboard.up("Shift");
    await page.getByTestId("force-row").nth(1).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, "unit-selected.png") });

    await page.keyboard.press("Escape");
    await page.keyboard.press("s");
    await page.keyboard.press("t");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, "tilt-3d.png") });
    await context.close();
  }

  // motion: CDP screencast frames, encoded with the system ffmpeg
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await open(context, errors);
    await autopauseOff(page);
    await runToSalvo(page);
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
    await page.waitForTimeout(1200);
    // short drag-pan with a throw so the plot coasts, then wheel zoom toward
    // the engagement over the strait
    await page.mouse.move(900, 460);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(900 + i * 9, 460 - i * 4, { steps: 1 });
    await page.mouse.up();
    await page.waitForTimeout(1200);
    const aim = await plot(page, (h) => h.project(56.4, 26.7));
    await page.mouse.move(aim.x, aim.y);
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, -110);
      await page.waitForTimeout(90);
    }
    await page.waitForTimeout(1300);
    await page.keyboard.press("t");
    await page.waitForTimeout(2200);
    await page.keyboard.press("t");
    await page.waitForTimeout(1300);
    await cdp.send("Page.stopScreencast");
    await context.close();

    // concat list with each frame held until the next one arrived
    const lines = [];
    for (let i = 0; i < frames.length; i++) {
      const dur = i + 1 < frames.length ? frames[i + 1].t - frames[i].t : 1 / 30;
      lines.push(`file '${frames[i].file}'`, `duration ${Math.max(0.001, dur).toFixed(4)}`);
    }
    lines.push(`file '${frames[frames.length - 1].file}'`);
    const list = path.join(fdir, "list.txt");
    fs.writeFileSync(list, lines.join("\n") + "\n");
    execFileSync(process.env.FFMPEG ?? "ffmpeg", [
      "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list,
      "-vf", "fps=30,format=yuv420p", "-c:v", "libvpx-vp9", "-b:v", "5M", "-an", path.join(outDir, "motion.webm"),
    ]);
    const span = frames.length ? frames[frames.length - 1].t - frames[0].t : 0;
    fs.rmSync(fdir, { recursive: true, force: true });
    console.log(`motion.webm: ${frames.length} screencast frames over ${span.toFixed(1)} s`);
  }

  fs.writeFileSync(path.join(outDir, "console-errors.txt"), errors.length ? errors.join("\n") + "\n" : "none\n");
  console.log(JSON.stringify({ errors }, null, 2));
  await browser.close();
}

await (mode === "full" ? full() : quick());
