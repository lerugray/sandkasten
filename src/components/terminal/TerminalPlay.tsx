"use client";

import "@/app/play/terminal.css";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { DetailPanel } from "@/components/map/DetailPanel";
import { FacilityPanel } from "@/components/map/FacilityPanel";
import { getFacility } from "@/lib/facilities/facilities";
import { OsintPanel } from "@/components/map/OsintPanel";
import { OSINT_ATTRIBUTION, OSINT_LAYERS, OSINT_LAYERS_ON, sitesFor } from "@/lib/osint/sites";
import type { OsintLayerState } from "@/lib/osint/sites";
import { ContactList } from "@/components/game/ContactList";
import { OrderPanel } from "@/components/game/OrderPanel";
import { useFireControls } from "@/components/game/useFireControls";
import { MessageLog } from "@/components/game/MessageLog";
import { CombatRecord, INITIAL_RECORD_VIEW, type RecordView } from "@/components/game/CombatRecord";
import { MediaFeed } from "@/components/game/infowar/MediaFeed";
import { HelpPanel } from "@/components/game/help/HelpPanel";
import { getBuiltinConfig, type BuiltinId } from "@/lib/scenarios/builtins";
import { SimulationSession, type ScenarioConfig } from "@/lib/simulation/session";
import { saveFileName, serializeBattle, type ParsedSave } from "@/lib/simulation/battleSave";
import { LoadBattleDialog, SaveNotice, battleClock, type SaveNoticeState } from "./BattleFile";
import { useSimulation } from "@/lib/simulation/useSimulation";
import type { FireIntent } from "@/lib/simulation/session";
import type { Unit } from "@/types/game";
import { useInfoWar } from "@/lib/infowar/useInfoWar";
import { SPEED_OPTIONS } from "@/lib/simulation/gameState";
import { formatMeasurement } from "@/lib/map/measure";
import type { PlotArea, PlotInput, PlotInsets } from "@/lib/plot/TacticalPlot";
import { trackNumber } from "@/lib/simulation/trackNumber";
import { UNIT_STATE_LABEL, describeEndings, endingNotes, explainResult, missionLines, missionProgress, openingBriefing, resultWord, transitObjective } from "@/lib/scenarios/objective";
import type { GeoPoint } from "@/lib/plot/projection";
import type { Contact } from "@/lib/simulation/gameState";
import { buildFog, contactDisplayName, ownForce, projectRecord, stateWord, visibleWeapons } from "@/lib/simulation/combatRecord";
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

type Tab = "forces" | "messages" | "combat" | "media";

const ROE_SHORT = { "weapons-hold": "HOLD", "weapons-tight": "TIGHT", "weapons-free": "FREE" } as const;

const AUTOPAUSE_LABELS: Record<string, string> = {
  newContact: "New contact detected",
  friendlyDamaged: "Friendly unit damaged",
  friendlyDestroyed: "Friendly unit destroyed",
  weaponIncoming: "Incoming weapon",
  scenarioMessage: "Intel message",
};

const TTY_TAG: Record<string, string> = {
  LAUNCH: "LNCH",
  INTERCEPT: "INTC",
  DAMAGED: "DMG",
  DEFENDED: "DEFD",
  INTEL: "INTL",
};

/** A function-key style command: key cap beside the button, outside its text. */
// Space is the clock key: after a result it must not also press the focused PLAY AGAIN (Enter and click do).
const swallowSpace = (e: React.KeyboardEvent) => {
  if (e.code === "Space") e.preventDefault();
};

function Cmd({
  cap,
  children,
  active,
  alarm,
  onClick,
  testId,
  ariaLabel,
  dataSpeed,
  disabled,
}: {
  cap?: string;
  children: React.ReactNode;
  active?: boolean;
  alarm?: boolean;
  onClick: () => void;
  testId?: string;
  ariaLabel?: string;
  dataSpeed?: number;
  disabled?: boolean;
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
        disabled={disabled}
        className={`tx-btn${active ? " is-on" : ""}${alarm ? " is-alarm" : ""}`}
      >
        {children}
      </button>
    </span>
  );
}

/**
 * The Three.js terminal play screen for one built-in configuration. The configuration is owned here, chosen by the
 * route (or by a loaded battle file) and never swapped into shared module state. A battle load replaces this whole
 * view with a fresh one built on the restored session, so no selection, order mode, dialog, God mode, timer or media
 * callback of the discarded run can survive into the loaded one.
 */
/**
 * `text` with its line turns written in as newlines, taken at spaces only, for a line of `cols` characters whose
 * first line already holds `lead` of them. Fewest lines first, then the narrowest measure that keeps that count, so
 * a second line is not left with one word. The browser's own wrap also turns after a hyphen, which split "C-802",
 * "(CVN-68)" and the "->" of a weapon row, and no CSS wrap mode forbids that turn; so the turns are chosen here.
 * The words are untouched. Before the first measurement (`cols` 0) the text is returned as it came.
 */
function turnAtSpaces(text: string, cols: number, lead = 0): string {
  if (cols <= lead) return text;
  const words = text.split(/\s+/).filter(Boolean);
  const lay = (width: number) => {
    const lines: string[] = [];
    let line = "";
    let room = width - lead;
    let fits = true;
    for (const w of words) {
      if (line && line.length + 1 + w.length > room) {
        lines.push(line);
        line = w;
        room = width;
      } else line = line ? `${line} ${w}` : w;
      if (line.length > room) fits = false;
    }
    lines.push(line);
    return { lines, fits };
  };
  let { lines } = lay(cols);
  if (lines.length === 1) return text;
  for (let width = cols - 1; width > lead; width--) {
    const narrower = lay(width);
    if (!narrower.fits || narrower.lines.length !== lines.length) break;
    lines = narrower.lines;
  }
  return lines.join("\n");
}

/** What a record line holds ahead of its text, less the tag: "06:00:00Z " and the space after the tag. */
const RECORD_LEAD = 11;

/**
 * A block that knows how many characters fit across it (the terminal face is monospace) and hands that count to
 * its children. The count comes from a hidden probe as wide as the block's content, holding a rule 10ch long; both
 * are watched, so a resize, a scrollbar or the web font arriving re-measures. The first count lands before paint.
 * The probe inherits the block's font, so the lines measured for must be set in that same size.
 */
function Measured({ children, ...rest }: Omit<React.HTMLAttributes<HTMLDivElement>, "children"> & { children: (cols: number) => React.ReactNode }) {
  const [cols, setCols] = useState(0);
  const watch = useRef<ResizeObserver | null>(null);
  const probe = useCallback((el: HTMLSpanElement | null) => {
    watch.current?.disconnect();
    watch.current = null;
    const rule = el?.firstElementChild;
    if (!el || !rule) return;
    const measure = () => {
      const ch = rule.getBoundingClientRect().width / 10;
      setCols(ch > 0 ? Math.floor(el.getBoundingClientRect().width / ch) : 0);
    };
    measure();
    watch.current = new ResizeObserver(measure);
    watch.current.observe(el);
    watch.current.observe(rule);
  }, []);
  return (
    <div {...rest}>
      <span className="tx-cols" ref={probe} aria-hidden="true"><i /></span>
      {children(cols)}
    </div>
  );
}

export function TerminalPlay({ configId = "hormuz" }: { configId?: BuiltinId }) {
  const [run, setRun] = useState<{ configId: BuiltinId; session: SimulationSession | null; epoch: number }>({ configId, session: null, epoch: 0 });
  const loadSession = useCallback((nextId: BuiltinId, session: SimulationSession) => {
    setRun((r) => ({ configId: nextId, session, epoch: r.epoch + 1 }));
    // keep the address honest: a reload of this page opens the scenario that is now on screen
    try {
      const url = nextId === "snapshot" ? "/play?scenario=snapshot" : "/play";
      if (window.location.pathname + window.location.search !== url) window.history.replaceState(window.history.state, "", url);
    } catch {
      // the address is a courtesy only
    }
  }, []);
  return <TerminalPlayView key={run.epoch} config={getBuiltinConfig(run.configId)} configId={run.configId} restored={run.session} onLoadSession={loadSession} />;
}

function TerminalPlayView({
  config,
  configId,
  restored,
  onLoadSession,
}: {
  config: ScenarioConfig;
  configId: BuiltinId;
  restored: SimulationSession | null;
  onLoadSession: (configId: BuiltinId, session: SimulationSession) => void;
}) {
  const {
    gameState,
    eventState,
    combatState,
    autopauseEvent,
    autopausePrefsRef,
    pause,
    togglePause,
    setSpeed,
    addWaypoint,
    clearWaypoints,
    setThrottle,
    toggleRadar,
    setRoe,
    engage,
    orderFeedback,
    markMessageRead,
    resetSimulation,
    setAutopausePrefs,
    mode,
    wego,
    modeLocked,
    ordersOpen,
    configureMode,
    commitOrders,
    nextTurn,
    cancelIntent,
    checkpoint,
  } = useSimulation(config, restored);

  const isWeGo = mode === "wego" && !!wego;
  const phase = wego?.phase ?? null;
  // The real-world snapshot route plays continuous only: it says so instead of offering an inert control.
  const modeChoice = !config.scenario.snapshot;

  const scenarioResult = eventState?.scenarioResult;
  const ended = !!scenarioResult;

  // The mission is read from the live scenario config at mount (the snapshot route swaps that config in
  // before this component loads), never cached at module level.
  const cfgScenario = config.scenario;
  const cfgEvents = config.events;
  const objective = useMemo(() => transitObjective({ scenario: cfgScenario, events: cfgEvents }), [cfgScenario, cfgEvents]);
  const opening = useMemo(() => openingBriefing({ scenario: cfgScenario, events: cfgEvents }), [cfgScenario, cfgEvents]);
  // The endings the running session evaluates (its own event list), stated only as far as the briefing may state them.
  const runEvents = eventState?.events;
  const endings = useMemo(
    () => describeEndings({ scenario: cfgScenario, events: runEvents ? { events: runEvents, firedEvents: new Set(), messages: [] } : cfgEvents }, cfgScenario.playerSide),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfgScenario, cfgEvents, runEvents, runEvents?.length],
  );
  const rules = useMemo(() => (objective ? missionLines(objective, endings) : null), [objective, endings]);
  const extraRules = useMemo(() => endings.rules.filter((r) => !r.transit), [endings]);
  const endingNote = useMemo(() => endingNotes(endings, !!objective), [endings, objective]);

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [selectedOsintId, setSelectedOsintId] = useState<string | null>(null);
  const [osintLayers, setOsintLayers] = useState<OsintLayerState>(OSINT_LAYERS_ON);
  const [facilityFocus, setFacilityFocus] = useState<{ n: number; facilityId: string } | null>(null);
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
  // A restored battle opens where it was left, on the plot: the briefing is a start-of-run card (B recalls it).
  const [showBriefing, setShowBriefing] = useState(!restored);
  // Battle files: the load dialog (a modal) and the notice after a save
  const [showLoad, setShowLoad] = useState(false);
  const [saveNotice, setSaveNotice] = useState<SaveNoticeState | null>(null);
  const modalOpenRef = useRef(false);
  modalOpenRef.current = showLoad;
  const lastSaveAtRef = useRef(0);
  const [reviewing, setReviewing] = useState(false);
  const [recordView, setRecordView] = useState<RecordView>(INITIAL_RECORD_VIEW);
  const [recordHold, setRecordHold] = useState<"review" | null>(null);
  const [recordFocusN, setRecordFocusN] = useState(0);
  const [areaFocus, setAreaFocus] = useState<{ n: number; areaId: string; include?: { lng: number; lat: number }[]; avoidRight?: number } | null>(null);
  const [homeRequest, setHomeRequest] = useState(0);
  const [moreBelow, setMoreBelow] = useState(false);
  const panelBodyRef = useRef<HTMLDivElement>(null);
  const ordersRef = useRef<HTMLElement>(null);
  const [orderFocusN, setOrderFocusN] = useState(0);
  const turnKeyAtRef = useRef(0);

  const cursorRef = useRef<HTMLSpanElement>(null);
  const scaleLabelRef = useRef<HTMLSpanElement>(null);
  const scaleBarRef = useRef<HTMLSpanElement>(null);
  const readouts = useMemo(() => ({ cursor: cursorRef, scaleLabel: scaleLabelRef, scaleBar: scaleBarRef }), []);
  const insets = useMemo<PlotInsets>(() => ({ left: LEFT_COL, right: 0, top: TOP_BAR, bottom: CMD_BAR + TTY_H }), []);

  const { infoWarState, toggleEnabled, markPostRead, resetInfoWar } = useInfoWar(
    gameState,
    combatState,
    eventState,
    config.infowar
  );

  const unreadMediaCount = infoWarState.posts.filter((p) => !p.read && p.simTime <= gameState.simTime).length;

  // Reopening the briefing holds the clock; the player resumes it.
  const openBriefing = useCallback(() => {
    pause();
    setShowBriefing(true);
  }, [pause]);
  const closeBriefing = useCallback(() => setShowBriefing(false), []);

  // The opening view frames the gate and the protected ship in the part of the plot the docked briefing leaves clear.
  // A restored battle frames the same objective around where the protected ship is now, with no briefing in the way.
  const frameOpening = useCallback((units?: Unit[]) => {
    if (!objective) return false;
    const pool = units ?? config.scenario.sides.flatMap((sd) => sd.units);
    const start = pool.find((u) => u.id === objective.unitId)?.position;
    const avoidRight = units ? undefined : Math.min(540, window.innerWidth - 420) + 28;
    setAreaFocus((f) => ({ n: (f?.n ?? 0) + 1, areaId: objective.areaId, include: start ? [start] : undefined, avoidRight }));
    return true;
  }, [objective, config]);
  useEffect(() => {
    frameOpening(restored ? gameState.sides.flatMap((sd) => sd.units) : undefined);
    // once, on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // a modal dialog owns the keyboard: no shortcut may reach the battle underneath it
      if (modalOpenRef.current) return;
      const el = e.target as HTMLElement;
      const typing =
        (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "checkbox") ||
        el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
      if (typing) return;
      if (e.code === "Space") {
        // Space is the clock key. A sidebar button that kept focus after a click must not take it (Enter still does).
        if (el === document.body || (el.tagName === "BUTTON" && el.closest('[data-testid="side-panel"]'))) {
          e.preventDefault();
          if (!ended && !e.repeat && (!isWeGo || phase === "resolving")) togglePause();
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (e.key === "Escape" && showBriefing && !showHelp && !showAutopauseSettings) {
        setShowBriefing(false);
      } else if (e.key === "Enter" && showBriefing && el === document.body) {
        e.preventDefault();
        // a double-tapped PLAY AGAIN must not also dismiss the fresh briefing
        if (!e.repeat && performance.now() - resetAtRef.current > 600) setShowBriefing(false);
      } else if (e.key === "Enter" && isWeGo && !ended && el === document.body) {
        // ENTER commits the plan or opens the next one; a held key or rapid repeats cannot double-fire.
        // While the record is held open over a review it only reads: BACK TO REVIEW is the way out.
        e.preventDefault();
        if (recordHold === "review") return;
        const now = performance.now();
        if (!e.repeat && now - turnKeyAtRef.current > 400) {
          turnKeyAtRef.current = now;
          if (phase === "planning") commitOrders();
          else if (phase === "review") nextTurn();
        }
      } else if (k === "b" && objective && !ended) {
        e.preventDefault();
        if (showBriefing) setShowBriefing(false);
        else openBriefing();
      } else if (k === "h" || e.key === "?") {
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
      } else if (/^[1-6]$/.test(e.key)) {
        e.preventDefault();
        if (!ended) setSpeed(SPEED_OPTIONS[Number(e.key) - 1]);
      } else if (e.key === "Escape") {
        if (showHelp) setShowHelp(false);
        else if (showAutopauseSettings) setShowAutopauseSettings(false);
        else if (measureMode) toggleMeasure();
        else if (isPlacingWaypoint) setIsPlacingWaypoint(false);
        else if (selectedUnitId) setSelectedUnitId(null);
        else if (selectedOsintId) setSelectedOsintId(null);
        else if (selectedFacilityId) setSelectedFacilityId(null);
      }
    };
    // Space on a focused sidebar button presses it on key-up: swallow that too (Enter is untouched).
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space" || modalOpenRef.current) return;
      const el = e.target as HTMLElement;
      if (el.tagName === "BUTTON" && el.closest('[data-testid="side-panel"]')) e.preventDefault();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [togglePause, setSpeed, toggleMeasure, ended, isWeGo, phase, commitOrders, nextTurn, showBriefing, objective, openBriefing, showHelp, showAutopauseSettings, measureMode, isPlacingWaypoint, selectedUnitId, selectedFacilityId, selectedOsintId, recordHold]);

  // The briefing closes only on a deliberate act (its own card or buttons, Enter, Esc, B) or when the clock starts.
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
  const selectedFacility = selectedFacilityId ? getFacility(selectedFacilityId) ?? null : null;
  const baseUnits = useMemo(
    () =>
      selectedFacilityId
        ? allUnits
            .filter((u) => u.homeBase?.facilityId === selectedFacilityId && u.damageState !== "destroyed" && (godMode || u.side === playerSide))
            .map((u) => ({ id: u.id, name: u.name, runwayEnd: u.homeBase?.runwayEnd }))
        : [],
    [allUnits, selectedFacilityId, godMode, playerSide],
  );
  const selectedOrders = selectedUnitId ? gameState.orders.get(selectedUnitId) : undefined;
  const contactTag = useCallback((c: Contact) => {
    const trueName = allUnits.find((u) => u.id === c.actualUnitId)?.name;
    return contactDisplayName(c, trackNumber, trueName);
  }, [allUnits]);
  // A staged or resolved fire order is shown under the same track number the selector and plot use, looked up by contact id.
  const intentTarget = useCallback(
    (i: FireIntent) => {
      const c = gameState.contacts.find((x) => x.id === i.contactId);
      return c ? contactTag(c) : i.contactLabel;
    },
    [gameState.contacts, contactTag],
  );
  const { fire, engageTarget, cycleTarget, setRoeFor, clearTarget } = useFireControls({
    unit: ordersOpen && selectedUnit && selectedUnit.side === gameState.scenario.playerSide ? selectedUnit : null,
    gameState,
    config: config,
    orderFeedback,
    setRoe,
    engage,
    contactLabel: contactTag,
  });

  const cycleRoe = useCallback(() => {
    if (!fire) return;
    setRoeFor(fire.roe === "weapons-tight" ? "weapons-free" : fire.roe === "weapons-free" ? "weapons-hold" : "weapons-tight");
  }, [fire, setRoeFor]);

  // RESET and PLAY AGAIN: a fresh paused run with the opening briefing; only harmless display choices survive
  // (tilt, OSINT layers, sensor coverage, autopause settings).
  const resetAtRef = useRef(0);
  const handleReset = useCallback(() => {
    resetAtRef.current = performance.now();
    resetSimulation();
    resetInfoWar();
    clearTarget();
    setHolds([]);
    setSelectedUnitId(null);
    setSelectedFacilityId(null);
    setSelectedOsintId(null);
    setPinnedRingIds(new Set());
    setIsPlacingWaypoint(false);
    setMeasureMode(false);
    setMeasureStart(null);
    setMeasureEnd(null);
    setShowHelp(false);
    setShowAutopauseSettings(false);
    setGodMode(false);
    setSidebarTab("forces");
    setFacilityFocus(null);
    setFocusRequest(null);
    setAreaFocus(null);
    setReviewing(false);
    setRecordView(INITIAL_RECORD_VIEW);
    setRecordHold(null);
    setRecordFocusN(0);
    setShowBriefing(true);
    if (!frameOpening()) setHomeRequest((n) => n + 1);
  }, [resetSimulation, resetInfoWar, clearTarget, frameOpening]);

  // SAVE BATTLE: pause at one atomic checkpoint and hand a versioned file to the browser's download.
  const handleSave = useCallback(() => {
    const now = performance.now();
    if (now - lastSaveAtRef.current < 600) return; // rapid repeats make one file, not a burst of downloads
    lastSaveAtRef.current = now;
    try {
      const dump = checkpoint();
      const text = serializeBattle(configId, dump);
      const name = saveFileName(configId, dump);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      const el = Math.max(0, dump.gameState.simTime - dump.gameState.scenario.startTime);
      setSaveNotice({ ok: true, name, bytes: blob.size, clock: battleClock(el) });
    } catch (err) {
      setSaveNotice({ ok: false, message: err instanceof Error ? err.message : "The battle could not be written to a file." });
    }
  }, [checkpoint, configId]);

  // LOAD BATTLE opens a modal over a held battle; nothing is replaced until a validated file is confirmed.
  const openLoad = useCallback(() => {
    pause();
    setSaveNotice(null);
    setShowLoad(true);
  }, [pause]);
  const confirmLoad = useCallback(
    (parsed: Extract<ParsedSave, { ok: true }>): string | null => {
      try {
        onLoadSession(parsed.envelope.configId, SimulationSession.restore(parsed.config, parsed.dump));
        return null;
      } catch {
        return "The battle could not be restored. Your current battle is unchanged.";
      }
    },
    [onLoadSession],
  );
  const hasProgress =
    gameState.simTime > gameState.scenario.startTime || [...gameState.orders.values()].some((o) => o.waypoints.length > 0);

  // a held review exists only while the turn is still in review
  useEffect(() => {
    if (phase !== "review" || ended) setRecordHold(null);
  }, [phase, ended]);

  // A result or a turn lock ends order entry: drop any half-made order mode and any armed target.
  useEffect(() => {
    if (ordersOpen) return;
    setIsPlacingWaypoint(false);
    clearTarget();
  }, [ordersOpen, clearTarget]);
  useEffect(() => {
    if (!ended) return;
    setIsPlacingWaypoint(false);
    setMeasureMode(false);
    setMeasureStart(null);
    setMeasureEnd(null);
    setShowBriefing(false);
  }, [ended]);

  // Fire keys: E engage, N next contact, R cycles the ROE, F/X set weapons free/hold directly
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !fire || modalOpenRef.current) return;
      const el = e.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === "e") engageTarget();
      else if (k === "n") cycleTarget();
      else if (k === "f") setRoeFor("weapons-free");
      else if (k === "r") cycleRoe();
      else if (k === "x") setRoeFor("weapons-hold");
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fire, engageTarget, cycleTarget, cycleRoe, setRoeFor]);
  const friendlyUnits = allUnits.filter((u) => u.side === playerSide);
  const messages = useMemo(() => eventState?.messages ?? [], [eventState?.messages]);
  const unreadCount = messages.filter((m) => !m.read).length;
  const weaponsInFlight = combatState?.weaponsInFlight ?? [];
  const combatLog = useMemo(() => combatState?.combatLog ?? [], [combatState?.combatLog]);

  // Fog of war in the traffic: an enemy is named only through the player's own contact (classified name, else track
  // label, else UNKNOWN TRACK). God mode shows true names.
  const fog = useMemo(
    () => buildFog({ units: allUnits, contacts: gameState.contacts, playerSide, godMode, trackNumber }),
    [allUnits, gameState.contacts, playerSide, godMode],
  );
  const unitName = useCallback(
    (id: string) => {
      const u = allUnits.find((x) => x.id === id);
      return u ? fog(u.name) : "UNKNOWN TRACK";
    },
    [allUnits, fog]
  );

  const record = useMemo(
    () => projectRecord({ combatLog, messages, units: allUnits, contacts: gameState.contacts, playerSide, godMode, trackNumber }),
    [combatLog, messages, allUnits, gameState.contacts, playerSide, godMode],
  );
  const ordinaryRecord = useMemo(() => record.filter((r) => !r.debug), [record]);
  const wifRows = useMemo(
    () => visibleWeapons(weaponsInFlight, { units: allUnits, contacts: gameState.contacts, playerSide, godMode, trackNumber }),
    [weaponsInFlight, allUnits, gameState.contacts, playerSide, godMode],
  );
  const force = useMemo(() => ownForce(allUnits, playerSide), [allUnits, playerSide]);
  const ownUnitList = useMemo(() => allUnits.filter((u) => u.side === playerSide).map((u) => ({ id: u.id, name: u.name })), [allUnits, playerSide]);
  const turnIds = useMemo(
    () => (wego?.report ? new Set<string>([...wego.report.events.map((e) => e.id), ...wego.report.messageIds]) : null),
    [wego?.report],
  );

  const ttyLines = useMemo<TtyLine[]>(() => {
    const lines: TtyLine[] = [];
    for (const r of record) lines.push({ id: r.id, time: r.time, tag: TTY_TAG[r.tag] ?? r.tag, text: r.text, alarm: r.alarm });
    if (!ended) lines.push(...holds);
    const snap = config.scenario.snapshot;
    if (snap) {
      const n = snap.counts.units;
      lines.push({ id: "snapshot", time: 0, tag: "ADSB", text: `SNAPSHOT ${snap.fetchedAt.slice(0, 16).replace("T", " ")}Z: ${n} AIRCRAFT IN VIEW, ALL LISTED UNDER FORCES`, alarm: false });
    }
    return lines.sort((a, b) => a.time - b.time).slice(-40);
  }, [record, holds, ended]);

  // Only the player's own objective geometry is drawn; no enemy mission areas, no detection implied.
  const plotAreas = useMemo<PlotArea[] | undefined>(
    () => (objective && objective.side === playerSide ? [{ id: objective.areaId, label: objective.gateLabel, points: objective.area }] : undefined),
    [objective, playerSide],
  );
  const progress = useMemo(
    () => (objective && objective.side === playerSide ? missionProgress(objective, allUnits, scenarioResult) : null),
    [objective, playerSide, allUnits, scenarioResult],
  );
  const focusGate = useCallback(() => {
    if (objective) setAreaFocus((f) => ({ n: (f?.n ?? 0) + 1, areaId: objective.areaId }));
  }, [objective]);
  const focusProtected = useCallback(() => {
    if (!objective) return;
    setSidebarTab("forces");
    setSelectedUnitId(objective.unitId);
    setOrderFocusN((n) => n + 1);
    setFocusRequest((prev) => ({ n: (prev?.n ?? 0) + 1, unitId: objective.unitId }));
  }, [objective]);

  // What happened, from the player's own picture: the deciding rule, the score, the clock, and the fogged traffic record.
  const cause = useMemo(
    () => (scenarioResult ? explainResult({ scenario: cfgScenario, events: runEvents ? { events: runEvents, firedEvents: new Set(), messages: [] } : cfgEvents }, playerSide, scenarioResult) : null),
    [scenarioResult, cfgScenario, cfgEvents, runEvents, playerSide],
  );
  const debrief = useMemo(() => {
    if (!scenarioResult || !cause) return null;
    const t0 = new Date(gameState.scenario.startTime).getTime();
    const el = Math.max(0, gameState.simTime - t0);
    const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
    const clock = `T+${pad(el / 3600000)}:${pad((el / 60000) % 60)}:${pad((el / 1000) % 60)}`;
    const kills = combatLog.filter((e) => e.type === "destroyed" && e.side === playerSide).length;
    let deciding: string;
    if (cause.kind === "transit-win" && objective && progress) {
      deciding = `${objective.unitShort} entered the ${objective.gateLabel.toLowerCase()} (${UNIT_STATE_LABEL[progress.unitState].toLowerCase()}).`;
    } else if (cause.kind === "transit-loss" && objective && progress) {
      const loss = [...combatLog].reverse().find((e) => e.type === "destroyed" && e.targetId === objective.unitId);
      const by = loss?.unitId ? ` by ${unitName(loss.unitId)}` : "";
      deciding = `${objective.unitShort} was destroyed${by}; the mission cannot be completed.`;
    } else if (cause.kind === "rule") {
      deciding = `Ending rule met: ${cause.rule.text}.`;
    } else {
      deciding = "A scenario-defined ending. Its conditions are not part of your briefing.";
    }
    const scoreNote =
      cause.kind === "rule" && cause.rule.usesScore
        ? "THE SCORE DECIDED THIS ENDING."
        : cause.kind === "unstated"
          ? null
          : "SCORE IS A TALLY. IT DID NOT DECIDE THIS ENDING.";
    const score = Object.entries(gameState.score).map(([side, value]) => ({ side, value }));
    const preview = ordinaryRecord.slice(-8);
    return { deciding, scoreNote, score, clock, kills, friendlyLosses: force.lost, record: preview, total: ordinaryRecord.length };
  }, [scenarioResult, cause, gameState.scenario.startTime, gameState.simTime, gameState.score, combatLog, playerSide, objective, progress, unitName, ordinaryRecord, force.lost]);

  const clockOf = (ms: number) => {
    const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
    return `${pad(ms / 60000)}:${pad((ms / 1000) % 60)}`;
  };

  // WeGo review: the turn's own-involved rows from the one record projection, by cursor membership.
  const review = useMemo(() => {
    const report = wego?.report;
    if (!report || !turnIds) return null;
    const rows = ordinaryRecord.filter((r) => turnIds.has(r.id));
    const killIds = new Set(report.events.filter((e) => e.type === "destroyed" && e.side === playerSide).map((e) => e.id));
    const kills = rows.filter((r) => killIds.has(r.id)).length;
    return { report, record: rows, kills };
  }, [wego?.report, turnIds, ordinaryRecord, playerSide]);

  const openRecord = useCallback((from: "review" | "debrief") => {
    setSidebarTab("combat");
    setRecordFocusN((n) => n + 1);
    if (from === "review") {
      setRecordHold("review");
      setRecordView({ ...INITIAL_RECORD_VIEW, scope: "turn" });
    } else {
      setReviewing(true);
      setRecordView({ ...INITIAL_RECORD_VIEW });
    }
  }, []);

  // Leaving the held record by keyboard must not let the same keystroke (or its immediate repeat) also open the next turn.
  const leaveHeldRecord = useCallback(() => {
    turnKeyAtRef.current = performance.now();
    setRecordHold(null);
  }, []);

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
    if (unitId) {
      setSelectedFacilityId(null);
      setSelectedOsintId(null);
      setOrderFocusN((n) => n + 1);
    }
    setIsPlacingWaypoint(false);
  }, []);

  // A pick on the map shows the unit's orders in the FORCES tab, wherever the sidebar was left.
  const selectOnMap = useCallback((unitId: string | null, shiftKey?: boolean) => {
    if (unitId) setSidebarTab("forces");
    handleUnitSelect(unitId, shiftKey);
  }, [handleUnitSelect]);

  const inspectOwn = useCallback((unitId: string) => {
    handleUnitSelect(unitId);
    setFocusRequest((prev) => ({ n: (prev?.n ?? 0) + 1, unitId }));
  }, [handleUnitSelect]);

  const handleFacilitySelect = useCallback((facilityId: string | null) => {
    setSelectedFacilityId(facilityId);
    if (facilityId) {
      setSelectedUnitId(null);
      setSelectedOsintId(null);
    }
  }, []);

  const handleOsintSelect = useCallback((siteId: string | null) => {
    setSelectedOsintId(siteId);
    if (siteId) {
      setSelectedUnitId(null);
      setSelectedFacilityId(null);
    }
  }, []);

  const osintVisible = useMemo(() => sitesFor(osintLayers, config.scenario.osint ?? []), [osintLayers]);
  const selectedOsint = selectedOsintId ? osintVisible.find((o) => o.id === selectedOsintId) ?? null : null;

  const showFacility = useCallback((facilityId: string) => {
    setSelectedFacilityId(facilityId);
    setFacilityFocus((f) => ({ n: (f?.n ?? 0) + 1, facilityId }));
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
      facilities: config.scenario.facilities,
      selectedFacilityId,
      osint: osintVisible,
      areas: plotAreas,
      selectedOsintId: selectedOsint ? selectedOsintId : null,
      mode: measureMode ? "measure" : isPlacingWaypoint && selectedUnitId ? "waypoint" : "select",
    }),
    [allUnits, playerSide, gameState.contacts, gameState.orders, gameState.simTime, godMode, weaponsInFlight, combatLog,
      selectedUnitId, pinnedRingIds, showSensorCoverage, measureStart, measureEnd, measureMode, isPlacingWaypoint,
      selectedFacilityId, osintVisible, plotAreas, selectedOsint, selectedOsintId]
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
  // Every selection (a re-click of the selected unit included) brings that unit's ORDERS into view.
  const showOrdersInView = useCallback(() => {
    const body = panelBodyRef.current;
    const sec = ordersRef.current;
    if (!body || !sec) return;
    const core = sec.querySelector<HTMLElement>('[data-testid="order-roe-note"]') ?? sec.querySelector<HTMLElement>('[data-testid="order-throttle-row"]') ?? sec;
    const base = body.getBoundingClientRect().top;
    const topRel = sec.getBoundingClientRect().top - base;
    const endRel = core.getBoundingClientRect().bottom - base + 8;
    // scroll the least that shows the title through the ROE rows; never push the title off the top
    let delta = 0;
    if (endRel > body.clientHeight) delta = endRel - body.clientHeight;
    if (topRel - delta < 0) delta = topRel;
    if (delta !== 0) body.scrollTop += delta;
    updateMore();
  }, [updateMore]);
  // ...and so does coming back to FORCES from another tab with a unit still selected.
  useEffect(() => {
    if (orderFocusN > 0 && sidebarTab === "forces") showOrdersInView();
  }, [orderFocusN, sidebarTab, showOrdersInView]);

  const clock = new Date(gameState.simTime).toISOString().replace("T", " ").slice(0, 19) + "Z";
  const prefs = autopausePrefsRef.current;
  const theater = config.scenario.theater.center;

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
        facilityFocusRequest={facilityFocus}
        areaFocusRequest={areaFocus}
        homeRequest={homeRequest}
        onFacilitySelect={handleFacilitySelect}
        onOsintSelect={handleOsintSelect}
        onUnitSelect={selectOnMap}
        onMapClick={handleMapClick}
      />

      {/* Status strip */}
      <header className="tx-top" data-testid="tx-top" data-plot-occluder>
        <a href="/" className="tx-brand">SANDKASTEN</a>
        <span className="tx-rule-v" />
        <span className="tx-dim tx-truncate">{gameState.scenario.name.toUpperCase()}</span>
        <span className="tx-rule-v" />
        <span data-testid="sim-clock" className="tx-clock">{clock}</span>
        {isWeGo && wego && (
          <span className="tx-turn-tag" data-testid="turn-tag">
            TURN {gameState.turnNumber}  //  {wego.turnMinutes} MIN
          </span>
        )}
        <span
          className={`tx-state${ended || (!isWeGo && gameState.isPaused) || (isWeGo && phase !== "resolving") ? " is-hold" : ""}`}
          data-testid="sim-state"
          data-phase={isWeGo ? phase : undefined}
        >
          {ended
            ? "[ENDED]"
            : isWeGo && wego
              ? phase === "resolving"
                ? gameState.isPaused
                  ? `[RESOLVING PAUSED ${clockOf(wego.remainingMs)} LEFT]`
                  : `[RESOLVING ${gameState.speed}X ${clockOf(wego.remainingMs)} LEFT]`
                : phase === "review"
                  ? "[REVIEW]"
                  : "[PLANNING]"
              : gameState.isPaused
                ? "[HOLD]"
                : `[RUN ${gameState.speed}X]`}
        </span>
        {autopauseEvent?.reason && gameState.isPaused && !ended && (
          <span data-testid="autopause-reason" className="tx-alarm tx-bold">
            {autopauseEvent.reason.toUpperCase()}
          </span>
        )}
        {isWeGo && wego && phase === "resolving" && !ended && (
          <span className="tx-top-progress" aria-hidden="true" style={{ transform: `scaleX(${Math.min(1, Math.max(0, 1 - wego.remainingMs / wego.turnLengthMs)).toFixed(4)})` }} />
        )}
        <span className="tx-top-right">
          <Cmd onClick={handleSave} testId="cmd-save" ariaLabel="Save battle to a file">SAVE BATTLE</Cmd>
          <Cmd onClick={openLoad} testId="cmd-load" ariaLabel="Load battle from a file">LOAD BATTLE</Cmd>
          <span className="tx-rule-v" />
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
        {objective && progress && (
          <section className="tx-mission" data-testid="mission-panel" aria-label="Mission">
            <div className="tx-mission-head">
              <span>[ MISSION ]</span>
              <span
                className={`tx-mission-status is-${progress.status}`}
                data-testid="mission-status"
                data-status={progress.status}
              >
                {progress.status === "pending" ? "PENDING" : progress.status === "complete" ? "COMPLETE" : progress.status === "failed" ? "FAILED" : "ENDED"}
              </span>
            </div>
            <div className="tx-mission-line" data-testid="mission-win"><b>WIN</b> {rules?.win}</div>
            <div className="tx-mission-line" data-testid="mission-lose"><b>LOSE</b> {rules?.lose}</div>
            {extraRules.map((r) => (
              <div key={r.event} className="tx-mission-line" data-testid="mission-extra"><b>{resultWord(r.result)}</b> {r.text}</div>
            ))}
            {endings.limited && <div className="tx-mission-line tx-dim" data-testid="mission-limited">OTHER ENDINGS NOT BRIEFED</div>}
            <div className="tx-mission-line tx-dim" data-testid="mission-progress">
              {objective.unitShort.toUpperCase()} {UNIT_STATE_LABEL[progress.unitState]}
              {progress.distanceNm !== null && progress.unitState !== "destroyed" && (
                <>  //  {progress.distanceNm === 0 ? "INSIDE GATE" : `${Math.round(progress.distanceNm)} NM TO GATE EDGE`}</>
              )}
            </div>
            <div className="tx-mission-actions">
              <Cmd onClick={focusGate} testId="mission-focus-gate" ariaLabel="Focus the transit gate on the map">GATE</Cmd>
              <Cmd onClick={focusProtected} testId="mission-focus-unit" ariaLabel={`Select and focus ${objective.unitShort}`}>{objective.unitShort.split(" ").pop()!.toUpperCase()}</Cmd>
              <Cmd cap="B" onClick={() => (showBriefing ? closeBriefing() : openBriefing())} testId="mission-briefing" active={showBriefing} disabled={ended} ariaLabel="Show or hide the briefing">BRIEFING</Cmd>
            </div>
          </section>
        )}
        {!objective && (extraRules.length > 0 || endings.limited) && (
          <section className="tx-mission" data-testid="rules-panel" aria-label="Endings">
            <div className="tx-mission-head"><span>[ ENDINGS ]</span></div>
            {extraRules.map((r) => (
              <div key={r.event} className="tx-mission-line" data-testid="mission-extra"><b>{resultWord(r.result)}</b> {r.text}</div>
            ))}
            {endings.limited && <div className="tx-mission-line tx-dim" data-testid="mission-limited">OTHER ENDINGS NOT BRIEFED</div>}
          </section>
        )}
        {isWeGo && wego && !ended && (
          <section className="tx-mission tx-turn" data-testid="turn-panel" data-phase={phase} aria-label="Turn">
            <div className="tx-mission-head">
              <span>[ TURN {gameState.turnNumber} ]</span>
              <span className="tx-mission-status" data-testid="turn-phase">
                {phase === "planning" ? "PLANNING" : phase === "resolving" ? "RESOLVING" : "REVIEW"}
              </span>
            </div>
            {phase === "planning" && (
              <>
                <div className="tx-mission-line">Time is held. Give orders, then commit: both sides move together for {wego.turnMinutes} min.</div>
                <div className="tx-mission-line tx-dim" data-testid="staged-count">
                  FIRE ORDERS STAGED {wego.intents.length}
                </div>
                {wego.intents.map((i) => (
                  <div key={i.id} className="tx-mission-line tx-staged" data-testid="staged-fire">
                    <span className="tx-truncate" data-contact-id={i.contactId} data-shooter-id={i.shooterId}>{i.shooterName.toUpperCase()} {"->"} {intentTarget(i)}</span>
                    <button type="button" className="tx-btn" data-testid="staged-cancel" onClick={() => cancelIntent(i.id)} onMouseDown={(e) => e.preventDefault()} aria-label={`Cancel fire order from ${i.shooterName}`}>
                      CANCEL
                    </button>
                  </div>
                ))}
                <div className="tx-mission-actions">
                  <Cmd cap="ENT" onClick={commitOrders} testId="cmd-commit-panel" ariaLabel="Commit orders and resolve the turn">COMMIT ORDERS</Cmd>
                </div>
              </>
            )}
            {phase === "resolving" && (
              <>
                <div className="tx-mission-line" data-testid="turn-remaining">
                  {clockOf(wego.remainingMs)} OF {wego.turnMinutes}:00 LEFT{gameState.isPaused ? "  //  PAUSED" : ""}
                </div>
                {/* the turn resolving, drawn: the bar fills as the burst runs out (no text, so nothing new to read) */}
                <div className="tx-turn-bar" aria-hidden="true" data-testid="turn-bar">
                  <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, 1 - wego.remainingMs / wego.turnLengthMs)).toFixed(4)})` }} />
                </div>
                <div className="tx-mission-line tx-dim">Orders are locked until the turn resolves. You can still look around.</div>
              </>
            )}
            {phase === "review" && <div className="tx-mission-line">Turn resolved. Review it, then plan the next one.</div>}
          </section>
        )}
        <div data-testid="sidebar-tabs" className="tx-tabs">
          {(
            [
              ["forces", "Forces", null],
              ["messages", "Intel", unreadCount > 0 ? unreadCount : null],
              ["combat", "Combat", wifRows.length > 0 ? wifRows.length : null],
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

              {ended && selectedUnit && selectedUnit.side === playerSide && (
                <section className="tx-section tx-dim" data-testid="orders-locked">
                  ORDERS LOCKED: THE MISSION HAS ENDED. PLAY AGAIN FOR A NEW RUN.
                </section>
              )}
              {isWeGo && !ended && !ordersOpen && selectedUnit && selectedUnit.side === playerSide && (
                <section className="tx-section tx-dim" data-testid="orders-locked">
                  ORDERS LOCKED: {phase === "resolving" ? "THE TURN IS RESOLVING." : "REVIEW THE TURN, THEN PRESS NEXT TURN TO PLAN."}
                </section>
              )}
              {ordersOpen && selectedUnit && selectedOrders && selectedUnit.side === playerSide && (
                <section className="tx-section" ref={ordersRef} data-testid="orders-section">
                  <OrderPanel
                    unit={selectedUnit}
                    orders={selectedOrders}
                    isPlacingWaypoint={isPlacingWaypoint}
                    onToggleWaypointMode={() => setIsPlacingWaypoint((p) => !p)}
                    onClearWaypoints={() => clearWaypoints(selectedUnit.id)}
                    onSetThrottle={(t) => setThrottle(selectedUnit.id, t)}
                    onToggleRadar={() => toggleRadar(selectedUnit.id)}
                    fire={fire}
                  />
                </section>
              )}

              <section className="tx-section">
                <div className="tx-section-head">Contacts ({gameState.contacts.length})</div>
                <ContactList contacts={gameState.contacts} simTime={gameState.simTime} contactLabel={contactTag} />
              </section>
            </>
          )}

          {sidebarTab === "messages" && (
            <section className="tx-section">
              <MessageLog messages={messages} simTime={gameState.simTime} onMarkRead={markMessageRead} />
            </section>
          )}

          {sidebarTab === "combat" && (
            <section className="tx-section">
              {wifRows.length > 0 && (
                <Measured className="tx-wif">
                  {(cols) => (
                    <>
                      <div className="tx-section-head tx-alarm">
                        <span data-testid="weapons-in-flight-count">Weapons in Flight ({wifRows.length})</span>
                      </div>
                      {/* a row hangs 3ch under its ">> " mark, so the label has cols - 3 on every line */}
                      {wifRows.map((w) => (
                        <div key={w.id} className={`tx-wif-row${w.debug ? " is-god" : ""}`} data-testid="weapon-row">
                          <span className="tx-alarm">{">>"}</span> {w.debug ? "[GOD] " : ""}<span className="tx-turns">{turnAtSpaces(w.label, cols - 3, w.debug ? 6 : 0)}</span>
                        </div>
                      ))}
                    </>
                  )}
                </Measured>
              )}
              <CombatRecord
                rows={record}
                turnIds={turnIds}
                view={recordView}
                onView={setRecordView}
                force={force}
                ownUnits={ownUnitList}
                selectedUnitId={selectedUnitId}
                onInspect={inspectOwn}
                autoFocus={recordFocusN > 0}
                key={recordFocusN}
                returnLabel={recordHold === "review" ? "BACK TO REVIEW" : reviewing ? "BACK TO DEBRIEF" : undefined}
                onReturn={recordHold === "review" ? leaveHeldRecord : reviewing ? () => setReviewing(false) : undefined}
              />
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
        <div className={`tx-more${moreBelow ? " is-on" : ""}`} aria-hidden="true" data-testid="more-cue">{moreBelow ? "-- MORE --" : ""}</div>
      </aside>

      {showBriefing && !ended && (
        <section
          className="tx-panel tx-briefing"
          data-testid="briefing"
          data-plot-occluder
          role="dialog"
          aria-label="Briefing"
        >
          <div className="tx-briefing-head">
            <span>[ BRIEFING ]</span>
            <span className="tx-dim">{gameState.scenario.name.toUpperCase()}</span>
          </div>
          <div className="tx-briefing-title">{opening.title.toUpperCase()}</div>
          <p className="tx-briefing-text">{opening.text}</p>
          {objective && (
            <div className="tx-briefing-mission" data-testid="briefing-mission">
              <div><b>PROTECT</b> {rules?.protect}</div>
              <div><b>WIN</b> {rules?.win}</div>
              <div><b>LOSE</b> {rules?.lose}</div>
              {extraRules.map((r) => (
                <div key={r.event} data-testid="briefing-extra"><b>{resultWord(r.result)}</b> {r.text}</div>
              ))}
              <div className="tx-dim" data-testid="briefing-rule-note">{rules?.notes}</div>
            </div>
          )}
          {!objective && (
            <div className="tx-briefing-mission" data-testid="briefing-rules">
              <div className="tx-mission-head"><span>[ ENDINGS ]</span></div>
              {extraRules.map((r) => (
                <div key={r.event} data-testid="briefing-extra"><b>{resultWord(r.result)}</b> {r.text}</div>
              ))}
              <div className="tx-dim" data-testid="briefing-rule-note">{endingNote}</div>
            </div>
          )}
          <div className="tx-briefing-mode" data-testid="briefing-mode">
            <div className="tx-mission-head"><span>[ MODE ]</span></div>
            {modeChoice ? (
              <>
                <div className="tx-briefing-mode-row">
                  <button
                    type="button"
                    className={`tx-btn${!isWeGo ? " is-on" : ""}`}
                    data-testid="mode-continuous"
                    onMouseDown={(e) => e.preventDefault()}
                    aria-pressed={!isWeGo}
                    disabled={modeLocked}
                    onClick={() => configureMode({ mode: "continuous" })}
                  >
                    CONTINUOUS
                  </button>
                  <button
                    type="button"
                    className={`tx-btn${isWeGo ? " is-on" : ""}`}
                    data-testid="mode-wego"
                    onMouseDown={(e) => e.preventDefault()}
                    aria-pressed={isWeGo}
                    disabled={modeLocked}
                    onClick={() => configureMode({ mode: "wego" })}
                  >
                    WEGO
                  </button>
                  {isWeGo && wego && (
                    <span className="tx-briefing-mode-len" data-testid="turn-length">
                      <span className="tx-dim">TURN</span>
                      {[1, 5, 15].map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`tx-btn${wego.turnMinutes === m ? " is-on" : ""}`}
                          data-testid={`turn-length-${m}`}
                          onMouseDown={(e) => e.preventDefault()}
                          aria-pressed={wego.turnMinutes === m}
                          disabled={modeLocked}
                          onClick={() => configureMode({ mode: "wego", turnMinutes: m })}
                        >
                          {m} MIN
                        </button>
                      ))}
                    </span>
                  )}
                </div>
                <div className="tx-briefing-mode-text" data-testid="mode-explain">
                  {isWeGo
                    ? "WeGo vs AI. Give orders, resolve together, review."
                    : "Continuous: real-time play. You can pause, and orders take effect at once."}
                  {modeLocked ? "  The mode is locked once the run starts; RESET restarts it." : ""}
                </div>
              </>
            ) : (
              <div className="tx-briefing-mode-text" data-testid="mode-continuous-only">CONTINUOUS ONLY on this real-world snapshot route.</div>
            )}
          </div>
          <div className="tx-briefing-foot">
            <span>
              {isWeGo
                ? "ESC OR ENTER TO TAKE COMMAND  //  COMMIT ORDERS (ENTER) STARTS TURN 1  //  B RECALLS THIS BRIEFING"
                : "ESC OR ENTER TO TAKE COMMAND  //  SPC STARTS THE CLOCK  //  B RECALLS THIS BRIEFING"}
            </span>
            <span className="tx-briefing-actions">
              {objective && (
                <button
                  type="button"
                  className="tx-btn"
                  data-testid="briefing-show-gate"
                  onClick={() => {
                    focusGate();
                    closeBriefing();
                  }}
                >
                  SHOW GATE
                </button>
              )}
              <button type="button" className="tx-btn is-on" data-testid="briefing-close" onClick={closeBriefing}>
                TAKE COMMAND
              </button>
            </span>
          </div>
        </section>
      )}

      {/* Right column: the selected track */}
      {selectedUnit && (selectedUnit.side === playerSide || !(isWeGo && phase === "review" && !ended)) && (
        <div className="tx-right" data-plot-occluder data-testid="detail-column">
          <DetailPanel
            unit={selectedUnit}
            onClose={() => setSelectedUnitId(null)}
            onShowFacility={showFacility}
            className="tx-panel tx-detail"
          />
        </div>
      )}
      {selectedFacility && (
        <div className="tx-right" data-plot-occluder>
          <FacilityPanel
            facility={selectedFacility}
            baseUnits={baseUnits}
            onClose={() => setSelectedFacilityId(null)}
            className="tx-panel tx-detail tx-facility"
          />
        </div>
      )}

      {selectedOsint && (
        <div className="tx-right" data-plot-occluder>
          <OsintPanel site={selectedOsint} onClose={() => setSelectedOsintId(null)} className="tx-panel tx-detail tx-facility" />
        </div>
      )}

      {isWeGo && wego && phase === "review" && review && !ended && recordHold === "review" && (
        <div className="tx-banner tx-result-strip" data-testid="review-hold-strip" data-plot-occluder>
          <span>[ REVIEW ] TURN {review.report.turn} HELD</span>
          <button type="button" className="tx-btn is-on" data-testid="review-back" onClick={leaveHeldRecord} onMouseDown={(e) => e.preventDefault()}>
            BACK TO REVIEW
          </button>
        </div>
      )}
      {isWeGo && wego && phase === "review" && review && !ended && recordHold !== "review" && (
        <section
          className={`tx-panel tx-briefing tx-review${selectedUnit && selectedUnit.side === playerSide ? " has-detail" : ""}`}
          data-testid="turn-review" data-plot-occluder role="region" aria-label="Turn review">
          <div className="tx-briefing-head">
            <span>[ REVIEW ] TURN {review.report.turn}</span>
            <span className="tx-dim">ELAPSED {clockOf(review.report.elapsedMs)}  //  {new Date(review.report.endTime).toISOString().slice(11, 19)}Z</span>
          </div>
          <div className="tx-review-body">
            <div data-testid="review-losses">
              <b>YOUR LOSSES</b>{" "}
              {review.report.ownLosses.filter((l) => l.to === "destroyed").length === 0
                ? "NONE"
                : review.report.ownLosses.filter((l) => l.to === "destroyed").map((l) => `${l.name.toUpperCase()} LOST`).join("  //  ")}
            </div>
            <div data-testid="review-damage">
              <b>DAMAGE</b>{" "}
              {review.report.ownLosses.filter((l) => l.to !== "destroyed").length === 0
                ? "NONE"
                : review.report.ownLosses.filter((l) => l.to !== "destroyed").map((l) => `${l.name.toUpperCase()} ${stateWord(l.to)}`).join("  //  ")}
            </div>
            {review.report.outcomes.length > 0 && (
              <div data-testid="review-fire">
                <b>FIRE ORDERS</b>{" "}
                {review.report.outcomes.map((o, n) => (
                  <span
                    key={o.intent.id}
                    data-testid="review-fire-item"
                    data-shooter-id={o.intent.shooterId}
                    data-contact-id={o.intent.contactId}
                    data-status={o.ok ? "launched" : "refused"}
                  >
                    {n > 0 ? "  //  " : ""}
                    {o.intent.shooterName.toUpperCase()} {"->"} {intentTarget(o.intent)}: {o.ok ? "LAUNCHED" : "REFUSED, " + o.message.toUpperCase()}
                  </span>
                ))}
              </div>
            )}
            {review.report.alerts.length > 0 && (
              <div className="tx-alarm" data-testid="review-alerts"><b>ALERTS</b> {review.report.alerts.map((a) => a.toUpperCase()).join("  //  ")}</div>
            )}
            <div className="tx-section-head">Record</div>
            <div className="tx-dim" data-testid="review-record-count">
              {review.record.length <= 5
                ? `ALL ${review.record.length} OF ${review.record.length} THIS TURN SHOWN`
                : `SHOWING LATEST 5 OF ${review.record.length} THIS TURN  //  ${review.record.length - 5} EARLIER NOT SHOWN HERE`}
            </div>
            {review.record.length === 0 && <div className="tx-dim">NOTHING OBSERVED THIS TURN</div>}
            <Measured>
              {(cols) => review.record.slice(-5).map((l) => (
                <div key={l.id} className={`tx-result-line${l.alarm ? " is-alarm" : ""}`}>
                  {new Date(l.time).toISOString().slice(11, 19)}Z {l.tag} <span className="tx-turns">{turnAtSpaces(l.text, cols, RECORD_LEAD + l.tag.length)}</span>
                </div>
              ))}
            </Measured>
            <div className="tx-dim" data-testid="review-contacts">CONTACTS HELD {gameState.contacts.length}  //  HOSTILE KILLS CONFIRMED {review.kills}</div>
          </div>
          <div className="tx-briefing-foot">
            <span>ENTER OR NEXT TURN OPENS PLANNING AT THIS EXACT STATE</span>
            <span className="tx-briefing-actions">
              <button type="button" className="tx-btn" data-testid="review-view-record" onClick={() => openRecord("review")} onMouseDown={(e) => e.preventDefault()}>
                VIEW RECORD ({review.record.length})
              </button>
              <button type="button" className="tx-btn is-on" data-testid="review-next-turn" onClick={nextTurn} onMouseDown={(e) => e.preventDefault()}>
                NEXT TURN
              </button>
            </span>
          </div>
        </section>
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

      <div className="tx-credit" data-testid="plot-attribution" data-plot-occluder>
        Facilities © OpenStreetMap contributors (ODbL), OurAirports (public domain). Land, coast, depth: Natural Earth, NOAA ETOPO1 (public domain). {OSINT_ATTRIBUTION}
      </div>

      {config.scenario.osint?.length ? (
        <div className="tx-osint-toggles" data-testid="plot-osint-toggles" data-plot-occluder>
          <span className="tx-group-label">OSINT</span>
          {OSINT_LAYERS.map((l) => (
            <Cmd
              key={l.id}
              onClick={() => setOsintLayers((p) => ({ ...p, [l.id]: !p[l.id] }))}
              active={osintLayers[l.id]}
              testId={`plot-toggle-osint-${l.id}`}
              ariaLabel={`Toggle ${l.label}`}
            >
              {l.short}
            </Cmd>
          ))}
        </div>
      ) : null}

      <Teletype
        lines={ttyLines}
        scale={
          <div className="tx-scale" data-testid="plot-scale" aria-hidden="true">
            <span ref={scaleBarRef} className="tx-scale-bar" />
            <span ref={scaleLabelRef} className="tx-scale-label" />
          </div>
        }
      />

      {/* Command bar */}
      <nav className="tx-cmd" data-testid="command-bar" data-plot-occluder>
        {isWeGo && phase === "planning" && !ended && (
          <Cmd cap="ENT" onClick={commitOrders} testId="cmd-commit" alarm ariaLabel="Commit orders and resolve the turn">
            COMMIT ORDERS
          </Cmd>
        )}
        {isWeGo && phase === "review" && !ended && (
          <Cmd cap="ENT" onClick={nextTurn} testId="cmd-next-turn" alarm ariaLabel="Open the next planning phase">
            NEXT TURN
          </Cmd>
        )}
        {(!isWeGo || phase === "resolving") && (
          <Cmd cap="SPC" onClick={togglePause} testId="sim-toggle-pause" active={!gameState.isPaused} disabled={ended}>
            {gameState.isPaused ? (isWeGo ? "RESUME" : "PLAY") : "PAUSE"}
          </Cmd>
        )}
        <span className="tx-rule-v" />
        <span className="tx-group-label">TIME</span>
        {SPEED_OPTIONS.map((s, i) => (
          <Cmd key={s} cap={String(i + 1)} onClick={() => setSpeed(s)} testId="sim-speed" dataSpeed={s} active={gameState.speed === s} disabled={ended}>
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
        <span className="tx-rule-v" />
        <Cmd cap="E" onClick={engageTarget} testId="cmd-engage" disabled={!ordersOpen} ariaLabel={isWeGo ? "Stage a fire order on the selected contact" : "Engage selected contact"}>ENGAGE</Cmd>
        <Cmd cap="R" onClick={cycleRoe} testId="cmd-roe" disabled={!ordersOpen} active={fire?.roe === "weapons-free"} alarm={fire?.roe === "weapons-free"} ariaLabel="Cycle rules of engagement">
          {fire ? ROE_SHORT[fire.roe] : "ROE"}
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
        <Cmd cap="H" onClick={() => setShowHelp(true)} ariaLabel="Open help">
          HELP
        </Cmd>
        <span className="tx-cmd-right">
          <Cmd onClick={handleReset} testId="cmd-reset" ariaLabel="Reset to a fresh briefing">RESET</Cmd>
        </span>
      </nav>

      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} terminal />}

      {scenarioResult && debrief && !reviewing && (
        <div className="tx-result-backdrop" data-testid="result-overlay">
          <div className="tx-panel tx-result" role="dialog" aria-label="Mission result">
            <div className={`tx-result-title${scenarioResult.result === "defeat" ? " tx-alarm" : ""}`} data-testid="result-title">
              [ {scenarioResult.result.toUpperCase()} ]
            </div>
            <p data-testid="result-message">{scenarioResult.message}</p>
            <div className="tx-result-facts" data-testid="result-debrief">
              <div data-testid="result-deciding"><b>DECIDED BY</b> {debrief.deciding}</div>
              <div data-testid="result-score">
                <b>FINAL SCORE</b>{" "}
                {debrief.score.map((e, i) => (
                  <span key={e.side}>{i > 0 ? "  //  " : ""}{e.side.toUpperCase()} {e.value}</span>
                ))}
                {debrief.scoreNote && <span className="tx-dim" data-testid="result-score-note">  {debrief.scoreNote}</span>}
              </div>
              <div><b>MISSION CLOCK</b> {debrief.clock}</div>
              {isWeGo && wego && (
                <div data-testid="result-turns"><b>TURNS</b> {wego.turnsCommitted} COMMITTED  //  {wego.turnMinutes} MIN EACH  //  WEGO</div>
              )}
              <div data-testid="result-losses"><b>YOUR LOSSES</b> {debrief.friendlyLosses}  //  <b>HOSTILE KILLS CONFIRMED</b> {debrief.kills}</div>
              <div data-testid="result-condition">
                <b>OWN FORCE</b> {force.total - force.damaged - force.missionKill - force.lost} UNDAMAGED  //  {force.damaged} DAMAGED  //  {force.missionKill} MISSION KILL  //  {force.lost} LOST
              </div>
              {force.affected.length > 0 && (
                <div data-testid="result-affected">
                  {force.affected.map((a) => `${a.name.toUpperCase()} ${stateWord(a.state)}`).join("  //  ")}
                </div>
              )}
            </div>
            <div className="tx-result-record" data-testid="result-record">
              <div className="tx-section-head">Record</div>
              {debrief.record.length === 0 && <div className="tx-dim">NO TRAFFIC RECORDED</div>}
              <Measured>
                {(cols) => debrief.record.map((l) => (
                  <div key={l.id} className={`tx-result-line${l.alarm ? " is-alarm" : ""}`}>
                    {new Date(l.time).toISOString().slice(11, 19)}Z {l.tag} <span className="tx-turns">{turnAtSpaces(l.text, cols, RECORD_LEAD + l.tag.length)}</span>
                  </div>
                ))}
              </Measured>
              <div className="tx-dim" data-testid="result-record-count">
                {debrief.total <= debrief.record.length
                  ? `ALL ${debrief.total} OF ${debrief.total} ENTRIES SHOWN`
                  : `SHOWING LATEST ${debrief.record.length} OF ${debrief.total}  //  ${debrief.total - debrief.record.length} EARLIER NOT SHOWN HERE`}
              </div>
            </div>
            <div className="tx-result-actions">
              <button type="button" onClick={handleReset} onKeyDown={swallowSpace} onKeyUp={swallowSpace} className="tx-btn is-on" data-testid="play-again" autoFocus>PLAY AGAIN</button>
              <button type="button" onClick={() => openRecord("debrief")} className="tx-btn" data-testid="debrief-view-record">VIEW RECORD ({debrief.total})</button>
              <button type="button" onClick={() => setReviewing(true)} className="tx-btn" data-testid="review-record">REVIEW RECORD</button>
              <button type="button" onClick={handleSave} className="tx-btn" data-testid="result-save">SAVE BATTLE</button>
              <button type="button" onClick={openLoad} className="tx-btn" data-testid="result-load">LOAD BATTLE</button>
              <a href="/" className="tx-btn">MAIN MENU</a>
            </div>
          </div>
        </div>
      )}
      {scenarioResult && reviewing && (
        <div className="tx-banner tx-result-strip" data-testid="result-strip" data-plot-occluder>
          <span className={scenarioResult.result === "defeat" ? "tx-result-strip-bad" : undefined}>[ {scenarioResult.result.toUpperCase()} ]</span>
          <button type="button" onClick={handleReset} onKeyDown={swallowSpace} onKeyUp={swallowSpace} className="tx-btn is-on" data-testid="play-again">PLAY AGAIN</button>
          <button type="button" onClick={() => setReviewing(false)} className="tx-btn" data-testid="show-debrief">DEBRIEF</button>
        </div>
      )}

      {saveNotice && <SaveNotice notice={saveNotice} onDismiss={() => setSaveNotice(null)} />}
      {showLoad && <LoadBattleDialog hasProgress={hasProgress} ended={ended} onCancel={() => setShowLoad(false)} onConfirm={confirmLoad} />}

      <div className="tx-scan" aria-hidden="true" />
    </div>
  );
}
