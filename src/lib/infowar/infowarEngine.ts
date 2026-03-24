/**
 * InfoWar engine — orchestrates the full pipeline:
 * triggers → persona routing → prompt building → Ollama generation → posts
 */

import type {
  InfoWarTrigger,
  InfoWarConfig,
  MediaPost,
  MediaEra,
  Persona,
} from "./types";
import { selectRespondingPersonas, mergePersonas, DEFAULT_PERSONAS } from "./personas";
import { buildSystemPrompt, buildUserPrompt, getMaxLength } from "./promptBuilder";
import { ollamaService } from "./ollamaService";

let postCounter = 0;

function nextPostId(): string {
  return `iwp-${++postCounter}`;
}

// Delay ranges in sim-time ms by persona archetype speed
const DELAY_RANGES: Record<string, [number, number]> = {
  "wire-service": [2_000, 10_000],
  "osint-account": [3_000, 15_000],
  "state-media": [5_000, 30_000],
  "cable-pundit": [10_000, 45_000],
  "military-analyst": [15_000, 60_000],
  "civilian": [5_000, 40_000],
  "troll-farm": [3_000, 20_000],
  "diplomat": [30_000, 120_000],
  "anti-war-activist": [20_000, 90_000],
};

function getPostDelay(archetype: string): number {
  const [min, max] = DELAY_RANGES[archetype] ?? [5_000, 30_000];
  return min + Math.random() * (max - min);
}

export interface GenerationResult {
  post: MediaPost;
}

/**
 * Process a batch of triggers: route to personas, generate posts via Ollama.
 * Returns a promise for each generated post (they resolve independently).
 */
export function processTriggers(
  triggers: InfoWarTrigger[],
  era: MediaEra,
  config?: InfoWarConfig,
  onPost?: (post: MediaPost) => void
): number {
  const personas = mergePersonas(DEFAULT_PERSONAS, config?.personas);
  const model = config?.model ?? "mistral";
  let dispatched = 0;

  for (const trigger of triggers) {
    const selections = selectRespondingPersonas(
      trigger,
      personas,
      era,
      config?.disabledArchetypes
    );

    for (const { persona, channel } of selections) {
      dispatched++;
      generatePost(trigger, persona, channel, era, model, config?.customPromptPreamble)
        .then((post) => {
          if (post && onPost) onPost(post);
        })
        .catch(() => {
          // Generation failed silently — post just doesn't appear
        });
    }
  }

  return dispatched;
}

async function generatePost(
  trigger: InfoWarTrigger,
  persona: Persona,
  channel: MediaPost["channel"],
  era: MediaEra,
  model: string,
  customPreamble?: string
): Promise<MediaPost | null> {
  const systemPrompt = buildSystemPrompt(persona, channel, era, customPreamble);
  const userPrompt = buildUserPrompt(trigger);

  const content = await ollamaService.generate(systemPrompt, userPrompt, model);
  if (!content) return null;

  // Trim to max length for the channel
  const maxLen = getMaxLength(channel);
  const trimmed = content.length > maxLen ? content.slice(0, maxLen) : content;

  const delay = getPostDelay(persona.archetype);

  return {
    id: nextPostId(),
    triggerId: trigger.id,
    persona,
    channel,
    content: trimmed,
    simTime: trigger.simTime + delay,
    generatedAt: Date.now(),
    read: false,
  };
}

export function resetPostCounter(): void {
  postCounter = 0;
}
