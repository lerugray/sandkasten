"use client";

import { useEffect } from "react";
import maplibregl from "maplibre-gl";
import type { Unit } from "@/types/game";
import type { WeaponInFlight } from "@/lib/simulation/combat";
import type { FeatureCollection } from "geojson";

const SOURCE_ID = "weapon-tracks";
const LINE_LAYER = "weapon-track-lines-layer";
const POINT_LAYER = "weapon-track-points-layer";

interface WeaponTrackLayerProps {
  map: maplibregl.Map;
  weaponsInFlight: WeaponInFlight[];
  units: Unit[];
  playerSide: string;
}

export function WeaponTrackLayer({
  map,
  weaponsInFlight,
  units,
  playerSide,
}: WeaponTrackLayerProps) {
  useEffect(() => {
    const unitMap = new Map(units.map((u) => [u.id, u]));
    const features: GeoJSON.Feature[] = [];

    for (const weapon of weaponsInFlight) {
      // In fog of war, show tracks where launcher is friendly OR target is friendly
      const isFriendly = weapon.launchedBySide === playerSide;
      const target = unitMap.get(weapon.targetId);
      const targetIsFriendly = target?.side === playerSide;
      if (!isFriendly && !targetIsFriendly) continue;

      // Line from weapon position to target position
      if (target && target.damageState !== "destroyed") {
        features.push({
          type: "Feature",
          properties: { type: "line", friendly: isFriendly },
          geometry: {
            type: "LineString",
            coordinates: [
              [weapon.position.lng, weapon.position.lat],
              [target.position.lng, target.position.lat],
            ],
          },
        });
      }

      // Missile dot at current position
      features.push({
        type: "Feature",
        properties: { type: "point", friendly: isFriendly },
        geometry: {
          type: "Point",
          coordinates: [weapon.position.lng, weapon.position.lat],
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
          "line-color": [
            "case",
            ["get", "friendly"],
            "rgba(59, 130, 246, 0.6)",  // blue for friendly
            "rgba(239, 68, 68, 0.6)",   // red for hostile
          ],
          "line-width": 1.5,
          "line-dasharray": [4, 4],
        },
      });

      map.addLayer({
        id: POINT_LAYER,
        type: "circle",
        source: SOURCE_ID,
        filter: ["==", ["get", "type"], "point"],
        paint: {
          "circle-radius": 4,
          "circle-color": [
            "case",
            ["get", "friendly"],
            "rgba(59, 130, 246, 1.0)",
            "rgba(239, 68, 68, 1.0)",
          ],
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
  }, [map, weaponsInFlight, units, playerSide]);

  return null;
}
