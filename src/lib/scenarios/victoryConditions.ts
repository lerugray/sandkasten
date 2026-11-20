import type { Scenario, VictoryCondition, VictoryResult } from "@/types/game";
import type { ScenarioEvent, Trigger, Condition, Action } from "@/lib/ai/events";
import type { ScenarioConfig } from "@/lib/simulation/session";

/**
 * The editor's victory conditions are stored as friendly, typed rules on the scenario and compiled
 * here into the same TCA events the engine already evaluates. The editor never edits raw triggers.
 *
 * Every condition is one ending route: the first event whose trigger and conditions hold ends the
 * run, and defeat outranks a draw which outranks victory (see events.ts). `hold-area` compiles to
 * the natural pair (held -> victory, not held -> defeat) checked at the same moment.
 */

export const VICTORY_KINDS: readonly VictoryCondition["kind"][] = [
  "destroy-unit",
  "destroy-side",
  "protect-unit",
  "reach-area",
  "hold-area",
  "time-limit",
  "score",
];

export const VICTORY_RESULTS: readonly VictoryResult[] = ["victory", "defeat", "draw"];

export const VICTORY_KIND_LABEL: Record<VictoryCondition["kind"], string> = {
  "destroy-unit": "Destroy a unit",
  "destroy-side": "Destroy any unit of a side",
  "protect-unit": "Protect a unit",
  "reach-area": "Reach a reference area",
  "hold-area": "Hold a reference area",
  "time-limit": "Time limit",
  score: "Score threshold",
};

const shortName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, "");

const clockLabel = (scenario: Scenario, minutes: number) => {
  const start = new Date(scenario.startTime).getTime();
  const el = Math.max(0, minutes * 60000);
  const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
  return `T+${pad(el / 3600000)}:${pad((el / 60000) % 60)}:${pad((el / 1000) % 60)}`;
};

const allUnits = (scenario: Scenario) => scenario.sides.flatMap((s) => s.units);

function end(result: VictoryResult, message: string): Action {
  return { type: "EndScenario", result, message };
}

function event(name: string, triggers: Trigger[], conditions: Condition[], actions: Action[]): ScenarioEvent {
  return { name, repeatable: false, triggers, conditions, actions };
}

/** One scenario event per ending the condition declares. Names are derived from the condition id and stay unique. */
export function compileVictoryCondition(scenario: Scenario, c: VictoryCondition): ScenarioEvent[] {
  const playerSide = scenario.playerSide;
  const msg = c.message.trim() || defaultMessage(c);
  const start = new Date(scenario.startTime).getTime();
  switch (c.kind) {
    case "destroy-unit":
      return [event(`vc-${c.id}-destroy`, [{ type: "UnitDestroyed", unitId: c.unitId }], [], [end(c.result, msg)])];
    case "destroy-side":
      return [event(`vc-${c.id}-destroy`, [{ type: "UnitDestroyed", side: c.side ?? playerSide }], [], [end(c.result, msg)])];
    case "protect-unit":
      return [event(`vc-${c.id}-protect`, [{ type: "UnitDestroyed", unitId: c.unitId }], [], [end("defeat", msg)])];
    case "reach-area": {
      const trig: Trigger = c.unitId
        ? { type: "UnitEntersArea", side: c.side ?? playerSide, areaId: c.areaId!, unitId: c.unitId }
        : { type: "UnitEntersArea", side: c.side ?? playerSide, areaId: c.areaId! };
      return [event(`vc-${c.id}-reach`, [trig], [], [end(c.result, msg)])];
    }
    case "hold-area": {
      const side = c.side ?? playerSide;
      const count = c.count ?? 1;
      const time = start + (c.minutes ?? 0) * 60000;
      const win = event(
        `vc-${c.id}-hold`,
        [{ type: "Time", time }],
        [{ type: "UnitCountInArea", side, areaId: c.areaId!, count, comparison: "gte" }],
        [end("victory", msg)],
      );
      const lose = event(
        `vc-${c.id}-fail`,
        [{ type: "Time", time }],
        [{ type: "UnitCountInArea", side, areaId: c.areaId!, count: Math.max(0, count - 1), comparison: "lte" }],
        [end("defeat", msg)],
      );
      return [win, lose];
    }
    case "time-limit":
      return [event(`vc-${c.id}-time`, [{ type: "Time", time: start + (c.minutes ?? 0) * 60000 }], [], [end(c.result, msg)])];
    case "score":
      return [
        event(
          `vc-${c.id}-score`,
          [{ type: "SideScore", side: c.side ?? playerSide, threshold: c.threshold ?? 0, comparison: c.comparison ?? "gte" }],
          [],
          [end(c.result, msg)],
        ),
      ];
    default:
      return [];
  }
}

export function compileVictoryConditions(scenario: Scenario, conditions: VictoryCondition[]): ScenarioEvent[] {
  return conditions.flatMap((c) => compileVictoryCondition(scenario, c));
}

/** A default debrief line the author can replace. */
function defaultMessage(c: VictoryCondition): string {
  switch (c.kind) {
    case "destroy-unit":
      return c.result === "victory" ? "Target destroyed." : "The target was destroyed.";
    case "destroy-side":
      return c.result === "victory" ? "The enemy side has been struck." : "A unit of the named side was destroyed.";
    case "protect-unit":
      return "A unit that had to survive was destroyed.";
    case "reach-area":
      return c.result === "victory" ? "The unit reached the area." : "The unit reached the area.";
    case "hold-area":
      return "The area was not held.";
    case "time-limit":
      return c.result === "victory" ? "The mission clock ran out with the objective secured." : "The mission clock ran out.";
    case "score":
      return c.result === "victory" ? "Score threshold reached." : "Score threshold reached.";
  }
}

/** Plain-English text of one outcome, in the same present-tense style the play view briefs the player. */
export interface ConditionText {
  result: VictoryResult;
  text: string;
}

export function describeVictoryCondition(scenario: Scenario, c: VictoryCondition): ConditionText[] {
  const playerSide = scenario.playerSide;
  const side = c.side ?? playerSide;
  const unit = c.unitId ? allUnits(scenario).find((u) => u.id === c.unitId) : undefined;
  const area = c.areaId ? scenario.referencePoints.find((r) => r.id === c.areaId) : undefined;
  const unitWord = unit ? shortName(unit.name) : "a unit";
  switch (c.kind) {
    case "destroy-unit":
      return [{ result: c.result, text: `${unit ? shortName(unit.name) : "the chosen unit"} is destroyed` }];
    case "destroy-side":
      return [{ result: c.result, text: `any ${side} unit is destroyed` }];
    case "protect-unit":
      return [{ result: "defeat", text: `${unit ? shortName(unit.name) : "the protected unit"} is destroyed` }];
    case "reach-area":
      return [
        {
          result: c.result,
          text: c.unitId
            ? `${unit ? shortName(unit.name) : unitWord} enters ${area?.name ?? "the area"} while not destroyed`
            : `a ${side} unit enters ${area?.name ?? "the area"} while not destroyed`,
        },
      ];
    case "hold-area": {
      const count = c.count ?? 1;
      const when = `at ${clockLabel(scenario, c.minutes ?? 0)}`;
      const inArea = `afloat in ${area?.name ?? "the area"}`;
      return [
        { result: "victory", text: `${when}, at least ${count} ${side} ${count === 1 ? "unit is" : "units are"} ${inArea}` },
        { result: "defeat", text: `${when}, fewer than ${count} ${side} ${count === 1 ? "unit is" : "units are"} ${inArea}` },
      ];
    }
    case "time-limit":
      return [{ result: c.result, text: `the mission clock reaches ${clockLabel(scenario, c.minutes ?? 0)}` }];
    case "score":
      return [{ result: c.result, text: `${side} score is ${c.comparison === "lte" ? "at most" : "at least"} ${c.threshold ?? 0}` }];
  }
}

/**
 * The full play configuration for a scenario built in the editor: the scenario itself, its compiled
 * victory-condition events, and no missions or doctrine overrides (an editor scenario starts clean).
 */
export function editorScenarioConfig(scenario: Scenario): ScenarioConfig {
  const events = compileVictoryConditions(scenario, scenario.victoryConditions ?? []);
  return {
    scenario,
    missions: [],
    sideDoctrine: {},
    events: { events, firedEvents: new Set(), messages: [] },
  };
}

// --- Validation used by the editor LOAD path (parseScenario.ts) -------------------------------

export function validateReferencePoints(v: unknown): { ok: true; points: Scenario["referencePoints"] } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, points: [] };
  if (!Array.isArray(v)) return { ok: false, error: "That file is not a scenario: referencePoints is not a list." };
  const points: Scenario["referencePoints"] = [];
  const ids = new Set<string>();
  for (let i = 0; i < v.length; i++) {
    const rp = v[i] as Record<string, unknown>;
    const at = `reference point #${i + 1}`;
    if (typeof rp !== "object" || rp === null || Array.isArray(rp)) return { ok: false, error: `That scenario is refused: ${at} is not an object.` };
    if (typeof rp.id !== "string" || !rp.id.trim()) return { ok: false, error: `That scenario is refused: ${at} has no id.` };
    if (ids.has(rp.id)) return { ok: false, error: `That scenario is refused: reference point id "${rp.id}" is used twice.` };
    ids.add(rp.id);
    if (typeof rp.name !== "string") return { ok: false, error: `That scenario is refused: ${at} has no name.` };
    if (rp.type !== "point" && rp.type !== "area") return { ok: false, error: `That scenario is refused: ${at} has an unknown type (it must be "point" or "area").` };
    if (rp.side !== undefined && rp.side !== null && typeof rp.side !== "string") return { ok: false, error: `That scenario is refused: ${at}'s side is not text.` };
    if (!Array.isArray(rp.points)) return { ok: false, error: `That scenario is refused: ${at} has no points list.` };
    const pts = rp.points.map((p, j) => {
      if (typeof p !== "object" || p === null || typeof (p as Record<string, unknown>).lat !== "number" || typeof (p as Record<string, unknown>).lng !== "number") {
        return { bad: true, j };
      }
      const lat = (p as Record<string, unknown>).lat as number;
      const lng = (p as Record<string, unknown>).lng as number;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { offMap: true, j };
      return { lat, lng };
    });
    const badPt = pts.find((p) => (p as { bad?: boolean }).bad);
    if (badPt) return { ok: false, error: `That scenario is refused: ${at} has a point that is not a position.` };
    const offPt = pts.find((p) => (p as { offMap?: boolean }).offMap);
    if (offPt) return { ok: false, error: `That scenario is refused: ${at} has a point off the map (latitude must be -90 to 90, longitude -180 to 180).` };
    if (rp.type === "area" && pts.length < 3) return { ok: false, error: `That scenario is refused: ${at} is an area but has fewer than 3 points.` };
    points.push({
      id: rp.id as string,
      name: rp.name as string,
      type: rp.type as "point" | "area",
      side: rp.side as string | undefined,
      points: pts as Scenario["referencePoints"][number]["points"],
    });
  }
  return { ok: true, points };
}

export function validateVictoryConditions(
  sides: Scenario["sides"],
  referencePoints: Scenario["referencePoints"],
  playerSide: string,
  v: unknown,
): { ok: true; conditions: VictoryCondition[] } | { ok: false; error: string } {
  if (v === undefined || v === null) return { ok: true, conditions: [] };
  if (!Array.isArray(v)) return { ok: false, error: "That file is not a scenario: victoryConditions is not a list." };
  const unitIds = new Set(sides.flatMap((s) => s.units).map((u) => u.id));
  const sideNames = new Set(sides.map((s) => s.name));
  const areaIds = new Set(referencePoints.filter((r) => r.type === "area").map((r) => r.id));
  const conditions: VictoryCondition[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < v.length; i++) {
    const c = v[i] as Record<string, unknown>;
    const at = `victory condition #${i + 1}`;
    if (typeof c !== "object" || c === null || Array.isArray(c)) return { ok: false, error: `That scenario is refused: ${at} is not an object.` };
    if (typeof c.id !== "string" || !c.id.trim()) return { ok: false, error: `That scenario is refused: ${at} has no id.` };
    if (ids.has(c.id)) return { ok: false, error: `That scenario is refused: victory condition id "${c.id}" is used twice.` };
    ids.add(c.id);
    if (!VICTORY_KINDS.includes(c.kind as VictoryCondition["kind"])) return { ok: false, error: `That scenario is refused: ${at} has an unknown kind.` };
    if (!VICTORY_RESULTS.includes(c.result as VictoryResult)) return { ok: false, error: `That scenario is refused: ${at} has an unknown result.` };
    if (c.message !== undefined && c.message !== null && typeof c.message !== "string") return { ok: false, error: `That scenario is refused: ${at}'s message is not text.` };
    const kind = c.kind as VictoryCondition["kind"];
    if (c.side !== undefined && c.side !== null) {
      if (typeof c.side !== "string") return { ok: false, error: `That scenario is refused: ${at}'s side is not text.` };
      if (!sideNames.has(c.side)) return { ok: false, error: `That scenario is refused: ${at} names a side that is not in the scenario.` };
    }
    if (c.unitId !== undefined && c.unitId !== null) {
      if (typeof c.unitId !== "string" || !unitIds.has(c.unitId)) return { ok: false, error: `That scenario is refused: ${at} names a unit that is not in the scenario.` };
    }
    if (kind === "destroy-unit" || kind === "protect-unit") {
      if (typeof c.unitId !== "string" || !unitIds.has(c.unitId)) return { ok: false, error: `That scenario is refused: ${at} needs a unit that is in the scenario.` };
    }
    if (c.areaId !== undefined && c.areaId !== null) {
      if (typeof c.areaId !== "string" || !areaIds.has(c.areaId)) return { ok: false, error: `That scenario is refused: ${at} names a reference area that is not in the scenario (or is not an area).` };
    }
    if (kind === "reach-area" || kind === "hold-area") {
      if (typeof c.areaId !== "string" || !areaIds.has(c.areaId)) return { ok: false, error: `That scenario is refused: ${at} needs a reference area that is in the scenario.` };
    }
    if (kind === "hold-area") {
      const count = c.count ?? 1;
      if (typeof count !== "number" || !Number.isFinite(count) || !Number.isInteger(count) || count < 1) {
        return { ok: false, error: `That scenario is refused: ${at}'s unit count must be a whole number of at least 1.` };
      }
      const minutes = c.minutes ?? 0;
      if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0) return { ok: false, error: `That scenario is refused: ${at}'s minutes must be 0 or more.` };
    }
    if (kind === "time-limit") {
      const minutes = c.minutes ?? 0;
      if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes < 0) return { ok: false, error: `That scenario is refused: ${at}'s minutes must be 0 or more.` };
    }
    if (kind === "score") {
      const threshold = c.threshold ?? 0;
      if (typeof threshold !== "number" || !Number.isFinite(threshold)) return { ok: false, error: `That scenario is refused: ${at}'s threshold must be a number.` };
      if (c.comparison !== undefined && c.comparison !== null && c.comparison !== "gte" && c.comparison !== "lte") {
        return { ok: false, error: `That scenario is refused: ${at}'s comparison must be "gte" or "lte".` };
      }
    }
    conditions.push({
      id: c.id as string,
      kind,
      result: (c.result as VictoryResult) ?? "victory",
      message: typeof c.message === "string" ? c.message : "",
      side: c.side as string | undefined,
      unitId: c.unitId as string | undefined,
      areaId: c.areaId as string | undefined,
      count: typeof c.count === "number" ? c.count : undefined,
      threshold: typeof c.threshold === "number" ? c.threshold : undefined,
      comparison: (c.comparison as "gte" | "lte" | undefined) ?? undefined,
      minutes: typeof c.minutes === "number" ? c.minutes : undefined,
    });
  }
  void playerSide;
  return { ok: true, conditions };
}
