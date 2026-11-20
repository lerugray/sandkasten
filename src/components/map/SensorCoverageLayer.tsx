"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { createCircleGeoJSON } from "@/lib/map/rangeRings";
import { getPlatform } from "@/lib/platforms/lookup";
import type { Unit } from "@/types/game";
import type { UnitOrders } from "@/lib/simulation/gameState";
import type { Feature, FeatureCollection, Polygon } from "geojson";

const SOURCE_ID = "sensor-coverage";
const FILL_LAYER = "sensor-coverage-fill";
const LINE_LAYER = "sensor-coverage-line";

interface SensorCoverageLayerProps {
  map: maplibregl.Map;
  units: Unit[];
  orders: Map<string, UnitOrders>;
  playerSide: string;
}

export function SensorCoverageLayer({
  map,
  units,
  orders,
  playerSide,
}: SensorCoverageLayerProps) {
  const layersAdded = useRef(false);

  useEffect(() => {
    if (layersAdded.current) return;

    const emptyGeoJSON: FeatureCollection = { type: "FeatureCollection", features: [] };

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: "geojson", data: emptyGeoJSON });

      map.addLayer({
        id: FILL_LAYER,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": "rgba(59, 130, 246, 0.06)",
          "fill-opacity": 1,
        },
      });

      map.addLayer({
        id: LINE_LAYER,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": "rgba(59, 130, 246, 0.25)",
          "line-width": 1,
          "line-dasharray": [6, 4],
        },
      });
    }

    layersAdded.current = true;

    return () => {
      if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER);
      if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      layersAdded.current = false;
    };
  }, [map]);

  useEffect(() => {
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const features: Feature<Polygon>[] = [];

    // Show coverage for friendly units with active radar
    const friendlyUnits = units.filter((u) => u.side === playerSide && u.damageState !== "destroyed");

    for (const unit of friendlyUnits) {
      const unitOrders = orders.get(unit.id);
      if (!unitOrders?.radarActive) continue;

      const platform = getPlatform(unit.platformId);
      if (!platform?.sensorRangeKm) continue;

      const circle = createCircleGeoJSON(
        unit.position.lng,
        unit.position.lat,
        platform.sensorRangeKm
      );
      circle.properties = { unitId: unit.id };
      features.push(circle);
    }

    source.setData({ type: "FeatureCollection", features });
  }, [map, units, orders, playerSide]);

  return null;
}
