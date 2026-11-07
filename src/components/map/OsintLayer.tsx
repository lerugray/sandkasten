"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { MAP_FONT } from "@/lib/map/styles";
import { sideForAffiliation, siteLabel, sitePointsGeoJSON, siteRingsGeoJSON, SIDE_FALLBACK_COLOR } from "@/lib/osint/sites";
import type { OsintLayer as OsintLayerId, OsintSite } from "@/lib/osint/sites";
import { ICON_SCALE, LABEL_EM, LABEL_H, siteSlots, slotPx } from "@/lib/osint/labelLayout";
import { raiseFacilityPoints, type MapLayout } from "@/lib/map/mapLayout";

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

/** id-keyed `match` so each site's twin follows the offset the layout solved for it. */
function perSite(sites: OsintSite[], value: (id: string) => [number, number], fallback: [number, number]) {
  if (!sites.length) return ["literal", fallback] as unknown as maplibregl.ExpressionSpecification;
  return ["match", ["get", "id"], ...sites.flatMap((s) => [s.id, ["literal", value(s.id)]]), ["literal", fallback]] as unknown as maplibregl.ExpressionSpecification;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function iconOffsets(sites: OsintSite[], layout: MapLayout | null) {
  const slots = siteSlots(sites);
  return perSite(
    sites,
    (id) => {
      const [x, y] = layout?.icons.get(id)?.off ?? slotPx(slots.get(id) ?? -1);
      return [round2(x / ICON_SCALE), round2(y / ICON_SCALE)];
    },
    [0, 0],
  );
}

function labelOffsets(sites: OsintSite[], layout: MapLayout | null) {
  return perSite(
    sites,
    (id) => {
      const l = layout?.labels.get(id);
      return l ? [round2((l.off[0] - 2) / LABEL_EM), round2(l.off[1] / LABEL_EM)] : [1.2, -0.6];
    },
    [1.2, -0.6],
  );
}

function build(map: maplibregl.Map, sites: OsintSite[], selectedId: string | null, unitPositions: [number, number][], layout: MapLayout | null) {
  ensureImages(map);
  map.addSource(SRC_RINGS, { type: "geojson", data: siteRingsGeoJSON(sites, selectedId) });
  map.addSource(SRC_SITES, { type: "geojson", data: sitePointsGeoJSON(sites) });

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
  map.addLayer({
    id: OSINT_HIT_LAYER,
    type: "symbol",
    source: SRC_SITES,
    layout: {
      "icon-image": ["concat", "osint-", ["get", "layer"], "-", ["get", "side"]],
      "icon-size": ICON_SCALE,
      "icon-allow-overlap": true,
      "icon-offset": iconOffsets(sites, layout),
    },
    paint: { "icon-opacity": 0 },
  });
  // The visible labels are DOM elements placed by the layout controller; this invisible twin sits at the same spot so the
  // base map's own text and the facility labels keep clear of them.
  map.addLayer({
    id: OSINT_LABEL_LAYER,
    type: "symbol",
    source: SRC_SITES,
    minzoom: 5.5,
    layout: {
      "text-field": ["get", "label"],
      "text-font": [MAP_FONT],
      "text-size": LABEL_EM,
      "text-anchor": "top-left",
      "text-offset": labelOffsets(sites, layout) as never,
      "text-justify": "left",
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
  // Facility symbols are the fixed points the layout works around: they claim their space before anything else.
  raiseFacilityPoints(map);
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
  /** where each unit symbol is drawn [lng, lat] (after displacement): map text keeps clear of them */
  unitPositions?: [number, number][];
  /** solved placement of the symbols and labels */
  layout?: MapLayout | null;
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

export function OsintLayer({ map, sites, selectedId, onSelect, unitPositions = [], layout = null }: OsintLayerProps) {
  const sitesRef = useRef(sites);
  sitesRef.current = sites;
  const selRef = useRef(selectedId);
  selRef.current = selectedId;
  const unitRef = useRef(unitPositions);
  unitRef.current = unitPositions;
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const labelsRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => {
    const ensure = () => {
      if (map.getSource(SRC_SITES)) return;
      build(map, sitesRef.current, selRef.current, unitRef.current, layoutRef.current);
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
    (map.getSource(SRC_SITES) as maplibregl.GeoJSONSource | undefined)?.setData(sitePointsGeoJSON(sites));
  }, [map, sites, selectedId]);

  const unitKey = unitPositions.map((p) => p.join(",")).join(";");
  useEffect(() => {
    (map.getSource(SRC_OBST) as maplibregl.GeoJSONSource | undefined)?.setData(obstacleData(unitRef.current));
  }, [map, unitKey]);

  // The invisible twins follow the solved layout so the base map's text keeps off the real (DOM) symbols and labels.
  const twinKey = useRef("");
  useEffect(() => {
    if (!map.getLayer(OSINT_HIT_LAYER)) return;
    const icon = iconOffsets(sites, layout);
    const text = labelOffsets(sites, layout);
    const k = JSON.stringify([icon, text]);
    if (k === twinKey.current) return;
    twinKey.current = k;
    map.setLayoutProperty(OSINT_HIT_LAYER, "icon-offset", icon);
    map.setLayoutProperty(OSINT_LABEL_LAYER, "text-offset", text as never);
  }, [map, sites, layout]);

  // Labels are DOM elements (above the unit markers) placed by the layout controller beside their own symbol, with a
  // leader line (drawn by the controller) when they had to leave it. They ride on map Markers, so panning needs no relayout.
  useEffect(() => {
    const labels = labelsRef.current;
    const ids = new Set(sites.map((s) => s.id));
    labels.forEach((m, id) => {
      if (!ids.has(id)) {
        m.remove();
        labels.delete(id);
      }
    });
    if (!layout) return;
    const visible = map.getZoom() >= 5.5;
    for (const s of sites) {
      const pl = layout.labels.get(s.id);
      if (!pl) continue;
      let m = labels.get(s.id);
      if (!m) {
        const el = document.createElement("div");
        el.className = "osint-label";
        el.dataset.osintLabelId = s.id;
        el.setAttribute("data-testid", "osint-label");
        el.textContent = siteLabel(s);
        // opaque dark plate: the red / blue site colours keep >= 4.5:1 over any basemap, satellite included
        el.style.cssText = `font:${LABEL_EM}px "IBM Plex Mono",monospace;line-height:${LABEL_H}px;height:${LABEL_H}px;box-sizing:border-box;padding:0 2px;border-radius:3px;background:#0b1120;white-space:nowrap;pointer-events:none;z-index:5;color:${SIDE_FALLBACK_COLOR[sideKey(s)] ?? SIDE_FALLBACK_COLOR.Neutral}`;
        m = new maplibregl.Marker({ element: el, anchor: "top-left" }).setLngLat([s.position.lng, s.position.lat]).addTo(map);
        labels.set(s.id, m);
      }
      m.setLngLat([s.position.lng, s.position.lat]);
      m.setOffset([pl.off[0] - 2, pl.off[1]]);
      m.getElement().style.display = visible ? "block" : "none";
    }
    const onZoom = () => {
      const v = map.getZoom() >= 5.5 ? "block" : "none";
      labels.forEach((m) => (m.getElement().style.display = v));
    };
    map.on("zoom", onZoom);
    return () => {
      map.off("zoom", onZoom);
    };
  }, [map, sites, layout]);

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
      m.setOffset(layout?.icons.get(site.id)?.off ?? slotPx(slots.get(site.id) ?? -1));
      m.getElement().style.boxShadow = site.id === selectedId ? "0 0 0 3px #ffffff" : "none";
    }
  }, [map, sites, selectedId, layout]);

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
