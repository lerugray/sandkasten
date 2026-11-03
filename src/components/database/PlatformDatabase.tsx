"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PLATFORM_RECORDS, getPlatformRecord } from "@/data/platforms";
import { createSymbolSVG } from "@/lib/symbols/milsymbolFactory";
import type { Grade, PlatformRecord, Provenance } from "@/types/platformDb";

const GRADES: Grade[] = ["very-low", "low", "medium", "high", "very-high"];

interface Citation {
  sourceId: string;
  provenance: Provenance;
}

function collectCitations(r: PlatformRecord): Citation[] {
  const c: Citation[] = [
    r.dimensions,
    r.performance,
    r.signatures,
    { sourceId: r.engineSourceId, provenance: r.engineProvenance },
    ...r.weapons,
    ...r.defenses,
    ...r.sensors,
    ...r.loadouts,
  ].map((x) => ({ sourceId: x.sourceId, provenance: x.provenance }));
  return c;
}

function groupOf(r: PlatformRecord): "Surface" | "Air" {
  return r.dimension === "air" ? "Air" : "Surface";
}

function matches(r: PlatformRecord, q: string): boolean {
  if (!q) return true;
  const hay = [r.name, r.designation, r.className, r.nation, r.service, r.slug, r.role, r.side]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((t) => hay.includes(t));
}

function fmt(n: number | undefined, unit = ""): string {
  return n === undefined ? "n/a" : `${n.toLocaleString("en-US")}${unit}`;
}

function Tag({ id, order, provenance }: { id: string; order: Map<string, number>; provenance?: Provenance }) {
  const n = order.get(id);
  return (
    <span className="db-src" data-testid="db-src-tag">
      [SRC {n ?? "?"}]
      {provenance === "estimated" ? <span className="db-est"> EST</span> : null}
    </span>
  );
}

function Silhouette({ air, reason }: { air: boolean; reason?: string }) {
  return (
    <div className="db-placeholder" data-testid="db-placeholder">
      <svg viewBox="0 0 400 160" className="db-placeholder-art" aria-hidden="true">
        <g fill="none" stroke="#3fbf74" strokeWidth="1.5">
          {air ? (
            <>
              <path d="M30 82 L150 76 L190 20 L206 20 L190 76 L300 70 L350 54 L368 56 L352 80 L368 104 L350 106 L300 90 L190 84 L206 140 L190 140 L150 88 Z" />
              <line x1="30" y1="82" x2="370" y2="80" strokeDasharray="4 6" />
            </>
          ) : (
            <>
              <path d="M20 96 L60 120 L340 120 L384 88 L330 88 L322 66 L270 66 L262 46 L226 46 L222 66 L150 66 L146 54 L110 54 L106 88 Z" />
              <line x1="0" y1="132" x2="400" y2="132" strokeDasharray="2 8" />
            </>
          )}
        </g>
      </svg>
      <div className="db-placeholder-title">NO OPEN-LICENSE PHOTO ON FILE</div>
      <div className="db-placeholder-reason">{reason ?? "Searched Wikimedia Commons and DVIDS; nothing usable."}</div>
    </div>
  );
}

function PhotoBay({ r }: { r: PlatformRecord }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => setIdx(0), [r.slug]);
  const photo = r.photos[idx];
  if (!photo) return <Silhouette air={r.dimension === "air"} reason={r.photoPlaceholderReason} />;
  return (
    <figure className="db-photo-bay" data-testid="db-photo-bay">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="db-photo" data-testid="db-photo" src={photo.localPath} alt={photo.caption} />
      {r.photos.length > 1 ? (
        <div className="db-photo-switch" data-testid="db-photo-switch">
          {r.photos.map((p, i) => (
            <button
              key={p.localPath}
              type="button"
              className={i === idx ? "db-btn db-btn--on" : "db-btn"}
              onClick={() => setIdx(i)}
            >
              [ PHOTO {i + 1} ]
            </button>
          ))}
        </div>
      ) : null}
      <figcaption className="db-credit" data-testid="db-photo-credit">
        <div className="db-credit-caption">{photo.caption}</div>
        <div>
          <span className="db-dim">CREDIT </span>
          <span data-testid="db-photo-attribution">{photo.attributionLine}</span>
        </div>
        <div>
          <span className="db-dim">AUTHOR </span>
          {photo.author}
          <span className="db-dim"> LICENSE </span>
          <a href={photo.licenseUrl} target="_blank" rel="noreferrer" data-testid="db-photo-license">
            {photo.license}
          </a>
          <span className="db-dim"> </span>
          <a href={photo.sourceUrl} target="_blank" rel="noreferrer">
            [ SOURCE ]
          </a>
        </div>
      </figcaption>
    </figure>
  );
}

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="db-section" data-testid={testId}>
      <h2 className="db-h2">[ {title} ]</h2>
      {children}
    </section>
  );
}

function KV({ rows, order }: { rows: [string, string, Citation | null][]; order: Map<string, number> }) {
  return (
    <table className="db-table db-kv">
      <tbody>
        {rows.map(([k, v, c]) => (
          <tr key={k}>
            <th>{k}</th>
            <td>{v}</td>
            <td className="db-tagcol">{c ? <Tag id={c.sourceId} order={order} provenance={c.provenance} /> : null}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Detail({ r }: { r: PlatformRecord }) {
  const order = useMemo(() => new Map(r.sources.map((s, i) => [s.id, i + 1])), [r]);
  const citations = useMemo(() => collectCitations(r), [r]);
  const d = r.dimensions;
  const p = r.performance;
  const dimC: Citation = d;
  const perfC: Citation = p;
  const eng: Citation = { sourceId: r.engineSourceId, provenance: r.engineProvenance };

  const dimRows: [string, string, Citation | null][] = [];
  if (d.lengthM !== undefined) dimRows.push(["Length", `${fmt(d.lengthM)} m`, dimC]);
  if (d.beamM !== undefined) dimRows.push(["Beam", `${fmt(d.beamM)} m`, dimC]);
  if (d.wingspanM !== undefined) dimRows.push(["Wingspan", `${fmt(d.wingspanM)} m`, dimC]);
  if (d.draftM !== undefined) dimRows.push(["Draft", `${fmt(d.draftM)} m`, dimC]);
  if (d.heightM !== undefined) dimRows.push(["Height", `${fmt(d.heightM)} m`, dimC]);
  if (d.displacementFullTons !== undefined) dimRows.push(["Full-load displacement", `${fmt(d.displacementFullTons)} t`, dimC]);
  if (d.weightEmptyKg !== undefined) dimRows.push(["Empty weight", `${fmt(d.weightEmptyKg)} kg`, dimC]);
  if (d.weightMaxKg !== undefined) dimRows.push(["Max takeoff weight", `${fmt(d.weightMaxKg)} kg`, dimC]);
  dimRows.push(["Crew", d.crew, dimC]);

  const perfRows: [string, string, Citation | null][] = [
    ["Propulsion", r.propulsionSummary, perfC],
    ["Max speed", `${fmt(p.maxSpeedKts)} kt`, perfC],
  ];
  if (p.cruiseSpeedKts !== undefined) perfRows.push(["Cruise speed", `${fmt(p.cruiseSpeedKts)} kt`, perfC]);
  if (p.maxAltitudeFt !== undefined) perfRows.push(["Service ceiling", `${fmt(p.maxAltitudeFt)} ft`, perfC]);
  if (p.combatRadiusNm !== undefined) perfRows.push(["Combat radius", `${fmt(p.combatRadiusNm)} NM`, perfC]);
  if (p.rangeNm !== undefined) perfRows.push(["Range", `${fmt(p.rangeNm)} NM`, perfC]);
  if (p.enduranceHours !== undefined) perfRows.push(["Endurance", `${fmt(p.enduranceHours)} h`, perfC]);

  const s = r.signatures;
  const sigRows: [string, string, Citation | null][] = [
    ["Damage points (engine)", fmt(r.damagePoints), eng],
    ...(r.dimension === "sea"
      ? ([["Missile defense channels (engine)", fmt(r.missileDefense), eng]] as [string, string, Citation | null][])
      : []),
    ["Radar signature", `${s.radar.grade.toUpperCase()}. ${s.radar.note}`, s],
    ["Infrared signature", `${s.infrared.grade.toUpperCase()}. ${s.infrared.note}`, s],
  ];
  if (s.acoustic) sigRows.push(["Acoustic signature", `${s.acoustic.grade.toUpperCase()}. ${s.acoustic.note}`, s]);
  sigRows.push(["Visual signature", `${s.visual.grade.toUpperCase()}. ${s.visual.note}`, s]);

  const srcStats = r.sources.map((src) => {
    const cs = citations.filter((c) => c.sourceId === src.id);
    return { src, verified: cs.filter((c) => c.provenance === "verified").length, estimated: cs.filter((c) => c.provenance === "estimated").length };
  });

  const w = r.serviceWindow;
  const window = `IN SERVICE ${w.enteredService}${w.retired ? ` / RETIRED ${w.retired}` : " / ACTIVE"}`;
  const symbol = createSymbolSVG({
    affiliation: r.side === "US Navy" ? "friendly" : "hostile",
    dimension: r.dimension,
    functionId: r.functionId,
    size: 52,
  });

  return (
    <div className="db-detail" data-testid="db-detail" data-slug={r.slug}>
      <header className="db-header" data-testid="db-header">
        <div className="db-glyph" data-testid="db-glyph" dangerouslySetInnerHTML={{ __html: symbol }} />
        <div className="db-header-text">
          <h1 className="db-h1" data-testid="db-title">{r.designation}</h1>
          <div className="db-sub">
            {r.className.toUpperCase()} // {r.nation.toUpperCase()} // {r.service.toUpperCase()}
          </div>
          <div className="db-sub db-dim">
            {window}
          </div>
        </div>
      </header>

      <PhotoBay r={r} />

      {w.statusNotes ? (
        <Section title="SERVICE STATUS" testId="db-status">
          <p className="db-p">{w.statusNotes.replace(/\bs(\d+)\b/g, "[SRC $1]")}</p>
        </Section>
      ) : null}

      <Section title="WHAT IT IS" testId="db-brief-what">
        <p className="db-p">{r.brief.whatItIs}</p>
      </Section>
      <Section title="HOW IT IS USED" testId="db-brief-how">
        <p className="db-p">{r.brief.howItIsUsed}</p>
      </Section>
      <Section title="TYPICAL MISSIONS" testId="db-brief-missions">
        <ul className="db-list">
          {r.brief.typicalMissions.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Section>

      <Section title="DIMENSIONS & CREW" testId="db-specs">
        <KV rows={dimRows} order={order} />
      </Section>
      <Section title="PROPULSION & PERFORMANCE">
        <KV rows={perfRows} order={order} />
      </Section>
      <Section title="SURVIVABILITY & SIGNATURES">
        <KV rows={sigRows} order={order} />
        <div className="db-grades">
          {(["radar", "infrared", "visual"] as const).map((k) => (
            <span key={k}>
              {k.toUpperCase()} {"▮".repeat(GRADES.indexOf(s[k].grade) + 1)}
              <span className="db-dim">{"▯".repeat(4 - GRADES.indexOf(s[k].grade))}</span>
            </span>
          ))}
        </div>
      </Section>

      <Section title="SENSORS" testId="db-sensors">
        <table className="db-table" data-testid="db-sensors-table">
          <thead>
            <tr><th>Sensor</th><th>Type</th><th>Role / band</th><th>Range</th><th>Track</th><th>Src</th></tr>
          </thead>
          <tbody>
            {r.sensors.map((x) => (
              <tr key={x.name}>
                <td>{x.name}</td>
                <td>{x.type.toUpperCase()}</td>
                <td>{x.role}{x.band ? ` (${x.band})` : ""}</td>
                <td>{fmt(x.rangeKm)} km</td>
                <td>{x.canTrack ? "YES" : "NO"}</td>
                <td className="db-tagcol"><Tag id={x.sourceId} order={order} provenance={x.provenance} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="WEAPONS / MOUNTS / LOADOUTS" testId="db-weapons">
        <table className="db-table" data-testid="db-weapons-table">
          <thead>
            <tr><th>Weapon</th><th>Type</th><th>Range</th><th>Qty</th><th>Mount / seeker</th><th>Src</th></tr>
          </thead>
          <tbody>
            {r.weapons.length === 0 ? (
              <tr data-testid="db-weapons-none">
                <td colSpan={6}>
                  {r.loadouts.length > 0
                    ? "No weapons are simulated by the engine for this platform; real stores are in the loadouts below."
                    : "Unarmed: carries no weapons."}
                </td>
              </tr>
            ) : (
              r.weapons.map((x) => (
                <tr key={x.name}>
                  <td>{x.name}</td>
                  <td>{x.type.toUpperCase()}</td>
                  <td>{fmt(x.rangeKm)} km</td>
                  <td>{fmt(x.quantity)}</td>
                  <td>{[x.mountSummary, x.seekerType].filter(Boolean).join(" / ") || "n/a"}</td>
                  <td className="db-tagcol"><Tag id={x.sourceId} order={order} provenance={x.provenance} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {r.loadouts.length > 0 ? (
          <table className="db-table" data-testid="db-loadouts-table">
            <thead>
              <tr><th>Loadout</th><th>Role</th><th>Radius</th><th>Stores</th><th>Src</th></tr>
            </thead>
            <tbody>
              {r.loadouts.map((l) => (
                <tr key={l.name}>
                  <td>{l.name}</td>
                  <td>{l.role}</td>
                  <td>{fmt(l.combatRadiusNm)} NM</td>
                  <td>{l.stores.map((st) => `${st.count}x ${st.weaponName}`).join(", ")}</td>
                  <td className="db-tagcol"><Tag id={l.sourceId} order={order} provenance={l.provenance} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </Section>

      <Section title="DEFENSES" testId="db-defenses">
        <table className="db-table" data-testid="db-defenses-table">
          <thead>
            <tr><th>Defense</th><th>Type</th><th>Effectiveness</th><th>Qty</th><th>Src</th></tr>
          </thead>
          <tbody>
            {r.defenses.length === 0 ? (
              <tr><td colSpan={5}>No active defenses modeled.</td></tr>
            ) : (
              r.defenses.map((x) => (
                <tr key={x.name}>
                  <td>{x.name}</td>
                  <td>{x.type.toUpperCase()}</td>
                  <td>{Math.round(x.effectiveness * 100)}%</td>
                  <td>{x.quantity === undefined ? "unlimited" : fmt(x.quantity)}</td>
                  <td className="db-tagcol"><Tag id={x.sourceId} order={order} provenance={x.provenance} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Section>

      <Section title="SOURCES" testId="db-sources">
        <ol className="db-sources">
          {srcStats.map(({ src, verified, estimated }, i) => (
            <li key={src.id} data-testid="db-source">
              <span className="db-src">[SRC {i + 1}]</span>{" "}
              <span className={verified > 0 ? "db-verified" : estimated > 0 ? "db-est" : "db-dim"}>
                {verified > 0 ? "VERIFIED" : estimated > 0 ? "ESTIMATED" : "REFERENCE"}
              </span>{" "}
              {src.title.replace(/\bs(\d+)\b/g, "SRC $1")}. {src.publisher}, {src.year}.{" "}
              <a href={src.url} target="_blank" rel="noreferrer">{src.url}</a>
              {verified + estimated > 0 ? (
                <span className="db-dim"> (cited by {verified} verified, {estimated} estimated rows)</span>
              ) : (
                <span className="db-dim"> (cross-check reference)</span>
              )}
            </li>
          ))}
        </ol>
        <p className="db-fine">
          VERIFIED rows are published figures read from the source. EST rows, and every engine value
          (damage points, kill probabilities, effectiveness, signature grades), are Sandkasten abstractions;
          the formulas are in src/data/platforms/METHODS.md.
        </p>
      </Section>
    </div>
  );
}

export interface PlatformDatabaseProps {
  initialId?: number | string | null;
  onClose?: () => void;
  syncUrl?: boolean;
}

export function PlatformDatabase({ initialId, onClose, syncUrl = false }: PlatformDatabaseProps) {
  const first = (initialId !== undefined && initialId !== null && getPlatformRecord(initialId)) || PLATFORM_RECORDS[0];
  const [slug, setSlug] = useState<string>(first.slug);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => PLATFORM_RECORDS.filter((r) => matches(r, query)), [query]);
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: PlatformRecord[] }[] = [];
    for (const r of visible) {
      const label = `${r.side} / ${groupOf(r)}`;
      let g = out.find((x) => x.label === label);
      if (!g) {
        g = { key: label, label, items: [] };
        out.push(g);
      }
      g.items.push(r);
    }
    return out;
  }, [visible]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const current = PLATFORM_RECORDS.find((r) => r.slug === slug) ?? PLATFORM_RECORDS[0];

  const select = useCallback(
    (next: string) => {
      setSlug(next);
      mainRef.current?.scrollTo({ top: 0 });
      if (syncUrl) window.history.replaceState(null, "", `/database?slug=${encodeURIComponent(next)}`);
    },
    [syncUrl],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      if (flat.length === 0) return;
      const i = flat.findIndex((r) => r.slug === slug);
      const next = flat[(i + dir + flat.length) % flat.length];
      select(next.slug);
    },
    [flat, slug, select],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = t?.tagName === "INPUT" || t?.tagName === "TEXTAREA";
      if (e.key === "Escape") {
        if (typing) (t as HTMLElement).blur();
        else onClose?.();
        return;
      }
      if (e.key === "ArrowDown" || (!typing && e.key.toLowerCase() === "j")) {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowUp" || (!typing && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        step(-1);
      } else if (!typing && e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  useEffect(() => {
    document.querySelector(`[data-rail-slug="${slug}"]`)?.scrollIntoView({ block: "nearest" });
  }, [slug]);

  return (
    <div className="db-root" data-testid="db-root">
      <div className="db-topbar">
        <span className="db-brand">SANDKASTEN // PLATFORM MANUAL</span>
        <span className="db-dim">
          {PLATFORM_RECORDS.length} PLATFORMS // / SEARCH // UP DOWN or J K SELECT{onClose ? " // ESC CLOSE" : ""}
        </span>
        {onClose ? (
          <button type="button" className="db-btn" onClick={onClose} data-testid="db-close">
            [ CLOSE ]
          </button>
        ) : null}
      </div>
      <div className="db-body">
        <nav className="db-rail" data-testid="db-rail" aria-label="Platform roster">
          <input
            ref={searchRef}
            className="db-search"
            data-testid="db-search"
            placeholder="/ filter roster"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          {groups.length === 0 ? <div className="db-dim db-empty">NO MATCH</div> : null}
          {groups.map((g) => (
            <div key={g.key} className="db-group">
              <div className="db-group-title">[ {g.label.toUpperCase()} ]</div>
              {g.items.map((r) => (
                <button
                  key={r.slug}
                  type="button"
                  data-testid="db-rail-item"
                  data-slug={r.slug}
                  data-rail-slug={r.slug}
                  className={r.slug === slug ? "db-rail-item db-rail-item--on" : "db-rail-item"}
                  onClick={() => select(r.slug)}
                >
                  <span className="db-rail-mark">{r.slug === slug ? ">" : " "}</span>
                  <span>{r.designation}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <main className="db-main" ref={mainRef} data-testid="db-main">
          <Detail r={current} />
        </main>
      </div>
    </div>
  );
}
