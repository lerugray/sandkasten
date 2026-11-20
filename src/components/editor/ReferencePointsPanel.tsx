"use client";

import { useState } from "react";
import type { ReferencePoint, Scenario } from "@/types/game";

export type RefPlaceMode = { kind: "point" | "area"; refId: string };

interface ReferencePointsPanelProps {
  scenario: Scenario;
  placing: RefPlaceMode | null;
  onUpdate: (points: ReferencePoint[]) => void;
  onArmPlace: (kind: "point" | "area", refId: string) => void;
  onFinishArea: () => void;
  onClose: () => void;
}

const inputCls =
  "w-full bg-[var(--color-tactical-dark)] border border-[var(--color-tactical-border)] rounded px-2 py-1 text-[var(--color-tactical-text)] outline-none focus:border-[var(--color-terminal-green)]";

function nextName(points: ReferencePoint[], kind: "point" | "area"): string {
  const label = kind === "point" ? "Point" : "Area";
  let n = points.length + 1;
  while (points.some((p) => p.name === `${label} ${n}`)) n += 1;
  return `${label} ${n}`;
}

function newId(): string {
  return `rp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ReferencePointsPanel({ scenario, placing, onUpdate, onArmPlace, onFinishArea, onClose }: ReferencePointsPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const points = scenario.referencePoints;
  const selected = points.find((p) => p.id === selectedId) ?? null;

  const create = (kind: "point" | "area") => {
    const rp: ReferencePoint = {
      id: newId(),
      name: nextName(points, kind),
      type: kind,
      side: scenario.playerSide,
      points: [],
    };
    onUpdate([...points, rp]);
    setSelectedId(rp.id);
    onArmPlace(kind, rp.id);
  };

  const patch = (id: string, change: Partial<ReferencePoint>) => {
    onUpdate(points.map((p) => (p.id === id ? { ...p, ...change } : p)));
  };

  const remove = (id: string) => {
    onUpdate(points.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div
      data-testid="reference-points-panel"
      className="absolute top-2 left-2 z-20 w-80 bg-[var(--color-tactical-panel)] border border-[var(--color-tactical-border)] rounded text-xs shadow-lg"
    >
      <div className="flex justify-between items-center px-3 py-2 border-b border-[var(--color-tactical-border)]">
        <span className="text-[var(--color-terminal-green)] font-bold uppercase tracking-wider">
          Reference Points
        </span>
        <button
          onClick={onClose}
          className="text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] cursor-pointer"
        >
          [X]
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => create("point")}
            data-testid="refpoint-new-point"
            className="flex-1 px-2 py-1 rounded border border-[var(--color-tactical-border)] text-[var(--color-tactical-text)] hover:border-[var(--color-terminal-green)] cursor-pointer"
          >
            + Point
          </button>
          <button
            onClick={() => create("area")}
            data-testid="refpoint-new-area"
            className="flex-1 px-2 py-1 rounded border border-[var(--color-tactical-border)] text-[var(--color-tactical-text)] hover:border-[var(--color-terminal-green)] cursor-pointer"
          >
            + Area
          </button>
        </div>

        {placing && (
          <div data-testid="refpoint-placing" className="text-[var(--color-terminal-amber)]">
            {placing.kind === "point"
              ? "Click the map to place this point."
              : `Click the map to add vertices (${points.find((p) => p.id === placing.refId)?.points.length ?? 0} so far).`}
            {placing.kind === "area" && (
              <button
                onClick={onFinishArea}
                data-testid="refpoint-finish-area"
                className="ml-2 px-2 py-0.5 rounded border border-[var(--color-terminal-amber)] text-[var(--color-terminal-amber)] cursor-pointer"
              >
                FINISH
              </button>
            )}
          </div>
        )}

        {points.length === 0 && (
          <div className="text-[var(--color-tactical-text-dim)]">No reference points yet. A point is one spot; an area is 3 or more corners.</div>
        )}

        <div className="max-h-48 overflow-y-auto space-y-1">
          {points.map((p) => (
            <div
              key={p.id}
              data-testid="refpoint-row"
              className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${
                selectedId === p.id ? "bg-[var(--color-tactical-border)]" : "hover:bg-[var(--color-tactical-border)]"
              }`}
              onClick={() => setSelectedId(p.id)}
            >
              <span className="flex-1 truncate text-[var(--color-tactical-text)]">
                {p.name} <span className="text-[var(--color-tactical-text-dim)]">({p.type})</span>
              </span>
              <span className="text-[var(--color-tactical-text-dim)]">{p.points.length}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  remove(p.id);
                }}
                data-testid="refpoint-delete"
                className="text-[var(--color-terminal-red)] px-1 cursor-pointer"
                aria-label={`Delete ${p.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {selected && (
          <div className="border-t border-[var(--color-tactical-border)] pt-2 space-y-2">
            <div>
              <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">Name</label>
              <input
                type="text"
                value={selected.name}
                data-testid="refpoint-name"
                onChange={(e) => patch(selected.id, { name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">Type</label>
                <select
                  value={selected.type}
                  data-testid="refpoint-type"
                  onChange={(e) => patch(selected.id, { type: e.target.value as "point" | "area" })}
                  className={inputCls}
                >
                  <option value="point">Point</option>
                  <option value="area">Area</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider block mb-1">Side</label>
                <select
                  value={selected.side ?? ""}
                  data-testid="refpoint-side"
                  onChange={(e) => patch(selected.id, { side: e.target.value || undefined })}
                  className={inputCls}
                >
                  <option value="">Scenario</option>
                  {scenario.sides.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="text-[var(--color-tactical-text-dim)]">
              Drag a marker on the map to move it. {selected.type === "area" ? "Each corner is draggable." : ""}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
