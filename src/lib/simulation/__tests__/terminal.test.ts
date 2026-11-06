import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { simulationTick } from "../engine";
import { createCombatState } from "../combat";
import { unit, makeState, wif, combatWith, resetLegacyTimers } from "./fixtures";
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
