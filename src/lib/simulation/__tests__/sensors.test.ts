import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { simulationTick } from "../engine";
import { mergeContact } from "../detection";
import type { Contact } from "../gameState";
import { unit, makeState, contactOn, withContacts, resetLegacyTimers, START, KM_LAT } from "./fixtures";
import { checkAutopauseTriggers, DEFAULT_AUTOPAUSE } from "../autopause";
import { wif, combatWith } from "./fixtures";

const MAHAN = 111;
const SINA = 2106;

beforeEach(() => resetLegacyTimers());
afterEach(() => vi.restoreAllMocks());

function run(state: ReturnType<typeof makeState>, speed: number, simSeconds: number) {
  let s = { ...state, speed };
  const callbacks = Math.round((simSeconds * 1000) / (50 * speed));
  const seen = new Set<number>();
  for (let i = 0; i < callbacks; i++) {
    const r = simulationTick(s, 50);
    s = r.gameState;
    for (const c of s.contacts) seen.add(c.lastUpdateTime);
  }
  return { s, scans: seen.size };
}

describe("S2-4 contact uncertainty is a function of simulated time", () => {
  it("30 stale simulated seconds give the same uncertainty at 1x and 60x", () => {
    const sina = unit("sina", "Iran", SINA, 56, 26 + 600 / KM_LAT); // far outside any sensor
    const mahan = unit("mahan", "US Navy", MAHAN, 56, 26);
    const base = makeState([mahan, sina]);
    const stale = (state: typeof base) => {
      const c: Contact = contactOn(state, sina, "US Navy", "detected", {
        positionUncertainty: 1, baseUncertainty: 1, lastUpdateTime: state.simTime - 30000, lastFixTime: state.simTime - 30000,
      });
      return withContacts(state, "US Navy", [c]);
    };
    const a = run({ ...stale(base), schedule: { ...base.schedule, detectionAt: base.simTime + 9e9 } }, 1, 30);
    const b = run({ ...stale(base), schedule: { ...base.schedule, detectionAt: base.simTime + 9e9 } }, 60, 30);
    expect(a.s.contacts).toHaveLength(1);
    expect(b.s.contacts).toHaveLength(1);
    expect(a.s.contacts[0].positionUncertainty).toBeCloseTo(b.s.contacts[0].positionUncertainty, 6);
    expect(a.s.contacts[0].positionUncertainty).toBeLessThan(10);
  });
});

describe("S2-19 detection cadence is independent of time compression", () => {
  it("a 60 s window gets the same number of scans at 1x and 60x", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const mahan = unit("mahan", "US Navy", MAHAN, 56, 26);
    const sina = unit("sina", "Iran", SINA, 56, 26 + 20 / KM_LAT);
    const base = makeState([mahan, sina]);
    const one = run(base, 1, 60);
    const sixty = run(base, 60, 60);
    expect(one.scans).toBeGreaterThanOrEqual(11);
    expect(sixty.scans).toBe(one.scans);
  });
});

describe("S2-5 weak reports do not keep a precise track", () => {
  const precise = (): Contact => ({
    id: "c", detectedById: "m", actualUnitId: "sina", side: "US Navy", classification: "tracked",
    position: { lng: 56, lat: 26.5 }, positionUncertainty: 0.1, baseUncertainty: 0.1,
    lastUpdateTime: 0, lastFixTime: 0, sensorType: "radar",
  });

  it("an ESM report does not randomise the position or refresh the fix", () => {
    const esm = { detected: true, classification: "detected" as const, uncertainty: 20, sensorType: "esm" };
    const out = mergeContact(precise(), esm, { lng: 56.05, lat: 26.55 }, 5000);
    expect(out.position).toEqual({ lng: 56, lat: 26.5 });
    expect(out.lastFixTime).toBe(0);
    expect(out.lastUpdateTime).toBe(5000);
  });

  it("a track that only gets bearings stops being 'tracked' and its uncertainty grows", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const mahan = unit("mahan", "US Navy", MAHAN, 56, 26, { speed: 0 });
    const sina = unit("sina", "Iran", SINA, 56, 26.5);
    let state = makeState([mahan, sina]);
    state = withContacts({ ...state, schedule: { ...state.schedule, detectionAt: state.simTime + 9e9 } }, "US Navy", [
      { ...precise(), lastUpdateTime: state.simTime, lastFixTime: state.simTime },
    ]);
    // keep the contact alive with weak reports only, 90 s later
    const weak = { detected: true, classification: "detected" as const, uncertainty: 20, sensorType: "esm" };
    let c = state.contacts[0];
    for (let t = 10000; t <= 90000; t += 10000) c = mergeContact(c, weak, sina.position, state.simTime + t);
    state = { ...state, simTime: state.simTime + 90000, contacts: [c] };
    const r = simulationTick({ ...state, speed: 1 }, 50);
    expect(r.gameState.contacts[0].classification).not.toBe("tracked");
    expect(r.gameState.contacts[0].positionUncertainty).toBeGreaterThan(1);
  });
});

describe("S2-18 every side keeps contacts", () => {
  it("an AI side builds a contact on the player's ship", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const mahan = unit("mahan", "US Navy", MAHAN, 56, 26 + 15 / KM_LAT);
    const sina = unit("sina", "Iran", SINA, 56, 26);
    const state = makeState([mahan, sina]);
    const r = simulationTick({ ...state, speed: 1 }, 50);
    expect((r.gameState.sideContacts["Iran"] ?? []).some((c) => c.actualUnitId === "mahan")).toBe(true);
    expect(r.gameState.contacts.some((c) => c.actualUnitId === "sina")).toBe(true);
  });
});

describe("S2-6 autopause only for weapons aimed at the player", () => {
  it("fire at a third side does not raise 'incoming weapon'", () => {
    const red = unit("red", "Iran", SINA, 56, 26);
    const green = unit("green", "Oman", MAHAN, 56, 26.3);
    const blue = unit("blue", "US Navy", MAHAN, 57, 25);
    const w = wif(red, green, "C-802 Noor");
    const result = checkAutopauseTriggers(
      DEFAULT_AUTOPAUSE, [], [], undefined, combatWith([w]), 0, 0, new Map(), new Map(), "US Navy", new Set(),
      new Set([blue.id])
    );
    expect(result).toBeNull();
    const aimed = checkAutopauseTriggers(
      DEFAULT_AUTOPAUSE, [], [], undefined, combatWith([wif(red, blue, "C-802 Noor")]), 0, 0, new Map(), new Map(), "US Navy", new Set(),
      new Set([blue.id])
    );
    expect(aimed?.reason).toBe("Incoming weapon detected");
    expect(START).toBeTruthy();
  });
});
