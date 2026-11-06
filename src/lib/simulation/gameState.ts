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
  lastUpdateTime: number; // sim time of the last report of any kind (keeps the contact alive)
  /** Sim time of the last report that fixed the position; precise tracking ages from here. */
  lastFixTime?: number;
  /** Position uncertainty at the last fix, before aging. */
  baseUncertainty?: number;
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
  throttle: number; // 0 stop, 1-4: loiter, cruise, full, flank
  /** Held speed in knots (the scenario's authored speed). Any throttle or route order clears it. */
  speedKts?: number;
  desiredAltitude?: number;
  radarActive: boolean;
  /** Unit-level doctrine set by the commander (ROE etc.); beats mission and side doctrine. */
  doctrine?: Partial<Doctrine>;
}

/** Next due times (sim ms) for the throttled phases; kept in state so each game has its own cadence. */
export interface PhaseSchedule {
  detectionAt: number;
  aiAt: number;
  engageAt: number;
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
  /** Contacts held by every other side, keyed by side name. */
  sideContacts: Record<string, Contact[]>;
  orders: Map<string, UnitOrders>;
  referencePoints: ReferencePoint[];
  score: Record<string, number>;
  turnNumber: number;
  schedule: PhaseSchedule;
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
        speedKts: unit.speed,
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
    sideContacts: {},
    orders,
    referencePoints: [...scenario.referencePoints],
    score: Object.fromEntries(scenario.sides.map((s) => [s.name, 0])),
    turnNumber: 0,
    schedule: { detectionAt: startTime, aiAt: startTime, engageAt: startTime },
  };
}

/** The contact store a side owns. */
export function contactsFor(state: GameState, side: string): Contact[] {
  return side === state.scenario.playerSide ? state.contacts : state.sideContacts[side] ?? [];
}

export const SPEED_OPTIONS = [1, 2, 5, 10, 30, 60] as const;
