import { describe, it, expect, afterEach, vi } from "vitest";
import { SimulationSession } from "../session";
import { demoScenarioConfig } from "@/lib/scenarios/demoConfig";
import { DEFAULT_AUTOPAUSE } from "../autopause";

// SAND-PLAY-1: two different player plans, run through the production session, decided by the real rules.
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GATE_CENTRE = { lng: 56.45, lat: 26.65 };

function play(orders: (s: SimulationSession) => void) {
  const s = new SimulationSession(demoScenarioConfig);
  s.autopausePrefs = { ...DEFAULT_AUTOPAUSE, enabled: false };
  orders(s);
  s.setSpeed(60);
  s.togglePause();
  for (let i = 0; i < 20 * 3600 * 2 && !s.ended; i++) s.tick(50);
  const snap = s.snapshot();
  return { result: snap.eventState?.scenarioResult?.result, hours: (snap.gameState.simTime - new Date(demoScenarioConfig.scenario.startTime ?? 0).getTime()) / 3.6e6, session: s };
}

describe("SAND-PLAY-1 two distinct plans reach a real victory", () => {
  afterEach(() => vi.restoreAllMocks());

  const planA = (s: SimulationSession) => {
    s.addWaypoint("us-cvn-1", GATE_CENTRE);
    s.setThrottle("us-cvn-1", 4);
  };
  const planB = (s: SimulationSession) => {
    for (const id of ["us-cg-1", "us-ddg-1", "us-ddg-2"]) {
      s.addWaypoint(id, { lng: 56.5, lat: 26.6 });
      s.setThrottle(id, 3);
    }
    s.addWaypoint("us-cvn-1", { lng: 57.0, lat: 25.9 });
    s.addWaypoint("us-cvn-1", GATE_CENTRE);
    s.setThrottle("us-cvn-1", 3);
  };

  for (const seed of [1, 2, 3]) {
    it(`plan A (carrier alone, flank, direct) wins - seed ${seed}`, () => {
      vi.spyOn(Math, "random").mockImplementation(seeded(seed * 7919));
      const r = play(planA);
      expect(r.result).toBe("victory");
      expect(r.hours).toBeLessThan(4);
    }, 60_000);

    it(`plan B (escorts ahead, dog-leg, cruise) wins on a different timetable - seed ${seed}`, () => {
      vi.spyOn(Math, "random").mockImplementation(seeded(seed * 7919));
      const r = play(planB);
      expect(r.result).toBe("victory");
      expect(r.hours).toBeGreaterThan(3.3);
    }, 60_000);
  }

  it("with no orders the carrier never reaches the gate and nothing is decided in five days", () => {
    vi.spyOn(Math, "random").mockImplementation(seeded(99));
    const r = play(() => {});
    expect(r.result).toBeUndefined();
    expect(r.hours).toBeGreaterThan(119);
  }, 60_000);
});
