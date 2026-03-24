/**
 * Prompt builder — constructs LLM prompts from trigger + persona + channel + era.
 */

import type { Persona, MediaChannel, MediaEra, InfoWarTrigger } from "./types";

interface ChannelSpec {
  maxLength: number;
  formatInstructions: string;
}

const CHANNEL_SPECS: Record<MediaChannel, ChannelSpec> = {
  "radio-broadcast": {
    maxLength: 500,
    formatInstructions:
      "Write a brief radio news bulletin, 2-3 sentences. Conversational but authoritative tone. Start with a location or time reference.",
  },
  "newspaper-headline": {
    maxLength: 120,
    formatInstructions:
      "Write a single newspaper headline. Bold, punchy, present tense. No period at the end.",
  },
  "wire-bulletin": {
    maxLength: 300,
    formatInstructions:
      "Write a wire service bulletin. Lead with the key fact. Attribute claims to sources. Terse, factual style.",
  },
  "government-communique": {
    maxLength: 400,
    formatInstructions:
      "Write an official government statement or press release excerpt. Formal, measured language. References policy or legal justification.",
  },
  "cable-news-ticker": {
    maxLength: 140,
    formatInstructions:
      "Write a single cable news ticker/chyron line. ALL CAPS. Urgent, punchy. May start with BREAKING or DEVELOPING.",
  },
  "tv-anchor": {
    maxLength: 400,
    formatInstructions:
      "Write as a TV news anchor delivering a live report. Dramatic but professional. May address viewers directly.",
  },
  "blog-post": {
    maxLength: 600,
    formatInstructions:
      "Write a short blog post excerpt or hot take. Opinionated, analytical. May reference previous posts or broader context.",
  },
  "web-forum": {
    maxLength: 400,
    formatInstructions:
      "Write a forum post or comment. Informal, may use internet slang. Reacting to news in real time.",
  },
  "embedded-journalist": {
    maxLength: 500,
    formatInstructions:
      "Write as an embedded journalist filing a report. First-person, vivid, describes what you see and hear. Credible but human.",
  },
  tweet: {
    maxLength: 280,
    formatInstructions:
      "Write a single tweet, max 280 characters. May include @mentions or hashtags. Concise, punchy.",
  },
  reddit: {
    maxLength: 500,
    formatInstructions:
      "Write a Reddit comment. Informal, analytical or emotional depending on persona. May reference subreddit conventions.",
  },
  "youtube-caption": {
    maxLength: 200,
    formatInstructions:
      "Write a YouTube video title and first line of description. Clickbait-adjacent but informative.",
  },
  telegram: {
    maxLength: 400,
    formatInstructions:
      "Write a Telegram channel post. 1-3 sentences. May use emoji sparingly. Direct and informative.",
  },
  "tiktok-caption": {
    maxLength: 150,
    formatInstructions:
      "Write a TikTok video caption. Very short, casual, may use emoji. References a video the user is supposedly watching.",
  },
  "osint-account": {
    maxLength: 300,
    formatInstructions:
      "Write as an OSINT analyst account. References coordinates, timestamps, satellite imagery, AIS/ADS-B data. Technical but accessible.",
  },
};

function getEraYear(era: MediaEra): string {
  switch (era) {
    case "pre-1980":
      return "the 1960s-1970s";
    case "1980s-1990s":
      return "the 1980s-1990s";
    case "2000s":
      return "the 2000s";
    case "2010s":
      return "the 2010s";
    case "2020s+":
      return "the mid-2020s";
  }
}

export function buildSystemPrompt(
  persona: Persona,
  channel: MediaChannel,
  era: MediaEra,
  customPreamble?: string
): string {
  const spec = CHANNEL_SPECS[channel];
  const eraLabel = getEraYear(era);

  return [
    `You are roleplaying as "${persona.name}", a ${persona.archetype.replace("-", " ")} persona.`,
    `Your tone: ${persona.tone}.`,
    persona.sideLean !== "neutral"
      ? `You sympathize with the ${persona.sideLean} side.`
      : "You are neutral and do not take sides.",
    `The time period is ${eraLabel}.`,
    "",
    spec.formatInstructions,
    `Maximum length: ${spec.maxLength} characters.`,
    "",
    "Rules:",
    "- Stay in character at all times. Never break the fourth wall.",
    "- Do not mention that you are an AI or that this is a simulation.",
    "- Include realistic details consistent with what this persona would know.",
    "- Write ONLY the post content. No labels, no quotation marks, no meta-text.",
    customPreamble ? `\nAdditional context: ${customPreamble}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildUserPrompt(trigger: InfoWarTrigger): string {
  const detailLines = Object.entries(trigger.details)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  return [
    `Breaking event: ${trigger.summary}`,
    detailLines ? `Details:\n${detailLines}` : "",
    "Write a single post reacting to this event.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function getMaxLength(channel: MediaChannel): number {
  return CHANNEL_SPECS[channel].maxLength;
}
