import { describe, it, expect } from "vitest";
import {
  projectRecord, filterRecord, pageWindow, visibleWeapons, ownForce, describeFilter, NO_FILTER, RECORD_PAGE_SIZE,
  type RecordInput, type RecordRow,
} from "../combatRecord";
import type { CombatEvent } from "../combat";
import type { Contact } from "../gameState";
import type { EventMessage } from "@/lib/ai/events";
import { unit, wif } from "./fixtures";

const T0 = new Date("2026-03-15T06:00:00Z").getTime();
const own = [unit("nimitz", "US Navy", 111, 56, 26, { name: "USS Nimitz" }), unit("cole", "US Navy", 111, 56, 26.1, { name: "USS Cole" })];
const hostile = [
  unit("ir-sina", "Iran", 2106, 56.5, 26.5, { name: "Sina Secret 77" }),
  unit("ir-kilo", "Iran", 2106, 56.6, 26.5, { name: "Kilo Hidden 9" }),
  unit("ru-1", "Russia", 2106, 57, 27, { name: "Moskva Private" }),
];
const units = [...own, ...hostile];
const trackNumber = (id: string) => `T${id.length}`;

let n = 0;
const ev = (type: CombatEvent["type"], time: number, side: string, unitId: string | undefined, targetId: string | undefined, description: string): CombatEvent => ({
  id: `ce-${++n}`, time, type, side, unitId, targetId, description,
});
const msg = (id: string, time: number, side = "US Navy", text = "radar contact"): EventMessage => ({ id, side, time, text, title: "REPORT", read: false });
const contact = (actual: string, classification: Contact["classification"], platformName?: string): Contact => ({
  id: `c-${actual}`, detectedById: "nimitz", actualUnitId: actual, side: "US Navy", classification,
  position: { lng: 0, lat: 0 }, positionUncertainty: 1, lastUpdateTime: T0, sensorType: "radar", platformName,
});
const input = (over: Partial<RecordInput> = {}): RecordInput => ({
  combatLog: [], messages: [], units, contacts: [], playerSide: "US Navy", godMode: false, trackNumber, ...over,
});
const ids = (rows: RecordRow[]) => rows.map((r) => r.id);

describe("combat record: eligibility and player view", () => {
  const log = [
    ev("launch", T0 + 1000, "Iran", "ir-sina", "nimitz", "Sina Secret 77 launched 2× C-802 at USS Nimitz"),
    ev("launch", T0 + 2000, "Iran", "ir-kilo", "ru-1", "Kilo Hidden 9 launched Sub-Missile at Moskva Private"),
    ev("hit", T0 + 3000, "Iran", "ir-kilo", "ru-1", "Sub-Missile hit Moskva Private!"),
    ev("defended", T0 + 4000, "Iran", "ir-sina", "cole", "Sina Secret 77 defeated Harpoon with SECRET-DEFENSE-X"),
    ev("destroyed", T0 + 5000, "Iran", "ir-sina", "cole", "USS Cole has been destroyed!"),
    ev("damaged", T0 + 6000, "US Navy", "cole", "ir-sina", "Sina Secret 77 is now damaged"),
  ];

  it("keeps own-involved events and leaves unrelated hostile-only events out of rows, counts and filters", () => {
    const rows = projectRecord(input({ combatLog: log }));
    expect(ids(rows)).toEqual([log[0].id, log[3].id, log[4].id, log[5].id]);
    expect(rows.every((r) => !r.debug)).toBe(true);
    const text = JSON.stringify(rows);
    for (const secret of ["Moskva", "Kilo Hidden", "ir-kilo", "ru-1", "Sina Secret", "ir-sina", "SECRET-DEFENSE"]) {
      expect(text.toLowerCase()).not.toContain(secret.toLowerCase());
    }
    expect(filterRecord(rows, { ...NO_FILTER, category: "combat" })).toHaveLength(4);
  });

  it("names enemies by classified contact name, else track label, else UNKNOWN TRACK", () => {
    const named = projectRecord(input({ combatLog: [log[0]], contacts: [contact("ir-sina", "classified", "Sina-class")] }));
    expect(named[0].text).toContain("SINA-CLASS LAUNCHED");
    const tracked = projectRecord(input({ combatLog: [log[0]], contacts: [contact("ir-sina", "detected")] }));
    expect(tracked[0].text).toMatch(/^TN\S+ DET LAUNCHED/);
    const unknown = projectRecord(input({ combatLog: [log[0]] }));
    expect(unknown[0].text).toContain("UNKNOWN TRACK LAUNCHED");
  });

  it("an unidentified hostile contact uses the track label, never the true hull name", () => {
    const rows = projectRecord(input({ combatLog: [log[0]], contacts: [contact("ir-sina", "detected")] }));
    expect(rows).toHaveLength(1);
    expect(rows[0].text).toMatch(/^TN\S+ DET LAUNCHED/);
    expect(rows[0].text).not.toMatch(/SINA SECRET/i);
  });

  it("does not treat a contact platformName equal to the true hull name as an identified class name", () => {
    const rows = projectRecord(input({ combatLog: [log[0]], contacts: [contact("ir-sina", "classified", "Sina Secret 77")] }));
    expect(rows[0].text).toMatch(/^TN\S+ CLS LAUNCHED/);
    expect(rows[0].text).not.toMatch(/SINA SECRET/i);
  });

  it("uses readable event names and tells an own loss from an enemy kill", () => {
    const rows = projectRecord(input({ combatLog: log }));
    expect(rows.map((r) => r.tag)).toEqual(["LAUNCH", "DEFENDED", "LOST", "DAMAGED"]);
    const kill = projectRecord(input({ combatLog: [ev("destroyed", T0, "US Navy", "cole", "ir-sina", "Sina Secret 77 has been destroyed!")] }));
    expect(kill[0].tag).toBe("KILL");
  });

  it("lists an own unit once when it is both the actor and the target of an event", () => {
    const self = ev("damaged", T0 + 7000, "US Navy", "cole", "cole", "USS Cole is now damaged");
    const rows = projectRecord(input({ combatLog: [self] }));
    expect(rows[0].ownUnitIds).toEqual(["cole"]);
  });

  it("offers inspection only for own units", () => {
    const rows = projectRecord(input({ combatLog: log }));
    for (const r of rows) for (const id of r.ownUnitIds) expect(["nimitz", "cole"]).toContain(id);
    expect(rows[0].ownUnitIds).toEqual(["nimitz"]);
    expect(rows[3].ownUnitIds).toEqual(["cole"]);
  });

  it("GOD view adds the hidden rows flagged and unfogged, and turning it off removes them at once", () => {
    const god = projectRecord(input({ combatLog: log, godMode: true }));
    expect(god).toHaveLength(6);
    expect(god.filter((r) => r.debug).map((r) => r.id)).toEqual([log[1].id, log[2].id]);
    expect(god.find((r) => r.id === log[1].id)!.text).toContain("KILO HIDDEN 9");
    const off = projectRecord(input({ combatLog: log, godMode: false }));
    expect(off).toHaveLength(4);
    expect(off.some((r) => r.debug)).toBe(false);
  });

  it("keeps authored player-side INTEL distinct and hides other sides' messages", () => {
    const rows = projectRecord(input({ combatLog: [log[0]], messages: [msg("m1", T0), msg("m2", T0 + 500, "Iran", "secret orders")] }));
    expect(rows.map((r) => `${r.kind}:${r.id}`)).toEqual(["intel:m1", `combat:${log[0].id}`]);
    expect(filterRecord(rows, { ...NO_FILTER, category: "intel" }).map((r) => r.id)).toEqual(["m1"]);
    expect(JSON.stringify(rows)).not.toContain("SECRET ORDERS");
  });
});

describe("combat record: complete, ordered, paged", () => {
  const many = Array.from({ length: 73 }, (_, i) => ev(i % 3 === 0 ? "launch" : "hit", T0 + Math.floor(i / 4) * 1000, "Iran", "ir-sina", i % 2 ? "nimitz" : "cole", `shot ${i}`));
  const rows = projectRecord(input({ combatLog: many, messages: [msg("mA", T0), msg("mB", T0 + 5000)] }));

  it("every eligible source id appears exactly once, in source order, past event 50", () => {
    expect(rows).toHaveLength(75);
    expect(new Set(ids(rows)).size).toBe(75);
    expect(ids(rows).filter((i) => i.startsWith("ce-"))).toEqual(many.map((e) => e.id));
    expect(ids(rows)).toContain(many[50].id);
    expect(ids(rows)).toContain(many[72].id);
  });

  it("identical timestamps keep source order, combat before intel", () => {
    const same = projectRecord(input({
      combatLog: [ev("launch", T0, "US Navy", "cole", "ir-sina", "a"), ev("hit", T0, "US Navy", "cole", "ir-sina", "b")],
      messages: [msg("m-same", T0)],
    }));
    expect(same.map((r) => r.text.slice(0, 1) === "A" || r.text.slice(0, 1) === "B" ? r.text.slice(0, 1) : r.id)).toEqual(["A", "B", "m-same"]);
  });

  it("pages cover every row once and report an honest window", () => {
    const seen: string[] = [];
    const w0 = pageWindow(rows.length, 0);
    expect(w0).toMatchObject({ from: 1, to: RECORD_PAGE_SIZE, pages: 4, atLatest: false });
    for (let p = 0; p < w0.pages; p++) {
      const w = pageWindow(rows.length, p);
      seen.push(...ids(rows.slice(w.from - 1, w.to)));
    }
    expect(seen).toEqual(ids(rows));
    expect(pageWindow(rows.length, null)).toMatchObject({ page: 3, from: 61, to: 75, atLatest: true });
    expect(pageWindow(0, null)).toMatchObject({ from: 0, to: 0, pages: 1, atLatest: true });
  });

  it("an explicit page does not move when new rows arrive, the latest page does", () => {
    const before = pageWindow(rows.length, 1);
    const grown = pageWindow(rows.length + 30, 1);
    expect(grown).toMatchObject({ from: before.from, to: before.to });
    expect(pageWindow(rows.length + 30, null).to).toBe(rows.length + 30);
  });

  it("combined filters: category, own unit and last turn; an empty result is explained", () => {
    const cole = filterRecord(rows, { ...NO_FILTER, unitId: "cole" });
    expect(cole.length).toBeGreaterThan(0);
    expect(cole.every((r) => r.ownUnitIds.includes("cole"))).toBe(true);
    const turn = new Set([many[60].id, many[61].id, "mB"]);
    const both = filterRecord(rows, { category: "combat", unitId: "cole", scopeIds: turn });
    expect(ids(both).every((i) => turn.has(i))).toBe(true);
    const none = filterRecord(rows, { category: "intel", unitId: "cole", scopeIds: null });
    expect(none).toEqual([]);
    const nm = (id: string) => (id === "cole" ? "USS Cole" : id);
    expect(describeFilter({ category: "intel", unitId: "cole", scopeIds: turn }, nm)).toBe("INTEL + USS COLE + LAST RESOLVED TURN");
    expect(describeFilter(NO_FILTER, nm)).toBe("NONE");
  });

  it("a newly arriving event appends without disturbing earlier rows", () => {
    const next = ev("hit", T0 + 99000, "Iran", "ir-sina", "cole", "late");
    const after = projectRecord(input({ combatLog: [...many, next], messages: [msg("mA", T0), msg("mB", T0 + 5000)] }));
    expect(ids(after).slice(0, 75)).toEqual(ids(rows));
    expect(ids(after)[75]).toBe(next.id);
  });
});

describe("combat record: weapons in flight and own force", () => {
  const shipIr = hostile[0];
  it("lists own weapons and generic incoming weapons only; hostile-only flights stay out of the list and the count", () => {
    const mine = wif(unit("own-fac", "US Navy", 2106, 56, 26), shipIr, "C-802 Noor");
    const incoming = wif(shipIr, own[1], "C-802 Noor");
    const unrelated = wif(hostile[1], hostile[2], "C-802 Noor");
    const rows = visibleWeapons([mine, incoming, unrelated], input());
    expect(rows).toHaveLength(2);
    expect(rows[0].label).toBe("C-802 Noor -> UNKNOWN TRACK");
    expect(rows[1].label).toBe("INCOMING WEAPON -> USS COLE");
    expect(rows[1].label).not.toMatch(/C-802/);
    expect(rows.map((r) => r.label).join("|")).not.toMatch(/Sina Secret|Kilo|Moskva|ir-sina/);
  });

  it("GOD view adds the unrelated flight, flagged, and drops it again when GOD is off", () => {
    const unrelated = wif(hostile[1], hostile[2], "C-802 Noor");
    const god = visibleWeapons([unrelated], input({ godMode: true }));
    expect(god).toHaveLength(1);
    expect(god[0].debug).toBe(true);
    expect(visibleWeapons([unrelated], input({ godMode: false }))).toHaveLength(0);
  });

  it("summarises own force condition with damage, mission kill and loss kept distinct", () => {
    const hurt = units.map((u) => (u.id === "cole" ? { ...u, damageState: "mission-kill" as const } : u.id === "nimitz" ? { ...u, damageState: "damaged" as const } : u));
    const f = ownForce(hurt, "US Navy");
    expect(f).toMatchObject({ total: 2, damaged: 1, missionKill: 1, lost: 0 });
    expect(f.affected.map((a) => a.id)).toEqual(["cole", "nimitz"]);
    const lost = ownForce(hurt.map((u) => (u.id === "cole" ? { ...u, damageState: "destroyed" as const } : u)), "US Navy");
    expect(lost).toMatchObject({ damaged: 1, missionKill: 0, lost: 1 });
  });
});
