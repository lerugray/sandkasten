import { test, expect, describe } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  bearingDeg,
  haversineM,
  mergeFacilities,
  parseCsv,
  parseOsmFacilities,
  parseOsmRunways,
  parseOurAirports,
  normalizeSurface,
} from "../scripts/lib/facilities.mjs";

const fx = (n: string) => readFileSync(join(__dirname, "fixtures", n), "utf8");
const BBOX = { south: 22.5, west: 50, north: 30, east: 61 };

function build() {
  const ourairports = parseOurAirports(fx("facilities-airports.csv"), fx("facilities-runways.csv"), BBOX);
  const elements = JSON.parse(fx("facilities-overpass.json")).elements;
  const osmFacilities = parseOsmFacilities(elements);
  const osmRunways = parseOsmRunways(elements);
  return { ourairports, osmFacilities, osmRunways, ...mergeFacilities({ ourairports, osmFacilities, osmRunways }) };
}

describe("facility pipeline", () => {
  test("parseCsv handles quoted fields, doubled quotes and empties", () => {
    const rows = parseCsv(fx("facilities-airports.csv"));
    expect(rows).toHaveLength(6);
    expect(rows[2].name).toBe('Norunway "Strip"');
    expect(rows[0].iata_code).toBe("BND");
  });

  test("OurAirports: bbox + type filter, real runway ends, derived ends flagged", () => {
    const { ourairports } = build();
    expect(ourairports.map((a) => a.ident).sort()).toEqual(["OIKB", "OIKQ", "XX01", "XXH1"]);
    const oikb = ourairports.find((a) => a.ident === "OIKB")!;
    const rw = oikb.runways[0];
    expect(rw.id).toBe("03/21");
    expect(rw.derivedEnds).toBe(false);
    expect(rw.lengthM).toBe(Math.round(11811 * 0.3048));
    expect(rw.ends[0].lat).toBeCloseTo(27.2031, 4);
    expect(rw.ends[1].lng).toBeCloseTo(56.3875, 4);
    expect(rw.ends[0].headingTrue).toBeGreaterThan(20);
    expect(rw.ends[1].headingTrue).toBe((rw.ends[0].headingTrue + 180) % 360);
    expect(rw.surface).toBe("asphalt");
    expect(rw.lighted).toBe(true);

    const oikq = ourairports.find((a) => a.ident === "OIKQ")!.runways[0];
    expect(oikq.derivedEnds).toBe(true);
    expect(haversineM(oikq.ends[0], oikq.ends[1])).toBeGreaterThan(oikq.lengthM - 15);
    expect(haversineM(oikq.ends[0], oikq.ends[1])).toBeLessThan(oikq.lengthM + 15);
    expect(Math.abs(bearingDeg(oikq.ends[0], oikq.ends[1]) - 128)).toBeLessThan(1);

    const strip = ourairports.find((a) => a.ident === "XX01")!.runways[0];
    expect(strip.ends[0].headingTrue).toBe(90);
    expect(strip.surface).toBe("grass");
  });

  test("OSM: dead lifecycle skipped, unnamed port skipped, runway ends from geometry", () => {
    const { osmFacilities, osmRunways } = build();
    const names = osmFacilities.map((f) => f.name);
    expect(names).not.toContain("Gone");
    expect(osmFacilities.filter((f) => f.kind === "port").map((f) => f.name)).toEqual(["Shahid Rajaee Port"]);
    expect(osmFacilities.find((f) => f.name === "Danger Area D1")?.areaType).toBe("danger_area");
    expect(osmRunways).toHaveLength(2);
    const r = osmRunways.find((x) => x.osmId === "way/951")!.runway;
    expect(r.ends[0].ident).toBe("06");
    expect(r.ends[1].ident).toBe("24");
    expect(r.widthM).toBeNull();
    expect(r.surface).toBe("concrete");
  });

  test("merge: OurAirports + OSM dedupe by code and proximity, OSM runways fill gaps only", () => {
    const { facilities, osmRunwayCount } = build();
    const air = facilities.filter((f) => f.kind === "airbase");
    expect(air).toHaveLength(4);
    const oikb = air.find((f) => f.icao === "OIKB")!;
    expect(oikb.id).toBe("apt-oikb");
    expect(oikb.sources.map((s: { source: string }) => s.source).sort()).toEqual(["osm", "osm", "ourairports"]);
    expect(oikb.polygon).not.toBeNull();
    expect(oikb.use).toBe("military");
    expect(oikb.runways).toHaveLength(1); // OSM way/950 duplicates the OurAirports strip

    const oikq = air.find((f) => f.icao === "OIKQ")!;
    expect(oikq.sources.some((s: { source: string }) => s.source === "osm")).toBe(true);
    expect(oikq.use).toBe("civil");

    const osmOnly = air.find((f) => f.name === "Jazireh-ye Test Air Base")!;
    expect(osmOnly.sources.every((s: { source: string }) => s.source === "osm")).toBe(true);
    expect(osmOnly.runways).toHaveLength(1);
    expect(osmOnly.runways[0].source.source).toBe("osm");
    expect(osmOnly.use).toBe("military");

    expect(osmRunwayCount.attached).toBe(2);
    const heli = facilities.filter((f) => f.kind === "heliport");
    expect(heli.map((f) => f.name)).toEqual(["Offshore Platform Heliport"]);
    expect(heli[0].runways).toBeUndefined();
    expect(facilities.filter((f) => f.kind === "naval_base")).toHaveLength(1);
    expect(facilities.filter((f) => f.kind === "port")).toHaveLength(1);
    expect(facilities.filter((f) => f.kind === "military_area")).toHaveLength(1);
    const ids = facilities.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("normalizeSurface", () => {
    expect(normalizeSurface("ASPH-G")).toBe("asphalt");
    expect(normalizeSurface("CONC")).toBe("concrete");
    expect(normalizeSurface("")).toBe("unknown");
  });
});
