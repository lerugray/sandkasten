import { readFileSync, existsSync } from "fs";
import path from "path";
import type {
  ShipRecord,
  AircraftRecord,
  WeaponRecord,
  SensorRecord,
  MountRecord,
  LoadoutRecord,
  ExtractedData,
  EnumFile,
} from "@/types/platform";

const DATA_DIR = path.join(process.cwd(), "data", "extraction");
const ENUM_DIR = path.join(DATA_DIR, "enums");

// Cached data stores (loaded on first access, server-side only)
let ships: Map<number, ShipRecord> | null = null;
let aircraft: Map<number, AircraftRecord> | null = null;
let weapons: Map<number, WeaponRecord> | null = null;
let sensors: Map<number, SensorRecord> | null = null;
let mounts: Map<number, MountRecord> | null = null;
let loadouts: Map<number, LoadoutRecord> | null = null;
const enumCache = new Map<string, Record<string, string>>();

function loadJSON<T>(filename: string): ExtractedData<T> | null {
  const filepath = path.join(DATA_DIR, filename);
  if (!existsSync(filepath)) return null;
  const raw = readFileSync(filepath, "utf-8");
  return JSON.parse(raw);
}

function toMap<T extends { id: number }>(records: T[]): Map<number, T> {
  const map = new Map<number, T>();
  for (const rec of records) {
    map.set(rec.id, rec);
  }
  return map;
}

export function getShips(): Map<number, ShipRecord> {
  if (!ships) {
    const data = loadJSON<ShipRecord>("ships.json");
    ships = data ? toMap(data.records) : new Map();
  }
  return ships;
}

export function getAircraft(): Map<number, AircraftRecord> {
  if (!aircraft) {
    const data = loadJSON<AircraftRecord>("aircraft.json");
    aircraft = data ? toMap(data.records) : new Map();
  }
  return aircraft;
}

export function getWeapons(): Map<number, WeaponRecord> {
  if (!weapons) {
    const data = loadJSON<WeaponRecord>("weapons.json");
    weapons = data ? toMap(data.records) : new Map();
  }
  return weapons;
}

export function getSensors(): Map<number, SensorRecord> {
  if (!sensors) {
    const data = loadJSON<SensorRecord>("sensors.json");
    sensors = data ? toMap(data.records) : new Map();
  }
  return sensors;
}

export function getMounts(): Map<number, MountRecord> {
  if (!mounts) {
    const data = loadJSON<MountRecord>("mounts.json");
    mounts = data ? toMap(data.records) : new Map();
  }
  return mounts;
}

export function getLoadouts(): Map<number, LoadoutRecord> {
  if (!loadouts) {
    const data = loadJSON<LoadoutRecord>("loadouts.json");
    loadouts = data ? toMap(data.records) : new Map();
  }
  return loadouts;
}

// --- Enum resolver ---

function loadEnum(filename: string): Record<string, string> {
  if (enumCache.has(filename)) return enumCache.get(filename)!;

  const filepath = path.join(ENUM_DIR, filename);
  if (!existsSync(filepath)) {
    enumCache.set(filename, {});
    return {};
  }

  const raw = readFileSync(filepath, "utf-8");
  const data: EnumFile = JSON.parse(raw);

  // Flatten: entries can be string or object with Description field
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(data.entries)) {
    if (typeof value === "string") {
      flat[key] = value;
    } else if (value && typeof value === "object" && "Description" in value) {
      flat[key] = String((value as Record<string, unknown>).Description);
    } else {
      flat[key] = JSON.stringify(value);
    }
  }

  enumCache.set(filename, flat);
  return flat;
}

export function resolveEnum(enumFile: string, id: number): string {
  const entries = loadEnum(enumFile);
  return entries[String(id)] ?? `Unknown (${id})`;
}

// Convenience resolvers for common enums
export const resolveCountry = (id: number) => resolveEnum("operatorcountry.json", id);
export const resolveService = (id: number) => resolveEnum("operatorservice.json", id);
export const resolveShipCategory = (id: number) => resolveEnum("shipcategory.json", id);
export const resolveShipType = (id: number) => resolveEnum("shiptype.json", id);
export const resolveAircraftCategory = (id: number) => resolveEnum("aircraftcategory.json", id);
export const resolveAircraftType = (id: number) => resolveEnum("aircrafttype.json", id);
export const resolveWeaponType = (id: number) => resolveEnum("weapontype.json", id);
export const resolveSensorType = (id: number) => resolveEnum("sensortype.json", id);
export const resolveSensorRole = (id: number) => resolveEnum("sensorrole.json", id);
export const resolveLoadoutRole = (id: number) => resolveEnum("loadoutrole.json", id);
export const resolvePropulsionType = (id: number) => resolveEnum("propulsiontype.json", id);
export const resolveFuelType = (id: number) => resolveEnum("fueltype.json", id);
export const resolveArmorType = (id: number) => resolveEnum("armortype.json", id);

// --- Data availability check ---

export function isDatabaseAvailable(): boolean {
  return existsSync(path.join(DATA_DIR, "ships.json"));
}
