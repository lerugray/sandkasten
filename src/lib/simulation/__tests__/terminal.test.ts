import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { simulationTick } from "../engine";
import { createCombatState } from "../combat";
import { unit, makeState, wif, combatWith, resetLegacyTimers, START } from "./fixtures";
import { demoScenarioConfig } from "@/lib/scenarios/demoConfig";
import type { EventState, ScenarioEvent } from "@/lib/ai/events";
import type { GameState } from "../gameState";

const MAHAN = 111;
const SINA = 2106;

beforeEach(() => resetLegacyTimers());
afterEach(() => vi.restoreAllMocks());

const GATE = {
  id: "transit-gate",
  name: "Transit Gate",
  type: "area" as const,
  points: [
    { lng: 55.9, lat: 25.9 },
    { lng: 56.1, lat: 25.9 },
    { lng: 56.1, lat: 26.1 },
    { lng: 55.9, lat: 26.1 },
  ],
};

/** The two real demo end events, so the test follows the shipped scenario. */
const demoEndEvents = (): ScenarioEvent[] =>
  demoScenarioConfig.events!.events.filter((e) => e.name === "Transit Complete" || e.name === "Carrier Lost");

const events = (list: ScenarioEvent[] = demoEndEvents()): EventState => ({ events: list, firedEvents: new Set(), messages: [] });

/** The protected ship sits inside the gate; `hits` C-802s are already on top of it. */
function scene(hits: number): { state: GameState; combat: ReturnType<typeof combatWith> } {
  const carrier = unit("us-cvn-1", "US Navy", MAHAN, 56, 26);
  const shooter = unit("ir-1", "Iran", SINA, 56.5, 26.5);
  const state = { ...makeState([carrier, shooter]), referencePoints: [GATE] };
  const combat = hits > 0
    ? combatWith(Array.from({ length: hits }, () => wif(shooter, carrier, "C-802 Noor")))
    : createCombatState();
  return { state, combat };
}

describe("S2-15 the result is decided after combat", () => {
  it("a ship lost on the tick it enters the gate is a defeat, and stays one", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.55);
    const { state, combat } = scene(20);
    const t1 = simulationTick(state, 1000, undefined, events(), combat);
    const carrier = t1.gameState.sides.flatMap((s) => s.units).find((u) => u.id === "us-cvn-1")!;
    expect(carrier.damageState).toBe("destroyed");
    expect(t1.eventState!.scenarioResult?.result).toBe("defeat");

    const t2 = simulationTick(t1.gameState, 1000, undefined, t1.eventState, t1.combatState);
    expect(t2.eventState!.scenarioResult?.result).toBe("defeat");
  });

  it("control: the same transit with no weapon arriving is a victory", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.55);
    const { state, combat } = scene(0);
    const t1 = simulationTick(state, 1000, undefined, events(), combat);
    expect(t1.eventState!.scenarioResult?.result).toBe("victory");
  });

  it("a repeatable terminal event fires once per tick, not once per pass", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.55);
    const { state, combat } = scene(0);
    const announce: ScenarioEvent = {
      name: "Gate Seen",
      repeatable: true,
      triggers: [{ type: "UnitEntersArea", side: "US Navy", areaId: "transit-gate", unitId: "us-cvn-1" }],
      conditions: [],
      actions: [
        { type: "DisplayMessage", side: "US Navy", text: "in the gate" },
        { type: "EndScenario", result: "victory", message: "done" },
      ],
    };
    const t1 = simulationTick(state, 1000, undefined, events([announce]), combat);
    expect(t1.eventState!.messages).toHaveLength(1);
    expect(t1.eventState!.scenarioResult?.result).toBe("victory");
  });

  it("a post-combat event cannot force a terminal event that already ran before combat", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.55);
    const { state, combat } = scene(20);
    const gateScore: ScenarioEvent = {
      name: "Gate Score",
      repeatable: true,
      triggers: [{ type: "UnitEntersArea", side: "US Navy", areaId: "transit-gate", unitId: "us-cvn-1" }],
      conditions: [],
      actions: [
        { type: "DisplayMessage", side: "US Navy", text: "scored" },
        { type: "ChangeScore", side: "US Navy", amount: 10 },
        { type: "EndScenario", result: "victory", message: "gate" },
      ],
    };
    const lossForcesScore: ScenarioEvent = {
      name: "Loss Forces Score",
      repeatable: false,
      triggers: [{ type: "UnitDestroyed", unitId: "us-cvn-1" }],
      conditions: [],
      actions: [
        { type: "TriggerEvent", eventName: "Gate Score" },
        { type: "EndScenario", result: "defeat", message: "lost" },
      ],
    };
    const t1 = simulationTick(state, 1000, undefined, events([gateScore, lossForcesScore]), combat);
    expect(t1.eventState!.scenarioResult?.result).toBe("defeat");
    expect(t1.gameState.score["US Navy"]).toBe(10);
    expect(t1.eventState!.messages).toHaveLength(1);
  });
});

// SAND-PLAY-1: the same rules with the true Nimitz platform and the shipped gate polygon.
describe("SAND-PLAY-1 transit result on the real carrier and the real gate", () => {
  const NIMITZ = 2740;
  const realGate = () => demoScenarioConfig.scenario.referencePoints.find((r) => r.id === "transit-gate")!;
  const centre = () => {
    const p = realGate().points;
    return { lng: p.reduce((a, q) => a + q.lng, 0) / p.length, lat: p.reduce((a, q) => a + q.lat, 0) / p.length };
  };
  const setup = (units: ReturnType<typeof unit>[], hits = 0) => {
    const base = makeState(units);
    const shooter = units.find((u) => u.id === "ir-1");
    const carrier = units.find((u) => u.id === "us-cvn-1")!;
    const state = { ...base, referencePoints: [realGate()] };
    const combat = hits > 0 && shooter ? combatWith(Array.from({ length: hits }, () => wif(shooter, carrier, "C-802 Noor"))) : createCombatState();
    return { state, combat };
  };
  // 0.7 beats every Nimitz decoy/CIWS roll (best is 0.65) and is inside the C-802 Pk of 90
  const far = { lng: 57.5, lat: 25.2 };

  it("time alone never wins: the carrier outside the gate runs for hours with no result", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.7);
    const { state, combat } = setup([unit("us-cvn-1", "US Navy", NIMITZ, far.lng, far.lat)]);
    let g = { ...state, speed: 60 };
    let ev = events();
    let cs = combat;
    for (let i = 0; i < 200; i++) {
      const r = simulationTick(g, 1000, undefined, ev, cs);
      g = r.gameState; ev = r.eventState!; cs = r.combatState!;
    }
    expect(g.simTime - new Date(START).getTime()).toBeGreaterThan(3600_000);
    expect(ev.scenarioResult).toBeUndefined();
  });

  it("an escort entering the gate alone never wins", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.7);
    const c = centre();
    const { state, combat } = setup([
      unit("us-cvn-1", "US Navy", NIMITZ, far.lng, far.lat),
      unit("us-ddg-1", "US Navy", MAHAN, c.lng, c.lat),
    ]);
    const t1 = simulationTick(state, 1000, undefined, events(), combat);
    expect(t1.eventState!.scenarioResult).toBeUndefined();
  });

  it("the living Nimitz entering the real gate wins", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.7);
    const c = centre();
    const { state, combat } = setup([unit("us-cvn-1", "US Navy", NIMITZ, c.lng, c.lat)]);
    const t1 = simulationTick(state, 1000, undefined, events(), combat);
    expect(t1.eventState!.scenarioResult?.result).toBe("victory");
    const t2 = simulationTick(t1.gameState, 1000, undefined, t1.eventState, t1.combatState);
    expect(t2.eventState!.scenarioResult?.result).toBe("victory");
  });

  it("the destroyed Nimitz loses, and a loss on the arrival tick is still a defeat", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.7);
    const c = centre();
    for (const at of [far, c]) {
      const { state, combat } = setup(
        [unit("us-cvn-1", "US Navy", NIMITZ, at.lng, at.lat, { damage: 3500, damageState: "mission-kill" }), unit("ir-1", "Iran", SINA, at.lng + 0.1, at.lat + 0.1)],
        30,
      );
      const t1 = simulationTick(state, 1000, undefined, events(), combat);
      const carrier = t1.gameState.sides.flatMap((s) => s.units).find((u) => u.id === "us-cvn-1")!;
      expect(carrier.damageState).toBe("destroyed");
      expect(t1.eventState!.scenarioResult?.result).toBe("defeat");
      const t2 = simulationTick(t1.gameState, 1000, undefined, t1.eventState, t1.combatState);
      expect(t2.eventState!.scenarioResult?.result).toBe("defeat");
    }
  });
});

describe("SAND-VICTORY-1 final result, provenance and score", () => {
  const score = (side: string, amount: number) => ({ type: "ChangeScore" as const, side, amount });
  const finish = (name: string, result: "victory" | "defeat" | "draw", trigger: ScenarioEvent["triggers"][number], extra: ScenarioEvent["actions"] = [], conditions: ScenarioEvent["conditions"] = []): ScenarioEvent => ({
    name, repeatable: false, triggers: [trigger], conditions, actions: [...extra, { type: "EndScenario", result, message: `m-${name}` }],
  });

  it("a mixed transit plus score ending: the transit arrival with the score line also met is attributed to the event the engine chose", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.55);
    const { state, combat } = scene(0);
    const mixed = events([
      finish("Score Draw", "draw", { type: "SideScore", side: "US Navy", threshold: 5, comparison: "gte" }),
      ...demoEndEvents(),
    ]);
    const withScore = { ...state, score: { ...state.score, "US Navy": 5 } };
    const t1 = simulationTick(withScore, 1000, undefined, mixed, combat);
    // draw (2) outranks the same-tick victory (1), and the result says which event decided it
    expect(t1.eventState!.scenarioResult).toMatchObject({ result: "draw", source: { event: "Score Draw" } });
  });

  it("the arrival tick's own ChangeScore lands once, in the final state, and the score never moves afterwards", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.55);
    const { state, combat } = scene(0);
    const win = finish("Transit Complete", "victory", { type: "UnitEntersArea", side: "US Navy", areaId: "transit-gate", unitId: "us-cvn-1" }, [score("US Navy", 25)]);
    const t1 = simulationTick(state, 1000, undefined, events([win]), combat);
    expect(t1.eventState!.scenarioResult?.source?.event).toBe("Transit Complete");
    expect(t1.gameState.score["US Navy"]).toBe(25);
    const t2 = simulationTick(t1.gameState, 5000, undefined, t1.eventState, t1.combatState);
    expect(t2.gameState.score["US Navy"]).toBe(25);
    expect(t2.eventState!.scenarioResult).toBe(t1.eventState!.scenarioResult);
  });

  it("zero and negative scores are real values", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.55);
    const { state, combat } = scene(0);
    const lose = finish("Transit Complete", "victory", { type: "UnitEntersArea", side: "US Navy", areaId: "transit-gate", unitId: "us-cvn-1" }, [score("Iran", -15)]);
    const t1 = simulationTick(state, 1000, undefined, events([lose]), combat);
    expect(t1.gameState.score).toMatchObject({ "US Navy": 0, Iran: -15 });
  });

  it("a score threshold ends the run exactly when the score reaches it (SideScore, actual side and comparison)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.55);
    const { state, combat } = scene(0);
    const ev = events([finish("Score Win", "victory", { type: "SideScore", side: "US Navy", threshold: 30, comparison: "gte" })]);
    const t1 = simulationTick({ ...state, score: { ...state.score, "US Navy": 29 } }, 1000, undefined, ev, combat);
    expect(t1.eventState!.scenarioResult).toBeUndefined();
    const t2 = simulationTick({ ...state, score: { ...state.score, "US Navy": 30 } }, 1000, undefined, ev, combat);
    expect(t2.eventState!.scenarioResult).toMatchObject({ result: "victory", source: { event: "Score Win" } });
  });

  it("the shipped transit tick carries the transit event as its source", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.55);
    const { state, combat } = scene(0);
    const t1 = simulationTick(state, 1000, undefined, events(), combat);
    expect(t1.eventState!.scenarioResult?.source).toEqual({ event: "Transit Complete" });
    const lost = scene(20);
    const t2 = simulationTick(lost.state, 1000, undefined, events(), lost.combat);
    expect(t2.eventState!.scenarioResult?.source).toEqual({ event: "Carrier Lost" });
  });
});
