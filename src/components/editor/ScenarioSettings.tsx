"use client";

import type { Scenario } from "@/types/game";

interface ScenarioSettingsProps {
  scenario: Scenario;
  onUpdate: (updates: Partial<Scenario>) => void;
  onClose: () => void;
}

export function ScenarioSettings({ scenario, onUpdate, onClose }: ScenarioSettingsProps) {
  return (
    <div className="absolute top-2 left-2 z-20 w-80 bg-[var(--color-tactical-panel)] border border-[var(--color-tactical-border)] rounded text-xs shadow-lg">
      <div className="flex justify-between items-center px-3 py-2 border-b border-[var(--color-tactical-border)]">
        <span className="text-[var(--color-terminal-green)] font-bold uppercase tracking-wider">
          Scenario Settings
        </span>
        <button
          onClick={onClose}
          className="text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] cursor-pointer"
        >
          [X]
        </button>
      </div>

      <div className="p-3 space-y-3">
        <Field
          label="Name"
          value={scenario.name}
          onChange={(v) => onUpdate({ name: v })}
        />

        <Field
          label="Description"
          value={scenario.description}
          onChange={(v) => onUpdate({ description: v })}
          multiline
        />

        <Field
          label="Briefing"
          value={scenario.briefing}
          onChange={(v) => onUpdate({ briefing: v })}
          multiline
        />

        <Field
          label="Start Time (ISO)"
          value={scenario.startTime}
          onChange={(v) => onUpdate({ startTime: v })}
        />

        <div>
          <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">
            Player Side
          </label>
          <select
            value={scenario.playerSide}
            onChange={(e) => onUpdate({ playerSide: e.target.value })}
            className="w-full bg-[var(--color-tactical-dark)] border border-[var(--color-tactical-border)] rounded px-2 py-1 text-[var(--color-tactical-text)] outline-none"
          >
            {scenario.sides.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Side names */}
        <div className="border-t border-[var(--color-tactical-border)] pt-2">
          <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider mb-2">
            Sides
          </div>
          {scenario.sides.map((side, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input
                type="color"
                value={side.color}
                onChange={(e) => {
                  const newSides = [...scenario.sides];
                  newSides[i] = { ...newSides[i], color: e.target.value };
                  onUpdate({ sides: newSides });
                }}
                className="w-6 h-6 rounded border-0 cursor-pointer"
              />
              <input
                type="text"
                value={side.name}
                onChange={(e) => {
                  const oldName = side.name;
                  const newName = e.target.value;
                  const newSides = [...scenario.sides];
                  newSides[i] = {
                    ...newSides[i],
                    name: newName,
                    units: newSides[i].units.map((u) => ({ ...u, side: newName })),
                  };
                  onUpdate({
                    sides: newSides,
                    playerSide: scenario.playerSide === oldName ? newName : scenario.playerSide,
                  });
                }}
                className="flex-1 bg-[var(--color-tactical-dark)] border border-[var(--color-tactical-border)] rounded px-2 py-1 text-[var(--color-tactical-text)] outline-none"
              />
              <label className="flex items-center gap-1 text-[var(--color-tactical-text-dim)]">
                <input
                  type="checkbox"
                  checked={side.isAI}
                  onChange={(e) => {
                    const newSides = [...scenario.sides];
                    newSides[i] = { ...newSides[i], isAI: e.target.checked };
                    onUpdate({ sides: newSides });
                  }}
                />
                AI
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const cls =
    "w-full bg-[var(--color-tactical-dark)] border border-[var(--color-tactical-border)] rounded px-2 py-1 text-[var(--color-tactical-text)] outline-none focus:border-[var(--color-terminal-green)]";

  return (
    <div>
      <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={cls + " resize-none"}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
        />
      )}
    </div>
  );
}
