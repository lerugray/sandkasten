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
import { CombatLog } from "@/components/game/CombatLog";
import { MediaFeed } from "@/components/game/infowar/MediaFeed";
import { HelpPanel } from "@/components/game/help/HelpPanel";
import { demoScenarioConfig } from "@/lib/scenarios/demoConfig";
import { useSimulation } from "@/lib/simulation/useSimulation";
import { useInfoWar } from "@/lib/infowar/useInfoWar";
import { SPEED_OPTIONS } from "@/lib/simulation/gameState";
import { formatMeasurement } from "@/lib/map/measure";
import { trackNumber, type PlotArea, type PlotInput, type PlotInsets } from "@/lib/plot/TacticalPlot";
import { UNIT_STATE_LABEL, missionLines, missionProgress, openingBriefing, transitObjective } from "@/lib/scenarios/objective";
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

type Tab = "forces" | "messages" | "combat" | "media";

const ROE_SHORT = { "weapons-hold": "HOLD", "weapons-tight": "TIGHT", "weapons-free": "FREE" } as const;

const CLS_LABEL: Record<Contact["classification"], string> = {
  unknown: "UNK",
  detected: "DET",
  classified: "CLS",
  tracked: "TRK",
};

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

export function TerminalPlay() {
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
  } = useSimulation(demoScenarioConfig);

  const scenarioResult = eventState?.scenarioResult;
  const ended = !!scenarioResult;

  // The mission is read from the live scenario config at mount (the snapshot route swaps that config in
  // before this component loads), never cached at module level.
  const cfgScenario = demoScenarioConfig.scenario;
  const cfgEvents = demoScenarioConfig.events;
  const objective = useMemo(() => transitObjective({ scenario: cfgScenario, events: cfgEvents }), [cfgScenario, cfgEvents]);
  const opening = useMemo(() => openingBriefing({ scenario: cfgScenario, events: cfgEvents }), [cfgScenario, cfgEvents]);

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
  const [showBriefing, setShowBriefing] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [areaFocus, setAreaFocus] = useState<{ n: number; areaId: string } | null>(null);
  const [homeRequest, setHomeRequest] = useState(0);
  const [moreBelow, setMoreBelow] = useState(false);
  const panelBodyRef = useRef<HTMLDivElement>(null);

  const cursorRef = useRef<HTMLSpanElement>(null);
  const scaleLabelRef = useRef<HTMLSpanElement>(null);
  const scaleBarRef = useRef<HTMLSpanElement>(null);
  const readouts = useMemo(() => ({ cursor: cursorRef, scaleLabel: scaleLabelRef, scaleBar: scaleBarRef }), []);
  const insets = useMemo<PlotInsets>(() => ({ left: LEFT_COL, right: 0, top: TOP_BAR, bottom: CMD_BAR + TTY_H }), []);

  const { infoWarState, toggleEnabled, markPostRead, resetInfoWar } = useInfoWar(
    gameState,
    combatState,
    eventState,
    demoScenarioConfig.infowar
  );

  const unreadMediaCount = infoWarState.posts.filter((p) => !p.read && p.simTime <= gameState.simTime).length;

  // Reopening the briefing holds the clock; the player resumes it.
  const openBriefing = useCallback(() => {
    pause();
    setShowBriefing(true);
  }, [pause]);
  const closeBriefing = useCallback(() => setShowBriefing(false), []);

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
          if (!ended) togglePause();
        }
        return;
      }
      const k = e.key.toLowerCase();
      if (e.key === "Escape" && showBriefing) {
        setShowBriefing(false);
      } else if (e.key === "Enter" && showBriefing && el === document.body) {
        e.preventDefault();
        setShowBriefing(false);
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
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePause, setSpeed, toggleMeasure, ended, showBriefing, objective, openBriefing, showHelp, showAutopauseSettings, measureMode, isPlacingWaypoint, selectedUnitId, selectedFacilityId, selectedOsintId]);

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
  const contactTag = useCallback((c: Contact) => `${c.platformName ?? `TN${trackNumber(c.id)}`} ${CLS_LABEL[c.classification]}`, []);
  const { fire, engageTarget, cycleTarget, setRoeFor, clearTarget } = useFireControls({
    unit: !ended && selectedUnit && selectedUnit.side === gameState.scenario.playerSide ? selectedUnit : null,
    gameState,
    config: demoScenarioConfig,
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
  const handleReset = useCallback(() => {
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
    setShowBriefing(true);
    setHomeRequest((n) => n + 1);
  }, [resetSimulation, resetInfoWar, clearTarget]);

  // A result ends order entry: drop any half-made order mode.
  useEffect(() => {
    if (!ended) return;
    setIsPlacingWaypoint(false);
    setShowBriefing(false);
  }, [ended]);

  // Fire keys: E engage, N next contact, R cycles the ROE, F/X set weapons free/hold directly
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !fire) return;
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
    const snap = demoScenarioConfig.scenario.snapshot;
    if (snap) {
      const n = snap.counts.units;
      lines.push({ id: "snapshot", time: 0, tag: "ADSB", text: `SNAPSHOT ${snap.fetchedAt.slice(0, 16).replace("T", " ")}Z: ${n} AIRCRAFT IN VIEW, ALL LISTED UNDER FORCES`, alarm: false });
    }
    return lines.sort((a, b) => a.time - b.time).slice(-40);
  }, [combatLog, messages, holds, playerSide, fog]);

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
    setSelectedUnitId(objective.unitId);
    setFocusRequest((prev) => ({ n: (prev?.n ?? 0) + 1, unitId: objective.unitId }));
  }, [objective]);

  // What happened, from the player's own picture: the deciding condition, the clock, and the fogged traffic record.
  const debrief = useMemo(() => {
    if (!scenarioResult) return null;
    const t0 = new Date(gameState.scenario.startTime).getTime();
    const el = Math.max(0, gameState.simTime - t0);
    const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
    const clock = `T+${pad(el / 3600000)}:${pad((el / 60000) % 60)}:${pad((el / 1000) % 60)}`;
    const kills = combatLog.filter((e) => e.type === "destroyed" && e.side === playerSide).length;
    const friendlyLosses = friendlyUnits.filter((u) => u.damageState === "destroyed").length;
    let deciding: string;
    if (objective && progress) {
      if (scenarioResult.result === "victory") {
        deciding = `${objective.unitShort} entered the ${objective.gateLabel.toLowerCase()} afloat (${UNIT_STATE_LABEL[progress.unitState].toLowerCase()}).`;
      } else if (scenarioResult.result === "defeat") {
        const loss = [...combatLog].reverse().find((e) => e.type === "destroyed" && e.targetId === objective.unitId);
        const by = loss?.unitId ? ` by ${unitName(loss.unitId)}` : "";
        deciding = `${objective.unitShort} was destroyed${by}; the mission cannot be completed.`;
      } else {
        deciding = scenarioResult.message;
      }
    } else {
      deciding = scenarioResult.message;
    }
    const record = ttyLines.filter((l) => l.tag !== "HOLD" && l.tag !== "ADSB").slice(-8);
    return { deciding, clock, kills, friendlyLosses, record };
  }, [scenarioResult, gameState.scenario.startTime, gameState.simTime, combatLog, playerSide, friendlyUnits, objective, progress, unitName, ttyLines]);

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
    }
    setIsPlacingWaypoint(false);
  }, []);

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

  const osintVisible = useMemo(() => sitesFor(osintLayers, demoScenarioConfig.scenario.osint ?? []), [osintLayers]);
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
      facilities: demoScenarioConfig.scenario.facilities,
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
  // when the list overflows, end it on a whole row above the cue: no half row under "-- MORE --"
  const snapPanelBody = useCallback(() => {
    const el = panelBodyRef.current;
    if (!el) return;
    el.style.maxHeight = "";
    const panel = el.parentElement;
    if (!panel || el.scrollHeight <= el.clientHeight + 1) return;
    const cueH = 28;
    const avail = el.clientHeight - cueH;
    let bottom = 0;
    const top = el.getBoundingClientRect().top;
    el.querySelectorAll<HTMLElement>(".tx-row").forEach((row) => {
      const b = row.getBoundingClientRect().bottom - top;
      if (b <= avail && b > bottom) bottom = b;
    });
    if (bottom > 0) el.style.maxHeight = `${Math.round(bottom)}px`;
  }, []);
  useEffect(() => {
    snapPanelBody();
    const panel = panelBodyRef.current?.parentElement;
    if (!panel || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => snapPanelBody());
    ro.observe(panel);
    return () => ro.disconnect();
  }, [snapPanelBody, sidebarTab, friendlyUnits.length]);

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
        facilityFocusRequest={facilityFocus}
        areaFocusRequest={areaFocus}
        homeRequest={homeRequest}
        onFacilitySelect={handleFacilitySelect}
        onOsintSelect={handleOsintSelect}
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
            <div className="tx-mission-line" data-testid="mission-win"><b>WIN</b> {missionLines(objective).win}</div>
            <div className="tx-mission-line" data-testid="mission-lose"><b>LOSE</b> {missionLines(objective).lose}</div>
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

              {ended && selectedUnit && selectedUnit.side === playerSide && (
                <section className="tx-section tx-dim" data-testid="orders-locked">
                  ORDERS LOCKED: THE MISSION HAS ENDED. PLAY AGAIN FOR A NEW RUN.
                </section>
              )}
              {!ended && selectedUnit && selectedOrders && selectedUnit.side === playerSide && (
                <section className="tx-section">
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
                <ContactList contacts={gameState.contacts} simTime={gameState.simTime} contactLabel={(c) => `TN${trackNumber(c.id)}`} />
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

      {showBriefing && !ended && (
        <section
          className="tx-panel tx-briefing"
          data-testid="briefing"
          data-plot-occluder
          role="dialog"
          aria-label="Briefing"
          onClick={closeBriefing}
        >
          <div className="tx-briefing-head">
            <span>[ BRIEFING ]</span>
            <span className="tx-dim">{gameState.scenario.name.toUpperCase()}</span>
          </div>
          <div className="tx-briefing-title">{opening.title.toUpperCase()}</div>
          <p className="tx-briefing-text">{opening.text}</p>
          {objective && (
            <div className="tx-briefing-mission" data-testid="briefing-mission">
              <div><b>PROTECT</b> {missionLines(objective).protect}</div>
              <div><b>WIN</b> {missionLines(objective).win}</div>
              <div><b>LOSE</b> {missionLines(objective).lose}</div>
              <div className="tx-dim">{missionLines(objective).notes}</div>
            </div>
          )}
          <div className="tx-briefing-foot">
            <span>ESC OR ENTER TO TAKE COMMAND  //  SPC STARTS THE CLOCK  //  B RECALLS THIS BRIEFING</span>
            <span className="tx-briefing-actions" onClick={(e) => e.stopPropagation()}>
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
      {selectedUnit && (
        <div className="tx-right" data-plot-occluder>
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

      {demoScenarioConfig.scenario.osint?.length ? (
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
        <Cmd cap="SPC" onClick={togglePause} testId="sim-toggle-pause" active={!gameState.isPaused} disabled={ended}>
          {gameState.isPaused ? "PLAY" : "PAUSE"}
        </Cmd>
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
        <Cmd cap="E" onClick={engageTarget} testId="cmd-engage" disabled={ended} ariaLabel="Engage selected contact">ENGAGE</Cmd>
        <Cmd cap="R" onClick={cycleRoe} testId="cmd-roe" disabled={ended} active={fire?.roe === "weapons-free"} alarm={fire?.roe === "weapons-free"} ariaLabel="Cycle rules of engagement">
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
              <div><b>MISSION CLOCK</b> {debrief.clock}</div>
              <div><b>YOUR LOSSES</b> {debrief.friendlyLosses}  //  <b>HOSTILE KILLS CONFIRMED</b> {debrief.kills}</div>
            </div>
            <div className="tx-result-record" data-testid="result-record">
              <div className="tx-section-head">Record</div>
              {debrief.record.length === 0 && <div className="tx-dim">NO TRAFFIC RECORDED</div>}
              {debrief.record.map((l) => (
                <div key={l.id} className={`tx-result-line${l.alarm ? " is-alarm" : ""}`}>
                  {new Date(l.time).toISOString().slice(11, 19)}Z {l.tag.trim()} {l.text}
                </div>
              ))}
            </div>
            <div className="tx-result-actions">
              <button type="button" onClick={handleReset} className="tx-btn is-on" data-testid="play-again" autoFocus>PLAY AGAIN</button>
              <button type="button" onClick={() => setReviewing(true)} className="tx-btn" data-testid="review-record">REVIEW RECORD</button>
              <a href="/" className="tx-btn">MAIN MENU</a>
            </div>
          </div>
        </div>
      )}
      {scenarioResult && reviewing && (
        <div className="tx-banner tx-result-strip" data-testid="result-strip" data-plot-occluder>
          <span className={scenarioResult.result === "defeat" ? "tx-result-strip-bad" : undefined}>[ {scenarioResult.result.toUpperCase()} ]</span>
          <button type="button" onClick={handleReset} className="tx-btn is-on" data-testid="play-again">PLAY AGAIN</button>
          <button type="button" onClick={() => setReviewing(false)} className="tx-btn" data-testid="show-debrief">DEBRIEF</button>
        </div>
      )}

      <div className="tx-scan" aria-hidden="true" />
    </div>
  );
}
