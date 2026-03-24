import type { Unit, Side, ReferencePoint, Position } from "@/types/game";
import type { Doctrine } from "@/lib/ai/doctrine";

export interface Contact {
  id: string;
  detectedById: string; // unit that detected this contact
  actualUnitId: string; // the real unit behind this contact (hidden from player)
  side: string; // which side detected it
  classification: "unknown" | "detected" | "classified" | "tracked";
  position: Position; // estimated position (with uncertainty)
  positionUncertainty: number; // km radius of uncertainty circle
  estimatedHeading?: number;
  estimatedSpeed?: number;
  platformName?: string; // only if classified
  lastUpdateTime: number; // sim time of last sensor update
  sensorType: string; // what detected it (radar, esm, visual, ir)
}

export interface Waypoint {
  position: Position;
  speed?: number; // override speed at this waypoint
  altitude?: number; // override altitude
}

export interface UnitOrders {
  unitId: string;
  waypoints: Waypoint[];
  throttle: number; // 1-4: loiter, cruise, full, flank
  desiredAltitude?: number;
  radarActive: boolean;
}

export interface GameState {
  scenario: {
    name: string;
    startTime: number; // unix timestamp ms
    playerSide: string;
  };
  simTime: number; // current simulation time (unix timestamp ms)
  isPaused: boolean;
  speed: number; // time multiplier (1, 2, 5, 10, 30, 60)
  sides: Side[];
  contacts: Contact[]; // what the player can see
  orders: Map<string, UnitOrders>;
  referencePoints: ReferencePoint[];
  score: Record<string, number>;
  turnNumber: number;
  // Doctrine overrides applied by TCA events at runtime
  sideDoctrineOverrides?: Record<string, Partial<Doctrine>>;
  missionDoctrineOverrides?: Record<string, Partial<Doctrine>>;
}

export function createInitialGameState(
  scenario: {
    name: string;
    startTime: string;
    playerSide: string;
    sides: Side[];
    referencePoints: ReferencePoint[];
  }
): GameState {
  const startTime = new Date(scenario.startTime).getTime();

  const orders = new Map<string, UnitOrders>();
  for (const side of scenario.sides) {
    for (const unit of side.units) {
      orders.set(unit.id, {
        unitId: unit.id,
        waypoints: [],
        throttle: 2, // cruise by default
        radarActive: true,
      });
    }
  }

  return {
    scenario: {
      name: scenario.name,
      startTime: startTime,
      playerSide: scenario.playerSide,
    },
    simTime: startTime,
    isPaused: true,
    speed: 1,
    sides: scenario.sides.map((s) => ({
      ...s,
      units: s.units.map((u) => ({ ...u })),
    })),
    contacts: [],
    orders,
    referencePoints: [...scenario.referencePoints],
    score: Object.fromEntries(scenario.sides.map((s) => [s.name, 0])),
    turnNumber: 0,
  };
}

export const SPEED_OPTIONS = [1, 2, 5, 10, 30, 60] as const;
