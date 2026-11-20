#!/usr/bin/env node
// Generate the Sandkasten share images (1200x630 OG card, 1200x1200 square, 180x180 touch icon)
// from a real in-game capture of the opening scenario's tactical plot, titled in the game's own
// JetBrains Mono typeface and phosphor palette. No AI image generation: the background is a live
// screenshot of /play, cropped and titled.
//
// Usage: node scripts/generate-og.mjs [baseUrl] [outDir]
//   baseUrl  the served app (default http://127.0.0.1:4173)
//   outDir   where the PNGs are written (default public/)
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = require(path.join(root, "node_modules", "playwright"));

const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://127.0.0.1:4173";
const outDir = path.resolve(process.argv[3] ?? path.join(root, "public"));
const tmp = fs.mkdtempSync(path.join(root, "scripts", ".og-tmp-"));

const SWIFTSHADER = ["--mute-audio", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const FONT_700 = path.join(root, "public", "fonts", "jetbrains-mono", "jetbrains-mono-latin-700-normal.woff2");
const FONT_400 = path.join(root, "public", "fonts", "jetbrains-mono", "jetbrains-mono-latin-400-normal.woff2");

function cardHtml(imgUrl, { w, h, brandSize, subSize, center }) {
  const cardLeft = center ? "left:50%;transform:translateX(-50%);text-align:center" : "left:44px";
  const ruleMargin = center ? "margin:18px auto 16px" : "margin:16px 0 14px";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"JetBrains Mono";src:url("${pathToFileURL(FONT_700).href}") format("woff2");font-weight:700;font-style:normal;}
@font-face{font-family:"JetBrains Mono";src:url("${pathToFileURL(FONT_400).href}") format("woff2");font-weight:400;font-style:normal;}
html,body{margin:0;padding:0;width:${w}px;height:${h}px;overflow:hidden;background:#020604;font-family:"JetBrains Mono",monospace;}
.stage{position:absolute;inset:0;overflow:hidden;}
.stage img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,6,4,0.78) 0%,rgba(2,6,4,0.25) 30%,rgba(2,6,4,0) 55%,rgba(2,6,4,0.82) 100%);}
.card{position:absolute;left:44px;top:40px;right:44px;${cardLeft === "left:44px" ? "" : "left:50%;transform:translateX(-50%);right:auto;text-align:center;"}}
.brand{color:#4cf58e;font-weight:700;font-size:${brandSize}px;letter-spacing:0.18em;line-height:1;text-shadow:0 0 2px rgba(76,245,142,0.9),0 0 14px rgba(76,245,142,0.5);}
.rule{height:2px;background:#4cf58e;box-shadow:0 0 10px rgba(76,245,142,0.5);width:${center ? "320px" : "280px"};${ruleMargin}}
.sub{color:#3fbf74;font-size:${subSize}px;letter-spacing:0.16em;font-weight:400;}
.domain{position:absolute;right:44px;bottom:30px;color:#3fbf74;font-size:18px;letter-spacing:0.14em;}
</style></head><body>
<div class="stage"><img src="${imgUrl}"><div class="shade"></div></div>
<div class="card"><div class="brand">SANDKASTEN</div><div class="rule"></div><div class="sub">OPEN-SOURCE WARGAME SIMULATION</div></div>
<div class="domain">csl-sandkasten.com</div>
</body></html>`;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: SWIFTSHADER,
});

try {
  const errors = [];
  // 1. A real in-game capture of the opening scenario: /play, briefing closed, opening framing settled.
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(`${BASE}/play`, { waitUntil: "load", timeout: 120_000 });
  await page.getByTestId("plot-canvas").waitFor({ timeout: 90_000 });
  await page.waitForFunction(() => window.__sandPlot?.frames?.() > 30, null, { timeout: 90_000 });
  await page.evaluate(() => document.fonts.ready);

  const close = page.getByTestId("briefing-close");
  if (await close.isVisible({ timeout: 5_000 }).catch(() => false)) await close.click();
  else await page.keyboard.press("Enter");
  // let the opening frame glide settle fully
  await page.waitForTimeout(1800);

  const shotPath = path.join(tmp, "plot.png");
  await page.screenshot({ path: shotPath, timeout: 120_000 });
  await ctx.close();

  // 2. Crop + title in the game's own font and palette, then capture at the three sizes.
  const imgUrl = pathToFileURL(shotPath).href;
  const jobs = [
    { file: "og-1200x630.png", w: 1200, h: 630, brandSize: 60, subSize: 20, center: false },
    { file: "og-1200x1200.png", w: 1200, h: 1200, brandSize: 72, subSize: 24, center: true },
  ];
  for (const j of jobs) {
    const html = cardHtml(imgUrl, j);
    const htmlPath = path.join(tmp, `${j.w}x${j.h}.html`);
    fs.writeFileSync(htmlPath, html);
    const cpage = await browser.newPage({ viewport: { width: j.w, height: j.h } });
    await cpage.goto(pathToFileURL(htmlPath).href);
    await cpage.evaluate(() => document.fonts.ready);
    await cpage.waitForTimeout(300);
    await cpage.screenshot({ path: path.join(outDir, j.file) });
    await cpage.close();
  }

  // Touch icon: a plain square crop of the plot, no text (text is unreadable at 180px).
  const touchHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:180px;height:180px;overflow:hidden;background:#020604;}
img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;}
</style></head><body><img src="${imgUrl}"></body></html>`;
  const touchPath = path.join(tmp, "touch.html");
  fs.writeFileSync(touchPath, touchHtml);
  const tpage = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await tpage.goto(pathToFileURL(touchPath).href);
  await tpage.waitForTimeout(200);
  await tpage.screenshot({ path: path.join(outDir, "apple-touch-icon.png") });
  await tpage.close();

  const report = {};
  for (const f of ["og-1200x630.png", "og-1200x1200.png", "apple-touch-icon.png"]) {
    const p = path.join(outDir, f);
    report[f] = fs.existsSync(p) ? `${fs.statSync(p).size} bytes` : "missing";
  }
  console.log(JSON.stringify({ base: BASE, outDir, sizes: report, captureErrors: errors }, null, 2));
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
