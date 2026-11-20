import { describe, it, expect, vi, afterEach } from "vitest";
import { SimulationSession } from "../session";
import { demoScenario } from "@/lib/scenarios/demo";
import { DEFAULT_AUTOPAUSE } from "../autopause";
import { demoScenarioConfig } from "@/lib/scenarios/demoConfig";

afterEach(() => vi.restoreAllMocks());

function running(speed: number) {
  const s = new SimulationSession(demoScenarioConfig);
  s.autopausePrefs = { ...DEFAULT_AUTOPAUSE, enabled: false };
  s.togglePause(); // starts paused
  s.setSpeed(speed);
  return s;
}

describe("S2-1 one authoritative state", () => {
  it("pausing after a burst of ticks keeps the time the player saw", () => {
    const s = running(60);
    for (let i = 0; i < 4; i++) s.tick(50);
    const before = s.snapshot().gameState.simTime;
    expect(before).toBeGreaterThan(demoScenario ? new Date(demoScenario.startTime).getTime() : 0);
    s.togglePause();
    const paused = s.snapshot().gameState;
    expect(paused.isPaused).toBe(true);
    expect(paused.simTime).toBe(before);
    s.tick(50);
    expect(s.snapshot().gameState.simTime).toBe(before);
  });

  it("a speed change and a route order survive the ticks that follow", () => {
    const s = running(1);
    s.tick(50);
    s.setSpeed(10);
    s.addWaypoint("us-cvn-1", { lng: 56.4, lat: 26.6 });
    for (let i = 0; i < 6; i++) s.tick(50);
    const g = s.snapshot().gameState;
    expect(g.speed).toBe(10);
    expect(g.orders.get("us-cvn-1")!.waypoints.length).toBe(1);
  });

  it("reset gives a fresh game: fired events are not carried over", () => {
    const s = running(60);
    for (let i = 0; i < 4; i++) s.tick(50);
    expect(s.snapshot().eventState!.firedEvents.size).toBeGreaterThan(0);
    s.reset();
    const snap = s.snapshot();
    expect(snap.eventState!.firedEvents.size).toBe(0);
    expect(snap.gameState.simTime).toBe(new Date(demoScenario.startTime).getTime());
    expect(demoScenarioConfig.events!.firedEvents.size).toBe(0);
  });
});

// SAND-PLAY-1: a finished run takes no further orders, and reset returns a clean, paused start.
describe("SAND-PLAY-1 finished state and clean replay", () => {
  const gate = demoScenarioConfig.scenario.referencePoints.find((r) => r.id === "transit-gate")!;
  const inGate = { lng: (gate.points[0].lng + gate.points[2].lng) / 2, lat: (gate.points[0].lat + gate.points[2].lat) / 2 };
  const won = () => {
    const scenario = {
      ...demoScenario,
      sides: demoScenario.sides.map((s) => ({ ...s, units: s.units.map((u) => (u.id === "us-cvn-1" ? { ...u, position: inGate } : u)) })),
    };
    const s = new SimulationSession({ ...demoScenarioConfig, scenario });
    s.autopausePrefs = { ...DEFAULT_AUTOPAUSE, enabled: false };
    s.togglePause();
    s.tick(50);
    return s;
  };

  it("a victory holds the clock and refuses every later order", () => {
    const s = won();
    const snap = s.snapshot();
    expect(snap.eventState!.scenarioResult?.result).toBe("victory");
    expect(snap.gameState.isPaused).toBe(true);
    expect(s.ended).toBe(true);
    const t = snap.gameState.simTime;
    s.togglePause();
    s.setSpeed(60);
    s.cycleSpeed();
    s.addWaypoint("us-ddg-1", { lng: 56.4, lat: 26.6 });
    s.setThrottle("us-ddg-1", 4);
    s.toggleRadar("us-ddg-1");
    s.setRoe("us-ddg-1", "weapons-free");
    const after = s.snapshot().gameState;
    expect(after.isPaused).toBe(true);
    expect(after.speed).toBe(1);
    expect(after.orders).toBe(snap.gameState.orders);
    s.tick(500);
    expect(s.snapshot().gameState.simTime).toBe(t);
    const e = s.engage("us-ddg-1", "nope");
    expect(e.ok).toBe(false);
    expect(s.snapshot().orderFeedback?.message).toMatch(/ended/i);
  });

  it("reset gives a paused, result-free start identical to a fresh session", () => {
    const fresh = new SimulationSession(demoScenarioConfig);
    const s = new SimulationSession(demoScenarioConfig);
    s.autopausePrefs = { ...DEFAULT_AUTOPAUSE, enabled: false };
    s.togglePause();
    s.setSpeed(60);
    s.addWaypoint("us-cvn-1", { lng: 56.4, lat: 26.6 });
    for (let i = 0; i < 20; i++) s.tick(50);
    s.reset();
    const a = s.snapshot();
    const b = fresh.snapshot();
    expect(a.gameState.isPaused).toBe(true);
    expect(a.gameState.speed).toBe(1);
    expect(a.gameState.simTime).toBe(b.gameState.simTime);
    expect(a.gameState.sides).toEqual(b.gameState.sides);
    expect([...a.gameState.orders]).toEqual([...b.gameState.orders]);
    expect(a.eventState!.scenarioResult).toBeUndefined();
    expect(a.eventState!.messages).toEqual([]);
    expect(a.combatState.combatLog).toEqual([]);
    expect(a.combatState.weaponsInFlight).toEqual([]);
    expect(a.orderFeedback).toBeNull();
    expect(a.autopauseEvent).toBeNull();
  });

  it("after a result, reset starts a new run that takes orders and time again", () => {
    const s = won();
    s.reset();
    expect(s.ended).toBe(false);
    s.addWaypoint("us-ddg-1", { lng: 56.4, lat: 26.6 });
    expect(s.snapshot().gameState.orders.get("us-ddg-1")!.waypoints).toHaveLength(1);
    s.togglePause();
    expect(s.snapshot().gameState.isPaused).toBe(false);
  });

  it("pause() is idempotent and leaves resuming to the player", () => {
    const s = new SimulationSession(demoScenarioConfig);
    s.togglePause();
    s.pause();
    s.pause();
    expect(s.snapshot().gameState.isPaused).toBe(true);
    s.togglePause();
    expect(s.snapshot().gameState.isPaused).toBe(false);
  });
});
