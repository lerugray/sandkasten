#!/usr/bin/env node
// Static release build. Produces out/ for a plain static file server (Cloudflare Pages).
//
//   node scripts/build-static.mjs
//
// The release build ships no server, so:
//   1. The platform database is emitted as a static JSON the client can fetch
//      (public/platforms/index.json) — the /database viewer also bundles the same records.
//   2. src/app/api is moved aside (the three routes are dev-only); next build runs with
//      output: "export" and none of them are in the tree, so out/ contains zero /api/* paths.
//   3. NEXT_PUBLIC_SAND_RELEASE=1 is set so client code hides the live snapshot fetch, the
//      /api/platforms detail queries and the local-LLM InfoWar feature.
//
// The api directory is always restored, even if the build fails.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appApi = path.join(root, "src", "app", "api");
const apiOff = path.join(root, "src", "api.dev-off");

// 1. Platforms as a static JSON the client can fetch.
function emitPlatforms() {
  const dir = path.join(root, "src", "data", "platforms", "records");
  const records = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));
  const outDir = path.join(root, "public", "platforms");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, "index.json"),
    JSON.stringify({ available: records.length > 0, count: records.length, records }, null, 0) + "\n",
  );
}

// 2. Move the dev-only API routes out of the app router for the export build.
function moveApiOut() {
  if (existsSync(appApi) && !existsSync(apiOff)) {
    renameSync(appApi, apiOff);
    return true;
  }
  return false;
}

function restoreApi() {
  if (!existsSync(appApi) && existsSync(apiOff)) renameSync(apiOff, appApi);
}

emitPlatforms();
const moved = moveApiOut();
let code = 0;
try {
  const env = { ...process.env, NEXT_PUBLIC_SAND_RELEASE: "1", SAND_STATIC_EXPORT: "1" };
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  const res = spawnSync(process.execPath, [nextBin, "build"], { stdio: "inherit", env });
  code = typeof res.status === "number" ? res.status : 1;
} finally {
  if (moved) restoreApi();
}
process.exit(code);
