"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import { getMapStyle } from "@/lib/map/styles";
import type { Unit, Scenario } from "@/types/game";
import { UnitLayer } from "./UnitLayer";
import { RangeRingLayer } from "./RangeRingLayer";

interface TacticalMapProps {
  scenario: Scenario;
  selectedUnitId: string | null;
  pinnedRingIds: Set<string>;
  theme: "dark" | "light";
  onUnitSelect: (unitId: string | null, shiftKey?: boolean) => void;
  onMapReady?: () => void;
}

export function TacticalMap({
  scenario,
  selectedUnitId,
  pinnedRingIds,
  theme,
  onUnitSelect,
  onMapReady,
}: TacticalMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ lat: number; lng: number } | null>(null);
  const [zoom, setZoom] = useState(0);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle("dark"),
      center: [scenario.theater.center.lng, scenario.theater.center.lat],
      zoom: scenario.theater.zoom,
      minZoom: 3,
      maxZoom: 15,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "top-right"
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    map.on("load", () => {
      setMapReady(true);
      setZoom(map.getZoom());
      // Expose map instance on DOM for editor unit placement
      const mapEl = containerRef.current?.querySelector(".maplibregl-canvas")?.closest(".maplibregl-map");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (mapEl) (mapEl as any).__maplibreMap = map;
      onMapReady?.();
    });

    map.on("zoom", () => {
      setZoom(map.getZoom());
    });

    map.on("mousemove", (e) => {
      setCursorPos({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    map.on("click", (e) => {
      const target = e.originalEvent.target as HTMLElement;
      if (target.closest(".unit-marker")) return;
      onUnitSelect(null);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme switching
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(getMapStyle(theme));
    document.documentElement.className = theme === "light" ? "theme-light" : "";
  }, [theme]);

  const allUnits = scenario.sides.flatMap((s) => s.units);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {mapReady && mapRef.current && (
        <>
          <UnitLayer
            map={mapRef.current}
            units={allUnits}
            playerSide={scenario.playerSide}
            selectedUnitId={selectedUnitId}
            onUnitSelect={onUnitSelect}
          />
          <RangeRingLayer
            map={mapRef.current}
            units={allUnits}
            playerSide={scenario.playerSide}
            selectedUnitId={selectedUnitId}
            pinnedRingIds={pinnedRingIds}
          />
        </>
      )}

      {/* Status bar */}
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-[var(--color-tactical-panel)] border-t border-[var(--color-tactical-border)] flex items-center px-3 text-[10px] text-[var(--color-tactical-text-dim)] gap-4 z-10">
        <span>SANDKASTEN v0.1</span>
        {cursorPos && (
          <span>
            {cursorPos.lat.toFixed(4)}N {cursorPos.lng.toFixed(4)}E
          </span>
        )}
        <span>Z{zoom.toFixed(1)}</span>
        <span className="ml-auto">{scenario.name}</span>
      </div>
    </div>
  );
}
