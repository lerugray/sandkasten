import { describe, it, expect, beforeEach } from "vitest";
import { runAIUpdate, type AIState } from "../aiController";
import { applyStateChanges } from "../events";
import type { Mission } from "../missions";
import { unit, makeState, contactOn, withContacts, resetLegacyTimers, KM_LAT } from "@/lib/simulation/__tests__/fixtures";

const SINA = 2106;
const MAHAN = 111;
const HORNET = 342;
const F4 = 265;

beforeEach(() => resetLegacyTimers());

const mission = (over: Partial<Mission>): Mission => ({
  id: "m", name: "M", side: "Iran", type: "patrol", assignedUnitIds: [], referencePoints: [],
  prosecutionRange: 100, repeating: true, ...over,
});

const ai = (missions: Mission[], sideDoctrine = {}): AIState => ({ missions, sideDoctrine });

describe("S2-10 spawned units join their declared mission", () => {
  it("a spawned boat labelled with the mission name gets the patrol route", () => {
    const patrol = mission({
      id: "iran-coastal-patrol", name: "Coastal Patrol", assignedUnitIds: ["old"],
      referencePoints: [{ lng: 56.3, lat: 27 }, { lng: 56.5, lat: 26.6 }],
    });
    const state = makeState([unit("old", "Iran", SINA, 56, 26.5), unit("mahan", "US Navy", MAHAN, 57, 25)]);
    const spawned = applyStateChanges(state, [
      { type: "spawn", action: { type: "SpawnUnit", side: "Iran", units: [{ id: "new", name: "Boghammar", platformId: SINA, position: { lng: 56.3, lat: 27.1 }, speed: 30, mission: "Coastal Patrol" }] } },
    ]);
    const orders = runAIUpdate(spawned, ai([patrol]));
    expect(orders.get("old")!.waypoints.length).toBeGreaterThan(0);
    expect(orders.get("new")!.waypoints.length).toBeGreaterThan(0);
  });
});

describe("S2-12 CAP picks an air contact, not the nearest ship", () => {
  it("intercepts the aircraft even with a ship closer", () => {
    const f4 = unit("f4", "Iran", F4, 56, 27, { altitude: 25000, speed: 400 });
    const ship = unit("ship", "US Navy", MAHAN, 56, 27 + 10 / KM_LAT);
    const hornet = unit("hornet", "US Navy", HORNET, 56, 27 + 20 / KM_LAT, { altitude: 25000 });
    let state = makeState([f4, ship, hornet]);
    state = withContacts(state, "Iran", [
      contactOn(state, ship, "Iran", "tracked"),
      contactOn(state, hornet, "Iran", "tracked"),
    ]);
    const cap = mission({ type: "cap", assignedUnitIds: ["f4"], referencePoints: [{ lng: 56, lat: 27 }, { lng: 56.1, lat: 27 }], prosecutionRange: 80 });
    const orders = runAIUpdate(state, ai([cap], { Iran: { roe: "weapons-free" } }));
    const wp = orders.get("f4")!.waypoints[0].position;
    expect(wp.lat).toBeCloseTo(27 + 20 / KM_LAT, 2);
  });
});

describe("S2-13 a one-shot transit stays finished", () => {
  it("does not head back to the start after arriving", () => {
    const transit = mission({ type: "transit", assignedUnitIds: ["boat"], repeating: false, referencePoints: [{ lng: 56, lat: 26 }, { lng: 56.2, lat: 26.2 }] });
    const state = makeState([unit("boat", "Iran", SINA, 56, 26), unit("mahan", "US Navy", MAHAN, 58, 24)]);
    const cfg = ai([transit]);
    const first = runAIUpdate(state, cfg);
    expect(first.get("boat")!.waypoints.length).toBeGreaterThan(0);
    // arrival: the route is consumed
    const arrived = { ...state, orders: new Map(first).set("boat", { ...first.get("boat")!, waypoints: [] }) };
    resetLegacyTimers();
    const second = runAIUpdate(arrived, cfg);
    expect(second.get("boat")!.waypoints).toHaveLength(0);
  });

  it("a repeating transit does restart", () => {
    const transit = mission({ type: "transit", assignedUnitIds: ["boat"], repeating: true, referencePoints: [{ lng: 56, lat: 26 }, { lng: 56.2, lat: 26.2 }] });
    const state = makeState([unit("boat", "Iran", SINA, 56, 26), unit("mahan", "US Navy", MAHAN, 58, 24)]);
    const cfg = ai([transit]);
    const first = runAIUpdate(state, cfg);
    const arrived = { ...state, orders: new Map(first).set("boat", { ...first.get("boat")!, waypoints: [] }) };
    resetLegacyTimers();
    expect(runAIUpdate(arrived, cfg).get("boat")!.waypoints.length).toBeGreaterThan(0);
  });
});

describe("S2-9 AI reads runtime doctrine", () => {
  it("a mission-scoped passive/hold change reaches the AI unit's radar", () => {
    const patrol = mission({ id: "p1", name: "P1", assignedUnitIds: ["a"], referencePoints: [{ lng: 56, lat: 26 }] });
    const other = mission({ id: "p2", name: "P2", assignedUnitIds: ["b"], referencePoints: [{ lng: 56, lat: 26 }] });
    let state = makeState([unit("a", "Iran", SINA, 56, 26), unit("b", "Iran", SINA, 56.1, 26), unit("mahan", "US Navy", MAHAN, 58, 24)]);
    state = applyStateChanges(state, [
      { type: "doctrine", action: { type: "ChangeDoctrine", side: "Iran", mission: "P1", changes: { radarUsage: "passive", roe: "weapons-hold" } } },
    ]);
    const orders = runAIUpdate(state, ai([patrol, other], { Iran: { radarUsage: "active" } }));
    expect(orders.get("a")!.radarActive).toBe(false);
    expect(orders.get("b")!.radarActive).toBe(true);
  });
});
