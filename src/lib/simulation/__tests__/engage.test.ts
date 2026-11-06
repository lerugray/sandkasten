import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { runCombatPhase, engageContact } from "../combat";
import type { GameState } from "../gameState";
import { unit, makeState, contactOn, withContacts, wif, combatWith, ctx, resetLegacyTimers, KM_LAT } from "./fixtures";
import { applyStateChanges } from "@/lib/ai/events";
import type { Mission } from "@/lib/ai/missions";

const MAHAN = 111;
const SINA = 2106;
const HORNET = 342;

beforeEach(() => resetLegacyTimers());
afterEach(() => vi.restoreAllMocks());

function setRoe(state: GameState, unitId: string, roe: "weapons-free" | "weapons-tight" | "weapons-hold"): GameState {
  const orders = new Map(state.orders);
  orders.set(unitId, { ...orders.get(unitId)!, doctrine: { roe } });
  return { ...state, orders };
}

function launches(r: { combatState: { combatLog: { type: string; unitId?: string }[] } }, by: string) {
  return r.combatState.combatLog.filter((e) => e.type === "launch" && e.unitId === by);
}

/** US Mahan (player) and an Iranian Sina 50 km north that the US side has a tracked contact on. */
function duel() {
  const mahan = unit("mahan", "US Navy", MAHAN, 56, 26);
  const sina = unit("sina", "Iran", SINA, 56, 26 + 50 / KM_LAT);
  let state = makeState([mahan, sina]);
  state = withContacts(state, "US Navy", [contactOn(state, sina, "US Navy", "tracked")]);
  return { mahan, sina, state };
}

describe("S1-1 player engagement order", () => {
  it("fires at a tracked contact the player selected", () => {
    const { state } = duel();
    const contactId = state.contacts[0].id;
    const r = engageContact(state, combatWith([]), { shooterId: "mahan", contactId }, ctx());
    expect(r.ok).toBe(true);
    expect(r.combatState.weaponsInFlight.length).toBeGreaterThan(0);
    expect(r.combatState.weaponsInFlight[0].targetId).toBe("sina");
    expect(r.combatState.combatLog.at(-1)?.type).toBe("launch");
  });

  it("refuses a contact that is only UNKNOWN", () => {
    const { state, sina } = duel();
    const weak = withContacts(state, "US Navy", [contactOn(state, sina, "US Navy", "unknown")]);
    const r = engageContact(weak, combatWith([]), { shooterId: "mahan", contactId: weak.contacts[0].id }, ctx());
    expect(r.ok).toBe(false);
    expect(r.combatState.weaponsInFlight).toHaveLength(0);
  });

  it("measures range to the contact's reported position, never the true one", () => {
    const { state, sina } = duel();
    // The true boat is 50 km away but the track says 400 km: out of range
    const far = withContacts(state, "US Navy", [contactOn(state, sina, "US Navy", "tracked", { position: { lng: 56, lat: 26 + 400 / KM_LAT } })]);
    const r = engageContact(far, combatWith([]), { shooterId: "mahan", contactId: far.contacts[0].id }, ctx());
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("out-of-range");
  });

  it("rejects a weapon the target domain does not allow (Harpoon at an aircraft)", () => {
    const mahan = unit("mahan", "US Navy", MAHAN, 56, 26);
    const f4 = unit("f4", "Iran", 265, 56, 26 + 30 / KM_LAT, { altitude: 20000 });
    let state = makeState([mahan, f4]);
    state = withContacts(state, "US Navy", [contactOn(state, f4, "US Navy", "tracked")]);
    const r = engageContact(state, combatWith([]), { shooterId: "mahan", contactId: state.contacts[0].id, weaponName: "RGM-84 Harpoon" }, ctx());
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("wrong-domain");
    const auto = engageContact(state, combatWith([]), { shooterId: "mahan", contactId: state.contacts[0].id }, ctx());
    expect(auto.ok).toBe(true);
    expect(auto.combatState.weaponsInFlight[0].name).toMatch(/SM-2/);
  });

  it("runs out of ammunition", () => {
    const { state } = duel();
    const used = new Map([["mahan", new Map([["RGM-84 Harpoon", 8]])]]);
    const r = engageContact(state, { ...combatWith([]), weaponsExpended: used }, { shooterId: "mahan", contactId: state.contacts[0].id, weaponName: "RGM-84 Harpoon" }, ctx());
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("no-ammo");
  });

  it("refuses a destroyed shooter and a non-hostile contact", () => {
    const { state, sina } = duel();
    const dead = { ...state, sides: state.sides.map((s) => ({ ...s, units: s.units.map((u) => (u.id === "mahan" ? { ...u, damageState: "destroyed" as const } : u)) })) };
    expect(engageContact(dead, combatWith([]), { shooterId: "mahan", contactId: state.contacts[0].id }, ctx()).ok).toBe(false);

    const ship = unit("dhow", "Neutral", SINA, 56, 26 + 20 / KM_LAT);
    let s2 = makeState([unit("mahan", "US Navy", MAHAN, 56, 26), ship]);
    s2 = withContacts(s2, "US Navy", [contactOn(s2, ship, "US Navy", "tracked")]);
    const r = engageContact(s2, combatWith([]), { shooterId: "mahan", contactId: s2.contacts[0].id }, ctx());
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("not-hostile");
    expect(sina.id).toBe("sina");
  });

  it("cannot engage from the opponent's side contact list", () => {
    const { state } = duel();
    const r = engageContact(state, combatWith([]), { shooterId: "sina", contactId: state.contacts[0].id }, ctx());
    expect(r.ok).toBe(false);
  });
});

describe("S1-1 player rules of engagement", () => {
  it("TIGHT (default): holds fire until a weapon is inbound, then returns fire at the contact", () => {
    const { state, mahan, sina } = duel();
    const quiet = runCombatPhase(state, combatWith([]), ctx(), 1);
    expect(launches(quiet, "mahan")).toHaveLength(0);

    const inbound = wif(sina, mahan, "C-802 Noor", { position: { lng: 56, lat: 26 + 40 / KM_LAT } });
    const r = runCombatPhase(state, combatWith([inbound]), ctx(), 1);
    expect(launches(r, "mahan").length).toBeGreaterThan(0);
    expect(r.combatState.weaponsInFlight.some((w) => w.launchedBy === "mahan" && w.targetId === "sina")).toBe(true);
  });

  it("TIGHT never fires at a target it has no contact on, even under attack", () => {
    const { state, mahan, sina } = duel();
    const blind = withContacts(state, "US Navy", []);
    const inbound = wif(sina, mahan, "C-802 Noor", { position: { lng: 56, lat: 26 + 40 / KM_LAT } });
    const r = runCombatPhase(blind, combatWith([inbound]), ctx(), 1);
    expect(launches(r, "mahan")).toHaveLength(0);
  });

  it("HOLD never fires on its own, even under attack", () => {
    const { state, mahan, sina } = duel();
    const hold = setRoe(state, "mahan", "weapons-hold");
    const inbound = wif(sina, mahan, "C-802 Noor", { position: { lng: 56, lat: 26 + 40 / KM_LAT } });
    expect(launches(runCombatPhase(hold, combatWith([inbound]), ctx(), 1), "mahan")).toHaveLength(0);
  });

  it("FREE fires at a tracked contact in range without being attacked", () => {
    const { state } = duel();
    const free = setRoe(state, "mahan", "weapons-free");
    expect(launches(runCombatPhase(free, combatWith([]), ctx(), 1), "mahan").length).toBeGreaterThan(0);
  });

  it("FREE does not fire at a contact that is only UNKNOWN", () => {
    const { state, sina } = duel();
    const free = setRoe(withContacts(state, "US Navy", [contactOn(state, sina, "US Navy", "unknown")]), "mahan", "weapons-free");
    expect(launches(runCombatPhase(free, combatWith([]), ctx(), 1), "mahan")).toHaveLength(0);
  });
});

describe("S2-7 aircraft are not surface targets", () => {
  it("a low-flying Hornet is not engaged with anti-ship missiles", () => {
    const sina = unit("sina", "Iran", SINA, 56, 26);
    const hornet = unit("hornet", "US Navy", HORNET, 56, 26 + 40 / KM_LAT, { altitude: 100 });
    let state = makeState([sina, hornet]);
    state = withContacts(state, "Iran", [contactOn(state, hornet, "Iran", "tracked")]);
    const r = runCombatPhase(state, combatWith([]), ctx({ Iran: { roe: "weapons-free" } }), 1);
    expect(r.combatState.weaponsInFlight.filter((w) => w.name === "C-802 Noor")).toHaveLength(0);
  });
});

describe("S2-14 neutrals", () => {
  it("weapons-free AI does not shoot a Neutral ship it can see", () => {
    const sina = unit("sina", "Iran", SINA, 56, 26);
    const dhow = unit("dhow", "Neutral", MAHAN, 56, 26 + 40 / KM_LAT);
    let state = makeState([sina, dhow]);
    state = withContacts(state, "Iran", [contactOn(state, dhow, "Iran", "tracked")]);
    const r = runCombatPhase(state, combatWith([]), ctx({ Iran: { roe: "weapons-free" } }), 1);
    expect(r.combatState.weaponsInFlight).toHaveLength(0);
  });
});

describe("S2-18 AI fires on its own contacts, not true positions", () => {
  it("no contact, no launch; with a contact it fires", () => {
    const sina = unit("sina", "Iran", SINA, 56, 26);
    const mahan = unit("mahan", "US Navy", MAHAN, 56, 26 + 80 / KM_LAT);
    const state = makeState([sina, mahan]);
    const c = ctx({ Iran: { roe: "weapons-free" } });
    expect(runCombatPhase(state, combatWith([]), c, 1).combatState.weaponsInFlight).toHaveLength(0);
    const seen = withContacts(state, "Iran", [contactOn(state, mahan, "Iran", "tracked")]);
    expect(runCombatPhase(seen, combatWith([]), c, 1).combatState.weaponsInFlight.length).toBeGreaterThan(0);
  });
});

describe("S2-9 one doctrine resolver for combat", () => {
  const mission: Mission = {
    id: "m1", name: "Quiet Patrol", side: "Iran", type: "patrol", assignedUnitIds: ["sina"],
    referencePoints: [], prosecutionRange: 100, repeating: true, doctrineOverrides: { roe: "weapons-hold" },
  };

  it("a static mission hold beats a weapons-free side", () => {
    const sina = unit("sina", "Iran", SINA, 56, 26);
    const mahan = unit("mahan", "US Navy", MAHAN, 56, 26 + 40 / KM_LAT);
    let state = makeState([sina, mahan]);
    state = withContacts(state, "Iran", [contactOn(state, mahan, "Iran", "tracked")]);
    const r = runCombatPhase(state, combatWith([]), ctx({ Iran: { roe: "weapons-free" } }, [mission]), 1);
    expect(r.combatState.weaponsInFlight).toHaveLength(0);
  });

  it("a mission-scoped runtime change does not leak to the side", () => {
    const state = makeState([unit("sina", "Iran", SINA, 56, 26)]);
    const out = applyStateChanges(state, [
      { type: "doctrine", action: { type: "ChangeDoctrine", side: "Iran", mission: "Quiet Patrol", changes: { roe: "weapons-hold" } } },
    ]);
    expect(out.sideDoctrineOverrides?.Iran).toBeUndefined();
    expect(out.missionDoctrineOverrides?.["Quiet Patrol"]).toEqual({ roe: "weapons-hold" });
  });
});
