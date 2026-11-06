"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { MAP_FONT } from "@/lib/map/styles";
import { coLocationIndex, sitePointsGeoJSON, siteRingsGeoJSON, SIDE_FALLBACK_COLOR } from "@/lib/osint/sites";
import type { OsintLayer as OsintLayerId, OsintSite } from "@/lib/osint/sites";

const SRC_RINGS = "osint-rings-src";
const SRC_SITES = "osint-sites-src";
export const OSINT_HIT_LAYER = "osint-sites";
const ALL_LAYERS = ["osint-rings-fill", "osint-rings-line", "osint-rings-line-est", "osint-sites-dot", OSINT_HIT_LAYER, "osint-sites-label"];

// Offsets in icon-size units (px at size 1) so symbols sharing a base fan out and stay clear of the facility symbol they sit on.
const SLOT_OFFSETS: [number, number][] = [
  [0, -22],
  [24, -2],
  [-24, -2],
  [0, 22],
];

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
  for (const layer of Object.keys(GLYPHS) as OsintLayerId[]) {
    for (const side of SIDES) {
      const id = `osint-${layer}-${side}`;
      if (!map.hasImage(id)) map.addImage(id, drawIcon(layer, SIDE_FALLBACK_COLOR[side]), { pixelRatio: 2 });
    }
  }
}

function pointsData(sites: OsintSite[]) {
  const loc = coLocationIndex(sites, 1500);
  const fc = sitePointsGeoJSON(sites);
  // A site on a real facility, or sharing a spot with another site, is drawn beside its true position (marked by a dot).
  for (const f of fc.features) {
    const site = sites.find((s) => s.id === f.properties!.id)!;
    const l = loc.get(site.id)!;
    const slot = site.facilityId || l.count > 1 || site.positionBasis === "facility-anchor" ? l.index % SLOT_OFFSETS.length : -1;
    f.properties!.slot = slot;
  }
  return fc;
}

function build(map: maplibregl.Map, sites: OsintSite[], selectedId: string | null) {
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
  map.addLayer({
    id: OSINT_HIT_LAYER,
    type: "symbol",
    source: SRC_SITES,
    layout: {
      "icon-image": ["concat", "osint-", ["get", "layer"], "-", ["get", "side"]],
      "icon-size": ["interpolate", ["linear"], ["zoom"], 4, 0.7, 8, 0.85, 12, 1],
      "icon-allow-overlap": true,
      "icon-offset": [
        "match",
        ["get", "slot"],
        0,
        ["literal", SLOT_OFFSETS[0]],
        1,
        ["literal", SLOT_OFFSETS[1]],
        2,
        ["literal", SLOT_OFFSETS[2]],
        3,
        ["literal", SLOT_OFFSETS[3]],
        ["literal", [0, 0]],
      ],
    },
  });
  map.addLayer({
    id: "osint-sites-label",
    type: "symbol",
    source: SRC_SITES,
    minzoom: 5.5,
    layout: {
      "text-field": ["get", "label"],
      "text-font": [MAP_FONT],
      "text-size": 12.5,
      "text-variable-anchor": ["right", "left", "bottom", "top"],
      "text-radial-offset": 2.1,
      "text-justify": "auto",
      "text-max-width": 9,
      "text-padding": 4,
      "text-optional": true,
    },
    paint: { "text-color": SIDE_COLOR_EXPR, "text-halo-color": "rgba(11, 17, 32, 0.95)", "text-halo-width": 2 },
  });
}

function teardown(map: maplibregl.Map) {
  for (const id of [...ALL_LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of [SRC_RINGS, SRC_SITES]) if (map.getSource(id)) map.removeSource(id);
}

interface OsintLayerProps {
  map: maplibregl.Map;
  /** Sites to draw (already filtered by the per-layer toggles). */
  sites: OsintSite[];
  selectedId: string | null;
}

export function OsintLayer({ map, sites, selectedId }: OsintLayerProps) {
  const sitesRef = useRef(sites);
  sitesRef.current = sites;
  const selRef = useRef(selectedId);
  selRef.current = selectedId;

  useEffect(() => {
    const ensure = () => {
      if (map.getSource(SRC_SITES)) return;
      build(map, sitesRef.current, selRef.current);
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
    (map.getSource(SRC_SITES) as maplibregl.GeoJSONSource | undefined)?.setData(pointsData(sites));
  }, [map, sites, selectedId]);

  useEffect(() => {
    const over = () => (map.getCanvas().style.cursor = "pointer");
    const out = () => (map.getCanvas().style.cursor = "");
    map.on("mouseenter", OSINT_HIT_LAYER, over);
    map.on("mouseleave", OSINT_HIT_LAYER, out);
    return () => {
      map.off("mouseenter", OSINT_HIT_LAYER, over);
      map.off("mouseleave", OSINT_HIT_LAYER, out);
    };
  }, [map]);

  return null;
}
