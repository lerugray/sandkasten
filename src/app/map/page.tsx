"use client";

import { useState, useCallback } from "react";
import { MapWrapper } from "@/components/map/MapWrapper";
import { DetailPanel } from "@/components/map/DetailPanel";
import { demoScenario } from "@/lib/scenarios/demo";
import { ClassicFonts } from "@/components/ClassicFonts";

// /map is the retired MapLibre home view, kept as a secondary comparison view. The title
// screen at "/" owns the wordmark, version and credits, so this page stays chrome-light:
// the map, its own toggles, and a light/dark theme switch. Nothing here links back to /map
// from the title; a visitor meets the title screen first, this is only a look at the map.
export default function MapPage() {
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

  const allUnits = demoScenario.sides.flatMap((s) => s.units);
  const selectedUnit = selectedUnitId
    ? allUnits.find((u) => u.id === selectedUnitId)
    : null;

  return (
    <div className={`h-screen w-screen flex flex-col bg-[var(--color-tactical-dark)] ${theme === "light" ? "theme-light" : ""}`}>
      <ClassicFonts />
      {/* Minimal strip: a label and the theme switch the map specs exercise. No wordmark, version or ABOUT. */}
      <div className="h-11 flex items-center px-4 border-b border-[var(--color-tactical-border)] bg-[var(--color-tactical-panel)] shrink-0">
        <span className="text-[var(--color-tactical-text-dim)] text-sm font-mono tracking-wider">
          MAP
        </span>
        <button
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          className="ml-auto text-sm text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] border border-[var(--color-tactical-border)] px-3 py-1.5 rounded cursor-pointer tracking-wider"
        >
          {theme === "dark" ? "LIGHT" : "DARK"}
        </button>
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
