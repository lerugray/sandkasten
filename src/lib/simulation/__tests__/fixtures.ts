import type { Unit, Side } from "@/types/game";
import { createInitialGameState, type Contact, type GameState } from "../gameState";
import * as combatMod from "../combat";
import * as aiMod from "@/lib/ai/aiController";
import * as engineMod from "../engine";
import { createCombatState, type CombatState, type WeaponInFlight } from "../combat";
import { getPlatform } from "@/lib/platforms/lookup";

export const START = "2026-03-15T06:00:00Z";

export function unit(
  id: string,
  side: string,
  platformId: number,
  lng: number,
  lat: number,
  extra: Partial<Unit> = {}
): Unit {
  return { id, name: id, platformId, side, position: { lng, lat }, heading: 0, speed: 0, damageState: "undamaged", ...extra };
}

/** Build a game state from units; sides in `ai` are AI-controlled, everything else is human. */
export function makeState(units: Unit[], opts: { player?: string; ai?: string[] } = {}): GameState {
  const player = opts.player ?? "US Navy";
  const ai = new Set(opts.ai ?? ["Iran"]);
  const names = [...new Set([player, ...units.map((u) => u.side)])];
  const sides: Side[] = names.map((name) => ({
    name,
    color: "#fff",
    isAI: ai.has(name),
    units: units.filter((u) => u.side === name),
  }));
  const state = createInitialGameState({
    name: "test",
    startTime: START,
    playerSide: player,
    sides,
    referencePoints: [],
  });
  return { ...state, isPaused: false };
}

export function contactOn(
  state: GameState,
  actual: Unit,
  side: string,
  classification: Contact["classification"] = "tracked",
  extra: Partial<Contact> = {}
): Contact {
  return {
    id: `c-${side}-${actual.id}`,
    detectedById: "none",
    actualUnitId: actual.id,
    side,
    classification,
    position: { ...actual.position },
    positionUncertainty: 0.5,
    baseUncertainty: 0.5,
    lastUpdateTime: state.simTime,
    lastFixTime: state.simTime,
    sensorType: "radar",
    ...extra,
  };
}

/** Give a side a contact store (the player's goes to state.contacts). */
export function withContacts(state: GameState, side: string, contacts: Contact[]): GameState {
  return side === state.scenario.playerSide
    ? { ...state, contacts }
    : { ...state, sideContacts: { ...state.sideContacts, [side]: contacts } };
}

export function wif(
  shooter: Unit,
  target: Unit,
  weaponName: string,
  over: Partial<WeaponInFlight> = {}
): WeaponInFlight {
  const weapon = getPlatform(shooter.platformId)!.weapons!.find((w) => w.name === weaponName)!;
  return {
    id: `wif-${shooter.id}-${target.id}-${Math.random()}`,
    name: weapon.name,
    launchedBy: shooter.id,
    launchedBySide: shooter.side,
    targetId: target.id,
    position: { ...target.position },
    heading: 0,
    speedKts: weapon.speedKts > 0 ? weapon.speedKts : 530,
    rangeRemainingKm: weapon.rangeKm,
    weapon,
    seekerActive: true,
    seekerRangeKm: 10,
    ...over,
  };
}

export function combatWith(weapons: WeaponInFlight[]): CombatState {
  return { ...createCombatState(), weaponsInFlight: weapons };
}

/** Km per degree of latitude. */
export const KM_LAT = 111.19;

/** Third argument for runCombatPhase: carries the side doctrine and missions (old shape = bare record). */
export function ctx(sideDoctrine: Record<string, object> = {}, missions: unknown[] = []) {
  return Object.assign({}, sideDoctrine, { missions, sideDoctrine }) as never;
}

/** The pre-fix code kept its phase clocks in module globals; clear them if they exist. */
export function resetLegacyTimers(): void {
  const anyMods = [combatMod, aiMod, engineMod] as unknown as Record<string, unknown>[];
  for (const m of anyMods) {
    for (const k of ["resetCombatTimer", "resetAITimer", "resetDetectionTimer"]) {
      if (typeof m[k] === "function") (m[k] as () => void)();
    }
  }
}
