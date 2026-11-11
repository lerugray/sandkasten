import type { Scenario, Unit } from "@/types/game";
import { createInitialGameState, SPEED_OPTIONS, type GameState } from "./gameState";
import { simulationTick, simulationStep, getContactSeq, reserveContactIds } from "./engine";
import { runAIUpdate } from "@/lib/ai/aiController";
import type { AIState } from "@/lib/ai/aiController";
import type { EventState } from "@/lib/ai/events";
import type { Mission } from "@/lib/ai/missions";
import type { Doctrine } from "@/lib/ai/doctrine";
import { createCombatState, engageContact, getCombatSeq, reserveCombatIds, validateEngagement, type CombatEvent, type CombatState, type EngageResult } from "./combat";
import { contactDisplayName } from "./combatRecord";
import { trackNumber } from "./trackNumber";
import { contactsFor } from "./gameState";
import type { InfoWarConfig } from "@/lib/infowar/types";
import {
  type AutopausePreferences,
  type AutopauseResult,
  DEFAULT_AUTOPAUSE,
  checkAutopauseTriggers,
  buildFriendlyDamageMap,
} from "./autopause";

export interface ScenarioConfig {
  scenario: Scenario;
  missions?: Mission[];
  sideDoctrine?: Record<string, Partial<Doctrine>>;
  events?: EventState;
  infowar?: InfoWarConfig;
}

export type PlayMode = "continuous" | "wego";
export type WeGoPhase = "planning" | "resolving" | "review";
export const WEGO_TURN_MINUTES = [1, 5, 15] as const;
export type TurnMinutes = (typeof WEGO_TURN_MINUTES)[number];
export const DEFAULT_TURN_MINUTES: TurnMinutes = 5;
/** WeGo presentation speed at the start of a run; it changes playback time only, never the rules. */
export const WEGO_DEFAULT_SPEED = 30;
/** Every WeGo resolution step is exactly this many simulated ms, whatever the timer or playback speed. */
export const RESOLVE_STEP_MS = 1000;

export interface SessionOptions {
  mode?: PlayMode;
  turnMinutes?: number;
}

export function isTurnMinutes(n: unknown): n is TurnMinutes {
  return (WEGO_TURN_MINUTES as readonly number[]).includes(n as number);
}

/** A manual ENGAGE staged during planning; it does nothing until the turn is committed. */
export interface FireIntent {
  id: string;
  shooterId: string;
  shooterName: string;
  contactId: string;
  contactLabel: string;
  weaponName?: string;
}

export interface IntentOutcome {
  intent: FireIntent;
  ok: boolean;
  message: string;
}

export interface TurnReport {
  turn: number;
  startTime: number;
  endTime: number;
  elapsedMs: number;
  /** The scenario produced a result inside this turn (the interval may be shorter than the turn length). */
  ended: boolean;
  /** Own platforms lost or damaged during the turn (the player's own side is always known to them). */
  ownLosses: { unitId: string; name: string; from: Unit["damageState"]; to: Unit["damageState"] }[];
  /** Raw combat events from this turn; the UI fog-filters their text from the player's contacts. */
  events: CombatEvent[];
  messageIds: string[];
  outcomes: IntentOutcome[];
  /** Autopause triggers collected instead of interrupting the burst. */
  alerts: string[];
}

export interface WeGoSnapshot {
  phase: WeGoPhase;
  turnMinutes: TurnMinutes;
  turnLengthMs: number;
  turnStart: number;
  turnEnd: number;
  turnsCommitted: number;
  intents: FireIntent[];
  report: TurnReport | null;
  /** Simulated ms left in the committed interval while resolving, else 0. */
  remainingMs: number;
}

export interface SessionSnapshot {
  mode: PlayMode;
  /** Nothing has started yet, so the mode may still be chosen. */
  modeLocked: boolean;
  /** Tactical orders are open right now (not resolving, reviewing or ended). */
  ordersOpen: boolean;
  wego: WeGoSnapshot | null;
  gameState: GameState;
  eventState: EventState | undefined;
  combatState: CombatState;
  autopauseEvent: AutopauseResult | null;
  /** Result of the player's last order that can be refused (ENGAGE), for the order panel. */
  orderFeedback: { ok: boolean; message: string; seq: number } | null;
}

/** Everything the session itself owns that a battle checkpoint must keep (WeGo bookkeeping included). */
export interface WeGoDump {
  phase: WeGoPhase;
  turnStart: number;
  turnEnd: number;
  turnsCommitted: number;
  intents: FireIntent[];
  intentSeq: number;
  report: TurnReport | null;
  started: boolean;
  resolveBudgetMs: number;
  turnAlerts: string[];
  turnOutcomes: IntentOutcome[];
  turnLossBaseline: Map<string, Unit["damageState"]>;
  turnEventCursor: number;
  turnMessageCursor: number;
}

/**
 * The authoritative state of a running battle as plain typed data (Maps and Sets intact). The battle-save codec
 * turns it into a validated, versioned file and back; the session takes it back through `SimulationSession.restore`.
 */
export interface BattleDump {
  mode: PlayMode;
  turnMinutes: TurnMinutes;
  gameState: GameState;
  eventState: EventState | undefined;
  combatState: CombatState;
  ai: { patrolIndex: Map<string, number>; transitStarted: Set<string>; transitDone: Set<string> };
  autopausePrefs: AutopausePreferences;
  wego: WeGoDump;
  /** Module id counters at the time of the checkpoint (contacts; weapons and combat-log entries). */
  ids: { contactSeq: number; combatSeq: number };
}

function cloneEvents(events: EventState | undefined): EventState | undefined {
  return events
    ? { ...events, firedEvents: new Set(events.firedEvents), messages: [...events.messages], lastFired: { ...(events.lastFired ?? {}) } }
    : undefined;
}

/**
 * The one authoritative copy of a running game. The tick loop and every player command
 * work on it directly and synchronously; the UI only ever receives snapshots of it,
 * so a command can never be overwritten by a stale render (and time never rewinds).
 */
export class SimulationSession {
  private config: ScenarioConfig;
  private gameState: GameState;
  private eventState: EventState | undefined;
  private combatState: CombatState;
  private ai: AIState;
  private autopauseEvent: AutopauseResult | null = null;
  private orderFeedback: SessionSnapshot["orderFeedback"] = null;
  private feedbackSeq = 0;
  private seenTriggers = new Set<string>();
  autopausePrefs: AutopausePreferences = DEFAULT_AUTOPAUSE;

  // --- WeGo turn state: owned by this session alone ---
  private mode: PlayMode = "continuous";
  private turnMinutes: TurnMinutes = DEFAULT_TURN_MINUTES;
  private phase: WeGoPhase = "planning";
  private turnStart = 0;
  private turnEnd = 0;
  private turnsCommitted = 0;
  private intents: FireIntent[] = [];
  private intentSeq = 0;
  private report: TurnReport | null = null;
  private started = false;
  private resolveBudgetMs = 0;
  private turnAlerts: string[] = [];
  private turnOutcomes: IntentOutcome[] = [];
  private turnLossBaseline = new Map<string, Unit["damageState"]>();
  /** Lengths of the combat log and message list when the turn was committed: this turn owns what is appended after them. */
  private turnEventCursor = 0;
  private turnMessageCursor = 0;

  constructor(config: ScenarioConfig, options: SessionOptions = {}) {
    this.config = config;
    const bad = SimulationSession.validate(options);
    if (bad) throw new RangeError(bad);
    this.mode = options.mode ?? "continuous";
    this.turnMinutes = (options.turnMinutes as TurnMinutes | undefined) ?? DEFAULT_TURN_MINUTES;
    this.gameState = createInitialGameState(config.scenario);
    this.eventState = cloneEvents(config.events);
    this.combatState = createCombatState();
    this.ai = { missions: config.missions ?? [], sideDoctrine: config.sideDoctrine ?? {} };
    this.enterRun();
  }

  private static validate(o: SessionOptions): string | null {
    if (o.mode !== undefined && o.mode !== "continuous" && o.mode !== "wego") return `Unknown play mode: ${String(o.mode)}`;
    if (o.turnMinutes !== undefined && !isTurnMinutes(o.turnMinutes)) return `Turn length must be 1, 5 or 15 minutes (got ${String(o.turnMinutes)})`;
    return null;
  }

  /** Start-of-run state for the chosen mode: held, planning turn 1 in WeGo. */
  private enterRun(): void {
    this.phase = "planning";
    this.turnStart = this.gameState.simTime;
    this.turnEnd = this.gameState.simTime;
    this.turnsCommitted = 0;
    this.intents = [];
    this.report = null;
    this.started = false;
    this.resolveBudgetMs = 0;
    this.turnAlerts = [];
    this.turnOutcomes = [];
    this.turnLossBaseline = new Map();
    this.turnEventCursor = 0;
    this.turnMessageCursor = 0;
    if (this.mode === "wego") {
      this.gameState = { ...this.gameState, isPaused: true, speed: WEGO_DEFAULT_SPEED, turnNumber: 1 };
    }
  }

  get playMode(): PlayMode {
    return this.mode;
  }

  /** Choose the mode and turn length before the run starts. Once started it can only change by restarting. */
  configure(options: SessionOptions): { ok: boolean; message: string } {
    const bad = SimulationSession.validate(options);
    if (bad) return { ok: false, message: bad };
    if (this.started) return { ok: false, message: "The mode is locked once the run has started. Restart to change it." };
    this.mode = options.mode ?? this.mode;
    this.turnMinutes = (options.turnMinutes as TurnMinutes | undefined) ?? this.turnMinutes;
    this.gameState = { ...this.gameState, speed: this.mode === "wego" ? WEGO_DEFAULT_SPEED : 1, turnNumber: this.mode === "wego" ? 1 : 0, isPaused: true };
    this.enterRun();
    return { ok: true, message: this.mode === "wego" ? `WeGo, ${this.turnMinutes}-minute turns` : "Continuous" };
  }

  private wegoSnapshot(): WeGoSnapshot | null {
    if (this.mode !== "wego") return null;
    return {
      phase: this.phase,
      turnMinutes: this.turnMinutes,
      turnLengthMs: this.turnMinutes * 60000,
      turnStart: this.turnStart,
      turnEnd: this.turnEnd,
      turnsCommitted: this.turnsCommitted,
      intents: this.intents,
      report: this.report,
      remainingMs: this.phase === "resolving" ? Math.max(0, this.turnEnd - this.gameState.simTime) : 0,
    };
  }

  snapshot(): SessionSnapshot {
    return {
      mode: this.mode,
      modeLocked: this.started,
      ordersOpen: this.orderLock() === null,
      wego: this.wegoSnapshot(),
      gameState: this.gameState,
      eventState: this.eventState,
      combatState: this.combatState,
      autopauseEvent: this.autopauseEvent,
      orderFeedback: this.orderFeedback,
    };
  }

  /** Point the AI at new mission and doctrine definitions without losing its running bookkeeping. */
  updateConfig(config: ScenarioConfig): void {
    this.config = config;
    this.ai.missions = config.missions ?? [];
    this.ai.sideDoctrine = config.sideDoctrine ?? {};
  }

  /**
   * Advance by `dtMs` of real time. Returns true when the UI should be updated at once
   * (an autopause fired, or the scenario just ended).
   */
  tick(dtMs: number): boolean {
    if (this.mode === "wego") return this.tickWeGo(dtMs);
    if (this.gameState.isPaused) return false;

    const prev = this.gameState;
    const prevCombat = this.combatState;
    const prevMsgCount = this.eventState?.messages?.length ?? 0;
    const hadResult = !!this.eventState?.scenarioResult;
    const playerSide = prev.scenario.playerSide;
    const prevDamage = buildFriendlyDamageMap(prev, playerSide);

    const result = simulationTick(prev, dtMs, this.ai, this.eventState, this.combatState);
    this.gameState = result.gameState;
    if (result.eventState) this.eventState = result.eventState;
    if (result.combatState) this.combatState = result.combatState;

    const friendly = new Set(
      result.gameState.sides.flatMap((s) => s.units).filter((u) => u.side === playerSide).map((u) => u.id)
    );
    const trigger = checkAutopauseTriggers(
      this.autopausePrefs,
      prev.contacts,
      result.gameState.contacts,
      prevCombat,
      result.combatState,
      prevMsgCount,
      result.eventState?.messages?.length ?? prevMsgCount,
      prevDamage,
      buildFriendlyDamageMap(result.gameState, playerSide),
      playerSide,
      this.seenTriggers,
      friendly
    );

    // a finished scenario holds the clock: no further orders or time until reset()
    const justEnded = !hadResult && !!this.eventState?.scenarioResult;
    if (justEnded) this.gameState = { ...this.gameState, isPaused: true };

    if (trigger) {
      this.gameState = { ...this.gameState, isPaused: true };
      this.autopauseEvent = trigger;
      return true;
    }
    return justEnded;
  }

  /** True once the scenario has a result; only reset() starts a new run. */
  get ended(): boolean {
    return !!this.eventState?.scenarioResult;
  }

  // --- Commands: all synchronous, all on the session's own state ---

  /** Hold the clock; a no-op when already held. */
  pause(): void {
    if (this.gameState.isPaused) return;
    this.gameState = { ...this.gameState, isPaused: true };
  }

  togglePause(): void {
    if (this.ended) return;
    // WeGo: time only runs inside a committed turn; pausing holds the burst but never reopens planning
    if (this.mode === "wego" && this.phase !== "resolving") return;
    if (this.gameState.isPaused) {
      this.started = true;
      // Resuming — clear seen triggers so autopause can fire again
      this.seenTriggers.clear();
      this.autopauseEvent = null;
    }
    this.gameState = { ...this.gameState, isPaused: !this.gameState.isPaused };
  }

  setSpeed(speed: number): void {
    if (this.ended) return;
    this.gameState = { ...this.gameState, speed };
  }

  cycleSpeed(): void {
    if (this.ended) return;
    const idx = SPEED_OPTIONS.indexOf(this.gameState.speed as (typeof SPEED_OPTIONS)[number]);
    this.gameState = { ...this.gameState, speed: SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length] };
  }

  /** Why tactical orders are refused right now, or null when they are open. */
  private orderLock(): string | null {
    if (this.ended) return "Scenario ended: no further orders.";
    if (this.mode === "wego" && this.phase === "resolving") return "Orders are locked while the turn resolves.";
    if (this.mode === "wego" && this.phase === "review") return "Orders are locked during review. Press NEXT TURN to plan.";
    return null;
  }

  /** True when the player may give tactical orders (always true in continuous play until a result). */
  get ordersOpen(): boolean {
    return this.orderLock() === null;
  }

  private refuse(message: string): EngageResult {
    this.feedbackSeq += 1;
    this.orderFeedback = { ok: false, message, seq: this.feedbackSeq };
    return { ok: false, message, combatState: this.combatState };
  }

  private updateOrders(unitId: string, change: (o: NonNullable<ReturnType<GameState["orders"]["get"]>>) => ReturnType<GameState["orders"]["get"]>): void {
    if (this.orderLock()) return;
    const orders = this.gameState.orders.get(unitId);
    if (!orders) return;
    const next = change(orders);
    if (!next) return;
    const map = new Map(this.gameState.orders);
    map.set(unitId, next);
    this.gameState = { ...this.gameState, orders: map };
  }

  addWaypoint(unitId: string, position: { lng: number; lat: number }, speed?: number): void {
    this.updateOrders(unitId, (o) => ({ ...o, waypoints: [...o.waypoints, { position, speed }], speedKts: undefined }));
  }

  clearWaypoints(unitId: string): void {
    this.updateOrders(unitId, (o) => ({ ...o, waypoints: [] }));
  }

  /** Throttle 0 stops the unit; 1-4 loiter, cruise, full, flank. Replaces any speed held from the scenario. */
  setThrottle(unitId: string, throttle: number): void {
    this.updateOrders(unitId, (o) => ({ ...o, throttle, speedKts: undefined }));
  }

  toggleRadar(unitId: string): void {
    this.updateOrders(unitId, (o) => ({ ...o, radarActive: !o.radarActive }));
  }

  setRoe(unitId: string, roe: Doctrine["roe"]): void {
    this.updateOrders(unitId, (o) => ({ ...o, doctrine: { ...o.doctrine, roe } }));
  }

  /** The player's ENGAGE order. The reason for a refusal comes back for the order panel to show. */
  engage(shooterId: string, contactId: string, weaponName?: string): EngageResult {
    const lock = this.orderLock();
    if (lock) return this.refuse(lock);
    if (this.mode === "wego") return this.stageEngage(shooterId, contactId, weaponName);
    const result = engageContact(
      this.gameState,
      this.combatState,
      { shooterId, contactId, weaponName },
      { missions: this.ai.missions, sideDoctrine: this.ai.sideDoctrine }
    );
    this.combatState = result.combatState;
    this.feedbackSeq += 1;
    this.orderFeedback = { ok: result.ok, message: result.message, seq: this.feedbackSeq };
    return result;
  }

  // --- WeGo: stage, cancel, commit, resolve, review ---

  /** Stage a manual ENGAGE for the next burst. Checked now against known contacts, re-checked when it executes. */
  private stageEngage(shooterId: string, contactId: string, weaponName?: string): EngageResult {
    const state = this.gameState;
    const shooter = state.sides.flatMap((s) => s.units).find((u) => u.id === shooterId);
    if (!shooter || shooter.side !== state.scenario.playerSide) return this.refuse("No such unit");
    const contact = contactsFor(state, shooter.side).find((c) => c.id === contactId);
    if (!contact) return this.refuse("No such contact");
    if (this.intents.some((i) => i.shooterId === shooterId)) {
      return this.refuse(`${shooter.name} already has a fire order staged. Cancel it to change it.`);
    }
    const check = validateEngagement(state, this.combatState, shooter, contact, { weaponName, manual: true });
    if (!check.ok) return this.refuse(check.message);
    this.intentSeq += 1;
    const intent: FireIntent = {
      id: `fire-${this.intentSeq}`,
      shooterId,
      shooterName: shooter.name,
      contactId,
      contactLabel: contactDisplayName(
        contact,
        trackNumber,
        state.sides.flatMap((s) => s.units).find((u) => u.id === contact.actualUnitId)?.name,
      ),
      weaponName,
    };
    this.intents = [...this.intents, intent];
    const message = `Staged: ${shooter.name} fires on ${intent.contactLabel} when you commit.`;
    this.feedbackSeq += 1;
    this.orderFeedback = { ok: true, message, seq: this.feedbackSeq };
    return { ok: true, message, combatState: this.combatState };
  }

  /** Withdraw a staged fire order. Only possible while planning. */
  cancelIntent(intentId: string): boolean {
    if (this.mode !== "wego" || this.phase !== "planning" || this.ended) return false;
    if (!this.intents.some((i) => i.id === intentId)) return false;
    this.intents = this.intents.filter((i) => i.id !== intentId);
    this.feedbackSeq += 1;
    this.orderFeedback = { ok: true, message: "Fire order cancelled.", seq: this.feedbackSeq };
    return true;
  }

  /**
   * Seal the draft and start the burst. The AI plans once from its own contacts at this same held state;
   * staged fire executes once at the start. A second call while resolving or reviewing does nothing.
   */
  commit(): boolean {
    if (this.mode !== "wego" || this.phase !== "planning" || this.ended) return false;
    this.started = true;
    this.seenTriggers.clear();
    this.autopauseEvent = null;

    const sealed = this.intents;
    this.intents = [];

    // Cursors first: the staged fire below belongs to this turn, a record already at the previous end does not
    this.turnEventCursor = this.combatState.combatLog.length;
    this.turnMessageCursor = this.eventState?.messages.length ?? 0;

    // OPFOR plans from its own contact store at the committed turn-start state (orders stay hidden from the player)
    const orders = runAIUpdate(this.gameState, this.ai);
    this.gameState = { ...this.gameState, orders };

    // The player's manual fire executes once, before ordinary combat advances; each is re-validated
    this.turnOutcomes = [];
    for (const intent of sealed) {
      const result = engageContact(this.gameState, this.combatState, intent, { missions: this.ai.missions, sideDoctrine: this.ai.sideDoctrine });
      this.combatState = result.combatState;
      this.turnOutcomes.push({ intent, ok: result.ok, message: result.message });
    }
    const refused = this.turnOutcomes.filter((o) => !o.ok);
    if (refused.length > 0) {
      this.feedbackSeq += 1;
      this.orderFeedback = { ok: false, message: refused.map((o) => `${o.intent.shooterName}: ${o.message}`).join(" // "), seq: this.feedbackSeq };
    }

    this.turnAlerts = [];
    this.turnLossBaseline = new Map(
      this.gameState.sides.flatMap((sd) => sd.units).filter((u) => u.side === this.gameState.scenario.playerSide).map((u) => [u.id, u.damageState])
    );
    this.report = null;
    this.turnsCommitted += 1;
    this.turnStart = this.gameState.simTime;
    this.turnEnd = this.turnStart + this.turnMinutes * 60000;
    this.resolveBudgetMs = 0;
    this.phase = "resolving";
    this.gameState = { ...this.gameState, isPaused: false };
    return true;
  }

  /** Open the next planning phase at the exact held state. No-op unless reviewing a turn that did not end the scenario. */
  nextTurn(): boolean {
    if (this.mode !== "wego" || this.phase !== "review" || this.ended) return false;
    this.phase = "planning";
    this.intents = [];
    this.gameState = { ...this.gameState, isPaused: true, turnNumber: this.gameState.turnNumber + 1 };
    return true;
  }

  private tickWeGo(dtMs: number): boolean {
    if (this.phase !== "resolving" || this.gameState.isPaused || this.ended) return false;
    // A sealed turn has a fixed end: when the UI stalls (heavy plot frames) the real-dt clip used in
    // continuous play would leave the burst hanging for minutes. Count the whole gap so commit→review
    // still completes under the player's chosen speed.
    this.resolveBudgetMs += Math.max(dtMs, 0) * this.gameState.speed;

    const playerSide = this.gameState.scenario.playerSide;
    let finished = false;
    while (this.resolveBudgetMs >= RESOLVE_STEP_MS && this.gameState.simTime < this.turnEnd) {
      this.resolveBudgetMs -= RESOLVE_STEP_MS;
      const stepMs = Math.min(RESOLVE_STEP_MS, this.turnEnd - this.gameState.simTime);
      const prev = this.gameState;
      const prevCombat = this.combatState;
      const prevMsgCount = this.eventState?.messages?.length ?? 0;
      const prevDamage = buildFriendlyDamageMap(prev, playerSide);

      const result = simulationStep(prev, stepMs, this.ai, this.eventState, this.combatState, { planAI: false });
      this.gameState = result.gameState;
      if (result.eventState) this.eventState = result.eventState;
      if (result.combatState) this.combatState = result.combatState;

      const friendly = new Set(
        result.gameState.sides.flatMap((sd) => sd.units).filter((u) => u.side === playerSide).map((u) => u.id)
      );
      const trigger = checkAutopauseTriggers(
        this.autopausePrefs, prev.contacts, result.gameState.contacts, prevCombat, result.combatState,
        prevMsgCount, result.eventState?.messages?.length ?? prevMsgCount, prevDamage,
        buildFriendlyDamageMap(result.gameState, playerSide), playerSide, this.seenTriggers, friendly
      );
      // WeGo never drops into editable planning mid-burst: alerts are collected for the review
      if (trigger) this.turnAlerts.push(trigger.reason);

      if (this.eventState?.scenarioResult) { finished = true; break; }
    }
    if (this.gameState.simTime >= this.turnEnd) finished = true;
    if (!finished) return false;

    this.finishTurn();
    return true;
  }

  private finishTurn(): void {
    const g = this.gameState;
    const playerSide = g.scenario.playerSide;
    const rank: Record<Unit["damageState"], number> = { undamaged: 0, damaged: 1, "mission-kill": 2, destroyed: 3 };
    const ownLosses = g.sides
      .flatMap((sd) => sd.units)
      .filter((u) => u.side === playerSide && rank[u.damageState] > rank[this.turnLossBaseline.get(u.id) ?? "undamaged"])
      .map((u) => ({ unitId: u.id, name: u.name, from: this.turnLossBaseline.get(u.id) ?? "undamaged", to: u.damageState }));
    const events = this.combatState.combatLog.slice(this.turnEventCursor);
    const messages = (this.eventState?.messages ?? []).slice(this.turnMessageCursor).map((m) => m.id);
    this.report = {
      turn: g.turnNumber,
      startTime: this.turnStart,
      endTime: g.simTime,
      elapsedMs: g.simTime - this.turnStart,
      ended: !!this.eventState?.scenarioResult,
      ownLosses,
      events,
      messageIds: messages,
      outcomes: this.turnOutcomes,
      alerts: [...new Set(this.turnAlerts)],
    };
    this.phase = "review";
    this.resolveBudgetMs = 0;
    this.gameState = { ...g, isPaused: true };
  }

  markMessageRead(messageId: string): void {
    if (!this.eventState) return;
    this.eventState = {
      ...this.eventState,
      messages: this.eventState.messages.map((m) => (m.id === messageId ? { ...m, read: true } : m)),
    };
  }

  /**
   * Pause and return the complete authoritative state as of this instant: one atomic checkpoint.
   * A running battle is held first, so what is saved is exactly what stays on screen.
   */
  checkpoint(): BattleDump {
    this.pause();
    const rt = this.ai;
    return {
      mode: this.mode,
      turnMinutes: this.turnMinutes,
      gameState: this.gameState,
      eventState: this.eventState,
      combatState: this.combatState,
      ai: {
        patrolIndex: new Map(rt.patrolIndex ?? []),
        transitStarted: new Set(rt.transitStarted ?? []),
        transitDone: new Set(rt.transitDone ?? []),
      },
      autopausePrefs: this.autopausePrefs,
      wego: {
        phase: this.phase,
        turnStart: this.turnStart,
        turnEnd: this.turnEnd,
        turnsCommitted: this.turnsCommitted,
        intents: this.intents,
        intentSeq: this.intentSeq,
        report: this.report,
        started: this.started,
        resolveBudgetMs: this.resolveBudgetMs,
        turnAlerts: this.turnAlerts,
        turnOutcomes: this.turnOutcomes,
        turnLossBaseline: new Map(this.turnLossBaseline),
        turnEventCursor: this.turnEventCursor,
        turnMessageCursor: this.turnMessageCursor,
      },
      ids: { contactSeq: getContactSeq(), combatSeq: getCombatSeq() },
    };
  }

  /**
   * A new session standing exactly where a checkpoint was taken, always held. The dump must already be validated
   * (see battleSave.ts); this only places it, in one synchronous step, so a failure can never leave a half-built
   * session: the caller builds this first and swaps it in only if it returned.
   */
  static restore(config: ScenarioConfig, dump: BattleDump): SimulationSession {
    const session = new SimulationSession(config, { mode: dump.mode, turnMinutes: dump.turnMinutes });
    session.gameState = { ...dump.gameState, isPaused: true };
    session.eventState = dump.eventState;
    session.combatState = dump.combatState;
    session.ai = {
      missions: config.missions ?? [],
      sideDoctrine: config.sideDoctrine ?? {},
      patrolIndex: new Map(dump.ai.patrolIndex),
      transitStarted: new Set(dump.ai.transitStarted),
      transitDone: new Set(dump.ai.transitDone),
    };
    session.autopausePrefs = dump.autopausePrefs;
    session.autopauseEvent = null;
    session.orderFeedback = null;
    session.seenTriggers = new Set();
    const w = dump.wego;
    session.phase = w.phase;
    session.turnStart = w.turnStart;
    session.turnEnd = w.turnEnd;
    session.turnsCommitted = w.turnsCommitted;
    session.intents = w.intents;
    session.intentSeq = w.intentSeq;
    session.report = w.report;
    session.started = w.started;
    session.resolveBudgetMs = w.resolveBudgetMs;
    session.turnAlerts = w.turnAlerts;
    session.turnOutcomes = w.turnOutcomes;
    session.turnLossBaseline = new Map(w.turnLossBaseline);
    session.turnEventCursor = w.turnEventCursor;
    session.turnMessageCursor = w.turnMessageCursor;
    // new contact, weapon and log ids must never repeat one the restored battle already holds
    reserveContactIds(dump.ids.contactSeq);
    reserveCombatIds(dump.ids.combatSeq);
    return session;
  }

  /** A fresh run. Passing options is the explicit restart that may change the mode. */
  reset(options?: SessionOptions): void {
    if (options) {
      const bad = SimulationSession.validate(options);
      if (bad) throw new RangeError(bad);
      this.mode = options.mode ?? this.mode;
      this.turnMinutes = (options.turnMinutes as TurnMinutes | undefined) ?? this.turnMinutes;
    }
    this.seenTriggers.clear();
    this.autopauseEvent = null;
    this.orderFeedback = null;
    this.gameState = createInitialGameState(this.config.scenario);
    this.eventState = cloneEvents(this.config.events);
    this.combatState = createCombatState();
    this.ai = { missions: this.config.missions ?? [], sideDoctrine: this.config.sideDoctrine ?? {} };
    this.enterRun();
  }
}
