import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCombatPhase } from "../combat";
import { unit, makeState, contactOn, withContacts, wif, combatWith, ctx, resetLegacyTimers, KM_LAT } from "./fixtures";
import { getPlatform } from "@/lib/platforms/lookup";

const MAHAN = 111;
const NIMITZ = 2740;
const SINA = 2106;
const HORNET = 342;

beforeEach(() => resetLegacyTimers());
afterEach(() => vi.restoreAllMocks());

/** Defeat every defence and succeed on every Pk roll. */
function fixedRoll(v = 0.55) {
  vi.spyOn(Math, "random").mockReturnValue(v);
}

function impact(shooter: ReturnType<typeof unit>, target: ReturnType<typeof unit>, weapon: string, n: number) {
  const state = makeState([shooter, target]);
  let s = state;
  let c = combatWith(Array.from({ length: n }, () => wif(shooter, target, weapon)));
  const r = runCombatPhase(s, c, ctx(), 1);
  return r;
}

describe("S1-2 cumulative damage", () => {
  it("20 C-802 hits no longer leave Mahan undamaged", () => {
    fixedRoll();
    const sina = unit("ir", "Iran", SINA, 56, 26.5);
    const mahan = unit("mahan", "US Navy", MAHAN, 56, 26.5);
    const r = impact(sina, mahan, "C-802 Noor", 20);
    const after = r.state.sides.flatMap((s) => s.units).find((u) => u.id === "mahan")!;
    expect(r.combatState.combatLog.filter((e) => e.type === "hit")).toHaveLength(20);
    expect(after.damageState).toBe("destroyed");
    expect(after.damage).toBeGreaterThan(getPlatform(MAHAN)!.damagePoints! * 0.8);
  });

  it("damage state walks up with the running total", () => {
    fixedRoll();
    const sina = unit("ir", "Iran", SINA, 56, 26.5);
    const mahan = unit("mahan", "US Navy", MAHAN, 56, 26.5);
    const states: string[] = [];
    let state = makeState([sina, mahan]);
    for (let i = 0; i < 6; i++) {
      const r = runCombatPhase(state, combatWith([wif(sina, mahan, "C-802 Noor")]), ctx(), 1);
      state = r.state;
      states.push(state.sides[0].units.concat(state.sides[1].units).find((u) => u.id === "mahan")!.damageState);
    }
    expect(states[0]).toBe("undamaged"); // 167 / 1190 = 14%
    expect(states[1]).toBe("damaged");
    expect(states).toContain("mission-kill");
    expect(states[5]).toBe("destroyed");
  });

  it("a carrier takes cumulative damage from repeated hits", () => {
    fixedRoll(0.7); // beats the Phalanx (0.65), the strongest defence it carries
    const sina = unit("ir", "Iran", SINA, 56, 26.5);
    const cvn = unit("cvn", "US Navy", NIMITZ, 56, 26.5);
    const r = impact(sina, cvn, "C-802 Noor", 6);
    const after = r.state.sides.flatMap((s) => s.units).find((u) => u.id === "cvn")!;
    expect(after.damage).toBeCloseTo(6 * 167, 5);
    expect(after.damageState).toBe("damaged");
  });

  it("keeps the named one-hit rule for aircraft", () => {
    fixedRoll(0.36); // beats the Hornet's chaff (0.35) and ECM (0.3), inside the Phoenix Pk of 60
    const eagle = unit("hornet", "US Navy", HORNET, 56, 26.5, { altitude: 20000 });
    const f14 = unit("tomcat", "Iran", 264, 56, 26.5, { altitude: 20000 });
    const r = runCombatPhase(makeState([eagle, f14]), combatWith([wif(f14, eagle, "AIM-54A Phoenix")]), ctx(), 1);
    const after = r.state.sides.flatMap((s) => s.units).find((u) => u.id === "hornet")!;
    expect(after.damageState).toBe("destroyed");
  });
});

describe("S2-8 weapon fuel versus arrival", () => {
  it("a missile that can reach its target within its remaining range impacts", () => {
    fixedRoll();
    const sina = unit("ir", "Iran", SINA, 56, 26.5);
    const target = unit("t", "US Navy", MAHAN, 56, 26.5 + 0.111 / KM_LAT);
    // The audit's receipt: 0.111 km to go, 0.2 km of range left, a 1 s tick covers 0.273 km
    const w = wif(sina, target, "C-802 Noor", { position: { lng: 56, lat: 26.5 }, rangeRemainingKm: 0.2 });
    const r = runCombatPhase(makeState([sina, target]), combatWith([w]), ctx(), 1);
    const log = r.combatState.combatLog;
    expect(log.some((e) => e.type === "hit" || e.type === "defended" || /missed/.test(e.description))).toBe(true);
    expect(log.some((e) => /ran out of fuel/.test(e.description))).toBe(false);
  });

  it("a missile still runs dry when the target is out of reach", () => {
    fixedRoll();
    const sina = unit("ir", "Iran", SINA, 56, 26.5);
    const target = unit("t", "US Navy", MAHAN, 56, 26.5 + 5 / KM_LAT);
    const w = wif(sina, target, "C-802 Noor", { position: { lng: 56, lat: 26.5 }, rangeRemainingKm: 0.2 });
    const r = runCombatPhase(makeState([sina, target]), combatWith([w]), ctx(), 1);
    expect(r.combatState.combatLog.some((e) => /ran out of fuel/.test(e.description))).toBe(true);
  });
});

describe("S2-16 expendable defences", () => {
  it("chaff runs out after its 24 uses", () => {
    fixedRoll(0); // every defence that is tried succeeds
    const sina = unit("ir", "Iran", SINA, 56, 26.5);
    const mahan = unit("mahan", "US Navy", MAHAN, 56, 26.5);
    let state = makeState([sina, mahan]);
    let combat = combatWith([]);
    const used: string[] = [];
    for (let i = 0; i < 30; i++) {
      combat = { ...combat, weaponsInFlight: [wif(sina, mahan, "C-802 Noor")] };
      const r = runCombatPhase(state, combat, ctx(), 1);
      state = r.state;
      combat = r.combatState;
    }
    for (const e of combat.combatLog) if (e.type === "defended") used.push(e.description);
    const chaff = used.filter((d) => /Chaff/.test(d)).length;
    expect(chaff).toBe(24);
    expect(used.length).toBe(30); // ECM and Phalanx pick up once the chaff is gone
  });
});
