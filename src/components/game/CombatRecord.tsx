"use client";

import { useEffect, useRef } from "react";
import {
  describeFilter,
  filterRecord,
  pageWindow,
  stateWord,
  type OwnForce,
  type RecordCategory,
  type RecordRow,
  type RecordScope,
} from "@/lib/simulation/combatRecord";
import { Measured, nowrapTokens, turnAtSpaces } from "@/components/terminal/textWrap";

export interface RecordView {
  category: RecordCategory;
  unitId: string | null;
  scope: RecordScope;
  /** null follows the latest page; a number stays on that page whatever arrives. */
  page: number | null;
  /** Filtered row count when the reader left the latest page (for the NEW ACTIVITY cue). */
  anchorTotal: number | null;
}

export const INITIAL_RECORD_VIEW: RecordView = { category: "all", unitId: null, scope: "run", page: null, anchorTotal: null };

const hhmmss = (t: number) => new Date(t).toISOString().slice(11, 19);

const CATEGORIES: [RecordCategory, string][] = [
  ["all", "ALL ACTIVITY"],
  ["combat", "COMBAT"],
  ["intel", "INTEL"],
];

interface Props {
  rows: RecordRow[];
  /** Ids of the last resolved WeGo turn, or null when there is none to scope to. */
  turnIds: Set<string> | null;
  view: RecordView;
  onView: (v: RecordView) => void;
  force: OwnForce;
  ownUnits: { id: string; name: string }[];
  selectedUnitId: string | null;
  onInspect: (unitId: string) => void;
  /** Set when the record was opened from a held summary; the way back to exactly that summary. */
  returnLabel?: string;
  onReturn?: () => void;
  autoFocus?: boolean;
}

export function CombatRecord({ rows, turnIds, view, onView, force, ownUnits, selectedUnitId, onInspect, returnLabel, onReturn, autoFocus }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const nameOf = (id: string) => ownUnits.find((u) => u.id === id)?.name ?? "UNIT";

  const scope: RecordScope = view.scope === "turn" && turnIds ? "turn" : "run";
  const filtered = filterRecord(rows, { category: view.category, unitId: view.unitId, scopeIds: scope === "turn" ? turnIds : null });
  const ordinary = filtered.filter((r) => !r.debug).length;
  const debug = filtered.length - ordinary;
  const win = pageWindow(filtered.length, view.page);
  const shown = filtered.slice(Math.max(0, win.from - 1), win.to);
  const fresh = view.page !== null && view.anchorTotal !== null ? Math.max(0, filtered.length - view.anchorTotal) : 0;
  const filtersActive = view.category !== "all" || view.unitId !== null || scope === "turn";

  useEffect(() => {
    if (autoFocus) rootRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  // a reader on an older page keeps their place; the latest page follows new rows only while it is the one shown
  const goto = (page: number | null) => {
    const last = pageWindow(filtered.length, null).page;
    const atEnd = page === null || page >= last;
    onView({ ...view, page: atEnd ? null : Math.max(0, page), anchorTotal: atEnd ? null : filtered.length });
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  };
  const change = (patch: Partial<RecordView>) => onView({ ...view, ...patch, page: null, anchorTotal: null });
  const clear = () => onView({ ...INITIAL_RECORD_VIEW });

  const btn = (label: string, onClick: () => void, opts: { on?: boolean; disabled?: boolean; testId?: string; aria?: string } = {}) => (
    <button
      key={opts.testId ?? label}
      type="button"
      className={`tx-btn${opts.on ? " is-on" : ""}`}
      aria-pressed={opts.on === undefined ? undefined : opts.on}
      disabled={opts.disabled}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      data-testid={opts.testId}
      aria-label={opts.aria}
    >
      {label}
    </button>
  );

  return (
    <section
      ref={rootRef}
      tabIndex={-1}
      className="tx-record"
      data-testid="combat-record"
      role="region"
      aria-label="Combat record"
    >
      {onReturn && (
        <div className="tx-rec-return">
          <button type="button" className="tx-btn is-on" data-testid="record-return" onClick={onReturn} onMouseDown={(e) => e.preventDefault()}>
            {returnLabel}
          </button>
        </div>
      )}
      <div className="tx-section-head tx-rec-head">
        <span>Combat record</span>
        <span className="tx-dim" data-testid="record-eligible">
          {ordinary} {filtersActive ? "MATCHING" : "ON RECORD"}
          {debug > 0 && <span className="tx-alarm" data-testid="record-god-count">  //  GOD VIEW +{debug}</span>}
        </span>
      </div>

      <div className="tx-rec-force" data-testid="record-force">
        <b>OWN FORCE</b> {force.total} UNITS  //  DAMAGED {force.damaged}  //  MISSION KILL {force.missionKill}  //  LOST {force.lost}
        {force.affected.length > 0 && (
          <span className="tx-rec-chips">
            {force.affected.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`tx-btn tx-rec-chip${selectedUnitId === a.id ? " is-on" : ""}${a.state === "destroyed" ? " is-alarm" : ""}`}
                data-testid="record-affected"
                data-unit-id={a.id}
                onClick={() => onInspect(a.id)}
                onMouseDown={(e) => e.preventDefault()}
                aria-label={`Inspect ${a.name}, ${stateWord(a.state)}`}
              >
                {a.name.toUpperCase()} {stateWord(a.state)}
              </button>
            ))}
          </span>
        )}
      </div>

      <div className="tx-rec-controls">
        <span className="tx-rec-group" role="group" aria-label="Category">
          {CATEGORIES.map(([id, label]) => btn(label, () => change({ category: id }), { on: view.category === id, testId: `record-cat-${id}` }))}
        </span>
        {turnIds && (
          <span className="tx-rec-group" role="group" aria-label="Scope">
            {btn("ALL RUN", () => change({ scope: "run" }), { on: scope === "run", testId: "record-scope-run" })}
            {btn("LAST RESOLVED TURN", () => change({ scope: "turn" }), { on: scope === "turn", testId: "record-scope-turn" })}
          </span>
        )}
        <label className="tx-rec-group tx-rec-unit">
          <span className="tx-dim">UNIT</span>
          <select
            className="tx-select"
            data-testid="record-unit"
            value={view.unitId ?? ""}
            onChange={(e) => change({ unitId: e.target.value || null })}
          >
            <option value="">ALL OWN UNITS</option>
            {ownUnits.map((u) => (
              <option key={u.id} value={u.id}>{u.name.toUpperCase()}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="tx-rec-pager" data-testid="record-pager">
        <span data-testid="record-window" aria-live="polite">
          {filtered.length === 0 ? "SHOWING 0 OF 0" : `SHOWING ${win.from}-${win.to} OF ${filtered.length}`}
          {win.pages > 1 ? `  //  PAGE ${win.page + 1}/${win.pages}` : ""}
        </span>
        {btn("FIRST", () => goto(0), { disabled: win.page === 0, testId: "record-first" })}
        {btn("PREV", () => goto(win.page - 1), { disabled: win.page === 0, testId: "record-prev" })}
        {btn("NEXT", () => goto(win.page + 1), { disabled: win.atLatest, testId: "record-next" })}
        {btn("LATEST", () => goto(null), { disabled: win.atLatest && view.page === null, testId: "record-latest" })}
        {fresh > 0 && (
          <button type="button" className="tx-btn is-alarm" data-testid="record-new" onClick={() => goto(null)} onMouseDown={(e) => e.preventDefault()}>
            NEW ACTIVITY +{fresh}  LATEST
          </button>
        )}
      </div>

      <div className="tx-rec-body" ref={bodyRef} data-testid="combat-log" tabIndex={0} aria-label="Record rows">
        {filtered.length === 0 && (
          <div className="tx-rec-empty" data-testid="record-empty">
            {rows.length === 0
              ? "NOTHING ON THE RECORD YET."
              : `NO ENTRIES MATCH THE ACTIVE FILTER (${describeFilter({ category: view.category, unitId: view.unitId, scopeIds: scope === "turn" ? turnIds : null }, nameOf)}).`}
            {filtersActive && (
              <>
                {" "}
                {btn("CLEAR FILTERS", clear, { testId: "record-clear" })}
              </>
            )}
          </div>
        )}
        {shown.map((r, i) => (
          <div
            key={`${r.id}#${win.from + i}`}
            className={`tx-rec-row${r.alarm ? " is-alarm" : ""}${r.debug ? " is-god" : ""}`}
            data-testid="combat-log-entry"
            data-event-type={r.type}
            data-source-id={r.id}
            data-kind={r.kind}
            data-tag={r.tag}
          >
            <span className="tx-rec-time">{hhmmss(r.time)}Z</span>
            <span className="tx-rec-tag">{r.debug ? "GOD" : r.tag}</span>
            <Measured className="tx-rec-text">
              {(cols) => {
                const body = `${r.debug ? `[${r.tag}] ` : ""}${r.text}`;
                return <span className="tx-turns">{nowrapTokens(turnAtSpaces(body, cols))}</span>;
              }}
            </Measured>
            {r.ownUnitIds.map((id) => (
              <button
                key={id}
                type="button"
                className={`tx-btn tx-rec-inspect${selectedUnitId === id ? " is-on" : ""}`}
                data-testid="record-inspect"
                data-unit-id={id}
                onClick={() => onInspect(id)}
                onMouseDown={(e) => e.preventDefault()}
                aria-label={`Inspect ${nameOf(id)}`}
              >
                INSPECT {nameOf(id).toUpperCase()}
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
