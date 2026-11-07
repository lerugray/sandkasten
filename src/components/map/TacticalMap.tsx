"use client";

import { useRef, useEffect, useMemo, useState } from "react";
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
import { OsintLayer } from "./OsintLayer";
import { OsintPanel } from "./OsintPanel";
import { OSINT_LAYERS, OSINT_LAYERS_ON, sitesFor } from "@/lib/osint/sites";
import { OSINT_ATTRIBUTION, type OsintLayerState } from "@/lib/osint/sites";
import { FACILITY_ATTRIBUTION, getFacility } from "@/lib/facilities/facilities";
import type { Scenario } from "@/types/game";
import type { Contact, UnitOrders } from "@/lib/simulation/gameState";
import { UnitLayer } from "./UnitLayer";
import { LayoutController } from "./LayoutController";
import type { MapLayout } from "@/lib/map/mapLayout";
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
  const attribSlotRef = useRef<HTMLDivElement>(null);
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
  const [osintLayers, setOsintLayers] = useState<OsintLayerState>(OSINT_LAYERS_ON);
  const [selectedOsintId, setSelectedOsintId] = useState<string | null>(null);
  const [layout, setLayout] = useState<MapLayout | null>(null);
  const hasFacilities = !!scenario.facilities?.length;
  const hasOsint = !!scenario.osint?.length;
  const hasOsintRef = useRef(hasOsint);
  hasOsintRef.current = hasOsint;
  const osintVisible = useMemo(() => sitesFor(osintLayers, scenario.osint ?? []), [osintLayers, scenario.osint]);
  const osintVisibleRef = useRef(osintVisible);
  osintVisibleRef.current = osintVisible;
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

    // The zoom buttons and the collapsed attribution icon live in the toolbar strip above the map (not over it): no
    // marker, label or symbol can sit under them. The full credit line is always shown in the status bar below.
    const attrib = new maplibregl.AttributionControl({ compact: true });
    const attribEl = attrib.onAdd(map);
    attribSlotRef.current?.appendChild(attribEl);
    const closeAttrib = () => {
      attribEl.classList.remove("maplibregl-compact-show");
      attribEl.removeAttribute("open");
    };
    closeAttrib();
    map.once("load", closeAttrib);

    // Exposed at construction: the editor placer reads it, and `load` waits on the remote tiles.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map.getContainer() as any).__maplibreMap = map;

    map.on("load", () => {
      setMapReady(true);
      setZoom(map.getZoom());
      onMapReadyRef.current?.();
    });

    map.on("zoom", () => setZoom(map.getZoom()));
    map.on("mousemove", (e) => setCursorPos({ lat: e.lngLat.lat, lng: e.lngLat.lng }));

    map.on("click", (e) => {
      const target = e.originalEvent.target as HTMLElement;
      if (target.closest(".unit-marker") || target.closest(".contact-marker") || target.closest(".osint-marker")) return;
      const handled =
        onMapClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat }) === true;
      if (handled) return;
      onUnitSelectRef.current(null);
      setSelectedOsintId(null);
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
    (window as unknown as { __sandMap?: maplibregl.Map }).__sandMap = map;

    return () => {
      attrib.onRemove();
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
    if (selectedUnitId) {
      setSelectedFacilityId(null);
      setSelectedOsintId(null);
    }
  }, [selectedUnitId]);

  const selectedOsint = selectedOsintId ? osintVisible.find((s) => s.id === selectedOsintId) : undefined;

  const selectedFacility = selectedFacilityId
    ? getFacility(selectedFacilityId, scenario.facilities)
    : undefined;

  // In fog of war mode, only show friendly units directly
  const allUnits = scenario.sides.flatMap((s) => s.units);
  const visibleUnits = fogOfWar
    ? allUnits.filter((u) => u.side === scenario.playerSide)
    : allUnits;

  // Unit symbols are DOM markers the map canvas cannot see: its text keeps off the spots the layout drew them at.
  const obstaclePositions = useMemo<[number, number][]>(
    () =>
      layout
        ? layout.unitObstacles
        : visibleUnits
            .filter((u) => u.damageState !== "destroyed")
            .map((u) => [Math.round(u.position.lng * 200) / 200, Math.round(u.position.lat * 200) / 200] as [number, number]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layout, fogOfWar, scenario],
  );

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Toolbar strip: map look toggles on the left, zoom and credit icon on the right. Nothing here covers the map. */}
      <div
        data-testid="map-controls"
        className="shrink-0 h-11 flex items-center gap-1 px-2 text-sm tracking-wider bg-[var(--color-tactical-panel)] border-b border-[var(--color-tactical-border)] z-10"
      >
        {([
          ["facilities", "FACILITIES", showFacilities, setShowFacilities, hasFacilities],
          ...OSINT_LAYERS.map(
            (l) => [`osint-${l.id}`, l.short, osintLayers[l.id], (v: boolean) => setOsintLayers((p) => ({ ...p, [l.id]: v })), hasOsint] as const,
          ),
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
        <div className="ml-auto flex items-center gap-1">
          {(
            [
              ["zoom-in", "+", "Zoom in", () => mapRef.current?.zoomIn()],
              ["zoom-out", "\u2212", "Zoom out", () => mapRef.current?.zoomOut()],
            ] as const
          ).map(([key, glyph, aria, fn]) => (
            <button
              key={key}
              type="button"
              data-testid={`map-${key}`}
              aria-label={aria}
              onClick={fn}
              className="w-8 py-0.5 rounded border cursor-pointer text-base leading-6 bg-[var(--color-tactical-panel)] border-[var(--color-tactical-border)] text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)]"
            >
              {glyph}
            </button>
          ))}
          <div ref={attribSlotRef} className="map-attrib-slot relative" />
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0">
          <div ref={containerRef} className="w-full h-full" />
        </div>
      </div>

      {mapReady && mapRef.current && (
        <>
          {hasFacilities && (
            <FacilityLayer
              map={mapRef.current}
              facilities={scenario.facilities!}
              visible={showFacilities}
              selectedId={selectedFacilityId}
              unitPositions={obstaclePositions}
            />
          )}
          <LayoutController map={mapRef.current} units={visibleUnits} playerSide={scenario.playerSide} sites={hasOsint ? osintVisible : []} onLayout={setLayout} />
          {hasOsint && (
            <OsintLayer
              map={mapRef.current}
              sites={osintVisible}
              selectedId={selectedOsint ? selectedOsintId : null}
              onSelect={(id) => {
                setSelectedOsintId(id);
                setSelectedFacilityId(null);
              }}
              unitPositions={obstaclePositions}
              layout={layout}
            />
          )}
          <UnitLayer
            map={mapRef.current}
            units={visibleUnits}
            playerSide={scenario.playerSide}
            selectedUnitId={selectedUnitId}
            onUnitSelect={onUnitSelect}
            onUnitDrag={onUnitDrag}
            layout={layout}
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

      {selectedOsint && <OsintPanel site={selectedOsint} onClose={() => setSelectedOsintId(null)} />}

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
      <div data-testid="map-statusbar" className="shrink-0 bg-[var(--color-tactical-panel)] border-t border-[var(--color-tactical-border)] text-[var(--color-tactical-text-dim)] z-10">
        <div className="h-9 flex items-center px-4 text-base gap-6 whitespace-nowrap">
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
        <div className="px-4 pb-1 text-[13px] leading-5 text-[#cbd5e1] flex flex-wrap gap-x-6">
          <span data-testid="map-attribution">
            {BASEMAP_CREDIT_TEXT}
            {hasFacilities ? `. ${FACILITY_ATTRIBUTION}` : ""}
            {hasOsint ? `. ${OSINT_ATTRIBUTION}` : ""}
          </span>
          {satelliteOn && <span data-testid="map-satellite-credit">{SATELLITE_CREDIT_TEXT}</span>}
        </div>
      </div>
    </div>
  );
}
