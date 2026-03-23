/**
 * TCA (Trigger-Condition-Action) Event System
 *
 * Scenario authors define events with triggers, conditions, and actions.
 * The event engine evaluates triggers each tick and fires matching events.
 *
 * See GDD Section 6.4 for the full spec.
 */

import type { Unit, Position } from "@/types/game";
import type { GameState } from "@/lib/simulation/gameState";
import type { Doctrine } from "./doctrine";
import type { Mission } from "./missions";
import { distanceKm } from "@/lib/simulation/movement";

// --- Triggers ---

export type Trigger =
  | { type: "ScenarioLoaded" }
  | { type: "Time"; time: number } // sim time (unix ms)
  | { type: "TimeInterval"; intervalMs: number; lastFired?: number }
  | { type: "UnitDetected"; side: string; detectedBySide: string }
  | { type: "UnitDestroyed"; unitId?: string; side?: string; unitType?: string }
  | { type: "UnitDamaged"; unitId: string }
  | { type: "UnitEntersArea"; side: string; areaId: string }
  | { type: "UnitLeavesArea"; side: string; areaId: string }
  | { type: "SideScore"; side: string; threshold: number; comparison: "gte" | "lte" };

// --- Conditions ---

export type Condition =
  | { type: "SideIs"; side: string }
  | { type: "RandomChance"; probability: number }
  | { type: "EventHasFired"; eventName: string }
  | { type: "EventHasNotFired"; eventName: string }
  | { type: "UnitCountInArea"; side: string; areaId: string; count: number; comparison: "gte" | "lte" };

// --- Actions ---

export type Action =
  | { type: "DisplayMessage"; side: string; title?: string; text: string }
  | { type: "SpawnUnit"; side: string; units: SpawnUnitDef[] }
  | { type: "DestroyUnit"; unitId: string }
  | { type: "ChangeDoctrine"; side: string; mission?: string; changes: Partial<Doctrine> }
  | { type: "ChangeScore"; side: string; amount: number }
  | { type: "EndScenario"; result: "victory" | "defeat" | "draw"; message: string }
  | { type: "TriggerEvent"; eventName: string };

export interface SpawnUnitDef {
  id: string;
  name: string;
  platformId: number;
  position: Position;
  heading?: number;
  speed?: number;
  altitude?: number;
  mission?: string;
}

// --- Event Definition ---

export interface ScenarioEvent {
  name: string;
  repeatable: boolean;
  triggers: Trigger[];
  conditions: Condition[];
  actions: Action[];
}

// --- Event State ---

export interface EventState {
  events: ScenarioEvent[];
  firedEvents: Set<string>; // names of events that have fired
  messages: EventMessage[]; // messages displayed to the player
  scenarioResult?: { result: "victory" | "defeat" | "draw"; message: string };
}

export interface EventMessage {
  id: string;
  side: string;
  title?: string;
  text: string;
  time: number; // sim time when message was created
  read: boolean;
}

/**
 * Evaluate all events against current game state.
 * Returns updated event state with any fired actions applied.
 */
export function evaluateEvents(
  eventState: EventState,
  gameState: GameState,
  aiMissions: Mission[]
): { eventState: EventState; stateChanges: StateChange[] } {
  const changes: StateChange[] = [];
  const newFired = new Set(eventState.firedEvents);
  const newMessages = [...eventState.messages];
  let scenarioResult = eventState.scenarioResult;

  for (const event of eventState.events) {
    // Skip if already fired and not repeatable
    if (newFired.has(event.name) && !event.repeatable) continue;

    // Check triggers — at least one must match
    const triggered = event.triggers.some((t) =>
      evaluateTrigger(t, gameState, newFired)
    );
    if (!triggered) continue;

    // Check conditions — all must match
    const conditionsMet =
      event.conditions.length === 0 ||
      event.conditions.every((c) =>
        evaluateCondition(c, gameState, newFired)
      );
    if (!conditionsMet) continue;

    // Fire the event
    newFired.add(event.name);

    // Execute actions
    for (const action of event.actions) {
      switch (action.type) {
        case "DisplayMessage":
          newMessages.push({
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            side: action.side,
            title: action.title,
            text: action.text,
            time: gameState.simTime,
            read: false,
          });
          break;

        case "SpawnUnit":
          changes.push({ type: "spawn", action });
          break;

        case "DestroyUnit":
          changes.push({ type: "destroy", unitId: action.unitId });
          break;

        case "ChangeDoctrine":
          changes.push({ type: "doctrine", action });
          break;

        case "ChangeScore":
          changes.push({
            type: "score",
            side: action.side,
            amount: action.amount,
          });
          break;

        case "EndScenario":
          scenarioResult = {
            result: action.result,
            message: action.message,
          };
          break;

        case "TriggerEvent": {
          // Find and force-fire another event
          const targetEvent = eventState.events.find(
            (e) => e.name === action.eventName
          );
          if (targetEvent) {
            newFired.add(targetEvent.name);
            // Recursion limited — triggered events just get marked as fired
            // Their actions will be processed next cycle
          }
          break;
        }
      }
    }
  }

  return {
    eventState: {
      ...eventState,
      firedEvents: newFired,
      messages: newMessages,
      scenarioResult,
    },
    stateChanges: changes,
  };
}

// --- State changes that need to be applied to GameState ---

export type StateChange =
  | { type: "spawn"; action: Extract<Action, { type: "SpawnUnit" }> }
  | { type: "destroy"; unitId: string }
  | { type: "doctrine"; action: Extract<Action, { type: "ChangeDoctrine" }> }
  | { type: "score"; side: string; amount: number };

/**
 * Apply state changes from events to the game state.
 */
export function applyStateChanges(
  state: GameState,
  changes: StateChange[]
): GameState {
  let newState = { ...state };

  for (const change of changes) {
    switch (change.type) {
      case "spawn": {
        const side = newState.sides.find((s) => s.name === change.action.side);
        if (!side) break;

        const newUnits = change.action.units.map((def) => ({
          id: def.id,
          name: def.name,
          platformId: def.platformId,
          side: change.action.side,
          position: def.position,
          heading: def.heading ?? 0,
          speed: def.speed ?? 0,
          altitude: def.altitude,
          damageState: "undamaged" as const,
          mission: def.mission,
        }));

        newState = {
          ...newState,
          sides: newState.sides.map((s) =>
            s.name === change.action.side
              ? { ...s, units: [...s.units, ...newUnits] }
              : s
          ),
        };

        // Create orders for spawned units
        const newOrders = new Map(newState.orders);
        for (const u of newUnits) {
          newOrders.set(u.id, {
            unitId: u.id,
            waypoints: [],
            throttle: 2,
            radarActive: true,
          });
        }
        newState = { ...newState, orders: newOrders };
        break;
      }

      case "destroy": {
        newState = {
          ...newState,
          sides: newState.sides.map((s) => ({
            ...s,
            units: s.units.map((u) =>
              u.id === change.unitId
                ? { ...u, damageState: "destroyed" as const }
                : u
            ),
          })),
        };
        break;
      }

      case "score": {
        newState = {
          ...newState,
          score: {
            ...newState.score,
            [change.side]: (newState.score[change.side] ?? 0) + change.amount,
          },
        };
        break;
      }

      case "doctrine":
        // Doctrine changes are handled by the AI controller via AIState
        // Just signal that it happened — the caller applies it
        break;
    }
  }

  return newState;
}

// --- Trigger evaluation ---

function evaluateTrigger(
  trigger: Trigger,
  state: GameState,
  firedEvents: Set<string>
): boolean {
  switch (trigger.type) {
    case "ScenarioLoaded":
      // Fires once at the very start (simTime === scenario.startTime)
      return state.simTime <= state.scenario.startTime + 1000;

    case "Time":
      return state.simTime >= trigger.time;

    case "TimeInterval": {
      const last = trigger.lastFired ?? state.scenario.startTime;
      if (state.simTime - last >= trigger.intervalMs) {
        trigger.lastFired = state.simTime; // mutate for tracking
        return true;
      }
      return false;
    }

    case "UnitDetected":
      return state.contacts.some(
        (c) => c.side === trigger.detectedBySide
      );

    case "UnitDestroyed": {
      const allUnits = state.sides.flatMap((s) => s.units);
      if (trigger.unitId) {
        return allUnits.some(
          (u) => u.id === trigger.unitId && u.damageState === "destroyed"
        );
      }
      if (trigger.side) {
        return allUnits.some(
          (u) => u.side === trigger.side && u.damageState === "destroyed"
        );
      }
      return false;
    }

    case "UnitDamaged": {
      const allUnits = state.sides.flatMap((s) => s.units);
      return allUnits.some(
        (u) =>
          u.id === trigger.unitId &&
          (u.damageState === "damaged" || u.damageState === "mission-kill")
      );
    }

    case "UnitEntersArea": {
      const area = state.referencePoints.find(
        (rp) => rp.id === trigger.areaId && rp.type === "area"
      );
      if (!area || area.points.length < 3) return false;

      const allUnits = state.sides.flatMap((s) => s.units);
      return allUnits.some(
        (u) =>
          u.side === trigger.side &&
          u.damageState !== "destroyed" &&
          isPointInPolygon(u.position, area.points)
      );
    }

    case "UnitLeavesArea": {
      const area = state.referencePoints.find(
        (rp) => rp.id === trigger.areaId && rp.type === "area"
      );
      if (!area || area.points.length < 3) return false;

      const allUnits = state.sides
        .flatMap((s) => s.units)
        .filter((u) => u.side === trigger.side && u.damageState !== "destroyed");

      // "Leaves area" = no units of that side are in the area
      return allUnits.length > 0 && !allUnits.some((u) => isPointInPolygon(u.position, area.points));
    }

    case "SideScore": {
      const score = state.score[trigger.side] ?? 0;
      return trigger.comparison === "gte"
        ? score >= trigger.threshold
        : score <= trigger.threshold;
    }

    default:
      return false;
  }
}

// --- Condition evaluation ---

function evaluateCondition(
  condition: Condition,
  state: GameState,
  firedEvents: Set<string>
): boolean {
  switch (condition.type) {
    case "RandomChance":
      return Math.random() < condition.probability;

    case "EventHasFired":
      return firedEvents.has(condition.eventName);

    case "EventHasNotFired":
      return !firedEvents.has(condition.eventName);

    case "UnitCountInArea": {
      const area = state.referencePoints.find(
        (rp) => rp.id === condition.areaId && rp.type === "area"
      );
      if (!area || area.points.length < 3) return false;

      const count = state.sides
        .flatMap((s) => s.units)
        .filter(
          (u) =>
            u.side === condition.side &&
            u.damageState !== "destroyed" &&
            isPointInPolygon(u.position, area.points)
        ).length;

      return condition.comparison === "gte"
        ? count >= condition.count
        : count <= condition.count;
    }

    case "SideIs":
      // This is evaluated contextually — always true for now
      return true;

    default:
      return false;
  }
}

// --- Geometry helpers ---

function isPointInPolygon(point: Position, polygon: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }
  return inside;
}
