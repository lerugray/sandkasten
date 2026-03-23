"use client";

import { getPlatform } from "@/lib/platforms/lookup";
import type { Unit } from "@/types/game";

interface DetailPanelProps {
  unit: Unit;
  onClose: () => void;
}

export function DetailPanel({ unit, onClose }: DetailPanelProps) {
  const platform = getPlatform(unit.platformId);

  return (
    <div className="absolute bottom-8 left-2 z-20 w-80 bg-[var(--color-tactical-panel)] border border-[var(--color-tactical-border)] rounded text-xs p-3 shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="text-[var(--color-terminal-green)] font-bold text-sm uppercase tracking-wider">
          {unit.name}
        </span>
        <button
          onClick={onClose}
          className="text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] cursor-pointer"
        >
          [X]
        </button>
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <span className="text-[var(--color-tactical-text-dim)]">CLASS</span>
        <span>{platform?.name ?? `Platform #${unit.platformId}`}</span>

        <span className="text-[var(--color-tactical-text-dim)]">SIDE</span>
        <span>{unit.side}</span>

        <span className="text-[var(--color-tactical-text-dim)]">POS</span>
        <span>
          {unit.position.lat.toFixed(4)}N {unit.position.lng.toFixed(4)}E
        </span>

        <span className="text-[var(--color-tactical-text-dim)]">HDG</span>
        <span>{unit.heading.toFixed(0)}&deg;</span>

        <span className="text-[var(--color-tactical-text-dim)]">SPD</span>
        <span>{unit.speed} kts</span>

        {unit.altitude !== undefined && (
          <>
            <span className="text-[var(--color-tactical-text-dim)]">ALT</span>
            <span>{unit.altitude.toLocaleString()} ft</span>
          </>
        )}

        <span className="text-[var(--color-tactical-text-dim)]">STATUS</span>
        <span
          className={
            unit.damageState === "undamaged"
              ? "text-[var(--color-terminal-green)]"
              : unit.damageState === "damaged"
              ? "text-[var(--color-terminal-amber)]"
              : "text-[var(--color-terminal-red)]"
          }
        >
          {unit.damageState.toUpperCase()}
        </span>

        {platform?.sensorRangeKm && (
          <>
            <span className="text-[var(--color-tactical-text-dim)]">SENSOR</span>
            <span>{platform.sensorRangeKm} km</span>
          </>
        )}

        {platform?.weaponRangeKm && (
          <>
            <span className="text-[var(--color-tactical-text-dim)]">WEAPON</span>
            <span>{platform.weaponRangeKm} km</span>
          </>
        )}

        {unit.mission && (
          <>
            <span className="text-[var(--color-tactical-text-dim)]">MISSION</span>
            <span>{unit.mission}</span>
          </>
        )}
      </div>
    </div>
  );
}
