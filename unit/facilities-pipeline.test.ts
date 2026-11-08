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
  ARABIC_SCRIPT,
  englishFallbackName,
} from "../scripts/lib/facilities.mjs";
import { runwayThreshold } from "../src/lib/facilities/facilities";

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
          if (r.construction) {
            expect(r.closed, `${f.id} ${r.id}`).toBe(true);
            for (const e of r.ends) expect(e.ident, `${f.id} ${r.id}`).toBe("");
            continue;
          }
          for (const e of r.ends) {
            expect(e.ident, `${f.id} ${r.id}`).toMatch(/^\d{2}[LRC]?$/);
            expect(cd(Number(e.ident.slice(0, 2)) * 10, e.headingTrue), `${f.id} ${r.id} ${e.ident}`).toBeLessThanOrEqual(15);
          }
        }
        for (let i = 0; i < rws.length; i++)
          for (let j = i + 1; j < rws.length; j++) {
            const mid = (r: { ends: { lat: number; lng: number }[] }) => ({ lat: (r.ends[0].lat + r.ends[1].lat) / 2, lng: (r.ends[0].lng + r.ends[1].lng) / 2 });
            const sameName = rws[i].id === rws[j].id && !rws[i].construction;
            const a = rws[i].ends[0], b = rws[i].ends[1], m = mid(rws[j]);
            const kx = 111320 * Math.cos((a.lat * Math.PI) / 180), ky = 110540;
            const [bx, by, mx, my] = [(b.lng - a.lng) * kx, (b.lat - a.lat) * ky, (m.lng - a.lng) * kx, (m.lat - a.lat) * ky];
            const across = Math.abs(bx * my - by * mx) / Math.hypot(bx, by);
            // two same-numbered strips more than a strip width apart are two strips (Fujairah, 13/31 dirt strips), not one listed twice
            expect(sameName && haversineM(mid(rws[i]), mid(rws[j])) < 1500 && across <= 60, `${f.id} duplicate ${rws[i].id}`).toBe(false);
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

  describe("B: labels are English", () => {
    test("no committed facility name contains Arabic-script code points", () => {
      const data = JSON.parse(readFileSync(join(__dirname, "..", "data", "facilities", "hormuz.json"), "utf8"));
      const bad = data.facilities.filter((f: { name: string }) => ARABIC_SCRIPT.test(f.name)).map((f: { id: string }) => f.id);
      expect(bad).toEqual([]);
      const kish = data.facilities.find((f: { id: string }) => f.id === "apt-node-8625983990");
      expect(kish.name).toBe("Kish Island Air Base");
      expect(kish.nameLocal).toBe("پایگاه هوایی");
    });

    test("an OSM element with only a Persian name gets an English type description; name:en wins when present", () => {
      const el = (id: number, tags: Record<string, string>) => ({ type: "node", id, lat: 26.5, lon: 54.0, tags });
      const out = parseOsmFacilities([
        el(1, { aeroway: "aerodrome", name: "فرودگاه سمپاشی جره" }),
        el(2, { aeroway: "aerodrome", name: "فرودگاه", "name:en": "Example Airport" }),
        el(3, { military: "range", name: "بسیج سندرک" }),
      ]);
      expect(out.map((f: { name: string }) => f.name)).toEqual(["Crop-spraying airstrip", "Example Airport", "Basij post"]);
      expect(out[0].nameLocal).toBe("فرودگاه سمپاشی جره");
      expect(englishFallbackName("نامعلوم", "military_area", "range")).toBe("Military range");
    });
  });

  describe("D1: an unlettered chart record joins at most one parallel strip", () => {
    const west = { lat: 26.0, lon: 55.0 };
    const east = { lat: 25.9981, lon: 55.0245 };
    const off = (p: { lat: number; lon: number }, d: number) => ({ lat: p.lat + d, lon: p.lon });
    const way = (id: number, ref: string, pts: { lat: number; lon: number }[]) => ({ type: "way", id, tags: { aeroway: "runway", ref }, geometry: pts });
    const oaFor = (le: [number, number], he: [number, number]) =>
      parseOurAirports(
        fx("facilities-airports.csv").split("\n")[0] + "\n" + "1,OIXX,medium_airport,Test Field,25.999,55.012,10,AS,IR,IR-07,Test,yes,OIXX,,OIXX,,,\n",
        "id,airport_ref,airport_ident,length_ft,width_ft,surface,lighted,closed,le_ident,le_latitude_deg,le_longitude_deg,le_elevation_ft,le_heading_degT,le_displaced_threshold_ft,he_ident,he_latitude_deg,he_longitude_deg,he_elevation_ft,he_heading_degT,he_displaced_threshold_ft\n" +
          `9,1,OIXX,7800,148,ASP,1,0,09,${le[0]},${le[1]},,,,27,${he[0]},${he[1]},,,\n`,
        BBOX,
      );
    const run = (osm: unknown[]) =>
      mergeFacilities({ ourairports: oaFor([26.0 - 0.0003, 55.0005], [25.9981 - 0.0003, 55.0240]), osmFacilities: [], osmRunways: parseOsmRunways(osm as never) }).facilities.find(
        (f: { icao?: string }) => f.icao === "OIXX",
      )!.runways as { id: string; surface: string }[];

    test("09/27 chart record between OSM 09L/27R and 09R/27L keeps both strips, in any input order", () => {
      const l = way(21, "09L/27R", [off(west, 0.0035), off(east, 0.0035)]);
      const r = way(22, "09R/27L", [west, east]);
      const a = run([l, r]);
      expect(a.map((x) => x.id).sort()).toEqual(["09L/27R", "09R/27L"]);
      expect(run([r, l])).toEqual(a);
      expect(a.filter((x) => x.surface === "asphalt")).toHaveLength(1);
    });

    test("OA-between-L/R fixture: no third runway; the chart record attaches to the strip with the nearer centreline", () => {
      const l = way(21, "09L/27R", [off(west, 0.0035), off(east, 0.0035)]);
      const r = way(22, "09R/27L", [west, east]);
      const at = (d: number) =>
        mergeFacilities({ ourairports: oaFor([26.0 + d, 55.0005], [25.9981 + d, 55.0240]), osmFacilities: [], osmRunways: parseOsmRunways([l, r] as never) }).facilities.find(
          (f: { icao?: string }) => f.icao === "OIXX",
        )!.runways as { id: string; surface: string; sources?: unknown[] }[];
      for (const d of [-0.0003, 0.0015, 0.0032, 0.0017]) {
        const out = at(d);
        expect(out, `chart offset ${d}`).toHaveLength(2);
        const charted = out.filter((x) => x.sources?.length === 2);
        expect(charted).toHaveLength(1);
        expect(charted[0].id).toBe(d < 0.00175 ? "09R/27L" : "09L/27R");
      }
    });

    test("a displaced chart record attaches to the one surveyed strip it matches instead of creating another", () => {
      const r = way(22, "09R/27L", [west, east]);
      for (const d of [-0.0003, -0.0014, -0.0045]) {
        const out = mergeFacilities({ ourairports: oaFor([26.0 + d, 55.0005], [25.9981 + d, 55.0240]), osmFacilities: [], osmRunways: parseOsmRunways([r] as never) }).facilities.find(
          (f: { icao?: string }) => f.icao === "OIXX",
        )!.runways as { id: string; source: { id: string }; surface: string }[];
        expect(out, `chart offset ${d}`).toHaveLength(1);
        expect(out[0].source.id).toBe("way/22");
        expect(out[0].surface).toBe("asphalt");
      }
    });

    test("an OSM construction strip beside an active strip keeps construction/closed, takes no designator or chart metadata, and the chart record joins the active strip", () => {
      const active = way(31, "11/29", [west, east]);
      const build = { ...way(32, "", [off(west, 0.0012), off(east, 0.0012)]), tags: { aeroway: "runway", construction: "yes" } };
      for (const order of [[active, build], [build, active]]) {
        const out = mergeFacilities({ ourairports: oaFor([26.0 + 0.0004, 55.0005], [25.9981 + 0.0004, 55.0240]), osmFacilities: [], osmRunways: parseOsmRunways(order as never) }).facilities.find(
          (f: { icao?: string }) => f.icao === "OIXX",
        )!.runways as { id: string; closed: boolean; construction?: boolean; surface: string; source: { id: string }; sources?: unknown[]; ends: { ident: string }[] }[];
        expect(out).toHaveLength(2);
        const c = out.find((x) => x.source.id === "way/32")!;
        const a = out.find((x) => x.source.id === "way/31")!;
        expect(c.construction).toBe(true);
        expect(c.closed).toBe(true);
        expect(c.ends.map((e) => e.ident)).toEqual(["", ""]);
        expect(c.surface).toBe("unknown");
        expect(c.sources).toBeUndefined();
        expect(a.construction).toBeUndefined();
        expect(a.closed).toBe(false);
        expect(a.sources).toHaveLength(2);
        expect(a.ends[0].ident).toBe("11");
      }
    });

    test("committed data: Fujairah keeps its active strip and the offset construction strip apart", () => {
      const data = JSON.parse(readFileSync(join(__dirname, "..", "data", "facilities", "hormuz.json"), "utf8"));
      const rw = data.facilities.find((f: { id: string }) => f.id === "apt-omfj").runways as { ends: { lat: number; lng: number }[] }[];
      expect(rw).toHaveLength(2);
      const [a, b] = [rw[0].ends, rw[1].ends];
      const ky = 110540, kx = 111320 * Math.cos((a[0].lat * Math.PI) / 180);
      const [bx, by, mx, my] = [(a[1].lng - a[0].lng) * kx, (a[1].lat - a[0].lat) * ky, (b[0].lng - a[0].lng) * kx, (b[0].lat - a[0].lat) * ky];
      expect(Math.abs(bx * my - by * mx) / Math.hypot(bx, by)).toBeGreaterThan(100);
    });

    test("committed data: no airfield, base or port is named by a bare type word", () => {
      const data = JSON.parse(readFileSync(join(__dirname, "..", "data", "facilities", "hormuz.json"), "utf8"));
      const bare = /^(air base|airfield|coast guard base|naval base|military helipad|air defence base|border guard command)$/i;
      const names = data.facilities.filter((f: { kind: string; name: string }) => ["airbase", "naval_base", "port", "heliport"].includes(f.kind) && bare.test(f.name)).map((f: { name: string }) => f.name);
      expect(names).toEqual([]);
      const by = (id: string) => data.facilities.find((f: { id: string }) => f.id === id).name;
      expect(by("apt-node-8625983990")).toBe("Kish Island Air Base");
      expect(by("nav-node-5759688563")).toBe("Kangan Coast Guard Base");
    });

    test("committed data: Chabahar Konarak Intl keeps 09L/27R and 09R/27L", () => {
      const data = JSON.parse(readFileSync(join(__dirname, "..", "data", "facilities", "hormuz.json"), "utf8"));
      const ids = data.facilities.find((f: { id: string }) => f.id === "apt-oizc").runways.map((r: { id: string }) => r.id).sort();
      expect(ids).toEqual(["09L/27R", "09R/27L"]);
    });

    test("committed data: the unlettered construction strips at the airfield near Chabahar Konarak stay two separate closed strips with no designators", () => {
      const data = JSON.parse(readFileSync(join(__dirname, "..", "data", "facilities", "hormuz.json"), "utf8"));
      const f = data.facilities.find((x: { id: string }) => x.id === "apt-node-8503286429");
      expect(f.name).toMatch(/Chabahar Konarak/);
      expect(f.runways).toHaveLength(2);
      expect(f.runways.map((r: { source: { id: string } }) => r.source.id).sort()).toEqual(["way/903590322", "way/903590323"]);
      for (const r of f.runways) {
        expect(r.construction).toBe(true);
        expect(r.closed).toBe(true);
        expect(r.ends.map((e: { ident: string }) => e.ident)).toEqual(["", ""]);
      }
    });

    const committed = () => JSON.parse(readFileSync(join(__dirname, "..", "data", "facilities", "hormuz.json"), "utf8")).facilities as { id: string; runways: { id: string; lengthM: number; closed: boolean; construction?: boolean; lengthUnverified?: boolean; source: { id: string }; sources?: { id: string }[]; ends: { ident: string; lat: number; lng: number }[] }[] }[];

    test("committed data: Kish has exactly 2 runways, no duplicate 09R/27L, and the 09R threshold is the OSM threshold (< 10 m)", () => {
      const f = committed().find((x) => x.id === "apt-oibk")!;
      expect(f.runways.map((r) => r.id).sort()).toEqual(["09L/27R", "09R/27L"]);
      const t = runwayThreshold("apt-oibk", "09R");
      // OSM way/4498211, west end
      expect(haversineM({ lat: 26.5268461, lng: 53.9625704 }, { lat: t.position.lat, lng: t.position.lng })).toBeLessThan(10);
      expect(f.runways.find((r) => r.id === "09R/27L")!.source.id).toBe("way/4498211");
    });

    test("committed data: Suweihan and Al Saqr list their strip once", () => {
      for (const id of ["apt-omaw", "apt-omrs"]) {
        const f = committed().find((x) => x.id === id)!;
        expect(f.runways, id).toHaveLength(1);
        expect(f.runways[0].source.id.startsWith("way/")).toBe(true);
        expect(f.runways[0].sources!.length).toBeGreaterThan(1);
      }
      // a chart length describing a different extent than the drawn strip does not replace it (Suweihan: 2158 m charted, 3808 m drawn)
      expect(committed().find((x) => x.id === "apt-omaw")!.runways[0].lengthM).toBeGreaterThan(3700);
    });

    test("committed data: shown lengths follow source agreement; drawn ends, spawn thresholds and closed flags are unchanged by it", () => {
      const len = (id: string) => committed().find((x) => x.id === id)!.runways[0];
      // Arzanah: chart 1048 m and OSM length=1047.90 agree; the geometry is a "FIXME - rough sketch" of 849 m
      expect(len("apt-omar").lengthM).toBe(1048);
      // Khasab: chart 2500 m and OSM length=2516 agree; the drawn extent is 2786 m
      expect(len("apt-ookb").lengthM).toBe(2500);
      // Jiroft: chart 2206 m and OSM length=2206 agree; the drawn extent (with its displaced-threshold way) is 3300 m
      expect(len("apt-oikj").lengthM).toBe(2206);
      // Lavan: OSM length=2693 and its 2698 m geometry agree against the 2077 m chart, so the OSM extent stands
      expect(len("apt-oibv").lengthM).toBe(2698);
      // Umm Al-Shokhot: OSM length=730 agrees with the chart's own end coordinates (730 m), not its rounded 500 m field
      expect(len("apt-ot62").lengthM).toBe(730);
      for (const id of ["apt-omar", "apt-ookb", "apt-oikj", "apt-oibv", "apt-ot62"]) expect(len(id).lengthUnverified, id).toBeUndefined();
      // nothing corroborates: the chart value is kept and flagged
      for (const id of ["apt-omaz", "apt-omby"]) expect(len(id).lengthUnverified, id).toBe(true);
      expect(len("apt-omaz").lengthM).toBe(1200);
      expect(len("apt-omby").lengthM).toBe(2826);
      // spawn thresholds and closed flags are the FIX3 ones
      const before = JSON.parse(readFileSync(join(__dirname, "fixtures", "runway-ends-fix3.json"), "utf8")) as Record<string, { closed: boolean; ends: { ident: string; lat: number; lng: number }[] }>;
      for (const [id, want] of Object.entries(before)) {
        const r = len(id);
        expect(r.closed, id).toBe(want.closed);
        expect(r.ends.map((e) => [e.ident, e.lat, e.lng]), id).toEqual(want.ends.map((e) => [e.ident, e.lat, e.lng]));
      }
    });

    test("length resolution: the charted length stands when it agrees with the drawn extent or the OSM length tag, rough-sketch or not", () => {
      const mk = (extra: Record<string, string>, chartLat: number) =>
        mergeFacilities({
          ourairports: oaFor([26.0, 55.0005], [chartLat, 55.0240]),
          osmFacilities: [],
          osmRunways: parseOsmRunways([{ ...way(41, "09/27", [west, east]), tags: { aeroway: "runway", ref: "09/27", ...extra } }] as never),
        }).facilities.find((f: { icao?: string }) => f.icao === "OIXX")!.runways as { lengthM: number; lengthUnverified?: boolean }[];
      // chart 7800 ft = 2377 m; drawn extent about 2.46 km
      expect(mk({}, 25.9981)[0].lengthM).toBe(2377);
      expect(mk({ length: "2400", note: "FIXME - rough sketch" }, 25.9981)[0].lengthM).toBe(2377);
    });

    test("committed data: Fujairah construction strip stays construction/closed with no designator; the selected 11/29 threshold is on the active GCAA strip", () => {
      const f = committed().find((x) => x.id === "apt-omfj")!;
      expect(f.runways).toHaveLength(2);
      const c = f.runways.find((r) => r.source.id === "way/1035327859")!;
      expect(c.construction).toBe(true);
      expect(c.closed).toBe(true);
      expect(c.ends.map((e) => e.ident)).toEqual(["", ""]);
      expect(c.sources).toBeUndefined();
      const a = f.runways.find((r) => r.source.id === "way/194888622")!;
      expect(a.closed).toBe(false);
      expect(a.id).toBe("11/29");
      // OSM way/194888622, 29 end
      expect(haversineM({ lat: 25.1056547, lng: 56.3414003 }, runwayThreshold("apt-omfj", "29").position)).toBeLessThan(10);
      expect(haversineM({ lat: a.ends[0].lat, lng: a.ends[0].lng }, runwayThreshold("apt-omfj", "11").position)).toBeLessThan(1);
    });

    test("committed data: Al Udeid keeps 16L/34R and 16R/34L, Sheik Isa keeps both runways, no duplicates", () => {
      const data = JSON.parse(readFileSync(join(__dirname, "..", "data", "facilities", "hormuz.json"), "utf8"));
      const ids = (icao: string) => data.facilities.find((f: { id: string }) => f.id === `apt-${icao}`).runways.map((r: { id: string }) => r.id).sort();
      expect(ids("otbh")).toEqual(["16L/34R", "16R/34L"]);
      expect(ids("obbs")).toEqual(["15L/33R", "15R/33L"]);
    });
  });

  test("hormuz.json regenerates byte-for-byte offline from the committed raw snapshots (facilities, then OSINT overlay)", () => {
    const dir = mkdtempSync(join(tmpdir(), "fac-"));
    const out = join(dir, "hormuz.json");
    const cwd = join(__dirname, "..");
    execFileSync("node", ["scripts/build-facilities.mjs", "--offline", "--out", out], { cwd, stdio: "pipe" });
    execFileSync("node", ["scripts/import-osint.mjs", "--facilities", out, "--out", join(dir, "osint.json")], { cwd, stdio: "pipe" });
    const norm = (s: string) => s.replace(/\r\n/g, "\n");
    expect(norm(readFileSync(out, "utf8"))).toBe(norm(readFileSync(join(cwd, "data", "facilities", "hormuz.json"), "utf8")));
    expect(norm(readFileSync(join(dir, "osint.json"), "utf8"))).toBe(norm(readFileSync(join(cwd, "data", "osint", "hormuz.json"), "utf8")));
  });
});
