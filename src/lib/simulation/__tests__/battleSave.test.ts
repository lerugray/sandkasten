import { describe, it, expect, afterEach, vi } from "vitest";
import { SimulationSession, type BattleDump } from "../session";
import { demoScenarioConfig } from "@/lib/scenarios/demoConfig";
import { getBuiltinConfig, builtinRevision } from "@/lib/scenarios/builtins";
import { DEFAULT_AUTOPAUSE } from "../autopause";
import { parseBattle, serializeBattle, saveFileName, SAVE_FORMAT, SAVE_VERSION, MAX_SAVE_BYTES } from "../battleSave";

// SAND-SAVE-1 CP1: the checkpoint contract (state inventory, codec, validation, atomic restore, restore-safe ids).

/** A seeded random stream whose position can be copied, so a restored run can pick up the same stream. */
function rng(seed: number) {
  let a = seed;
  return {
    next() {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    get state() { return a; },
    set state(v: number) { a = v; },
  };
}

const GATE = { lng: 56.45, lat: 26.65 };
const NOW = new Date("2026-11-09T12:00:00Z");

function newBattle() {
  const s = new SimulationSession(demoScenarioConfig);
  s.autopausePrefs = { ...DEFAULT_AUTOPAUSE, enabled: false };
  s.addWaypoint("us-cvn-1", GATE);
  s.setThrottle("us-cvn-1", 4);
  s.setSpeed(60);
  return s;
}

/** 21 authored Hormuz units plus the two Boghammar the reinforcement event adds (17 + 2 before SAND-THREAT-1). */
const UNITS_WITH_REINFORCEMENTS = 23;

/** Run Plan A until a nontrivial moment: reinforcements spawned, weapons in flight, ammunition and defences spent. */
function runToMidFight(s: SimulationSession) {
  s.togglePause();
  for (let i = 0; i < 20 * 3600 && !s.ended; i++) {
    s.tick(50);
    const sn = s.snapshot();
    const units = sn.gameState.sides.flatMap((x) => x.units).length;
    if (units >= UNITS_WITH_REINFORCEMENTS && sn.combatState.weaponsInFlight.length > 0 && sn.combatState.weaponsExpended.size > 2 && sn.combatState.defensesExpended.size > 0) return;
  }
  throw new Error("never reached a mid-fight state");
}

/** Contact, weapon and log ids are module counters; two runs in one process differ only in those numbers. */
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as object).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, stable(x)]));
  return v;
}
/** The file text with object keys in a fixed order (a restored position object may list lat/lng in the other order). */
function norm(text: string, drop: string[] = []): string {
  const f = JSON.parse(text);
  for (const k of drop) delete f[k];
  return JSON.stringify(stable(f));
}
/** Two runs in one process: the module id counters (and their numbers in the file) differ, nothing else may. */
const sameRun = (text: string) => canon(norm(text, ["ids"]));

function canon(text: string): string {
  const seen = new Map<string, string>();
  return text.replace(/\b(contact|wif|ce)-(\d+)\b/g, (m, p) => {
    if (!seen.has(m)) seen.set(m, `${p}#${seen.size}`);
    return seen.get(m)!;
  });
}

afterEach(() => vi.restoreAllMocks());

describe("battle save round trip", () => {
  it("a nontrivial mid-battle checkpoint exports, parses and re-exports identically", () => {
    // SAND-THREAT-1: stream 7907, not 7919. With Mahan weapons-free the 7919 run now ends without a moment that has
    // reinforcements, weapons in flight and spent defences all at once.
    const r = rng(7907);
    vi.spyOn(Math, "random").mockImplementation(() => r.next());
    const s = newBattle();
    s.setRoe("us-ddg-1", "weapons-free");
    runToMidFight(s);
    const dump = s.checkpoint();

    // the battle really is nontrivial
    expect(dump.gameState.sides.flatMap((x) => x.units).length).toBeGreaterThanOrEqual(UNITS_WITH_REINFORCEMENTS);
    expect(dump.combatState.weaponsInFlight.length).toBeGreaterThan(0);
    expect(dump.combatState.weaponsExpended.size).toBeGreaterThan(0);
    expect(dump.combatState.defensesExpended.size).toBeGreaterThan(0);
    expect(dump.gameState.contacts.length).toBeGreaterThan(0);
    expect(Object.values(dump.gameState.sideContacts).flat().length).toBeGreaterThan(0);
    expect(dump.eventState!.firedEvents.has("First Contact Alert")).toBe(true);
    expect(dump.eventState!.firedEvents.has("Reinforcement Boghammar")).toBe(true);
    expect(dump.eventState!.messages.length).toBeGreaterThan(0);
    expect(dump.gameState.orders.get("us-cvn-1")!.waypoints.length).toBeGreaterThan(0);
    expect(dump.gameState.orders.get("us-ddg-1")!.doctrine?.roe).toBe("weapons-free");
    expect(dump.ai.patrolIndex.size).toBeGreaterThan(0);

    const text = serializeBattle("hormuz", dump, NOW);
    const parsed = parseBattle(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // every authoritative field survives (Maps and Sets included)
    expect(parsed.dump.gameState).toEqual(dump.gameState);
    expect(parsed.dump.eventState!.firedEvents).toEqual(dump.eventState!.firedEvents);
    expect(parsed.dump.eventState!.messages).toEqual(dump.eventState!.messages);
    expect(parsed.dump.eventState!.lastFired).toEqual(dump.eventState!.lastFired);
    expect(parsed.dump.combatState).toEqual(dump.combatState);
    expect(parsed.dump.ai).toEqual(dump.ai);
    expect(parsed.dump.wego).toEqual(dump.wego);
    expect(parsed.dump.gameState.orders).toBeInstanceOf(Map);
    expect(parsed.dump.combatState.weaponsExpended.get([...dump.combatState.weaponsExpended.keys()][0])).toBeInstanceOf(Map);

    // reconstructed in a fresh session, the state is the same and the file is byte-identical when saved again
    const restored = SimulationSession.restore(parsed.config, parsed.dump);
    expect(restored.snapshot().gameState.isPaused).toBe(true);
    expect(norm(serializeBattle("hormuz", restored.checkpoint(), NOW))).toBe(norm(text));
    expect(parsed.preview.scenarioName).toBe(demoScenarioConfig.scenario.name);
    expect(parsed.preview.result).toBeNull();
  }, 60_000);

  it("with the same random stream, the restored battle continues exactly like the uninterrupted one", () => {
    const r = rng(7919);
    vi.spyOn(Math, "random").mockImplementation(() => r.next());
    const control = newBattle();
    runToMidFight(control);
    const text = serializeBattle("hormuz", control.checkpoint(), NOW);
    const streamAt = r.state;

    // the control carries on (it was paused by the checkpoint, exactly as the player's game is)
    const run = (s: SimulationSession, ticks: number) => {
      s.togglePause();
      for (let i = 0; i < ticks && !s.ended; i++) s.tick(50);
      return sameRun(serializeBattle("hormuz", s.checkpoint(), NOW));
    };
    const controlEnd = run(control, 900);

    r.state = streamAt;
    const parsed = parseBattle(text);
    if (!parsed.ok) throw new Error(parsed.error);
    const restoredEnd = run(SimulationSession.restore(parsed.config, parsed.dump), 900);
    expect(restoredEnd).toBe(controlEnd);
  }, 60_000);

  it("a restored battle never refills ammunition, restarts AI missions or repeats fired events", () => {
    const r = rng(7919);
    vi.spyOn(Math, "random").mockImplementation(() => r.next());
    const s = newBattle();
    runToMidFight(s);
    const before = s.checkpoint();
    const parsed = parseBattle(serializeBattle("hormuz", before, NOW));
    if (!parsed.ok) throw new Error(parsed.error);
    const restored = SimulationSession.restore(parsed.config, parsed.dump);
    restored.togglePause();
    for (let i = 0; i < 200 && !restored.ended; i++) restored.tick(50);
    const after = restored.snapshot();
    for (const [unitId, weapons] of before.combatState.weaponsExpended) {
      for (const [name, n] of weapons) expect(after.combatState.weaponsExpended.get(unitId)!.get(name)!).toBeGreaterThanOrEqual(n);
    }
    // one briefing, one reinforcement, one first-contact score
    const msgs = after.eventState!.messages;
    const titled = (list: typeof msgs, t: string) => list.filter((m) => m.title === t).length;
    for (const title of ["OPERATION SENTINEL PASSAGE", "NEW CONTACTS", "CONTACT REPORT"]) {
      expect(titled(msgs, title)).toBe(titled(before.eventState!.messages, title));
      expect(titled(msgs, title)).toBeLessThanOrEqual(1);
    }
    expect(titled(msgs, "NEW CONTACTS")).toBe(1);
    expect(after.gameState.sides.flatMap((x) => x.units).filter((u) => u.id.startsWith("ir-bog"))).toHaveLength(2);
    expect(after.gameState.score["US Navy"]).toBe(before.gameState.score["US Navy"]);
    // the AI's completed-transit bookkeeping carried over
    expect(after.gameState.simTime).toBeGreaterThan(before.gameState.simTime);
  }, 60_000);

  it("cold start, running (saved while time runs), repeated load and reset after load", () => {
    const s = new SimulationSession(demoScenarioConfig);
    const cold = parseBattle(serializeBattle("hormuz", s.checkpoint(), NOW));
    expect(cold.ok).toBe(true);

    const r = rng(11);
    vi.spyOn(Math, "random").mockImplementation(() => r.next());
    const live = newBattle();
    live.togglePause();
    for (let i = 0; i < 200; i++) live.tick(50);
    expect(live.snapshot().gameState.isPaused).toBe(false);
    const dump = live.checkpoint(); // saving while time runs pauses at the checkpoint
    expect(live.snapshot().gameState.isPaused).toBe(true);
    expect(dump.gameState.isPaused).toBe(true);

    let text = serializeBattle("hormuz", dump, NOW);
    for (let i = 0; i < 3; i++) {
      const p = parseBattle(text);
      if (!p.ok) throw new Error(p.error);
      text = serializeBattle("hormuz", SimulationSession.restore(p.config, p.dump).checkpoint(), NOW);
    }
    expect(norm(text)).toBe(norm(serializeBattle("hormuz", dump, NOW)));

    // reset after load restarts the built-in configuration, not the checkpoint
    const p = parseBattle(text);
    if (!p.ok) throw new Error(p.error);
    const restored = SimulationSession.restore(p.config, p.dump);
    restored.reset();
    const fresh = new SimulationSession(demoScenarioConfig);
    const drop = (t: string) => canon(norm(t, ["ids", "autopausePrefs"]));
    expect(drop(serializeBattle("hormuz", restored.checkpoint(), NOW))).toBe(drop(serializeBattle("hormuz", fresh.checkpoint(), NOW)));
  }, 60_000);

  // SAND-THREAT-1: Plan A (carrier alone, flank, direct) now ends in the real defeat, so both endings are covered:
  // the natural loss, and a win by the southern dog-leg.
  const finished: [string, (s: SimulationSession) => void, "victory" | "defeat", string][] = [
    ["the natural defeat of Plan A", () => {}, "defeat", "Carrier Lost"],
    [
      "a victory by the southern dog-leg",
      (s) => {
        s.clearWaypoints("us-cvn-1");
        for (const wp of [{ lng: 56.85, lat: 25.6 }, { lng: 56.62, lat: 26.3 }, GATE]) s.addWaypoint("us-cvn-1", wp);
        s.setThrottle("us-cvn-1", 3);
      },
      "victory",
      "Transit Complete",
    ],
  ];
  for (const [label, orders, result, event] of finished) {
    it(`a finished battle stays terminal with its deciding result and blocks commands: ${label}`, () => {
      const r = rng(7919);
      vi.spyOn(Math, "random").mockImplementation(() => r.next());
      const s = newBattle();
      orders(s);
      s.togglePause();
      for (let i = 0; i < 20 * 3600 * 2 && !s.ended; i++) s.tick(50);
      expect(s.ended).toBe(true);
      const text = serializeBattle("hormuz", s.checkpoint(), NOW);
      const p = parseBattle(text);
      if (!p.ok) throw new Error(p.error);
      expect(p.preview.result).toBe(result);
      const restored = SimulationSession.restore(p.config, p.dump);
      const snap = restored.snapshot();
      expect(restored.ended).toBe(true);
      expect(snap.eventState!.scenarioResult).toEqual(s.snapshot().eventState!.scenarioResult);
      expect(snap.eventState!.scenarioResult!.source?.event).toBe(event);
      const wp = snap.gameState.orders.get("us-cvn-1")!.waypoints.length;
      restored.addWaypoint("us-cvn-1", { lng: 56, lat: 26 });
      restored.setThrottle("us-cvn-1", 1);
      restored.togglePause();
      restored.setSpeed(30);
      restored.tick(5000);
      const after = restored.snapshot();
      expect(after.gameState.orders.get("us-cvn-1")!.waypoints.length).toBe(wp);
      expect(after.gameState.isPaused).toBe(true);
      expect(after.gameState.simTime).toBe(snap.gameState.simTime);
      // PLAY AGAIN starts fresh
      restored.reset();
      expect(restored.ended).toBe(false);
      expect(restored.snapshot().gameState.simTime).toBe(new Date(demoScenarioConfig.scenario.startTime).getTime());
    }, 60_000);
  }

  it("the real-world snapshot round-trips as neutral observation: no objective, no result, no scripted events", () => {
    const cfg = getBuiltinConfig("snapshot");
    const s = new SimulationSession(cfg);
    s.setSpeed(30);
    s.togglePause();
    for (let i = 0; i < 100; i++) s.tick(50);
    const text = serializeBattle("snapshot", s.checkpoint(), NOW);
    const p = parseBattle(text);
    if (!p.ok) throw new Error(p.error);
    expect(p.preview.configId).toBe("snapshot");
    expect(p.dump.eventState).toBeUndefined();
    expect(p.dump.gameState).toEqual(s.snapshot().gameState);
    const restored = SimulationSession.restore(p.config, p.dump);
    expect(restored.snapshot().eventState).toBeUndefined();
    expect(restored.ended).toBe(false);
    restored.reset();
    expect(restored.snapshot().gameState.scenario.name).toBe(cfg.scenario.name);
    // a snapshot file cannot pose as the Hormuz battle or the reverse
    const asHormuz = JSON.parse(text);
    asHormuz.configId = "hormuz";
    expect(parseBattle(JSON.stringify(asHormuz)).ok).toBe(false);
  }, 60_000);

  it("a WeGo battle saves and resumes mid-turn and in review, with the staged turn state intact", () => {
    const r = rng(77);
    vi.spyOn(Math, "random").mockImplementation(() => r.next());
    const s = new SimulationSession(demoScenarioConfig, { mode: "wego", turnMinutes: 5 });
    s.autopausePrefs = { ...DEFAULT_AUTOPAUSE, enabled: false };
    s.addWaypoint("us-cvn-1", GATE);
    s.setThrottle("us-cvn-1", 4);
    expect(s.commit()).toBe(true);
    s.setSpeed(60);
    for (let i = 0; i < 20; i++) s.tick(50); // part-way through the burst
    let dump = s.checkpoint();
    expect(dump.wego.phase).toBe("resolving");
    let p = parseBattle(serializeBattle("hormuz", dump, NOW));
    if (!p.ok) throw new Error(p.error);
    expect(p.dump.wego).toEqual(dump.wego);
    let restored = SimulationSession.restore(p.config, p.dump);
    expect(restored.snapshot().gameState.isPaused).toBe(true);
    expect(restored.snapshot().wego!.phase).toBe("resolving");
    restored.togglePause();
    for (let i = 0; i < 400; i++) restored.tick(50);
    expect(restored.snapshot().wego!.phase).toBe("review");
    expect(restored.snapshot().wego!.report!.turn).toBe(1);

    dump = restored.checkpoint();
    p = parseBattle(serializeBattle("hormuz", dump, NOW));
    if (!p.ok) throw new Error(p.error);
    expect(p.dump.wego.report).toEqual(dump.wego.report);
    restored = SimulationSession.restore(p.config, p.dump);
    expect(restored.nextTurn()).toBe(true);
    expect(restored.snapshot().wego!.phase).toBe("planning");
  }, 60_000);

  it("new contact, weapon and log ids cannot collide with a loaded battle, even on a fresh page", async () => {
    const r = rng(7919);
    vi.spyOn(Math, "random").mockImplementation(() => r.next());
    const s = newBattle();
    runToMidFight(s);
    const text = serializeBattle("hormuz", s.checkpoint(), NOW);
    const file = JSON.parse(text);
    const oldIds = new Set<string>([
      ...file.game.contacts.map((c: { id: string }) => c.id),
      ...file.game.sideContacts.flatMap(([, l]: [string, { id: string }[]]) => l.map((c) => c.id)),
      ...file.combat.weaponsInFlight.map((w: { id: string }) => w.id),
      ...file.combat.combatLog.map((e: { id: string }) => e.id),
    ]);
    // a fresh page: every module (and its id counters) starts from zero
    vi.resetModules();
    const fresh = await import("../session");
    const freshSave = await import("../battleSave");
    const freshCfg = (await import("@/lib/scenarios/demoConfig")).demoScenarioConfig;
    const parsed = freshSave.parseBattle(text);
    if (!parsed.ok) throw new Error(parsed.error);
    const restored = fresh.SimulationSession.restore(freshCfg, parsed.dump);
    restored.autopausePrefs = { ...DEFAULT_AUTOPAUSE, enabled: false };
    restored.setSpeed(60);
    restored.togglePause();
    for (let i = 0; i < 600 && !restored.ended; i++) restored.tick(50);
    const g = restored.snapshot();
    const newIds = [
      ...g.gameState.contacts.map((c) => c.id),
      ...Object.values(g.gameState.sideContacts).flat().map((c) => c.id),
      ...g.combatState.weaponsInFlight.map((w) => w.id),
      ...g.combatState.combatLog.map((e) => e.id),
    ];
    const contactIdsAll = [...g.gameState.contacts, ...Object.values(g.gameState.sideContacts).flat()].map((c) => c.id);
    expect(new Set(contactIdsAll).size).toBe(contactIdsAll.length);
    const logIds = g.combatState.combatLog.map((e) => e.id);
    expect(new Set(logIds).size).toBe(logIds.length);
    // anything created after the load is numbered above everything already in the file
    const maxOld = (p: string) => Math.max(0, ...[...oldIds].filter((i) => i.startsWith(p + "-")).map((i) => Number(i.split("-")[1])));
    for (const id of newIds) {
      if (oldIds.has(id)) continue;
      const [p, n] = [id.split("-")[0], Number(id.split("-")[1])];
      expect(n).toBeGreaterThan(p === "contact" ? maxOld("contact") : p === "wif" ? Math.max(maxOld("wif"), maxOld("ce")) : Math.max(maxOld("wif"), maxOld("ce")));
    }
  }, 60_000);
});

describe("battle save validation: bad files are refused and say why", () => {
  const good = (() => {
    const r = rng(7919);
    const spy = vi.spyOn(Math, "random").mockImplementation(() => r.next());
    const s = newBattle();
    runToMidFight(s);
    const text = serializeBattle("hormuz", s.checkpoint(), NOW);
    spy.mockRestore();
    return text;
  })();
  const edit = (fn: (f: any) => void) => {
    const f = JSON.parse(good);
    fn(f);
    return JSON.stringify(f);
  };
  const refused = (text: string, re: RegExp) => {
    const p = parseBattle(text);
    expect(p.ok).toBe(false);
    if (!p.ok) expect(p.error).toMatch(re);
  };

  it("accepts the untouched file and names the format", () => {
    expect(parseBattle(good).ok).toBe(true);
    expect(JSON.parse(good).format).toBe(SAVE_FORMAT);
    expect(JSON.parse(good).version).toBe(SAVE_VERSION);
    expect(saveFileName("hormuz", SimulationSession.restore(demoScenarioConfig, (parseBattle(good) as any).dump).checkpoint(), NOW)).toMatch(/^sandkasten-hormuz-T\+\d\dh\d\dm-20261109-120000\.sandsave\.json$/);
  });

  it("wrong file type, wrong version, wrong revision, unknown configuration", () => {
    refused("<html><body>not a save</body></html>", /not complete, valid JSON|not a Sandkasten battle save/);
    refused(JSON.stringify({ hello: "world" }), /wrong file type/);
    refused(JSON.stringify([1, 2, 3]), /expected an object/);
    refused(edit((f) => { f.version = 2; }), /version 2.*version 1 only/);
    refused(edit((f) => { f.configRevision = "sand-rules-0.deadbeef.cafef00d"; }), /different rules or platform data/);
    refused(edit((f) => { f.configId = "custom-scenario"; }), /unsupported scenario/);
    refused(edit((f) => { f.configId = "snapshot"; }), /./);
    expect(builtinRevision("hormuz")).not.toBe(builtinRevision("snapshot"));
  });

  it("truncated, empty and oversized files", () => {
    refused(good.slice(0, Math.floor(good.length / 2)), /truncated|valid JSON/);
    refused("", /empty/);
    refused("   \n", /empty/);
    refused(" ".repeat(MAX_SAVE_BYTES + 1), /larger than/);
  });

  it("invalid numbers, states and ranges", () => {
    refused(edit((f) => { f.game.simTime = null; }), /game\.simTime/);
    refused(edit((f) => { f.game.simTime = 1; }), /out of range/);
    refused(edit((f) => { f.game.speed = 7; }), /not an allowed speed/);
    refused(edit((f) => { f.game.sides[0].units[0].position.lat = 91; }), /position\.lat/);
    refused(edit((f) => { f.game.sides[0].units[0].position.lng = "56"; }), /position\.lng/);
    refused(edit((f) => { f.game.sides[0].units[0].damageState = "sinking"; }), /damageState/);
    refused(edit((f) => { f.game.sides[0].units[0].platformId = 424242; }), /unknown platform/);
    refused(edit((f) => { f.game.sides[0].units[0].speed = -3; }), /out of range/);
    refused(edit((f) => { f.combat.weaponsInFlight[0].weapon.pkAir = 400; }), /pkAir/);
    refused(edit((f) => { f.game.orders[0][1].throttle = 9; }), /throttle/);
    refused(edit((f) => { f.game.orders[0][1].doctrine = { roe: "shoot-everything" }; }), /roe/);
    refused(edit((f) => { f.autopausePrefs.enabled = "yes"; }), /autopausePrefs/);
    refused(edit((f) => { f.mode = "turn-based"; }), /mode/);
    refused(edit((f) => { f.turnMinutes = 7; }), /turnMinutes/);
  });

  it("missing arrays and maps", () => {
    refused(edit((f) => { delete f.game.sides; }), /game\.sides/);
    refused(edit((f) => { delete f.combat; }), /combat/);
    refused(edit((f) => { f.combat.weaponsExpended = {}; }), /expected a list/);
    refused(edit((f) => { f.ai.transitDone = "all"; }), /ai\.transitDone/);
    refused(edit((f) => { delete f.events; }), /events/);
    refused(edit((f) => { f.game.orders = [["us-cvn-1"]]; }), /key\/value pair/);
  });

  it("duplicate ids and broken cross-references", () => {
    refused(edit((f) => { f.game.sides[0].units.push({ ...f.game.sides[0].units[0] }); }), /duplicate id/);
    refused(edit((f) => { f.game.contacts.push({ ...f.game.contacts[0] }); }), /duplicate id/);
    refused(edit((f) => { f.game.contacts[0].actualUnitId = "ghost"; }), /unknown unit "ghost"/);
    refused(edit((f) => { f.game.orders.push(["ghost", { ...f.game.orders[0][1], unitId: "ghost" }]); }), /unknown unit "ghost"/);
    refused(edit((f) => { f.combat.weaponsInFlight[0].targetId = "ghost"; }), /unknown unit "ghost"/);
    refused(edit((f) => { f.combat.combatLog.push({ ...f.combat.combatLog[0] }); }), /duplicate id/);
    refused(edit((f) => { f.events.firedEvents.push("Not An Event"); }), /unknown event/);
    refused(edit((f) => { f.events.messages.push({ ...f.events.messages[0] }); }), /duplicate id/);
    refused(edit((f) => { f.game.sides[0].name = "Atlantis"; }), /do not match|belongs to side/);
    refused(edit((f) => { f.game.sideContacts.push(["__proto__", []]); }), /reserved key/);
  });

  it("a refused file never reaches the session: the running battle is untouched", () => {
    const r = rng(2);
    vi.spyOn(Math, "random").mockImplementation(() => r.next());
    const s = newBattle();
    s.togglePause();
    for (let i = 0; i < 100; i++) s.tick(50);
    s.pause();
    const before = serializeBattle("hormuz", s.checkpoint(), NOW);
    for (const t of [good.slice(0, 500), "", edit((f) => { f.game.speed = 7; })]) {
      expect(parseBattle(t).ok).toBe(false);
    }
    expect(serializeBattle("hormuz", s.checkpoint(), NOW)).toBe(before);
  });

  it("unknown extra keys are dropped, not carried into the battle", () => {
    const p = parseBattle(edit((f) => { f.game.sides[0].units[0].exploit = "<img src=x onerror=alert(1)>"; f.evil = true; }));
    expect(p.ok).toBe(true);
    if (p.ok) expect(JSON.stringify(p.dump.gameState)).not.toContain("onerror");
  });
});

// the dump type is part of the contract
export type _Dump = BattleDump;
