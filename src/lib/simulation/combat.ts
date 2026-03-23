/**
 * Combat resolution system.
 *
 * Handles weapon selection, missile launch, flight, intercept, defense,
 * and damage application. Runs as Phase 5 in the simulation tick.
 *
 * Flow: weapon selection → launch → flight → defense roll → PK roll → damage
 */

import type { Unit, Position } from "@/types/game";
import type { GameState, UnitOrders } from "./gameState";
import { distanceKm, bearingDeg, moveAlongBearing } from "./movement";
import { getPlatform, type PlatformWeapon, type PlatformDefense } from "@/lib/platforms/lookup";
import { shouldEngage, getEngagementRangeFraction, type Doctrine } from "@/lib/ai/doctrine";

const KM_PER_NM = 1.852;

// --- Weapon in flight ---

export interface WeaponInFlight {
  id: string;
  name: string;
  launchedBy: string; // unit ID
  launchedBySide: string;
  targetId: string;
  position: Position;
  heading: number;
  speedKts: number;
  rangeRemainingKm: number;
  weapon: PlatformWeapon;
  // Terminal phase
  seekerActive: boolean;
  seekerRangeKm: number;
}

// --- Combat event log ---

export interface CombatEvent {
  id: string;
  time: number; // sim time
  type: "launch" | "intercept" | "hit" | "miss" | "destroyed" | "damaged" | "defended";
  description: string;
  unitId?: string;
  targetId?: string;
  side: string;
}

// --- Combat state (tracked between ticks) ---

export interface CombatState {
  weaponsInFlight: WeaponInFlight[];
  combatLog: CombatEvent[];
  weaponsExpended: Map<string, Map<string, number>>; // unitId → weaponName → count fired
  cooldowns: Map<string, number>; // unitId → next allowed fire time (sim ms)
}

export function createCombatState(): CombatState {
  return {
    weaponsInFlight: [],
    combatLog: [],
    weaponsExpended: new Map(),
    cooldowns: new Map(),
  };
}

// --- Engagement check interval ---

const ENGAGEMENT_INTERVAL_MS = 5000;
let lastEngagementTime = 0;

/**
 * Run the full combat phase.
 */
export function runCombatPhase(
  state: GameState,
  combatState: CombatState,
  sideDoctrine: Record<string, Partial<Doctrine>>,
  dtSeconds: number
): { state: GameState; combatState: CombatState } {
  let newState = { ...state };
  let newCombat = { ...combatState, weaponsInFlight: [...combatState.weaponsInFlight] };

  // 1. Move weapons in flight
  const moveResult = moveWeapons(newCombat, newState, dtSeconds);
  newCombat = moveResult.combatState;
  newState = moveResult.state;

  // 2. Check for new engagements (throttled)
  if (state.simTime - lastEngagementTime >= ENGAGEMENT_INTERVAL_MS) {
    lastEngagementTime = state.simTime;
    const engResult = checkEngagements(newState, newCombat, sideDoctrine);
    newCombat = engResult.combatState;
  }

  return { state: newState, combatState: newCombat };
}

// --- Weapon movement ---

function moveWeapons(
  combatState: CombatState,
  state: GameState,
  dtSeconds: number
): { combatState: CombatState; state: GameState } {
  const surviving: WeaponInFlight[] = [];
  const newLog = [...combatState.combatLog];
  let newState = state;

  for (const wif of combatState.weaponsInFlight) {
    const distKm = (wif.speedKts * KM_PER_NM * dtSeconds) / 3600;
    const newRange = wif.rangeRemainingKm - distKm;

    // Find target
    const allUnits = newState.sides.flatMap((s) => s.units);
    const target = allUnits.find((u) => u.id === wif.targetId);

    if (!target || target.damageState === "destroyed") {
      // Target gone — weapon lost
      continue;
    }

    // Move toward target
    const bearing = bearingDeg(wif.position, target.position);
    const distToTarget = distanceKm(wif.position, target.position);

    if (newRange <= 0) {
      // Weapon ran out of range
      newLog.push(createEvent(state.simTime, "miss",
        `${wif.name} from ${getUnitName(wif.launchedBy, newState)} ran out of fuel`,
        wif.launchedBy, wif.targetId, wif.launchedBySide));
      continue;
    }

    // Terminal arrival check
    if (distToTarget <= 0.5 || distKm >= distToTarget) {
      // Weapon has arrived at target — resolve hit/miss
      const result = resolveImpact(wif, target, newState, state.simTime);
      newLog.push(...result.events);
      newState = result.state;
      continue;
    }

    // Activate seeker at terminal range
    const seekerActive = distToTarget <= (wif.seekerRangeKm || 10);

    // Move weapon
    const newPos = moveAlongBearing(wif.position, bearing, distKm);
    surviving.push({
      ...wif,
      position: newPos,
      heading: bearing,
      rangeRemainingKm: newRange,
      seekerActive,
    });
  }

  return {
    combatState: { ...combatState, weaponsInFlight: surviving, combatLog: newLog },
    state: newState,
  };
}

// --- Impact resolution ---

function resolveImpact(
  weapon: WeaponInFlight,
  target: Unit,
  state: GameState,
  simTime: number
): { state: GameState; events: CombatEvent[] } {
  const events: CombatEvent[] = [];
  const targetPlatform = getPlatform(target.platformId);
  let newState = state;

  // 1. Run defensive systems
  const defenses = targetPlatform?.defenses ?? [];
  for (const defense of defenses) {
    // Check if defense has remaining uses
    if (defense.quantity !== undefined && defense.quantity <= 0) continue;

    const roll = Math.random();
    if (roll < defense.effectiveness) {
      // Defended
      events.push(createEvent(simTime, "defended",
        `${target.name} defeated ${weapon.name} with ${defense.name}`,
        target.id, weapon.launchedBy, target.side));
      return { state: newState, events };
    }
  }

  // 2. PK roll
  const isAirTarget = (target.altitude ?? 0) > 500;
  const pk = isAirTarget ? weapon.weapon.pkAir : weapon.weapon.pkSurface;
  const pkRoll = Math.random() * 100;

  if (pkRoll > pk) {
    // Miss
    events.push(createEvent(simTime, "miss",
      `${weapon.name} missed ${target.name}`,
      weapon.launchedBy, target.id, weapon.launchedBySide));
    return { state: newState, events };
  }

  // 3. Hit — apply damage
  events.push(createEvent(simTime, "hit",
    `${weapon.name} hit ${target.name}!`,
    weapon.launchedBy, target.id, weapon.launchedBySide));

  const currentHP = targetPlatform?.damagePoints ?? 100;
  const damage = weapon.weapon.warheadDamage;

  // Determine new damage state
  const damageRatio = damage / currentHP;
  let newDamageState = target.damageState;

  if (target.damageState === "undamaged") {
    if (damageRatio >= 0.8 || (isAirTarget && damageRatio >= 0.3)) {
      newDamageState = "destroyed";
    } else if (damageRatio >= 0.5) {
      newDamageState = "mission-kill";
    } else if (damageRatio >= 0.15) {
      newDamageState = "damaged";
    }
  } else if (target.damageState === "damaged") {
    if (damageRatio >= 0.4) {
      newDamageState = "destroyed";
    } else if (damageRatio >= 0.2) {
      newDamageState = "mission-kill";
    }
  } else if (target.damageState === "mission-kill") {
    if (damageRatio >= 0.3) {
      newDamageState = "destroyed";
    }
  }

  if (newDamageState === "destroyed") {
    events.push(createEvent(simTime, "destroyed",
      `${target.name} has been destroyed!`,
      weapon.launchedBy, target.id, weapon.launchedBySide));
  } else if (newDamageState !== target.damageState) {
    events.push(createEvent(simTime, "damaged",
      `${target.name} is now ${newDamageState}`,
      weapon.launchedBy, target.id, weapon.launchedBySide));
  }

  // Apply damage state to unit
  newState = {
    ...newState,
    sides: newState.sides.map((s) => ({
      ...s,
      units: s.units.map((u) =>
        u.id === target.id ? { ...u, damageState: newDamageState } : u
      ),
    })),
  };

  return { state: newState, events };
}

// --- Engagement checks (weapon launch decisions) ---

function checkEngagements(
  state: GameState,
  combatState: CombatState,
  sideDoctrine: Record<string, Partial<Doctrine>>
): { combatState: CombatState } {
  const newLog = [...combatState.combatLog];
  const newWeapons = [...combatState.weaponsInFlight];
  const newExpended = new Map(combatState.weaponsExpended);
  const newCooldowns = new Map(combatState.cooldowns);

  const allUnits = state.sides.flatMap((s) => s.units);

  for (const side of state.sides) {
    const doctrine = {
      roe: "weapons-tight" as const,
      engagementRange: "max" as const,
      radarUsage: "active" as const,
      evasion: "if-attacked" as const,
      withdrawOnDamage: "damaged" as const,
      bvrWvr: "bvr" as const,
      ...sideDoctrine[side.name],
    };

    // Skip player side — player doesn't auto-engage (manual targeting in future)
    if (!side.isAI) continue;

    for (const unit of side.units) {
      if (unit.damageState === "destroyed" || unit.damageState === "mission-kill") continue;

      // Check cooldown
      const cooldownEnd = newCooldowns.get(unit.id) ?? 0;
      if (state.simTime < cooldownEnd) continue;

      const platform = getPlatform(unit.platformId);
      if (!platform?.weapons || platform.weapons.length === 0) continue;

      // Determine if unit is under attack (has incoming weapons)
      const isUnderAttack = combatState.weaponsInFlight.some(
        (w) => w.targetId === unit.id
      );

      if (!shouldEngage(doctrine, isUnderAttack)) continue;

      // Find nearest enemy
      const rangeFraction = getEngagementRangeFraction(doctrine);
      const enemies = allUnits.filter(
        (u) =>
          u.side !== side.name &&
          u.side !== "Civilian" &&
          u.damageState !== "destroyed"
      );

      for (const enemy of enemies) {
        const dist = distanceKm(unit.position, enemy.position);

        // Select best weapon for this target
        const weapon = selectWeapon(
          unit,
          enemy,
          dist,
          platform.weapons,
          rangeFraction,
          newExpended
        );
        if (!weapon) continue;

        // Don't fire if already have weapons heading for this target from this unit
        const alreadyEngaging = newWeapons.some(
          (w) => w.launchedBy === unit.id && w.targetId === enemy.id
        );
        if (alreadyEngaging) continue;

        // Launch weapon
        const wif: WeaponInFlight = {
          id: `wif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: weapon.name,
          launchedBy: unit.id,
          launchedBySide: side.name,
          targetId: enemy.id,
          position: { ...unit.position },
          heading: bearingDeg(unit.position, enemy.position),
          speedKts: weapon.speedKts > 0 ? weapon.speedKts : 530, // default cruise missile speed
          rangeRemainingKm: weapon.rangeKm,
          weapon,
          seekerActive: false,
          seekerRangeKm: weapon.seekerType === "active-radar" ? 10 : 5,
        };

        newWeapons.push(wif);

        // Track expenditure
        const unitExpended = newExpended.get(unit.id) ?? new Map<string, number>();
        unitExpended.set(weapon.name, (unitExpended.get(weapon.name) ?? 0) + 1);
        newExpended.set(unit.id, unitExpended);

        // Set cooldown (30 seconds between salvos for this unit)
        newCooldowns.set(unit.id, state.simTime + 30000);

        newLog.push(createEvent(state.simTime, "launch",
          `${unit.name} launched ${weapon.name} at ${enemy.name}`,
          unit.id, enemy.id, side.name));

        break; // One engagement per tick per unit
      }
    }
  }

  return {
    combatState: {
      ...combatState,
      weaponsInFlight: newWeapons,
      combatLog: newLog,
      weaponsExpended: newExpended,
      cooldowns: newCooldowns,
    },
  };
}

// --- Weapon selection ---

function selectWeapon(
  shooter: Unit,
  target: Unit,
  distKm: number,
  weapons: PlatformWeapon[],
  rangeFraction: number,
  expended: Map<string, Map<string, number>>
): PlatformWeapon | null {
  const isAirTarget = (target.altitude ?? 0) > 500;
  const isSurfaceTarget = !isAirTarget;
  const shooterExpended = expended.get(shooter.id) ?? new Map<string, number>();

  // Filter to weapons that can reach and damage this target type
  const candidates = weapons.filter((w) => {
    // Has relevant PK
    if (isAirTarget && w.pkAir <= 0) return false;
    if (isSurfaceTarget && w.pkSurface <= 0) return false;

    // In range (adjusted by doctrine engagement range)
    if (distKm > w.rangeKm * rangeFraction) return false;

    // Has ammo remaining
    const fired = shooterExpended.get(w.name) ?? 0;
    if (fired >= w.quantity) return false;

    // Guns are only for close range
    if (w.type === "gun" && distKm > w.rangeKm) return false;

    return true;
  });

  if (candidates.length === 0) return null;

  // Prefer guided weapons over guns, higher PK weapons first
  candidates.sort((a, b) => {
    const pkA = isAirTarget ? a.pkAir : a.pkSurface;
    const pkB = isAirTarget ? b.pkAir : b.pkSurface;
    // Prefer non-gun types
    if (a.type !== "gun" && b.type === "gun") return -1;
    if (a.type === "gun" && b.type !== "gun") return 1;
    // Then by PK
    return pkB - pkA;
  });

  return candidates[0];
}

// --- Helpers ---

function createEvent(
  time: number,
  type: CombatEvent["type"],
  description: string,
  unitId: string | undefined,
  targetId: string | undefined,
  side: string
): CombatEvent {
  return {
    id: `ce-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    time,
    type,
    description,
    unitId,
    targetId,
    side,
  };
}

function getUnitName(unitId: string, state: GameState): string {
  const unit = state.sides.flatMap((s) => s.units).find((u) => u.id === unitId);
  return unit?.name ?? unitId;
}

export function resetCombatTimer(): void {
  lastEngagementTime = 0;
}
