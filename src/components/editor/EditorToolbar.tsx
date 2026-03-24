"use client";

import type { Scenario, Unit } from "@/types/game";

interface EditorToolbarProps {
  scenario: Scenario;
  activePanel: "none" | "place" | "settings";
  placingSide: string;
  onSetActivePanel: (panel: "none" | "place" | "settings") => void;
  onSetPlacingSide: (side: string) => void;
  selectedUnit?: Unit;
  onRemoveUnit: (unitId: string) => void;
}

export function EditorToolbar({
  scenario,
  activePanel,
  placingSide,
  onSetActivePanel,
  onSetPlacingSide,
  selectedUnit,
  onRemoveUnit,
}: EditorToolbarProps) {
  const unitCount = scenario.sides.reduce((n, s) => n + s.units.length, 0);

  return (
    <div className="w-48 bg-[var(--color-tactical-panel)] border-r border-[var(--color-tactical-border)] flex flex-col text-xs shrink-0">
      <div className="p-2 border-b border-[var(--color-tactical-border)]">
        <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-2">
          Tools
        </div>

        <button
          onClick={() => onSetActivePanel(activePanel === "place" ? "none" : "place")}
          className={`w-full text-left px-2 py-1.5 rounded mb-1 cursor-pointer ${
            activePanel === "place"
              ? "bg-[var(--color-terminal-green)] text-[var(--color-tactical-dark)]"
              : "hover:bg-[var(--color-tactical-border)]"
          }`}
        >
          + Place Unit
        </button>

        <button
          onClick={() => onSetActivePanel(activePanel === "settings" ? "none" : "settings")}
          className={`w-full text-left px-2 py-1.5 rounded mb-1 cursor-pointer ${
            activePanel === "settings"
              ? "bg-[var(--color-terminal-green)] text-[var(--color-tactical-dark)]"
              : "hover:bg-[var(--color-tactical-border)]"
          }`}
        >
          Scenario Settings
        </button>
      </div>

      {/* Side selector for placement */}
      {activePanel === "place" && (
        <div className="p-2 border-b border-[var(--color-tactical-border)]">
          <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-2">
            Placing For
          </div>
          {scenario.sides.map((side) => (
            <button
              key={side.name}
              onClick={() => onSetPlacingSide(side.name)}
              className={`w-full text-left px-2 py-1 rounded mb-1 cursor-pointer ${
                placingSide === side.name
                  ? "border border-current"
                  : "hover:bg-[var(--color-tactical-border)]"
              }`}
              style={{
                color: placingSide === side.name ? side.color : undefined,
              }}
            >
              {side.name}
            </button>
          ))}
        </div>
      )}

      {/* Sides / unit counts */}
      <div className="p-2 border-b border-[var(--color-tactical-border)]">
        <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-2">
          Forces ({unitCount})
        </div>
        {scenario.sides.map((side) => (
          <div key={side.name} className="mb-2">
            <div className="font-bold" style={{ color: side.color }}>
              {side.name} ({side.units.length})
            </div>
            <div className="ml-2 space-y-0.5">
              {side.units.map((u) => (
                <div
                  key={u.id}
                  className={`truncate cursor-pointer hover:text-[var(--color-tactical-text)] ${
                    selectedUnit?.id === u.id
                      ? "text-[var(--color-terminal-green)]"
                      : "text-[var(--color-tactical-text-dim)]"
                  }`}
                >
                  {u.name}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Selected unit actions */}
      {selectedUnit && (
        <div className="p-2 border-b border-[var(--color-tactical-border)]">
          <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-2">
            Selected
          </div>
          <div className="text-[var(--color-terminal-green)] mb-2 truncate">
            {selectedUnit.name}
          </div>
          <button
            onClick={() => onRemoveUnit(selectedUnit.id)}
            className="w-full text-left px-2 py-1 rounded text-[var(--color-terminal-red)] hover:bg-[var(--color-tactical-border)] cursor-pointer"
          >
            Delete Unit
          </button>
        </div>
      )}

      <div className="flex-1" />

      <div className="p-2 text-[var(--color-tactical-text-dim)] text-xs">
        Click map to place units.
        <br />
        Shift+click for range rings.
      </div>
    </div>
  );
}
