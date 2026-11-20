import { describe, expect, it } from "vitest";
import type { Scenario, VictoryCondition } from "@/types/game";
import {
  compileVictoryConditions,
  describeVictoryCondition,
  editorScenarioConfig,
  validateReferencePoints,
  validateVictoryConditions,
} from "../victoryConditions";
import { evaluateEvents } from "@/lib/ai/events";
import { createInitialGameState, type GameState } from "@/lib/simulation/gameState";

const scenario: Scenario = {
  name: "Editor Test",
  description: "",
  briefing: "",
  theater: { center: { lng: 56.5, lat: 26.5 }, zoom: 7 },
  startTime: "2026-01-01T00:00:00.000Z",
  playerSide: "Side A",
  sides: [
    {
      name: "Side A",
      color: "#00aaff",
      isAI: false,
      units: [
        { id: "a1", name: "Alpha", platformId: 1, side: "Side A", position: { lng: 56, lat: 26 }, heading: 0, speed: 0, damageState: "undamaged" },
      ],
    },
    {
      name: "Side B",
      color: "#ff4444",
      isAI: true,
      units: [
        { id: "b1", name: "Bravo", platformId: 2, side: "Side B", position: { lng: 57, lat: 27 }, heading: 0, speed: 0, damageState: "undamaged" },
      ],
    },
  ],
  referencePoints: [
    {
      id: "area-1",
      name: "Gate",
      type: "area",
      side: "Side A",
      points: [
        { lng: 56.2, lat: 26.4 },
        { lng: 56.4, lat: 26.4 },
        { lng: 56.4, lat: 26.6 },
      ],
    },
  ],
};

const cond = (c: Partial<VictoryCondition> & { id: string; kind: VictoryCondition["kind"] }): VictoryCondition => ({
  result: "victory",
  message: "done",
  ...c,
});

describe("compileVictoryConditions", () => {
  it("builds the ending events for every supported kind", () => {
    const events = compileVictoryConditions(scenario, [
      cond({ id: "d", kind: "destroy-unit", unitId: "b1", result: "victory" }),
      cond({ id: "p", kind: "protect-unit", unitId: "a1" }),
      cond({ id: "r", kind: "reach-area", areaId: "area-1", unitId: "a1", result: "victory" }),
      cond({ id: "h", kind: "hold-area", areaId: "area-1", side: "Side A", count: 2, minutes: 30 }),
      cond({ id: "t", kind: "time-limit", minutes: 45, result: "defeat" }),
      cond({ id: "s", kind: "score", side: "Side A", threshold: 100, comparison: "gte", result: "victory" }),
    ]);
    expect(events.map((e) => e.name)).toEqual([
      "vc-d-destroy",
      "vc-p-protect",
      "vc-r-reach",
      "vc-h-hold",
      "vc-h-fail",
      "vc-t-time",
      "vc-s-score",
    ]);
    const hold = events.find((e) => e.name === "vc-h-hold")!;
    expect(hold.triggers).toEqual([{ type: "Time", time: new Date(scenario.startTime).getTime() + 30 * 60000 }]);
    expect(hold.conditions).toEqual([{ type: "UnitCountInArea", side: "Side A", areaId: "area-1", count: 2, comparison: "gte" }]);
    const fail = events.find((e) => e.name === "vc-h-fail")!;
    expect(fail.conditions).toEqual([{ type: "UnitCountInArea", side: "Side A", areaId: "area-1", count: 1, comparison: "lte" }]);
  });

  it("produces the plain-English line the player briefs", () => {
    expect(describeVictoryCondition(scenario, cond({ id: "d", kind: "destroy-unit", unitId: "b1", result: "victory" }))).toEqual([
      { result: "victory", text: "Bravo is destroyed" },
    ]);
    expect(describeVictoryCondition(scenario, cond({ id: "p", kind: "protect-unit", unitId: "a1" }))).toEqual([
      { result: "defeat", text: "Alpha is destroyed" },
    ]);
  });
});

describe("validateReferencePoints", () => {
  it("accepts a valid point and area", () => {
    const r = validateReferencePoints(scenario.referencePoints);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.points).toHaveLength(1);
  });
  it("refuses an area with fewer than 3 points", () => {
    const r = validateReferencePoints([{ id: "x", name: "X", type: "area", points: [{ lng: 1, lat: 1 }] }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/fewer than 3 points/);
  });
  it("refuses a duplicate id and an off-map point", () => {
    expect(validateReferencePoints([
      { id: "x", name: "X", type: "point", points: [{ lng: 1, lat: 1 }] },
      { id: "x", name: "Y", type: "point", points: [{ lng: 2, lat: 2 }] },
    ]).ok).toBe(false);
    expect(validateReferencePoints([{ id: "x", name: "X", type: "point", points: [{ lng: 200, lat: 1 }] }]).ok).toBe(false);
  });
});

describe("validateVictoryConditions", () => {
  it("refuses a dangling unit and a non-area reference", () => {
    expect(validateVictoryConditions(scenario.sides, scenario.referencePoints, "Side A", [cond({ id: "x", kind: "destroy-unit", unitId: "nope" })]).ok).toBe(false);
    expect(validateVictoryConditions(scenario.sides, scenario.referencePoints, "Side A", [cond({ id: "x", kind: "reach-area", areaId: "area-1", unitId: "nope" })]).ok).toBe(false);
  });
  it("refuses an unknown kind", () => {
    expect(validateVictoryConditions(scenario.sides, scenario.referencePoints, "Side A", [{ id: "x", kind: "nonsense", result: "victory", message: "" }]).ok).toBe(false);
  });
});

describe("editor scenario events end a run for real", () => {
  function game(units: GameState["sides"]): GameState {
    const s: Scenario = { ...scenario, sides: units };
    return createInitialGameState(s);
  }

  it("destroy-unit victory fires when the target is destroyed", () => {
    const conditions = [cond({ id: "win", kind: "destroy-unit", unitId: "b1", result: "victory" })];
    const cfg = editorScenarioConfig({ ...scenario, victoryConditions: conditions });
    const gs = game(scenario.sides);
    gs.sides.flatMap((s) => s.units).find((u) => u.id === "b1")!.damageState = "destroyed";
    const result = evaluateEvents(cfg.events!, gs, [], { terminalOnly: true });
    expect(result.eventState.scenarioResult?.result).toBe("victory");
  });

  it("protect-unit defeat fires when the protected unit is destroyed", () => {
    const conditions = [cond({ id: "lose", kind: "protect-unit", unitId: "a1" })];
    const cfg = editorScenarioConfig({ ...scenario, victoryConditions: conditions });
    const gs = game(scenario.sides);
    gs.sides.flatMap((s) => s.units).find((u) => u.id === "a1")!.damageState = "destroyed";
    const result = evaluateEvents(cfg.events!, gs, [], { terminalOnly: true });
    expect(result.eventState.scenarioResult?.result).toBe("defeat");
  });
});
