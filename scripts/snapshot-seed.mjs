#!/usr/bin/env node
// Real-world snapshot -> scenario seed for the Strait of Hormuz.
//
//   node scripts/snapshot-seed.mjs [--out data/snapshots/<name>.scenario.json] [--bbox w,s,e,n]
//                                  [--fixture path] [--record path] [--include-civil]
//
//   --out          scenario file (default data/snapshots/hormuz-adsb-<YYYYMMDDTHHMMSSZ>.scenario.json)
//   --bbox         west,south,east,north (default 50,22.5,61,30 = data/facilities/hormuz.json meta.bbox)
//   --fixture      build from a recorded response file instead of the network (no requests at all)
//   --record       also write the trimmed raw responses (default off; used to create unit/fixtures/*)
//   --include-civil  also add non-military aircraft as Neutral unknown contacts
//
// Source: adsb.lol public API, keyless, ODbL 1.0, one request per second (src/lib/snapshot/adsb.ts).
// Ships: skipped on purpose. AISStream needs an API key and there is no keyless AIS source for this bbox;
// this tool never reads or stores a key.
//
// The builder is TypeScript (src/lib/snapshot/*.ts) and runs through Node's built-in type stripping
// (Node >= 22.18, or 22.6+ with --experimental-strip-types), so there is no second copy to keep in sync.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};

const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(`snapshot-seed needs Node >= 22.18 (type stripping); this is ${process.version}. Try: node --experimental-strip-types scripts/snapshot-seed.mjs`);
  process.exitCode = 1;
}

const { buildSnapshotScenario, HORMUZ_BBOX } = await import("../src/lib/snapshot/seed.ts");
const { fetchAdsb, aircraftFromRequests, adsbSources } = await import("../src/lib/snapshot/adsb.ts");

const bbox = opt("bbox", null)?.split(",").map(Number) ?? HORMUZ_BBOX;
if (bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n)) || bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) {
  console.error("--bbox must be west,south,east,north with west<east and south<north");
  process.exit(2);
}

let fetchedAt;
let requests;
let sources;
const fixturePath = opt("fixture", null);
if (fixturePath) {
  const rec = JSON.parse(readFileSync(resolve(ROOT, fixturePath), "utf8"));
  fetchedAt = rec.fetchedAt;
  requests = rec.requests;
  sources = adsbSources(requests, bbox);
  console.error(`fixture ${fixturePath}: ${requests.length} recorded responses, no network`);
} else {
  console.error("fetching adsb.lol (keyless, 1 request/second)...");
  const res = await fetchAdsb(bbox);
  for (const r of res.requests) console.error(`  ${r.status || "ERR"} ${r.url} ${r.error ?? `${r.ac.length} aircraft`}`);
  if (res.failed) {
    console.error("no ADS-B request succeeded; nothing written");
    process.exit(3);
  }
  ({ fetchedAt, requests, sources } = res);
}

const aircraft = aircraftFromRequests(requests);
const scenario = buildSnapshotScenario({ aircraft, vessels: [], fetchedAt, sources, bbox, includeCivil: flag("include-civil") });

const stampName = fetchedAt.replace(/[-:]/g, "").replace(/\.\d+/, "");
const out = resolve(ROOT, opt("out", `data/snapshots/hormuz-adsb-${stampName}.scenario.json`));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(scenario, null, 2) + "\n");

const recordPath = opt("record", null);
if (recordPath && !fixturePath) {
  const rp = resolve(ROOT, recordPath);
  mkdirSync(dirname(rp), { recursive: true });
  writeFileSync(rp, JSON.stringify({ fetchedAt, bbox, requests }) + "\n");
  console.error(`recorded ${rp}`);
}

const c = scenario.snapshot.counts;
console.error(`wrote ${out}`);
console.error(`fetched ${fetchedAt}: ${c.units} units, mapped ${JSON.stringify(c.mappedByType)}, unknown ${c.unknownContacts}, sides ${JSON.stringify(c.bySide)}`);
for (const s of scenario.snapshot.sources) console.error(`  source ${s.id}: ${s.status}${s.reason ? ` (${s.reason})` : ""} ${JSON.stringify(s.counts ?? {})}`);
