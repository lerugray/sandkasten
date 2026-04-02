"use client";

import { useEffect } from "react";
import maplibregl from "maplibre-gl";
import { distanceNm, distanceKm, bearingDeg } from "@/lib/simulation/movement";
import type { FeatureCollection } from "geojson";

const SOURCE_ID = "measurement";
const LINE_LAYER = "measurement-line-layer";
const POINT_LAYER = "measurement-point-layer";

export interface MeasurePoint {
  lng: number;
  lat: number;
}

interface MeasurementLayerProps {
  map: maplibregl.Map;
  start: MeasurePoint | null;
  end: MeasurePoint | null;
}

export function MeasurementLayer({ map, start, end }: MeasurementLayerProps) {
  useEffect(() => {
    const features: GeoJSON.Feature[] = [];

    if (start) {
      features.push({
        type: "Feature",
        properties: { type: "point" },
        geometry: { type: "Point", coordinates: [start.lng, start.lat] },
      });
    }

    if (start && end) {
      features.push({
        type: "Feature",
        properties: { type: "point" },
        geometry: { type: "Point", coordinates: [end.lng, end.lat] },
      });

      features.push({
        type: "Feature",
        properties: { type: "line" },
        geometry: {
          type: "LineString",
          coordinates: [
            [start.lng, start.lat],
            [end.lng, end.lat],
          ],
        },
      });
    }

    const geojson: FeatureCollection = { type: "FeatureCollection", features };
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

    if (source) {
      source.setData(geojson);
    } else {
      map.addSource(SOURCE_ID, { type: "geojson", data: geojson });

      map.addLayer({
        id: LINE_LAYER,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "type"], "line"],
        paint: {
          "line-color": "rgba(255, 220, 50, 0.8)",
          "line-width": 2,
          "line-dasharray": [6, 3],
        },
      });

      map.addLayer({
        id: POINT_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "type"], "point"],
        paint: {
          "circle-radius": 5,
          "circle-color": "rgba(255, 220, 50, 0.9)",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });
    }

    return () => {
      if (map.getLayer(POINT_LAYER)) map.removeLayer(POINT_LAYER);
      if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map, start, end]);

  return null;
}

export function formatMeasurement(
  start: MeasurePoint,
  end: MeasurePoint
): string {
  const nm = distanceNm(start, end);
  const km = distanceKm(start, end);
  const brg = bearingDeg(start, end);
  return `${nm.toFixed(1)} nm / ${km.toFixed(1)} km \u2022 ${brg.toFixed(0)}\u00B0`;
}
