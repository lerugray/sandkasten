"use client";

import { useState, useCallback } from "react";
import { MapWrapper } from "@/components/map/MapWrapper";
import { DetailPanel } from "@/components/map/DetailPanel";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { UnitPlacer } from "@/components/editor/UnitPlacer";
import { ScenarioSettings } from "@/components/editor/ScenarioSettings";
import type { Scenario, Unit, Side, Position } from "@/types/game";

const DEFAULT_SCENARIO: Scenario = {
  name: "New Scenario",
  description: "",
  briefing: "",
  theater: {
    center: { lng: 56.5, lat: 26.5 },
    zoom: 7,
  },
  startTime: new Date().toISOString(),
  playerSide: "Side A",
  sides: [
    { name: "Side A", color: "#00aaff", isAI: false, units: [] },
    { name: "Side B", color: "#ff4444", isAI: true, units: [] },
  ],
  referencePoints: [],
};

export default function EditorPage() {
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [pinnedRingIds, setPinnedRingIds] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activePanel, setActivePanel] = useState<"none" | "place" | "settings">("none");
  const [placingSide, setPlacingSide] = useState<string>("Side A");

  const allUnits = scenario.sides.flatMap((s) => s.units);
  const selectedUnit = selectedUnitId ? allUnits.find((u) => u.id === selectedUnitId) : null;

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
    },
    []
  );

  const addUnit = useCallback(
    (unit: Unit) => {
      setScenario((prev) => ({
        ...prev,
        sides: prev.sides.map((side) =>
          side.name === unit.side
            ? { ...side, units: [...side.units, unit] }
            : side
        ),
      }));
    },
    []
  );

  const removeUnit = useCallback(
    (unitId: string) => {
      setScenario((prev) => ({
        ...prev,
        sides: prev.sides.map((side) => ({
          ...side,
          units: side.units.filter((u) => u.id !== unitId),
        })),
      }));
      setSelectedUnitId(null);
    },
    []
  );

  const updateScenarioMeta = useCallback(
    (updates: Partial<Scenario>) => {
      setScenario((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const saveScenario = useCallback(() => {
    const json = JSON.stringify(scenario, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${scenario.name.replace(/\s+/g, "_").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [scenario]);

  const loadScenario = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const loaded = JSON.parse(reader.result as string) as Scenario;
          setScenario(loaded);
          setSelectedUnitId(null);
          setPinnedRingIds(new Set());
        } catch {
          alert("Invalid scenario file");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  return (
    <div className={`h-screen w-screen flex flex-col bg-[var(--color-tactical-dark)] ${theme === "light" ? "theme-light" : ""}`}>
      {/* Header */}
      <div className="h-8 flex items-center px-3 border-b border-[var(--color-tactical-border)] bg-[var(--color-tactical-panel)] shrink-0">
        <a
          href="/"
          className="text-[var(--color-terminal-green)] text-sm font-bold tracking-widest mr-3 hover:underline"
          style={{ fontFamily: "Rajdhani, sans-serif" }}
        >
          SANDKASTEN
        </a>
        <span className="text-[var(--color-terminal-amber)] text-xs font-bold tracking-wider">
          EDITOR
        </span>
        <span className="text-[var(--color-tactical-text-dim)] text-xs ml-3">
          {scenario.name}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={loadScenario}
            className="text-[10px] text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] border border-[var(--color-tactical-border)] px-2 py-0.5 rounded cursor-pointer"
          >
            LOAD
          </button>
          <button
            onClick={saveScenario}
            className="text-[10px] text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] border border-[var(--color-tactical-border)] px-2 py-0.5 rounded cursor-pointer"
          >
            SAVE
          </button>
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="text-[10px] text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] border border-[var(--color-tactical-border)] px-2 py-0.5 rounded cursor-pointer"
          >
            {theme === "dark" ? "LIGHT" : "DARK"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Editor sidebar */}
        <EditorToolbar
          scenario={scenario}
          activePanel={activePanel}
          placingSide={placingSide}
          onSetActivePanel={setActivePanel}
          onSetPlacingSide={setPlacingSide}
          selectedUnit={selectedUnit ?? undefined}
          onRemoveUnit={removeUnit}
        />

        {/* Map area */}
        <div className="flex-1 relative">
          <MapWrapper
            scenario={scenario}
            selectedUnitId={selectedUnitId}
            pinnedRingIds={pinnedRingIds}
            theme={theme}
            onUnitSelect={handleUnitSelect}
          />

          {activePanel === "place" && (
            <UnitPlacer
              side={placingSide}
              onPlace={addUnit}
            />
          )}

          {activePanel === "settings" && (
            <ScenarioSettings
              scenario={scenario}
              onUpdate={updateScenarioMeta}
              onClose={() => setActivePanel("none")}
            />
          )}

          {selectedUnit && activePanel === "none" && (
            <DetailPanel
              unit={selectedUnit}
              onClose={() => setSelectedUnitId(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
