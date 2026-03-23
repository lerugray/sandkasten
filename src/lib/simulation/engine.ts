import type { Unit } from "@/types/game";
import type { GameState, Contact } from "./gameState";
import { updateUnitMovement } from "./movement";
import { runDetectionChecks, mergeContact } from "./detection";

const DETECTION_INTERVAL_MS = 5000; // run detection every 5 sim-seconds
let lastDetectionTime = 0;

/**
 * Advance the simulation by one tick.
 * @param state Current game state
 * @param dtMs Real-time milliseconds since last tick
 * @returns Updated game state
 */
export function simulationTick(state: GameState, dtMs: number): GameState {
  if (state.isPaused) return state;

  const simDtMs = dtMs * state.speed;
  const simDtSeconds = simDtMs / 1000;
  const newSimTime = state.simTime + simDtMs;

  // --- Phase 1: Movement ---
  const newSides = state.sides.map((side) => ({
    ...side,
    units: side.units.map((unit) => {
      if (unit.damageState === "destroyed") return unit;

      const orders = state.orders.get(unit.id);
      if (!orders) return unit;

      const result = updateUnitMovement(unit, orders, simDtSeconds);
      // Update orders if waypoints were consumed
      state.orders.set(unit.id, result.orders);
      return result.unit;
    }),
  }));

  // --- Phase 2: Detection (throttled) ---
  let newContacts = [...state.contacts];

  if (newSimTime - lastDetectionTime >= DETECTION_INTERVAL_MS) {
    lastDetectionTime = newSimTime;
    newContacts = runDetectionPhase(newSides, state);
  }

  // --- Phase 3: Contact aging ---
  // Contacts not updated in 60 sim-seconds degrade
  newContacts = newContacts
    .map((contact) => {
      const age = newSimTime - contact.lastUpdateTime;
      if (age > 120000) {
        // 2 minutes without update — lose contact entirely
        return null;
      }
      if (age > 60000 && contact.classification === "tracked") {
        // Degrade from tracked to classified
        return { ...contact, classification: "classified" as const };
      }
      if (age > 30000) {
        // Grow uncertainty over time
        return {
          ...contact,
          positionUncertainty: contact.positionUncertainty + 0.5,
        };
      }
      return contact;
    })
    .filter((c): c is Contact => c !== null);

  return {
    ...state,
    simTime: newSimTime,
    sides: newSides,
    contacts: newContacts,
  };
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
