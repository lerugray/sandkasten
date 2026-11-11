import type maplibregl from "maplibre-gl";
import { placeAll, rectAt, type Placeable, type Rect } from "./declutter";
import { ICON_RADIUS, LABEL_H, layoutLabels, siteSlots, slotPx } from "@/lib/osint/labelLayout";
import { siteLabel } from "@/lib/osint/sites";
import type { OsintSite } from "@/lib/osint/sites";
import { facilityTier } from "@/lib/facilities/facilities";
import type { Facility } from "@/lib/facilities/facilities";

/**
 * One layout pass for every DOM layer on the /map view: OSINT icons first (around the facility symbols they sit on),
 * then unit symbols (clear of both), then site labels (clear of all of them, with a leader line when they have to move
 * away from their own icon). Offsets are relative to each thing's true map point, so panning needs no relayout.
 */

export interface LayoutUnit {
  id: string;
  lng: number;
  lat: number;
  /** symbol frame (no heading leader) */
  w: number;
  h: number;
}

export interface MapLayout {
  /** px the unit symbol sits from its true position */
  units: Map<string, [number, number]>;
  /** px the OSINT symbol's centre sits from its site point; `moved` when it left its slot (gets a tether line) */
  icons: Map<string, { off: [number, number]; moved: boolean }>;
  /** label box top-left (text starts 2 px right of the box) relative to the site point */
  labels: Map<string, { off: [number, number]; w: number; leader: boolean; iconOff: [number, number] }>;
  /** displaced unit positions, for the invisible obstacle layers that keep map text off units */
  unitObstacles: [number, number][];
  /** leader lines in container px: [from, to] (unit / icon displaced from its true point, label away from its icon) */
  tethers: [[number, number], [number, number]][];
  key: string;
}

/** The facility symbol tiers: tier t is drawn from `minzoom`, its map text from `labelMinzoom`. One table for the layers and the layout. */
export const FACILITY_POINT_TIERS = [
  { tier: 0, minzoom: 3, labelMinzoom: 7 },
  { tier: 1, minzoom: 5.5, labelMinzoom: 8 },
  { tier: 2, minzoom: 7.5, labelMinzoom: 9.5 },
  { tier: 3, minzoom: 9.5, labelMinzoom: 11 },
] as const;
/**
 * From this zoom every facility symbol of a visible tier is drawn (icon-allow-overlap on the symbol layers); below it the
 * renderer hides symbols that collide, so only the renderer knows which are on screen.
 */
export const FACILITY_ICONS_ALL_DRAWN_ZOOM = 9;

export const FACILITY_POINT_LAYER_IDS = FACILITY_POINT_TIERS.map((t) => `facility-points-t${t.tier}`);

/** Same ramp as the facility symbol layers' icon-size: 0.5 at z4, 0.75 at z8, 1 from z12. */
export function facilityIconSize(zoom: number): number {
  if (zoom <= 4) return 0.5;
  if (zoom <= 8) return 0.5 + ((zoom - 4) / 4) * 0.25;
  if (zoom <= 12) return 0.75 + ((zoom - 8) / 4) * 0.25;
  return 1;
}

/**
 * The discs of every facility symbol the map draws at `zoom`, straight from the facility data. Only valid from
 * FACILITY_ICONS_ALL_DRAWN_ZOOM, where no symbol is hidden by a collision: there the answer does not depend on what the
 * renderer has got round to placing, so a layout solved right after a zoom is already correct.
 */
export function facilityIconRectsFromData(
  facilities: Facility[],
  zoom: number,
  project: (lngLat: [number, number]) => { x: number; y: number },
  bounds: { w: number; h: number },
  tiers: ReadonlySet<number> = new Set(FACILITY_POINT_TIERS.map((t) => t.tier)),
): Rect[] {
  const d = 28 * facilityIconSize(zoom);
  const drawn = new Set<number>(FACILITY_POINT_TIERS.filter((t) => tiers.has(t.tier) && zoom >= t.minzoom).map((t) => t.tier));
  const seen = new Set<string>();
  const out: Rect[] = [];
  for (const f of facilities) {
    // same set as the symbol source (facilityPointsGeoJSON)
    if (f.kind === "military_area" || seen.has(f.id) || !drawn.has(facilityTier(f))) continue;
    seen.add(f.id);
    const p = project([f.position.lng, f.position.lat]);
    if (p.x < -d || p.y < -d || p.x > bounds.w + d || p.y > bounds.h + d) continue;
    out.push(rectAt(p.x, p.y, d));
  }
  return out;
}

/**
 * Facility symbols are drawn by the map canvas. From z9 every one of them is on screen, so their discs come from the
 * data (`facilities`); below z9 they are rebuilt from the symbols the renderer actually placed.
 */
export function facilityIconRects(map: maplibregl.Map, facilities?: Facility[]): Rect[] {
  const layers = FACILITY_POINT_LAYER_IDS.filter((l) => map.getLayer(l) && map.getLayoutProperty(l, "visibility") !== "none");
  if (!layers.length) return [];
  const zoom = map.getZoom();
  if (facilities && zoom >= FACILITY_ICONS_ALL_DRAWN_ZOOM) {
    const host = map.getContainer();
    const tiers = new Set(FACILITY_POINT_TIERS.filter((t) => layers.includes(`facility-points-t${t.tier}`)).map((t) => t.tier));
    return facilityIconRectsFromData(facilities, zoom, (ll) => map.project(ll), { w: host.clientWidth, h: host.clientHeight }, tiers);
  }
  const d = 28 * facilityIconSize(zoom);
  const seen = new Set<string>();
  const out: Rect[] = [];
  for (const f of map.queryRenderedFeatures(undefined, { layers })) {
    const id = String(f.properties?.id);
    if (seen.has(id) || f.geometry.type !== "Point") continue;
    seen.add(id);
    const p = map.project(f.geometry.coordinates as [number, number]);
    out.push(rectAt(p.x, p.y, d));
  }
  return out;
}

/**
 * Identity of the facility symbols the layout has to work around right now. From z9 that is fixed by the data; below it
 * it is whatever the renderer has placed, which changes while a new view streams in.
 */
export function drawnFacilityKey(map: maplibregl.Map, fromData: boolean): string {
  const layers = FACILITY_POINT_LAYER_IDS.filter((l) => map.getLayer(l) && map.getLayoutProperty(l, "visibility") !== "none");
  if (!layers.length) return "none";
  if (fromData && map.getZoom() >= FACILITY_ICONS_ALL_DRAWN_ZOOM) return "data";
  const ids = new Set<string>();
  for (const f of map.queryRenderedFeatures(undefined, { layers })) ids.add(String(f.properties?.id));
  return [...ids].sort().join(",");
}

function contactRects(map: maplibregl.Map): Rect[] {
  const host = map.getContainer().getBoundingClientRect();
  return [...map.getContainer().querySelectorAll<HTMLElement>(".contact-marker")].map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - host.left, y: r.top - host.top, w: r.width, h: r.height };
  });
}

const r1 = (n: number) => Math.round(n * 2) / 2;

export function computeMapLayout(
  map: maplibregl.Map,
  input: { units: LayoutUnit[]; sites: OsintSite[]; textWidth: (s: string) => number; /** the facilities the map draws (the FacilityLayer's list) */ facilities?: Facility[] },
): MapLayout {
  const host = map.getContainer();
  const bounds = { w: host.clientWidth, h: host.clientHeight };
  const fixed: Rect[] = [...facilityIconRects(map, input.facilities), ...contactRects(map)];

  // 1. OSINT icons
  const slots = siteSlots(input.sites);
  const sitePx = new Map(input.sites.map((s) => [s.id, map.project([s.position.lng, s.position.lat])]));
  const ordered = [...input.sites].sort((a, b) => Number(b.layer === "ad") - Number(a.layer === "ad") || a.id.localeCompare(b.id));
  const d = ICON_RADIUS * 2;
  const iconBlockers = [...fixed];
  const iconItems: Placeable[] = ordered.map((s) => {
    const p = sitePx.get(s.id)!;
    const [sx, sy] = slotPx(slots.get(s.id) ?? -1);
    return { id: s.id, x: p.x, y: p.y, px: p.x + sx, py: p.y + sy, w: d, h: d, prefAngle: sx === 0 && sy === 0 ? -Math.PI / 2 : Math.atan2(sy, sx) };
  });
  const iconPlaced = placeAll(iconItems, iconBlockers, { gap: 3, maxR: 90, bounds });
  const icons: MapLayout["icons"] = new Map();
  for (const it of iconItems) {
    const c = iconPlaced.get(it.id)!;
    icons.set(it.id, { off: [r1(c.x - it.x), r1(c.y - it.y)], moved: Math.hypot(c.x - it.px!, c.y - it.py!) > 2 });
  }

  // 2. unit symbols, clear of every icon
  const unitBlockers = [...iconBlockers];
  const unitItems: Placeable[] = [...input.units]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((u) => {
      const p = map.project([u.lng, u.lat]);
      return { id: u.id, x: p.x, y: p.y, w: u.w, h: u.h };
    });
  const onScreen = (x: number, y: number) => x > -80 && y > -80 && x < bounds.w + 80 && y < bounds.h + 80;
  const unitPlaced = placeAll(
    unitItems.filter((u) => onScreen(u.x, u.y)),
    unitBlockers,
    { gap: 3, maxR: 130, bounds },
  );
  const units: MapLayout["units"] = new Map();
  const unitRects: Rect[] = [];
  const unitObstacles: [number, number][] = [];
  for (const it of unitItems) {
    const c = unitPlaced.get(it.id);
    const off: [number, number] = c ? [r1(c.x - it.x), r1(c.y - it.y)] : [0, 0];
    units.set(it.id, off);
    unitRects.push(rectAt(it.x + off[0], it.y + off[1], it.w, it.h));
    const ll = map.unproject([it.x + off[0], it.y + off[1]]);
    unitObstacles.push([Math.round(ll.lng * 1e4) / 1e4, Math.round(ll.lat * 1e4) / 1e4]);
  }

  // 3. labels
  const labelItems = ordered.map((s) => {
    const p = sitePx.get(s.id)!;
    const ic = icons.get(s.id)!;
    return { id: s.id, label: siteLabel(s), slot: slots.get(s.id) ?? -1, x: p.x, y: p.y, iconX: p.x + ic.off[0], iconY: p.y + ic.off[1] };
  });
  const placed = layoutLabels(labelItems, [], input.textWidth, { unitRects, blockers: fixed });
  const labels: MapLayout["labels"] = new Map();
  for (const pl of placed) {
    const it = labelItems.find((i) => i.id === pl.id)!;
    labels.set(pl.id, { off: [r1(pl.rect.x + 2 - it.x), r1(pl.rect.y - it.y)], w: pl.rect.w, leader: pl.leader, iconOff: icons.get(pl.id)!.off });
  }

  const tethers: MapLayout["tethers"] = [];
  for (const it of unitItems) {
    const off = units.get(it.id)!;
    if (Math.hypot(off[0], off[1]) > 4) tethers.push([[it.x, it.y], [it.x + off[0], it.y + off[1]]]);
  }
  for (const s of ordered) {
    const p = sitePx.get(s.id)!;
    const ic = icons.get(s.id)!;
    const cx = p.x + ic.off[0];
    const cy = p.y + ic.off[1];
    const slot = slotPx(slots.get(s.id) ?? -1);
    if (Math.hypot(ic.off[0] - slot[0], ic.off[1] - slot[1]) > 2) tethers.push([[p.x, p.y], [cx, cy]]);
    const l = labels.get(s.id);
    if (l?.leader) {
      const rx = p.x + l.off[0] - 2;
      const ry = p.y + l.off[1];
      tethers.push([[Math.max(rx, Math.min(cx, rx + l.w)), Math.max(ry, Math.min(cy, ry + LABEL_H))], [cx, cy]]);
    }
  }

  const key = JSON.stringify([
    [...units].map(([k, v]) => [k, v]),
    [...icons].map(([k, v]) => [k, v.off]),
    [...labels].map(([k, v]) => [k, v.off, v.leader]),
    unitObstacles,
  ]);
  return { units, icons, labels, unitObstacles, tethers, key };
}

export { LABEL_H };

/** Facility symbols are the fixed points the layout works around: raise them so MapLibre places them before any other symbol. */
export function raiseFacilityPoints(map: maplibregl.Map) {
  for (const id of FACILITY_POINT_LAYER_IDS) if (map.getLayer(id)) map.moveLayer(id);
}
