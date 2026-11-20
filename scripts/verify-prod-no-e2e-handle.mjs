// SAND-SAVE-1 (S3 #9): the test-only session handle must not exist in a normal production build,
// even when a page sets window.__SAND_E2E__. Usage: build WITHOUT NEXT_PUBLIC_SAND_E2E, `next start -p PORT`, then
//   node scripts/verify-prod-no-e2e-handle.mjs http://localhost:PORT [chromium-path]
import { chromium } from "playwright";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3002";
const exe = process.argv[3];

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const chunks = walk(path.join(process.cwd(), ".next", "static")).filter((f) => f.endsWith(".js"));
const hits = chunks.filter((f) => readFileSync(f, "utf8").includes("__sandSession"));

const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--mute-audio", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
await page.addInitScript(() => { window.__SAND_E2E__ = true; });
await page.goto(`${base}/play`, { timeout: 120000 });
await page.waitForSelector('[data-testid="sim-clock"]', { timeout: 90000 });
await page.waitForTimeout(3000);
const handle = await page.evaluate(() => typeof window.__sandSession);
await browser.close();
const out = { base, flagSetInPage: true, windowSandSession: handle, jsChunksScanned: chunks.length, chunksContainingHandleName: hits.map((f) => path.relative(process.cwd(), f)) };
console.log(JSON.stringify(out, null, 2));
if (handle !== "undefined" || hits.length) {
  console.error("FAIL: the E2E session handle is present in a normal production build");
  process.exit(1);
}
console.log("PASS: no E2E session handle in the production build");
