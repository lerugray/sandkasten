/**
 * Air operations (SAND-AIR-1): aircraft launch, airborne flight, recovery and turnaround.
 *
 * Parked aircraft are a count on their host unit's `airWing`, not units of their own. A LAUNCH
 * order moves one aircraft out of the host's air wing and spawns a launching unit; the sim then
 * advances it through `launching` -> `airborne` -> `landing` -> (parked, in turnaround) on the
 * sim clock, so it works identically in continuous time and WeGo resolution.
 *
 * Everything here is pure state transformation; no React, no RNG. The combat record is reused
 * for the player-visible traffic ("LAUNCH", "LOST"), which is why the phase threads combatState.
 */

import type { Unit, AirWingSlot } from "@/types/game";
import type { GameState, UnitOrders } from "./gameState";
import { distanceKm } from "./movement";
import {
  aircraftCruiseAltitudeFt,
  aircraftCruiseSpeedKts,
  aircraftEnduranceMs,
  getPlatform,
} from "@/lib/platforms/lookup";
import { appendCombatEvent, type CombatState } from "./combat";

/** A launching aircraft sits on deck for this long before it is airborne (sim ms). */
export const LAUNCH_DELAY_MS = 30_000;
/** A landing aircraft is on approach for this long before it parks (sim ms). */
export const LANDING_DELAY_MS = 30_000;
/** Within this distance of the host a recovering aircraft transitions to its approach. */
export const RECOVERY_ARRIVAL_KM = 3;
/** Fallback turnaround when a scenario slot does not say. */
export const DEFAULT_TURNAROUND_MS = 5 * 60_000;

let airSeq = 0;

/** Current launched-aircraft id counter, for a battle checkpoint. */
export function getAirSeq(): number {
  return airSeq;
}

/** Make sure no new launched-aircraft id can repeat one at or below `floor` (a restored battle already holds them). */
export function reserveAirSeq(floor: number): void {
  if (Number.isFinite(floor) && floor > airSeq) airSeq = Math.floor(floor);
}

function nextAirId(): string {
  airSeq += 1;
  return `air-${airSeq}`;
}

/** Short display name for a launched aircraft. */
function aircraftCallSign(platformId: number, seq: number): string {
  const CALLSIGNS: Record<number, string> = {
    10006: "Hornet",
    10008: "Hawkeye",
    10016: "Tomcat",
    10015: "Phantom",
    10009: "Orion",
    10010: "Seahawk",
  };
  return `${CALLSIGNS[platformId] ?? "Aircraft"} ${seq}`;
}

function findUnit(state: GameState, id: string): Unit | undefined {
  return state.sides.flatMap((s) => s.units).find((u) => u.id === id);
}

function mapUnits(state: GameState, fn: (u: Unit) => Unit): GameState {
  return {
    ...state,
    sides: state.sides.map((s) => ({ ...s, units: s.units.map(fn) })),
  };
}

function updateUnit(state: GameState, id: string, fn: (u: Unit) => Unit): GameState {
  return mapUnits(state, (u) => (u.id === id ? fn(u) : u));
}

function updateOrders(state: GameState, id: string, fn: (o: UnitOrders) => UnitOrders): GameState {
  const orders = state.orders.get(id);
  if (!orders) return state;
  const map = new Map(state.orders);
  map.set(id, fn(orders));
  return { ...state, orders: map };
}

function removeUnit(state: GameState, id: string): GameState {
  const sides = state.sides.map((s) => ({ ...s, units: s.units.filter((u) => u.id !== id) }));
  const orders = new Map(state.orders);
  orders.delete(id);
  return { ...state, sides, orders };
}

function destroyUnit(state: GameState, id: string): GameState {
  return updateUnit(state, id, (u) => ({ ...u, damageState: "destroyed", speed: 0 }));
}

function totalParked(host: Unit): number {
  return (host.airWing ?? []).reduce((n, s) => n + s.count, 0);
}

/** A slot that may launch, matching the requested platform when one is given; a ready slot is preferred. */
export function findReadySlot(host: Unit, platformId?: number, simTime?: number): { slot: AirWingSlot; index: number } | null {
  const usable = (host.airWing ?? [])
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => (platformId === undefined || slot.platformId === platformId) && slot.count > 0);
  if (usable.length === 0) return null;
  if (platformId !== undefined || simTime === undefined) return usable[0];
  return usable.find(({ slot }) => slot.readyAtMs <= simTime) ?? usable[0];
}

export interface LaunchResult {
  ok: boolean;
  message: string;
  state: GameState;
  combatState: CombatState;
  unitId?: string;
}

/**
 * Move one aircraft from the host's air wing onto the deck as a launching unit.
 * The sim clock then carries it through `runAirOps`.
 */
export function launchAircraft(
  state: GameState,
  combatState: CombatState,
  hostUnitId: string,
  platformId?: number
): LaunchResult {
  const host = findUnit(state, hostUnitId);
  if (!host) return { ok: false, message: "No such unit", state, combatState };
  if (host.damageState === "destroyed") return { ok: false, message: `${host.name} is destroyed`, state, combatState };

  const ready = findReadySlot(host, platformId, state.simTime);
  if (!ready) {
    return {
      ok: false,
      message: platformId === undefined ? `${host.name} has no aircraft to launch` : `${host.name} has no aircraft of that type to launch`,
      state,
      combatState,
    };
  }
  if (state.simTime < ready.slot.readyAtMs) {
    const leftMs = ready.slot.readyAtMs - state.simTime;
    const leftMin = Math.ceil(leftMs / 60000);
    return { ok: false, message: `${getPlatform(ready.slot.platformId)?.name ?? "Aircraft"} still rearming — about ${leftMin} min to go`, state, combatState };
  }

  const seq = airSeq + 1;
  const name = aircraftCallSign(ready.slot.platformId, seq);
  const unit: Unit = {
    id: nextAirId(),
    name,
    platformId: ready.slot.platformId,
    side: host.side,
    position: { ...host.position },
    heading: host.heading,
    speed: 0,
    altitude: 0,
    damageState: "undamaged",
    hostUnitId: host.id,
    airStatus: "launching",
    launchReadyAtMs: state.simTime + LAUNCH_DELAY_MS,
    fuelRemainingMs: aircraftEnduranceMs(ready.slot.platformId),
  };

  // One fewer aircraft parked; the slot itself stays so recovery can put it back.
  const nextAirWing = host.airWing!.map((slot, i) =>
    i === ready.index ? { ...slot, count: slot.count - 1 } : slot
  );
  const sides = state.sides.map((s) =>
    s.name === host.side
      ? {
          ...s,
          units: s.units.map((u) => (u.id === host.id ? { ...u, airWing: nextAirWing } : u)),
        }
      : s
  );

  const orders = new Map(state.orders);
  orders.set(unit.id, {
    unitId: unit.id,
    waypoints: [],
    throttle: 0,
    speedKts: 0,
    radarActive: true,
  });

  const newState: GameState = {
    ...state,
    sides: sides.map((s) => (s.name === host.side ? { ...s, units: [...s.units, unit] } : s)),
    orders,
  };

  const newCombat = appendCombatEvent(combatState, {
    time: state.simTime,
    type: "launch",
    description: `${unit.name} launching from ${host.name}`,
    unitId: unit.id,
    targetId: host.id,
    side: host.side,
  });

  return { ok: true, message: `${unit.name} launching from ${host.name}`, state: newState, combatState: newCombat, unitId: unit.id };
}

/** Mark an airborne aircraft as ordered to return to its host. */
export function markRecovering(state: GameState, unitId: string): GameState {
  return updateUnit(state, unitId, (u) => ({ ...u, recovering: true }));
}

/**
 * One simulated step of the air phase: launches complete, fuel burns, recoveries chase their
 * host and land, destroyed hosts lose their parked aircraft, and aircraft with no deck divert.
 */
export function runAirOps(
  state: GameState,
  combatState: CombatState | undefined,
  dtMs: number
): { state: GameState; combatState: CombatState | undefined } {
  const simTime = state.simTime;
  let newState = state;
  let newCombat = combatState;
  const log = (event: Parameters<typeof appendCombatEvent>[1]) => {
    if (newCombat) newCombat = appendCombatEvent(newCombat, event);
  };

  // 1. A destroyed host loses its parked aircraft, once (zeroing the counts makes it one-shot).
  for (const side of state.sides) {
    for (const host of side.units) {
      if (host.damageState !== "destroyed" || !host.airWing) continue;
      const lost = totalParked(host);
      if (lost === 0) continue;
      newState = updateUnit(newState, host.id, (u) => ({ ...u, airWing: (u.airWing ?? []).map((s) => ({ ...s, count: 0 })) }));
      log({ time: simTime, type: "destroyed", description: `${lost} aircraft lost with ${host.name}`, targetId: host.id, side: host.side });
    }
  }

  // 2. Advance every launched aircraft through its own state.
  const launched = state.sides.flatMap((s) => s.units).filter((u) => u.airStatus && u.hostUnitId);
  for (const u of launched) {
    const host = findUnit(newState, u.hostUnitId!);
    const hostAlive = !!host && host.damageState !== "destroyed";

    if (u.airStatus === "launching") {
      if (!hostAlive) {
        newState = destroyUnit(newState, u.id);
        log({ time: simTime, type: "destroyed", description: `${u.name} was lost with ${host?.name ?? "its host"}`, targetId: u.id, side: u.side });
        continue;
      }
      if (u.launchReadyAtMs !== undefined && simTime >= u.launchReadyAtMs) {
        const cruise = aircraftCruiseSpeedKts(u.platformId);
        const altitude = aircraftCruiseAltitudeFt(u.platformId);
        newState = updateUnit(newState, u.id, (unit) => ({
          ...unit,
          airStatus: "airborne",
          launchReadyAtMs: undefined,
          speed: cruise,
          altitude,
        }));
        newState = updateOrders(newState, u.id, (o) => ({ ...o, throttle: 2, speedKts: cruise }));
        log({ time: simTime, type: "launch", description: `${u.name} airborne from ${host!.name}`, unitId: u.id, targetId: host!.id, side: u.side });
      }
      continue;
    }

    if (u.airStatus === "airborne") {
      const fuel = Math.max(0, (u.fuelRemainingMs ?? 0) - dtMs);
      if (fuel <= 0) {
        newState = destroyUnit(newState, u.id);
        log({ time: simTime, type: "destroyed", description: `${u.name} ran out of fuel and was lost`, targetId: u.id, side: u.side });
        continue;
      }
      if (fuel !== u.fuelRemainingMs) newState = updateUnit(newState, u.id, (unit) => ({ ...unit, fuelRemainingMs: fuel }));

      if (u.recovering && !hostAlive) {
        newState = updateUnit(newState, u.id, (unit) => ({ ...unit, recovering: false }));
        log({ time: simTime, type: "miss", description: `${u.name} has no deck to land on — diverting`, unitId: u.id, side: u.side });
        continue;
      }

      if (u.recovering && hostAlive) {
        const dist = distanceKm(u.position, host!.position);
        if (dist <= RECOVERY_ARRIVAL_KM) {
          newState = updateUnit(newState, u.id, (unit) => ({
            ...unit,
            airStatus: "landing",
            landReadyAtMs: simTime + LANDING_DELAY_MS,
            speed: 0,
            recovering: false,
          }));
          newState = updateOrders(newState, u.id, (o) => ({ ...o, waypoints: [], throttle: 0, speedKts: 0 }));
          log({ time: simTime, type: "launch", description: `${u.name} on final approach to ${host!.name}`, unitId: u.id, targetId: host!.id, side: u.side });
        } else {
          // Keep chasing the host where it is now; the carrier keeps moving.
          newState = updateOrders(newState, u.id, (o) => ({
            ...o,
            waypoints: [{ position: { ...host!.position } }],
            throttle: 2,
            speedKts: aircraftCruiseSpeedKts(u.platformId),
          }));
        }
      }
      continue;
    }

    if (u.airStatus === "landing") {
      if (!hostAlive) {
        newState = destroyUnit(newState, u.id);
        log({ time: simTime, type: "destroyed", description: `${u.name} was lost with ${host?.name ?? "its host"}`, targetId: u.id, side: u.side });
        continue;
      }
      if (u.landReadyAtMs !== undefined && simTime >= u.landReadyAtMs) {
        newState = recoverAircraft(newState, u, simTime);
        log({ time: simTime, type: "launch", description: `${u.name} recovered aboard ${host!.name}`, unitId: u.id, targetId: host!.id, side: u.side });
      }
      continue;
    }
  }

  return { state: newState, combatState: newCombat };
}

/** Park a landed aircraft back into its host's air wing and start its turnaround timer. */
function recoverAircraft(state: GameState, aircraft: Unit, simTime: number): GameState {
  const without = removeUnit(state, aircraft.id);
  return updateUnit(without, aircraft.hostUnitId!, (host) => {
    const slot = (host.airWing ?? []).find((s) => s.platformId === aircraft.platformId);
    const turnaroundMs = slot?.turnaroundMs ?? DEFAULT_TURNAROUND_MS;
    const airWing = (host.airWing ?? []).map((s) =>
      s.platformId === aircraft.platformId
        ? { ...s, count: s.count + 1, readyAtMs: Math.max(simTime, s.readyAtMs) + turnaroundMs }
        : s
    );
    return {
      ...host,
      airWing: slot ? airWing : [...(host.airWing ?? []), { platformId: aircraft.platformId, count: 1, readyAtMs: simTime + turnaroundMs, turnaroundMs }],
    };
  });
}
