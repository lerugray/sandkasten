"use client";

import { useState, useCallback } from "react";
import { MapWrapper } from "@/components/map/MapWrapper";
import { DetailPanel } from "@/components/map/DetailPanel";
import { TimeControls } from "@/components/game/TimeControls";
import { ContactList } from "@/components/game/ContactList";
import { OrderPanel } from "@/components/game/OrderPanel";
import { MessageLog } from "@/components/game/MessageLog";
import { CombatLog } from "@/components/game/CombatLog";
import { demoScenarioConfig } from "@/lib/scenarios/demoConfig";
import { useSimulation } from "@/lib/simulation/useSimulation";

export default function PlayPage() {
  const {
    gameState,
    eventState,
    combatState,
    togglePause,
    setSpeed,
    addWaypoint,
    clearWaypoints,
    setThrottle,
    toggleRadar,
    markMessageRead,
    resetSimulation,
  } = useSimulation(demoScenarioConfig);

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [pinnedRingIds, setPinnedRingIds] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isPlacingWaypoint, setIsPlacingWaypoint] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"forces" | "messages" | "combat">("forces");

  const liveScenario = {
    ...demoScenarioConfig.scenario,
    sides: gameState.sides,
  };

  const allUnits = gameState.sides.flatMap((s) => s.units);
  const selectedUnit = selectedUnitId ? allUnits.find((u) => u.id === selectedUnitId) : null;
  const selectedOrders = selectedUnitId ? gameState.orders.get(selectedUnitId) : undefined;
  const friendlyUnits = allUnits.filter((u) => u.side === gameState.scenario.playerSide);

  const messages = eventState?.messages ?? [];
  const unreadCount = messages.filter((m) => !m.read).length;

  // Scenario result overlay
  const scenarioResult = eventState?.scenarioResult;

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

        {/* Score display */}
        <div className="ml-4 text-[10px] text-[var(--color-tactical-text-dim)]">
          {Object.entries(gameState.score).map(([side, score]) => (
            <span key={side} className="mr-3">
              {side}: <span className="text-[var(--color-tactical-text)]">{score}</span>
            </span>
          ))}
        </div>

        <button
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          className="ml-auto text-[10px] text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] border border-[var(--color-tactical-border)] px-2 py-0.5 rounded cursor-pointer"
        >
          {theme === "dark" ? "LIGHT" : "DARK"}
        </button>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar */}
        <div className="w-56 bg-[var(--color-tactical-panel)] border-r border-[var(--color-tactical-border)] flex flex-col text-xs shrink-0 overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-[var(--color-tactical-border)] shrink-0">
            <button
              onClick={() => setSidebarTab("forces")}
              className={`flex-1 py-1.5 text-[10px] uppercase tracking-wider cursor-pointer ${
                sidebarTab === "forces"
                  ? "text-[var(--color-terminal-green)] border-b border-[var(--color-terminal-green)]"
                  : "text-[var(--color-tactical-text-dim)]"
              }`}
            >
              Forces
            </button>
            <button
              onClick={() => setSidebarTab("messages")}
              className={`flex-1 py-1.5 text-[10px] uppercase tracking-wider cursor-pointer relative ${
                sidebarTab === "messages"
                  ? "text-[var(--color-terminal-amber)] border-b border-[var(--color-terminal-amber)]"
                  : "text-[var(--color-tactical-text-dim)]"
              }`}
            >
              Intel
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[var(--color-terminal-amber)] text-[var(--color-tactical-dark)] text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setSidebarTab("combat")}
              className={`flex-1 py-1.5 text-[10px] uppercase tracking-wider cursor-pointer relative ${
                sidebarTab === "combat"
                  ? "text-[var(--color-terminal-red)] border-b border-[var(--color-terminal-red)]"
                  : "text-[var(--color-tactical-text-dim)]"
              }`}
            >
              Combat
              {(combatState?.weaponsInFlight.length ?? 0) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[var(--color-terminal-red)] text-[var(--color-tactical-dark)] text-[8px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                  {combatState?.weaponsInFlight.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sidebarTab === "forces" && (
              <>
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
              </>
            )}

            {sidebarTab === "messages" && (
              <div className="p-2">
                <MessageLog
                  messages={messages}
                  simTime={gameState.simTime}
                  onMarkRead={markMessageRead}
                />
              </div>
            )}

            {sidebarTab === "combat" && (
              <div className="p-2">
                {(combatState?.weaponsInFlight.length ?? 0) > 0 && (
                  <div className="mb-2 pb-2 border-b border-[var(--color-tactical-border)]">
                    <div className="text-[var(--color-terminal-red)] text-[10px] uppercase tracking-wider mb-1">
                      Weapons in Flight ({combatState?.weaponsInFlight.length})
                    </div>
                    {combatState?.weaponsInFlight.map((w) => (
                      <div key={w.id} className="text-[10px] text-[var(--color-tactical-text)] mb-0.5">
                        <span className="text-[var(--color-terminal-amber)]">{">>"}</span>{" "}
                        {w.name} → {w.targetId.split("-").slice(0, 2).join("-")}
                      </div>
                    ))}
                  </div>
                )}
                <CombatLog
                  events={combatState?.combatLog ?? []}
                  simTime={gameState.simTime}
                  playerSide={gameState.scenario.playerSide}
                />
              </div>
            )}
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

          {/* Scenario result overlay */}
          {scenarioResult && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
              <div className="bg-[var(--color-tactical-panel)] border border-[var(--color-tactical-border)] rounded-lg p-8 max-w-md text-center">
                <div
                  className={`text-2xl font-bold tracking-widest mb-4 ${
                    scenarioResult.result === "victory"
                      ? "text-[var(--color-terminal-green)]"
                      : scenarioResult.result === "defeat"
                        ? "text-[var(--color-terminal-red)]"
                        : "text-[var(--color-terminal-amber)]"
                  }`}
                  style={{ fontFamily: "Rajdhani, sans-serif" }}
                >
                  {scenarioResult.result.toUpperCase()}
                </div>
                <p className="text-[var(--color-tactical-text)] text-sm mb-6">
                  {scenarioResult.message}
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={resetSimulation}
                    className="px-4 py-2 bg-[var(--color-terminal-green)] text-[var(--color-tactical-dark)] rounded text-xs font-bold tracking-wider cursor-pointer"
                  >
                    PLAY AGAIN
                  </button>
                  <a
                    href="/"
                    className="px-4 py-2 border border-[var(--color-tactical-border)] text-[var(--color-tactical-text)] rounded text-xs tracking-wider"
                  >
                    MAIN MENU
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
