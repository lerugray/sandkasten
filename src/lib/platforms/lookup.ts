import type { BattleDimension } from "../symbols/milsymbolFactory";

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

// Starter platforms for the Persian Gulf MVP scenario
// These reference DB3K IDs from the extraction
const MVP_PLATFORMS: PlatformInfo[] = [
  // US Navy
  {
    id: 111, name: "DDG 72 Mahan [Arleigh Burke Flight II]", dimension: "sea", functionId: "CL",
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
    id: 598, name: "CG 52 Bunker Hill [Ticonderoga Baseline 3]", dimension: "sea", functionId: "CL",
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
      { name: "Mk 15 Phalanx CIWS", type: "gun", rangeKm: 1.8, speedKts: 0, pkAir: 50, pkSurface: 30, quantity: 1200, warheadDamage: 10 },
    ],
    defenses: [
      { name: "Mk 36 SRBOC Chaff", type: "chaff", effectiveness: 0.3, quantity: 48 },
      { name: "AN/SLQ-32(V)4 ECM", type: "ecm", effectiveness: 0.3 },
      { name: "Mk 15 Phalanx x3", type: "ciws", effectiveness: 0.65 },
      { name: "AN/SLQ-25 Nixie", type: "decoy", effectiveness: 0.2 },
    ],
  },
  {
    id: 1283, name: "FFG 7 Oliver Hazard Perry [Long Hull]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 150, weaponRangeKm: 74, damagePoints: 720, missileDefense: 8,
    weapons: [
      { name: "RIM-66 SM-1MR", type: "sam", rangeKm: 40, speedKts: 2300, pkAir: 65, pkSurface: 70, quantity: 36, warheadDamage: 70, seekerType: "semi-active" },
      { name: "Mk 15 Phalanx CIWS", type: "gun", rangeKm: 1.8, speedKts: 0, pkAir: 50, pkSurface: 30, quantity: 1200, warheadDamage: 10 },
    ],
    defenses: [
      { name: "Mk 36 SRBOC Chaff", type: "chaff", effectiveness: 0.3, quantity: 12 },
      { name: "AN/SLQ-32(V)2 ECM", type: "ecm", effectiveness: 0.2 },
      { name: "Mk 15 Phalanx", type: "ciws", effectiveness: 0.5 },
    ],
  },
  // Aircraft
  {
    id: 342, name: "F/A-18E Super Hornet", dimension: "air", functionId: "MF",
    sensorRangeKm: 180, weaponRangeKm: 100, damagePoints: 4,
    weapons: [
      { name: "AIM-120C AMRAAM", type: "aam", rangeKm: 100, speedKts: 2700, pkAir: 85, pkSurface: 0, quantity: 6, warheadDamage: 30, seekerType: "active-radar" },
      { name: "AGM-84 Harpoon", type: "asm", rangeKm: 139, speedKts: 530, pkAir: 0, pkSurface: 95, quantity: 2, warheadDamage: 167, seekerType: "active-radar" },
      { name: "M61A1 Vulcan 20mm", type: "gun", rangeKm: 1.8, speedKts: 0, pkAir: 30, pkSurface: 20, quantity: 578, warheadDamage: 5 },
    ],
    defenses: [
      { name: "Chaff/Flare", type: "chaff", effectiveness: 0.35, quantity: 60 },
      { name: "AN/ALQ-214 IDECM", type: "ecm", effectiveness: 0.3 },
    ],
  },
  { id: 896, name: "F-14D Tomcat", dimension: "air", functionId: "MF", sensorRangeKm: 250, weaponRangeKm: 190, damagePoints: 5,
    weapons: [
      { name: "AIM-54C Phoenix", type: "aam", rangeKm: 190, speedKts: 3000, pkAir: 75, pkSurface: 0, quantity: 4, warheadDamage: 40, seekerType: "active-radar" },
      { name: "AIM-120C AMRAAM", type: "aam", rangeKm: 100, speedKts: 2700, pkAir: 85, pkSurface: 0, quantity: 2, warheadDamage: 30, seekerType: "active-radar" },
    ],
    defenses: [
      { name: "Chaff/Flare", type: "chaff", effectiveness: 0.3, quantity: 60 },
    ],
  },
  { id: 2471, name: "E-2C Hawkeye 2000", dimension: "air", functionId: "MF", sensorRangeKm: 556, damagePoints: 3 },
  { id: 466, name: "P-3C Orion Update III", dimension: "air", functionId: "MF", sensorRangeKm: 280, damagePoints: 5 },
  { id: 84, name: "SH-60B Seahawk", dimension: "air", functionId: "MH", sensorRangeKm: 120, damagePoints: 2 },
  // Iran Navy
  {
    id: 2106, name: "Sina Class [Houdong]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 46, weaponRangeKm: 120, damagePoints: 120, missileDefense: 2,
    weapons: [
      { name: "C-802 Noor", type: "asm", rangeKm: 120, speedKts: 530, pkAir: 0, pkSurface: 90, quantity: 4, warheadDamage: 167, seekerType: "active-radar" },
      { name: "23mm ZU-23-2", type: "gun", rangeKm: 2.5, speedKts: 0, pkAir: 15, pkSurface: 20, quantity: 200, warheadDamage: 3 },
    ],
    defenses: [],
  },
  {
    id: 1652, name: "Bayandor Class [PF 103]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 65, weaponRangeKm: 10, damagePoints: 340, missileDefense: 4,
    weapons: [
      { name: "76mm/50 OTO Melara", type: "gun", rangeKm: 10, speedKts: 0, pkAir: 10, pkSurface: 60, quantity: 80, warheadDamage: 15 },
      { name: "40mm/70 Bofors", type: "gun", rangeKm: 4, speedKts: 0, pkAir: 20, pkSurface: 40, quantity: 120, warheadDamage: 8 },
    ],
    defenses: [],
  },
  {
    id: 1088, name: "Kaman Class [Combattante II]", dimension: "sea", functionId: "CL",
    sensorRangeKm: 65, weaponRangeKm: 35, damagePoints: 180, missileDefense: 3,
    weapons: [
      { name: "C-802 Noor", type: "asm", rangeKm: 120, speedKts: 530, pkAir: 0, pkSurface: 90, quantity: 4, warheadDamage: 167, seekerType: "active-radar" },
      { name: "76mm/50 OTO Melara", type: "gun", rangeKm: 10, speedKts: 0, pkAir: 10, pkSurface: 60, quantity: 80, warheadDamage: 15 },
    ],
    defenses: [
      { name: "Chaff Launchers", type: "chaff", effectiveness: 0.2, quantity: 8 },
    ],
  },
  // Iran Air
  {
    id: 265, name: "F-4E Phantom II", dimension: "air", functionId: "MF",
    sensorRangeKm: 130, weaponRangeKm: 45, damagePoints: 5,
    weapons: [
      { name: "AIM-7E Sparrow", type: "aam", rangeKm: 45, speedKts: 2500, pkAir: 50, pkSurface: 0, quantity: 4, warheadDamage: 30, seekerType: "semi-active" },
      { name: "AIM-9P Sidewinder", type: "aam", rangeKm: 18, speedKts: 1800, pkAir: 60, pkSurface: 0, quantity: 4, warheadDamage: 20, seekerType: "ir" },
    ],
    defenses: [
      { name: "Chaff/Flare", type: "chaff", effectiveness: 0.25, quantity: 30 },
    ],
  },
  {
    id: 264, name: "F-14A Tomcat", dimension: "air", functionId: "MF",
    sensorRangeKm: 220, weaponRangeKm: 150, damagePoints: 5,
    weapons: [
      { name: "AIM-54A Phoenix", type: "aam", rangeKm: 150, speedKts: 3000, pkAir: 60, pkSurface: 0, quantity: 4, warheadDamage: 40, seekerType: "active-radar" },
      { name: "AIM-7E Sparrow", type: "aam", rangeKm: 45, speedKts: 2500, pkAir: 50, pkSurface: 0, quantity: 2, warheadDamage: 30, seekerType: "semi-active" },
      { name: "AIM-9P Sidewinder", type: "aam", rangeKm: 18, speedKts: 1800, pkAir: 60, pkSurface: 0, quantity: 2, warheadDamage: 20, seekerType: "ir" },
    ],
    defenses: [
      { name: "Chaff/Flare", type: "chaff", effectiveness: 0.25, quantity: 30 },
    ],
  },
];

const platformMap = new Map<number, PlatformInfo>();
MVP_PLATFORMS.forEach((p) => platformMap.set(p.id, p));

export function getPlatform(id: number): PlatformInfo | undefined {
  return platformMap.get(id);
}

export function getAllPlatforms(): PlatformInfo[] {
  return MVP_PLATFORMS;
}
