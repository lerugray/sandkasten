// Real-world snapshot -> Sandkasten scenario seed (pure, network-free).
//
// buildSnapshotScenario() turns a set of ADS-B aircraft (adsb.lol v2 shape) and AIS vessels into a Scenario.
// Used by scripts/snapshot-seed.mjs, the /api/snapshot route and the tests, so it must stay free of runtime
// imports (type-only imports are erased) and use erasable TypeScript only: Node runs this file directly
// via its built-in type stripping (no enums, namespaces or constructor parameter properties).
//
// ICAO TYPE -> PLATFORM TABLE (exact designator matches only, anything else becomes an UNKNOWN contact):
//   F18S -> 342 F/A-18E | F14 -> 264 F-14A (Iranian hex) / 896 F-14D | F4 -> 265 F-4E | E2 -> 2471 E-2C
//   P3 -> 466 P-3C | H60 -> 84 SH-60B.   F18H (legacy Hornet) is deliberately NOT mapped to the Super Hornet.
// A designator names a type family, not a variant (E2 covers E-2C and E-2D, H60 covers UH-/MH-/SH-60);
// every mapped unit is therefore an ESTIMATE of the airframe, and the unit name keeps the raw type code.
//
// UNKNOWN contact: Unit.unknown = true, platformId = UNKNOWN_AIR_PLATFORM_ID (9900), typeCode kept, side
// Neutral (military of non-aligned/unidentified states, and ordinary civil traffic when opted in). Neutral is in
// NON_COMBATANT_SIDES (types/game.ts), so it never starts or receives a fight. It is deliberately not "Civilian":
// the detection phase skips Civilian units entirely, and a snapshot contact should still be sensor-detectable.

import type { Scenario, SnapshotMeta, SnapshotSource, Unit } from "@/types/game";

/** Mirrors UNKNOWN_*_PLATFORM_ID in lib/platforms/lookup.ts (a unit test keeps them equal). */
export const UNKNOWN_AIR_ID = 9900;
export const UNKNOWN_SURFACE_ID = 9901;

/** Hormuz theater, same box as data/facilities/hormuz.json meta.bbox: [west, south, east, north]. */
export const HORMUZ_BBOX: BBox = [50, 22.5, 61, 30];

export type BBox = [number, number, number, number];

/** The fields of an adsb.lol v2 aircraft record that the seed reads. */
export interface AdsbAircraft {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  desc?: string;
  ownOp?: string;
  /** Feet, or the string "ground". */
  alt_baro?: number | string;
  /** Ground speed, knots. */
  gs?: number;
  track?: number;
  true_heading?: number;
  lat?: number;
  lon?: number;
  /** readsb database flags: bit 0 = military. */
  dbFlags?: number;
  category?: string;
  /** Set by the fetcher when the record came from /v2/mil. */
  fromMilEndpoint?: boolean;
}

/** An AIS vessel report (aisstream.io PositionReport shape, reduced). */
export interface AisVessel {
  mmsi: string;
  name?: string;
  lat: number;
  lon: number;
  /** Speed over ground, knots. */
  sog?: number;
  /** Course over ground, degrees. */
  cog?: number;
  shipType?: number;
}

export interface TypeMapping {
  platformId: number;
  /** Short label used in unit names. */
  label: string;
}

export const TYPE_TO_PLATFORM: Record<string, TypeMapping> = {
  F18S: { platformId: 342, label: "F/A-18E/F" },
  F14: { platformId: 896, label: "F-14" },
  F4: { platformId: 265, label: "F-4" },
  E2: { platformId: 2471, label: "E-2" },
  P3: { platformId: 466, label: "P-3" },
  H60: { platformId: 84, label: "H-60" },
};
/** Iranian F-14s are F-14As; every other F14 falls back to the F-14D record. */
const F14_IRAN_PLATFORM = 264;

/** ICAO type designators that mark an aircraft as military when the feed has no military flag. Exact match. */
export const MILITARY_TYPES: ReadonlySet<string> = new Set([
  "A10", "B1", "B2", "B52", "C130", "C30J", "C17", "C5M", "C295", "A400", "E2", "E3CF", "E3TF", "E6B", "E8",
  "F14", "F15", "F16", "F18H", "F18S", "F22", "F35", "F4", "EUFI", "RFAL", "TOR", "GRIF", "J39", "F5",
  "K35R", "K35T", "KC10", "KC30", "KC46", "R135", "RC135", "P3", "P8", "Q4", "Q9", "MQ9", "U2", "V22",
  "H60", "H47", "H64", "AH64", "CH47", "S70", "S92M", "B350M", "U28", "C2", "T38", "T6", "HAWK",
]);

/** Not aircraft: ADS-B ground-station/vehicle pseudo types. */
const NON_AIRCRAFT_TYPES: ReadonlySet<string> = new Set(["GND", "TWR", "GRND"]);

interface Country {
  code: string;
  name: string;
  from: number;
  to: number;
  /** "coalition" -> player side, "iran" -> Iran side, anything else -> Neutral. */
  bloc: "coalition" | "iran" | "other";
}

/**
 * ICAO 24-bit address blocks by state of registry (ICAO Annex 10 Vol III, Table 9-1). The block tells the
 * registering state only, not the operator or the flag the aircraft flies under: an estimate.
 */
export const COUNTRY_BLOCKS: readonly Country[] = [
  { code: "US", name: "United States", from: 0xa00000, to: 0xafffff, bloc: "coalition" },
  { code: "GB", name: "United Kingdom", from: 0x400000, to: 0x43ffff, bloc: "coalition" },
  { code: "FR", name: "France", from: 0x380000, to: 0x3bffff, bloc: "coalition" },
  { code: "DE", name: "Germany", from: 0x3c0000, to: 0x3fffff, bloc: "coalition" },
  { code: "IT", name: "Italy", from: 0x300000, to: 0x33ffff, bloc: "coalition" },
  { code: "NL", name: "Netherlands", from: 0x480000, to: 0x487fff, bloc: "coalition" },
  { code: "CA", name: "Canada", from: 0xc00000, to: 0xc3ffff, bloc: "coalition" },
  { code: "AU", name: "Australia", from: 0x7c0000, to: 0x7fffff, bloc: "coalition" },
  { code: "IR", name: "Iran", from: 0x730000, to: 0x737fff, bloc: "iran" },
  { code: "SA", name: "Saudi Arabia", from: 0x710000, to: 0x717fff, bloc: "other" },
  { code: "AE", name: "United Arab Emirates", from: 0x896000, to: 0x896fff, bloc: "other" },
  { code: "QA", name: "Qatar", from: 0x06a000, to: 0x06afff, bloc: "other" },
  { code: "BH", name: "Bahrain", from: 0x894000, to: 0x894fff, bloc: "other" },
  { code: "KW", name: "Kuwait", from: 0x706000, to: 0x706fff, bloc: "other" },
  { code: "OM", name: "Oman", from: 0x70c000, to: 0x70cfff, bloc: "other" },
  { code: "PK", name: "Pakistan", from: 0x760000, to: 0x767fff, bloc: "other" },
  { code: "IN", name: "India", from: 0x800000, to: 0x83ffff, bloc: "other" },
  { code: "TR", name: "Turkey", from: 0x4b8000, to: 0x4bffff, bloc: "other" },
  { code: "IL", name: "Israel", from: 0x738000, to: 0x73ffff, bloc: "other" },
  { code: "RU", name: "Russia", from: 0x140000, to: 0x15ffff, bloc: "other" },
  { code: "CN", name: "China", from: 0x780000, to: 0x7bffff, bloc: "other" },
];

export function countryOfHex(hex: string): Country | undefined {
  const n = parseInt(hex.replace(/^~/, ""), 16);
  if (!Number.isFinite(n)) return undefined;
  return COUNTRY_BLOCKS.find((c) => n >= c.from && n <= c.to);
}

export const SIDE_COALITION = "Coalition";
export const SIDE_IRAN = "Iran";
export const SIDE_NEUTRAL = "Neutral";

const MIL_MISSION = "Snapshot (military ADS-B)";
const CIVIL_MISSION = "Snapshot (civil ADS-B)";

export const AIS_SKIP_REASON = "AISStream requires an API key; no keyless AIS source covers this bbox";

/** The AIS source entry every snapshot carries (ships are never fetched; no key is read or stored). */
export function aisSkippedSource(): SnapshotSource {
  return {
    id: "aisstream",
    name: "AISStream (ships)",
    url: "https://aisstream.io/",
    terms: "Free tier but requires a personal API key; not used by this tool",
    rateLimit: "n/a (not requested)",
    fetchedAt: null,
    status: "skipped",
    reason: AIS_SKIP_REASON,
    counts: { vessels: 0 },
  };
}

export const ESTIMATE_LIMITATIONS: readonly string[] = [
  "ESTIMATED: positions, altitudes, speeds and headings are one ADS-B receiver-network snapshot (adsb.lol); aircraft with transponders off or no coverage are absent, and military aircraft often fly without broadcasting.",
  "ESTIMATED: side assignment uses the ICAO 24-bit address block (state of registry), not the operator or flag. Coalition = US, GB, FR, DE, IT, NL, CA, AU registry; Iran = Iranian registry; every other military aircraft is Neutral.",
  "ESTIMATED: platform mapping is by ICAO type designator only (a family, not a variant): E2 -> E-2C, H60 -> SH-60B, F14 -> F-14A/D. Aircraft with no exact match are UNKNOWN contacts (generic unarmed placeholder, Neutral side).",
  "Ships are not included: " + AIS_SKIP_REASON + ".",
  "Aircraft fly straight on their snapshot heading and speed; there is no flight-plan data, so they leave the theater.",
];

export interface BuildInput {
  aircraft: AdsbAircraft[];
  vessels?: AisVessel[];
  /** ISO UTC time of the fetch; becomes Scenario.startTime. */
  fetchedAt: string;
  sources: SnapshotSource[];
  bbox?: BBox;
  /** Also include non-military aircraft as Neutral unknown contacts (default false). */
  includeCivil?: boolean;
}

export function inBbox(lat: number, lon: number, b: BBox): boolean {
  return lat >= b[1] && lat <= b[3] && lon >= b[0] && lon <= b[2];
}

function hasPosition(a: AdsbAircraft): a is AdsbAircraft & { lat: number; lon: number } {
  return typeof a.lat === "number" && typeof a.lon === "number" && Number.isFinite(a.lat) && Number.isFinite(a.lon);
}

/** adsb.lol military flag, membership of the /v2/mil response, or an exact military ICAO type. */
export function isMilitaryAircraft(a: AdsbAircraft): boolean {
  if (a.fromMilEndpoint) return true;
  if (typeof a.dbFlags === "number" && (a.dbFlags & 1) === 1) return true;
  return !!a.t && MILITARY_TYPES.has(a.t.toUpperCase());
}

function isRealAircraft(a: AdsbAircraft): boolean {
  if (!a.hex) return false;
  const t = (a.t ?? "").toUpperCase();
  if (NON_AIRCRAFT_TYPES.has(t)) return false;
  // ADS-B emitter categories C1..C3 are surface vehicles / obstacles
  if (a.category && /^C[1-7]$/.test(a.category)) return false;
  return true;
}

function round(n: number, digits: number): number {
  const k = 10 ** digits;
  return Math.round(n * k) / k;
}

function altitudeFt(a: AdsbAircraft): number {
  const v = a.alt_baro;
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.round(v));
  return 0; // "ground" or missing
}

function headingDeg(a: AdsbAircraft): number {
  const h = typeof a.track === "number" ? a.track : typeof a.true_heading === "number" ? a.true_heading : 0;
  return Math.round(((h % 360) + 360) % 360) % 360;
}

function platformFor(typeCode: string | undefined, countryCode: string | undefined): TypeMapping | undefined {
  const t = (typeCode ?? "").toUpperCase();
  const m = TYPE_TO_PLATFORM[t];
  if (!m) return undefined;
  if (t === "F14" && countryCode === "IR") return { platformId: F14_IRAN_PLATFORM, label: "F-14A" };
  return m;
}

/** Only an aircraft whose type is in the platform DB can belong to a bloc; an UNKNOWN military contact stays Neutral. */
function sideFor(mil: boolean, country: Country | undefined, mapped: boolean): string {
  if (!mil || !mapped) return SIDE_NEUTRAL;
  if (country?.bloc === "coalition") return SIDE_COALITION;
  if (country?.bloc === "iran") return SIDE_IRAN;
  return SIDE_NEUTRAL;
}

function aircraftUnit(a: AdsbAircraft & { lat: number; lon: number }, mil: boolean): Unit {
  const country = countryOfHex(a.hex);
  const typeCode = a.t ? a.t.toUpperCase() : undefined;
  const mapped = mil ? platformFor(typeCode, country?.code) : undefined;
  const ident = (a.flight ?? "").trim() || a.r || a.hex.toUpperCase();
  const cc = country ? ` ${country.code}` : "";
  const unit: Unit = {
    id: `adsb-${a.hex.replace(/^~/, "t").toLowerCase()}`,
    name: mapped ? `${ident} (${mapped.label}${cc})` : `${ident} [${typeCode ?? "UNK"}${cc}]`,
    platformId: mapped ? mapped.platformId : UNKNOWN_AIR_ID,
    side: sideFor(mil, country, !!mapped),
    position: { lng: round(a.lon, 5), lat: round(a.lat, 5) },
    heading: headingDeg(a),
    speed: Math.max(0, Math.round(a.gs ?? 0)),
    altitude: altitudeFt(a),
    damageState: "undamaged",
    mission: mil ? MIL_MISSION : CIVIL_MISSION,
  };
  if (typeCode) unit.typeCode = typeCode;
  if (!mapped) unit.unknown = true;
  return unit;
}

function vesselUnit(v: AisVessel): Unit {
  return {
    id: `ais-${v.mmsi}`,
    name: `${(v.name ?? "").trim() || v.mmsi} [AIS]`,
    platformId: UNKNOWN_SURFACE_ID,
    side: SIDE_NEUTRAL,
    position: { lng: round(v.lon, 5), lat: round(v.lat, 5) },
    heading: Math.round(((v.cog ?? 0) % 360 + 360) % 360) % 360,
    speed: Math.max(0, Math.round(v.sog ?? 0)),
    damageState: "undamaged",
    mission: "Snapshot (AIS)",
    unknown: true,
    ...(v.shipType !== undefined ? { typeCode: `AIS${v.shipType}` } : {}),
  };
}

/** The side the player takes: the first bloc that has aircraft, so the snapshot's traffic is in the player's own picture. */
export function playerSideFor(units: Unit[]): string {
  return [SIDE_COALITION, SIDE_IRAN, SIDE_NEUTRAL].find((n) => units.some((u) => u.side === n)) ?? SIDE_NEUTRAL;
}

/** The plain-language opening of the briefing: what this is and what the player can do. */
export function snapshotIntro(units: Unit[], fetchedAt: string): string {
  const civil = units.filter((u) => u.mission === CIVIL_MISSION).length;
  return (
    `A real snapshot of the air over the Strait of Hormuz, as the public ADS-B network saw it on ${dateInWords(fetchedAt)}. ` +
    `${units.length} aircraft are on the map${civil ? `, ${civil} of them civil airliners and cargo flights` : ""}. ` +
    `You are the observer: every aircraft is listed under FORCES, click one to see its call sign, type, heading and altitude, ` +
    `and speed up time to watch the traffic move. The AD, RADAR and NUC buttons show the air-defence and radar sites around the strait. ` +
    `Nothing here shoots: all sides start weapons-hold and there is nothing to win or lose. `
  );
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "6 November 2026, 19:02 UTC" from an ISO instant. */
export function dateInWords(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

function describeSources(sources: SnapshotSource[]): string {
  return sources
    .map((s) => {
      const n = s.counts
        ? " (" + Object.entries(s.counts).map(([k, v]) => `${k} ${v}`).join(", ") + ")"
        : "";
      return `${s.name}: ${s.status.toUpperCase()}${s.reason ? ` - ${s.reason}` : ""}${n}`;
    })
    .join("; ");
}

function briefSources(sources: SnapshotSource[]): string {
  return sources
    .map((s) => `${s.name.split(" (")[0].split(" /v2/")[0]}${s.name.includes("/v2/") ? " " + s.name.match(/\/v2\/\w+/)![0] : ""} ${s.status.toUpperCase()}${s.status === "used" ? "" : ` (${s.reason ?? ""})`}`)
    .join("; ");
}

/**
 * Build the scenario. Pure and deterministic: the same input gives the same output (units sorted by id,
 * duplicates by hex dropped, nothing reads the clock). `facilities` is not embedded; the app attaches
 * hormuzFacilities when it opens the scenario.
 */
export function buildSnapshotScenario(input: BuildInput): Scenario {
  const bbox = input.bbox ?? HORMUZ_BBOX;
  const includeCivil = input.includeCivil === true;

  const sources = input.sources.some((s) => s.id === "aisstream")
    ? input.sources
    : [...input.sources, aisSkippedSource()];

  const seen = new Set<string>();
  const units: Unit[] = [];
  let civilSkipped = 0;
  for (const a of [...input.aircraft].sort((x, y) => (x.hex < y.hex ? -1 : x.hex > y.hex ? 1 : 0))) {
    if (!hasPosition(a) || !isRealAircraft(a) || !inBbox(a.lat, a.lon, bbox)) continue;
    const key = a.hex.toLowerCase();
    if (seen.has(key)) continue;
    const mil = isMilitaryAircraft(a);
    if (!mil && !includeCivil) {
      civilSkipped += 1;
      continue;
    }
    seen.add(key);
    units.push(aircraftUnit(a, mil));
  }
  for (const v of [...(input.vessels ?? [])].sort((x, y) => (x.mmsi < y.mmsi ? -1 : x.mmsi > y.mmsi ? 1 : 0))) {
    if (!inBbox(v.lat, v.lon, bbox) || seen.has(`ais-${v.mmsi}`)) continue;
    seen.add(`ais-${v.mmsi}`);
    units.push(vesselUnit(v));
  }
  units.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

  const mappedByType: Record<string, number> = {};
  const bySide: Record<string, number> = {};
  let unknownContacts = 0;
  for (const u of units) {
    bySide[u.side] = (bySide[u.side] ?? 0) + 1;
    if (u.unknown) unknownContacts += 1;
    else mappedByType[u.typeCode ?? "?"] = (mappedByType[u.typeCode ?? "?"] ?? 0) + 1;
  }
  const sortedMapped = Object.fromEntries(Object.entries(mappedByType).sort(([a], [b]) => (a < b ? -1 : 1)));
  const sortedSides = Object.fromEntries(Object.entries(bySide).sort(([a], [b]) => (a < b ? -1 : 1)));

  const limitations = [...ESTIMATE_LIMITATIONS];
  const milCount = units.filter((u) => u.mission === MIL_MISSION).length;
  if (milCount === 0) limitations.push("No military aircraft were visible on ADS-B inside the box at fetch time (none is not the same as none flying).");
  if (includeCivil) limitations.push(`Civil aircraft are included as Neutral UNKNOWN contacts (${units.filter((u) => u.mission === CIVIL_MISSION).length}); they carry the real transponder type code but no platform record.`);
  else limitations.push(`Civil aircraft in the box (${civilSkipped}) are not included (military-relevant aircraft only).`);

  const snapshot: SnapshotMeta = {
    schema: 1,
    kind: "adsb-snapshot",
    fetchedAt: input.fetchedAt,
    bbox,
    sources,
    limitations,
    counts: { units: units.length, mappedByType: sortedMapped, unknownContacts, bySide: sortedSides },
  };

  const mappedTotal = units.length - unknownContacts;
  const summary =
    `${units.length} contacts: ${mappedTotal} mapped to platform-DB types, ${unknownContacts} UNKNOWN. ` +
    `Sides ${Object.entries(sortedSides).map(([k, v]) => `${k} ${v}`).join(", ") || "(none)"}.`;
  const fetchedLabel = input.fetchedAt.replace("T", " ").replace(/:\d\dZ$/, "Z");

  const played = playerSideFor(units);
  const when = dateInWords(input.fetchedAt);
  const intro = snapshotIntro(units, input.fetchedAt);
  return {
    name: `Hormuz air traffic, ${when}`,
    description:
      `REAL-WORLD SNAPSHOT of the Strait of Hormuz airspace fetched ${input.fetchedAt} from public ADS-B data. ` +
      `${summary} Sources: ${describeSources(sources)}.`,
    briefing:
      intro +
      `REAL snapshot taken ${fetchedLabel} (UTC) from public ADS-B data (adsb.lol, ODbL). ${summary} ` +
      `Aircraft start where the network saw them, on their reported heading, speed and altitude. ` +
      `UNKNOWN contacts (type not in the platform database) are unarmed Neutral traffic and take no part in combat; all sides start weapons-hold. ` +
      `Sources: ${briefSources(sources)}. ` +
      `ESTIMATED: positions are one receiver-network snapshot; sides come from the ICAO address block (state of registry), not the operator; ` +
      `types are matched by ICAO designator only (a family, not a variant); aircraft hold course and speed, no flight plans. ` +
      `Ships are not included. Full limitations and counts are in the scenario's snapshot block.`,
    theater: {
      center: { lng: round((bbox[0] + bbox[2]) / 2, 4), lat: round((bbox[1] + bbox[3]) / 2, 4) },
      zoom: 6,
      bounds: bbox,
    },
    startTime: input.fetchedAt,
    playerSide: played,
    sides: [
      { name: SIDE_COALITION, color: "#00aaff", isAI: played !== SIDE_COALITION, units: units.filter((u) => u.side === SIDE_COALITION) },
      { name: SIDE_IRAN, color: "#ff4444", isAI: played !== SIDE_IRAN, units: units.filter((u) => u.side === SIDE_IRAN) },
      { name: SIDE_NEUTRAL, color: "#9aa0a6", isAI: played !== SIDE_NEUTRAL, units: units.filter((u) => u.side === SIDE_NEUTRAL) },
    ],
    referencePoints: [],
    snapshot,
  };
}
