"use client";

import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import {
  ADAPTIVE_PROJECTION,
  FLAT_PROJECTION,
  HILLSHADE_LAYER_ID,
  BASEMAP_CREDIT_TEXT,
  SATELLITE_CREDIT_TEXT,
  SATELLITE_LAYER_ID,
  TERRAIN_SOURCE_ID,
  getMapStyle,
} from "@/lib/map/styles";
import { FacilityLayer, FACILITY_HIT_LAYERS } from "./FacilityLayer";
import { FacilityPanel } from "./FacilityPanel";
import { FACILITY_ATTRIBUTION, getFacility } from "@/lib/facilities/facilities";
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
  onMapClick?: (lngLat: { lng: number; lat: number }) => boolean | void;
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
  const styleReadyRef = useRef(false);
  const onUnitSelectRef = useRef(onUnitSelect);
  const onMapReadyRef = useRef(onMapReady);
  const onMapClickRef = useRef(onMapClick);
  const [mapReady, setMapReady] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ lat: number; lng: number } | null>(null);
  const [zoom, setZoom] = useState(0);
  const [showFacilities, setShowFacilities] = useState(true);
  const [globeOn, setGlobeOn] = useState(true);
  const [terrainOn, setTerrainOn] = useState(false);
  const [satelliteOn, setSatelliteOn] = useState(false);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const hasFacilities = !!scenario.facilities?.length;
  const hasFacilitiesRef = useRef(hasFacilities);
  hasFacilitiesRef.current = hasFacilities;
  const showFacilitiesRef = useRef(showFacilities);
  showFacilitiesRef.current = showFacilities;

  useEffect(() => {
    onUnitSelectRef.current = onUnitSelect;
  }, [onUnitSelect]);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

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
      onMapReadyRef.current?.();
    });

    map.on("zoom", () => setZoom(map.getZoom()));
    map.on("mousemove", (e) => setCursorPos({ lat: e.lngLat.lat, lng: e.lngLat.lng }));

    map.on("click", (e) => {
      const target = e.originalEvent.target as HTMLElement;
      if (target.closest(".unit-marker") || target.closest(".contact-marker")) return;
      const handled =
        onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat }) === true;
      if (handled) return;
      onUnitSelectRef.current(null);
      if (!hasFacilitiesRef.current || !showFacilitiesRef.current) return;
      const pad = 10;
      const layers = FACILITY_HIT_LAYERS.filter((id) => map.getLayer(id));
      const hits = layers.length
        ? map.queryRenderedFeatures(
            [
              [e.point.x - pad, e.point.y - pad],
              [e.point.x + pad, e.point.y + pad],
            ],
            { layers },
          )
        : [];
      // Symbols win over area fills; both are ordered nearest-first by the renderer.
      const hit = hits.find((h) => h.layer.id !== "facility-areas-fill") ?? hits[0];
      setSelectedFacilityId((hit?.properties?.id as string | undefined) ?? null);
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
    styleReadyRef.current = false;
    mapRef.current.setStyle(getMapStyle(theme));
    document.documentElement.className = theme === "light" ? "theme-light" : "";
  }, [theme]);

  // Globe / terrain / satellite toggles. Re-applied after a style swap (theme switch resets layer state).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      styleReadyRef.current = true;
      const wanted = globeOn ? ADAPTIVE_PROJECTION : FLAT_PROJECTION;
      if (JSON.stringify(map.getProjection()) !== JSON.stringify(wanted)) map.setProjection(wanted);
      if (map.getLayer(SATELLITE_LAYER_ID)) {
        map.setLayoutProperty(SATELLITE_LAYER_ID, "visibility", satelliteOn ? "visible" : "none");
      }
      if (map.getLayer(HILLSHADE_LAYER_ID)) {
        map.setLayoutProperty(HILLSHADE_LAYER_ID, "visibility", terrainOn ? "visible" : "none");
      }
      if (map.getSource(TERRAIN_SOURCE_ID) && (terrainOn || map.getTerrain())) {
        map.setTerrain(terrainOn ? { source: TERRAIN_SOURCE_ID, exaggeration: 1.5 } : null);
      }
    };
    // isStyleLoaded() is false while tiles stream in, so track readiness ourselves: not ready only between setStyle and style.load.
    if (styleReadyRef.current || map.isStyleLoaded()) apply();
    map.on("style.load", apply);
    return () => {
      map.off("style.load", apply);
    };
  }, [mapReady, globeOn, terrainOn, satelliteOn, theme]);

  useEffect(() => {
    if (selectedUnitId) setSelectedFacilityId(null);
  }, [selectedUnitId]);

  const selectedFacility = selectedFacilityId
    ? getFacility(selectedFacilityId, scenario.facilities)
    : undefined;

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
          {hasFacilities && (
            <FacilityLayer
              map={mapRef.current}
              facilities={scenario.facilities!}
              visible={showFacilities}
              selectedId={selectedFacilityId}
            />
          )}
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

      {/* Map look toggles */}
      <div
        data-testid="map-controls"
        className="absolute top-2 left-2 z-10 flex gap-1 text-sm tracking-wider"
      >
        {([
          ["facilities", "FACILITIES", showFacilities, setShowFacilities, hasFacilities],
          ["globe", "GLOBE", globeOn, setGlobeOn, true],
          ["terrain", "TERRAIN", terrainOn, setTerrainOn, true],
          ["satellite", "SAT", satelliteOn, setSatelliteOn, true],
        ] as const)
          .filter(([, , , , enabled]) => enabled)
          .map(([key, label, on, set]) => (
            <button
              key={key}
              type="button"
              data-testid={`map-toggle-${key}`}
              aria-pressed={on}
              onClick={() => set(!on)}
              className={`px-2.5 py-1 rounded border cursor-pointer bg-[var(--color-tactical-panel)] ${
                on
                  ? "border-[var(--color-terminal-amber)] text-[var(--color-terminal-amber)]"
                  : "border-[var(--color-tactical-border)] text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)]"
              }`}
            >
              {label}
            </button>
          ))}
      </div>

      {selectedFacility && (
        <FacilityPanel
          facility={selectedFacility}
          baseUnits={visibleUnits
            .filter((u) => u.homeBase?.facilityId === selectedFacility.id)
            .map((u) => ({ id: u.id, name: u.name, runwayEnd: u.homeBase?.runwayEnd }))}
          onClose={() => setSelectedFacilityId(null)}
        />
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
        <span data-testid="map-attribution" className="text-sm truncate">
          {BASEMAP_CREDIT_TEXT}
          {hasFacilities ? `. ${FACILITY_ATTRIBUTION}` : ""}
        </span>
        {satelliteOn && (
          <span data-testid="map-satellite-credit" className="text-sm truncate">
            {SATELLITE_CREDIT_TEXT}
          </span>
        )}
        <span className="ml-auto">{scenario.name}</span>
      </div>
    </div>
  );
}
