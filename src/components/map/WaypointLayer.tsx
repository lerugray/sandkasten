"use client";

import { useEffect } from "react";
import maplibregl from "maplibre-gl";
import type { Unit } from "@/types/game";
import type { UnitOrders } from "@/lib/simulation/gameState";
import type { FeatureCollection } from "geojson";

const SOURCE_ID = "waypoint-lines";
const LINE_LAYER = "waypoint-lines-layer";
const POINT_LAYER = "waypoint-points-layer";

interface WaypointLayerProps {
  map: maplibregl.Map;
  units: Unit[];
  orders: Map<string, UnitOrders>;
  selectedUnitId: string | null;
  playerSide: string;
}

export function WaypointLayer({
  map,
  units,
  orders,
  selectedUnitId,
  playerSide,
}: WaypointLayerProps) {
  useEffect(() => {
    const features: GeoJSON.Feature[] = [];

    // Show waypoints for selected unit, or all friendly units with waypoints
    const unitsToShow = selectedUnitId
      ? units.filter((u) => u.id === selectedUnitId)
      : units.filter((u) => u.side === playerSide);

    for (const unit of unitsToShow) {
      const unitOrders = orders.get(unit.id);
      if (!unitOrders || unitOrders.waypoints.length === 0) continue;

      // Line from unit to waypoints
      const coords: [number, number][] = [
        [unit.position.lng, unit.position.lat],
        ...unitOrders.waypoints.map((wp) => [wp.position.lng, wp.position.lat] as [number, number]),
      ];

      features.push({
        type: "Feature",
        properties: { type: "line", unitId: unit.id },
        geometry: { type: "LineString", coordinates: coords },
      });

      // Waypoint dots
      for (let i = 0; i < unitOrders.waypoints.length; i++) {
        const wp = unitOrders.waypoints[i];
        features.push({
          type: "Feature",
          properties: { type: "point", unitId: unit.id, index: i },
          geometry: {
            type: "Point",
            coordinates: [wp.position.lng, wp.position.lat],
          },
        });
      }
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
          "line-color": "rgba(0, 170, 255, 0.6)",
          "line-width": 2,
          "line-dasharray": [6, 4],
        },
      });

      map.addLayer({
        id: POINT_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "type"], "point"],
        paint: {
          "circle-radius": 4,
          "circle-color": "rgba(0, 170, 255, 0.8)",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });
    }

    return () => {
      if (map.getLayer(POINT_LAYER)) map.removeLayer(POINT_LAYER);
      if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map, units, orders, selectedUnitId, playerSide]);

  return null;
}
