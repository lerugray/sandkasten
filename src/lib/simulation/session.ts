import type { Scenario } from "@/types/game";
import { createInitialGameState, SPEED_OPTIONS, type GameState } from "./gameState";
import { simulationTick } from "./engine";
import type { AIState } from "@/lib/ai/aiController";
import type { EventState } from "@/lib/ai/events";
import type { Mission } from "@/lib/ai/missions";
import type { Doctrine } from "@/lib/ai/doctrine";
import { createCombatState, engageContact, type CombatState, type EngageResult } from "./combat";
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

export interface SessionSnapshot {
  gameState: GameState;
  eventState: EventState | undefined;
  combatState: CombatState;
  autopauseEvent: AutopauseResult | null;
  /** Result of the player's last order that can be refused (ENGAGE), for the order panel. */
  orderFeedback: { ok: boolean; message: string; seq: number } | null;
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

  constructor(config: ScenarioConfig) {
    this.config = config;
    this.gameState = createInitialGameState(config.scenario);
    this.eventState = cloneEvents(config.events);
    this.combatState = createCombatState();
    this.ai = { missions: config.missions ?? [], sideDoctrine: config.sideDoctrine ?? {} };
  }

  snapshot(): SessionSnapshot {
    return {
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
    if (this.gameState.isPaused) {
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

  private updateOrders(unitId: string, change: (o: NonNullable<ReturnType<GameState["orders"]["get"]>>) => ReturnType<GameState["orders"]["get"]>): void {
    if (this.ended) return;
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
    if (this.ended) {
      this.feedbackSeq += 1;
      this.orderFeedback = { ok: false, message: "Scenario ended: no further orders.", seq: this.feedbackSeq };
      return { ok: false, message: this.orderFeedback.message, combatState: this.combatState };
    }
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

  markMessageRead(messageId: string): void {
    if (!this.eventState) return;
    this.eventState = {
      ...this.eventState,
      messages: this.eventState.messages.map((m) => (m.id === messageId ? { ...m, read: true } : m)),
    };
  }

  reset(): void {
    this.seenTriggers.clear();
    this.autopauseEvent = null;
    this.orderFeedback = null;
    this.gameState = createInitialGameState(this.config.scenario);
    this.eventState = cloneEvents(this.config.events);
    this.combatState = createCombatState();
    this.ai = { missions: this.config.missions ?? [], sideDoctrine: this.config.sideDoctrine ?? {} };
  }
}
