import { describe, it, expect, afterEach, vi } from "vitest";
import { SimulationSession, type SessionOptions } from "../session";
import { demoScenarioConfig } from "@/lib/scenarios/demoConfig";
import { demoScenario } from "@/lib/scenarios/demo";
import { DEFAULT_AUTOPAUSE } from "../autopause";
import * as aiMod from "@/lib/ai/aiController";
import { unit, START, KM_LAT } from "./fixtures";
import type { Scenario } from "@/types/game";
import type { ScenarioConfig } from "../session";

afterEach(() => vi.restoreAllMocks());

const MAHAN = 111;
const SINA = 2106;
const START_MS = new Date(START).getTime();

function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The session API that the tests drive, typed loosely so the same file also runs (red) on the base.
type S = SimulationSession & Record<string, (...a: unknown[]) => unknown>;
const call = (s: SimulationSession, name: string, ...a: unknown[]) => (s as unknown as S)[name](...a);

function wego(options: SessionOptions = {}, config: ScenarioConfig = demoScenarioConfig) {
  const s = new SimulationSession(config, { mode: "wego", ...options });
  s.autopausePrefs = { ...DEFAULT_AUTOPAUSE, enabled: false };
  return s;
}
const snap = (s: SimulationSession) => s.snapshot() as ReturnType<SimulationSession["snapshot"]> & { wego: { phase: string; intents: { id: string }[]; remainingMs: number; report: { elapsedMs: number; ended: boolean; outcomes: { ok: boolean; message: string }[] } | null; turnsCommitted: number; turnEnd: number; turnStart: number }; mode: string };
const phase = (s: SimulationSession) => snap(s).wego.phase;

/** Tick until the burst ends; `dts` is cycled through as the timer deltas. */
function resolve(s: SimulationSession, dts: number[] = [50], opts: { pauseEvery?: number } = {}) {
  let i = 0;
  while (phase(s) === "resolving" && i < 400000) {
    if (opts.pauseEvery && i > 0 && i % opts.pauseEvery === 0) {
      s.togglePause();
      s.tick(500); // paused: must change nothing
      s.togglePause();
    }
    s.tick(dts[i % dts.length]);
    i += 1;
  }
  return i;
}

/** A duel scenario: US Mahan (player) and an Iranian Sina 10 km north, no scripted events. */
function duelConfig(iranRoe?: "weapons-free"): ScenarioConfig {
  const mahan = unit("mahan", "US Navy", MAHAN, 56, 26);
  const sina = unit("sina", "Iran", SINA, 56, 26 + 10 / KM_LAT);
  const scenario = {
    name: "duel",
    startTime: START,
    playerSide: "US Navy",
    sides: [
      { name: "US Navy", color: "#00f", isAI: false, units: [mahan] },
      { name: "Iran", color: "#f00", isAI: true, units: [sina] },
    ],
    referencePoints: [],
  } as unknown as Scenario;
  return { scenario, sideDoctrine: iranRoe ? { Iran: { roe: iranRoe } } : undefined };
}

/** Plays one empty minute so detection has produced a contact, and returns to planning. */
function duelWithContact() {
  vi.spyOn(Math, "random").mockImplementation(seeded(5));
  const s = wego({ turnMinutes: 1 }, duelConfig());
  for (let k = 0; k < 8; k++) {
    call(s, "commit");
    resolve(s);
    call(s, "nextTurn");
    if (snap(s).gameState.contacts.some((c) => c.classification !== "unknown")) break;
  }
  return s;
}

describe("WeGo session: phases, start state, locks", () => {
  it("a WeGo run starts held in PLANNING turn 1 and planning advances no time", () => {
    const s = wego();
    const g = snap(s).gameState;
    expect(snap(s).mode).toBe("wego");
    expect(phase(s)).toBe("planning");
    expect(g.isPaused).toBe(true);
    expect(g.turnNumber).toBe(1);
    const t = g.simTime;
    for (let i = 0; i < 200; i++) s.tick(50);
    expect(snap(s).gameState.simTime).toBe(t);
    s.togglePause(); // cannot start the clock without a commit
    for (let i = 0; i < 200; i++) s.tick(50);
    expect(snap(s).gameState.simTime).toBe(t);
    expect(phase(s)).toBe("planning");
  });

  it("the default mode is continuous and has no turn state", () => {
    const s = new SimulationSession(demoScenarioConfig);
    expect(snap(s).mode).toBe("continuous");
    expect(snap(s).wego).toBeNull();
  });

  it("review advances no time and NEXT TURN opens planning at the exact held state", () => {
    const s = wego({ turnMinutes: 1 });
    call(s, "commit");
    resolve(s);
    expect(phase(s)).toBe("review");
    const t = snap(s).gameState.simTime;
    for (let i = 0; i < 200; i++) s.tick(50);
    expect(snap(s).gameState.simTime).toBe(t);
    s.togglePause();
    for (let i = 0; i < 100; i++) s.tick(50);
    expect(snap(s).gameState.simTime).toBe(t);
    expect(phase(s)).toBe("review");
    call(s, "nextTurn");
    call(s, "nextTurn"); // double NEXT TURN is idempotent
    expect(phase(s)).toBe("planning");
    expect(snap(s).gameState.simTime).toBe(t);
    expect(snap(s).gameState.turnNumber).toBe(2);
    expect(snap(s).gameState.isPaused).toBe(true);
  });

  it("every tactical command is refused while resolving and reviewing; inspection still works", () => {
    const s = wego({ turnMinutes: 5 });
    call(s, "commit");
    const ordersBefore = snap(s).gameState.orders.get("us-ddg-1")!;
    const attempt = () => {
      s.addWaypoint("us-ddg-1", { lng: 56.4, lat: 26.6 });
      s.clearWaypoints("us-ddg-1");
      s.setThrottle("us-ddg-1", 4);
      s.toggleRadar("us-ddg-1");
      s.setRoe("us-ddg-1", "weapons-free");
      const r = s.engage("us-ddg-1", "nope");
      expect(r.ok).toBe(false);
    };
    s.tick(50);
    expect(phase(s)).toBe("resolving");
    attempt();
    const during = snap(s).gameState.orders.get("us-ddg-1")!;
    expect(during.throttle).toBe(ordersBefore.throttle);
    expect(during.radarActive).toBe(ordersBefore.radarActive);
    expect(during.doctrine?.roe).toBe(ordersBefore.doctrine?.roe);
    expect(during.waypoints).toEqual(ordersBefore.waypoints);
    expect(call(s, "cancelIntent", "fire-1")).toBe(false);
    resolve(s);
    expect(phase(s)).toBe("review");
    const reviewOrders = snap(s).gameState.orders.get("us-ddg-1")!;
    attempt();
    expect(snap(s).gameState.orders.get("us-ddg-1")).toBe(reviewOrders);
    // read-only inspection: the snapshot still carries units, contacts, combat log and messages
    expect(snap(s).gameState.sides.length).toBeGreaterThan(0);
    expect(Array.isArray(snap(s).combatState.combatLog)).toBe(true);
    // planning reopens the same commands
    call(s, "nextTurn");
    s.setThrottle("us-ddg-1", 4);
    expect(snap(s).gameState.orders.get("us-ddg-1")!.throttle).toBe(4);
  });

  it("pausing the burst holds it but cannot reopen planning; resuming finishes the same interval", () => {
    const s = wego({ turnMinutes: 5 });
    call(s, "commit");
    s.tick(50);
    s.togglePause();
    expect(phase(s)).toBe("resolving");
    const t = snap(s).gameState.simTime;
    for (let i = 0; i < 100; i++) s.tick(50);
    expect(snap(s).gameState.simTime).toBe(t);
    s.addWaypoint("us-cvn-1", { lng: 56.4, lat: 26.6 });
    expect(snap(s).gameState.orders.get("us-cvn-1")!.waypoints.length).toBe(0);
    s.togglePause();
    resolve(s);
    expect(snap(s).gameState.simTime).toBe(snap(s).wego.turnEnd);
  });

  it("separate sessions never share turn state", () => {
    const a = wego({ turnMinutes: 5 });
    const b = wego({ turnMinutes: 15 });
    const c = new SimulationSession(demoScenarioConfig);
    call(a, "commit");
    expect(phase(a)).toBe("resolving");
    expect(phase(b)).toBe("planning");
    expect(snap(b).wego.turnsCommitted).toBe(0);
    expect(snap(c).mode).toBe("continuous");
    expect(snap(a).wego).not.toBe(snap(b).wego);
  });
});

describe("WeGo mode selection", () => {
  it("validates the turn length and locks the mode once the run starts", () => {
    expect(() => new SimulationSession(demoScenarioConfig, { mode: "wego", turnMinutes: 7 })).toThrow();
    const s = new SimulationSession(demoScenarioConfig);
    expect((call(s, "configure", { mode: "wego", turnMinutes: 7 }) as { ok: boolean }).ok).toBe(false);
    expect((call(s, "configure", { mode: "wego", turnMinutes: 15 }) as { ok: boolean }).ok).toBe(true);
    expect(snap(s).mode).toBe("wego");
    expect(snap(s).gameState.isPaused).toBe(true);
    call(s, "commit");
    expect((call(s, "configure", { mode: "continuous" }) as { ok: boolean }).ok).toBe(false);
    expect(snap(s).mode).toBe("wego");
    // an explicit restart may change it
    s.reset({ mode: "continuous" });
    expect(snap(s).mode).toBe("continuous");
    expect(snap(s).wego).toBeNull();
  });

  it("continuous keeps its old behaviour: it resumes with SPC and ENGAGE fires at once", () => {
    const s = new SimulationSession(demoScenarioConfig);
    s.autopausePrefs = { ...DEFAULT_AUTOPAUSE, enabled: false };
    s.togglePause();
    s.setSpeed(60);
    s.tick(50);
    expect(snap(s).gameState.simTime).toBeGreaterThan(START_MS - 1);
    s.addWaypoint("us-cvn-1", { lng: 56.4, lat: 26.6 });
    expect(snap(s).gameState.orders.get("us-cvn-1")!.waypoints.length).toBe(1);
  });
});

describe("WeGo staged fire", () => {
  it("queuing has no side effects, can be cancelled, and executes exactly once at commit", () => {
    const s = duelWithContact();
    const contact = snap(s).gameState.contacts.find((c) => c.classification !== "unknown")!;
    expect(contact).toBeTruthy();
    const before = snap(s).combatState;
    const launchesBefore = before.combatLog.filter((e) => e.type === "launch").length;
    const r = s.engage("mahan", contact.id) as { ok: boolean; message: string };
    expect(r.ok).toBe(true);
    expect(snap(s).wego.intents.length).toBe(1);
    // nothing happens from queuing: no missile, no ammunition debit, no cooldown, no log line
    const staged = snap(s).combatState;
    expect(staged.weaponsInFlight.length).toBe(before.weaponsInFlight.length);
    expect(staged.combatLog.filter((e) => e.type === "launch").length).toBe(launchesBefore);
    expect(staged.weaponsExpended).toEqual(before.weaponsExpended);
    expect(staged.cooldowns).toEqual(before.cooldowns);
    for (let i = 0; i < 100; i++) s.tick(50);
    expect(snap(s).combatState.weaponsInFlight.length).toBe(before.weaponsInFlight.length);
    // a second click is bounded: one fire order per shooter
    const dup = s.engage("mahan", contact.id) as { ok: boolean };
    expect(dup.ok).toBe(false);
    expect(snap(s).wego.intents.length).toBe(1);
    // cancel really cancels
    expect(call(s, "cancelIntent", snap(s).wego.intents[0].id)).toBe(true);
    expect(snap(s).wego.intents.length).toBe(0);
    expect(call(s, "cancelIntent", "fire-1")).toBe(false);
    expect(snap(s).combatState.weaponsExpended).toEqual(before.weaponsExpended);
    // restage, commit twice: executes once
    s.engage("mahan", contact.id);
    expect(call(s, "commit")).toBe(true);
    expect(call(s, "commit")).toBe(false);
    const after = snap(s).combatState;
    expect(after.combatLog.filter((e) => e.type === "launch" && e.unitId === "mahan").length).toBe(1);
    const spent = [...(after.weaponsExpended.get("mahan")?.values() ?? [])].reduce((a, b) => a + b, 0);
    expect(spent).toBeGreaterThan(0);
    resolve(s);
    const spentAfter = [...(snap(s).combatState.weaponsExpended.get("mahan")?.values() ?? [])].reduce((a, b) => a + b, 0);
    // manual order spent once at the start; ROE-tight Mahan adds nothing within the same burst without inbound fire
    expect(spentAfter).toBe(spent);
    expect(snap(s).wego.report!.outcomes.length).toBe(1);
    expect(snap(s).wego.report!.outcomes[0].ok).toBe(true);
  });

  it("an invalid fire order refuses with a reason and loses no ammunition", () => {
    const s = duelWithContact();
    const before = snap(s).combatState.weaponsExpended;
    const bad = s.engage("mahan", "no-such-contact") as { ok: boolean; message: string };
    expect(bad.ok).toBe(false);
    expect(bad.message.length).toBeGreaterThan(3);
    const bad2 = s.engage("sina", snap(s).gameState.contacts[0].id) as { ok: boolean };
    expect(bad2.ok).toBe(false); // not the player's unit
    expect(snap(s).wego.intents.length).toBe(0);
    expect(snap(s).combatState.weaponsExpended).toEqual(before);
    expect(snap(s).orderFeedback?.ok).toBe(false);
  });

  it("a staged order that went stale is refused at execution and spends nothing", () => {
    const s = duelWithContact();
    const contact = snap(s).gameState.contacts.find((c) => c.classification !== "unknown")!;
    expect((s.engage("mahan", contact.id) as { ok: boolean }).ok).toBe(true);
    // the target is gone before the burst (as if lost by other means)
    const priv = s as unknown as { gameState: ReturnType<typeof snap>["gameState"] };
    priv.gameState = {
      ...priv.gameState,
      sides: priv.gameState.sides.map((sd) => ({ ...sd, units: sd.units.map((u) => (u.id === "sina" ? { ...u, damageState: "destroyed" as const } : u)) })),
    };
    call(s, "commit");
    const report = snap(s).combatState;
    expect(report.weaponsExpended.get("mahan")?.size ?? 0).toBe(0);
    expect(report.weaponsInFlight.length).toBe(0);
    const o = snap(s).wego.report;
    resolve(s);
    expect(snap(s).wego.report!.outcomes[0].ok).toBe(false);
    expect(o).toBeNull();
  });
});

describe("WeGo exact resolution", () => {
  for (const minutes of [1, 5, 15]) {
    it(`a ${minutes}-minute turn ends on exactly start + length under irregular timer deltas and pauses`, () => {
      vi.spyOn(Math, "random").mockImplementation(seeded(11));
      const s = wego({ turnMinutes: minutes });
      s.setSpeed(30);
      const t0 = snap(s).gameState.simTime;
      call(s, "commit");
      resolve(s, [7, 50, 1999, 333, 2000, 4000, 16, 1250], { pauseEvery: 37 });
      const g = snap(s).gameState;
      expect(phase(s)).toBe("review");
      expect(g.simTime).toBe(t0 + minutes * 60000);
      expect(snap(s).wego.report!.elapsedMs).toBe(minutes * 60000);
      expect(snap(s).wego.turnsCommitted).toBe(1);
      // further timer deltas never overshoot or open a second turn
      for (let i = 0; i < 300; i++) s.tick(2000);
      expect(snap(s).gameState.simTime).toBe(t0 + minutes * 60000);
      expect(snap(s).wego.turnsCommitted).toBe(1);
      expect(snap(s).gameState.turnNumber).toBe(1);
    });
  }

  it("speed 60 with a huge stalled frame never overshoots the boundary", () => {
    const s = wego({ turnMinutes: 1 });
    s.setSpeed(60);
    call(s, "commit");
    s.tick(600000);
    s.tick(600000);
    expect(snap(s).gameState.simTime).toBe(snap(s).wego.turnEnd);
    expect(phase(s)).toBe("review");
  });

  it("presentation speed and timer cadence do not change movement or combat outcomes", () => {
    const orders = (s: SimulationSession) => {
      s.addWaypoint("us-cvn-1", { lng: 56.45, lat: 26.65 });
      s.setThrottle("us-cvn-1", 4);
      s.addWaypoint("us-ddg-1", { lng: 56.5, lat: 26.6 });
    };
    const run = (speed: number, dts: number[]) => {
      vi.restoreAllMocks();
      vi.spyOn(Math, "random").mockImplementation(seeded(4242));
      const s = wego({ turnMinutes: 15 });
      orders(s);
      s.setSpeed(speed);
      call(s, "commit");
      resolve(s, dts, { pauseEvery: speed === 60 ? 11 : 0 });
      const g = snap(s).gameState;
      return {
        t: g.simTime,
        pos: g.sides.flatMap((sd) => sd.units.map((u) => [u.id, u.position.lng, u.position.lat, u.damageState])),
        log: snap(s).combatState.combatLog.map((e) => `${e.time}|${e.type}|${e.description}`),
        contacts: g.contacts.map((c) => `${c.actualUnitId}|${c.classification}`).sort(),
      };
    };
    const a = run(1, [50]);
    const b = run(10, [233, 17, 1999]);
    const c = run(60, [2000, 3, 900]);
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  }, 120_000);

  it("the AI plans once at commit, never mid-turn, and once more at the next boundary", () => {
    const spy = vi.spyOn(aiMod, "runAIUpdate");
    const s = wego({ turnMinutes: 15 });
    expect(spy).toHaveBeenCalledTimes(0); // planning does not plan for the AI
    for (let i = 0; i < 50; i++) s.tick(50);
    expect(spy).toHaveBeenCalledTimes(0);
    call(s, "commit");
    expect(spy).toHaveBeenCalledTimes(1);
    resolve(s);
    expect(spy).toHaveBeenCalledTimes(1);
    call(s, "nextTurn");
    expect(spy).toHaveBeenCalledTimes(1);
    call(s, "commit");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("the AI reasons from its own contact store at commit, not from true positions", () => {
    const spy = vi.spyOn(aiMod, "runAIUpdate");
    const s = wego({ turnMinutes: 5 });
    call(s, "commit");
    const stateArg = spy.mock.calls[0][0];
    expect(stateArg.simTime).toBe(START_MS === 0 ? 0 : stateArg.simTime);
    expect(stateArg.sideContacts["Iran"] ?? []).toEqual([]);
    // no unit of Iran has been given a route to a US unit's true position
    const us = stateArg.sides.find((sd) => sd.name === "US Navy")!.units;
    for (const sd of snap(s).gameState.sides.filter((x) => x.isAI)) {
      for (const u of sd.units) {
        const wps = snap(s).gameState.orders.get(u.id)!.waypoints;
        for (const w of wps) for (const t of us) expect(Math.hypot(w.position.lng - t.position.lng, w.position.lat - t.position.lat)).toBeGreaterThan(0.01);
      }
    }
  });

  it("a contact that first appears mid-turn gets legal weapons-free auto-fire, with no AI replan", () => {
    vi.spyOn(Math, "random").mockImplementation(seeded(5));
    const spy = vi.spyOn(aiMod, "runAIUpdate");
    const s = wego({ turnMinutes: 5 }, duelConfig("weapons-free"));
    call(s, "commit");
    expect(snap(s).gameState.contacts.length).toBe(0);
    resolve(s);
    expect(spy).toHaveBeenCalledTimes(1);
    const launches = snap(s).combatState.combatLog.filter((e) => e.type === "launch");
    expect(launches.length).toBeGreaterThan(0);
    expect(launches.some((e) => e.unitId === "sina")).toBe(true);
  });
});

describe("WeGo and the real scenario", () => {
  const gate = demoScenarioConfig.scenario.referencePoints.find((r) => r.id === "transit-gate")!;
  const inGate = { lng: (gate.points[0].lng + gate.points[2].lng) / 2, lat: (gate.points[0].lat + gate.points[2].lat) / 2 };
  const withCarrier = (patch: Record<string, unknown>) => {
    const scenario = {
      ...demoScenario,
      sides: demoScenario.sides.map((sd) => ({ ...sd, units: sd.units.map((u) => (u.id === "us-cvn-1" ? { ...u, ...patch } : u)) })),
    };
    return { ...demoScenarioConfig, scenario, events: demoScenarioConfig.events };
  };

  it("a carrier already in the gate wins on its real tick, ends the burst early and gives no NEXT TURN", () => {
    const s = wego({ turnMinutes: 15 }, withCarrier({ position: inGate }));
    call(s, "commit");
    resolve(s);
    const sn = snap(s);
    expect(sn.eventState!.scenarioResult?.result).toBe("victory");
    expect(phase(s)).toBe("review");
    expect(sn.wego.report!.ended).toBe(true);
    expect(sn.wego.report!.elapsedMs).toBeLessThan(15 * 60000);
    expect(s.ended).toBe(true);
    expect(call(s, "nextTurn")).toBe(false);
    expect(phase(s)).toBe("review");
    expect(sn.eventState!.messages.filter((m) => /transit/i.test(m.text ?? "") ).length).toBeLessThanOrEqual(1);
    s.tick(50);
    expect(snap(s).gameState.simTime).toBe(sn.gameState.simTime);
  });

  it("carrier loss is a defeat, with no time-only or escort-only victory", () => {
    const s = wego({ turnMinutes: 5 }, withCarrier({ damageState: "destroyed" }));
    call(s, "commit");
    resolve(s);
    expect(snap(s).eventState!.scenarioResult?.result).toBe("defeat");
    const fresh = wego({ turnMinutes: 15 });
    for (let k = 0; k < 3; k++) {
      call(fresh, "commit");
      resolve(fresh);
      if (fresh.ended) break;
      call(fresh, "nextTurn");
    }
    expect(fresh.ended).toBe(false); // sitting still never wins
  });

  it("restarting after a result or mid-turn leaves no pending intent, phase, counter or message", () => {
    const s = wego({ turnMinutes: 15 }, withCarrier({ position: inGate }));
    for (let k = 0; k < 2; k++) {
      call(s, "commit");
      resolve(s);
      expect(s.ended).toBe(true);
      s.reset();
      const sn = snap(s);
      expect(sn.mode).toBe("wego");
      expect(sn.wego.phase).toBe("planning");
      expect(sn.wego.intents.length).toBe(0);
      expect(sn.wego.report).toBeNull();
      expect(sn.wego.turnsCommitted).toBe(0);
      expect(sn.gameState.turnNumber).toBe(1);
      expect(sn.gameState.isPaused).toBe(true);
      expect(sn.eventState!.scenarioResult).toBeUndefined();
      expect(sn.eventState!.firedEvents.size).toBe(0);
      expect(sn.orderFeedback).toBeNull();
    }
    // mid-turn with a queued ENGAGE
    const d = duelWithContact();
    d.engage("mahan", snap(d).gameState.contacts[0].id);
    d.reset();
    expect(snap(d).wego.intents.length).toBe(0);
    d.engage("mahan", "x");
    call(d, "commit");
    d.tick(50);
    d.reset();
    expect(snap(d).wego.phase).toBe("planning");
    expect(snap(d).combatState.combatLog.length).toBe(0);
    expect(snap(d).gameState.turnNumber).toBe(1);
  });

  it("autopause preferences are kept but never interrupt the burst; alerts are collected for review", () => {
    const s = new SimulationSession(duelConfig("weapons-free"), { mode: "wego", turnMinutes: 5 });
    s.autopausePrefs = { ...DEFAULT_AUTOPAUSE, enabled: true };
    call(s, "commit");
    resolve(s);
    expect(phase(s)).toBe("review");
    expect(snap(s).gameState.simTime).toBe(snap(s).wego.turnEnd);
    expect(s.autopausePrefs.enabled).toBe(true);
    expect(snap(s).wego.report!.alerts.length).toBeGreaterThan(0);
  });
});
