/**
 * AI Controller — the brain that makes OPFOR units act.
 *
 * The engine calls this once per AI cycle (every 5 sim-seconds).
 * For each AI side: resolve doctrine, execute missions, update orders.
 * Each side reasons from its own contacts, not from the true positions of the other side.
 */

import type { Unit, Position } from "@/types/game";
import { isHostileSide } from "@/types/game";
import { contactsFor, type Contact, type GameState, type UnitOrders } from "@/lib/simulation/gameState";
import type { Mission } from "./missions";
import {
  shouldRadarBeActive,
  shouldWithdraw,
  type Doctrine,
} from "./doctrine";
import { missionOf, resolveUnitDoctrine } from "./effectiveDoctrine";
import {
  generatePatrolWaypoints,
  generateCAPWaypoints,
  generateEscortWaypoint,
  generateTransitWaypoints,
  generateStrikeWaypoints,
} from "./missions";
import { distanceKm } from "@/lib/simulation/movement";
import { getPlatform } from "@/lib/platforms/lookup";

export interface AIState {
  missions: Mission[];
  sideDoctrine: Record<string, Partial<Doctrine>>;
  /** Runtime bookkeeping, created on first use and owned by this AIState (one per game). */
  patrolIndex?: Map<string, number>;
  transitStarted?: Set<string>;
  transitDone?: Set<string>;
}

interface AIRuntime {
  patrolIndex: Map<string, number>;
  transitStarted: Set<string>;
  transitDone: Set<string>;
}

function runtimeOf(ai: AIState): AIRuntime {
  ai.patrolIndex ??= new Map();
  ai.transitStarted ??= new Set();
  ai.transitDone ??= new Set();
  return { patrolIndex: ai.patrolIndex, transitStarted: ai.transitStarted, transitDone: ai.transitDone };
}

/** New route and throttle; a commanded throttle replaces any speed held from the scenario. */
function route(orders: UnitOrders, waypoints: Position[], throttle: number): UnitOrders {
  return { ...orders, waypoints: waypoints.map((p) => ({ position: p })), throttle, speedKts: undefined };
}

function stop(orders: UnitOrders): UnitOrders {
  return { ...orders, waypoints: [], throttle: 0, speedKts: 0 };
}

function withThrottle(orders: UnitOrders, throttle: number): UnitOrders {
  return { ...orders, throttle, speedKts: undefined };
}

/** What an AI side knows about the units it could attack: its own hostile contacts, at their reported positions. */
interface Threat {
  contact: Contact;
  position: Position;
  isAir: boolean;
}

function threatsFor(state: GameState, side: string): Threat[] {
  const units = new Map(state.sides.flatMap((s) => s.units).map((u) => [u.id, u]));
  const out: Threat[] = [];
  for (const contact of contactsFor(state, side)) {
    if (contact.classification === "unknown") continue;
    const actual = units.get(contact.actualUnitId);
    if (!actual || actual.damageState === "destroyed" || !isHostileSide(side, actual.side)) continue;
    const platform = getPlatform(actual.platformId);
    const isAir = platform ? platform.dimension === "air" : (actual.altitude ?? 0) > 500;
    out.push({ contact, position: contact.position, isAir });
  }
  return out;
}

/**
 * Run AI decision-making for all AI-controlled sides.
 * The caller decides when an AI cycle is due.
 */
export function runAIUpdate(
  state: GameState,
  aiState: AIState
): Map<string, UnitOrders> {
  const rt = runtimeOf(aiState);
  const newOrders = new Map(state.orders);
  const allUnits = state.sides.flatMap((s) => s.units);

  for (const side of state.sides) {
    if (!side.isAI) continue;
    const threats = threatsFor(state, side.name);

    for (const unit of side.units) {
      if (unit.damageState === "destroyed") continue;

      const currentOrders = newOrders.get(unit.id);
      if (!currentOrders) continue;

      const mission = missionOf(unit, aiState.missions);
      const doctrine = resolveUnitDoctrine(unit, state, aiState);

      const hasNearbyContacts = threats.some((t) => distanceKm(unit.position, t.position) <= 100);
      const shouldRadar = shouldRadarBeActive(doctrine, hasNearbyContacts);

      let updatedOrders: UnitOrders = { ...currentOrders, radarActive: shouldRadar };

      // Check withdrawal
      if (shouldWithdraw(doctrine, unit.damageState) && mission) {
        if (mission.referencePoints.length > 0) {
          newOrders.set(unit.id, route(updatedOrders, [mission.referencePoints[0]], 4));
          continue;
        }
      }

      if (mission) {
        updatedOrders = executeMission(unit, updatedOrders, mission, doctrine, allUnits, threats, rt);
      }
      // A unit with no mission keeps doing what it was doing

      newOrders.set(unit.id, updatedOrders);
    }
  }

  return newOrders;
}

function executeMission(
  unit: Unit,
  orders: UnitOrders,
  mission: Mission,
  doctrine: Doctrine,
  allUnits: Unit[],
  threats: Threat[],
  rt: AIRuntime
): UnitOrders {
  switch (mission.type) {
    case "patrol":
      return executePatrol(unit, orders, mission, doctrine, threats, rt);
    case "cap":
      return executeCAP(unit, orders, mission, doctrine, threats);
    case "strike":
      return executeStrike(unit, orders, mission, allUnits);
    case "escort":
      return executeEscort(unit, orders, mission, allUnits);
    case "transit":
      return executeTransit(unit, orders, mission, rt);
    case "support":
      return executeSupport(unit, orders, mission);
    default:
      return orders;
  }
}

function executePatrol(
  unit: Unit,
  orders: UnitOrders,
  mission: Mission,
  doctrine: Doctrine,
  threats: Threat[],
  rt: AIRuntime
): UnitOrders {
  // If we have no waypoints, generate the next patrol leg
  if (orders.waypoints.length === 0 && mission.referencePoints.length > 0) {
    const idx = rt.patrolIndex.get(unit.id) ?? 0;
    const waypoints = generatePatrolWaypoints(mission, unit, idx);
    rt.patrolIndex.set(unit.id, (idx + 1) % mission.referencePoints.length);
    return route(orders, waypoints, 2);
  }

  // Prosecution — chase the nearest known contact
  if (doctrine.roe === "weapons-free") {
    const nearest = nearestThreat(unit, threats);
    if (nearest && distanceKm(unit.position, nearest.position) <= mission.prosecutionRange) {
      return route(orders, [nearest.position], 3);
    }
  }

  return orders;
}

function executeCAP(
  unit: Unit,
  orders: UnitOrders,
  mission: Mission,
  doctrine: Doctrine,
  threats: Threat[]
): UnitOrders {
  // Intercept an air contact, whatever else is closer
  if (doctrine.roe !== "weapons-hold") {
    const nearestAir = nearestThreat(unit, threats.filter((t) => t.isAir));
    if (nearestAir && distanceKm(unit.position, nearestAir.position) <= mission.prosecutionRange) {
      return route(orders, [nearestAir.position], 4);
    }
  }

  // No threats — orbit the CAP station
  if (orders.waypoints.length === 0) {
    return route(orders, generateCAPWaypoints(mission, unit), 2);
  }

  return orders;
}

function executeStrike(
  unit: Unit,
  orders: UnitOrders,
  mission: Mission,
  allUnits: Unit[]
): UnitOrders {
  if (orders.waypoints.length > 0) return orders;

  // Find target
  let targetPos: Position | null = null;

  if (mission.targetUnitId) {
    const target = allUnits.find((u) => u.id === mission.targetUnitId);
    if (target && target.damageState !== "destroyed") {
      targetPos = target.position;
    }
  }

  if (!targetPos && mission.referencePoints.length > 0) {
    // Strike area center
    targetPos = mission.referencePoints[mission.referencePoints.length - 1];
  }

  if (targetPos) {
    return route(orders, generateStrikeWaypoints(mission, targetPos), 3);
  }

  return orders;
}

function executeEscort(
  unit: Unit,
  orders: UnitOrders,
  mission: Mission,
  allUnits: Unit[]
): UnitOrders {
  if (!mission.escortTargetId) return orders;

  const escortTarget = allUnits.find((u) => u.id === mission.escortTargetId);
  if (!escortTarget || escortTarget.damageState === "destroyed") return orders;

  // Stay near the escort target — update waypoint every AI cycle
  const stationPos = generateEscortWaypoint(escortTarget, unit);
  const dist = distanceKm(unit.position, stationPos);

  // Only update waypoint if we've drifted more than 3km from station
  if (dist > 3) return route(orders, [stationPos], 2);

  return withThrottle(orders, 2);
}

function executeTransit(
  unit: Unit,
  orders: UnitOrders,
  mission: Mission,
  rt: AIRuntime
): UnitOrders {
  if (orders.waypoints.length > 0) {
    rt.transitStarted.add(unit.id);
    return orders;
  }

  if (!mission.repeating) {
    // A one-way transit ends where it ends
    if (rt.transitDone.has(unit.id)) return orders;
    if (rt.transitStarted.has(unit.id)) {
      rt.transitDone.add(unit.id);
      return stop(orders);
    }
  }

  const waypoints = generateTransitWaypoints(mission);
  if (waypoints.length === 0) return orders;

  rt.transitStarted.add(unit.id);
  return route(orders, waypoints, 2);
}

function executeSupport(
  unit: Unit,
  orders: UnitOrders,
  mission: Mission
): UnitOrders {
  // Support units orbit their reference area
  if (orders.waypoints.length === 0 && mission.referencePoints.length > 0) {
    const center = mission.referencePoints[0];
    const offset = 0.1;
    return route(
      orders,
      [
        { lng: center.lng - offset, lat: center.lat },
        { lng: center.lng + offset, lat: center.lat },
      ],
      2
    );
  }
  return orders;
}

// --- Helpers ---

function nearestThreat(unit: Unit, threats: Threat[]): Threat | null {
  let nearest: Threat | null = null;
  let nearestDist = Infinity;
  for (const t of threats) {
    const dist = distanceKm(unit.position, t.position);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = t;
    }
  }
  return nearest;
}
