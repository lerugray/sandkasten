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
  missileDefense?: number; // drives WRA salvo sizing
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
// Aircraft keep the engine's historical shape: no missileDefense, and weapons or
// defenses stay undefined when the record carries none.
export function toPlatformInfo(record: PlatformRecord): PlatformInfo {
  const isAir = record.dimension === "air";
  const id = record.legacyIds[0] ?? record.engineId;
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
// swaps (Chosin 9001, Nitze 9002, Cole 9003), the Boghammar craft (9004), and corrected weapon
// names/counts on 2740, 342, 2106, 1652, 1088. A profile replaces the record-derived entry with the
// same id. Folding these into src/data/platforms/records/ is a follow-up.
const SIMFIX_PROFILES: PlatformInfo[] = [
  // USS Cole DDG-67 is an Arleigh Burke Flight I destroyer, in active service, homeport Norfolk (90 Mk 41 VLS cells,
  // 1x Mk 45 5"/54, 2x Phalanx). Sources: https://www.history.navy.mil/browse-by-topic/ships/modern-ships/uss-cole.html
  // and https://en.wikipedia.org/wiki/USS_Cole_(DDG-67). Weapon counts/ranges/Pk/damage are COPIED from the Mahan profile (111)
  // and are simulation abstractions: unverified model assumption, not a certified Cole fit.
  {
    id: 9003, name: "DDG 67 Cole [Arleigh Burke Flight I]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 324, weaponRangeKm: 167, damagePoints: 1190, missileDefense: 16,
    weapons: [
      { name: "RIM-66M SM-2MR", type: "sam", rangeKm: 93, speedKts: 2300, pkAir: 85, pkSurface: 90, quantity: 50, warheadDamage: 80, seekerType: "semi-active" },
      { name: "RGM-84 Harpoon", type: "asm", rangeKm: 139, speedKts: 530, pkAir: 0, pkSurface: 95, quantity: 8, warheadDamage: 167, seekerType: "active-radar" },
      { name: "Mk 15 Phalanx CIWS", type: "gun", rangeKm: 1.8, speedKts: 0, pkAir: 50, pkSurface: 30, quantity: 1200, warheadDamage: 10 },
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
  // Baseline number deliberately not claimed. Weapon counts/ranges/Pk/damage are copied from the retired CG-52 profile:
  // simulation abstractions, unverified model assumption.
  {
    id: 9001, name: "CG 65 Chosin [Ticonderoga, Mk 41 VLS]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 370, weaponRangeKm: 167, damagePoints: 1360, missileDefense: 20,
    weapons: [
      { name: "RIM-66M SM-2MR", type: "sam", rangeKm: 93, speedKts: 2300, pkAir: 85, pkSurface: 90, quantity: 80, warheadDamage: 80, seekerType: "semi-active" },
      { name: "RGM-84 Harpoon", type: "asm", rangeKm: 139, speedKts: 530, pkAir: 0, pkSurface: 95, quantity: 8, warheadDamage: 167, seekerType: "active-radar" },
      { name: "Mk 15 Phalanx CIWS", type: "gun", rangeKm: 1.8, speedKts: 0, pkAir: 50, pkSurface: 30, quantity: 1200, warheadDamage: 10 },
    ],
    defenses: [
      { name: "Mk 36 SRBOC Chaff", type: "chaff", effectiveness: 0.3, quantity: 24 },
      { name: "AN/SLQ-32(V)3 ECM", type: "ecm", effectiveness: 0.25 },
      { name: "Mk 15 Phalanx", type: "ciws", effectiveness: 0.5 },
      { name: "AN/SLQ-25 Nixie", type: "decoy", effectiveness: 0.2 },
    ],
  },
  {
    id: 2740, name: "CVN 68 Nimitz [1998]", dimension: "sea", functionId: "CV",
    sensorRangeKm: 324, weaponRangeKm: 20, damagePoints: 3600, missileDefense: 24,
    weapons: [
      { name: "RIM-7 Sea Sparrow", type: "sam", rangeKm: 19, speedKts: 2300, pkAir: 70, pkSurface: 0, quantity: 16, warheadDamage: 60, seekerType: "semi-active" },
      // RIM-116 RAM: modern Nimitz-class capability absent from the 1998 fit. Official imagery:
      // https://www.navy.mil/Resources/Photo-Gallery/igphoto/2002400143/ and
      // https://www.dvidshub.net/image/8679626/nimitz-launches-rolling-airframe-missile-during-live-fire-exercise
      // Sources establish the capability only; quantity/range/Pk/damage are unverified model assumptions, not a certified March 2026 magazine.
      { name: "RIM-116 RAM", type: "sam", rangeKm: 9, speedKts: 1500, pkAir: 70, pkSurface: 0, quantity: 21, warheadDamage: 25, seekerType: "ir" },
      { name: "Mk 15 Phalanx CIWS", type: "gun", rangeKm: 1.8, speedKts: 0, pkAir: 50, pkSurface: 30, quantity: 1200, warheadDamage: 10 },
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
  // https://www.dvidshub.net/news/162764/uss-taylor-ffg-50-decommissions). The Perry-class SM-1MR profile 1283 was removed;
  // there are no Perry-class frigates left in US service. Source: https://en.wikipedia.org/wiki/USS_Nitze
  // (Nitze's actual March 2026 location/tasking is not established; this is a plausible-role substitution.)
  // Weapon counts/ranges/Pk/damage are copied from the Mahan profile (111): simulation abstractions, unverified model assumption.
  {
    id: 9002, name: "DDG 94 Nitze [Arleigh Burke Flight IIA]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 324, weaponRangeKm: 167, damagePoints: 1190, missileDefense: 16,
    weapons: [
      { name: "RIM-66M SM-2MR", type: "sam", rangeKm: 93, speedKts: 2300, pkAir: 85, pkSurface: 90, quantity: 50, warheadDamage: 80, seekerType: "semi-active" },
      { name: "RGM-84 Harpoon", type: "asm", rangeKm: 139, speedKts: 530, pkAir: 0, pkSurface: 95, quantity: 8, warheadDamage: 167, seekerType: "active-radar" },
      { name: "Mk 15 Phalanx CIWS", type: "gun", rangeKm: 1.8, speedKts: 0, pkAir: 50, pkSurface: 30, quantity: 1200, warheadDamage: 10 },
    ],
    defenses: [
      { name: "Mk 36 SRBOC Chaff", type: "chaff", effectiveness: 0.3, quantity: 24 },
      { name: "AN/SLQ-32(V)3 ECM", type: "ecm", effectiveness: 0.25 },
      { name: "Mk 15 Phalanx", type: "ciws", effectiveness: 0.5 },
      { name: "AN/SLQ-25 Nixie", type: "decoy", effectiveness: 0.2 },
    ],
  },
  {
    id: 342, name: "F/A-18E Super Hornet", dimension: "air", functionId: "MF",
    sensorRangeKm: 180, weaponRangeKm: 100, damagePoints: 4,
    weapons: [
      { name: "AIM-120C AMRAAM", type: "aam", rangeKm: 100, speedKts: 2700, pkAir: 85, pkSurface: 0, quantity: 6, warheadDamage: 30, seekerType: "active-radar" },
      { name: "AGM-84 Harpoon", type: "asm", rangeKm: 139, speedKts: 530, pkAir: 0, pkSurface: 95, quantity: 2, warheadDamage: 167, seekerType: "active-radar" },
      // F/A-18E/F carries the M61A2 with a maximum of 412 rounds (actual mission loading may be lower).
      // https://www.gdots.com/wp-content/uploads/2025/11/400003005-20mm-F-A-18-E-F-Gatling-Gun-System-ARMAMENT.pdf
      // Range/Pk/damage are unverified model assumptions.
      { name: "M61A2 Vulcan 20mm", type: "gun", rangeKm: 1.8, speedKts: 0, pkAir: 30, pkSurface: 20, quantity: 412, warheadDamage: 5 },
    ],
    defenses: [
      { name: "Chaff/Flare", type: "chaff", effectiveness: 0.35, quantity: 60 },
      { name: "AN/ALQ-214 IDECM", type: "ecm", effectiveness: 0.3 },
    ],
  },
  // Sina class: Iranian-built missile boat derived from the La Combattante II / Kaman design (NOT the same as Houdong/Thondor).
  // Sources: https://en.wikipedia.org/wiki/Sina-class_fast_attack_craft ,
  // IISS https://www.iiss.org/globalassets/media-library---content--migration/files/research-papers/2023/04/watching-iran-the-isr-gulf.pdf ,
  // ONI https://www.oni.navy.mil/Portals/12/Intel%20agencies/iran/Iran%20022217SP.pdf?ver=2017-02-28-082634-643 (p.34).
  // Public sources list C-802/Noor missiles plus a 76 mm Fajr-27 gun and a 40 mm gun; the weapons below (4 C-802/Noor,
  // 23 mm ZU-23-2) are an APPROXIMATION, unverified model assumption. Not for Boghammar craft (see profile 9004).
  {
    id: 2106, name: "Sina Class [Kaman-derived missile boat, approximate fit]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 46, weaponRangeKm: 120, damagePoints: 120, missileDefense: 2,
    weapons: [
      { name: "C-802 Noor", type: "asm", rangeKm: 120, speedKts: 530, pkAir: 0, pkSurface: 90, quantity: 4, warheadDamage: 167, seekerType: "active-radar" },
      { name: "23mm ZU-23-2", type: "gun", rangeKm: 2.5, speedKts: 0, pkAir: 15, pkSurface: 20, quantity: 200, warheadDamage: 3 },
    ],
    defenses: [],
  },
  // Boghammar: Swedish-built (Boghammar Marin AB) RL-118/RL-130 inshore patrol craft bought by Iran in 1983, used by IRGCN
  // (called Taregh in Iran). ONI distinguishes Boghammar inshore patrol craft from Houdong missile craft (p.34 of the ONI report above).
  // Typical armament per public sources: 12.7mm DShK machine gun, 107mm 12-tube MRL (Fadjr-1 rockets), sometimes RPG/recoilless rifle:
  // https://www.globalsecurity.org/military/world/iran/boghammar.htm ,
  // https://admiraltytrilogy.com/scensupp/H002_OriginsHcon2021_IRGCN_Small_Boats_Briefing.pdf
  // NO anti-ship missiles. All numbers are simulation abstractions (unverified model assumption). The 107mm MRL is modeled as
  // type "gun" because PlatformWeapon has no rocket type.
  {
    id: 9004, name: "Boghammar [IRGCN inshore patrol craft]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 8, weaponRangeKm: 8, damagePoints: 15,
    weapons: [
      { name: "12.7mm DShK MG", type: "gun", rangeKm: 1.5, speedKts: 0, pkAir: 5, pkSurface: 25, quantity: 400, warheadDamage: 2 },
      { name: "107mm MRL (Fadjr-1 rockets)", type: "gun", rangeKm: 8, speedKts: 0, pkAir: 0, pkSurface: 15, quantity: 12, warheadDamage: 5 },
    ],
    defenses: [],
  },
  // FLAGGED POSSIBLE DATE ERROR: public imagery analysis reports IRIS Bayandor (81) sunk at Konarak on 1-2 March 2026, before this
  // scenario's 2026-03-15 date. Kept as is for Ray's decision (see docs/handoffs/sim-fix-2026-11-03/NOTES-demo.md).
  // https://www.criticalthreats.org/analysis/iran-update-evening-special-report-march-1-2026
  // https://www.twz.com/news-features/irans-key-naval-base-on-strait-of-hormuz-set-ablaze-from-strikes
  // Gun naming: the 2013 refit added a Fajr-27 76 mm (OTO Melara-type) gun and a dual 40 mm (https://en.wikipedia.org/wiki/Bayandor-class_corvette).
  // The exact Iranian refit stays unverified; "76/50" was wrong (the OTO Compact is 76/62), so it is named as a Fajr-27 approximation.
  {
    id: 1652, name: "Bayandor Class [PF 103]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 65, weaponRangeKm: 10, damagePoints: 340, missileDefense: 4,
    weapons: [
      { name: "76mm Fajr-27 (OTO Melara type, approx.)", type: "gun", rangeKm: 10, speedKts: 0, pkAir: 10, pkSurface: 60, quantity: 80, warheadDamage: 15 },
      { name: "40mm/70 Bofors", type: "gun", rangeKm: 4, speedKts: 0, pkAir: 20, pkSurface: 40, quantity: 120, warheadDamage: 8 },
    ],
    defenses: [],
  },
  // Kaman = Iranian La Combattante II. Public sources list a single 76 mm OTO Melara Compact (76/62 family) and a 40 mm Bofors
  // (https://en.wikipedia.org/wiki/La_Combattante_II-class_fast_attack_craft ; Leonardo datasheet
  // https://electronics.leonardo.com/documents/16277707/18404219/OTO_76_62_SR%2B%28MM08727%29_LQ_new.pdf?t=1625148164800).
  // Exact Iranian missile fit (Harpoon vs C-802) and counts are unverified model assumptions; the 35 km header range
  // vs 120 km C-802 entry is an internal inconsistency left as is.
  {
    id: 1088, name: "Kaman Class [Combattante II]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 65, weaponRangeKm: 35, damagePoints: 180, missileDefense: 3,
    weapons: [
      { name: "C-802 Noor", type: "asm", rangeKm: 120, speedKts: 530, pkAir: 0, pkSurface: 90, quantity: 4, warheadDamage: 167, seekerType: "active-radar" },
      { name: "76mm OTO Melara Compact (76/62 family)", type: "gun", rangeKm: 10, speedKts: 0, pkAir: 10, pkSurface: 60, quantity: 80, warheadDamage: 15 },
    ],
    defenses: [
      { name: "Chaff Launchers", type: "chaff", effectiveness: 0.2, quantity: 8 },
    ],
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
PLATFORM_RECORDS.forEach((r, i) =>
  r.legacyIds.forEach((id) => platformMap.set(id, platformMap.get(RECORD_PLATFORMS[i].id)!)),
);

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
