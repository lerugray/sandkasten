#!/usr/bin/env node
// Builds data/facilities/hormuz.json from OurAirports (public domain) + OpenStreetMap/Overpass (ODbL).
//
//   node scripts/build-facilities.mjs                 fetch live, cache raw responses, write output
//   node scripts/build-facilities.mjs --offline       rebuild from the committed raw snapshot (data/facilities/raw/<fetch-date>)
//   --fetch-date YYYY-MM-DD   pin the cache directory / recorded date (default: today, or newest cache when --offline)
//   --bbox S,W,N,E            override the theater bounding box
//   --out path                output file (default data/facilities/hormuz.json)

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOverpassQueries,
  mergeFacilities,
  parseOsmFacilities,
  parseOsmRunways,
  parseOurAirports,
  slimOurAirports,
} from "./lib/facilities.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};

const [S, W, N, E] = (opt("bbox", "22.5,50.0,30.0,61.0")).split(",").map(Number);
const BBOX = { south: S, west: W, north: N, east: E };
const OUT = resolve(ROOT, opt("out", "data/facilities/hormuz.json"));
// Committed on purpose: the dated raw responses (OurAirports slimmed to the bbox) let the data regenerate offline.
const CACHE_ROOT = join(ROOT, "data", "facilities", "raw");
const OA_BASE = "https://davidmegginson.github.io/ourairports-data";
const UA = "sandkasten-facility-pipeline/1.0 (https://github.com/lerugray/sandkasten)";
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { "User-Agent": UA, ...(init.headers ?? {}) } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.text();
}

async function overpass(query, label) {
  let wait = 8000;
  for (let attempt = 1; attempt <= 12; attempt++) {
    const ep = ENDPOINTS[(attempt - 1) % ENDPOINTS.length];
    try {
      const body = new URLSearchParams({ data: query });
      const text = await fetchText(ep, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(240000),
      });
      const json = JSON.parse(text);
      if (!Array.isArray(json.elements)) throw new Error("no elements array");
      if (json.remark && /error|timed out/i.test(json.remark)) throw new Error(`remark: ${json.remark}`);
      console.log(`  ${label}: ${json.elements.length} elements via ${ep}`);
      return json;
    } catch (e) {
      console.log(`  ${label}: attempt ${attempt} on ${ep} failed (${e.message.slice(0, 120)}); retry in ${wait / 1000}s`);
      await sleep(wait);
      wait = Math.min(wait * 1.6, 90000);
    }
  }
  throw new Error(`Overpass ${label} failed after retries`);
}

function pickCacheDir() {
  const pinned = opt("fetch-date", null);
  if (pinned) return { date: pinned, dir: join(CACHE_ROOT, pinned) };
  if (flag("offline")) {
    const dates = existsSync(CACHE_ROOT) ? readdirSync(CACHE_ROOT).sort() : [];
    if (!dates.length) throw new Error("--offline but no snapshot in data/facilities/raw");
    const date = dates[dates.length - 1];
    return { date, dir: join(CACHE_ROOT, date) };
  }
  const date = new Date().toISOString().slice(0, 10);
  return { date, dir: join(CACHE_ROOT, date) };
}

async function cached(dir, name, fetcher) {
  const file = join(dir, name);
  if (existsSync(file)) return readFileSync(file, "utf8");
  if (flag("offline")) throw new Error(`--offline and ${file} missing`);
  const text = await fetcher();
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, text);
  return text;
}

const { date: fetchDate, dir: cacheDir } = pickCacheDir();
console.log(`facility pipeline: bbox S${S} W${W} N${N} E${E}, fetch date ${fetchDate}${flag("offline") ? " (offline)" : ""}`);

const slim = async () => {
  const [a, r] = await Promise.all([fetchText(`${OA_BASE}/airports.csv`), fetchText(`${OA_BASE}/runways.csv`)]);
  return slimOurAirports(a, r, BBOX);
};
let slimmed;
const airportsCsv = await cached(cacheDir, "airports.csv", async () => (slimmed ??= await slim()).airports);
const runwaysCsv = await cached(cacheDir, "runways.csv", async () => (slimmed ??= await slim()).runways);
const queries = buildOverpassQueries(BBOX);
const raw = {};
for (const [name, q] of Object.entries(queries)) {
  const text = await cached(cacheDir, `overpass-${name}.json`, async () => JSON.stringify(await overpass(q, name)));
  raw[name] = JSON.parse(text).elements;
}

const ourairports = parseOurAirports(airportsCsv, runwaysCsv, BBOX);
const osmFacilities = parseOsmFacilities([...raw.aerodromes, ...raw.naval, ...raw.ports, ...raw.military]);
const osmRunways = parseOsmRunways(raw.runways);
const { facilities, osmRunwayCount } = mergeFacilities({ ourairports, osmFacilities, osmRunways });

// Collapse identical OSM elements returned by several queries (e.g. military=naval_base also in military query).
const seenSrc = new Set();
const unique = facilities.filter((f) => {
  const k = f.sources.map((s) => `${s.source}:${s.id}`).join("|");
  const first = f.sources[0];
  const id = `${first.source}:${first.id}:${f.kind}`;
  if (seenSrc.has(id)) return false;
  seenSrc.add(id);
  return k.length > 0;
});

const runways = unique.reduce((n, f) => n + (f.runways?.length ?? 0), 0);
const counts = {};
for (const f of unique) counts[f.kind] = (counts[f.kind] ?? 0) + 1;

const output = {
  meta: {
    schema: 1,
    theater: "Strait of Hormuz",
    bbox: BBOX,
    fetchDate,
    generator: "scripts/build-facilities.mjs",
    sources: [
      { name: "OurAirports", url: "https://ourairports.com/data/", files: ["airports.csv", "runways.csv"], licence: "Public Domain" },
      {
        name: "OpenStreetMap via Overpass API",
        url: "https://www.openstreetmap.org/copyright",
        licence: "ODbL 1.0",
        attribution: "© OpenStreetMap contributors",
      },
    ],
    counts: { facilities: unique.length, runways, ...counts, osmRunwaysAttached: osmRunwayCount.attached, osmRunwaysSkipped: osmRunwayCount.orphans },
  },
  facilities: unique,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(output));
console.log(`wrote ${OUT}`);
console.log(JSON.stringify(output.meta.counts));
