"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { createCircleGeoJSON } from "@/lib/map/rangeRings";
import { getPlatform } from "@/lib/platforms/lookup";
import { getAffiliation } from "@/types/game";
import type { Unit } from "@/types/game";
import type { Feature, FeatureCollection, Polygon } from "geojson";

const SOURCE_ID = "range-rings";
const FILL_LAYER = "range-rings-fill";
const LINE_LAYER = "range-rings-line";

interface RangeRingLayerProps {
  map: maplibregl.Map;
  units: Unit[];
  playerSide: string;
  selectedUnitId: string | null;
  pinnedRingIds: Set<string>;
}

export function RangeRingLayer({
  map,
  units,
  playerSide,
  selectedUnitId,
  pinnedRingIds,
}: RangeRingLayerProps) {
  const layersAdded = useRef(false);

  // One-time setup: add source and layers
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
          "fill-color": [
            "case",
            ["==", ["get", "type"], "weapon"],
            ["case", ["get", "friendly"], "rgba(0, 100, 255, 0.08)", "rgba(255, 50, 50, 0.08)"],
            ["case", ["get", "friendly"], "rgba(0, 100, 255, 0.04)", "rgba(255, 50, 50, 0.04)"],
          ],
          "fill-opacity": 1,
        },
      });

      map.addLayer({
        id: LINE_LAYER,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "type"], "weapon"],
            ["case", ["get", "friendly"], "rgba(0, 150, 255, 0.5)", "rgba(255, 80, 80, 0.5)"],
            ["case", ["get", "friendly"], "rgba(0, 100, 255, 0.3)", "rgba(255, 50, 50, 0.3)"],
          ],
          "line-width": [
            "case",
            ["==", ["get", "type"], "weapon"],
            1.5,
            1,
          ],
          "line-dasharray": [4, 3],
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

  // Update data when selection/units change — no teardown
  useEffect(() => {
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const features: Feature<Polygon>[] = [];

    const idsToShow = new Set(pinnedRingIds);
    if (selectedUnitId) idsToShow.add(selectedUnitId);
    const unitsToShow = units.filter((u) => idsToShow.has(u.id));

    unitsToShow.forEach((unit) => {
      const platform = getPlatform(unit.platformId);
      if (!platform) return;

      const affiliation = getAffiliation(unit, playerSide);
      const isFriendly = affiliation === "friendly";

      if (platform.sensorRangeKm) {
        const ring = createCircleGeoJSON(
          unit.position.lng,
          unit.position.lat,
          platform.sensorRangeKm
        );
        ring.properties = { friendly: isFriendly, type: "sensor", unitId: unit.id };
        features.push(ring);
      }

      if (platform.weaponRangeKm) {
        const ring = createCircleGeoJSON(
          unit.position.lng,
          unit.position.lat,
          platform.weaponRangeKm
        );
        ring.properties = { friendly: isFriendly, type: "weapon", unitId: unit.id };
        features.push(ring);
      }
    });

    source.setData({ type: "FeatureCollection", features });
  }, [map, units, playerSide, selectedUnitId, pinnedRingIds]);

  return null;
}
