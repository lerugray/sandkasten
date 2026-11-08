import { describe, it, expect } from "vitest";
import type { Scenario } from "@/types/game";
import type { ScenarioEvent, ScenarioResult } from "@/lib/ai/events";
import { demoScenarioConfig } from "../demoConfig";
import { describeEndings, endingNotes, explainResult, missionLines, transitObjective } from "../objective";

// LABELLED FIXTURES: synthetic configurations for the ending presenter. They test how the existing event model is
// described; they do not establish sustained-hold, destroy-all or any other semantics the evaluator lacks.

const GATE = { id: "gate", name: "Alpha Gate", type: "area" as const, points: [{ lng: 0, lat: 0 }, { lng: 1, lat: 0 }, { lng: 1, lat: 1 }, { lng: 0, lat: 1 }] };
const SECRET_AREA = { id: "mines", name: "Hidden Minefield", type: "area" as const, side: "Iran", points: GATE.points };

const scenario = (): Scenario =>
  ({
    name: "Fixture",
    briefing: "b",
    startTime: "2026-03-15T06:00:00Z",
    playerSide: "US Navy",
    referencePoints: [GATE, SECRET_AREA],
    sides: [
      { name: "US Navy", color: "#fff", isAI: false, units: [
        { id: "us-1", name: "USS Alpha (CV-1)", platformId: 1, side: "US Navy", position: { lng: 0.5, lat: 0.5 }, heading: 0, speed: 0, damageState: "undamaged" },
        { id: "us-2", name: "USS Bravo (DD-2)", platformId: 1, side: "US Navy", position: { lng: 0.5, lat: 0.5 }, heading: 0, speed: 0, damageState: "undamaged" },
      ] },
      { name: "Iran", color: "#f00", isAI: true, units: [
        { id: "ir-secret", name: "Secret Boghammar 7", platformId: 1, side: "Iran", position: { lng: 9.9, lat: 9.9 }, heading: 0, speed: 0, damageState: "undamaged" },
      ] },
    ],
  }) as unknown as Scenario;

const T0 = new Date("2026-03-15T06:00:00Z").getTime();
const end = (name: string, result: ScenarioResult["result"], triggers: ScenarioEvent["triggers"], conditions: ScenarioEvent["conditions"] = []): ScenarioEvent => ({
  name,
  repeatable: false,
  triggers,
  conditions,
  actions: [{ type: "EndScenario", result, message: `msg ${name}` }],
});
const cfg = (events: ScenarioEvent[]) => ({ scenario: scenario(), events: { events, firedEvents: new Set<string>(), messages: [] } });
const SIDE = "US Navy";

const demoEndings = () => describeEndings(demoScenarioConfig, SIDE);

describe("SAND-VICTORY-1 Hormuz keeps its rule", () => {
  it("states the transit pair and the no-time-limit note only because every ending is declared", () => {
    const e = demoEndings();
    expect(e.limited).toBe(false);
    expect(e.rules.map((r) => [r.result, r.transit])).toEqual([["victory", true], ["defeat", true]]);
    expect(missionLines(transitObjective(demoScenarioConfig)!, e).notes).toMatch(/No time limit/);
  });

  it("attributes a Nimitz arrival and a Nimitz loss to the transit pair, by provenance", () => {
    const win: ScenarioResult = { result: "victory", message: "m", source: { event: "Transit Complete" } };
    const lose: ScenarioResult = { result: "defeat", message: "m", source: { event: "Carrier Lost" } };
    expect(explainResult(demoScenarioConfig, SIDE, win).kind).toBe("transit-win");
    expect(explainResult(demoScenarioConfig, SIDE, lose).kind).toBe("transit-loss");
  });

  it("never claims a transit cause from the result word alone", () => {
    expect(explainResult(demoScenarioConfig, SIDE, { result: "victory", message: "m" }).kind).toBe("unstated");
    // a victory decided by some other event is not the transit victory
    expect(explainResult(demoScenarioConfig, SIDE, { result: "victory", message: "m", source: { event: "Reinforcement Boghammar" } }).kind).toBe("unstated");
    // the transit event's name with the wrong result word is not a transit cause either
    expect(explainResult(demoScenarioConfig, SIDE, { result: "defeat", message: "m", source: { event: "Transit Complete" } }).kind).toBe("unstated");
  });
});

describe("SAND-VICTORY-1 mixed endings are not described as transit", () => {
  const withExtra = (extra: ScenarioEvent) => ({ scenario: demoScenarioConfig.scenario, events: { events: [...demoScenarioConfig.events!.events, extra], firedEvents: new Set<string>(), messages: [] } });

  it("a score ending beside the transit pair drops the no-time-limit claim and is listed with its real threshold", () => {
    const c = withExtra(end("Score Win", "victory", [{ type: "SideScore", side: "US Navy", threshold: 50, comparison: "gte" }]));
    const e = describeEndings(c, SIDE);
    const extra = e.rules.filter((r) => !r.transit);
    expect(extra).toHaveLength(1);
    expect(extra[0]).toMatchObject({ result: "victory", text: "US Navy score is at least 50", usesScore: true });
    const notes = missionLines(transitObjective(c)!, e).notes;
    expect(notes).not.toMatch(/No time limit/);
    expect(notes).not.toMatch(/cannot complete or fail/);
    // the result names the score event, not the transit
    expect(explainResult(c, SIDE, { result: "victory", message: "m", source: { event: "Score Win" } })).toMatchObject({ kind: "rule", rule: { usesScore: true } });
  });

  it("a time ending beside the transit pair is stated with the real clock", () => {
    const c = withExtra(end("Time Out", "draw", [{ type: "Time", time: T0 + 90 * 60000 }]));
    const extra = describeEndings(c, SIDE).rules.filter((r) => !r.transit);
    expect(extra[0]).toMatchObject({ result: "draw", text: "the mission clock reaches T+01:30:00", usesClock: true });
  });

  it("an extra trigger on the same event as the transit arrival is not hidden behind the transit text", () => {
    const events = demoScenarioConfig.events!.events.map((ev) =>
      ev.name === "Transit Complete" ? { ...ev, triggers: [...ev.triggers, { type: "Time" as const, time: T0 + 3600000 }] } : ev,
    );
    const c = { scenario: demoScenarioConfig.scenario, events: { events, firedEvents: new Set<string>(), messages: [] } };
    const e = describeEndings(c, SIDE);
    expect(e.rules.find((r) => r.event === "Transit Complete")!.transit).toBe(false);
    const cause = explainResult(c, SIDE, { result: "victory", message: "m", source: { event: "Transit Complete" } });
    expect(cause.kind).toBe("rule");
    if (cause.kind === "rule") expect(cause.rule.text).toMatch(/enters .* or|, or /);
  });
});

describe("SAND-VICTORY-1 synthetic ending rules (labelled fixtures)", () => {
  it("named-target destruction: an own unit is named, a hostile one stays unsaid before the run and generic after", () => {
    const c = cfg([
      end("Lose Alpha", "defeat", [{ type: "UnitDestroyed", unitId: "us-1" }]),
      end("Kill Secret", "victory", [{ type: "UnitDestroyed", unitId: "ir-secret" }]),
    ]);
    const before = describeEndings(c, SIDE);
    expect(before.rules.map((r) => r.text)).toEqual(["USS Alpha is destroyed"]);
    expect(before.limited).toBe(true);
    expect(JSON.stringify(before)).not.toMatch(/Secret|Boghammar|ir-secret/);
    const after = explainResult(c, SIDE, { result: "victory", message: "m", source: { event: "Kill Secret" } });
    expect(after).toMatchObject({ kind: "rule", rule: { text: "a designated hostile target is destroyed" } });
    // `event` is internal provenance, never rendered; only the displayed text is held to the non-disclosure rule
    expect(after.kind === "rule" ? after.rule.text : "").not.toMatch(/Secret|Boghammar|ir-secret/);
  });

  it("a side-wide loss means a qualifying loss, never 'destroy every enemy'", () => {
    const e = describeEndings(cfg([end("Any Iran Loss", "victory", [{ type: "UnitDestroyed", side: "Iran" }])]), SIDE);
    expect(e.rules[0].text).toBe("any Iran unit is destroyed");
    expect(e.rules[0].text).not.toMatch(/every|all/i);
  });

  it("time with a surviving-unit-count condition: triggers ANY, conditions ALL", () => {
    const c = cfg([
      end("Hold Out", "victory", [{ type: "Time", time: T0 + 30 * 60000 }], [{ type: "UnitCountInArea", side: "US Navy", areaId: "gate", count: 2, comparison: "gte" }]),
    ]);
    const e = describeEndings(c, SIDE);
    expect(e.rules[0].text).toBe("the mission clock reaches T+00:30:00, while at least 2 US Navy units are afloat in Alpha Gate");
    expect(e.rules[0].usesClock).toBe(true);
    expect(e.limited).toBe(false);
    const any = describeEndings(cfg([end("Either", "victory", [{ type: "Time", time: T0 + 60000 }, { type: "SideScore", side: "US Navy", threshold: 5, comparison: "gte" }])]), SIDE);
    expect(any.rules[0].text).toBe("the mission clock reaches T+00:01:00, or US Navy score is at least 5");
  });

  it("SideScore threshold and draw use the actual side, comparison and threshold", () => {
    const e = describeEndings(cfg([
      end("Score Win", "victory", [{ type: "SideScore", side: "US Navy", threshold: 40, comparison: "gte" }]),
      end("Score Draw", "draw", [{ type: "SideScore", side: "Iran", threshold: -5, comparison: "lte" }]),
    ]), SIDE);
    expect(e.rules.map((r) => [r.result, r.text])).toEqual([
      ["victory", "US Navy score is at least 40"],
      ["draw", "Iran score is at most -5"],
    ]);
  });

  it("an event dependency, a random chance and a hostile area are not stated, and nothing about them leaks", () => {
    const c = cfg([
      end("Needs Briefing Event", "victory", [{ type: "Time", time: T0 + 1000 }], [{ type: "EventHasFired", eventName: "Secret Dependency Event" }]),
      end("Gamble", "victory", [{ type: "Time", time: T0 + 1000 }], [{ type: "RandomChance", probability: 0.1 }]),
      end("Mines", "defeat", [{ type: "UnitEntersArea", side: "Iran", areaId: "mines" }]),
      end("Mines Count", "defeat", [{ type: "Time", time: T0 + 1000 }], [{ type: "UnitCountInArea", side: "US Navy", areaId: "mines", count: 1, comparison: "gte" }]),
    ]);
    const e = describeEndings(c, SIDE);
    expect(e.rules).toHaveLength(0);
    expect(e.limited).toBe(true);
    expect(JSON.stringify(e)).not.toMatch(/Secret Dependency|Hidden Minefield|Gamble|Mines|0\.1/);
    expect(endingNotes(e, false)).toMatch(/does not state/);
  });

  it("an unrelated hidden event neither appears nor changes the stated endings", () => {
    const hidden: ScenarioEvent = {
      name: "Hidden Reinforcement",
      repeatable: false,
      triggers: [{ type: "UnitDetected", side: "Iran", detectedBySide: "US Navy" }],
      conditions: [],
      actions: [{ type: "DisplayMessage", side: "US Navy", text: "SECRET REINFORCEMENT MESSAGE" }, { type: "ChangeScore", side: "Iran", amount: 999 }],
    };
    const base = [end("Score Win", "victory", [{ type: "SideScore", side: "US Navy", threshold: 40, comparison: "gte" }])];
    const without = describeEndings(cfg(base), SIDE);
    const withHidden = describeEndings(cfg([hidden, ...base]), SIDE);
    expect(withHidden).toEqual(without);
    expect(JSON.stringify(withHidden)).not.toMatch(/Hidden|SECRET|999/);
  });

  it("no end events: no declared conditions, and not an automatic win or loss", () => {
    const e = describeEndings(cfg([]), SIDE);
    expect(e).toEqual({ rules: [], limited: false });
    expect(endingNotes(e, false)).toMatch(/No victory conditions are declared/);
    expect(transitObjective(cfg([]))).toBeNull();
    expect(explainResult(cfg([]), SIDE, { result: "victory", message: "m" }).kind).toBe("unstated");
  });

  it("a forced event is not described by its own triggers", () => {
    const c = cfg([end("Forced End", "victory", [{ type: "SideScore", side: "US Navy", threshold: 1, comparison: "gte" }])]);
    expect(explainResult(c, SIDE, { result: "victory", message: "m", source: { event: "Forced End", forcedBy: "Hidden Trigger" } }).kind).toBe("unstated");
  });

  it("a mixed limited scenario never says time or score cannot end it", () => {
    const e = describeEndings(cfg([end("Hidden", "victory", [{ type: "UnitDestroyed", unitId: "ir-secret" }])]), SIDE);
    expect(endingNotes(e, true)).not.toMatch(/No time limit|cannot complete or fail/);
    expect(endingNotes(e, true)).toMatch(/Do not assume time or score are safe/);
  });
  describe("an event that forces an ending event is an ending route (S2-1)", () => {
    const force = (name: string, triggers: ScenarioEvent["triggers"], target: string): ScenarioEvent => ({
      name, repeatable: false, triggers, conditions: [], actions: [{ type: "TriggerEvent", eventName: target }],
    });
    const withEvents = (extra: ScenarioEvent[]) => ({ scenario: demoScenarioConfig.scenario, events: { events: [...demoScenarioConfig.events!.events, ...extra], firedEvents: new Set<string>(), messages: [] } });

    it("Hormuz briefing text is unchanged", () => {
      const e = demoEndings();
      expect(e.limited).toBe(false);
      expect(endingNotes(e, true)).toBe("No time limit. Escort ships, score and the clock cannot complete or fail the mission.");
      expect(e.rules.every((r) => r.transit)).toBe(true);
    });

    it("a time-forced defeat is limited, not 'no time limit', and the target is not pure transit", () => {
      const c = withEvents([force("Deadline", [{ type: "Time", time: T0 + 3600000 }], "Carrier Lost")]);
      const e = describeEndings(c, SIDE);
      expect(e.limited).toBe(true);
      expect(endingNotes(e, true)).not.toMatch(/No time limit|cannot complete or fail/);
      expect(e.rules.find((r) => r.event === "Carrier Lost")?.transit ?? false).toBe(false);
      expect(explainResult(c, SIDE, { result: "defeat", message: "m", source: { event: "Carrier Lost" } }).kind).not.toBe("transit-loss");
    });

    it("a two-hop chain through a middle event with no end of its own is found", () => {
      const c = withEvents([
        force("Deadline", [{ type: "Time", time: T0 + 3600000 }], "Relay"),
        force("Relay", [], "Carrier Lost"),
      ]);
      const e = describeEndings(c, SIDE);
      expect(e.limited).toBe(true);
      expect(endingNotes(e, true)).not.toMatch(/No time limit/);
    });

    it("a non-time forcer is stated as a rule with the forced result, and a cycle terminates", () => {
      const c = withEvents([
        force("Score Panic", [{ type: "SideScore", side: "Iran", threshold: 7, comparison: "gte" }], "Loop B"),
        force("Loop B", [], "Loop A"),
        force("Loop A", [], "Loop B"),
        force("Loop Root", [{ type: "SideScore", side: "Iran", threshold: 9, comparison: "gte" }], "Loop A"),
      ]);
      const e = describeEndings(c, SIDE);
      expect(e.rules.some((r) => r.event === "Score Panic")).toBe(false);
      const c2 = withEvents([force("Score Panic", [{ type: "SideScore", side: "Iran", threshold: 7, comparison: "gte" }], "Carrier Lost")]);
      const rule = describeEndings(c2, SIDE).rules.find((r) => r.event === "Score Panic");
      expect(rule).toMatchObject({ result: "defeat", usesScore: true, transit: false });
      expect(rule!.text).toMatch(/Iran score is at least 7/);
      expect(endingNotes(describeEndings(c2, SIDE), true)).not.toMatch(/No time limit/);
    });
  });
});
