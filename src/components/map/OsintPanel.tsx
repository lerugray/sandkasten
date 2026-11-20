"use client";

import { AFFILIATION_LABEL, LAYER_TAG, rangeLabel, sideForAffiliation } from "@/lib/osint/sites";
import type { OsintSite } from "@/lib/osint/sites";

interface OsintPanelProps {
  site: OsintSite;
  onClose: () => void;
  className?: string;
}

const DEFAULT_PANEL_CLASS =
  "absolute bottom-12 right-2 z-20 w-96 max-h-[70%] overflow-y-auto bg-[var(--color-tactical-panel)] border border-[var(--color-tactical-border)] rounded text-xs shadow-lg";

function Row({ label, value, testId }: { label: string; value: React.ReactNode; testId?: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider">{label}</span>
      <span data-testid={testId} className="text-[var(--color-tactical-text)] text-right">
        {value}
      </span>
    </div>
  );
}

export function OsintPanel({ site: s, onClose, className = DEFAULT_PANEL_CLASS }: OsintPanelProps) {
  const miles = Math.round(s.rangeKm / 1.852);
  return (
    <div data-testid="osint-panel" className={className}>
      <div className="flex justify-between items-center px-3 py-2 border-b border-[var(--color-tactical-border)] sticky top-0 bg-[var(--color-tactical-panel)]">
        <span data-testid="osint-panel-title" className="text-[var(--color-terminal-amber)] font-bold text-sm uppercase tracking-wider truncate mr-2">
          {s.name}
        </span>
        <button
          data-testid="osint-panel-close"
          onClick={onClose}
          className="text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] cursor-pointer text-sm px-1"
          aria-label="Close OSINT site panel"
        >
          X
        </button>
      </div>
      <div className="px-3 py-2">
        <Row label="Layer" value={`${LAYER_TAG[s.layer]} · ${s.kind}`} />
        <Row label="System" value={s.system} testId="osint-system" />
        <Row label="Operator" value={s.operator} />
        <Row label="Side" value={sideForAffiliation(s.affiliation) === AFFILIATION_LABEL[s.affiliation] ? AFFILIATION_LABEL[s.affiliation] : `${sideForAffiliation(s.affiliation)} (${AFFILIATION_LABEL[s.affiliation]})`} testId="osint-side" />
        {s.rangeKm > 0 && (
          <Row
            label={rangeLabel(s)}
            value={
              <>
                {s.rangeKm.toLocaleString("en-US")} km ({miles.toLocaleString("en-US")} nm)
                {s.estimated && (
                  <span data-testid="osint-estimated" className="ml-2 px-1 border border-[var(--color-terminal-amber)] text-[var(--color-terminal-amber)] font-bold">
                    ESTIMATED
                  </span>
                )}
              </>
            }
            testId="osint-range"
          />
        )}
        {s.trackingRangeKm ? <Row label="Tracking range" value={`${s.trackingRangeKm} km`} /> : null}
        <Row label="Status" value={s.status + (s.lastConfirmed ? ` · ${s.lastConfirmed}` : "")} />
        <Row label="Position" value={`${s.position.lat.toFixed(4)}N ${s.position.lng.toFixed(4)}E`} />
        <Row label="Placement" value={s.positionBasis === "facility-anchor" ? "anchored to a real facility (assumption)" : "source coordinates"} />
        <Row
          label="Platform DB"
          value={s.platform.status === "match" ? `match #${s.platform.platformId} ${s.platform.platformName}` : s.layer === "nuclear" ? "n/a" : "no record"}
          testId="osint-platform"
        />
      </div>
      <div className="px-3 pb-2 text-[var(--color-tactical-text)]">
        <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider border-t border-[var(--color-tactical-border)] pt-2 pb-1">Notes</div>
        <div>{s.platform.note}.</div>
        {s.notes && <div className="mt-1">{s.notes}</div>}
      </div>
      <div className="px-3 pb-2 text-[var(--color-tactical-text-dim)]" data-testid="osint-source">
        <div className="uppercase tracking-wider border-t border-[var(--color-tactical-border)] pt-2 pb-1">Source</div>
        <div className="text-[var(--color-tactical-text)]">{s.source}</div>
        {s.citations.map((c) => (
          <div key={c.label}>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noreferrer" className="underline">
                {c.label}
              </a>
            ) : (
              c.label
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
