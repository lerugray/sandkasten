#!/usr/bin/env node
// Imports Auftragstaktik's curated OSINT (air defence, radar, nuclear, installations) for the Hormuz bbox.
//
//   node scripts/import-osint.mjs            offline: reads data/osint/raw/auftragstaktik-<commit>/ (committed copy, MIT)
//   --raw dir      alternative directory with the four Auftragstaktik data files
//   --out path     OSINT site file (default data/osint/hormuz.json)
//   --facilities path   facility file to overlay (default data/facilities/hormuz.json; run build-facilities first)
//
// Output: data/osint/hormuz.json (sites) and OSINT fields merged into data/facilities/hormuz.json.
// Idempotent; needs Node >= 22 (loads the .ts data files with type stripping).

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  AT_COMMIT,
  adFromAuftragstaktik,
  applyPlatformMatches,
  curatedSite,
  dedupeSites,
  inBbox,
  nuclearFromAuftragstaktik,
  overlayFacilities,
  radarFromAuftragstaktik,
} from "./lib/osint.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};

const RAW = resolve(ROOT, opt("raw", `data/osint/raw/auftragstaktik-${AT_COMMIT.slice(0, 7)}`));
const OUT = resolve(ROOT, opt("out", "data/osint/hormuz.json"));
const FAC = resolve(ROOT, opt("facilities", "data/facilities/hormuz.json"));
const CURATED = join(ROOT, "data/osint/curated/hormuz-supplement.json");
const RECORDS = join(ROOT, "src/data/platforms/records");

const load = async (name) => import(pathToFileURL(join(RAW, `${name}.ts`)).href);
const [ad, radar, nuc, inst] = await Promise.all([
  load("airDefense"),
  load("radarSites"),
  load("nuclearFacilities"),
  load("militaryInstallations"),
]);

const facFile = JSON.parse(readFileSync(FAC, "utf8"));
const bbox = facFile.meta.bbox;
const curated = JSON.parse(readFileSync(CURATED, "utf8"));
const records = readdirSync(RECORDS)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(RECORDS, f), "utf8")));

const nuclearIn = nuc.NUCLEAR_FACILITIES.filter((r) => inBbox({ lat: r.lat, lng: r.lng }, bbox));
const nuclearById = new Map(nuclearIn.map((r) => [r.id, r]));

// Facilities with the Auftragstaktik installation overlay applied first, so curated sites can anchor to the new records.
const overlay = overlayFacilities(
  facFile.facilities,
  {
    installations: inst.MILITARY_INSTALLATIONS.filter((r) => inBbox({ lat: r.lat, lng: r.lng }, bbox)),
    atInstallations: { map: curated.auftragstaktik.installations, dropped: curated.auftragstaktik.dropped },
    curatedInstallations: curated.installations,
  },
);
const facilitiesById = new Map(overlay.facilities.map((f) => [f.id, f]));

const dropped = [...overlay.dropped];
for (const [list, label] of [
  [ad.AIR_DEFENSE_SITES, "air defence"],
  [radar.RADAR_SITES, "radar"],
  [nuc.NUCLEAR_FACILITIES, "nuclear"],
  [inst.MILITARY_INSTALLATIONS, "installation"],
]) {
  for (const r of list) {
    if (!inBbox({ lat: r.lat, lng: r.lng }, bbox) && !dropped.some((d) => d.id === r.id)) {
      dropped.push({ id: r.id, reason: `${label} record outside the Hormuz bbox` });
    }
  }
}
// Keep the report short: group the outside-bbox records by layer.
const outside = dropped.filter((d) => d.reason.endsWith("outside the Hormuz bbox"));
const dropNote = [
  ...dropped.filter((d) => !d.reason.endsWith("outside the Hormuz bbox")),
  ...["air defence", "radar", "nuclear", "installation"].map((l) => ({
    id: `${outside.filter((d) => d.reason.startsWith(l)).length} ${l} records`,
    reason: "outside the Hormuz bbox",
  })),
];

const fromAt = [
  ...ad.AIR_DEFENSE_SITES.filter((r) => inBbox({ lat: r.lat, lng: r.lng }, bbox)).map(adFromAuftragstaktik),
  ...radar.RADAR_SITES.filter((r) => inBbox({ lat: r.lat, lng: r.lng }, bbox)).map(radarFromAuftragstaktik),
  ...nuclearIn.map(nuclearFromAuftragstaktik),
];
const fromCurated = curated.sites.map((c) => curatedSite(c, facilitiesById, nuclearById));
const sites = applyPlatformMatches(dedupeSites([...fromAt, ...fromCurated]), records).sort(
  (a, b) => a.layer.localeCompare(b.layer) || a.id.localeCompare(b.id),
);

const count = (l) => sites.filter((s) => s.layer === l).length;
const dataset = {
  meta: {
    schema: 1,
    theater: "Strait of Hormuz",
    bbox,
    generated: "2026-11-06",
    generator: "scripts/import-osint.mjs",
    attribution:
      "Site records from Auftragstaktik (MIT, github.com/lerugray/auftragstaktik) and a curated Sandkasten supplement; see data/osint/ATTRIBUTION.md",
    sources: [
      {
        name: "Auftragstaktik",
        url: "https://github.com/lerugray/auftragstaktik",
        licence: "MIT (README; the repository carries no LICENSE file)",
        commit: AT_COMMIT,
        files: ["airDefense.ts", "radarSites.ts", "nuclearFacilities.ts", "militaryInstallations.ts"],
      },
      {
        name: "Sandkasten curated supplement",
        url: "data/osint/curated/hormuz-supplement.json",
        licence: "MIT (this repository); entries cite public sources",
      },
    ],
    counts: {
      ad: count("ad"),
      radar: count("radar"),
      nuclear: count("nuclear"),
      estimated: sites.filter((s) => s.estimated).length,
      platformMatches: sites.filter((s) => s.platform.status === "match").length,
      platformMisses: sites.filter((s) => s.platform.status === "miss" && s.layer !== "nuclear").length,
      installationsMerged: overlay.merged,
      installationsCreated: overlay.created.length,
    },
    dropped: dropNote,
  },
  sites,
};

facFile.facilities = overlay.facilities;
facFile.meta.osint = {
  generator: "scripts/import-osint.mjs",
  merged: overlay.merged,
  created: overlay.created,
  source: "Auftragstaktik (MIT) + curated supplement",
};
facFile.meta.counts.facilities = overlay.facilities.length;
facFile.meta.counts.naval_base = overlay.facilities.filter((f) => f.kind === "naval_base").length;
facFile.meta.counts.port = overlay.facilities.filter((f) => f.kind === "port").length;

writeFileSync(OUT, `${JSON.stringify(dataset, null, 1)}\n`);
writeFileSync(FAC, JSON.stringify(facFile));
console.log(
  `osint: ad=${count("ad")} radar=${count("radar")} nuclear=${count("nuclear")} estimated=${dataset.meta.counts.estimated}; facilities merged=${overlay.merged} created=${overlay.created.length}`,
);
