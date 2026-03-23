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
  mission?: string;
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
