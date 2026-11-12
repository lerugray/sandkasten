import { describe, it, expect } from "vitest";
import type maplibregl from "maplibre-gl";
import { computeMapLayout, facilityIconRectsFromData, facilityIconSize, FACILITY_ICONS_ALL_DRAWN_ZOOM, FACILITY_POINT_TIERS } from "../src/lib/map/mapLayout";
import { touches, type Rect } from "../src/lib/map/declutter";
import { hormuzFacilities, facilityTier } from "../src/lib/facilities/facilities";
import { osintSites } from "../src/lib/osint/sites";
import { LABEL_H } from "../src/lib/osint/labelLayout";

// SAND-THREAT-1 FIX3. From z9 the /map layout takes the facility symbols from the data, so a layout solved right after
// a zoom is correct before the renderer has placed anything. The failing case on record: after the zoom to Qeshm the
// "Khalij Fars" label lay on the Qeshm airport symbol (apt-ir-0057) until the map went idle.

const QESHM = { center: [56.0, 26.85] as [number, number], zoom: 9 };

/** Web-mercator projection of a view, as MapLibre does it (512 px world tiles), on a container of w x h px. */
function fakeMap(view: { center: [number, number]; zoom: number }, w: number, h: number, rendered: { id: string; lngLat: [number, number] }[] = []) {
  const world = 512 * 2 ** view.zoom;
  const mx = (lng: number) => ((lng + 180) / 360) * world;
  const my = (lat: number) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * world;
  const cx = mx(view.center[0]), cy = my(view.center[1]);
  const project = (ll: [number, number]) => ({ x: mx(ll[0]) - cx + w / 2, y: my(ll[1]) - cy + h / 2 });
  const unproject = (p: [number, number]) => {
    const x = p[0] - w / 2 + cx, y = p[1] - h / 2 + cy;
    return { lng: (x / world) * 360 - 180, lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / world))) * 180) / Math.PI };
  };
  const map = {
    getZoom: () => view.zoom,
    getContainer: () => ({ clientWidth: w, clientHeight: h, getBoundingClientRect: () => ({ left: 0, top: 0 }), querySelectorAll: () => [] }),
    getLayer: () => ({}),
    getLayoutProperty: () => "visible",
    // what the renderer has placed so far
    queryRenderedFeatures: () => rendered.map((r) => ({ properties: { id: r.id }, geometry: { type: "Point", coordinates: r.lngLat } })),
    project,
    unproject,
  };
  return { map: map as unknown as maplibregl.Map, project };
}

const textWidth = (s: string) => s.length * 7.5; // IBM Plex Mono at 12.5 px

function khalijFarsVsAirport(w: number, h: number, facilities: typeof hormuzFacilities | undefined) {
  const { map, project } = fakeMap(QESHM, w, h);
  const layout = computeMapLayout(map, { units: [], sites: osintSites, textWidth, facilities });
  const site = osintSites.find((s) => s.id === "radar-ir-khalij-fars")!;
  const p = project([site.position.lng, site.position.lat]);
  const l = layout.labels.get(site.id)!;
  const label: Rect = { x: p.x + l.off[0] - 2, y: p.y + l.off[1], w: l.w, h: LABEL_H };
  const apt = hormuzFacilities.find((f) => f.id === "apt-ir-0057")!;
  const a = project([apt.position.lng, apt.position.lat]);
  const d = 28 * facilityIconSize(QESHM.zoom);
  const icon: Rect = { x: a.x - d / 2, y: a.y - d / 2, w: d, h: d };
  return touches(label, icon, 0);
}

describe("/map layout: facility symbols from z9 come from the data", () => {
  it("lists exactly the facilities whose tier is drawn at the zoom and that are on screen", () => {
    const { project } = fakeMap(QESHM, 1440, 720);
    const rects = facilityIconRectsFromData(hormuzFacilities, QESHM.zoom, project, { w: 1440, h: 720 });
    const d = 28 * facilityIconSize(QESHM.zoom);
    const expected = hormuzFacilities.filter((f) => {
      if (f.kind === "military_area") return false;
      if (QESHM.zoom < FACILITY_POINT_TIERS[facilityTier(f)].minzoom) return false;
      const p = project([f.position.lng, f.position.lat]);
      return p.x >= -d && p.y >= -d && p.x <= 1440 + d && p.y <= 720 + d;
    });
    expect(rects).toHaveLength(expected.length);
    expect(rects.length).toBeGreaterThan(5);
    for (const r of rects) expect(r.w).toBeCloseTo(d);
    // heliports (tier 3) only join from z9.5
    const tier3 = (z: number) => facilityIconRectsFromData(hormuzFacilities.filter((f) => facilityTier(f) === 3), z, project, { w: 1e6, h: 1e6 }).length;
    expect(tier3(9.4)).toBe(0);
    expect(tier3(9.5)).toBeGreaterThan(0);
  });

  it("z9 is where every facility symbol is drawn", () => {
    expect(FACILITY_ICONS_ALL_DRAWN_ZOOM).toBe(9);
  });

  for (const [w, h] of [[1440, 720], [1920, 900]]) {
    it(`Qeshm at ${w} px: the Khalij Fars label is clear of the airport symbol before the renderer has placed anything`, () => {
      expect(khalijFarsVsAirport(w, h, hormuzFacilities)).toBe(false);
    });
    it(`Qeshm at ${w} px: without the facility list the same layout puts the label on the airport symbol (the defect)`, () => {
      expect(khalijFarsVsAirport(w, h, undefined)).toBe(true);
    });
  }

  it("drops a label that would still overlap a facility disc after the ring search", () => {
    // Force a solid neighbourhood: many facility discs around one site so every candidate and ring spot hits.
    const { map, project } = fakeMap(QESHM, 1920, 900);
    const site = osintSites.find((s) => s.id === "radar-ir-khalij-fars")!;
    const p = project([site.position.lng, site.position.lat]);
    const base = hormuzFacilities.find((f) => f.kind === "airbase")!;
    const wall = Array.from({ length: 48 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2;
      const ll = map.unproject([p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18]);
      return { ...base, id: `wall-${i}`, position: { lng: ll.lng, lat: ll.lat } };
    });
    const layout = computeMapLayout(map, {
      units: [],
      sites: [site],
      textWidth,
      facilities: [...hormuzFacilities, ...wall],
    });
    // Either the label is clear of every facility disc, or it was omitted — never a residue overlap.
    const l = layout.labels.get(site.id);
    if (!l) return;
    const label: Rect = { x: p.x + l.off[0] - 2, y: p.y + l.off[1], w: l.w, h: LABEL_H };
    const d = 28 * facilityIconSize(QESHM.zoom);
    for (const f of [...hormuzFacilities, ...wall]) {
      if (f.kind === "military_area") continue;
      const a = project([f.position.lng, f.position.lat]);
      const icon: Rect = { x: a.x - d / 2, y: a.y - d / 2, w: d, h: d };
      expect(touches(label, icon, 0), f.id).toBe(false);
    }
  });

  it("below z9 the layout still follows the symbols the renderer placed", () => {
    const view = { center: QESHM.center, zoom: 8.5 };
    const site = osintSites.find((s) => s.id === "radar-ir-khalij-fars")!;
    const off = (rendered: { id: string; lngLat: [number, number] }[]) => {
      const { map } = fakeMap(view, 1440, 720, rendered);
      return computeMapLayout(map, { units: [], sites: osintSites, textWidth, facilities: hormuzFacilities }).labels.get(site.id)!.off;
    };
    // a symbol the renderer drew right where the label wants to go moves the label; data alone does not
    const p = fakeMap(view, 1440, 720).project([site.position.lng, site.position.lat]);
    const beside = fakeMap(view, 1440, 720).map.unproject([p.x + 60, p.y]);
    expect(off([{ id: "x", lngLat: [beside.lng, beside.lat] }])).not.toEqual(off([]));
  });
});
