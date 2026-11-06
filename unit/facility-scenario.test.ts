import { describe, expect, it } from "vitest";
import { demoScenario } from "@/lib/scenarios/demo";
import { distanceKm, findRunwayEnd, getFacility, hormuzFacilities, nearestFacility } from "@/lib/facilities/facilities";

const units = demoScenario.sides.flatMap((s) => s.units);
const based = units.filter((u) => u.homeBase);

describe("SAND-MAP-1 facility data in the demo scenario", () => {
  it("ships the Hormuz facilities with the scenario", () => {
    expect(demoScenario.facilities).toBe(hormuzFacilities);
    expect(hormuzFacilities.length).toBeGreaterThan(800);
    expect(hormuzFacilities.reduce((n, f) => n + (f.runways?.length ?? 0), 0)).toBeGreaterThan(150);
  });

  it("every homeBase points at a real facility (and runway end, when given)", () => {
    expect(based.length).toBeGreaterThanOrEqual(3);
    for (const u of based) {
      const f = getFacility(u.homeBase!.facilityId);
      expect(f, `${u.id} base`).toBeDefined();
      if (u.homeBase!.runwayEnd) expect(findRunwayEnd(f!, u.homeBase!.runwayEnd), `${u.id} runway`).toBeDefined();
    }
  });

  it("F-4/F-14 are bound to the nearest military airbase with a 1.8 km+ runway", () => {
    for (const id of ["ir-f4-1", "ir-f14-1"]) {
      const u = units.find((x) => x.id === id)!;
      const near = nearestFacility(u.position, { kind: "airbase", use: "military", minRunwayM: 1800 });
      expect(u.homeBase?.facilityId, id).toBe(near?.id);
    }
  });

  it("the alert Phantom spawns on the runway 08 threshold, heading along the runway", () => {
    const u = units.find((x) => x.id === "ir-f4-2")!;
    const f = getFacility("apt-oikp")!;
    const { end } = findRunwayEnd(f, "08")!;
    expect(distanceKm(u.position, end) * 1000).toBeLessThan(50);
    expect(u.altitude).toBe(0);
    expect(u.speed).toBe(0);
    const diff = Math.abs(((u.heading - end.headingTrue + 540) % 360) - 180);
    expect(diff).toBeLessThan(2);
  });

  it("runway ends lie on the runway axis at the stated length", () => {
    const f = getFacility("apt-ir-0161")!;
    for (const r of f.runways!) {
      expect(Math.abs(distanceKm(r.ends[0], r.ends[1]) * 1000 - r.lengthM) / r.lengthM).toBeLessThan(0.05);
    }
  });
});
