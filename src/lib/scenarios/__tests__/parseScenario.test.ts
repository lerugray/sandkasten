import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseScenarioFile, MAX_SCENARIO_UNITS } from "../parseScenario";
import { demoScenario } from "../demo";
import { exampleSnapshotScenario } from "@/lib/snapshot/example";

const valid = {
  name: "Round Trip",
  description: "d",
  briefing: "b",
  theater: { center: { lng: 56.5, lat: 26.5 }, zoom: 7 },
  startTime: "2026-01-01T00:00:00.000Z",
  playerSide: "Side A",
  sides: [
    { name: "Side A", color: "#00aaff", isAI: false, units: [{ id: "u1", name: "One", platformId: 1, side: "Side A", position: { lng: 56, lat: 26 }, heading: 0, speed: 0, damageState: "undamaged" }] },
    { name: "Side B", color: "#ff4444", isAI: true, units: [] },
  ],
  referencePoints: [],
};

describe("parseScenarioFile", () => {
  it("round-trips a scenario written by the editor SAVE", () => {
    const r = parseScenarioFile(JSON.stringify(valid, null, 2));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.scenario).toEqual(valid);
  });

  it("fills optional fields a hand-written file leaves out", () => {
    const { description, briefing, referencePoints, ...rest } = valid;
    void description; void briefing; void referencePoints;
    const r = parseScenarioFile(JSON.stringify(rest));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.scenario.referencePoints).toEqual([]);
      expect(r.scenario.description).toBe("");
    }
  });

  it("falls back to the first side when playerSide names no side", () => {
    const r = parseScenarioFile(JSON.stringify({ ...valid, playerSide: "Nobody" }));
    expect(r.ok && r.scenario.playerSide).toBe("Side A");
  });

  it.each([
    ["broken JSON", "{not json"],
    ["null", "null"],
    ["an array", "[1,2]"],
    ["a number", "42"],
    ["a battle save", JSON.stringify({ format: "sandkasten-save", clock: 123 })],
    ["no theater", JSON.stringify({ ...valid, theater: undefined })],
    ["a side with no units list", JSON.stringify({ ...valid, sides: [{ name: "A" }] })],
    ["a unit with no position", JSON.stringify({ ...valid, sides: [{ name: "A", units: [{ id: "x" }] }] })],
  ])("refuses %s with a message", (_label, text) => {
    const r = parseScenarioFile(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(10);
  });

  describe("SAND-RC-FIX2 hardening", () => {
    const withUnit = (patch: Record<string, unknown>) => ({
      ...valid,
      sides: [{ ...valid.sides[0], units: [{ ...valid.sides[0].units[0], ...patch }] }, valid.sides[1]],
    });
    const refused = (obj: unknown, re: RegExp) => {
      const r = parseScenarioFile(typeof obj === "string" ? obj : JSON.stringify(obj));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(re);
    };

    it("refuses latitude 95 on a unit, with a plain message", () => refused(withUnit({ position: { lng: 56, lat: 95 } }), /position is off the map/));
    it("refuses longitude 200 on a unit", () => refused(withUnit({ position: { lng: 200, lat: 26 } }), /position is off the map/));
    it("refuses an off-map theater centre", () => refused({ ...valid, theater: { center: { lng: 56, lat: -91 }, zoom: 7 } }, /off the map/));
    it("refuses zoom 99 and negative zoom", () => {
      refused({ ...valid, theater: { center: valid.theater.center, zoom: 99 } }, /zoom/);
      refused({ ...valid, theater: { center: valid.theater.center, zoom: -1 } }, /zoom/);
    });
    it("refuses an off-map reference point", () =>
      refused({ ...valid, referencePoints: [{ id: "r", name: "r", type: "point", points: [{ lng: 0, lat: 120 }] }] }, /off the map/));
    it("refuses a unit name that is an object", () => refused(withUnit({ name: { a: 1 } }), /name or side is not text/));
    it("refuses a unit side that is a number", () => refused(withUnit({ side: 7 }), /name or side is not text/));
    it("refuses a platformId that is text", () => refused(withUnit({ platformId: "F-16" }), /platformId/));
    it("refuses a side colour that is a number", () =>
      refused({ ...valid, sides: [{ ...valid.sides[0], color: 255 }, valid.sides[1]] }, /colour is not text/));

    it("refuses more than 5,000 units, accepts exactly 5,000", () => {
      const mk = (n: number) => ({
        ...valid,
        sides: [{ ...valid.sides[0], units: Array.from({ length: n }, (_, i) => ({ ...valid.sides[0].units[0], id: `u${i}` })) }, valid.sides[1]],
      });
      refused(mk(MAX_SCENARIO_UNITS + 1), /too many units/);
      expect(parseScenarioFile(JSON.stringify(mk(MAX_SCENARIO_UNITS))).ok).toBe(true);
    });
    it("refuses a file over 5 MB of text before parsing it", () =>
      refused(JSON.stringify({ ...valid, description: "x".repeat(5 * 1024 * 1024 + 1) }), /too big/));

    it("still accepts the edge values, and units that leave optional fields out", () => {
      const r = parseScenarioFile(JSON.stringify({
        ...valid,
        theater: { center: { lng: -180, lat: 90 }, zoom: 24 },
        sides: [{ name: "A", units: [{ id: "x", position: { lng: 180, lat: -90 } }] }],
      }));
      expect(r.ok).toBe(true);
    });

    it("accepts the shipped Hormuz scenario, the example snapshot, and a SAVE of each, unchanged", () => {
      for (const sc of [demoScenario, exampleSnapshotScenario]) {
        const saved = JSON.stringify(sc, null, 2); // exactly what the editor SAVE writes
        const r = parseScenarioFile(saved);
        expect(r.ok, sc.name).toBe(true);
        if (r.ok) expect(r.scenario).toEqual(JSON.parse(saved));
      }
    });

    it("accepts the shipped scenario files and the example snapshot unchanged", () => {
      const dir = path.join(process.cwd(), "data", "snapshots");
      const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
      expect(files.length).toBeGreaterThan(0);
      for (const f of files) {
        const text = readFileSync(path.join(dir, f), "utf8");
        const r = parseScenarioFile(text);
        expect(r.ok, f).toBe(true);
        if (r.ok) expect(r.scenario.sides.length).toBe(JSON.parse(text).sides.length);
      }
    });
  });
});
