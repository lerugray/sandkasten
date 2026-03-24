"use client";

import { useState, useCallback } from "react";
import { MapWrapper } from "@/components/map/MapWrapper";
import { DetailPanel } from "@/components/map/DetailPanel";
import { demoScenario } from "@/lib/scenarios/demo";

export default function Home() {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [pinnedRingIds, setPinnedRingIds] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const handleUnitSelect = useCallback(
    (unitId: string | null, shiftKey?: boolean) => {
      if (unitId && shiftKey) {
        setPinnedRingIds((prev) => {
          const next = new Set(prev);
          if (next.has(unitId)) {
            next.delete(unitId);
          } else {
            next.add(unitId);
          }
          return next;
        });
      }
      setSelectedUnitId(unitId);
    },
    []
  );

  const clearPinnedRings = useCallback(() => {
    setPinnedRingIds(new Set());
  }, []);

  const allUnits = demoScenario.sides.flatMap((s) => s.units);
  const selectedUnit = selectedUnitId
    ? allUnits.find((u) => u.id === selectedUnitId)
    : null;

  return (
    <div className={`h-screen w-screen flex flex-col bg-[var(--color-tactical-dark)] ${theme === "light" ? "theme-light" : ""}`}>
      {/* Header */}
      <div className="h-14 flex items-center px-5 border-b border-[var(--color-tactical-border)] bg-[var(--color-tactical-panel)] shrink-0">
        <span
          className="text-[var(--color-terminal-green)] text-lg font-bold tracking-widest mr-8"
          style={{ fontFamily: "Rajdhani, sans-serif" }}
        >
          SANDKASTEN
        </span>
        <span className="text-[var(--color-tactical-text-dim)] text-base">
          {demoScenario.name}
        </span>
        {pinnedRingIds.size > 0 && (
          <button
            onClick={clearPinnedRings}
            className="ml-4 text-sm text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] border border-[var(--color-tactical-border)] px-3 py-1.5 rounded cursor-pointer"
          >
            CLEAR RINGS ({pinnedRingIds.size})
          </button>
        )}
        <a
          href="/play"
          className="ml-auto mr-4 text-sm text-[var(--color-tactical-dark)] bg-[var(--color-terminal-green)] hover:brightness-110 px-4 py-1.5 rounded font-bold tracking-wider"
        >
          PLAY
        </a>
        <a
          href="/editor"
          className="mr-4 text-sm text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] border border-[var(--color-tactical-border)] px-3 py-1.5 rounded"
        >
          EDITOR
        </a>
        <button
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          className="mr-4 text-sm text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] border border-[var(--color-tactical-border)] px-3 py-1.5 rounded cursor-pointer tracking-wider"
        >
          {theme === "dark" ? "LIGHT" : "DARK"}
        </button>
        <span className="text-[var(--color-tactical-text-dim)] text-base font-mono">
          {new Date(demoScenario.startTime).toUTCString().slice(0, -4) + " Z"}
        </span>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapWrapper
          scenario={demoScenario}
          selectedUnitId={selectedUnitId}
          pinnedRingIds={pinnedRingIds}
          theme={theme}
          onUnitSelect={handleUnitSelect}
        />

        {selectedUnit && (
          <DetailPanel
            unit={selectedUnit}
            onClose={() => setSelectedUnitId(null)}
          />
        )}
      </div>
    </div>
  );
}
