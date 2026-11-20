import type { BattleDimension } from "../symbols/milsymbolFactory";
import { PLATFORM_RECORDS } from "@/data/platforms";
import type { PlatformRecord } from "@/types/platformDb";

// Lightweight platform info for rendering — full data stays in JSON files
export interface PlatformInfo {
  id: number;
  name: string;
  dimension: BattleDimension;
  functionId: string;
  sensorRangeKm?: number;
  weaponRangeKm?: number;
  // Combat-relevant data
  damagePoints?: number;
  missileDefense?: number; // engagement-channel count; sizes the engine's anti-missile salvos (2 x value, capped at 8)
  weapons?: PlatformWeapon[];
  defenses?: PlatformDefense[];
}

export interface PlatformWeapon {
  name: string;
  type: "asm" | "sam" | "gun" | "torpedo" | "aam";
  rangeKm: number;
  speedKts: number; // weapon flight speed
  pkAir: number; // 0-100
  pkSurface: number;
  quantity: number;
  warheadDamage: number; // damage points inflicted on hit
  seekerType?: "active-radar" | "semi-active" | "ir" | "anti-radiation";
}

export interface PlatformDefense {
  name: string;
  type: "chaff" | "ecm" | "ciws" | "decoy";
  effectiveness: number; // 0-1 probability of defeating incoming
  quantity?: number; // expendable count, undefined = unlimited
}

// PlatformInfo is derived from the first-party records in src/data/platforms/.
// Every engine number is re-derived from public facts by the formulas in METHODS.md (lane s463).
// Aircraft keep the engine's historical shape: no missileDefense, and weapons or
// defenses stay undefined when the record carries none.
export function toPlatformInfo(record: PlatformRecord): PlatformInfo {
  const isAir = record.dimension === "air";
  const id = record.engineId;
  if (id === undefined) throw new Error(`Platform record ${record.slug} has no engine id`);
  return {
    id,
    name: record.engineName,
    dimension: record.dimension,
    functionId: record.functionId,
    sensorRangeKm: record.sensorRangeKm,
    weaponRangeKm: record.weaponRangeKm > 0 ? record.weaponRangeKm : undefined,
    damagePoints: record.damagePoints,
    missileDefense: isAir ? undefined : record.missileDefense,
    weapons: record.weapons.length > 0 ? record.weapons.map(toEngineWeapon) : undefined,
    defenses:
      record.defenses.length > 0 || !isAir ? record.defenses.map(toEngineDefense) : undefined,
  };
}

function toEngineWeapon(w: PlatformRecord["weapons"][number]): PlatformWeapon {
  return {
    name: w.name,
    type: w.type,
    rangeKm: w.rangeKm,
    speedKts: w.speedKts,
    pkAir: w.pkAir,
    pkSurface: w.pkSurface,
    quantity: w.quantity,
    warheadDamage: w.warheadDamage,
    ...(w.seekerType ? { seekerType: w.seekerType } : {}),
  };
}

function toEngineDefense(d: PlatformRecord["defenses"][number]): PlatformDefense {
  return {
    name: d.name,
    type: d.type,
    effectiveness: d.effectiveness,
    ...(d.quantity !== undefined ? { quantity: d.quantity } : {}),
  };
}

const RECORD_PLATFORMS: PlatformInfo[] = PLATFORM_RECORDS.map(toPlatformInfo);

// Engine profiles from the sim-fix lane (s402) that the records do not carry yet: the retired-ship
// swaps (Chosin 10017 and Cole 10018 have no record; Nitze 10004 overrides the Flight IIA record),
// the Boghammar craft (10014, no missile-defense channels), and the Nimitz RAM fit (10001).
// A profile replaces the record-derived entry with the same id. All engine numbers follow the
// METHODS.md formulas over the public facts cited per profile. Folding these into
// src/data/platforms/records/ is a follow-up.
const SIMFIX_PROFILES: PlatformInfo[] = [
  // USS Cole DDG-67 is an Arleigh Burke Flight I destroyer, in active service, homeport Norfolk (90 Mk 41 VLS cells,
  // 1x Mk 45 5"/54, 2x Phalanx). Sources: https://www.history.navy.mil/browse-by-topic/ships/modern-ships/uss-cole.html
  // and https://en.wikipedia.org/wiki/USS_Cole_(DDG-67). Flight I full-load displacement 8,400 t and the
  // 2x Phalanx / 3x SPG-62 fit: https://en.wikipedia.org/wiki/Arleigh_Burke-class_destroyer.
  // Hull points 10 x sqrt(8400) = 917; channels 3 directors + 2 CIWS = 5. Weapon rows follow the Flight II
  // record's re-derived values (same class fit); the SM-2 count is a typical mix, not a certified Cole load.
  {
    id: 10018, name: "DDG 67 Cole [Arleigh Burke Flight I]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 370, weaponRangeKm: 167, damagePoints: 917, missileDefense: 5,
    weapons: [
      { name: "RIM-66M SM-2MR", type: "sam", rangeKm: 167, speedKts: 2316, pkAir: 75, pkSurface: 60, quantity: 50, warheadDamage: 100, seekerType: "semi-active" },
      { name: "RGM-84 Harpoon", type: "asm", rangeKm: 124, speedKts: 467, pkAir: 0, pkSurface: 90, quantity: 8, warheadDamage: 170, seekerType: "active-radar" },
      { name: "Mk 15 Phalanx CIWS", type: "gun", rangeKm: 1.5, speedKts: 0, pkAir: 50, pkSurface: 30, quantity: 1550, warheadDamage: 5 },
    ],
    defenses: [
      { name: "Mk 36 SRBOC Chaff", type: "chaff", effectiveness: 0.3, quantity: 24 },
      { name: "AN/SLQ-32(V)3 ECM", type: "ecm", effectiveness: 0.25 },
      { name: "Mk 15 Phalanx", type: "ciws", effectiveness: 0.5 },
      { name: "AN/SLQ-25 Nixie", type: "decoy", effectiveness: 0.2 },
    ],
  },
  // USS Chosin CG-65 (Ticonderoga-class, Mk 41 VLS, 122 cells) replaces USS Bunker Hill CG-52 (decommissioned 22 Sep 2023,
  // https://www.navy.mil/Press-Office/News-Stories/display-news/Article/3536575/uss-bunker-hill-decommissions/).
  // Chosin is in active service (homeport San Diego, service life extended): https://en.wikipedia.org/wiki/USS_Chosin
  // and was the air-defense-commander cruiser of Carrier Strike Group 9 (USNI Fleet Tracker, 2026-09-28):
  // https://news.usni.org/2026/09/28/usni-news-fleet-and-marine-tracker-sept-28-2026
  // Baseline number deliberately not claimed. Engine numbers are the Ticonderoga record's re-derived values
  // (9,600 t full load -> 980 hull points; 3 SPG-62 directors + 2 Phalanx = 5 channels); the SM-2 count is a
  // typical mix, not a published load.
  {
    id: 10017, name: "CG 65 Chosin [Ticonderoga, Mk 41 VLS]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 463, weaponRangeKm: 167, damagePoints: 980, missileDefense: 5,
    weapons: [
      { name: "RIM-66M SM-2MR", type: "sam", rangeKm: 167, speedKts: 2316, pkAir: 75, pkSurface: 60, quantity: 80, warheadDamage: 100, seekerType: "semi-active" },
      { name: "RGM-84 Harpoon", type: "asm", rangeKm: 124, speedKts: 467, pkAir: 0, pkSurface: 90, quantity: 8, warheadDamage: 170, seekerType: "active-radar" },
      { name: "Mk 15 Phalanx CIWS", type: "gun", rangeKm: 1.5, speedKts: 0, pkAir: 50, pkSurface: 30, quantity: 1550, warheadDamage: 5 },
    ],
    defenses: [
      { name: "Mk 36 SRBOC Chaff", type: "chaff", effectiveness: 0.3, quantity: 24 },
      { name: "AN/SLQ-32(V)3 ECM", type: "ecm", effectiveness: 0.25 },
      { name: "Mk 15 Phalanx", type: "ciws", effectiveness: 0.5 },
      { name: "AN/SLQ-25 Nixie", type: "decoy", effectiveness: 0.2 },
    ],
  },
  // Nimitz profile: the record carries the 1998 fit (Sea Sparrow + Phalanx); this profile adds the RAM
  // capability the ship carries today. RIM-116 RAM: modern Nimitz-class capability absent from the 1998 fit.
  // Official imagery: https://www.navy.mil/Resources/Photo-Gallery/igphoto/2002400143/ and
  // https://www.dvidshub.net/image/8679626/nimitz-launches-rolling-airframe-missile-during-live-fire-exercise
  // Sources establish the capability only; the 21-round launcher count is a model assumption, not a certified
  // March 2026 magazine. RAM figures: 9 km range, 11.3 kg warhead, >Mach 2 (2,500 km/h -> 1,350 kts),
  // https://en.wikipedia.org/wiki/RIM-116_RAM. Hull points 10 x sqrt(97000) = 3114; channels 2 Sea Sparrow
  // directors + 3 Phalanx + 1 autonomous RAM launcher = 6. Sea Sparrow and Phalanx rows are the record's
  // re-derived values.
  {
    id: 10001, name: "CVN 68 Nimitz [1998]", dimension: "sea", functionId: "CV",
    sensorRangeKm: 463, weaponRangeKm: 19, damagePoints: 3114, missileDefense: 6,
    weapons: [
      { name: "RIM-7 Sea Sparrow", type: "sam", rangeKm: 19, speedKts: 2298, pkAir: 70, pkSurface: 0, quantity: 16, warheadDamage: 41, seekerType: "semi-active" },
      { name: "RIM-116 RAM", type: "sam", rangeKm: 9, speedKts: 1350, pkAir: 70, pkSurface: 0, quantity: 21, warheadDamage: 11, seekerType: "ir" },
      { name: "Mk 15 Phalanx CIWS", type: "gun", rangeKm: 1.5, speedKts: 0, pkAir: 50, pkSurface: 30, quantity: 1550, warheadDamage: 5 },
    ],
    defenses: [
      { name: "Mk 36 SRBOC Chaff", type: "chaff", effectiveness: 0.3, quantity: 48 },
      { name: "AN/SLQ-32(V)4 ECM", type: "ecm", effectiveness: 0.3 },
      { name: "Mk 15 Phalanx x3", type: "ciws", effectiveness: 0.65 },
      { name: "AN/SLQ-25 Nixie", type: "decoy", effectiveness: 0.2 },
    ],
  },
  // USS Nitze DDG-94 (Arleigh Burke Flight IIA, 96 Mk 41 VLS cells, 1x Mk 45 5"/62, 1x Phalanx, 2x MH-60R, commissioned 2005,
  // homeport Norfolk, in active service) replaces USS Taylor FFG-50 (decommissioned 8 May 2015,
  // https://www.dvidshub.net/news/162764/uss-taylor-ffg-50-decommissions). The Perry-class SM-1MR profile was removed;
  // there are no Perry-class frigates left in US service. Source: https://en.wikipedia.org/wiki/USS_Nitze
  // (Nitze's actual March 2026 location/tasking is not established; this is a plausible-role substitution.)
  // Engine numbers are the Flight IIA record's re-derived values (9,200 t -> 959 hull points; 3 SPG-62 + 1 Phalanx
  // = 4 channels); the Harpoon count of 8 is a scenario assumption, not a documented DDG-94 fit.
  {
    id: 10004, name: "DDG 94 Nitze [Arleigh Burke Flight IIA]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 370, weaponRangeKm: 167, damagePoints: 959, missileDefense: 4,
    weapons: [
      { name: "RIM-66M SM-2MR", type: "sam", rangeKm: 167, speedKts: 2316, pkAir: 75, pkSurface: 60, quantity: 56, warheadDamage: 100, seekerType: "semi-active" },
      { name: "RGM-84 Harpoon", type: "asm", rangeKm: 124, speedKts: 467, pkAir: 0, pkSurface: 90, quantity: 8, warheadDamage: 170, seekerType: "active-radar" },
      { name: "Mk 15 Phalanx CIWS", type: "gun", rangeKm: 1.5, speedKts: 0, pkAir: 50, pkSurface: 30, quantity: 1550, warheadDamage: 5 },
    ],
    defenses: [
      { name: "Mk 36 SRBOC Chaff", type: "chaff", effectiveness: 0.3, quantity: 24 },
      { name: "AN/SLQ-32(V)3 ECM", type: "ecm", effectiveness: 0.25 },
      { name: "Mk 15 Phalanx", type: "ciws", effectiveness: 0.5 },
      { name: "AN/SLQ-25 Nixie", type: "decoy", effectiveness: 0.2 },
    ],
  },
  // Boghammar: Swedish-built (Boghammar Marin AB) RL-118/RL-130 inshore patrol craft bought by Iran in 1983, used by IRGCN
  // (called Taregh in Iran). ONI distinguishes Boghammar inshore patrol craft from Houdong missile craft (p.34 of
  // https://www.oni.navy.mil/Portals/12/Intel%20agencies/iran/Iran%20022217SP.pdf?ver=2017-02-28-082634-643).
  // Typical armament per public sources: 12.7mm DShK machine gun, 107mm 12-tube MRL (Fadjr-1 rockets), sometimes RPG/recoilless rifle:
  // https://www.globalsecurity.org/military/world/iran/boghammar.htm ,
  // https://admiraltytrilogy.com/scensupp/H002_OriginsHcon2021_IRGCN_Small_Boats_Briefing.pdf
  // NO anti-ship missiles and no missile-defense channels (missileDefense stays undefined). The record's re-derived
  // rows are used; the 107mm MRL is modeled as type "gun" because PlatformWeapon has no rocket type.
  {
    id: 10014, name: "Boghammar [IRGCN inshore patrol craft]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 12, weaponRangeKm: 8, damagePoints: 25,
    weapons: [
      { name: "12.7mm DShK MG", type: "gun", rangeKm: 2, speedKts: 0, pkAir: 5, pkSurface: 25, quantity: 500, warheadDamage: 2 },
      { name: "107mm MRL (Fadjr-1 rockets)", type: "gun", rangeKm: 8, speedKts: 0, pkAir: 0, pkSurface: 15, quantity: 12, warheadDamage: 5 },
    ],
    defenses: [],
  },
];

const simfixById = new Map(SIMFIX_PROFILES.map((p) => [p.id, p]));
const recordIds = new Set(RECORD_PLATFORMS.map((p) => p.id));
const PLATFORMS: PlatformInfo[] = [
  ...RECORD_PLATFORMS.map((p) => simfixById.get(p.id) ?? p),
  ...SIMFIX_PROFILES.filter((p) => !recordIds.has(p.id)),
];

const platformMap = new Map<number, PlatformInfo>();
PLATFORMS.forEach((p) => platformMap.set(p.id, p));

// Placeholder profiles for real-world snapshot contacts whose type is not in the platform DB (see
// lib/snapshot/seed.ts). They are engine-side only: not in PLATFORMS (so not offered by the editor's
// unit picker or getAllPlatforms()), unarmed, no sensor range (detection falls back to its default).
// The unit stays on the Neutral/Civilian side, which isHostileSide() keeps out of combat.
export const UNKNOWN_AIR_PLATFORM_ID = 9900;
export const UNKNOWN_SURFACE_PLATFORM_ID = 9901;
platformMap.set(UNKNOWN_AIR_PLATFORM_ID, {
  id: UNKNOWN_AIR_PLATFORM_ID, name: "Unknown aircraft [snapshot contact]", dimension: "air", functionId: "MF", damagePoints: 50,
});
platformMap.set(UNKNOWN_SURFACE_PLATFORM_ID, {
  id: UNKNOWN_SURFACE_PLATFORM_ID, name: "Unknown vessel [snapshot contact]", dimension: "sea", functionId: "XM", damagePoints: 100,
});

export function getPlatform(id: number): PlatformInfo | undefined {
  return platformMap.get(id);
}

export function getAllPlatforms(): PlatformInfo[] {
  return PLATFORMS;
}

/** The record a platform id maps to, if it is one of the first-party records (the sim-fix overrides live elsewhere). */
function recordFor(id: number): PlatformRecord | undefined {
  return PLATFORM_RECORDS.find((r) => r.engineId === id);
}

/**
 * Flight endurance for an aircraft platform, in sim milliseconds. Read from the first-party record's
 * published figures (`enduranceHours`, else `rangeNm / cruiseSpeedKts`), with a sane fallback for
 * records that publish neither. Never part of the simulation-profiles digest: endurance only feeds the
 * new air-operations model and no pre-SAND-AIR-1 save can carry an airborne aircraft.
 */
export function aircraftEnduranceMs(id: number): number {
  const p = recordFor(id)?.performance;
  const hours =
    p?.enduranceHours && p.enduranceHours > 0
      ? p.enduranceHours
      : p?.rangeNm && p.cruiseSpeedKts && p.cruiseSpeedKts > 0
        ? p.rangeNm / p.cruiseSpeedKts
        : 2.5;
  return hours * 3_600_000;
}

/** Cruise speed in knots for a launched aircraft, from the record's published cruise figure or a sensible default. */
export function aircraftCruiseSpeedKts(id: number): number {
  const p = recordFor(id)?.performance;
  return p?.cruiseSpeedKts && p.cruiseSpeedKts > 0 ? p.cruiseSpeedKts : 350;
}

/** A routine launch/cruise altitude for a launched aircraft (feet). */
export function aircraftCruiseAltitudeFt(id: number): number {
  const p = recordFor(id)?.performance;
  return p?.maxAltitudeFt && p.maxAltitudeFt > 0 ? Math.min(p.maxAltitudeFt, 30_000) : 25_000;
}

/**
 * Stable digest of every simulation profile the engine can read (PLATFORMS, which already carries the
 * SIMFIX_PROFILES overrides, plus the snapshot placeholder profiles). A battle save records it so a file
 * is refused after any change to the data a restored battle would run on.
 */
export function simulationProfilesDigest(): string {
  const all = [...PLATFORMS, platformMap.get(UNKNOWN_AIR_PLATFORM_ID), platformMap.get(UNKNOWN_SURFACE_PLATFORM_ID)];
  return fnv1a(JSON.stringify(all));
}

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export { fnv1a as digestText };
