import type { Unit } from "@/types/game";
import type { GameState, Contact, PhaseSchedule } from "./gameState";
import { updateUnitMovement } from "./movement";
import { runDetectionChecks, mergeContact } from "./detection";
import { ageContacts } from "./contacts";
import { runAIUpdate, type AIState } from "@/lib/ai/aiController";
import {
  evaluateEvents,
  applyStateChanges,
  mergeResults,
  type EventState,
} from "@/lib/ai/events";
import {
  runCombatPhase,
  type CombatState,
} from "./combat";

const DETECTION_INTERVAL_MS = 5000; // run detection every 5 sim-seconds
const AI_INTERVAL_MS = 5000; // same cadence as detection
/** A stalled frame (background tab, debugger) must not become a huge jump in game time. */
const MAX_REAL_DT_MS = 2000;
/** The phases run on a 5 s grid, so a long step is cut into pieces no longer than that. */
const MAX_SUBSTEP_MS = 5000;

/** Next due time on the grid, keeping the remainder so cadence does not drift with the step size. */
function advanceDue(due: number, now: number, interval: number): number {
  return due + interval * (Math.floor((now - due) / interval) + 1);
}

let contactSeq = 0;

/** Current contact-id counter, for a battle checkpoint. */
export function getContactSeq(): number {
  return contactSeq;
}

/** Make sure no new contact id can repeat one at or below `floor` (a restored battle already holds them). Never lowers it. */
export function reserveContactIds(floor: number): void {
  if (Number.isFinite(floor) && floor > contactSeq) contactSeq = Math.floor(floor);
}

type TickResult = { gameState: GameState; eventState?: EventState; combatState?: CombatState };

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
  eventState?: EventState,
  combatState?: CombatState
): TickResult {
  // A finished scenario stays finished
  if (state.isPaused || eventState?.scenarioResult) return { gameState: state, eventState, combatState };

  const simDtMs = Math.min(Math.max(dtMs, 0), MAX_REAL_DT_MS) * state.speed;
  const steps = Math.max(1, Math.ceil(simDtMs / MAX_SUBSTEP_MS));
  const stepMs = simDtMs / steps;

  let result: TickResult = { gameState: state, eventState, combatState };
  for (let i = 0; i < steps; i++) {
    result = tickStep(result.gameState, stepMs, aiState, result.eventState, result.combatState);
    if (result.eventState?.scenarioResult) break;
  }
  return result;
}

/**
 * One fixed simulated step through every phase. WeGo resolution calls this directly with
 * `planAI: false`: the AI keeps its mission and doctrine context but does not re-plan mid-turn.
 */
export function simulationStep(
  state: GameState,
  simDtMs: number,
  aiState?: AIState,
  eventState?: EventState,
  combatState?: CombatState,
  opts: { planAI?: boolean } = {}
): TickResult {
  return tickStep(state, simDtMs, aiState, eventState, combatState, opts.planAI ?? true);
}

function tickStep(
  state: GameState,
  simDtMs: number,
  aiState?: AIState,
  eventState?: EventState,
  combatState?: CombatState,
  planAI = true
): TickResult {
  const simDtSeconds = simDtMs / 1000;
  const newSimTime = state.simTime + simDtMs;
  let schedule: PhaseSchedule = state.schedule;

  // Work on a copy of the orders so nothing ever mutates the caller's map
  let currentOrders = new Map(state.orders);

  // --- Phase 0: AI Decision-making ---
  if (planAI && aiState && newSimTime >= schedule.aiAt) {
    currentOrders = runAIUpdate({ ...state, simTime: newSimTime, orders: currentOrders }, aiState);
    schedule = { ...schedule, aiAt: advanceDue(schedule.aiAt, newSimTime, AI_INTERVAL_MS) };
  }

  // --- Phase 1: Movement ---
  const newSides = state.sides.map((side) => ({
    ...side,
    units: side.units.map((unit) => {
      if (unit.damageState === "destroyed") return unit;

      const orders = currentOrders.get(unit.id);
      if (!orders) return unit;

      const result = updateUnitMovement(unit, orders, simDtSeconds);
      currentOrders.set(unit.id, result.orders);
      return result.unit;
    }),
  }));

  // --- Phase 2: Detection (every side, on its own schedule) ---
  let playerContacts = state.contacts;
  let sideContacts = state.sideContacts;
  if (newSimTime >= schedule.detectionAt) {
    schedule = { ...schedule, detectionAt: advanceDue(schedule.detectionAt, newSimTime, DETECTION_INTERVAL_MS) };
    const detectState: GameState = { ...state, sides: newSides, orders: currentOrders, simTime: newSimTime };
    const detected = runDetectionPhase(detectState);
    playerContacts = detected.player;
    sideContacts = detected.others;
  }

  // --- Phase 3: Contact aging, and dropping contacts on units that no longer exist ---
  const alive = new Set(newSides.flatMap((s) => s.units).filter((u) => u.damageState !== "destroyed").map((u) => u.id));
  const keep = (list: Contact[]) => ageContacts(list.filter((c) => alive.has(c.actualUnitId)), newSimTime);
  playerContacts = keep(playerContacts);
  sideContacts = Object.fromEntries(Object.entries(sideContacts).map(([side, list]) => [side, keep(list)]));

  let newGameState: GameState = {
    ...state,
    simTime: newSimTime,
    sides: newSides,
    contacts: playerContacts,
    sideContacts,
    orders: currentOrders,
    schedule,
  };

  // --- Phase 4: TCA Events (run BEFORE combat so doctrine changes take effect) ---
  // An EndScenario result is held until the tick has finished: combat can still change the outcome.
  let newEventState = eventState;
  let heldResult: ReturnType<typeof evaluateEvents>["pendingResult"];
  let ranBeforeCombat: string[] = [];
  if (eventState) {
    const eventResult = evaluateEvents(eventState, newGameState, aiState?.missions ?? [], { deferResult: true });
    newEventState = eventResult.eventState;
    heldResult = eventResult.pendingResult;
    ranBeforeCombat = eventResult.ran;

    if (eventResult.stateChanges.length > 0) {
      newGameState = applyStateChanges(newGameState, eventResult.stateChanges);
    }
  }

  // --- Phase 5: Combat (doctrine resolved per unit, including runtime overrides from events) ---
  let newCombatState = combatState;
  if (combatState) {
    const combatResult = runCombatPhase(
      newGameState,
      combatState,
      { missions: aiState?.missions ?? [], sideDoctrine: aiState?.sideDoctrine ?? {} },
      simDtSeconds
    );
    newGameState = combatResult.state;
    newCombatState = combatResult.combatState;
  }

  // --- Phase 6: terminal pass on post-combat state; the held result is final once it is decided ---
  if (newEventState) {
    const terminal = evaluateEvents(newEventState, newGameState, aiState?.missions ?? [], {
      deferResult: true,
      terminalOnly: true,
      skip: new Set(ranBeforeCombat),
    });
    if (terminal.stateChanges.length > 0) {
      newGameState = applyStateChanges(newGameState, terminal.stateChanges);
    }
    newEventState = { ...terminal.eventState, scenarioResult: mergeResults(heldResult, terminal.pendingResult) };
  }

  return { gameState: newGameState, eventState: newEventState, combatState: newCombatState };
}

/** Every side's sensors against every other side's units; each side only ever updates its own contacts. */
function runDetectionPhase(state: GameState): { player: Contact[]; others: Record<string, Contact[]> } {
  const allUnits: Unit[] = state.sides.flatMap((s) => s.units);
  const playerSide = state.scenario.playerSide;
  const stores: Record<string, Contact[]> = {};

  for (const side of state.sides) {
    const contacts = [...(side.name === playerSide ? state.contacts : state.sideContacts[side.name] ?? [])];
    const detectors = side.units.filter((u) => u.damageState !== "destroyed");
    const targets = allUnits.filter((u) => u.side !== side.name && u.side !== "Civilian" && u.damageState !== "destroyed");

    for (const detector of detectors) {
      const detectorOrders = state.orders.get(detector.id);
      if (!detectorOrders) continue;

      for (const target of targets) {
        const targetOrders = state.orders.get(target.id);
        if (!targetOrders) continue;

        const result = runDetectionChecks(detector, detectorOrders, target, targetOrders);
        if (!result) continue;

        const existingIdx = contacts.findIndex((c) => c.actualUnitId === target.id);
        if (existingIdx >= 0) {
          contacts[existingIdx] = mergeContact(contacts[existingIdx], result, target.position, state.simTime);
        } else {
          const jitterLat = (Math.random() - 0.5) * result.uncertainty * 0.009;
          const jitterLng = (Math.random() - 0.5) * result.uncertainty * 0.009;
          contactSeq += 1;
          contacts.push({
            id: `contact-${contactSeq}`,
            detectedById: detector.id,
            actualUnitId: target.id,
            side: side.name,
            classification: result.classification,
            position: { lat: target.position.lat + jitterLat, lng: target.position.lng + jitterLng },
            positionUncertainty: result.uncertainty,
            baseUncertainty: result.uncertainty,
            lastUpdateTime: state.simTime,
            lastFixTime: state.simTime,
            sensorType: result.sensorType,
            platformName: result.classification === "classified" ? target.name : undefined,
          });
        }
      }
    }
    stores[side.name] = contacts;
  }

  const { [playerSide]: player = state.contacts, ...others } = stores;
  return { player, others };
}
