/**
 * Persona library and routing.
 *
 * Default persona archetypes for military/geopolitical scenarios,
 * plus routing logic that selects which personas react to a given trigger.
 */

import type {
  Persona,
  InfoWarTrigger,
  InfoWarTriggerType,
  MediaEra,
  MediaChannel,
  PersonaArchetype,
} from "./types";
import { getAvailableChannels } from "./eraFilter";

// Major events that attract more coverage
const MAJOR_EVENT_TYPES: InfoWarTriggerType[] = [
  "unit-destroyed",
  "missile-hit",
  "unit-spawned",
];

const FREQUENCY_PROBABILITY: Record<Persona["postingFrequency"], number> = {
  high: 0.8,
  medium: 0.4,
  low: 0.15,
};

const MAX_PERSONAS_PER_TRIGGER = 4;

/**
 * Default persona library. Scenario authors can override or extend
 * these via InfoWarConfig.personas in the scenario config.
 */
export const DEFAULT_PERSONAS: Persona[] = [
  {
    id: "state-media-a",
    name: "IRNA News Agency",
    archetype: "state-media",
    sideLean: "Iran",
    channels: ["cable-news-ticker", "tweet", "radio-broadcast", "newspaper-headline"],
    postingFrequency: "high",
    tone: "Formal and defiant. Frames all military action as defense of sovereignty against foreign aggression.",
    avatar: "IRNA",
    reactsTo: ["unit-destroyed", "missile-launched", "missile-hit", "unit-detected", "scenario-message"],
  },
  {
    id: "state-media-b",
    name: "Pentagon Press Secretary",
    archetype: "state-media",
    sideLean: "US Navy",
    channels: ["cable-news-ticker", "tweet", "government-communique", "tv-anchor"],
    postingFrequency: "high",
    tone: "Measured and professional. Cites rules of engagement and proportional response. Never admits fault.",
    avatar: "DOD",
    reactsTo: ["unit-destroyed", "missile-launched", "missile-hit", "missile-defended", "scenario-message"],
  },
  {
    id: "wire-reuters",
    name: "Reuters Gulf Desk",
    archetype: "wire-service",
    sideLean: "neutral",
    channels: ["wire-bulletin", "tweet", "cable-news-ticker"],
    postingFrequency: "high",
    tone: "Terse and factual. Attributes every claim. No editorializing.",
    avatar: "RTR",
    reactsTo: ["unit-destroyed", "missile-launched", "missile-hit", "unit-damaged", "scenario-message", "unit-spawned"],
  },
  {
    id: "cable-pundit",
    name: "Wolf Blitzer",
    archetype: "cable-pundit",
    sideLean: "neutral",
    channels: ["cable-news-ticker", "tv-anchor", "tweet"],
    postingFrequency: "medium",
    tone: "Breathless and dramatic. Treats every development as the top story. Speculates on escalation.",
    avatar: "CNN",
    reactsTo: ["unit-destroyed", "missile-hit", "missile-launched", "unit-spawned"],
  },
  {
    id: "mil-analyst",
    name: "Naval Intel Brief",
    archetype: "military-analyst",
    sideLean: "neutral",
    channels: ["tweet", "blog-post", "telegram", "osint-account"],
    postingFrequency: "medium",
    tone: "Technical and analytical. Names specific weapon systems, ranges, and doctrine. Reads like a defense journal.",
    avatar: "MIL",
    reactsTo: ["unit-destroyed", "missile-launched", "missile-hit", "missile-defended", "missile-miss", "unit-detected"],
  },
  {
    id: "osint-tracker",
    name: "@StraitWatch_OSINT",
    archetype: "osint-account",
    sideLean: "neutral",
    channels: ["tweet", "telegram", "osint-account"],
    postingFrequency: "high",
    tone: "Posts coordinates, timestamps, and AIS track data. Cites satellite imagery. No speculation.",
    avatar: "OSI",
    reactsTo: ["unit-destroyed", "unit-damaged", "missile-launched", "missile-hit", "unit-detected", "unit-spawned"],
  },
  {
    id: "diplomat",
    name: "UN Security Council Source",
    archetype: "diplomat",
    sideLean: "neutral",
    channels: ["government-communique", "cable-news-ticker", "tweet"],
    postingFrequency: "low",
    tone: "Calls for restraint. Cites international law and UNSC resolutions. Avoids assigning blame.",
    avatar: "UN",
    reactsTo: ["unit-destroyed", "missile-hit", "scenario-message"],
  },
  {
    id: "civilian-a",
    name: "Bandar Abbas Resident",
    archetype: "civilian",
    sideLean: "Iran",
    channels: ["tweet", "telegram", "web-forum", "radio-broadcast"],
    postingFrequency: "medium",
    tone: "Eyewitness. Describes explosions, jet noise, sirens. Worried about family. Writes in fragments.",
    avatar: "CIV",
    reactsTo: ["unit-destroyed", "missile-launched", "missile-hit", "unit-detected"],
  },
  {
    id: "civilian-b",
    name: "Bahrain Expat Worker",
    archetype: "civilian",
    sideLean: "neutral",
    channels: ["tweet", "telegram", "web-forum"],
    postingFrequency: "low",
    tone: "Secondhand reports only. Asks about flight cancellations and embassy advisories. Passes along rumors.",
    avatar: "CIV",
    reactsTo: ["unit-destroyed", "missile-hit", "scenario-message"],
  },
  {
    id: "troll-farm",
    name: "FreedomEagle1776",
    archetype: "troll-farm",
    sideLean: "US Navy",
    channels: ["tweet", "web-forum", "reddit", "telegram"],
    postingFrequency: "medium",
    tone: "Jingoistic. Mixes real events with exaggeration. Uses slang and ALL CAPS for emphasis.",
    avatar: "BOT",
    reactsTo: ["unit-destroyed", "missile-hit", "missile-defended", "missile-launched"],
  },
  {
    id: "troll-farm-b",
    name: "PersianLion_88",
    archetype: "troll-farm",
    sideLean: "Iran",
    channels: ["tweet", "web-forum", "telegram"],
    postingFrequency: "medium",
    tone: "Nationalist. Inflates enemy casualties and downplays own losses. Mixes facts with spin.",
    avatar: "BOT",
    reactsTo: ["unit-destroyed", "missile-hit", "missile-launched", "missile-defended"],
  },
  {
    id: "antiwar",
    name: "Peace Action Network",
    archetype: "anti-war-activist",
    sideLean: "neutral",
    channels: ["tweet", "blog-post", "web-forum", "reddit"],
    postingFrequency: "low",
    tone: "Counts civilian cost. Demands ceasefire. Names the weapons but not the tactics.",
    avatar: "PAX",
    reactsTo: ["unit-destroyed", "missile-hit", "scenario-message"],
  },
];

export interface PersonaSelection {
  persona: Persona;
  channel: MediaChannel;
}

/**
 * Select which personas respond to a trigger, filtered by era.
 * Returns persona + the channel they'll post on.
 */
export function selectRespondingPersonas(
  trigger: InfoWarTrigger,
  personas: Persona[],
  era: MediaEra,
  disabledArchetypes?: PersonaArchetype[]
): PersonaSelection[] {
  const availableChannels = new Set(getAvailableChannels(era));
  const isMajor = MAJOR_EVENT_TYPES.includes(trigger.type);

  const candidates: PersonaSelection[] = [];

  for (const persona of personas) {
    // Skip disabled archetypes
    if (disabledArchetypes?.includes(persona.archetype)) continue;

    // Must react to this trigger type
    if (!persona.reactsTo.includes(trigger.type)) continue;

    // Find first channel available in this era
    const channel = persona.channels.find((c) => availableChannels.has(c));
    if (!channel) continue;

    // Probability gate
    let prob = FREQUENCY_PROBABILITY[persona.postingFrequency];
    if (isMajor) prob = Math.min(1, prob * 2);

    if (Math.random() < prob) {
      candidates.push({ persona, channel });
    }
  }

  // Cap to prevent flooding
  if (candidates.length > MAX_PERSONAS_PER_TRIGGER) {
    // Shuffle and take first N
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    return candidates.slice(0, MAX_PERSONAS_PER_TRIGGER);
  }

  return candidates;
}

/**
 * Merge scenario-specific personas with defaults.
 * Scenario personas with matching IDs override defaults; new IDs are appended.
 */
export function mergePersonas(
  defaults: Persona[],
  overrides?: Persona[]
): Persona[] {
  if (!overrides?.length) return defaults;

  const merged = new Map<string, Persona>();
  for (const p of defaults) merged.set(p.id, p);
  for (const p of overrides) merged.set(p.id, p);
  return Array.from(merged.values());
}
