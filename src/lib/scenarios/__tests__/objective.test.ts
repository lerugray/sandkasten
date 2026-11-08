import { describe, it, expect } from "vitest";
import { demoScenarioConfig } from "../demoConfig";
import { demoScenario } from "../demo";
import { snapshotScenarioConfig } from "@/lib/snapshot/playConfig";
import { describeEndings, distanceToAreaNm, missionLines, missionProgress, openingBriefing, transitObjective } from "../objective";
import { isPointInPolygon } from "@/lib/ai/events";

const obj = () => transitObjective(demoScenarioConfig)!;

describe("SAND-PLAY-1 shared transit objective", () => {
  it("is read from the shipped scenario's own end events and gate polygon", () => {
    const o = obj();
    expect(o).not.toBeNull();
    expect(o.unitId).toBe("us-cvn-1");
    expect(o.side).toBe("US Navy");
    expect(o.unitName).toBe("USS Nimitz (CVN-68)");
    expect(o.unitShort).toBe("USS Nimitz");
    const gate = demoScenario.referencePoints.find((r) => r.id === "transit-gate")!;
    // the very array the event evaluator reads, not a copy
    expect(o.area).toBe(gate.points);
  });

  it("is absent for a scenario without the transit win/loss events (snapshot, legacy)", () => {
    expect(transitObjective(snapshotScenarioConfig())).toBeNull();
    expect(transitObjective({ scenario: demoScenario, events: { events: [], firedEvents: new Set(), messages: [] } })).toBeNull();
  });

  it("says in plain words what wins and what loses, and that time or escorts cannot", () => {
    const l = missionLines(obj(), describeEndings(demoScenarioConfig, "US Navy"));
    expect(l.win).toMatch(/USS Nimitz enters the transit gate/);
    expect(l.lose).toMatch(/USS Nimitz is destroyed/);
    expect(l.notes).toMatch(/No time limit/);
  });

  it("measures the distance to the gate by the same polygon test the evaluator uses", () => {
    const o = obj();
    const inside = { lng: 56.45, lat: 26.65 };
    expect(isPointInPolygon(inside, o.area)).toBe(true);
    expect(distanceToAreaNm(inside, o.area)).toBe(0);
    const start = demoScenario.sides[0].units.find((u) => u.id === "us-cvn-1")!.position;
    const d = distanceToAreaNm(start, o.area);
    expect(d).toBeGreaterThan(50);
    expect(d).toBeLessThan(150);
    // just outside the south edge (26.5N): about 6 NM
    expect(distanceToAreaNm({ lng: 56.45, lat: 26.4 }, o.area)).toBeCloseTo(6, 0);
  });

  it("progress is pending until the authoritative result arrives, whatever the distance", () => {
    const o = obj();
    const units = demoScenario.sides.flatMap((s) => s.units).map((u) => (u.id === "us-cvn-1" ? { ...u, position: { lng: 56.45, lat: 26.65 } } : u));
    const p = missionProgress(o, units, undefined);
    expect(p.status).toBe("pending");
    expect(p.distanceNm).toBe(0);
    expect(missionProgress(o, units, { result: "victory", message: "m" }).status).toBe("complete");
    expect(missionProgress(o, units, { result: "defeat", message: "m" }).status).toBe("failed");
  });

  it("the opening briefing follows the live config, and a snapshot gets its own", () => {
    expect(openingBriefing(demoScenarioConfig).title).toBe("OPERATION SENTINEL PASSAGE");
    const snap = snapshotScenarioConfig();
    expect(openingBriefing(snap).text).toBe(snap.scenario.briefing);
  });
});
