"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { MAP_FONT } from "@/lib/map/styles";
import { coLocationIndex, sideForAffiliation, siteLabel, sitePointsGeoJSON, siteRingsGeoJSON, SIDE_FALLBACK_COLOR } from "@/lib/osint/sites";
import type { OsintLayer as OsintLayerId, OsintSite } from "@/lib/osint/sites";
import { ICON_SCALE, LABEL_EM, LABEL_SLOTS, SLOT_OFFSETS, labelCandidates, layoutLabels, siteSlots, slotPx, type LabelPlacement } from "@/lib/osint/labelLayout";

const SRC_RINGS = "osint-rings-src";
const SRC_OBST = "osint-unit-obstacles-src";
const OBST_LAYER = "osint-unit-obstacles";
const SRC_SITES = "osint-sites-src";
export const OSINT_HIT_LAYER = "osint-sites";
const OSINT_LABEL_LAYER = "osint-sites-label";

const SIDES = Object.keys(SIDE_FALLBACK_COLOR);
const SIDE_COLOR_EXPR = [
  "match",
  ["get", "side"],
  ...SIDES.flatMap((s) => [s, SIDE_FALLBACK_COLOR[s]]),
  "#9aa5b1",
] as unknown as maplibregl.ExpressionSpecification;

type Glyph = (ctx: CanvasRenderingContext2D, c: number) => void;

const GLYPHS: Record<OsintLayerId, Glyph> = {
  // missile launcher: rail on a base with a missile
  ad: (ctx, c) => {
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(c - 7, c + 7);
    ctx.lineTo(c + 7, c + 7);
    ctx.moveTo(c - 5, c + 4);
    ctx.lineTo(c + 5, c - 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c + 7.5, c - 8.5);
    ctx.lineTo(c + 1.5, c - 6.8);
    ctx.lineTo(c + 6.3, c - 2.5);
    ctx.closePath();
    ctx.fill();
  },
  // dish and arcs
  radar: (ctx, c) => {
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(c - 2, c + 2, 8, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c - 2, c + 2);
    ctx.lineTo(c - 2, c + 8);
    ctx.stroke();
    ctx.lineWidth = 1.8;
    for (const r of [5, 9]) {
      ctx.beginPath();
      ctx.arc(c - 4, c + 4, r + 5, -Math.PI * 0.42, -Math.PI * 0.08);
      ctx.stroke();
    }
  },
  // radiation trefoil
  nuclear: (ctx, c) => {
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, 9, a - Math.PI / 6, a + Math.PI / 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(c, c, 2, 0, Math.PI * 2);
    ctx.fill();
  },
};

const IMAGE_SIZE = 32;

function drawIcon(layer: OsintLayerId, color: string): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_SIZE * 2;
  canvas.height = IMAGE_SIZE * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  const c = IMAGE_SIZE / 2;
  ctx.fillStyle = "rgba(11, 17, 32, 0.92)";
  ctx.beginPath();
  ctx.arc(c, c, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  GLYPHS[layer](ctx, c);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function ensureImages(map: maplibregl.Map) {
  if (!map.hasImage("osint-blank")) map.addImage("osint-blank", { width: 54, height: 54, data: new Uint8Array(54 * 54 * 4) });
  for (const layer of Object.keys(GLYPHS) as OsintLayerId[]) {
    for (const side of SIDES) {
      const id = `osint-${layer}-${side}`;
      if (!map.hasImage(id)) map.addImage(id, drawIcon(layer, SIDE_FALLBACK_COLOR[side]), { pixelRatio: 2 });
    }
  }
}

const ALL_LAYERS = ["osint-rings-fill", "osint-rings-line", "osint-rings-line-est", "osint-sites-dot", OSINT_HIT_LAYER, OSINT_LABEL_LAYER, OBST_LAYER];

function pointsData(sites: OsintSite[], placed: Map<string, LabelPlacement> = new Map()) {
  const fc = sitePointsGeoJSON(sites);
  const slots = siteSlots(sites);
  for (const f of fc.features) {
    const id = f.properties!.id as string;
    const slot = slots.get(id) ?? -1;
    f.properties!.slot = slot;
    f.properties!.lab = slot * 10 + (placed.get(id)?.cand ?? 0);
  }
  return fc;
}

function build(map: maplibregl.Map, sites: OsintSite[], selectedId: string | null, unitPositions: [number, number][]) {
  ensureImages(map);
  map.addSource(SRC_RINGS, { type: "geojson", data: siteRingsGeoJSON(sites, selectedId) });
  map.addSource(SRC_SITES, { type: "geojson", data: pointsData(sites) });

  map.addLayer({
    id: "osint-rings-fill",
    type: "fill",
    source: SRC_RINGS,
    paint: { "fill-color": SIDE_COLOR_EXPR, "fill-opacity": ["case", ["get", "selected"], 0.13, 0.05] },
  });
  // measured ranges solid, ESTIMATED ranges dashed
  map.addLayer({
    id: "osint-rings-line",
    type: "line",
    source: SRC_RINGS,
    filter: ["!", ["get", "estimated"]],
    paint: { "line-color": SIDE_COLOR_EXPR, "line-width": ["case", ["get", "selected"], 3, 1.6], "line-opacity": 0.9 },
  });
  map.addLayer({
    id: "osint-rings-line-est",
    type: "line",
    source: SRC_RINGS,
    filter: ["get", "estimated"],
    paint: {
      "line-color": SIDE_COLOR_EXPR,
      "line-width": ["case", ["get", "selected"], 3, 1.6],
      "line-opacity": 0.9,
      "line-dasharray": [4, 3],
    },
  });
  map.addLayer({
    id: "osint-sites-dot",
    type: "circle",
    source: SRC_SITES,
    paint: { "circle-radius": 3.5, "circle-color": SIDE_COLOR_EXPR, "circle-stroke-color": "#0B1120", "circle-stroke-width": 1.5 },
  });
  // The visible symbols are DOM markers (they must draw above the unit markers). This layer is their invisible twin:
  // labels and other map text keep clear of it.
  const iconOffset = ["match", ["get", "slot"], ...SLOT_OFFSETS.flatMap((o, i) => [i, ["literal", o]]), ["literal", [0, 0]]] as unknown as maplibregl.ExpressionSpecification;
  map.addLayer({
    id: OSINT_HIT_LAYER,
    type: "symbol",
    source: SRC_SITES,
    layout: {
      "icon-image": ["concat", "osint-", ["get", "layer"], "-", ["get", "side"]],
      "icon-size": ICON_SCALE,
      "icon-allow-overlap": true,
      "icon-offset": iconOffset,
    },
    paint: { "icon-opacity": 0 },
  });
  // The visible labels are DOM elements placed by layoutLabels; this invisible twin sits at the same spot so the base
  // map's own text and the facility labels keep clear of them.
  const anchors: unknown[] = [];
  const offsets: unknown[] = [];
  for (const slot of LABEL_SLOTS) {
    labelCandidates(slot).forEach(([a, [x, y]], k) => {
      anchors.push(slot * 10 + k, a);
      offsets.push(slot * 10 + k, ["literal", [x / LABEL_EM, y / LABEL_EM]]);
    });
  }
  map.addLayer({
    id: OSINT_LABEL_LAYER,
    type: "symbol",
    source: SRC_SITES,
    minzoom: 5.5,
    layout: {
      "text-field": ["get", "label"],
      "text-font": [MAP_FONT],
      "text-size": LABEL_EM,
      "text-anchor": ["match", ["get", "lab"], ...anchors, "left"] as never,
      "text-offset": ["match", ["get", "lab"], ...offsets, ["literal", [1.2, 0]]] as never,
      "text-justify": "auto",
      "text-max-width": 30,
      "text-padding": 2,
      "text-allow-overlap": true,
    },
    paint: { "text-opacity": 0, "text-color": "#000000" },
  });
  // Units are DOM markers MapLibre cannot see; an invisible symbol per unit keeps OSINT labels (and the base map's
  // place names, which are placed after it) off them. Added last: the top-most layer is placed first.
  map.addSource(SRC_OBST, { type: "geojson", data: obstacleData(unitPositions) });
  map.addLayer({
    id: OBST_LAYER,
    type: "symbol",
    source: SRC_OBST,
    layout: { "icon-image": "osint-blank", "icon-allow-overlap": true, "icon-padding": 2 },
    paint: { "icon-opacity": 0 },
  });
}

function obstacleData(pos: [number, number][]) {
  return {
    type: "FeatureCollection" as const,
    features: pos.map((c) => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: c }, properties: {} })),
  };
}

function teardown(map: maplibregl.Map) {
  for (const id of [...ALL_LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of [SRC_RINGS, SRC_SITES, SRC_OBST]) if (map.getSource(id)) map.removeSource(id);
}

interface OsintLayerProps {
  map: maplibregl.Map;
  /** Sites to draw (already filtered by the per-layer toggles). */
  sites: OsintSite[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** unit positions [lng, lat]: site labels keep clear of them */
  unitPositions?: [number, number][];
}

const iconUrls = new Map<string, string>();
function iconUrl(layer: OsintLayerId, side: string): string {
  const key = `${layer}-${side}`;
  let url = iconUrls.get(key);
  if (!url) {
    const data = drawIcon(layer, SIDE_FALLBACK_COLOR[side] ?? SIDE_FALLBACK_COLOR.Neutral);
    const c = document.createElement("canvas");
    c.width = data.width;
    c.height = data.height;
    c.getContext("2d")!.putImageData(data, 0, 0);
    url = c.toDataURL();
    iconUrls.set(key, url);
  }
  return url;
}

export function OsintLayer({ map, sites, selectedId, onSelect, unitPositions = [] }: OsintLayerProps) {
  const sitesRef = useRef(sites);
  sitesRef.current = sites;
  const selRef = useRef(selectedId);
  selRef.current = selectedId;
  const unitRef = useRef(unitPositions);
  unitRef.current = unitPositions;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const labelsRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const placedRef = useRef<Map<string, LabelPlacement>>(new Map());
  const placedKeyRef = useRef("");

  useEffect(() => {
    const ensure = () => {
      if (map.getSource(SRC_SITES)) return;
      build(map, sitesRef.current, selRef.current, unitRef.current);
    };
    // isStyleLoaded() is false while tiles stream in and style.load may already have fired, so also build on the next idle.
    if (map.isStyleLoaded()) ensure();
    else map.once("idle", ensure);
    map.on("style.load", ensure);
    return () => {
      map.off("style.load", ensure);
      map.off("idle", ensure);
      teardown(map);
    };
  }, [map]);

  useEffect(() => {
    (map.getSource(SRC_RINGS) as maplibregl.GeoJSONSource | undefined)?.setData(siteRingsGeoJSON(sites, selectedId));
    (map.getSource(SRC_SITES) as maplibregl.GeoJSONSource | undefined)?.setData(pointsData(sites, placedRef.current));
  }, [map, sites, selectedId]);

  const unitKey = unitPositions.map((p) => p.join(",")).join(";");
  useEffect(() => {
    (map.getSource(SRC_OBST) as maplibregl.GeoJSONSource | undefined)?.setData(obstacleData(unitRef.current));
  }, [map, unitKey]);

  // Labels are DOM elements (above the unit markers) placed beside their own symbol by layoutLabels, on zoom and
  // whenever the sites or unit positions change. They ride on map Markers, so panning needs no relayout.
  const unitKey2 = unitPositions.map((p) => p.join(",")).join(";");
  useEffect(() => {
    const labels = labelsRef.current;
    const measure = document.createElement("canvas").getContext("2d")!;
    measure.font = `${LABEL_EM}px "IBM Plex Mono", monospace`;
    const relayout = () => {
      const cur = sitesRef.current;
      const slots = siteSlots(cur);
      const ordered = [...cur].sort((a, b) => Number(b.layer === "ad") - Number(a.layer === "ad"));
      const items = ordered.map((s) => {
        const p = map.project([s.position.lng, s.position.lat]);
        return { id: s.id, label: siteLabel(s), slot: slots.get(s.id) ?? -1, x: p.x, y: p.y };
      });
      const units = unitRef.current.map((c) => {
        const p = map.project(c);
        return [p.x, p.y] as [number, number];
      });
      const placed = new Map(layoutLabels(items, units, (t) => measure.measureText(t).width).map((l) => [l.id, l]));
      placedRef.current = placed;
      const visible = map.getZoom() >= 5.5;
      const ids = new Set(cur.map((s) => s.id));
      labels.forEach((m, id) => {
        if (!ids.has(id)) {
          m.remove();
          labels.delete(id);
        }
      });
      for (const s of cur) {
        const pl = placed.get(s.id)!;
        const it = items.find((i) => i.id === s.id)!;
        let m = labels.get(s.id);
        if (!m) {
          const el = document.createElement("div");
          el.className = "osint-label";
          el.dataset.osintLabelId = s.id;
          el.setAttribute("data-testid", "osint-label");
          el.textContent = siteLabel(s);
          el.style.cssText = `font:${LABEL_EM}px "IBM Plex Mono",monospace;line-height:16px;height:16px;white-space:nowrap;pointer-events:none;z-index:5;color:${SIDE_FALLBACK_COLOR[sideKey(s)] ?? SIDE_FALLBACK_COLOR.Neutral};text-shadow:0 0 2px #0b1120,0 0 2px #0b1120,0 0 3px #0b1120,0 0 3px #0b1120`;
          m = new maplibregl.Marker({ element: el, anchor: "top-left" }).setLngLat([s.position.lng, s.position.lat]).addTo(map);
          labels.set(s.id, m);
        }
        m.setLngLat([s.position.lng, s.position.lat]);
        m.setOffset([pl.rect.x + 2 - it.x, pl.rect.y - it.y]);
        m.getElement().style.display = visible ? "block" : "none";
      }
      const key = ordered.map((s) => `${s.id}:${placed.get(s.id)!.cand}`).join(",");
      if (key !== placedKeyRef.current) {
        placedKeyRef.current = key;
        (map.getSource(SRC_SITES) as maplibregl.GeoJSONSource | undefined)?.setData(pointsData(cur, placed));
      }
    };
    relayout();
    map.on("zoomend", relayout);
    map.once("idle", relayout);
    return () => {
      map.off("zoomend", relayout);
      map.off("idle", relayout);
    };
  }, [map, sites, unitKey2]);

  useEffect(() => {
    const labels = labelsRef.current;
    return () => {
      labels.forEach((m) => m.remove());
      labels.clear();
    };
  }, [map]);

  // Symbols are DOM markers so they draw above the unit markers; each one carries its site id.
  useEffect(() => {
    const markers = markersRef.current;
    const slots = siteSlots(sites);
    const ids = new Set(sites.map((s) => s.id));
    markers.forEach((m, id) => {
      if (!ids.has(id)) {
        m.remove();
        markers.delete(id);
      }
    });
    for (const site of sites) {
      const side = sideKey(site);
      let m = markers.get(site.id);
      if (!m) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "osint-marker";
        el.dataset.osintId = site.id;
        el.dataset.testid = "osint-marker";
        el.setAttribute("data-testid", "osint-marker");
        el.setAttribute("aria-label", `${site.system} (${site.name})`);
        el.title = `${site.system}, ${site.name}`;
        const img = document.createElement("img");
        img.src = iconUrl(site.layer, side);
        img.alt = "";
        img.draggable = false;
        img.style.cssText = `width:${IMAGE_SIZE * ICON_SCALE}px;height:${IMAGE_SIZE * ICON_SCALE}px;display:block;pointer-events:none`;
        el.appendChild(img);
        el.style.cssText = "padding:0;border:0;background:none;cursor:pointer;z-index:6;border-radius:50%;line-height:0";
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(site.id);
        });
        m = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([site.position.lng, site.position.lat]).addTo(map);
        markers.set(site.id, m);
      }
      m.setLngLat([site.position.lng, site.position.lat]);
      m.setOffset(slotPx(slots.get(site.id) ?? -1));
      m.getElement().style.boxShadow = site.id === selectedId ? "0 0 0 3px #ffffff" : "none";
    }
  }, [map, sites, selectedId]);

  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      markers.forEach((m) => m.remove());
      markers.clear();
    };
  }, [map]);

  return null;
}

function sideKey(site: OsintSite): string {
  return sideForAffiliation(site.affiliation);
}
