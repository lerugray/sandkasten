import { test, expect, describe } from "vitest";
import { readFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
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
    expect((osmFacilities.find((f) => f.name === "Danger Area D1") as { areaType?: string } | undefined)?.areaType).toBe("danger_area");
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

  describe("runway designators and strip reconciliation", () => {
    const cd = (a: number, b: number) => {
      const x = Math.abs((((a - b) % 360) + 360) % 360);
      return x > 180 ? 360 - x : x;
    };
    // a ~2.4 km strip running ~095 deg true, digitised either way round
    const west = { lat: 26.0, lon: 55.0 };
    const east = { lat: 25.9981, lon: 55.0245 };
    const way = (id: number, ref: string, pts: { lat: number; lon: number }[], extra: Record<string, string> = {}) => ({
      type: "way",
      id,
      tags: { aeroway: "runway", ref, ...extra },
      geometry: pts,
    });

    test("designators follow the true bearing, not vertex order", () => {
      const fwd = parseOsmRunways([way(1, "09/27", [west, east])])[0].runway;
      const rev = parseOsmRunways([way(1, "09/27", [east, west])])[0].runway;
      expect(rev).toEqual(fwd);
      for (const e of fwd.ends) expect(cd(Number(e.ident.slice(0, 2)) * 10, e.headingTrue)).toBeLessThan(15);
      expect(fwd.ends[0].ident).toBe("09");
      expect(fwd.ends[0].lng).toBeLessThan(fwd.ends[1].lng);
    });

    test("a ref written in the wrong order for the geometry is corrected; L/R letters travel with their number", () => {
      const wrong = parseOsmRunways([way(2, "27L/09R", [west, east])])[0].runway;
      expect(wrong.ends.map((e: { ident: string }) => e.ident)).toEqual(["09R", "27L"]);
      expect(cd(90, wrong.ends[0].headingTrue)).toBeLessThan(15);
    });

    test("dash-separated and single refs parse; a missing ref is derived from the bearing", () => {
      expect(parseOsmRunways([way(3, "09-27", [west, east])])[0].runway.id).toBe("09/27");
      expect(parseOsmRunways([way(4, "09", [west, east])])[0].runway.id).toBe("09/27");
      expect(parseOsmRunways([way(5, "", [east, west])])[0].runway.id).toBe("09/27");
    });

    test("every committed runway end is within 15 deg of its designator and no strip is listed twice", () => {
      const data = JSON.parse(readFileSync(join(__dirname, "..", "data", "facilities", "hormuz.json"), "utf8"));
      let n = 0;
      for (const f of data.facilities) {
        const rws = f.runways ?? [];
        for (const r of rws) {
          n++;
          for (const e of r.ends) {
            expect(e.ident, `${f.id} ${r.id}`).toMatch(/^\d{2}[LRC]?$/);
            expect(cd(Number(e.ident.slice(0, 2)) * 10, e.headingTrue), `${f.id} ${r.id} ${e.ident}`).toBeLessThanOrEqual(15);
          }
        }
        for (let i = 0; i < rws.length; i++)
          for (let j = i + 1; j < rws.length; j++) {
            const mid = (r: { ends: { lat: number; lng: number }[] }) => ({ lat: (r.ends[0].lat + r.ends[1].lat) / 2, lng: (r.ends[0].lng + r.ends[1].lng) / 2 });
            const sameName = rws[i].id === rws[j].id;
            expect(sameName && haversineM(mid(rws[i]), mid(rws[j])) < 1500, `${f.id} duplicate ${rws[i].id}`).toBe(false);
          }
      }
      expect(n).toBeGreaterThan(150);
    });

    const aerodrome = (runways: unknown[]) => ({
      key: "ourairports:1",
      ident: "OIXX",
      name: "Test Field",
      kind: "airbase",
      airportType: "medium_airport",
      position: { lat: 25.999, lng: 55.012 },
      icao: "OIXX",
      sources: [{ source: "ourairports", id: "1", ident: "OIXX" }],
      runways,
    });

    test("OSM geometry wins over the charted copy; OurAirports surface/lighting/length merge in", () => {
      const oa = parseOurAirports(
        fx("facilities-airports.csv").split("\n")[0] + "\n" + "1,OIXX,medium_airport,Test Field,25.999,55.012,10,AS,IR,IR-07,Test,yes,OIXX,,OIXX,,,\n",
        "id,airport_ref,airport_ident,length_ft,width_ft,surface,lighted,closed,le_ident,le_latitude_deg,le_longitude_deg,le_elevation_ft,le_heading_degT,le_displaced_threshold_ft,he_ident,he_latitude_deg,he_longitude_deg,he_elevation_ft,he_heading_degT,he_displaced_threshold_ft\n9,1,OIXX,7800,148,ASP,1,0,09,26.0,55.0005,,,,27,25.9986,55.0240,,,\n",
        BBOX,
      );
      expect(oa).toHaveLength(1);
      expect(oa[0].runways).toHaveLength(1);
      const osm = parseOsmRunways([way(7, "09/27", [west, east], { surface: "unknown" })]);
      const { facilities } = mergeFacilities({ ourairports: oa, osmFacilities: [], osmRunways: osm });
      const rws = facilities.find((f: { icao?: string }) => f.icao === "OIXX")!.runways;
      expect(rws).toHaveLength(1);
      expect(rws[0].source).toEqual({ source: "osm", id: "way/7" });
      expect(rws[0].ends[0].lat).toBeCloseTo(26.0, 4);
      expect(rws[0].surface).toBe("asphalt");
      expect(rws[0].lighted).toBe(true);
      expect(rws[0].widthM).toBe(Math.round(148 * 0.3048));
      expect(rws[0].lengthM).toBe(Math.round(7800 * 0.3048));
      expect(rws[0].sources).toHaveLength(2);
    });

    test("segments merge into one strip whatever order they arrive in", () => {
      const mid1 = { lat: 25.99935, lon: 55.0123 };
      const mid2 = { lat: 25.99925, lon: 55.0129 };
      const seg = (order: number[]) => {
        const all = [
          way(11, "09/27", [west, mid1]),
          way(12, "09/27", [mid2, east]),
          way(13, "09/27", [mid1, mid2]),
        ];
        return order.map((i) => all[i]);
      };
      const run = (order: number[], reverse = false) => {
        const rws = parseOsmRunways(seg(order).map((e) => (reverse ? { ...e, geometry: [...e.geometry].reverse() } : e)));
        return mergeFacilities({
          ourairports: [aerodrome([])] as never,
          osmFacilities: [],
          osmRunways: rws,
        }).facilities[0].runways;
      };
      const base = run([0, 1, 2]);
      expect(base).toHaveLength(1);
      expect(base[0].lengthM).toBeGreaterThan(2300);
      for (const order of [[2, 1, 0], [1, 0, 2], [2, 0, 1]]) expect(run(order)).toEqual(base);
      expect(run([0, 1, 2], true)).toEqual(base);
    });

    test("parallel runways with L/R letters stay separate", () => {
      const off = (p: { lat: number; lon: number }) => ({ lat: p.lat + 0.0035, lon: p.lon });
      const { facilities } = mergeFacilities({
        ourairports: [aerodrome([])] as never,
        osmFacilities: [],
        osmRunways: parseOsmRunways([way(21, "09L/27R", [west, east]), way(22, "09R/27L", [off(west), off(east)])]),
      });
      expect(facilities[0].runways.map((r: { id: string }) => r.id).sort()).toEqual(["09L/27R", "09R/27L"]);
    });
  });

  test("hormuz.json regenerates byte-for-byte offline from the committed raw snapshot", () => {
    const out = join(mkdtempSync(join(tmpdir(), "fac-")), "hormuz.json");
    execFileSync("node", ["scripts/build-facilities.mjs", "--offline", "--out", out], { cwd: join(__dirname, ".."), stdio: "pipe" });
    expect(readFileSync(out, "utf8")).toBe(readFileSync(join(__dirname, "..", "data", "facilities", "hormuz.json"), "utf8"));
  });
});
