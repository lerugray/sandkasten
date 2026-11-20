#!/usr/bin/env node
// Verify the static export: every page loads with zero console errors and zero /api/* requests.
// Usage: node scripts/verify-release.mjs [baseUrl] [chromiumExecutable]
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { chromium } = require(path.join(root, "node_modules", "playwright"));

const BASE = process.argv[2] ?? process.env.BASE_URL ?? "http://127.0.0.1:4173";
const SWIFTSHADER = ["--mute-audio", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

const ROUTES = [
  { path: "/", ready: (p) => p.locator('a[href="/play"]').first().waitFor({ timeout: 30_000 }) },
  { path: "/play", ready: (p) => p.getByTestId("plot-canvas").waitFor({ timeout: 90_000 }) },
  { path: "/play?scenario=snapshot", ready: (p) => p.getByTestId("plot-canvas").waitFor({ timeout: 90_000 }) },
  { path: "/editor", ready: (p) => p.locator("canvas").first().waitFor({ timeout: 30_000 }) },
  { path: "/database", ready: (p) => p.getByTestId("db-root").waitFor({ timeout: 30_000 }) },
];

const browser = await chromium.launch({
  executablePath: process.argv[3] || process.env.CHROMIUM_EXECUTABLE || undefined,
  args: SWIFTSHADER,
});

const results = [];
try {
  for (const route of ROUTES) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    const apiCalls = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("request", (r) => { if (r.url().includes("/api/")) apiCalls.push(r.url()); });
    let ready = false;
    try {
      await page.goto(`${BASE}${route.path}`, { waitUntil: "load", timeout: 120_000 });
      await route.ready(page);
      ready = true;
    } catch (err) {
      errors.push(`READY TIMEOUT: ${err instanceof Error ? err.message : String(err)}`);
    }
    results.push({ path: route.path, ready, consoleErrors: errors, apiCalls });
    await context.close();
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
