// Passive run diagnostic: no orders, 60x, play, resume on every autopause exactly like tests/helpers runUntilResult.
// usage: node diag.cjs <throttleRate> <label> [pollMs]
const { chromium } = require("playwright");
const rate = Number(process.argv[2] ?? 1), label = process.argv[3] ?? "run", pollMs = Number(process.argv[4] ?? 400);
(async () => {
  const browser = await chromium.launch({ args: ["--mute-audio", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__SAND_E2E__ = true; });
  await page.goto("http://localhost:3001/play", { timeout: 120000 });
  await page.waitForFunction(() => !!window.__sandPlot, null, { timeout: 90000 });
  await page.waitForFunction(() => (window.__sandPlot?.frames() ?? 0) > 30, null, { timeout: 120000 });
  const cdp = await ctx.newCDPSession(page);
  if (rate > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  await page.keyboard.press("Escape");
  await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
  const sim = () => page.evaluate(() => { const s = window.__sandSession.snapshot(); return { t: s.gameState.simTime, start: s.gameState.scenario.startTime, paused: s.gameState.isPaused, res: s.eventState?.scenarioResult?.result ?? null, frames: window.__sandPlot.frames() }; });
  const s0 = await sim();
  const start = typeof s0.start === "number" ? s0.start : new Date(s0.start).getTime();
  await page.getByTestId("sim-toggle-pause").click();
  const overlay = page.getByTestId("result-overlay");
  const t0 = Date.now();
  let resumes = 0, iters = 0, at480 = null; const samples = [];
  let lastLog = 0;
  while (Date.now() - t0 < 1800000) {
    iters++;
    if (await overlay.isVisible()) break;
    const lab = ((await page.getByTestId("sim-toggle-pause").textContent({ timeout: 2000 }).catch(() => null)) ?? "").trim();
    if (/PLAY/i.test(lab)) { await page.getByTestId("sim-toggle-pause").click({ timeout: 2000 }).catch(() => {}); resumes++; }
    await page.waitForTimeout(pollMs);
    const el = Date.now() - t0;
    if (el - lastLog > 30000) { lastLog = el; const s = await sim(); samples.push({ wall: Math.round(el / 1000), simH: +((s.t - start) / 3.6e6).toFixed(3), resumes, frames: s.frames }); if (at480 === null && el >= 480000) at480 = samples[samples.length - 1]; }
  }
  const wall = (Date.now() - t0) / 1000;
  const s = await sim();
  const title = await page.getByTestId("result-title").innerText().catch(() => "(none)");
  const out = { label, throttle: rate, pollMs, wallSec: +wall.toFixed(1), simHours: +((s.t - start) / 3.6e6).toFixed(3), result: s.res, title, resumes, iters, frames: s.frames - s0.frames, effectiveRate: +(((s.t - start) / 1000) / wall).toFixed(1), within480: wall <= 480, samples };
  console.log(JSON.stringify(out));
  await browser.close();
})().catch((e) => { console.error("ERR", e); process.exit(1); });
