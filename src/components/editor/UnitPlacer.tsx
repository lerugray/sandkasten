"use client";

import { useState, useEffect, useCallback } from "react";
import { getAllPlatforms } from "@/lib/platforms/lookup";
import type { Unit } from "@/types/game";
import type { PlatformInfo } from "@/lib/platforms/lookup";

interface UnitPlacerProps {
  side: string;
  onPlace: (unit: Unit) => void;
}

export function UnitPlacer({ side, onPlace }: UnitPlacerProps) {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformInfo | null>(null);
  const [filter, setFilter] = useState("");
  const [waitingForClick, setWaitingForClick] = useState(false);

  const platforms = getAllPlatforms();
  const filtered = filter
    ? platforms.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
    : platforms;

  const handleMapClick = useCallback(
    (e: MouseEvent) => {
      if (!selectedPlatform || !waitingForClick) return;

      // Get map container and calculate lng/lat from click
      const mapContainer = document.querySelector(".maplibregl-canvas");
      if (!mapContainer) return;
      const target = e.target as HTMLElement | null;
      if (!target || !mapContainer.contains(target)) return;

      // Use the maplibre map instance to convert pixel to lnglat
      const mapEl = mapContainer.closest(".maplibregl-map");
      if (!mapEl) return;

      // We need to access the map — find it via the canvas event
      const rect = mapContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Access map via global — not ideal but works for the editor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = (mapEl as any).__maplibreMap;
      if (!map) return;

      const lngLat = map.unproject([x, y]);

      const unit: Unit = {
        id: `${side.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`,
        name: selectedPlatform.name.split("[")[0].trim(),
        platformId: selectedPlatform.id,
        side,
        position: { lng: lngLat.lng, lat: lngLat.lat },
        heading: 0,
        speed: 0,
        damageState: "undamaged",
      };

      onPlace(unit);
      setWaitingForClick(false);
    },
    [selectedPlatform, waitingForClick, side, onPlace]
  );

  useEffect(() => {
    if (waitingForClick) {
      document.addEventListener("click", handleMapClick);
      return () => document.removeEventListener("click", handleMapClick);
    }
  }, [waitingForClick, handleMapClick]);

  return (
    <div
      data-testid="unit-placer"
      className="absolute top-2 left-2 z-20 w-72 bg-[var(--color-tactical-panel)] border border-[var(--color-tactical-border)] rounded text-xs shadow-lg"
    >
      <div className="p-2 border-b border-[var(--color-tactical-border)]">
        <div className="text-[var(--color-terminal-green)] font-bold uppercase tracking-wider mb-2">
          Place Unit — {side}
        </div>
        <input
          type="text"
          placeholder="Search platforms..."
          data-testid="unit-placer-search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-[var(--color-tactical-dark)] border border-[var(--color-tactical-border)] rounded px-2 py-1 text-[var(--color-tactical-text)] placeholder:text-[var(--color-tactical-text-dim)] outline-none focus:border-[var(--color-terminal-green)]"
        />
      </div>

      <div className="max-h-60 overflow-y-auto">
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setSelectedPlatform(p);
              setWaitingForClick(true);
            }}
            data-testid="unit-placer-platform"
            data-platform-id={p.id}
            className={`w-full text-left px-3 py-1.5 hover:bg-[var(--color-tactical-border)] cursor-pointer truncate ${
              selectedPlatform?.id === p.id
                ? "text-[var(--color-terminal-green)] bg-[var(--color-tactical-border)]"
                : ""
            }`}
          >
            <span className="text-[var(--color-tactical-text-dim)] mr-1">
              {p.dimension === "sea" ? "S" : p.dimension === "air" ? "A" : "G"}
            </span>
            {p.name}
          </button>
        ))}
      </div>

      {waitingForClick && selectedPlatform && (
        <div
          data-testid="unit-placer-waiting"
          className="p-2 border-t border-[var(--color-tactical-border)] text-[var(--color-terminal-amber)]"
        >
          Click the map to place {selectedPlatform.name.split("[")[0].trim()}
        </div>
      )}
    </div>
  );
}
