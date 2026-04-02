"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { createSymbolSVG, getSymbolAnchor } from "@/lib/symbols/milsymbolFactory";
import { getPlatform } from "@/lib/platforms/lookup";
import { getAffiliation } from "@/types/game";
import type { Unit, Affiliation } from "@/types/game";
import type { BattleDimension } from "@/lib/symbols/milsymbolFactory";

interface UnitLayerProps {
  map: maplibregl.Map;
  units: Unit[];
  playerSide: string;
  selectedUnitId: string | null;
  onUnitSelect: (unitId: string | null, shiftKey?: boolean) => void;
  onUnitDrag?: (unitId: string, position: { lat: number; lng: number }) => void;
}

export function UnitLayer({
  map,
  units,
  playerSide,
  selectedUnitId,
  onUnitSelect,
  onUnitDrag,
}: UnitLayerProps) {
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => {
    const existingMarkers = markersRef.current;
    const currentIds = new Set(units.map((u) => u.id));

    // Remove markers for units no longer present
    existingMarkers.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        existingMarkers.delete(id);
      }
    });

    // Add or update markers
    units.forEach((unit) => {
      if (unit.damageState === "destroyed") {
        const existing = existingMarkers.get(unit.id);
        if (existing) {
          existing.remove();
          existingMarkers.delete(unit.id);
        }
        return;
      }

      const platform = getPlatform(unit.platformId);
      const affiliation = getAffiliation(unit, playerSide);
      const dimension: BattleDimension = platform?.dimension ?? "sea";
      const functionId = platform?.functionId ?? "CL";

      const symbolOptions = {
        affiliation,
        dimension,
        functionId,
        size: 25,
        heading: unit.heading,
      };

      const svg = createSymbolSVG(symbolOptions);
      const anchor = getSymbolAnchor(symbolOptions);

      const existing = existingMarkers.get(unit.id);
      if (existing) {
        existing.setLngLat([unit.position.lng, unit.position.lat]);
        return;
      }

      const el = document.createElement("div");
      el.className = "unit-marker";
      el.innerHTML = svg;
      el.style.cursor = "pointer";
      el.title = unit.name;

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onUnitSelect(unit.id, e.shiftKey);
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: "center",
        draggable: !!onUnitDrag,
      })
        .setLngLat([unit.position.lng, unit.position.lat])
        .addTo(map);

      if (onUnitDrag) {
        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          onUnitDrag(unit.id, { lat: lngLat.lat, lng: lngLat.lng });
        });
      }

      existingMarkers.set(unit.id, marker);
    });

    return () => {
      existingMarkers.forEach((marker) => marker.remove());
      existingMarkers.clear();
    };
  }, [map, units, playerSide, selectedUnitId, onUnitSelect, onUnitDrag]);

  return null;
}
