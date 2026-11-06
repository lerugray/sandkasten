"use client";

import { KIND_LABEL } from "@/lib/facilities/facilities";
import type { Facility, Runway } from "@/lib/facilities/facilities";
import { AFFILIATION_LABEL } from "@/lib/osint/sites";

interface FacilityPanelProps {
  facility: Facility;
  baseUnits?: { id: string; name: string; runwayEnd?: string }[];
  onClose: () => void;
  className?: string;
}

const DEFAULT_PANEL_CLASS =
  "absolute bottom-12 right-2 z-20 w-96 max-h-[70%] overflow-y-auto bg-[var(--color-tactical-panel)] border border-[var(--color-tactical-border)] rounded text-xs shadow-lg";

const ft = (m: number) => Math.round(m / 0.3048).toLocaleString("en-US");

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

function runwayLabel(r: Runway) {
  return r.id || `${Math.round(r.headingTrue)}° strip`;
}

export function FacilityPanel({ facility: f, baseUnits = [], onClose, className = DEFAULT_PANEL_CLASS }: FacilityPanelProps) {
  const kind = f.kind === "airbase" && f.use === "military" ? "MILITARY AIRFIELD" : KIND_LABEL[f.kind];
  const codes = [f.icao, f.iata].filter(Boolean).join(" / ");
  return (
    <div data-testid="facility-panel" className={className}>
      <div className="flex justify-between items-center px-3 py-2 border-b border-[var(--color-tactical-border)] sticky top-0 bg-[var(--color-tactical-panel)]">
        <span
          data-testid="facility-panel-title"
          className="text-[var(--color-terminal-amber)] font-bold text-sm uppercase tracking-wider truncate mr-2"
        >
          {f.name}
        </span>
        <button
          data-testid="facility-panel-close"
          onClick={onClose}
          className="text-[var(--color-tactical-text-dim)] hover:text-[var(--color-tactical-text)] cursor-pointer text-sm px-1"
          aria-label="Close facility panel"
        >
          X
        </button>
      </div>
      <div className="px-3 py-2">
        <Row label="Kind" value={kind} testId="facility-kind" />
        {f.nameLocal && <Row label="Local name" value={f.nameLocal} />}
        {codes && <Row label="ICAO / IATA" value={codes} />}
        {f.country && <Row label="Country" value={f.country} />}
        {f.municipality && <Row label="Near" value={f.municipality} />}
        {f.elevationFt != null && <Row label="Elevation" value={`${f.elevationFt.toLocaleString("en-US")} ft`} />}
        <Row label="Position" value={`${f.position.lat.toFixed(4)}N ${f.position.lng.toFixed(4)}E`} />
        {f.areaType && <Row label="Area type" value={f.areaType.replace("_", " ")} />}
        {f.areaM2 ? <Row label="Area" value={`${(f.areaM2 / 1e6).toFixed(2)} km2`} /> : null}
      </div>
      {f.osint && (
        <div className="px-3 pb-2" data-testid="facility-osint">
          <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider border-t border-[var(--color-tactical-border)] pt-2 pb-1">OSINT</div>
          <Row label="Affiliation" value={AFFILIATION_LABEL[f.osint.affiliation]} testId="facility-osint-affiliation" />
          <div className="py-0.5 text-[var(--color-tactical-text)]" data-testid="facility-osint-function">{f.osint.function}</div>
          {f.osint.notes && <div className="py-0.5 text-[var(--color-tactical-text-dim)]">{f.osint.notes}</div>}
          <div className="py-0.5 text-[var(--color-tactical-text-dim)]" data-testid="facility-osint-source">
            Source: {f.osint.source}
            {f.osint.citations.map((c) => (
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
      )}
      {f.kind === "airbase" && (
        <div className="px-3 pb-2" data-testid="facility-runways">
          <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider border-t border-[var(--color-tactical-border)] pt-2 pb-1">
            Runways ({f.runways?.length ?? 0})
          </div>
          {(f.runways ?? []).length === 0 && <div className="text-[var(--color-tactical-text-dim)]">No runway data</div>}
          {(f.runways ?? []).map((r, i) => (
            <div key={`${r.id}-${i}`} data-testid="facility-runway-row" className="py-0.5 border-b border-[var(--color-tactical-border)] last:border-0">
              <div className="flex justify-between">
                <span className="text-[var(--color-tactical-text)] font-bold">{runwayLabel(r)}</span>
                <span className="text-[var(--color-tactical-text)]">
                  {r.lengthM.toLocaleString("en-US")} m ({ft(r.lengthM)} ft)
                  {r.widthM ? ` x ${r.widthM} m` : ""}
                </span>
              </div>
              <div className="text-[var(--color-tactical-text-dim)]">
                HDG {String(r.ends[0].headingTrue).padStart(3, "0")}/{String(r.ends[1].headingTrue).padStart(3, "0")} T · {r.surface}
                {r.lighted ? " · lit" : ""}
                {r.closed ? " · CLOSED" : ""}
                {r.derivedEnds ? " · ends estimated" : ""}
              </div>
            </div>
          ))}
        </div>
      )}
      {baseUnits.length > 0 && (
        <div className="px-3 pb-2" data-testid="facility-base-units">
          <div className="text-[var(--color-tactical-text-dim)] uppercase tracking-wider border-t border-[var(--color-tactical-border)] pt-2 pb-1">
            Based here ({baseUnits.length})
          </div>
          {baseUnits.map((u) => (
            <div key={u.id} data-testid="facility-base-unit" className="flex justify-between py-0.5 text-[var(--color-tactical-text)]">
              <span>{u.name}</span>
              {u.runwayEnd && <span className="text-[var(--color-tactical-text-dim)]">RWY {u.runwayEnd}</span>}
            </div>
          ))}
        </div>
      )}
      <div className="px-3 pb-2 text-[var(--color-tactical-text-dim)]">
        Source: {Array.from(new Set(f.sources.map((s) => (s.source === "osm" ? "OpenStreetMap" : s.source === "auftragstaktik" ? "Auftragstaktik" : "OurAirports")))).join(" + ")}
      </div>
    </div>
  );
}
