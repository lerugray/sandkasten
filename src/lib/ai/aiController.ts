/**
 * AI Controller — the brain that makes OPFOR units act.
 *
 * Runs once per detection cycle (every 5 sim-seconds).
 * For each AI side: resolve doctrine, execute missions, update orders.
 */

import type { Unit, Position } from "@/types/game";
import type { GameState, UnitOrders } from "@/lib/simulation/gameState";
import type { Mission } from "./missions";
import {
  resolveDoctrine,
  shouldRadarBeActive,
  shouldWithdraw,
  type Doctrine,
} from "./doctrine";
import {
  generatePatrolWaypoints,
  generateCAPWaypoints,
  generateEscortWaypoint,
  generateTransitWaypoints,
  generateStrikeWaypoints,
} from "./missions";
import { distanceKm } from "@/lib/simulation/movement";

const AI_UPDATE_INTERVAL_MS = 5000; // same cadence as detection
let lastAIUpdateTime = 0;

// Track which patrol waypoint index each unit is on
const patrolWaypointIndex = new Map<string, number>();

export interface AIState {
  missions: Mission[];
  sideDoctrine: Record<string, Partial<Doctrine>>;
}

/**
 * Run AI decision-making for all AI-controlled sides.
 * Call this from the simulation tick.
 */
export function runAIUpdate(
  state: GameState,
  aiState: AIState
): Map<string, UnitOrders> {
  if (state.simTime - lastAIUpdateTime < AI_UPDATE_INTERVAL_MS) {
    return state.orders;
  }
  lastAIUpdateTime = state.simTime;

  const newOrders = new Map(state.orders);
  const allUnits = state.sides.flatMap((s) => s.units);

  // Process each AI side
  for (const side of state.sides) {
    if (!side.isAI) continue;

    const sideDoctrine = aiState.sideDoctrine[side.name] ?? {};

    for (const unit of side.units) {
      if (unit.damageState === "destroyed") continue;

      const currentOrders = newOrders.get(unit.id);
      if (!currentOrders) continue;

      // Find this unit's mission
      const mission = aiState.missions.find(
        (m) => m.side === side.name && m.assignedUnitIds.includes(unit.id)
      );

      const doctrine = resolveDoctrine(
        sideDoctrine,
        mission?.doctrineOverrides
      );

      // Update radar based on doctrine
      const hasNearbyContacts = checkNearbyThreats(unit, allUnits, state.scenario.playerSide, 100);
      const shouldRadar = shouldRadarBeActive(doctrine, hasNearbyContacts);

      let updatedOrders: UnitOrders = {
        ...currentOrders,
        radarActive: shouldRadar,
      };

      // Check withdrawal
      if (shouldWithdraw(doctrine, unit.damageState) && mission) {
        // Withdraw to first reference point or away from threats
        if (mission.referencePoints.length > 0) {
          updatedOrders = {
            ...updatedOrders,
            waypoints: [{ position: mission.referencePoints[0] }],
            throttle: 4, // flank speed
          };
          newOrders.set(unit.id, updatedOrders);
          continue;
        }
      }

      // Execute mission behavior
      if (mission) {
        updatedOrders = executeMission(
          unit,
          updatedOrders,
          mission,
          doctrine,
          allUnits,
          state.scenario.playerSide
        );
      } else {
        // No mission — hold position with default behavior
        updatedOrders = {
          ...updatedOrders,
          throttle: 2,
        };
      }

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
  playerSide: string
): UnitOrders {
  switch (mission.type) {
    case "patrol":
      return executePatrol(unit, orders, mission, doctrine, allUnits, playerSide);
    case "cap":
      return executeCAP(unit, orders, mission, doctrine, allUnits, playerSide);
    case "strike":
      return executeStrike(unit, orders, mission, allUnits);
    case "escort":
      return executeEscort(unit, orders, mission, allUnits);
    case "transit":
      return executeTransit(unit, orders, mission);
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
  allUnits: Unit[],
  playerSide: string
): UnitOrders {
  // If we have no waypoints, generate the next patrol leg
  if (orders.waypoints.length === 0 && mission.referencePoints.length > 0) {
    const idx = patrolWaypointIndex.get(unit.id) ?? 0;
    const waypoints = generatePatrolWaypoints(mission, unit, idx);
    patrolWaypointIndex.set(unit.id, (idx + 1) % mission.referencePoints.length);

    return {
      ...orders,
      waypoints: waypoints.map((p) => ({ position: p })),
      throttle: 2, // cruise
    };
  }

  // Check for prosecution — chase nearby threats
  if (doctrine.roe === "weapons-free") {
    const nearestThreat = findNearestEnemy(unit, allUnits, playerSide);
    if (nearestThreat) {
      const dist = distanceKm(unit.position, nearestThreat.position);
      if (dist <= mission.prosecutionRange) {
        // Prosecute — head toward contact
        return {
          ...orders,
          waypoints: [{ position: nearestThreat.position }],
          throttle: 3, // full speed
        };
      }
    }
  }

  return orders;
}

function executeCAP(
  unit: Unit,
  orders: UnitOrders,
  mission: Mission,
  doctrine: Doctrine,
  allUnits: Unit[],
  playerSide: string
): UnitOrders {
  // Check for intercept opportunity
  if (doctrine.roe !== "weapons-hold") {
    const nearestThreat = findNearestEnemy(unit, allUnits, playerSide);
    if (nearestThreat && nearestThreat.altitude !== undefined) {
      // Air target detected
      const dist = distanceKm(unit.position, nearestThreat.position);
      if (dist <= mission.prosecutionRange) {
        // Intercept
        return {
          ...orders,
          waypoints: [{ position: nearestThreat.position }],
          throttle: 4, // afterburner
        };
      }
    }
  }

  // No threats — orbit the CAP station
  if (orders.waypoints.length === 0) {
    const waypoints = generateCAPWaypoints(mission, unit);
    return {
      ...orders,
      waypoints: waypoints.map((p) => ({ position: p })),
      throttle: 2,
    };
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
    const waypoints = generateStrikeWaypoints(mission, targetPos);
    return {
      ...orders,
      waypoints: waypoints.map((p) => ({ position: p })),
      throttle: 3,
    };
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
  if (dist > 3) {
    return {
      ...orders,
      waypoints: [{ position: stationPos }],
      throttle: 2,
    };
  }

  return { ...orders, throttle: 2 };
}

function executeTransit(
  unit: Unit,
  orders: UnitOrders,
  mission: Mission
): UnitOrders {
  if (orders.waypoints.length > 0) return orders;

  const waypoints = generateTransitWaypoints(mission);
  if (waypoints.length === 0) return orders;

  return {
    ...orders,
    waypoints: waypoints.map((p) => ({ position: p })),
    throttle: 2,
  };
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
    return {
      ...orders,
      waypoints: [
        { position: { lng: center.lng - offset, lat: center.lat } },
        { position: { lng: center.lng + offset, lat: center.lat } },
      ],
      throttle: 2,
    };
  }
  return orders;
}

// --- Helpers ---

function checkNearbyThreats(
  unit: Unit,
  allUnits: Unit[],
  playerSide: string,
  rangeKm: number
): boolean {
  return allUnits.some(
    (u) =>
      u.side === playerSide &&
      u.damageState !== "destroyed" &&
      distanceKm(unit.position, u.position) <= rangeKm
  );
}

function findNearestEnemy(
  unit: Unit,
  allUnits: Unit[],
  playerSide: string
): Unit | null {
  let nearest: Unit | null = null;
  let nearestDist = Infinity;

  for (const u of allUnits) {
    if (u.side !== playerSide || u.damageState === "destroyed") continue;
    const dist = distanceKm(unit.position, u.position);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = u;
    }
  }

  return nearest;
}

export function resetAITimer(): void {
  lastAIUpdateTime = 0;
  patrolWaypointIndex.clear();
}
