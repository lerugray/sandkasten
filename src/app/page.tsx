"use client";

import { useState } from "react";
import { MapWrapper } from "@/components/map/MapWrapper";
import { DetailPanel } from "@/components/map/DetailPanel";
import { demoScenario } from "@/lib/scenarios/demo";

export default function Home() {
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const allUnits = demoScenario.sides.flatMap((s) => s.units);
  const selectedUnit = selectedUnitId
    ? allUnits.find((u) => u.id === selectedUnitId)
    : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--color-tactical-dark)]">
      {/* Header */}
      <div className="h-8 flex items-center px-3 border-b border-[var(--color-tactical-border)] bg-[var(--color-tactical-panel)] shrink-0">
        <span
          className="text-[var(--color-terminal-green)] text-sm font-bold tracking-widest"
          style={{ fontFamily: "Rajdhani, sans-serif" }}
        >
          SANDKASTEN
        </span>
        <span className="text-[var(--color-tactical-text-dim)] text-xs ml-3">
          {demoScenario.name}
        </span>
        <span className="ml-auto text-[var(--color-tactical-text-dim)] text-xs">
          {new Date(demoScenario.startTime).toUTCString().slice(0, -4) + " Z"}
        </span>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapWrapper
          scenario={demoScenario}
          selectedUnitId={selectedUnitId}
          onUnitSelect={setSelectedUnitId}
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
