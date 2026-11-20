"use client";

import { useState } from "react";
import type { Scenario, VictoryCondition, VictoryConditionKind, VictoryResult } from "@/types/game";
import { VICTORY_KINDS, VICTORY_KIND_LABEL, describeVictoryCondition } from "@/lib/scenarios/victoryConditions";

interface VictoryConditionsPanelProps {
  scenario: Scenario;
  onUpdate: (conditions: VictoryCondition[]) => void;
  onClose: () => void;
}

const inputCls =
  "w-full bg-[var(--color-tactical-dark)] border border-[var(--color-tactical-border)] rounded px-2 py-1 text-[var(--color-tactical-text)] outline-none focus:border-[var(--color-terminal-green)]";

const RESULT_WORD: Record<VictoryResult, string> = { victory: "VICTORY", defeat: "DEFEAT", draw: "DRAW" };
const RESULT_CLASS: Record<VictoryResult, string> = {
  victory: "text-[var(--color-status-green)]",
  defeat: "text-[var(--color-terminal-red)]",
  draw: "text-[var(--color-terminal-amber)]",
};

const allUnits = (scenario: Scenario) => scenario.sides.flatMap((s) => s.units);
const areas = (scenario: Scenario) => scenario.referencePoints.filter((r) => r.type === "area");

function firstPlayerUnitId(scenario: Scenario): string | undefined {
  return allUnits(scenario).find((u) => u.side === scenario.playerSide)?.id;
}
function firstHostileUnitId(scenario: Scenario): string | undefined {
  return allUnits(scenario).find((u) => u.side !== scenario.playerSide)?.id;
}
function firstHostileSide(scenario: Scenario): string | undefined {
  return scenario.sides.find((s) => s.name !== scenario.playerSide)?.name;
}

function defaults(kind: VictoryConditionKind, scenario: Scenario): Omit<VictoryCondition, "id"> {
  switch (kind) {
    case "destroy-unit":
      return { kind, result: "victory", message: "Target destroyed.", unitId: firstHostileUnitId(scenario) };
    case "destroy-side":
      return { kind, result: "victory", message: "The enemy side has been struck.", side: firstHostileSide(scenario) };
    case "protect-unit":
      return { kind, result: "defeat", message: "A unit that had to survive was destroyed.", unitId: firstPlayerUnitId(scenario) };
    case "reach-area":
      return { kind, result: "victory", message: "The unit reached the area.", side: scenario.playerSide, areaId: areas(scenario)[0]?.id };
    case "hold-area":
      return { kind, result: "victory", message: "The area was not held.", side: scenario.playerSide, areaId: areas(scenario)[0]?.id, count: 1, minutes: 60 };
    case "time-limit":
      return { kind, result: "defeat", message: "The mission clock ran out.", minutes: 60 };
    case "score":
      return { kind, result: "victory", message: "Score threshold reached.", side: scenario.playerSide, threshold: 100, comparison: "gte" };
  }
}

function newId(): string {
  return `vc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function VictoryConditionsPanel({ scenario, onUpdate, onClose }: VictoryConditionsPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const conditions = scenario.victoryConditions ?? [];
  const editing = conditions.find((c) => c.id === editingId) ?? null;

  const add = () => {
    const kind: VictoryConditionKind = "time-limit";
    const c: VictoryCondition = { id: newId(), ...defaults(kind, scenario) };
    onUpdate([...conditions, c]);
    setEditingId(c.id);
  };

  const patch = (id: string, change: Partial<VictoryCondition>) => {
    onUpdate(conditions.map((c) => (c.id === id ? { ...c, ...change } : c)));
  };

  const remove = (id: string) => {
    onUpdate(conditions.filter((c) => c.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const changeKind = (id: string, kind: VictoryConditionKind) => {
    const base = defaults(kind, scenario);
    patch(id, { kind, result: base.result, message: base.message, unitId: base.unitId, side: base.side, areaId: base.areaId, count: base.count, minutes: base.minutes, threshold: base.threshold, comparison: base.comparison });
  };

  return (
    <div
      data-testid="victory-conditions-panel"
      className="absolute top-2 left-2 z-20 w-96 bg-[var(--color-tactical-panel)] border border-[var(--color-tactical-border)] rounded text-xs shadow-lg"
    >
      <div className="flex justify-between items-center px-3 py-2 border-b border-[var(--color-tactical-border)]">
        <span className="text-[var(--color-terminal-green)] font-bold uppercase tracking-wider">
          Victory Conditions
        </span>
        <button
          onClick={onClose}
          className="text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] cursor-pointer"
        >
          [X]
        </button>
      </div>

      <div className="p-3 space-y-3">
        <button
          onClick={add}
          data-testid="victory-add"
          className="w-full px-2 py-1 rounded border border-[var(--color-tactical-border)] text-[var(--color-tactical-text)] hover:border-[var(--color-terminal-green)] cursor-pointer"
        >
          + Add condition
        </button>

        {conditions.length === 0 && (
          <div className="text-[var(--color-tactical-text-dim)]">
            No victory conditions yet. Add one or more; the first met ends the run, and a defeat outranks a draw and a victory.
          </div>
        )}

        <div className="max-h-56 overflow-y-auto space-y-1">
          {conditions.map((c) => {
            const texts = describeVictoryCondition(scenario, c);
            return (
              <div
                key={c.id}
                data-testid="victory-row"
                className={`px-2 py-1 rounded cursor-pointer ${editingId === c.id ? "bg-[var(--color-tactical-border)]" : "hover:bg-[var(--color-tactical-border)]"}`}
                onClick={() => setEditingId(c.id)}
              >
                <div className="flex items-start gap-2">
                  <span className="flex-1">
                    {texts.map((t, i) => (
                      <div key={i} className="text-[var(--color-tactical-text)]">
                        <b className={RESULT_CLASS[t.result]}>{RESULT_WORD[t.result]}</b> {t.text}
                      </div>
                    ))}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(c.id);
                    }}
                    data-testid="victory-delete"
                    className="text-[var(--color-terminal-red)] px-1 cursor-pointer"
                    aria-label="Delete condition"
                  >
                    ✕
                  </button>
                </div>
                <div className="text-[var(--color-tactical-text-dim)]">{VICTORY_KIND_LABEL[c.kind]}</div>
              </div>
            );
          })}
        </div>

        {editing && (
          <div data-testid="victory-editor" className="border-t border-[var(--color-tactical-border)] pt-2 space-y-2">
            <div>
              <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">Condition</label>
              <select value={editing.kind} data-testid="victory-kind" onChange={(e) => changeKind(editing.id, e.target.value as VictoryConditionKind)} className={inputCls}>
                {VICTORY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {VICTORY_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>

            {editing.kind !== "hold-area" && editing.kind !== "protect-unit" && (
              <div>
                <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">Result</label>
                <select value={editing.result} data-testid="victory-result" onChange={(e) => patch(editing.id, { result: e.target.value as VictoryResult })} className={inputCls}>
                  <option value="victory">Victory</option>
                  <option value="defeat">Defeat</option>
                  <option value="draw">Draw</option>
                </select>
              </div>
            )}

            {(editing.kind === "destroy-side" || editing.kind === "reach-area" || editing.kind === "hold-area" || editing.kind === "score") && (
              <div>
                <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">Side</label>
                <select value={editing.side ?? scenario.playerSide} data-testid="victory-side" onChange={(e) => patch(editing.id, { side: e.target.value || undefined })} className={inputCls}>
                  {scenario.sides.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(editing.kind === "destroy-unit" || editing.kind === "protect-unit" || editing.kind === "reach-area") && (
              <div>
                <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">Unit</label>
                <select
                  value={editing.unitId ?? ""}
                  data-testid="victory-unit"
                  onChange={(e) => patch(editing.id, { unitId: e.target.value || undefined })}
                  className={inputCls}
                >
                  {editing.kind === "reach-area" && <option value="">Any unit of this side</option>}
                  {scenario.sides.map((s) => (
                    <optgroup key={s.name} label={s.name}>
                      {s.units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            )}

            {(editing.kind === "reach-area" || editing.kind === "hold-area") && (
              <div>
                <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">Reference area</label>
                <select value={editing.areaId ?? ""} data-testid="victory-area" onChange={(e) => patch(editing.id, { areaId: e.target.value || undefined })} className={inputCls}>
                  {areas(scenario).length === 0 && <option value="">No areas yet — add one first</option>}
                  {areas(scenario).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(editing.kind === "time-limit" || editing.kind === "hold-area") && (
              <div>
                <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">Minutes after start</label>
                <input
                  type="number"
                  min={0}
                  value={editing.minutes ?? 0}
                  data-testid="victory-minutes"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    patch(editing.id, { minutes: Number.isFinite(n) ? Math.max(0, n) : 0 });
                  }}
                  className={inputCls}
                />
              </div>
            )}

            {editing.kind === "hold-area" && (
              <div>
                <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">Minimum units afloat</label>
                <input
                  type="number"
                  min={1}
                  value={editing.count ?? 1}
                  data-testid="victory-count"
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    patch(editing.id, { count: Number.isFinite(n) && Number.isInteger(n) ? Math.max(1, n) : 1 });
                  }}
                  className={inputCls}
                />
              </div>
            )}

            {editing.kind === "score" && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">Threshold</label>
                  <input
                    type="number"
                    value={editing.threshold ?? 0}
                    data-testid="victory-threshold"
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      patch(editing.id, { threshold: Number.isFinite(n) ? n : 0 });
                    }}
                    className={inputCls}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">When</label>
                  <select value={editing.comparison ?? "gte"} data-testid="victory-comparison" onChange={(e) => patch(editing.id, { comparison: e.target.value as "gte" | "lte" })} className={inputCls}>
                    <option value="gte">At least</option>
                    <option value="lte">At most</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">Result message</label>
              <textarea
                value={editing.message}
                data-testid="victory-message"
                onChange={(e) => patch(editing.id, { message: e.target.value })}
                rows={2}
                className={inputCls + " resize-none"}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
