import type { Position, Unit } from "@/types/game";
import type { ScenarioConfig } from "@/lib/simulation/session";
import type { EventState } from "@/lib/ai/events";
import { isPointInPolygon } from "@/lib/ai/events";
import { distanceNm } from "@/lib/simulation/movement";

/**
 * The shipped "transit" mission, read off the scenario's own end events and reference area, so the briefing,
 * the plot and the progress readout all describe the exact rule the event evaluator runs.
 */
export interface TransitObjective {
  side: string;
  unitId: string;
  unitName: string;
  /** name without the hull number, for running text */
  unitShort: string;
  areaId: string;
  areaName: string;
  /** the evaluator's own polygon for this area */
  area: Position[];
  gateLabel: string;
}

export const GATE_LABEL = "TRANSIT GATE";

const shortName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "");

export function transitObjective(config: Pick<ScenarioConfig, "scenario" | "events">): TransitObjective | null {
  const events = config.events?.events ?? [];
  const win = events.find(
    (e) =>
      e.actions.some((a) => a.type === "EndScenario" && a.result === "victory") &&
      e.triggers.some((t) => t.type === "UnitEntersArea" && !!t.unitId),
  );
  const trig = win?.triggers.find((t) => t.type === "UnitEntersArea");
  if (!trig || trig.type !== "UnitEntersArea" || !trig.unitId) return null;
  const lose = events.find(
    (e) =>
      e.actions.some((a) => a.type === "EndScenario" && a.result === "defeat") &&
      e.triggers.some((t) => t.type === "UnitDestroyed" && t.unitId === trig.unitId),
  );
  if (!lose) return null;
  const ref = config.scenario.referencePoints.find((r) => r.id === trig.areaId && r.type === "area");
  const unit = config.scenario.sides.flatMap((s) => s.units).find((u) => u.id === trig.unitId);
  if (!ref || ref.points.length < 3 || !unit) return null;
  return {
    side: trig.side,
    unitId: unit.id,
    unitName: unit.name,
    unitShort: shortName(unit.name),
    areaId: ref.id,
    areaName: ref.name,
    area: ref.points,
    gateLabel: GATE_LABEL,
  };
}

/** Plain-English mission lines: what is protected, what wins, what loses. */
export function missionLines(o: TransitObjective) {
  return {
    protect: `${o.unitName}`,
    win: `${o.unitShort} enters the ${o.gateLabel.toLowerCase()} afloat`,
    lose: `${o.unitShort} is destroyed`,
    notes: "No time limit. Escort ships, score and the clock cannot complete or fail the mission.",
  };
}

/** Distance in nautical miles from a point to the nearest edge of the polygon; 0 inside. */
export function distanceToAreaNm(p: Position, area: Position[]): number {
  if (isPointInPolygon(p, area)) return 0;
  const cos = Math.cos((p.lat * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0; i < area.length; i++) {
    const a = area[i];
    const b = area[(i + 1) % area.length];
    const ax = (a.lng - p.lng) * cos, ay = a.lat - p.lat;
    const bx = (b.lng - p.lng) * cos, by = b.lat - p.lat;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const q: Position = { lng: p.lng + (ax + dx * t) / cos, lat: p.lat + ay + dy * t };
    best = Math.min(best, distanceNm(p, q));
  }
  return best;
}

export type MissionStatus = "pending" | "complete" | "failed" | "ended";

export interface MissionProgress {
  status: MissionStatus;
  unit: Unit | undefined;
  unitState: "undamaged" | "damaged" | "mission-kill" | "destroyed" | "unknown";
  /** nautical miles to the nearest gate edge, 0 inside; informational, never completion */
  distanceNm: number | null;
}

export function missionProgress(o: TransitObjective, units: Unit[], result: EventState["scenarioResult"]): MissionProgress {
  const unit = units.find((u) => u.id === o.unitId);
  const status: MissionStatus = !result ? "pending" : result.result === "victory" ? "complete" : result.result === "defeat" ? "failed" : "ended";
  return {
    status,
    unit,
    unitState: unit?.damageState ?? "unknown",
    distanceNm: unit ? distanceToAreaNm(unit.position, o.area) : null,
  };
}

export const UNIT_STATE_LABEL: Record<MissionProgress["unitState"], string> = {
  undamaged: "AFLOAT, UNDAMAGED",
  damaged: "AFLOAT, DAMAGED",
  "mission-kill": "MISSION KILL",
  destroyed: "DESTROYED",
  unknown: "UNKNOWN",
};

/** The single opening briefing message the scenario shows when it loads, or its plain briefing text. */
export function openingBriefing(config: Pick<ScenarioConfig, "scenario" | "events">): { title: string; text: string } {
  for (const ev of config.events?.events ?? []) {
    if (!ev.triggers.some((t) => t.type === "ScenarioLoaded")) continue;
    for (const a of ev.actions) {
      if (a.type === "DisplayMessage") return { title: a.title ?? "BRIEFING", text: a.text };
    }
  }
  return { title: "BRIEFING", text: config.scenario.briefing };
}
