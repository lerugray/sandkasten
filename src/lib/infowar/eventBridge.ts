/**
 * Event bridge — observes game state diffs and emits InfoWar triggers.
 *
 * This module reads CombatEvent[] and EventMessage[] as output from
 * the existing systems. Zero modifications to events.ts or combat.ts.
 */

import type { CombatEvent } from "@/lib/simulation/combat";
import type { EventMessage } from "@/lib/ai/events";
import type { InfoWarTrigger, InfoWarTriggerType } from "./types";

let triggerCounter = 0;

function nextTriggerId(): string {
  return `iwt-${++triggerCounter}`;
}

const COMBAT_TYPE_MAP: Record<string, InfoWarTriggerType> = {
  launch: "missile-launched",
  hit: "missile-hit",
  miss: "missile-miss",
  destroyed: "unit-destroyed",
  damaged: "unit-damaged",
  defended: "missile-defended",
};

// Deduplication window in sim-time ms
const DEDUP_WINDOW_MS = 10_000;

/**
 * Extract new InfoWar triggers by diffing previous and current state.
 *
 * Call this each render cycle with the current combat log and event messages.
 * Pass the previous array lengths to know what's new.
 */
export function extractTriggers(
  combatLog: CombatEvent[],
  prevCombatLogLength: number,
  messages: EventMessage[],
  prevMessageCount: number
): InfoWarTrigger[] {
  const triggers: InfoWarTrigger[] = [];

  // New combat events
  for (let i = prevCombatLogLength; i < combatLog.length; i++) {
    const evt = combatLog[i];
    const type = COMBAT_TYPE_MAP[evt.type];
    if (!type) continue;

    // Skip intercept events — they're intermediate, not newsworthy on their own
    if (evt.type === "intercept") continue;

    triggers.push({
      id: nextTriggerId(),
      type,
      simTime: evt.time,
      summary: evt.description,
      details: {
        side: evt.side,
        unitName: evt.unitId,
        targetName: evt.targetId,
      },
    });
  }

  // New scenario messages
  for (let i = prevMessageCount; i < messages.length; i++) {
    const msg = messages[i];
    triggers.push({
      id: nextTriggerId(),
      type: "scenario-message",
      simTime: msg.time,
      summary: `${msg.title ?? "Intel"}: ${msg.text}`,
      details: {
        side: msg.side,
      },
    });
  }

  return deduplicateTriggers(triggers);
}

/**
 * Merge triggers of the same type within a time window into a single trigger.
 */
function deduplicateTriggers(triggers: InfoWarTrigger[]): InfoWarTrigger[] {
  if (triggers.length <= 1) return triggers;

  const deduped: InfoWarTrigger[] = [];
  const seen = new Map<string, InfoWarTrigger>();

  for (const trigger of triggers) {
    // Key by type + rough time bucket
    const timeBucket = Math.floor(trigger.simTime / DEDUP_WINDOW_MS);
    const key = `${trigger.type}:${timeBucket}`;

    const existing = seen.get(key);
    if (existing) {
      // Merge: append to summary
      existing.summary += ` | ${trigger.summary}`;
    } else {
      seen.set(key, trigger);
      deduped.push(trigger);
    }
  }

  return deduped;
}

/**
 * Reset the trigger counter (e.g., on scenario reset).
 */
export function resetTriggerCounter(): void {
  triggerCounter = 0;
}
