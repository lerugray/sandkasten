// Pure helpers for the OSINT import (no network, no fs writes): Auftragstaktik records -> Sandkasten OSINT sites,
// merge with the curated supplement, platform-DB matching, and the facility overlay.
import { haversineM } from "./facilities.mjs";

export const AT_COMMIT = "7c5904e30d89fa34ec31181c62d7073f4074a778";

// Published maximum engagement ranges (km), as in Auftragstaktik's SYSTEM_RANGES plus public figures for the supplement.
export const SYSTEM_RANGES = {
  "S-400 Triumf": 400,
  "S-300PM": 200,
  "S-300PMU-2": 200,
  "MIM-104 Patriot": 160,
  NASAMS: 40,
  "IRIS-T SLM": 40,
  "Iron Dome": 70,
  "David's Sling": 300,
  THAAD: 200,
  "Tor-M1": 12,
  "3rd Khordad": 75,
};

// OSINT system -> regex over a platform record's weapon (AD) or sensor (radar) names.
export const PLATFORM_ALIASES = {
  "S-300PMU-2": /S-300|48N6/i,
  "S-300PM": /S-300|48N6/i,
  "MIM-104 Patriot": /Patriot|MIM-104/i,
  THAAD: /THAAD/i,
  "Tor-M1": /\bTor\b/i,
  "3rd Khordad": /Khordad/i,
  "AN/TPY-2": /TPY-2/i,
  "Khalij Fars": /Khalij/i,
};

export function inBbox(p, bbox) {
  return p.lat >= bbox.south && p.lat <= bbox.north && p.lng >= bbox.west && p.lng <= bbox.east;
}

export function affiliationFor(operator) {
  const o = operator.toLowerCase();
  if (o.includes("iran")) return "iran";
  const us = /united states|\bus\b|usn|usaf/.test(o);
  const gulf = /saudi|uae|qatar|bahrain|kuwait/.test(o);
  if (us && gulf) return "us-gulf";
  if (us) return "us";
  if (gulf) return "gulf";
  return "neutral";
}

const atCite = (file, id) => ({
  label: `Auftragstaktik (MIT) src/lib/data/${file}.ts @ ${AT_COMMIT.slice(0, 7)}, record ${id}`,
  url: "https://github.com/lerugray/auftragstaktik",
});

export function adFromAuftragstaktik(r) {
  return {
    id: `ad-${r.id}`,
    layer: "ad",
    system: r.system,
    kind: "sam",
    name: `${r.system}, ${r.location}`,
    operator: r.operator,
    affiliation: affiliationFor(r.operator),
    position: { lat: r.lat, lng: r.lng },
    positionBasis: "source-coordinates",
    rangeKm: r.rangeKm,
    rangeKind: "engagement",
    status: r.status,
    lastConfirmed: r.lastConfirmed,
    source: r.source,
    citations: [atCite("airDefense", r.id)],
    origin: "auftragstaktik",
    originId: r.id,
  };
}

export function radarFromAuftragstaktik(r) {
  return {
    id: `radar-${r.id}`,
    layer: "radar",
    system: r.system,
    kind: r.radarType,
    name: `${r.system}, ${r.location}`,
    operator: r.operator,
    affiliation: affiliationFor(r.operator),
    position: { lat: r.lat, lng: r.lng },
    positionBasis: "source-coordinates",
    rangeKm: r.detectionRangeKm,
    rangeKind: "detection",
    ...(r.trackingRangeKm ? { trackingRangeKm: r.trackingRangeKm } : {}),
    status: r.status,
    lastConfirmed: r.lastConfirmed,
    source: r.source,
    citations: [atCite("radarSites", r.id)],
    origin: "auftragstaktik",
    originId: r.id,
  };
}

export function nuclearFromAuftragstaktik(r) {
  return {
    id: `nuc-${r.id}`,
    layer: "nuclear",
    system: r.facilityType,
    kind: r.facilityType,
    name: r.name,
    operator: r.operator,
    affiliation: affiliationFor(r.operator),
    position: { lat: r.lat, lng: r.lng },
    positionBasis: "source-coordinates",
    rangeKm: r.exclusionZoneKm ?? 0,
    rangeKind: "exclusion",
    status: r.status,
    source: r.source,
    citations: [atCite("nuclearFacilities", r.id)],
    origin: "auftragstaktik",
    originId: r.id,
    notes: r.description,
  };
}

/** Same system, same operator, within 5 km: one real site. The first record wins, later citations are folded in. */
export function dedupeSites(sites) {
  const out = [];
  for (const s of sites) {
    const dup = out.find(
      (o) =>
        o.id === s.id ||
        (o.layer === s.layer &&
          o.system === s.system &&
          o.affiliation === s.affiliation &&
          haversineM(o.position, s.position) < 5000),
    );
    if (dup) {
      for (const c of s.citations) if (!dup.citations.some((x) => x.label === c.label)) dup.citations.push(c);
      continue;
    }
    out.push(s);
  }
  return out;
}

/** Resolve a curated site: anchor to a facility or an Auftragstaktik nuclear record, fill range from the table when absent. */
export function curatedSite(c, facilitiesById, nuclearById) {
  let position;
  let facilityId;
  if (c.facilityId) {
    const f = facilitiesById.get(c.facilityId);
    if (!f) throw new Error(`curated site ${c.id}: unknown facility ${c.facilityId}`);
    position = { ...f.position };
    facilityId = f.id;
  } else if (c.anchor?.nuclearId) {
    const n = nuclearById.get(c.anchor.nuclearId);
    if (!n) throw new Error(`curated site ${c.id}: unknown nuclear record ${c.anchor.nuclearId}`);
    position = { lat: n.lat, lng: n.lng };
  } else if (c.position) {
    position = c.position;
  } else throw new Error(`curated site ${c.id}: no position`);
  const rangeKm = c.rangeKm ?? SYSTEM_RANGES[c.system];
  if (!(rangeKm > 0)) throw new Error(`curated site ${c.id}: no range`);
  const { anchor: _anchor, facilityId: _f, position: _p, ...rest } = c;
  return {
    ...rest,
    position,
    ...(facilityId ? { facilityId } : {}),
    positionBasis: facilityId || c.anchor ? "facility-anchor" : "source-coordinates",
    rangeKm,
    origin: "curated",
  };
}

/** Match one site against the platform records (weapon names for AD, sensor names for radar). */
export function matchPlatform(site, records) {
  const alias = PLATFORM_ALIASES[site.system];
  if (alias && site.layer !== "nuclear") {
    for (const rec of records) {
      const names = site.layer === "ad" ? (rec.weapons ?? []).filter((w) => w.type === "sam") : (rec.sensors ?? []);
      const hit = names.find((x) => alias.test(x.name ?? ""));
      if (hit) {
        const platformId = rec.legacyIds?.[0] ?? rec.engineId;
        return {
          status: "match",
          platformId,
          platformName: rec.engineName ?? rec.name,
          dbRangeKm: hit.rangeKm,
          note: `Platform DB record "${rec.engineName ?? rec.name}" carries ${hit.name}`,
        };
      }
    }
  }
  return {
    status: "miss",
    note:
      site.layer === "nuclear"
        ? "Not a platform: exclusion radius from the source record"
        : `No platform DB record carries ${site.system}; the OSINT range is used as published`,
  };
}

export function applyPlatformMatches(sites, records) {
  return sites.map((s) => {
    const m = matchPlatform(s, records);
    const { dbRangeKm, ...platform } = m;
    const out = { ...s, platform };
    if (s.layer === "nuclear") out.estimated = false;
    else if (m.status === "match") {
      out.estimated = false;
      if (dbRangeKm > 0) {
        out.notes = `${s.notes ? `${s.notes} ` : ""}OSINT range ${s.rangeKm} km replaced by the platform DB value.`;
        out.rangeKm = dbRangeKm;
      }
    } else out.estimated = true;
    return out;
  });
}

const FACILITY_FUNCTION = {
  airbase: "Military airbase",
  "naval-base": "Naval base",
  infrastructure: "Strategic infrastructure",
  hq: "Headquarters",
  logistics: "Logistics hub",
};

/**
 * Overlay OSINT fields on the facility list: one record per real place.
 * Idempotent: earlier OSINT fields and OSINT-created facilities are dropped first.
 */
export function overlayFacilities(facilities, { installations, atInstallations, curatedInstallations }) {
  const base = facilities.filter((f) => !f.id.startsWith("osint-")).map(({ osint: _o, ...rest }) => rest);
  const byId = new Map(base.map((f) => [f.id, f]));
  const dropped = [];
  const created = [];
  let merged = 0;

  for (const [id, spec] of Object.entries(atInstallations.map)) {
    const r = installations.find((i) => i.id === id);
    if (!r) continue;
    const osint = {
      affiliation: spec.affiliation ?? affiliationFor(r.operator),
      function: `${FACILITY_FUNCTION[r.type] ?? r.type} (${r.operator})`,
      notes: r.description,
      source: r.source,
      citations: [atCite("militaryInstallations", id)],
      origin: "auftragstaktik",
      originId: id,
    };
    if (spec.facilityId) {
      const f = byId.get(spec.facilityId);
      if (!f) throw new Error(`installation ${id}: unknown facility ${spec.facilityId}`);
      f.osint = osint;
      f.isMilitary = true;
      merged++;
    } else if (spec.create) {
      const f = {
        id: spec.create.id,
        name: spec.create.name,
        nameLocal: null,
        kind: spec.create.kind,
        isMilitary: true,
        position: { lat: r.lat, lng: r.lng },
        polygon: null,
        areaM2: null,
        sources: [{ source: "auftragstaktik", id }],
        osint,
      };
      base.push(f);
      byId.set(f.id, f);
      created.push(f.id);
    }
  }
  for (const [id, why] of Object.entries(atInstallations.dropped)) dropped.push({ id, reason: why });

  for (const [fid, c] of Object.entries(curatedInstallations)) {
    const f = byId.get(fid);
    if (!f) throw new Error(`curated installation: unknown facility ${fid}`);
    if (f.osint) throw new Error(`curated installation ${fid} duplicates an Auftragstaktik overlay`);
    f.osint = { ...c, origin: "curated" };
    merged++;
  }
  return { facilities: base, created, merged, dropped };
}
