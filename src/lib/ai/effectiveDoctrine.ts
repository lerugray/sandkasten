import type { Unit } from "@/types/game";
import type { GameState } from "@/lib/simulation/gameState";
import type { Mission } from "./missions";
import { DEFAULT_DOCTRINE, type Doctrine } from "./doctrine";

/** The mission a unit belongs to: listed in assignedUnitIds, or labelled with the mission's id or name. */
export function missionOf(unit: Unit, missions: Mission[]): Mission | undefined {
  return missions.find(
    (m) =>
      m.side === unit.side &&
      (m.assignedUnitIds.includes(unit.id) || (unit.mission !== undefined && (unit.mission === m.id || unit.mission === m.name)))
  );
}

/**
 * The one place a unit's doctrine is resolved, for the AI and for combat alike.
 * Later wins: default, side (scenario), side (runtime event), mission (scenario),
 * mission (runtime event), then the commander's order on the unit.
 */
export function resolveUnitDoctrine(
  unit: Unit,
  state: Pick<GameState, "orders" | "sideDoctrineOverrides" | "missionDoctrineOverrides">,
  ctx: { missions: Mission[]; sideDoctrine: Record<string, Partial<Doctrine>> }
): Doctrine {
  const mission = missionOf(unit, ctx.missions);
  return {
    ...DEFAULT_DOCTRINE,
    ...ctx.sideDoctrine[unit.side],
    ...state.sideDoctrineOverrides?.[unit.side],
    ...mission?.doctrineOverrides,
    ...(mission
      ? { ...state.missionDoctrineOverrides?.[`${unit.side}:${mission.id}`], ...state.missionDoctrineOverrides?.[`${unit.side}:${mission.name}`] }
      : {}),
    ...state.orders.get(unit.id)?.doctrine,
  };
}
