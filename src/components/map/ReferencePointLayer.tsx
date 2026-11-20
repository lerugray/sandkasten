"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { ReferencePoint } from "@/types/game";

const SRC_AREAS = "reference-point-areas-src";
const LAYER_FILL = "reference-point-areas-fill";
const LAYER_LINE = "reference-point-areas-line";
const DEFAULT_COLOR = "#f5c451";

interface ReferencePointLayerProps {
  map: maplibregl.Map;
  referencePoints: ReferencePoint[];
  sideColors: Record<string, string>;
  /** Move a single point (index 0 for type "point"; a vertex index for type "area"). */
  onDragPoint?: (refId: string, index: number, position: { lat: number; lng: number }) => void;
}

function colorOf(rp: ReferencePoint, sideColors: Record<string, string>): string {
  return (rp.side && sideColors[rp.side]) || DEFAULT_COLOR;
}

function areaCollection(referencePoints: ReferencePoint[], sideColors: Record<string, string>): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: referencePoints
      .filter((r) => r.type === "area" && r.points.length >= 3)
      .map((r) => ({
        type: "Feature" as const,
        properties: { id: r.id, color: colorOf(r, sideColors) },
        geometry: { type: "Polygon" as const, coordinates: [[...r.points.map((p) => [p.lng, p.lat] as [number, number]), [r.points[0].lng, r.points[0].lat] as [number, number]]] },
      })),
  };
}

function centroid(pts: { lng: number; lat: number }[]): { lng: number; lat: number } {
  let lng = 0;
  let lat = 0;
  for (const p of pts) {
    lng += p.lng;
    lat += p.lat;
  }
  return { lng: lng / pts.length, lat: lat / pts.length };
}

function dot(color: string, square = false): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = "refpoint-dot";
  el.style.cssText = `display:block;width:${square ? 9 : 11}px;height:${square ? 9 : 11}px;background:${color};border:2px solid #0B1120;border-radius:${square ? "2px" : "50%"};box-shadow:0 0 0 1px ${color};pointer-events:none;`;
  return el;
}

function markerEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "refpoint-marker";
  el.style.cssText = "display:flex;align-items:center;gap:4px;cursor:grab;z-index:7;line-height:0;";
  return el;
}

function nameLabel(text: string, color: string): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = "refpoint-label";
  el.textContent = text;
  el.style.cssText = `font-family:var(--font-mono);font-size:11px;line-height:1;color:${color};text-shadow:0 0 3px #0B1120,0 0 3px #0B1120;white-space:nowrap;pointer-events:none;`;
  return el;
}

export function ReferencePointLayer({ map, referencePoints, sideColors, onDragPoint }: ReferencePointLayerProps) {
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const dragRef = useRef(onDragPoint);
  dragRef.current = onDragPoint;

  const ensureAreas = (force = false) => {
    if (force) {
      if (map.getLayer(LAYER_LINE)) map.removeLayer(LAYER_LINE);
      if (map.getLayer(LAYER_FILL)) map.removeLayer(LAYER_FILL);
      if (map.getSource(SRC_AREAS)) map.removeSource(SRC_AREAS);
    }
    if (!map.getSource(SRC_AREAS)) {
      map.addSource(SRC_AREAS, { type: "geojson", data: areaCollection(referencePoints, sideColors) });
      map.addLayer({
        id: LAYER_FILL,
        type: "fill",
        source: SRC_AREAS,
        paint: { "fill-color": ["get", "color"], "fill-opacity": 0.08 },
      });
      map.addLayer({
        id: LAYER_LINE,
        type: "line",
        source: SRC_AREAS,
        paint: { "line-color": ["get", "color"], "line-width": 1.5, "line-dasharray": [3, 2] },
      });
    } else {
      (map.getSource(SRC_AREAS) as maplibregl.GeoJSONSource).setData(areaCollection(referencePoints, sideColors));
    }
  };

  const syncMarkers = () => {
    const markers = markersRef.current;
    const wanted = new Set<string>();
    for (const rp of referencePoints) {
      const color = colorOf(rp, sideColors);
      if (rp.type === "point") {
        if (rp.points.length === 0) continue;
        const key = `${rp.id}:0`;
        wanted.add(key);
        const existing = markers.get(key);
        if (existing) {
          existing.setLngLat([rp.points[0].lng, rp.points[0].lat]);
          const label = existing.getElement().querySelector<HTMLElement>(".refpoint-label");
          if (label && label.textContent !== rp.name) label.textContent = rp.name;
          continue;
        }
        const el = markerEl();
        el.setAttribute("data-testid", "refpoint-marker");
        el.dataset.refId = rp.id;
        el.dataset.vertex = "0";
        el.appendChild(dot(color));
        el.appendChild(nameLabel(rp.name, color));
        const marker = new maplibregl.Marker({ element: el, anchor: "center", draggable: !!dragRef.current })
          .setLngLat([rp.points[0].lng, rp.points[0].lat])
          .addTo(map);
        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          dragRef.current?.(rp.id, 0, { lat: lngLat.lat, lng: lngLat.lng });
        });
        markers.set(key, marker);
      } else {
        // area: one label at the centroid, one draggable vertex per point
        if (rp.points.length >= 1) {
          const c = centroid(rp.points);
          const labelKey = `${rp.id}:label`;
          wanted.add(labelKey);
          let labelMarker = markers.get(labelKey);
          if (!labelMarker) {
            const el = document.createElement("div");
            el.className = "refpoint-area-label";
            el.setAttribute("data-testid", "refpoint-label");
            el.dataset.refId = rp.id;
            el.textContent = rp.name;
            el.style.cssText = `font-family:var(--font-mono);font-size:11px;line-height:1;color:${color};text-shadow:0 0 3px #0B1120,0 0 3px #0B1120;white-space:nowrap;pointer-events:none;`;
            labelMarker = new maplibregl.Marker({ element: el, anchor: "bottom", draggable: false }).setLngLat([c.lng, c.lat]).addTo(map);
            markers.set(labelKey, labelMarker);
          } else {
            labelMarker.setLngLat([c.lng, c.lat]);
            const el = labelMarker.getElement();
            if (el.textContent !== rp.name) el.textContent = rp.name;
          }
        }
        rp.points.forEach((p, i) => {
          const key = `${rp.id}:${i}`;
          wanted.add(key);
          const existing = markers.get(key);
          if (existing) {
            existing.setLngLat([p.lng, p.lat]);
            return;
          }
          const el = markerEl();
          el.setAttribute("data-testid", "refpoint-marker");
          el.dataset.refId = rp.id;
          el.dataset.vertex = String(i);
          el.appendChild(dot(color, true));
          const marker = new maplibregl.Marker({ element: el, anchor: "center", draggable: !!dragRef.current })
            .setLngLat([p.lng, p.lat])
            .addTo(map);
          marker.on("dragend", () => {
            const lngLat = marker.getLngLat();
            dragRef.current?.(rp.id, i, { lat: lngLat.lat, lng: lngLat.lng });
          });
          markers.set(key, marker);
        });
      }
    }
    for (const [key, marker] of markers) {
      if (!wanted.has(key)) {
        marker.remove();
        markers.delete(key);
      }
    }
  };

  // Build the area layers once (and re-build after a theme/style swap drops custom layers).
  useEffect(() => {
    const ensure = () => {
      if (!map.isStyleLoaded()) return;
      ensureAreas(true);
    };
    if (map.isStyleLoaded()) ensure();
    map.on("style.load", ensure);
    return () => {
      map.off("style.load", ensure);
      for (const id of [LAYER_LINE, LAYER_FILL]) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(SRC_AREAS)) map.removeSource(SRC_AREAS);
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    ensureAreas();
    syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, referencePoints, sideColors]);

  return null;
}
