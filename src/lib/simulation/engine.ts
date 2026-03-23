import type { Unit } from "@/types/game";
import type { GameState, Contact } from "./gameState";
import { updateUnitMovement } from "./movement";
import { runDetectionChecks, mergeContact } from "./detection";
import { runAIUpdate, type AIState } from "@/lib/ai/aiController";
import {
  evaluateEvents,
  applyStateChanges,
  type EventState,
} from "@/lib/ai/events";

const DETECTION_INTERVAL_MS = 5000; // run detection every 5 sim-seconds
let lastDetectionTime = 0;

/**
 * Advance the simulation by one tick.
 * @param state Current game state
 * @param dtMs Real-time milliseconds since last tick
 * @returns Updated game state
 */
export function simulationTick(
  state: GameState,
  dtMs: number,
  aiState?: AIState,
  eventState?: EventState
): { gameState: GameState; eventState?: EventState } {
  if (state.isPaused) return { gameState: state, eventState };

  const simDtMs = dtMs * state.speed;
  const simDtSeconds = simDtMs / 1000;
  const newSimTime = state.simTime + simDtMs;

  // --- Phase 0: AI Decision-making (throttled, same cadence as detection) ---
  let currentOrders = state.orders;
  if (aiState) {
    currentOrders = runAIUpdate(
      { ...state, simTime: newSimTime },
      aiState
    );
  }

  // --- Phase 1: Movement ---
  const stateWithOrders = { ...state, orders: currentOrders };
  const newSides = stateWithOrders.sides.map((side) => ({
    ...side,
    units: side.units.map((unit) => {
      if (unit.damageState === "destroyed") return unit;

      const orders = currentOrders.get(unit.id);
      if (!orders) return unit;

      const result = updateUnitMovement(unit, orders, simDtSeconds);
      // Update orders if waypoints were consumed
      currentOrders.set(unit.id, result.orders);
      return result.unit;
    }),
  }));

  // --- Phase 2: Detection (throttled) ---
  let newContacts = [...state.contacts];

  if (newSimTime - lastDetectionTime >= DETECTION_INTERVAL_MS) {
    lastDetectionTime = newSimTime;
    newContacts = runDetectionPhase(newSides, stateWithOrders);
  }

  // --- Phase 3: Contact aging ---
  newContacts = newContacts
    .map((contact) => {
      const age = newSimTime - contact.lastUpdateTime;
      if (age > 120000) {
        return null;
      }
      if (age > 60000 && contact.classification === "tracked") {
        return { ...contact, classification: "classified" as const };
      }
      if (age > 30000) {
        return {
          ...contact,
          positionUncertainty: contact.positionUncertainty + 0.5,
        };
      }
      return contact;
    })
    .filter((c): c is Contact => c !== null);

  let newGameState: GameState = {
    ...state,
    simTime: newSimTime,
    sides: newSides,
    contacts: newContacts,
    orders: currentOrders,
  };

  // --- Phase 4: TCA Events ---
  let newEventState = eventState;
  if (eventState) {
    const eventResult = evaluateEvents(eventState, newGameState, aiState?.missions ?? []);
    newEventState = eventResult.eventState;

    if (eventResult.stateChanges.length > 0) {
      newGameState = applyStateChanges(newGameState, eventResult.stateChanges);
    }
  }

  return { gameState: newGameState, eventState: newEventState };
}

function runDetectionPhase(
  sides: GameState["sides"],
  state: GameState
): Contact[] {
  const contacts = [...state.contacts];
  const allUnits = sides.flatMap((s) => s.units);
  const playerSide = state.scenario.playerSide;

  // For each friendly unit, check detection against all non-friendly units
  const friendlyUnits = allUnits.filter((u) => u.side === playerSide && u.damageState !== "destroyed");
  const hostileUnits = allUnits.filter((u) => u.side !== playerSide && u.side !== "Civilian" && u.damageState !== "destroyed");

  for (const detector of friendlyUnits) {
    const detectorOrders = state.orders.get(detector.id);
    if (!detectorOrders) continue;

    for (const target of hostileUnits) {
      const targetOrders = state.orders.get(target.id);
      if (!targetOrders) continue;

      const result = runDetectionChecks(detector, detectorOrders, target, targetOrders);
      if (!result) continue;

      // Find existing contact for this target
      const existingIdx = contacts.findIndex(
        (c) => c.actualUnitId === target.id && c.side === playerSide
      );

      if (existingIdx >= 0) {
        // Update existing contact
        contacts[existingIdx] = mergeContact(
          contacts[existingIdx],
          result,
          target.position,
          state.simTime
        );
      } else {
        // New contact
        const jitterLat = (Math.random() - 0.5) * result.uncertainty * 0.009;
        const jitterLng = (Math.random() - 0.5) * result.uncertainty * 0.009;

        contacts.push({
          id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          detectedById: detector.id,
          actualUnitId: target.id,
          side: playerSide,
          classification: result.classification,
          position: {
            lat: target.position.lat + jitterLat,
            lng: target.position.lng + jitterLng,
          },
          positionUncertainty: result.uncertainty,
          lastUpdateTime: state.simTime,
          sensorType: result.sensorType,
          platformName: result.classification === "classified"
            ? target.name
            : undefined,
        });
      }
    }
  }

  return contacts;
}

/**
 * Reset detection timer (call when loading a new game state)
 */
export function resetDetectionTimer(): void {
  lastDetectionTime = 0;
}
