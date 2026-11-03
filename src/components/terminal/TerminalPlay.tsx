"use client";

import "@/app/play/terminal.css";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { DetailPanel } from "@/components/map/DetailPanel";
import { ContactList } from "@/components/game/ContactList";
import { OrderPanel } from "@/components/game/OrderPanel";
import { MessageLog } from "@/components/game/MessageLog";
import { CombatLog } from "@/components/game/CombatLog";
import { MediaFeed } from "@/components/game/infowar/MediaFeed";
import { HelpPanel } from "@/components/game/help/HelpPanel";
import { demoScenarioConfig } from "@/lib/scenarios/demoConfig";
import { useSimulation } from "@/lib/simulation/useSimulation";
import { useInfoWar } from "@/lib/infowar/useInfoWar";
import { SPEED_OPTIONS } from "@/lib/simulation/gameState";
import { formatMeasurement } from "@/lib/map/measure";
import { trackNumber, type PlotInput, type PlotInsets } from "@/lib/plot/TacticalPlot";
import type { GeoPoint } from "@/lib/plot/projection";
import type { Contact } from "@/lib/simulation/gameState";
import type { CombatEvent } from "@/lib/simulation/combat";
import { Teletype, type TtyLine } from "./Teletype";

const PlotView = dynamic(() => import("@/components/plot/PlotView"), { ssr: false });

const FONT_URLS = [
  "/fonts/jetbrains-mono/jetbrains-mono-latin-400-normal.woff2",
  "/fonts/jetbrains-mono/jetbrains-mono-latin-700-normal.woff2",
];

// Chrome geometry in CSS px. The plot canvas always fills the window; these
// only tell it where the free area sits so the theater centres in it.
const TOP_BAR = 44;
const CMD_BAR = 56;
const LEFT_COL = 360;
const TTY_H = 150;
const RIGHT_COL = 400;

type Tab = "forces" | "messages" | "combat" | "media";

const CLS_LABEL: Record<Contact["classification"], string> = {
  unknown: "UNK",
  detected: "DET",
  classified: "CLS",
  tracked: "TRK",
};

// The scenario's opening message is the mission objective; the briefing card
// shows it in full before the clock starts.
const OPENING = (() => {
  for (const ev of demoScenarioConfig.events?.events ?? []) {
    if (!ev.triggers.some((t) => t.type === "ScenarioLoaded")) continue;
    for (const a of ev.actions) {
      if (a.type === "DisplayMessage") return { title: a.title ?? "BRIEFING", text: a.text };
    }
  }
  return { title: "BRIEFING", text: demoScenarioConfig.scenario.briefing };
})();

const AUTOPAUSE_LABELS: Record<string, string> = {
  newContact: "New contact detected",
  friendlyDamaged: "Friendly unit damaged",
  friendlyDestroyed: "Friendly unit destroyed",
  weaponIncoming: "Incoming weapon",
  scenarioMessage: "Intel message",
};

const COMBAT_TAG: Record<string, string> = {
  launch: "LNCH",
  intercept: "INTC",
  hit: "HIT ",
  miss: "MISS",
  destroyed: "KILL",
  damaged: "DMG ",
  defended: "DEFD",
};

/** A function-key style command: key cap beside the button, outside its text. */
function Cmd({
  cap,
  children,
  active,
  alarm,
  onClick,
  testId,
  ariaLabel,
  dataSpeed,
}: {
  cap?: string;
  children: React.ReactNode;
  active?: boolean;
  alarm?: boolean;
  onClick: () => void;
  testId?: string;
  ariaLabel?: string;
  dataSpeed?: number;
}) {
  return (
    <span className="tx-key">
      {cap && <kbd className="tx-cap" aria-hidden="true">{cap}</kbd>}
      <button
        type="button"
        onClick={onClick}
        // keep focus on the page so single-key commands keep working
        onMouseDown={(e) => e.preventDefault()}
        data-testid={testId}
        data-speed={dataSpeed}
        data-active={active ? "true" : "false"}
        aria-label={ariaLabel}
        aria-pressed={active}
        className={`tx-btn${active ? " is-on" : ""}${alarm ? " is-alarm" : ""}`}
      >
        {children}
      </button>
    </span>
  );
}

export function TerminalPlay() {
  const {
    gameState,
    eventState,
    combatState,
    autopauseEvent,
    autopausePrefsRef,
    togglePause,
    setSpeed,
    addWaypoint,
    clearWaypoints,
    setThrottle,
    toggleRadar,
    markMessageRead,
    resetSimulation,
    setAutopausePrefs,
  } = useSimulation(demoScenarioConfig);

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [pinnedRingIds, setPinnedRingIds] = useState<Set<string>>(new Set());
  const [isPlacingWaypoint, setIsPlacingWaypoint] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<Tab>("forces");
  const [showHelp, setShowHelp] = useState(false);
  const [godMode, setGodMode] = useState(false);
  const [showSensorCoverage, setShowSensorCoverage] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [measureStart, setMeasureStart] = useState<GeoPoint | null>(null);
  const [measureEnd, setMeasureEnd] = useState<GeoPoint | null>(null);
  const [showAutopauseSettings, setShowAutopauseSettings] = useState(false);
  const [tilt, setTilt] = useState(false);
  const [, forcePrefsRender] = useState(0);
  const [holds, setHolds] = useState<TtyLine[]>([]);
  const [focusRequest, setFocusRequest] = useState<{ n: number; unitId: string } | null>(null);
  const [showBriefing, setShowBriefing] = useState(true);
  const [moreBelow, setMoreBelow] = useState(false);
  const panelBodyRef = useRef<HTMLDivElement>(null);

  const cursorRef = useRef<HTMLSpanElement>(null);
  const scaleLabelRef = useRef<HTMLSpanElement>(null);
  const scaleBarRef = useRef<HTMLSpanElement>(null);
  const readouts = useMemo(() => ({ cursor: cursorRef, scaleLabel: scaleLabelRef, scaleBar: scaleBarRef }), []);
  // the track panel takes the right column while a unit is selected
  const insets = useMemo<PlotInsets>(
    () => ({ left: LEFT_COL, right: selectedUnitId ? RIGHT_COL : 0, top: TOP_BAR, bottom: CMD_BAR + TTY_H }),
    [selectedUnitId !== null] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const { infoWarState, toggleEnabled, markPostRead, resetInfoWar } = useInfoWar(
    gameState,
    combatState,
    eventState,
    demoScenarioConfig.infowar
  );

  const unreadMediaCount = infoWarState.posts.filter((p) => !p.read && p.simTime <= gameState.simTime).length;

  const handleReset = useCallback(() => {
    resetSimulation();
    resetInfoWar();
    setHolds([]);
  }, [resetSimulation, resetInfoWar]);

  const toggleMeasure = useCallback(() => {
    setMeasureMode((prev) => {
      if (prev) {
        setMeasureStart(null);
        setMeasureEnd(null);
      }
      return !prev;
    });
  }, []);

  const setPrefs = useCallback(
    (prefs: typeof autopausePrefsRef.current) => {
      setAutopausePrefs(prefs);
      forcePrefsRender((n) => n + 1);
    },
    [setAutopausePrefs]
  );

  // Keyboard commands
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      const typing =
        (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "checkbox") ||
        el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
      if (typing) return;
      if (e.code === "Space") {
        // a focused button takes Space itself; only the bare page toggles time
        if (el === document.body) {
          e.preventDefault();
          togglePause();
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "h" || e.key === "?") {
        e.preventDefault();
        setShowHelp((p) => !p);
      } else if (k === "g") {
        e.preventDefault();
        setGodMode((p) => !p);
      } else if (k === "s") {
        e.preventDefault();
        setShowSensorCoverage((p) => !p);
      } else if (k === "m") {
        e.preventDefault();
        toggleMeasure();
      } else if (k === "t") {
        e.preventDefault();
        setTilt((p) => !p);
      } else if (k === "a") {
        e.preventDefault();
        setShowAutopauseSettings((p) => !p);
      } else if (k === "b") {
        // reopen the briefing; while it is open any key (B too) dismisses it
        e.preventDefault();
        if (!showBriefing) setShowBriefing(true);
      } else if (/^[1-6]$/.test(e.key)) {
        e.preventDefault();
        setSpeed(SPEED_OPTIONS[Number(e.key) - 1]);
      } else if (e.key === "Escape") {
        if (showHelp) setShowHelp(false);
        else if (showAutopauseSettings) setShowAutopauseSettings(false);
        else if (measureMode) toggleMeasure();
        else if (isPlacingWaypoint) setIsPlacingWaypoint(false);
        else if (selectedUnitId) setSelectedUnitId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePause, setSpeed, toggleMeasure, showHelp, showAutopauseSettings, measureMode, isPlacingWaypoint, selectedUnitId, showBriefing]);

  // The briefing card goes away on the first key or click anywhere, and when
  // the clock starts. It never swallows that input: the key or click still acts.
  useEffect(() => {
    if (!showBriefing) return;
    const dismiss = () => setShowBriefing(false);
    window.addEventListener("keydown", dismiss, true);
    window.addEventListener("pointerdown", dismiss, true);
    return () => {
      window.removeEventListener("keydown", dismiss, true);
      window.removeEventListener("pointerdown", dismiss, true);
    };
  }, [showBriefing]);
  useEffect(() => {
    if (!gameState.isPaused) setShowBriefing(false);
  }, [gameState.isPaused]);

  // Autopause: switch the panel tab and print a HOLD line on the teletype
  useEffect(() => {
    if (!autopauseEvent) return;
    if (autopauseEvent.suggestedTab) setSidebarTab(autopauseEvent.suggestedTab);
    const t = gameState.simTime;
    setHolds((prev) => [
      ...prev.slice(-30),
      { id: `hold-${t}-${prev.length}`, time: t, tag: "HOLD", text: `AUTOPAUSE  ${autopauseEvent.reason.toUpperCase()}`, alarm: true },
    ]);
    // print once per autopause event
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopauseEvent]);

  const allUnits = useMemo(() => gameState.sides.flatMap((s) => s.units), [gameState.sides]);
  const playerSide = gameState.scenario.playerSide;
  const selectedUnit = selectedUnitId ? allUnits.find((u) => u.id === selectedUnitId) : null;
  const selectedOrders = selectedUnitId ? gameState.orders.get(selectedUnitId) : undefined;
  const friendlyUnits = allUnits.filter((u) => u.side === playerSide);
  const messages = useMemo(() => eventState?.messages ?? [], [eventState?.messages]);
  const unreadCount = messages.filter((m) => !m.read).length;
  const scenarioResult = eventState?.scenarioResult;
  const weaponsInFlight = combatState?.weaponsInFlight ?? [];
  const combatLog = useMemo(() => combatState?.combatLog ?? [], [combatState?.combatLog]);

  // Fog of war in the traffic: an enemy is named only once its contact carries
  // a classified platform name. Before that it is its track number and
  // classification level, or UNKNOWN TRACK if no sensor holds it. God mode
  // shows true names.
  const fogNames = useMemo(() => {
    if (godMode) return null;
    const byUnit = new Map(gameState.contacts.map((c) => [c.actualUnitId, c]));
    return allUnits
      .filter((u) => u.side !== playerSide)
      .map((u) => {
        const c = byUnit.get(u.id);
        const label = c ? (c.platformName ? c.platformName : `TN${trackNumber(c.id)} ${CLS_LABEL[c.classification]}`) : "UNKNOWN TRACK";
        return [u.name, label] as const;
      })
      .sort((a, b) => b[0].length - a[0].length);
  }, [godMode, gameState.contacts, allUnits, playerSide]);
  const fog = useCallback(
    (text: string) => (fogNames ? fogNames.reduce((acc, [name, label]) => acc.split(name).join(label), text) : text),
    [fogNames]
  );
  const describeEvent = useCallback((e: CombatEvent) => fog(e.description), [fog]);
  const unitName = useCallback(
    (id: string) => {
      const u = allUnits.find((x) => x.id === id);
      return u ? fog(u.name) : "UNKNOWN TRACK";
    },
    [allUnits, fog]
  );

  const ttyLines = useMemo<TtyLine[]>(() => {
    const lines: TtyLine[] = [];
    for (const e of combatLog) {
      const hostileAct = e.side !== playerSide && (e.type === "launch" || e.type === "hit" || e.type === "destroyed" || e.type === "damaged");
      lines.push({ id: e.id, time: e.time, tag: COMBAT_TAG[e.type] ?? e.type.toUpperCase(), text: fog(e.description).toUpperCase(), alarm: hostileAct });
    }
    for (const m of messages) {
      lines.push({ id: m.id, time: m.time, tag: "INTL", text: `${m.title ? m.title.toUpperCase() + "  " : ""}${m.text.toUpperCase()}`, alarm: false });
    }
    lines.push(...holds);
    return lines.sort((a, b) => a.time - b.time).slice(-40);
  }, [combatLog, messages, holds, playerSide, fog]);

  const handleUnitSelect = useCallback((unitId: string | null, shiftKey?: boolean) => {
    if (unitId && shiftKey) {
      setPinnedRingIds((prev) => {
        const next = new Set(prev);
        if (next.has(unitId)) next.delete(unitId);
        else next.add(unitId);
        return next;
      });
    }
    setSelectedUnitId(unitId);
    setIsPlacingWaypoint(false);
  }, []);

  // The plot calls back between React renders, so read live values from a ref
  // rather than a closure that may be one click behind.
  const clickStateRef = useRef({ measureMode, measureStart, measureEnd, isPlacingWaypoint, selectedUnitId });
  clickStateRef.current = { measureMode, measureStart, measureEnd, isPlacingWaypoint, selectedUnitId };
  const handleMapClick = useCallback(
    (lngLat: GeoPoint) => {
      const s = clickStateRef.current;
      if (s.measureMode) {
        if (!s.measureStart || s.measureEnd) {
          s.measureStart = lngLat;
          s.measureEnd = null;
          setMeasureStart(lngLat);
          setMeasureEnd(null);
        } else {
          s.measureEnd = lngLat;
          setMeasureEnd(lngLat);
        }
        return true;
      }
      if (s.isPlacingWaypoint && s.selectedUnitId) {
        addWaypoint(s.selectedUnitId, lngLat);
        return true;
      }
    },
    [addWaypoint]
  );

  const plotInput = useMemo<PlotInput>(
    () => ({
      units: allUnits,
      playerSide,
      contacts: gameState.contacts,
      orders: gameState.orders,
      fogOfWar: !godMode,
      weaponsInFlight,
      combatLog,
      selectedUnitId,
      pinnedRingIds,
      showSensorCoverage,
      measureStart,
      measureEnd,
      simTime: gameState.simTime,
      mode: measureMode ? "measure" : isPlacingWaypoint && selectedUnitId ? "waypoint" : "select",
    }),
    [allUnits, playerSide, gameState.contacts, gameState.orders, gameState.simTime, godMode, weaponsInFlight, combatLog,
      selectedUnitId, pinnedRingIds, showSensorCoverage, measureStart, measureEnd, measureMode, isPlacingWaypoint]
  );

  // "-- MORE --" pager cue when the left panel has content below the fold
  const updateMore = useCallback(() => {
    const el = panelBodyRef.current;
    if (!el) return;
    setMoreBelow(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);
  useEffect(() => {
    updateMore();
  });

  const clock = new Date(gameState.simTime).toISOString().replace("T", " ").slice(0, 19) + "Z";
  const prefs = autopausePrefsRef.current;
  const theater = demoScenarioConfig.scenario.theater.center;

  return (
    <div className="tx-root" data-testid="terminal-root">
      {FONT_URLS.map((href) => (
        <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
      ))}
      <PlotView
        input={plotInput}
        origin={theater}
        tilt={tilt}
        insets={insets}
        readouts={readouts}
        focusRequest={focusRequest}
        onUnitSelect={handleUnitSelect}
        onMapClick={handleMapClick}
      />

      {/* Status strip */}
      <header className="tx-top" data-testid="tx-top" data-plot-occluder>
        <a href="/" className="tx-brand">SANDKASTEN</a>
        <span className="tx-rule-v" />
        <span className="tx-dim tx-truncate">{gameState.scenario.name.toUpperCase()}</span>
        <span className="tx-rule-v" />
        <span data-testid="sim-clock" className="tx-clock">{clock}</span>
        <span className={`tx-state${gameState.isPaused ? " is-hold" : ""}`} data-testid="sim-state">
          {gameState.isPaused ? "[HOLD]" : `[RUN ${gameState.speed}X]`}
        </span>
        {autopauseEvent?.reason && gameState.isPaused && (
          <span data-testid="autopause-reason" className="tx-alarm tx-bold">
            {autopauseEvent.reason.toUpperCase()}
          </span>
        )}
        <span className="tx-top-right">
          {Object.entries(gameState.score).map(([side, score]) => (
            <span key={side} className="tx-score">
              <span className="tx-dim">{side.toUpperCase()}</span> {score}
            </span>
          ))}
          <span className="tx-rule-v" />
          <span className="tx-dim">CSR</span> <span ref={cursorRef} className="tx-cursor" data-testid="cursor-readout" />
        </span>
      </header>

      {/* Left column: forces, intel, combat, media */}
      <aside className="tx-panel tx-left" data-testid="side-panel" data-plot-occluder>
        <div data-testid="sidebar-tabs" className="tx-tabs">
          {(
            [
              ["forces", "Forces", null],
              ["messages", "Intel", unreadCount > 0 ? unreadCount : null],
              ["combat", "Combat", weaponsInFlight.length > 0 ? weaponsInFlight.length : null],
              ["media", "Media", unreadMediaCount > 0 ? unreadMediaCount : null],
            ] as const
          ).map(([id, label, badge]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSidebarTab(id)}
              onMouseDown={(e) => e.preventDefault()}
              data-testid={`sidebar-tab-${id}`}
              data-active={sidebarTab === id ? "true" : "false"}
              className={`tx-tab${sidebarTab === id ? " is-on" : ""}`}
            >
              {label}
              {badge !== null && (
                <span
                  className={`tx-badge${id === "combat" ? " is-alarm" : ""}`}
                  data-testid={id === "combat" ? "weapons-in-flight-badge" : undefined}
                >
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="tx-panel-body" ref={panelBodyRef} onScroll={updateMore}>
          {sidebarTab === "forces" && (
            <>
              <section className="tx-section">
                <div className="tx-section-head">Forces ({friendlyUnits.length})</div>
                {friendlyUnits.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    data-testid="force-row"
                    data-unit-id={u.id}
                    onClick={(e) => {
                      handleUnitSelect(u.id, e.shiftKey);
                      setFocusRequest((prev) => ({ n: (prev?.n ?? 0) + 1, unitId: u.id }));
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`tx-row${selectedUnitId === u.id ? " is-on" : ""}${u.damageState !== "undamaged" ? " is-hurt" : ""}`}
                  >
                    <span className="tx-row-mark">{selectedUnitId === u.id ? ">" : pinnedRingIds.has(u.id) ? "o" : " "}</span>
                    <span className="tx-truncate">{u.name}</span>
                    {u.damageState !== "undamaged" && <span className="tx-alarm">{u.damageState === "destroyed" ? "LOST" : "DMG"}</span>}
                  </button>
                ))}
              </section>

              {selectedUnit && selectedOrders && selectedUnit.side === playerSide && (
                <section className="tx-section">
                  <OrderPanel
                    unit={selectedUnit}
                    orders={selectedOrders}
                    isPlacingWaypoint={isPlacingWaypoint}
                    onToggleWaypointMode={() => setIsPlacingWaypoint((p) => !p)}
                    onClearWaypoints={() => clearWaypoints(selectedUnit.id)}
                    onSetThrottle={(t) => setThrottle(selectedUnit.id, t)}
                    onToggleRadar={() => toggleRadar(selectedUnit.id)}
                  />
                </section>
              )}

              <section className="tx-section">
                <div className="tx-section-head">Contacts ({gameState.contacts.length})</div>
                <ContactList contacts={gameState.contacts} simTime={gameState.simTime} contactLabel={(c) => `TN${trackNumber(c.id)}`} />
              </section>
            </>
          )}

          {sidebarTab === "messages" && (
            <>
              {/* The objective stays readable after the briefing card closes.
                  The scenario's opening message only fires at slow speeds
                  (ScenarioLoaded is a 1 s window), so it is pinned here. */}
              {!messages.some((m) => m.title === OPENING.title) && (
                <section className="tx-section tx-pinned" data-testid="intel-briefing">
                  <div className="tx-section-head">Briefing</div>
                  <div className="tx-pinned-title">{OPENING.title.toUpperCase()}</div>
                  <p className="tx-pinned-text">{OPENING.text}</p>
                  <div className="tx-dim">[B] reopens the briefing card</div>
                </section>
              )}
              <section className="tx-section">
                <MessageLog messages={messages} simTime={gameState.simTime} onMarkRead={markMessageRead} />
              </section>
            </>
          )}

          {sidebarTab === "combat" && (
            <section className="tx-section">
              {weaponsInFlight.length > 0 && (
                <div className="tx-wif">
                  <div className="tx-section-head tx-alarm">
                    <span data-testid="weapons-in-flight-count">Weapons in Flight ({weaponsInFlight.length})</span>
                  </div>
                  {weaponsInFlight.map((w) => (
                    <div key={w.id} className="tx-wif-row">
                      <span className="tx-alarm">{">>"}</span> {w.name} {"->"} {unitName(w.targetId)}
                    </div>
                  ))}
                </div>
              )}
              <CombatLog events={combatLog} simTime={gameState.simTime} playerSide={playerSide} describe={describeEvent} />
            </section>
          )}

          {sidebarTab === "media" && (
            <MediaFeed
              infoWarState={infoWarState}
              simTime={gameState.simTime}
              onToggleEnabled={toggleEnabled}
              onMarkRead={markPostRead}
            />
          )}
        </div>
        {moreBelow && <div className="tx-more" aria-hidden="true">-- MORE --</div>}
      </aside>

      {showBriefing && (
        <section className="tx-panel tx-briefing" data-testid="briefing" data-plot-occluder role="dialog" aria-label="Briefing">
          <div className="tx-briefing-head">
            <span>[ BRIEFING ]</span>
            <span className="tx-dim">{gameState.scenario.name.toUpperCase()}</span>
          </div>
          <div className="tx-briefing-title">{OPENING.title.toUpperCase()}</div>
          <p className="tx-briefing-text">{OPENING.text}</p>
          <div className="tx-briefing-foot">PRESS ANY KEY OR CLICK TO TAKE COMMAND  //  SPC STARTS THE CLOCK</div>
        </section>
      )}

      {/* Right column: the selected track */}
      {selectedUnit && (
        <div className="tx-right" data-plot-occluder>
          <DetailPanel
            unit={selectedUnit}
            onClose={() => setSelectedUnitId(null)}
            className="tx-panel tx-detail"
          />
        </div>
      )}

      {/* Mode banners */}
      {isPlacingWaypoint && <div className="tx-banner" data-plot-occluder>CLICK MAP TO PLACE WAYPOINT</div>}
      {measureMode && (
        <div className="tx-banner" data-testid="measure-banner" data-plot-occluder>
          {measureStart && measureEnd
            ? formatMeasurement(measureStart, measureEnd).toUpperCase()
            : measureStart
              ? "CLICK END POINT"
              : "CLICK START POINT"}
        </div>
      )}

      {/* Scale */}
      <div className="tx-scale" aria-hidden="true" data-plot-occluder>
        <span ref={scaleBarRef} className="tx-scale-bar" />
        <span ref={scaleLabelRef} className="tx-scale-label" />
      </div>

      <Teletype lines={ttyLines} />

      {/* Command bar */}
      <nav className="tx-cmd" data-testid="command-bar" data-plot-occluder>
        <Cmd cap="SPC" onClick={togglePause} testId="sim-toggle-pause" active={!gameState.isPaused}>
          {gameState.isPaused ? "PLAY" : "PAUSE"}
        </Cmd>
        <span className="tx-rule-v" />
        <span className="tx-group-label">TIME</span>
        {SPEED_OPTIONS.map((s, i) => (
          <Cmd key={s} cap={String(i + 1)} onClick={() => setSpeed(s)} testId="sim-speed" dataSpeed={s} active={gameState.speed === s}>
            {s}x
          </Cmd>
        ))}
        <span className="tx-rule-v" />
        <Cmd cap="S" onClick={() => setShowSensorCoverage((v) => !v)} active={showSensorCoverage} ariaLabel="Toggle sensor coverage">
          SENSORS
        </Cmd>
        <Cmd cap="M" onClick={toggleMeasure} active={measureMode} ariaLabel="Toggle measurement">
          MEASURE
        </Cmd>
        <Cmd cap="G" onClick={() => setGodMode((g) => !g)} active={godMode} alarm={godMode} ariaLabel="Toggle god mode">
          GOD
        </Cmd>
        <Cmd cap="T" onClick={() => setTilt((v) => !v)} active={tilt} ariaLabel="Toggle 3D tilt">
          TILT
        </Cmd>
        <span className="tx-anchor">
          <Cmd cap="A" onClick={() => setShowAutopauseSettings((s) => !s)} active={prefs.enabled} ariaLabel="Autopause settings">
            AUTO
          </Cmd>
          {showAutopauseSettings && (
            <div data-testid="autopause-settings" className="tx-panel tx-popover" data-plot-occluder>
              <div className="tx-popover-head">
                <span>AUTOPAUSE</span>
                <button
                  type="button"
                  onClick={() => setPrefs({ ...prefs, enabled: !prefs.enabled })}
                  data-testid="autopause-toggle-enabled"
                  className={`tx-btn${prefs.enabled ? " is-on" : ""}`}
                >
                  {prefs.enabled ? "ON" : "OFF"}
                </button>
              </div>
              {(["newContact", "friendlyDamaged", "friendlyDestroyed", "weaponIncoming", "scenarioMessage"] as const).map((key) => (
                <label key={key} className="tx-check">
                  <input
                    type="checkbox"
                    checked={prefs.triggers[key]}
                    onChange={() => setPrefs({ ...prefs, triggers: { ...prefs.triggers, [key]: !prefs.triggers[key] } })}
                    data-testid={`autopause-trigger-${key}`}
                  />
                  <span className="tx-check-box" aria-hidden="true">{prefs.triggers[key] ? "[X]" : "[ ]"}</span>
                  {AUTOPAUSE_LABELS[key]}
                </label>
              ))}
            </div>
          )}
        </span>
        <span className="tx-rule-v" />
        <Cmd cap="B" onClick={() => setShowBriefing(true)} active={showBriefing} ariaLabel="Show briefing">
          BRIEF
        </Cmd>
        <Cmd cap="H" onClick={() => setShowHelp(true)} ariaLabel="Open help">
          HELP
        </Cmd>
        <span className="tx-cmd-right">
          <Cmd onClick={handleReset}>RESET</Cmd>
        </span>
      </nav>

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} terminal />}

      {scenarioResult && (
        <div className="tx-result-backdrop">
          <div className="tx-panel tx-result">
            <div className={`tx-result-title${scenarioResult.result === "defeat" ? " tx-alarm" : ""}`}>
              [ {scenarioResult.result.toUpperCase()} ]
            </div>
            <p>{scenarioResult.message}</p>
            <div className="tx-result-actions">
              <button type="button" onClick={handleReset} className="tx-btn is-on">PLAY AGAIN</button>
              <a href="/" className="tx-btn">MAIN MENU</a>
            </div>
          </div>
        </div>
      )}

      <div className="tx-scan" aria-hidden="true" />
    </div>
  );
}
