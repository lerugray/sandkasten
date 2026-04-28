"use client";

import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import { getMapStyle } from "@/lib/map/styles";
import type { Scenario } from "@/types/game";
import type { Contact, UnitOrders } from "@/lib/simulation/gameState";
import { UnitLayer } from "./UnitLayer";
import { RangeRingLayer } from "./RangeRingLayer";
import { ContactLayer } from "./ContactLayer";
import { WaypointLayer } from "./WaypointLayer";
import { WeaponTrackLayer } from "./WeaponTrackLayer";
import { SensorCoverageLayer } from "./SensorCoverageLayer";
import { MeasurementLayer, type MeasurePoint } from "./MeasurementLayer";
import type { WeaponInFlight } from "@/lib/simulation/combat";

interface TacticalMapProps {
  scenario: Scenario;
  selectedUnitId: string | null;
  pinnedRingIds: Set<string>;
  theme: "dark" | "light";
  onUnitSelect: (unitId: string | null, shiftKey?: boolean) => void;
  onMapReady?: () => void;
  // Simulation props (optional — static mode if omitted)
  contacts?: Contact[];
  orders?: Map<string, UnitOrders>;
  fogOfWar?: boolean;
  weaponsInFlight?: WeaponInFlight[];
  showSensorCoverage?: boolean;
  measureStart?: MeasurePoint | null;
  measureEnd?: MeasurePoint | null;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  onUnitDrag?: (unitId: string, position: { lat: number; lng: number }) => void;
}

export function TacticalMap({
  scenario,
  selectedUnitId,
  pinnedRingIds,
  theme,
  onUnitSelect,
  onMapReady,
  contacts,
  orders,
  fogOfWar = false,
  weaponsInFlight,
  showSensorCoverage = false,
  measureStart = null,
  measureEnd = null,
  onMapClick,
  onUnitDrag,
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
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    map.on("load", () => {
      setMapReady(true);
      setZoom(map.getZoom());
      const mapEl = containerRef.current?.querySelector(".maplibregl-canvas")?.closest(".maplibregl-map");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (mapEl) (mapEl as any).__maplibreMap = map;
      onMapReady?.();
    });

    map.on("zoom", () => setZoom(map.getZoom()));
    map.on("mousemove", (e) => setCursorPos({ lat: e.lngLat.lat, lng: e.lngLat.lng }));

    map.on("click", (e) => {
      const target = e.originalEvent.target as HTMLElement;
      if (target.closest(".unit-marker") || target.closest(".contact-marker")) return;
      onMapClick?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
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

  // In fog of war mode, only show friendly units directly
  const allUnits = scenario.sides.flatMap((s) => s.units);
  const visibleUnits = fogOfWar
    ? allUnits.filter((u) => u.side === scenario.playerSide)
    : allUnits;

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {mapReady && mapRef.current && (
        <>
          <UnitLayer
            map={mapRef.current}
            units={visibleUnits}
            playerSide={scenario.playerSide}
            selectedUnitId={selectedUnitId}
            onUnitSelect={onUnitSelect}
            onUnitDrag={onUnitDrag}
          />
          {showSensorCoverage && orders && (
            <SensorCoverageLayer
              map={mapRef.current}
              units={visibleUnits}
              orders={orders}
              playerSide={scenario.playerSide}
            />
          )}
          <RangeRingLayer
            map={mapRef.current}
            units={visibleUnits}
            playerSide={scenario.playerSide}
            selectedUnitId={selectedUnitId}
            pinnedRingIds={pinnedRingIds}
          />
          {contacts && contacts.length > 0 && (
            <ContactLayer
              map={mapRef.current}
              contacts={contacts}
              fogOfWar={fogOfWar}
            />
          )}
          {orders && (
            <WaypointLayer
              map={mapRef.current}
              units={visibleUnits}
              orders={orders}
              selectedUnitId={selectedUnitId}
              playerSide={scenario.playerSide}
            />
          )}
          {weaponsInFlight && weaponsInFlight.length > 0 && (
            <WeaponTrackLayer
              map={mapRef.current}
              weaponsInFlight={weaponsInFlight}
              units={allUnits}
              playerSide={scenario.playerSide}
            />
          )}
          {(measureStart || measureEnd) && (
            <MeasurementLayer
              map={mapRef.current}
              start={measureStart}
              end={measureEnd}
            />
          )}
        </>
      )}

      {/* Status bar */}
      <div className="absolute bottom-0 left-0 right-0 h-9 bg-[var(--color-tactical-panel)] border-t border-[var(--color-tactical-border)] flex items-center px-4 text-base text-[var(--color-tactical-text-dim)] gap-6 z-10">
        <span>SANDKASTEN v0.1</span>
        {cursorPos && (
          <span>
            {cursorPos.lat.toFixed(4)}N {cursorPos.lng.toFixed(4)}E
          </span>
        )}
        <span>Z{zoom.toFixed(1)}</span>
        {contacts && <span>{contacts.length} contacts</span>}
        <span className="ml-auto">{scenario.name}</span>
      </div>
    </div>
  );
}
