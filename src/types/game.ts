import type { Facility } from "@/lib/facilities/facilities";

export interface Position {
  lng: number;
  lat: number;
}

export interface Unit {
  id: string;
  name: string;
  platformId: number;
  side: string;
  position: Position;
  heading: number;
  speed: number;
  altitude?: number;
  damageState: "undamaged" | "damaged" | "mission-kill" | "destroyed";
  /** Damage points taken so far; damageState derives from this against the platform's damagePoints. */
  damage?: number;
  mission?: string;
  /** Real-world base this unit operates from (facility id from data/facilities); runwayEnd is the threshold it starts on. */
  homeBase?: { facilityId: string; runwayEnd?: string };
}

export interface Side {
  name: string;
  color: string;
  isAI: boolean;
  units: Unit[];
}

export interface ReferencePoint {
  id: string;
  name: string;
  type: "point" | "area";
  side?: string;
  points: Position[];
}

export interface Scenario {
  name: string;
  description: string;
  briefing: string;
  theater: {
    center: Position;
    zoom: number;
    bounds?: [number, number, number, number];
  };
  startTime: string;
  playerSide: string;
  sides: Side[];
  referencePoints: ReferencePoint[];
  /** Real-world installations (airbases, naval bases, ports) shown on the map; loaded from data/facilities. */
  facilities?: Facility[];
}

export type Affiliation = "friendly" | "hostile" | "neutral" | "unknown";

export function getAffiliation(
  unit: Unit,
  playerSide: string
): Affiliation {
  if (unit.side === playerSide) return "friendly";
  if (unit.side === "Civilian" || unit.side === "Neutral") return "neutral";
  return "hostile";
}

/** Sides that never take part in combat: no detection of them as enemies, no automatic fire on them. */
const NON_COMBATANT_SIDES = new Set(["Civilian", "Neutral"]);

/** The one hostility predicate shared by detection, AI and combat. */
export function isHostileSide(a: string, b: string): boolean {
  return a !== b && !NON_COMBATANT_SIDES.has(a) && !NON_COMBATANT_SIDES.has(b);
}
