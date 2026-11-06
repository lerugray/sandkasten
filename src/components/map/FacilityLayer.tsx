"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import {
  FACILITY_ATTRIBUTION,
  facilityAreasGeoJSON,
  facilityPointsGeoJSON,
  facilityRunwaysGeoJSON,
} from "@/lib/facilities/facilities";
import type { Facility } from "@/lib/facilities/facilities";

const POINT_TIERS = [
  { tier: 0, minzoom: 3, labelMinzoom: 6.5 },
  { tier: 1, minzoom: 5.5, labelMinzoom: 7 },
  { tier: 2, minzoom: 7.5, labelMinzoom: 8.5 },
  { tier: 3, minzoom: 9.5, labelMinzoom: 10.5 },
];
const pointLayerId = (tier: number) => `facility-points-t${tier}`;
const labelLayerId = (tier: number) => `facility-labels-t${tier}`;
export const FACILITY_POINT_LAYERS = POINT_TIERS.map((t) => pointLayerId(t.tier));
export const FACILITY_HIT_LAYERS = [...FACILITY_POINT_LAYERS, "facility-areas-fill"];

const SRC_POINTS = "facility-points-src";
const SRC_AREAS = "facility-areas-src";
const SRC_RUNWAYS = "facility-runways-src";
const ALL_LAYERS = [
  "facility-areas-fill",
  "facility-areas-line",
  "facility-selected",
  "facility-selected-ring",
  "facility-runways",
  ...FACILITY_POINT_LAYERS,
  ...POINT_TIERS.map((t) => labelLayerId(t.tier)),
];

const MIL = "#F59E0B";
const CIV = "#94A3B8";

type Glyph = (ctx: CanvasRenderingContext2D, c: number) => void;

const GLYPHS: Record<string, Glyph> = {
  // aircraft seen from above
  airbase: (ctx, c) => {
    ctx.beginPath();
    ctx.moveTo(c, c - 9);
    ctx.lineTo(c + 2, c - 2);
    ctx.lineTo(c + 9, c + 2);
    ctx.lineTo(c + 9, c + 4);
    ctx.lineTo(c + 2, c + 2);
    ctx.lineTo(c + 1.5, c + 7);
    ctx.lineTo(c + 4, c + 9);
    ctx.lineTo(c + 4, c + 10);
    ctx.lineTo(c, c + 9);
    ctx.lineTo(c - 4, c + 10);
    ctx.lineTo(c - 4, c + 9);
    ctx.lineTo(c - 1.5, c + 7);
    ctx.lineTo(c - 2, c + 2);
    ctx.lineTo(c - 9, c + 4);
    ctx.lineTo(c - 9, c + 2);
    ctx.lineTo(c - 2, c - 2);
    ctx.closePath();
    ctx.fill();
  },
  // H
  heliport: (ctx, c) => {
    ctx.fillRect(c - 6, c - 7, 3, 14);
    ctx.fillRect(c + 3, c - 7, 3, 14);
    ctx.fillRect(c - 6, c - 1.5, 12, 3);
  },
  // anchor
  naval_base: (ctx, c) => {
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(c, c - 7, 2.2, 0, Math.PI * 2);
    ctx.moveTo(c, c - 5);
    ctx.lineTo(c, c + 8);
    ctx.moveTo(c - 4.5, c - 1);
    ctx.lineTo(c + 4.5, c - 1);
    ctx.moveTo(c - 8, c + 3);
    ctx.quadraticCurveTo(c - 7, c + 9, c, c + 8);
    ctx.quadraticCurveTo(c + 7, c + 9, c + 8, c + 3);
    ctx.stroke();
  },
  // quay crane over a hull
  port: (ctx, c) => {
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(c - 6, c + 8);
    ctx.lineTo(c - 6, c - 7);
    ctx.lineTo(c + 7, c - 7);
    ctx.moveTo(c + 5, c - 7);
    ctx.lineTo(c + 5, c - 1);
    ctx.moveTo(c - 8, c + 4);
    ctx.lineTo(c + 8, c + 4);
    ctx.lineTo(c + 5, c + 8);
    ctx.lineTo(c - 5, c + 8);
    ctx.stroke();
  },
};

const IMAGE_SIZE = 32;

function drawIcon(kind: string, color: string): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_SIZE * 2;
  canvas.height = IMAGE_SIZE * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);
  const c = IMAGE_SIZE / 2;
  ctx.fillStyle = "rgba(11, 17, 32, 0.88)";
  ctx.beginPath();
  ctx.arc(c, c, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  GLYPHS[kind](ctx, c);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function ensureImages(map: maplibregl.Map) {
  for (const kind of Object.keys(GLYPHS)) {
    for (const [use, color] of [
      ["military", MIL],
      ["civil", CIV],
    ] as const) {
      const id = `fac-${kind}-${use}`;
      if (!map.hasImage(id)) map.addImage(id, drawIcon(kind, color), { pixelRatio: 2 });
    }
  }
}

// metres of runway width -> pixels at zoom z: w * 2^z / (78271.5 * cos(26.5deg)) (512 px world tiles)
const PX_PER_M_Z8 = 256 / 70000;
const PX_PER_M_Z16 = 65536 / 70000;

function build(map: maplibregl.Map, facilities: Facility[]) {
  ensureImages(map);

  map.addSource(SRC_AREAS, { type: "geojson", data: facilityAreasGeoJSON(facilities), attribution: FACILITY_ATTRIBUTION });
  map.addSource(SRC_RUNWAYS, { type: "geojson", data: facilityRunwaysGeoJSON(facilities) });
  map.addSource(SRC_POINTS, { type: "geojson", data: facilityPointsGeoJSON(facilities) });

  map.addLayer({
    id: "facility-areas-fill",
    type: "fill",
    source: SRC_AREAS,
    minzoom: 6,
    filter: ["<=", ["get", "tier"], 2],
    paint: {
      "fill-color": ["match", ["get", "kind"], "port", "#38BDF8", "naval_base", MIL, "airbase", MIL, "#94A3B8"],
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.05, 11, 0.12],
    },
  });
  map.addLayer({
    id: "facility-areas-line",
    type: "line",
    source: SRC_AREAS,
    minzoom: 6,
    filter: ["<=", ["get", "tier"], 2],
    paint: {
      "line-color": ["match", ["get", "kind"], "port", "#38BDF8", "naval_base", MIL, "airbase", MIL, "#94A3B8"],
      "line-width": 1,
      "line-opacity": 0.7,
      "line-dasharray": [3, 2],
    },
  });
  map.addLayer({
    id: "facility-selected",
    type: "line",
    source: SRC_AREAS,
    filter: ["==", ["get", "id"], ""],
    paint: { "line-color": "#FFFFFF", "line-width": 2.5 },
  });
  map.addLayer({
    id: "facility-selected-ring",
    type: "circle",
    source: SRC_POINTS,
    filter: ["==", ["get", "id"], ""],
    paint: {
      "circle-radius": 22,
      "circle-color": "rgba(255,255,255,0.06)",
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-width": 2,
    },
  });
  map.addLayer({
    id: "facility-runways",
    type: "line",
    source: SRC_RUNWAYS,
    minzoom: 8,
    layout: { "line-cap": "butt" },
    paint: {
      "line-color": ["case", ["get", "closed"], "#64748B", "#E2E8F0"],
      "line-width": [
        "interpolate",
        ["exponential", 2],
        ["zoom"],
        8,
        ["max", 1.5, ["*", ["get", "widthM"], PX_PER_M_Z8]],
        16,
        ["max", 1.5, ["*", ["get", "widthM"], PX_PER_M_Z16]],
      ],
    },
  });
  POINT_TIERS.forEach(({ tier, minzoom, labelMinzoom }) => {
    map.addLayer({
      id: pointLayerId(tier),
      type: "symbol",
      source: SRC_POINTS,
      minzoom,
      filter: ["==", ["get", "tier"], tier],
      layout: {
        "icon-image": ["concat", "fac-", ["get", "kind"], "-", ["get", "use"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 4, 0.5, 8, 0.75, 12, 1],
        "icon-allow-overlap": ["step", ["zoom"], false, 9, true],
      },
      paint: {
        // fade at runway-scale zoom so the symbol does not hide the runway it marks
        "icon-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 1, 13.5, 0.4],
      },
    });
    map.addLayer({
      id: labelLayerId(tier),
      type: "symbol",
      source: SRC_POINTS,
      minzoom: labelMinzoom,
      filter: ["==", ["get", "tier"], tier],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Open Sans Regular"],
        "text-size": 12,
        "text-offset": [0, 1.7],
        "text-anchor": "top",
        "text-max-width": 9,
        "text-optional": true,
      },
      paint: {
        "text-color": ["match", ["get", "use"], "military", MIL, CIV],
        "text-halo-color": "rgba(11, 17, 32, 0.95)",
        "text-halo-width": 1.5,
      },
    });
  });
}

function teardown(map: maplibregl.Map) {
  for (const id of [...ALL_LAYERS].reverse()) if (map.getLayer(id)) map.removeLayer(id);
  for (const id of [SRC_POINTS, SRC_RUNWAYS, SRC_AREAS]) if (map.getSource(id)) map.removeSource(id);
}

interface FacilityLayerProps {
  map: maplibregl.Map;
  facilities: Facility[];
  visible: boolean;
  selectedId: string | null;
}

export function FacilityLayer({ map, facilities, visible, selectedId }: FacilityLayerProps) {
  const visibleRef = useRef(visible);
  const selectedRef = useRef(selectedId);

  const apply = () => {
    const vis = visibleRef.current ? "visible" : "none";
    for (const id of ALL_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
    if (map.getLayer("facility-selected")) {
      const f: maplibregl.FilterSpecification = ["==", ["get", "id"], selectedRef.current ?? ""];
      map.setFilter("facility-selected", f);
      map.setFilter("facility-selected-ring", f);
    }
  };

  // Build once; rebuild after a style swap (theme switch drops all custom layers).
  useEffect(() => {
    const ensure = () => {
      if (map.getSource(SRC_POINTS)) return;
      build(map, facilities);
      apply();
    };
    if (map.isStyleLoaded()) ensure();
    map.on("style.load", ensure);
    return () => {
      map.off("style.load", ensure);
      teardown(map);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, facilities]);

  useEffect(() => {
    visibleRef.current = visible;
    selectedRef.current = selectedId;
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, visible, selectedId]);

  // Pointer cursor over facilities
  useEffect(() => {
    const over = () => (map.getCanvas().style.cursor = "pointer");
    const out = () => (map.getCanvas().style.cursor = "");
    for (const id of FACILITY_POINT_LAYERS) {
      map.on("mouseenter", id, over);
      map.on("mouseleave", id, out);
    }
    return () => {
      for (const id of FACILITY_POINT_LAYERS) {
        map.off("mouseenter", id, over);
        map.off("mouseleave", id, out);
      }
    };
  }, [map]);

  return null;
}
