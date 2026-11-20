/**
 * Player missions (SAND-MISSIONS-1): the player can create PATROL, STRIKE and INTERCEPT/CAP
 * missions and assign own units — ships, scenario aircraft and launched aircraft alike — to them.
 * The same mission model and waypoint generators that drive the AI drive the player's units, and
 * a mission aircraft recovers aboard its host when its strike is done or its fuel runs low.
 *
 * Everything here is pure state transformation; no React, no RNG.
 */

import type { Position, Unit } from "@/types/game";
import type { GameState, UnitOrders } from "@/lib/simulation/gameState";
import type { Mission, MissionType } from "./missions";
import type { AIState } from "./aiController";
import { executeMission, runtimeOf, threatsFor } from "./aiController";
import { resolveUnitDoctrine } from "./effectiveDoctrine";
import { shouldRadarBeActive, type Doctrine } from "./doctrine";
import { distanceKm } from "@/lib/simulation/movement";
import { launchAircraft, markRecovering } from "@/lib/simulation/airOps";
import type { CombatState } from "@/lib/simulation/combat";

/** Below this much flight endurance an airborne mission aircraft turns for its host. */
export const BINGO_FUEL_MS = 5 * 60_000;

export type PlayerMissionType = Extract<MissionType, "patrol" | "strike" | "cap">;

export interface CreateMissionInput {
  type: PlayerMissionType;
  name?: string;
  referencePoints: Position[];
  doctrineOverrides?: Partial<Doctrine>;
  targetUnitId?: string;
}

const MISSION_LABEL: Record<PlayerMissionType, string> = {
  patrol: "PATROL",
  strike: "STRIKE",
  cap: "INTERCEPT",
};

function nextMissionId(missions: Mission[]): string {
  let max = 0;
  for (const m of missions) {
    const match = /^player-mission-(\d{1,12})$/.exec(m.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `player-mission-${max + 1}`;
}

/** Create a new player mission. The session checks the order lock before calling this. */
export function createPlayerMission(
  state: GameState,
  input: CreateMissionInput,
  side: string
): { ok: boolean; message: string; state: GameState; missionId?: string } {
  if (!MISSION_LABEL[input.type]) return { ok: false, message: "Unknown mission type", state };
  if (!input.referencePoints.length) return { ok: false, message: "A mission needs at least one reference point", state };

  const missions = state.playerMissions ?? [];
  const id = nextMissionId(missions);
  const mission: Mission = {
    id,
    name: input.name ?? `${MISSION_LABEL[input.type]} ${missions.length + 1}`,
    side,
    type: input.type,
    assignedUnitIds: [],
    referencePoints: input.referencePoints,
    prosecutionRange: 120,
    repeating: input.type !== "strike",
    doctrineOverrides: input.doctrineOverrides ?? { roe: "weapons-free" },
  };
  if (input.targetUnitId) mission.targetUnitId = input.targetUnitId;

  return {
    ok: true,
    message: `${mission.name} created — assign units to it.`,
    state: { ...state, playerMissions: [...missions, mission] },
    missionId: id,
  };
}

function findMission(state: GameState, missionId: string): Mission | undefined {
  return (state.playerMissions ?? []).find((m) => m.id === missionId);
}

function findOwnUnit(state: GameState, unitId: string): Unit | undefined {
  const unit = state.sides.flatMap((s) => s.units).find((u) => u.id === unitId);
  return unit && unit.side === state.scenario.playerSide ? unit : undefined;
}

/** Assign one of the player's own units to a player mission. */
export function assignPlayerMissionUnit(
  state: GameState,
  unitId: string,
  missionId: string
): { ok: boolean; message: string; state: GameState } {
  const mission = findMission(state, missionId);
  if (!mission) return { ok: false, message: "No such mission", state };
  const unit = findOwnUnit(state, unitId);
  if (!unit || unit.damageState === "destroyed") return { ok: false, message: "No such unit", state };
  if (mission.assignedUnitIds.includes(unitId)) return { ok: false, message: `${unit.name} is already on ${mission.name}`, state };

  return {
    ok: true,
    message: `${unit.name} assigned to ${mission.name}.`,
    state: {
      ...state,
      playerMissions: (state.playerMissions ?? []).map((m) =>
        m.id === missionId ? { ...m, assignedUnitIds: [...m.assignedUnitIds, unitId] } : m
      ),
    },
  };
}

/** Take one of the player's own units off a player mission (its manual orders take over again). */
export function unassignPlayerMissionUnit(
  state: GameState,
  unitId: string,
  missionId: string
): { ok: boolean; message: string; state: GameState } {
  const mission = findMission(state, missionId);
  if (!mission) return { ok: false, message: "No such mission", state };
  if (!mission.assignedUnitIds.includes(unitId)) return { ok: false, message: "That unit is not on this mission", state };

  return {
    ok: true,
    message: "Unit removed from the mission.",
    state: {
      ...state,
      playerMissions: (state.playerMissions ?? []).map((m) =>
        m.id === missionId
          ? {
              ...m,
              assignedUnitIds: m.assignedUnitIds.filter((id) => id !== unitId),
              inProgressUnitIds: (m.inProgressUnitIds ?? []).filter((id) => id !== unitId),
            }
          : m
      ),
    },
  };
}

/** Launch one aircraft from a host's air wing straight onto a player mission (SAND-AIR-1 launch + assignment). */
export function launchPlayerMissionAircraft(
  state: GameState,
  combatState: CombatState,
  missionId: string,
  hostUnitId: string,
  platformId?: number
): { ok: boolean; message: string; state: GameState; combatState: CombatState } {
  const mission = findMission(state, missionId);
  if (!mission) return { ok: false, message: "No such mission", state, combatState };
  const host = findOwnUnit(state, hostUnitId);
  if (!host || host.damageState === "destroyed") return { ok: false, message: "No such unit", state, combatState };

  const result = launchAircraft(state, combatState, hostUnitId, platformId);
  if (!result.ok) return { ok: false, message: result.message, state, combatState };
  const unitId = result.unitId!;

  return {
    ok: true,
    message: `${result.message} Assigned to ${mission.name}.`,
    state: {
      ...result.state,
      playerMissions: (result.state.playerMissions ?? []).map((m) =>
        m.id === missionId ? { ...m, assignedUnitIds: [...m.assignedUnitIds, unitId] } : m
      ),
    },
    combatState: result.combatState,
  };
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Drive the player's mission-assigned units. Runs every simulation step (continuous and WeGo
 * resolution), like the AI cycle but only for the player's side and only for units the player
 * assigned to a player mission — every other player order is left exactly as the player gave it.
 */
export function runPlayerMissions(
  state: GameState,
  ai: AIState
): { state: GameState; orders: Map<string, UnitOrders> } {
  const missions = state.playerMissions ?? [];
  if (missions.length === 0) return { state, orders: state.orders };

  const playerSide = state.scenario.playerSide;
  const allUnits = state.sides.flatMap((s) => s.units);
  const threats = threatsFor(state, playerSide);
  const rt = runtimeOf(ai);

  let newState = state;
  const newOrders = new Map(state.orders);

  const nextMissions = missions.map((mission) => {
    let assigned = [...mission.assignedUnitIds];
    let inProgress = [...(mission.inProgressUnitIds ?? [])];
    let changed = false;

    for (const unitId of [...assigned]) {
      const unit = allUnits.find((u) => u.id === unitId);
      if (!unit || unit.side !== playerSide || unit.damageState === "destroyed") continue;
      // A launching or landing aircraft is advanced by airOps, not by mission waypoints.
      if (unit.airStatus === "launching" || unit.airStatus === "landing") continue;

      const current = newOrders.get(unit.id);
      if (!current) continue;

      const doctrine = resolveUnitDoctrine(unit, newState, {
        missions: state.playerMissions ?? [],
        sideDoctrine: ai.sideDoctrine,
      });
      const hasNearby = threats.some((t) => distanceKm(unit.position, t.position) <= 100);
      let updated: UnitOrders = { ...current, radarActive: shouldRadarBeActive(doctrine, hasNearby) };

      // Low fuel: the mission is over for this aircraft; airOps chases the host from here.
      if (
        unit.airStatus === "airborne" &&
        unit.hostUnitId &&
        !unit.recovering &&
        (unit.fuelRemainingMs ?? Number.POSITIVE_INFINITY) <= BINGO_FUEL_MS
      ) {
        newState = markRecovering(newState, unit.id);
        newOrders.set(unit.id, { ...updated, waypoints: [], throttle: 0, speedKts: 0 });
        continue;
      }

      // Strike completion: the route is done once the aircraft is back at its base point.
      if (mission.type === "strike" && inProgress.includes(unit.id) && updated.waypoints.length === 0) {
        assigned = assigned.filter((id) => id !== unit.id);
        inProgress = inProgress.filter((id) => id !== unit.id);
        changed = true;
        if (unit.airStatus === "airborne" && unit.hostUnitId && !unit.recovering) {
          newState = markRecovering(newState, unit.id);
          updated = { ...updated, waypoints: [], throttle: 0, speedKts: 0 };
        }
        newOrders.set(unit.id, updated);
        continue;
      }

      updated = executeMission(unit, updated, mission, doctrine, allUnits, threats, rt);
      newOrders.set(unit.id, updated);

      if (mission.type === "strike" && updated.waypoints.length > 0 && !inProgress.includes(unit.id)) {
        inProgress = [...inProgress, unit.id];
        changed = true;
      }
    }

    if (!changed && assigned.length === mission.assignedUnitIds.length && arraysEqual(inProgress, mission.inProgressUnitIds ?? [])) {
      return mission;
    }
    return { ...mission, assignedUnitIds: assigned, inProgressUnitIds: inProgress };
  });

  if (nextMissions.some((m, i) => m !== missions[i])) {
    newState = { ...newState, playerMissions: nextMissions };
  }

  return { state: newState, orders: newOrders };
}
