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

const PLATFORMS: PlatformInfo[] = PLATFORM_RECORDS.map(toPlatformInfo);

const platformMap = new Map<number, PlatformInfo>();
PLATFORMS.forEach((p) => platformMap.set(p.id, p));
PLATFORM_RECORDS.forEach((r, i) => r.legacyIds.forEach((id) => platformMap.set(id, PLATFORMS[i])));

export function getPlatform(id: number): PlatformInfo | undefined {
  return platformMap.get(id);
}

export function getAllPlatforms(): PlatformInfo[] {
  return PLATFORMS;
}
