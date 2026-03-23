import type { BattleDimension } from "../symbols/milsymbolFactory";

// Lightweight platform info for rendering — full data stays in JSON files
export interface PlatformInfo {
  id: number;
  name: string;
  dimension: BattleDimension;
  functionId: string;
  sensorRangeKm?: number;
  weaponRangeKm?: number;
}

// Starter platforms for the Persian Gulf MVP scenario
// These reference DB3K IDs from the extraction
const MVP_PLATFORMS: PlatformInfo[] = [
  // US Navy
  { id: 111, name: "DDG 72 Mahan [Arleigh Burke Flight II]", dimension: "sea", functionId: "CL", sensorRangeKm: 324, weaponRangeKm: 167 },
  { id: 598, name: "CG 52 Bunker Hill [Ticonderoga Baseline 3]", dimension: "sea", functionId: "CL", sensorRangeKm: 370, weaponRangeKm: 167 },
  { id: 2740, name: "CVN 68 Nimitz [1998]", dimension: "sea", functionId: "CV", sensorRangeKm: 324, weaponRangeKm: 20 },
  { id: 1283, name: "FFG 7 Oliver Hazard Perry [Long Hull]", dimension: "sea", functionId: "CL", sensorRangeKm: 150, weaponRangeKm: 74 },
  // Aircraft
  { id: 342, name: "F/A-18E Super Hornet", dimension: "air", functionId: "MF" },
  { id: 896, name: "F-14D Tomcat", dimension: "air", functionId: "MF" },
  { id: 2471, name: "E-2C Hawkeye 2000", dimension: "air", functionId: "MF" },
  { id: 466, name: "P-3C Orion Update III", dimension: "air", functionId: "MF" },
  { id: 84, name: "SH-60B Seahawk", dimension: "air", functionId: "MH" },
  // Iran Navy
  { id: 2106, name: "Sina Class [Houdong]", dimension: "sea", functionId: "CL", sensorRangeKm: 46, weaponRangeKm: 120 },
  { id: 1652, name: "Bayandor Class [PF 103]", dimension: "sea", functionId: "CL", sensorRangeKm: 65, weaponRangeKm: 10 },
  { id: 1088, name: "Kaman Class [Combattante II]", dimension: "sea", functionId: "CL", sensorRangeKm: 65, weaponRangeKm: 35 },
  // Iran Air
  { id: 265, name: "F-4E Phantom II", dimension: "air", functionId: "MF" },
  { id: 264, name: "F-14A Tomcat", dimension: "air", functionId: "MF" },
];

const platformMap = new Map<number, PlatformInfo>();
MVP_PLATFORMS.forEach((p) => platformMap.set(p.id, p));

export function getPlatform(id: number): PlatformInfo | undefined {
  return platformMap.get(id);
}

export function getAllPlatforms(): PlatformInfo[] {
  return MVP_PLATFORMS;
}
