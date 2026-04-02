import type { GameState, Contact } from "./gameState";
import type { CombatState } from "./combat";

export interface AutopausePreferences {
  enabled: boolean;
  triggers: {
    newContact: boolean;
    friendlyDamaged: boolean;
    friendlyDestroyed: boolean;
    weaponIncoming: boolean;
    scenarioMessage: boolean;
  };
}

export const DEFAULT_AUTOPAUSE: AutopausePreferences = {
  enabled: true,
  triggers: {
    newContact: true,
    friendlyDamaged: true,
    friendlyDestroyed: true,
    weaponIncoming: true,
    scenarioMessage: true,
  },
};

export interface AutopauseResult {
  shouldPause: boolean;
  reason: string;
  suggestedTab: "forces" | "messages" | "combat";
}

const STORAGE_KEY = "sandkasten-autopause";

export function loadAutopausePrefs(): AutopausePreferences {
  if (typeof window === "undefined") return DEFAULT_AUTOPAUSE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_AUTOPAUSE, ...JSON.parse(stored) };
  } catch {
    // ignore parse errors
  }
  return DEFAULT_AUTOPAUSE;
}

export function saveAutopausePrefs(prefs: AutopausePreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

/**
 * Compare two simulation states and determine if autopause should trigger.
 * Returns null if no trigger fired.
 */
export function checkAutopauseTriggers(
  prefs: AutopausePreferences,
  prevContacts: Contact[],
  nextContacts: Contact[],
  prevCombat: CombatState | undefined,
  nextCombat: CombatState | undefined,
  prevMessageCount: number,
  nextMessageCount: number,
  prevDamageStates: Map<string, string>,
  nextDamageStates: Map<string, string>,
  playerSide: string,
  seenTriggers: Set<string>
): AutopauseResult | null {
  if (!prefs.enabled) return null;

  // Check: new contact detected
  if (prefs.triggers.newContact) {
    const prevIds = new Set(prevContacts.map((c) => c.id));
    for (const contact of nextContacts) {
      if (!prevIds.has(contact.id) && !seenTriggers.has(`contact-${contact.id}`)) {
        seenTriggers.add(`contact-${contact.id}`);
        return {
          shouldPause: true,
          reason: "New contact detected",
          suggestedTab: "forces",
        };
      }
    }
  }

  // Check: friendly unit damaged or destroyed
  if (prefs.triggers.friendlyDamaged || prefs.triggers.friendlyDestroyed) {
    for (const [unitId, newState] of nextDamageStates) {
      const oldState = prevDamageStates.get(unitId) ?? "undamaged";
      if (oldState === newState) continue;

      if (
        prefs.triggers.friendlyDestroyed &&
        newState === "destroyed" &&
        !seenTriggers.has(`destroyed-${unitId}`)
      ) {
        seenTriggers.add(`destroyed-${unitId}`);
        return {
          shouldPause: true,
          reason: "Friendly unit destroyed",
          suggestedTab: "combat",
        };
      }

      if (
        prefs.triggers.friendlyDamaged &&
        (newState === "damaged" || newState === "mission-kill") &&
        oldState === "undamaged" &&
        !seenTriggers.has(`damaged-${unitId}`)
      ) {
        seenTriggers.add(`damaged-${unitId}`);
        return {
          shouldPause: true,
          reason: "Friendly unit damaged",
          suggestedTab: "combat",
        };
      }
    }
  }

  // Check: weapon launched at friendly
  if (prefs.triggers.weaponIncoming && nextCombat) {
    const prevWifIds = new Set(
      (prevCombat?.weaponsInFlight ?? []).map((w) => w.id)
    );
    for (const wif of nextCombat.weaponsInFlight) {
      if (prevWifIds.has(wif.id)) continue;
      // Incoming = launched by enemy, targeting friendly
      if (
        wif.launchedBySide !== playerSide &&
        !seenTriggers.has(`incoming-${wif.id}`)
      ) {
        seenTriggers.add(`incoming-${wif.id}`);
        return {
          shouldPause: true,
          reason: "Incoming weapon detected",
          suggestedTab: "combat",
        };
      }
    }
  }

  // Check: new scenario message
  if (prefs.triggers.scenarioMessage && nextMessageCount > prevMessageCount) {
    const triggerKey = `msg-${nextMessageCount}`;
    if (!seenTriggers.has(triggerKey)) {
      seenTriggers.add(triggerKey);
      return {
        shouldPause: true,
        reason: "New intel message",
        suggestedTab: "messages",
      };
    }
  }

  return null;
}

/**
 * Build a map of unitId → damageState for friendly units only.
 */
export function buildFriendlyDamageMap(
  state: GameState,
  playerSide: string
): Map<string, string> {
  const map = new Map<string, string>();
  for (const side of state.sides) {
    for (const unit of side.units) {
      if (unit.side === playerSide) {
        map.set(unit.id, unit.damageState);
      }
    }
  }
  return map;
}
