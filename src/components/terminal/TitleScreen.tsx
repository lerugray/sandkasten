"use client";

import "@/app/play/terminal.css";
import "@/app/title.css";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { TITLE_MENU, type TitleMenuEntry } from "@/lib/scenarios/menu";

const FONT_URLS = [
  "/fonts/jetbrains-mono/jetbrains-mono-latin-400-normal.woff2",
  "/fonts/jetbrains-mono/jetbrains-mono-latin-700-normal.woff2",
];

const VERSION = "v0.1.0";

// A 3-line plain explanation, in the game's own words (SPEC.md / Ray's pitch). No em dashes.
const INTRO = [
  "MODERN NAVAL AND AIR OPERATIONS IN THE STRAIT OF HORMUZ.",
  "YOU GIVE THE ORDERS. SENSORS AND FOG DECIDE WHAT YOU SEE.",
  "MISSILES AND AIR DEFENCE FIGHT IT OUT. CONTINUOUS OR WEGO.",
];

const CREDITS: Array<[string, string]> = [
  ["Base map", "OpenFreeMap vector tiles, OpenStreetMap data (ODbL), OpenMapTiles schema."],
  ["Satellite imagery", "EOX Sentinel-2 cloudless, 2018 (CC BY-NC-SA 4.0)."],
  ["Terrain relief", "AWS Terrain Tiles."],
  ["Facilities", "OurAirports (public domain) and OpenStreetMap (ODbL)."],
  ["Land, coast and depth", "Natural Earth and NOAA ETOPO1 (public domain)."],
  ["OSINT sites", "Auftragstaktik (MIT)."],
  ["Snapshot aircraft", "adsb.lol (ODbL)."],
  ["Typeface", "JetBrains Mono (SIL OFL 1.1)."],
];

const BUILT_WITH = "MapLibre GL JS, milsymbol, Three.js, Next.js.";

function TypeLine({ text, delay }: { text: string; delay: number }) {
  const n = Math.min(text.length, 120);
  return (
    <div className="title-line">
      <span
        className="title-line-text"
        style={{ "--n": n, "--d": `${Math.min(1400, n * 16)}ms`, animationDelay: `${delay}ms` } as CSSProperties}
      >
        {text}
      </span>
    </div>
  );
}

export function TitleScreen() {
  const [selected, setSelected] = useState(0);
  const [showAbout, setShowAbout] = useState(false);

  const activate = useCallback((entry: TitleMenuEntry) => {
    if (entry.kind === "about") {
      setShowAbout(true);
      return;
    }
    if (entry.href) window.location.assign(entry.href);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable) return;

      if (showAbout) {
        if (e.key === "Escape" || e.key === "Enter" || e.key.toLowerCase() === "a") {
          e.preventDefault();
          setShowAbout(false);
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => (s + 1) % TITLE_MENU.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => (s - 1 + TITLE_MENU.length) % TITLE_MENU.length);
      } else if (e.key === "Enter") {
        // a menu button focused by keyboard fires its own click; do not double-open
        if (el.tagName === "BUTTON") return;
        e.preventDefault();
        activate(TITLE_MENU[selected]);
      } else if (/^[1-9]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (i < TITLE_MENU.length) {
          e.preventDefault();
          activate(TITLE_MENU[i]);
        }
      } else if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        setShowAbout(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, showAbout, activate]);

  return (
    <div className="tx-root title-root" data-testid="title-root">
      {FONT_URLS.map((href) => (
        <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
      ))}

      {/* Status strip */}
      <header className="tx-top title-top" data-testid="title-top">
        <a href="/" className="tx-brand">SANDKASTEN</a>
        <span className="tx-rule-v" />
        <span className="tx-dim">TITLE</span>
        <span className="tx-rule-v" />
        <span className="tx-clock" data-testid="title-version">{VERSION}</span>
        <span className="tx-top-right">
          <span className="tx-dim">DESIGNED BY RAY WEISS, CONFLICT SIMULATIONS LLC</span>
        </span>
      </header>

      <main className="title-body">
        <h1 className="title-wordmark" data-testid="title-wordmark">SANDKASTEN</h1>

        <div className="title-intro" data-testid="title-intro" aria-label="What Sandkasten is">
          {INTRO.map((line, i) => (
            <TypeLine key={line} text={line} delay={i * 320} />
          ))}
        </div>

        <section className="title-menu" aria-label="Scenario menu" role="listbox" aria-activedescendant={`menu-${TITLE_MENU[selected].id}`}>
          <div className="tx-section-head title-menu-head">[ SCENARIOS ]</div>
          {TITLE_MENU.map((entry, i) => (
            <button
              key={entry.id}
              id={`menu-${entry.id}`}
              type="button"
              role="option"
              aria-selected={selected === i}
              data-testid={entry.kind === "scenario" ? "scenario-entry" : "menu-entry"}
              data-entry-id={entry.id}
              data-active={selected === i ? "true" : "false"}
              className={`title-entry${selected === i ? " is-on" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setSelected(i);
                activate(entry);
              }}
            >
              <span className="title-entry-key" aria-hidden="true">{i + 1}</span>
              <span className="title-entry-main">
                <span className="title-entry-title">{entry.title.toUpperCase()}</span>
                <span className="title-entry-brief">{entry.brief}</span>
                {entry.kind === "scenario" && (
                  <span className="title-entry-facts">
                    <span><b>SIDE</b> {entry.side}</span>
                    <span><b>LENGTH</b> {entry.length}</span>
                    <span><b>MODE</b> {entry.mode}</span>
                  </span>
                )}
              </span>
              <span className="title-entry-mark" aria-hidden="true">{selected === i ? ">" : " "}</span>
            </button>
          ))}
        </section>

        <div className="title-foot-hint">
          <span className="tx-dim">A SCENARIO YOU BUILD IN THE EDITOR STARTS FROM THE EDITOR’S PLAY BUTTON.</span>
        </div>
      </main>

      {/* Command bar */}
      <nav className="tx-cmd title-cmd" data-testid="title-cmd">
        <span className="tx-key"><kbd className="tx-cap" aria-hidden="true">{"↑↓"}</kbd>SELECT</span>
        <span className="tx-key"><kbd className="tx-cap" aria-hidden="true">ENT</kbd>OPEN</span>
        <span className="tx-key"><kbd className="tx-cap" aria-hidden="true">1-5</kbd>JUMP</span>
        <span className="tx-key"><kbd className="tx-cap" aria-hidden="true">A</kbd>ABOUT</span>
        <span className="tx-cmd-right">
          <span className="tx-dim">OPEN-SOURCE WARGAME SIMULATION</span>
        </span>
      </nav>

      {showAbout && (
        <div className="tx-modal-backdrop" data-testid="title-about" onClick={() => setShowAbout(false)}>
          <div className="tx-panel tx-modal title-about-panel" role="dialog" aria-label="About Sandkasten" onClick={(e) => e.stopPropagation()}>
            <div className="tx-modal-head">
              <span>SANDKASTEN</span>
              <span className="tx-dim">{VERSION}</span>
            </div>
            <p className="tx-modal-text" data-testid="about-byline">Designed by Ray Weiss, Conflict Simulations LLC</p>
            <p className="tx-modal-text" data-testid="about-description">
              Open-source wargame simulation. Command naval and air forces on a tactical map with NATO symbology,
              radar detection, fog of war, and WeGo turns.
            </p>

            <div className="tx-section-head">Data and map credits</div>
            <dl className="title-credits">
              {CREDITS.map(([term, def]) => (
                <div key={term} className="title-credit-row">
                  <dt>{term}</dt>
                  <dd>{def}</dd>
                </div>
              ))}
            </dl>

            <div className="tx-section-head">Built with</div>
            <p className="tx-modal-text" data-testid="about-built-with">{BUILT_WITH}</p>

            <div className="tx-modal-actions">
              <button type="button" className="tx-btn is-on" data-testid="about-close" onClick={() => setShowAbout(false)}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tx-scan" aria-hidden="true" />
    </div>
  );
}
