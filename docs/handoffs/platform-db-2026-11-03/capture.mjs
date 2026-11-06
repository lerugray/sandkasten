#!/usr/bin/env node
// Frame captures for /database at 1440x900 DPR 2. Needs a dev server; set BASE_URL (default :3301).
// Host-specific browser settings come from the environment, never from this file:
//   CHROMIUM_EXECUTABLE  optional path to a Chromium / headless shell binary
//   CHROMIUM_ARGS        optional extra launch flags, space separated
// Usage: node capture.mjs [outDir]
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, "../../..");
const { chromium } = require(path.join(repo, "node_modules/playwright"));
const out = path.resolve(process.argv[2] ?? path.join(here, "frames"));
const BASE = process.env.BASE_URL ?? "http://localhost:3301";
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  args: (process.env.CHROMIUM_ARGS ?? "").split(/\s+/).filter(Boolean),
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

async function open(slug) {
  await page.goto(`${BASE}/database?slug=${slug}`);
  await page.getByTestId("db-detail").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => {
    const i = document.querySelector('[data-testid="db-photo"]');
    return !i || (i.complete && i.naturalWidth > 0);
  });
  await page.waitForTimeout(300);
}
const shot = (name) => page.screenshot({ path: path.join(out, name) });

await open("arleigh-burke-flt-ii");
await shot("db-uss-mahan.png");
await open("fa-18e-super-hornet");
await shot("db-fa18e.png");
await open("sina-class-houdong");
await shot("db-iran-sina.png");
await open("fa-18e-super-hornet");
await page.getByTestId("db-sources").scrollIntoViewIfNeeded();
await page.getByTestId("db-main").evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
await page.waitForTimeout(300);
await shot("db-sources-scroll.png");

await browser.close();
fs.writeFileSync(path.join(out, "console-errors.txt"), errors.length ? errors.join("\n") : "none\n");
console.log("console errors:", errors.length);
