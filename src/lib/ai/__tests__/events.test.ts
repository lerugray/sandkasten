import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { evaluateEvents, type EventState, type ScenarioEvent } from "../events";
import { unit, makeState, contactOn, withContacts } from "@/lib/simulation/__tests__/fixtures";
import { demoScenarioConfig } from "@/lib/scenarios/demoConfig";
import { createInitialGameState } from "@/lib/simulation/gameState";
import { demoScenario } from "@/lib/scenarios/demo";

const SINA = 2106;
const MAHAN = 111;

afterEach(() => vi.restoreAllMocks());

const es = (events: ScenarioEvent[]): EventState => ({ events, firedEvents: new Set(), messages: [] });
const score = (side: string, amount: number) => ({ type: "ChangeScore" as const, side, amount });

describe("S2-11 TriggerEvent runs the forced event", () => {
  it("executes the forced event's actions once, with a cycle guard", () => {
    const state = makeState([unit("a", "Iran", SINA, 56, 26)]);
    const events = es([
      { name: "A", repeatable: false, triggers: [{ type: "ScenarioLoaded" }], conditions: [], actions: [{ type: "TriggerEvent", eventName: "B" }] },
      { name: "B", repeatable: false, triggers: [{ type: "Time", time: 9e15 }], conditions: [], actions: [score("US Navy", 10), { type: "TriggerEvent", eventName: "A" }] },
    ]);
    const r = evaluateEvents(events, state, []);
    const total = r.stateChanges.filter((c) => c.type === "score").length;
    expect(total).toBe(1);
    expect(r.eventState.firedEvents.has("A")).toBe(true);
    expect(r.eventState.firedEvents.has("B")).toBe(true);
  });
});

describe("S2-17 event side filters", () => {
  it("UnitDetected needs the requested side to be the one detected", () => {
    const mahan = unit("mahan", "US Navy", MAHAN, 56, 26);
    const sina = unit("sina", "Iran", SINA, 56, 26.3);
    let state = makeState([mahan, sina]);
    // Blue holds a contact on a Red unit; the event asks for Blue detecting *Iran*: fires.
    // A Blue-owned contact on a Blue unit must not satisfy "Iran detected".
    const ev = (side: string, by: string): ScenarioEvent => ({
      name: `${side}-${by}`, repeatable: false, triggers: [{ type: "UnitDetected", side, detectedBySide: by }], conditions: [], actions: [score("US Navy", 1)],
    });
    state = withContacts(state, "US Navy", [contactOn(state, mahan, "US Navy", "tracked")]);
    expect(evaluateEvents(es([ev("Iran", "US Navy")]), state, []).stateChanges).toHaveLength(0);
    state = withContacts(state, "US Navy", [contactOn(state, sina, "US Navy", "tracked")]);
    expect(evaluateEvents(es([ev("Iran", "US Navy")]), state, []).stateChanges).toHaveLength(1);
    expect(evaluateEvents(es([ev("US Navy", "Iran")]), state, []).stateChanges).toHaveLength(0);
  });

  it("an Iran-owned contact on a US ship satisfies 'Iran detects US Navy'", () => {
    const mahan = unit("mahan", "US Navy", MAHAN, 56, 26);
    const sina = unit("sina", "Iran", SINA, 56, 26.3);
    let state = makeState([mahan, sina]);
    state = withContacts(state, "Iran", [contactOn(state, mahan, "Iran", "tracked")]);
    const e: ScenarioEvent = { name: "x", repeatable: false, triggers: [{ type: "UnitDetected", side: "US Navy", detectedBySide: "Iran" }], conditions: [], actions: [score("US Navy", 1)] };
    expect(evaluateEvents(es([e]), state, []).stateChanges).toHaveLength(1);
  });

  it("SideIs checks the side that triggered the event", () => {
    const sina = unit("sina", "Iran", SINA, 56, 26);
    let state = makeState([sina, unit("mahan", "US Navy", MAHAN, 57, 25)]);
    state = { ...state, sides: state.sides.map((s) => ({ ...s, units: s.units.map((u) => (u.id === "sina" ? { ...u, damageState: "destroyed" as const } : u)) })) };
    const mk = (side: string): ScenarioEvent => ({
      name: side, repeatable: false, triggers: [{ type: "UnitDestroyed", side: "Iran" }], conditions: [{ type: "SideIs", side }], actions: [score("US Navy", 1)],
    });
    expect(evaluateEvents(es([mk("US Navy")]), state, []).stateChanges).toHaveLength(0);
    expect(evaluateEvents(es([mk("Iran")]), state, []).stateChanges).toHaveLength(1);
  });

  it("TimeInterval does not mutate the shared scenario definition", () => {
    const state = makeState([unit("a", "Iran", SINA, 56, 26)]);
    const trigger = { type: "TimeInterval" as const, intervalMs: 1000 };
    const e: ScenarioEvent = { name: "tick", repeatable: true, triggers: [trigger], conditions: [], actions: [score("US Navy", 1)] };
    evaluateEvents(es([e]), { ...state, simTime: state.simTime + 5000 }, []);
    expect(Object.keys(trigger)).toEqual(["type", "intervalMs"]);
  });
});

describe("S2-15 the demo is won by transiting, not by waiting", () => {
  const fresh = () => {
    const state = createInitialGameState(demoScenario);
    return { ...state, simTime: state.scenario.startTime + 3 * 3600 * 1000 };
  };
  const events = () => ({ ...demoScenarioConfig.events!, firedEvents: new Set<string>(), messages: [] });

  it("waiting outside the gate for hours is not a victory", () => {
    const r = evaluateEvents(events(), fresh(), demoScenarioConfig.missions ?? []);
    expect(r.eventState.scenarioResult).toBeUndefined();
  });

  it("the carrier reaching the transit gate wins", () => {
    const state = fresh();
    const gate = state.referencePoints.find((p) => p.type === "area" && /transit/i.test(p.id))!;
    expect(gate).toBeTruthy();
    const lng = gate.points.reduce((a, p) => a + p.lng, 0) / gate.points.length;
    const lat = gate.points.reduce((a, p) => a + p.lat, 0) / gate.points.length;
    const moved = { ...state, sides: state.sides.map((s) => ({ ...s, units: s.units.map((u) => (u.id === "us-cvn-1" ? { ...u, position: { lng, lat } } : u)) })) };
    const r = evaluateEvents(events(), moved, demoScenarioConfig.missions ?? []);
    expect(r.eventState.scenarioResult?.result).toBe("victory");
  });

  it("a lost carrier is a defeat that a later victory cannot overwrite", () => {
    const state = fresh();
    const gate = state.referencePoints.find((p) => p.type === "area" && /transit/i.test(p.id))!;
    const inGate = gate.points[0];
    const ruined = { ...state, sides: state.sides.map((s) => ({ ...s, units: s.units.map((u) => (u.id === "us-cvn-1" ? { ...u, position: { lng: inGate.lng + 0.01, lat: inGate.lat + 0.01 }, damageState: "destroyed" as const } : u)) })) };
    const first = evaluateEvents(events(), ruined, demoScenarioConfig.missions ?? []);
    expect(first.eventState.scenarioResult?.result).toBe("defeat");
    // the carrier "arrives" later; the terminal result must stand
    const later = evaluateEvents(first.eventState, { ...ruined, sides: ruined.sides.map((s) => ({ ...s, units: s.units.map((u) => (u.id === "us-cvn-1" ? { ...u, damageState: "undamaged" as const } : u)) })) }, []);
    expect(later.eventState.scenarioResult?.result).toBe("defeat");
  });
});
