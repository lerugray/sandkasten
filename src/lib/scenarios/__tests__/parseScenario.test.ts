import { describe, expect, it } from "vitest";
import { parseScenarioFile } from "../parseScenario";

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
});
