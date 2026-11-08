import type { Position, ReferencePoint, Unit } from "@/types/game";
import type { ScenarioConfig } from "@/lib/simulation/session";
import type { Condition, EventState, ScenarioEvent, ScenarioResult, Trigger } from "@/lib/ai/events";
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
  /** Internal provenance keys (event names) of the two transit endings; matched against a result's source, never shown. */
  winEvent: string;
  loseEvent: string;
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
    winEvent: win!.name,
    loseEvent: lose.name,
  };
}

/** Plain-English mission lines: what is protected, what wins, what loses, and what the clock and score do. */
export function missionLines(o: TransitObjective, endings: EndingRules) {
  return {
    protect: `${o.unitName}`,
    ...missionLinesText(o),
    notes: endingNotes(endings, true),
  };
}

// --- Ending rules: a plain-language reading of the scenario's EndScenario events, never a second evaluator ---

export interface EndingRule {
  result: ScenarioResult["result"];
  /** Player-facing condition (present tense): no event, dependency or hidden-unit names. */
  text: string;
  usesClock: boolean;
  usesScore: boolean;
  /** Part of the Hormuz transit pair shown by the protected-unit view. */
  transit: boolean;
  /** Internal provenance key (event name); never rendered. */
  event: string;
}

export interface EndingRules {
  /** Endings the briefing may state: every trigger and condition is own-side, public (clock, scoreboard) or side-wide. */
  rules: EndingRule[];
  /** At least one ending exists that cannot be stated without leaking hidden information or unsupported semantics. */
  limited: boolean;
}

const RESULT_WORD = { victory: "VICTORY", defeat: "DEFEAT", draw: "DRAW" } as const;
export const resultWord = (r: ScenarioResult["result"]) => RESULT_WORD[r];

interface Ctx {
  config: Pick<ScenarioConfig, "scenario" | "events">;
  playerSide: string;
  /** After the result the deciding rule may name a hostile target generically; before it, hostile named targets stay unsaid. */
  after: boolean;
}

const allUnits = (c: Ctx) => c.config.scenario.sides.flatMap((sd) => sd.units);
const unitById = (c: Ctx, id: string) => allUnits(c).find((u) => u.id === id);
const knownSide = (c: Ctx, side: string) => c.config.scenario.sides.some((sd) => sd.name === side);
const clockLabel = (c: Ctx, ms: number) => {
  const el = Math.max(0, ms - new Date(c.config.scenario.startTime).getTime());
  const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
  return `T+${pad(el / 3600000)}:${pad((el / 60000) % 60)}:${pad((el / 1000) % 60)}`;
};

function ownArea(c: Ctx, areaId: string): ReferencePoint | null {
  const ref = c.config.scenario.referencePoints.find((r) => r.id === areaId && r.type === "area");
  if (!ref || ref.points.length < 3) return null;
  return !ref.side || ref.side === c.playerSide ? ref : null;
}

interface Part {
  text: string;
  clock?: boolean;
  score?: boolean;
}

function triggerPart(t: Trigger, c: Ctx): Part | null {
  switch (t.type) {
    case "Time":
      return { text: `the mission clock reaches ${clockLabel(c, t.time)}`, clock: true };
    case "SideScore":
      if (!knownSide(c, t.side)) return null;
      return { text: `${t.side} score is ${t.comparison === "gte" ? "at least" : "at most"} ${t.threshold}`, score: true };
    case "UnitEntersArea": {
      const area = t.side === c.playerSide ? ownArea(c, t.areaId) : null;
      if (!area) return null;
      if (!t.unitId) return { text: `a ${t.side} unit enters ${area.name} while not destroyed` };
      const u = unitById(c, t.unitId);
      return u && u.side === c.playerSide ? { text: `${shortName(u.name)} enters ${area.name} while not destroyed` } : null;
    }
    case "UnitLeavesArea": {
      const area = t.side === c.playerSide ? ownArea(c, t.areaId) : null;
      return area ? { text: `every surviving ${t.side} unit is outside ${area.name}` } : null;
    }
    case "UnitDestroyed": {
      if (t.unitId) {
        const u = unitById(c, t.unitId);
        if (!u) return null;
        if (u.side === c.playerSide) return { text: `${shortName(u.name)} is destroyed` };
        return c.after ? { text: "a designated hostile target is destroyed" } : null;
      }
      if (t.side && knownSide(c, t.side)) return { text: `any ${t.side} unit is destroyed` };
      return null;
    }
    case "UnitDamaged": {
      const u = unitById(c, t.unitId);
      return u && u.side === c.playerSide ? { text: `${shortName(u.name)} is damaged or mission-killed` } : null;
    }
    default:
      return null;
  }
}

function conditionPart(cond: Condition, c: Ctx): Part | null {
  if (cond.type !== "UnitCountInArea" || cond.side !== c.playerSide) return null;
  const area = ownArea(c, cond.areaId);
  if (!area) return null;
  return { text: `${cond.comparison === "gte" ? "at least" : "at most"} ${cond.count} ${cond.side} ${cond.count === 1 ? "unit is" : "units are"} afloat in ${area.name}` };
}

/** Triggers are ANY, conditions ALL. Null when any part cannot be stated safely: a partial rule would be a false one. */
function describeEvent(ev: ScenarioEvent, result: ScenarioResult["result"], c: Ctx): EndingRule | null {
  if (ev.triggers.length === 0) return null;
  const trig = ev.triggers.map((t) => triggerPart(t, c));
  const cond = ev.conditions.map((x) => conditionPart(x, c));
  if (trig.some((p) => !p) || cond.some((p) => !p)) return null;
  const tp = trig as Part[];
  const cp = cond as Part[];
  const when = tp.length > 1 ? tp.map((p) => p.text).join(", or ") : tp[0].text;
  const text = cp.length > 0 ? `${when}, while ${cp.map((p) => p.text).join(" and ")}` : when;
  return {
    result,
    text,
    usesClock: tp.some((p) => p.clock),
    usesScore: tp.some((p) => p.score),
    transit: false,
    event: ev.name,
  };
}

const endResults = (ev: ScenarioEvent) =>
  ev.actions.flatMap((a) => (a.type === "EndScenario" ? [a.result] : []));
const RESULT_RANK = { defeat: 3, draw: 2, victory: 1 } as const;

/** Every event name a TriggerEvent action can run from this event, through any number of hops (cycles are walked once). */
function forcedFrom(ev: ScenarioEvent, byName: Map<string, ScenarioEvent>): ScenarioEvent[] {
  const seen = new Set<string>([ev.name]);
  const out: ScenarioEvent[] = [];
  const walk = (e: ScenarioEvent) => {
    for (const a of e.actions) {
      if (a.type !== "TriggerEvent" || seen.has(a.eventName)) continue;
      const t = byName.get(a.eventName);
      if (!t) continue;
      seen.add(t.name);
      out.push(t);
      walk(t);
    }
  };
  walk(ev);
  return out;
}

const forcedTargetNames = (events: ScenarioEvent[], byName: Map<string, ScenarioEvent>) =>
  new Set(events.flatMap((e) => forcedFrom(e, byName).map((t) => t.name)));

/** Every ending the scenario declares, split into what may be stated and what must stay unsaid. */
export function describeEndings(config: Pick<ScenarioConfig, "scenario" | "events">, playerSide: string): EndingRules {
  const c: Ctx = { config, playerSide, after: false };
  const transit = transitObjective(config);
  const rules: EndingRule[] = [];
  let limited = false;
  const events = config.events?.events ?? [];
  const byName = new Map(events.map((e) => [e.name, e] as const));
  const forcedTargets = forcedTargetNames(events, byName);
  for (const ev of events) {
    // an event that forces an ending event is itself an ending route, whatever it is called
    const forced = forcedFrom(ev, byName).flatMap(endResults);
    const results = [...endResults(ev), ...forced];
    if (results.length === 0) continue;
    if (forced.length > 0) {
      if (endResults(ev).length === 0 && ev.triggers.length === 0) continue;
      if (ev.triggers.some((t) => t.type === "Time")) {
        limited = true;
        continue;
      }
    }
    if (transit && forced.length === 0 && !forcedTargets.has(ev.name) && isPureTransit(ev, transit)) {
      rules.push({
        result: ev.name === transit.winEvent ? "victory" : "defeat",
        text: ev.name === transit.winEvent ? missionLinesText(transit).win : missionLinesText(transit).lose,
        usesClock: false,
        usesScore: false,
        transit: true,
        event: ev.name,
      });
      continue;
    }
    // an event ending the run with several results ends with the strongest one (defeat beats draw beats victory)
    const result = results.reduce((a, b) => (RESULT_RANK[b] > RESULT_RANK[a] ? b : a));
    const rule = describeEvent(ev, result, c);
    if (rule) rules.push(rule);
    else limited = true;
  }
  return { rules, limited };
}

/** The shipped transit pair is a single trigger with no conditions each; an event that also ends on anything else is described in full instead. */
const isPureTransit = (ev: ScenarioEvent, o: TransitObjective) =>
  (ev.name === o.winEvent || ev.name === o.loseEvent) &&
  ev.triggers.length === 1 &&
  ev.conditions.length === 0 &&
  endResults(ev).length === 1;

const missionLinesText = (o: TransitObjective) => ({
  win: `${o.unitShort} enters the ${o.gateLabel.toLowerCase()} afloat`,
  lose: `${o.unitShort} is destroyed`,
});

/** The honest closing line for the rules block. The "no time limit" claim is made only when every ending is declared and none uses it. */
export function endingNotes(e: EndingRules, hasTransit: boolean): string {
  const extras = e.rules.filter((r) => !r.transit);
  if (hasTransit && !e.limited && extras.length === 0) {
    return "No time limit. Escort ships, score and the clock cannot complete or fail the mission.";
  }
  if (e.limited) {
    return extras.length > 0 || hasTransit
      ? "The scenario defines other ways to end the run that this briefing does not state. Do not assume time or score are safe."
      : "The scenario defines endings that this briefing does not state.";
  }
  if (extras.length > 0) return "These endings are all in force. The first one met ends the run; defeat outranks a draw, a draw outranks victory.";
  return "No victory conditions are declared for this scenario. Nothing in it ends the run by itself; RESET restarts it.";
}

export type ResultCause =
  | { kind: "transit-win" | "transit-loss" }
  | { kind: "rule"; rule: EndingRule }
  | { kind: "unstated" };

/** What decided a finished run, from the result's own provenance. Anything that cannot be stated safely is "unstated". */
export function explainResult(config: Pick<ScenarioConfig, "scenario" | "events">, playerSide: string, result: ScenarioResult): ResultCause {
  const src = result.source;
  if (!src || src.forcedBy) return { kind: "unstated" };
  const transit = transitObjective(config);
  const ev = (config.events?.events ?? []).find((e) => e.name === src.event);
  if (!ev) return { kind: "unstated" };
  const byName = new Map((config.events?.events ?? []).map((e) => [e.name, e] as const));
  const forcedTargets = forcedTargetNames(config.events?.events ?? [], byName);
  if (transit && forcedFrom(ev, byName).length === 0 && !forcedTargets.has(ev.name) && isPureTransit(ev, transit)) {
    return ev.name === transit.winEvent ? (result.result === "victory" ? { kind: "transit-win" } : { kind: "unstated" }) : result.result === "defeat" ? { kind: "transit-loss" } : { kind: "unstated" };
  }
  const rule = describeEvent(ev, result.result, { config, playerSide, after: true });
  return rule ? { kind: "rule", rule } : { kind: "unstated" };
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
