"use client";

import { useState, useCallback } from "react";
import { MapWrapper } from "@/components/map/MapWrapper";
import { DetailPanel } from "@/components/map/DetailPanel";
import { TimeControls } from "@/components/game/TimeControls";
import { ContactList } from "@/components/game/ContactList";
import { OrderPanel } from "@/components/game/OrderPanel";
import { demoScenario } from "@/lib/scenarios/demo";
import { useSimulation } from "@/lib/simulation/useSimulation";

export default function PlayPage() {
  const {
    gameState,
    togglePause,
    setSpeed,
    addWaypoint,
    clearWaypoints,
    setThrottle,
    toggleRadar,
    resetSimulation,
  } = useSimulation(demoScenario);

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [pinnedRingIds, setPinnedRingIds] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isPlacingWaypoint, setIsPlacingWaypoint] = useState(false);

  // Build a live scenario view from game state
  const liveScenario = {
    ...demoScenario,
    sides: gameState.sides,
  };

  const allUnits = gameState.sides.flatMap((s) => s.units);
  const selectedUnit = selectedUnitId ? allUnits.find((u) => u.id === selectedUnitId) : null;
  const selectedOrders = selectedUnitId ? gameState.orders.get(selectedUnitId) : undefined;

  // Only show friendly units in the unit list
  const friendlyUnits = allUnits.filter((u) => u.side === gameState.scenario.playerSide);

  const handleUnitSelect = useCallback(
    (unitId: string | null, shiftKey?: boolean) => {
      if (unitId && shiftKey) {
        setPinnedRingIds((prev) => {
          const next = new Set(prev);
          next.has(unitId) ? next.delete(unitId) : next.add(unitId);
          return next;
        });
      }
      setSelectedUnitId(unitId);
      setIsPlacingWaypoint(false);
    },
    []
  );

  const handleMapClick = useCallback(
    (lngLat: { lng: number; lat: number }) => {
      if (isPlacingWaypoint && selectedUnitId) {
        addWaypoint(selectedUnitId, lngLat);
      }
    },
    [isPlacingWaypoint, selectedUnitId, addWaypoint]
  );

  return (
    <div className={`h-screen w-screen flex flex-col bg-[var(--color-tactical-dark)] ${theme === "light" ? "theme-light" : ""}`}>
      {/* Header with time controls */}
      <div className="h-10 flex items-center px-3 border-b border-[var(--color-tactical-border)] bg-[var(--color-tactical-panel)] shrink-0">
        <a
          href="/"
          className="text-[var(--color-terminal-green)] text-sm font-bold tracking-widest mr-4"
          style={{ fontFamily: "Rajdhani, sans-serif" }}
        >
          SANDKASTEN
        </a>

        <TimeControls
          simTime={gameState.simTime}
          isPaused={gameState.isPaused}
          speed={gameState.speed}
          onTogglePause={togglePause}
          onSetSpeed={setSpeed}
          onReset={resetSimulation}
        />

        <button
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          className="ml-auto text-[10px] text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] border border-[var(--color-tactical-border)] px-2 py-0.5 rounded cursor-pointer"
        >
          {theme === "dark" ? "LIGHT" : "DARK"}
        </button>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-56 bg-[var(--color-tactical-panel)] border-r border-[var(--color-tactical-border)] flex flex-col text-xs shrink-0 overflow-y-auto">
          {/* Friendly units */}
          <div className="p-2 border-b border-[var(--color-tactical-border)]">
            <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-2">
              Forces ({friendlyUnits.length})
            </div>
            {friendlyUnits.map((u) => (
              <button
                key={u.id}
                onClick={() => handleUnitSelect(u.id)}
                className={`w-full text-left px-2 py-1 rounded truncate cursor-pointer ${
                  selectedUnitId === u.id
                    ? "text-[var(--color-terminal-green)] bg-[var(--color-tactical-border)]"
                    : "text-[var(--color-tactical-text)] hover:bg-[var(--color-tactical-border)]"
                }`}
              >
                {u.name}
              </button>
            ))}
          </div>

          {/* Orders for selected unit */}
          {selectedUnit && selectedOrders && selectedUnit.side === gameState.scenario.playerSide && (
            <div className="p-2 border-b border-[var(--color-tactical-border)]">
              <OrderPanel
                unit={selectedUnit}
                orders={selectedOrders}
                isPlacingWaypoint={isPlacingWaypoint}
                onToggleWaypointMode={() => setIsPlacingWaypoint((p) => !p)}
                onClearWaypoints={() => clearWaypoints(selectedUnit.id)}
                onSetThrottle={(t) => setThrottle(selectedUnit.id, t)}
                onToggleRadar={() => toggleRadar(selectedUnit.id)}
              />
            </div>
          )}

          {/* Contact list */}
          <div className="p-2">
            <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-2">
              Contacts ({gameState.contacts.length})
            </div>
            <ContactList
              contacts={gameState.contacts}
              simTime={gameState.simTime}
            />
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapWrapper
            scenario={liveScenario}
            selectedUnitId={selectedUnitId}
            pinnedRingIds={pinnedRingIds}
            theme={theme}
            onUnitSelect={handleUnitSelect}
            contacts={gameState.contacts}
            orders={gameState.orders}
            fogOfWar={true}
            onMapClick={handleMapClick}
          />

          {selectedUnit && (
            <DetailPanel
              unit={selectedUnit}
              onClose={() => setSelectedUnitId(null)}
            />
          )}

          {/* Waypoint placement indicator */}
          {isPlacingWaypoint && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-[var(--color-terminal-green)] text-[var(--color-tactical-dark)] px-4 py-1 rounded text-xs font-bold">
              CLICK MAP TO PLACE WAYPOINT
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
