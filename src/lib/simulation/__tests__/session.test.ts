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
