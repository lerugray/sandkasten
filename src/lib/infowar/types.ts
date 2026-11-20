/**
 * InfoWar Feed — Type definitions
 *
 * Era-appropriate media post generation from in-game events.
 */

// --- Eras and Channels ---

export type MediaEra = "pre-1980" | "1980s-1990s" | "2000s" | "2010s" | "2020s+";

export type MediaChannel =
  | "radio-broadcast"
  | "newspaper-headline"
  | "wire-bulletin"
  | "government-communique"
  | "cable-news-ticker"
  | "tv-anchor"
  | "blog-post"
  | "web-forum"
  | "embedded-journalist"
  | "tweet"
  | "reddit"
  | "youtube-caption"
  | "telegram"
  | "tiktok-caption"
  | "osint-account";

// --- Personas ---

export type PersonaArchetype =
  | "state-media"
  | "wire-service"
  | "cable-pundit"
  | "military-analyst"
  | "osint-account"
  | "diplomat"
  | "civilian"
  | "troll-farm"
  | "anti-war-activist";

export interface Persona {
  id: string;
  name: string;
  archetype: PersonaArchetype;
  sideLean: string | "neutral";
  channels: MediaChannel[];
  postingFrequency: "high" | "medium" | "low";
  tone: string;
  avatar: string;
  reactsTo: InfoWarTriggerType[];
}

// --- InfoWar Triggers (bridge from game events) ---

export type InfoWarTriggerType =
  | "unit-destroyed"
  | "unit-damaged"
  | "missile-launched"
  | "missile-hit"
  | "missile-miss"
  | "missile-defended"
  | "unit-detected"
  | "scenario-message"
  | "score-change"
  | "unit-spawned";

export interface InfoWarTrigger {
  id: string;
  type: InfoWarTriggerType;
  simTime: number;
  summary: string;
  details: {
    side?: string;
    unitName?: string;
    unitType?: string;
    targetName?: string;
    targetType?: string;
    weaponName?: string;
    area?: string;
    [key: string]: string | undefined;
  };
}

// --- Media Posts (output) ---

export interface MediaPost {
  id: string;
  triggerId: string;
  persona: Persona;
  channel: MediaChannel;
  content: string;
  simTime: number;
  generatedAt: number;
  read: boolean;
}

// --- InfoWar State ---

export interface InfoWarState {
  enabled: boolean;
  ollamaConnected: boolean;
  posts: MediaPost[];
  pendingTriggers: InfoWarTrigger[];
  generatingCount: number;
  era: MediaEra;
  personas: Persona[];
  model: string;
}

// --- Scenario-level config ---

export interface InfoWarConfig {
  enabled?: boolean;
  model?: string;
  personas?: Persona[];
  disabledArchetypes?: PersonaArchetype[];
  customPromptPreamble?: string;
}
