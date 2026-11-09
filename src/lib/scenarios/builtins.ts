/**
 * The built-in battle configurations a play session (and a battle save) can name.
 *
 * A save file never carries scenario, mission, event or doctrine definitions: it names one of these by a
 * stable id and records the revision it was made against. Nothing here is mutable module state; the route
 * picks an id and hands that id's config to the session.
 */

import type { ScenarioConfig } from "@/lib/simulation/session";
import { demoScenarioConfig } from "@/lib/scenarios/demoConfig";
import { snapshotScenarioConfig } from "@/lib/snapshot/playConfig";
import { digestText, simulationProfilesDigest } from "@/lib/platforms/lookup";

export type BuiltinId = "hormuz" | "snapshot";
export const BUILTIN_IDS: readonly BuiltinId[] = ["hormuz", "snapshot"];

/**
 * Bump when a rule change makes older checkpoints meaningless even though no data record changed
 * (movement, detection, combat or event semantics). Data changes are caught by the digest below.
 */
export const RULES_REVISION = "sand-rules-1";

export function isBuiltinId(id: unknown): id is BuiltinId {
  return id === "hormuz" || id === "snapshot";
}

let snapshotConfig: ScenarioConfig | null = null;

export function getBuiltinConfig(id: BuiltinId): ScenarioConfig {
  if (id === "snapshot") return (snapshotConfig ??= snapshotScenarioConfig());
  return demoScenarioConfig;
}

const revisions = new Map<BuiltinId, string>();

/** Revision of the rules, the simulation profiles and this configuration's own static definition. */
export function builtinRevision(id: BuiltinId): string {
  const known = revisions.get(id);
  if (known) return known;
  const c = getBuiltinConfig(id);
  const s = c.scenario;
  const definition = JSON.stringify({
    scenario: { name: s.name, startTime: s.startTime, playerSide: s.playerSide, sides: s.sides, referencePoints: s.referencePoints },
    missions: c.missions ?? [],
    sideDoctrine: c.sideDoctrine ?? {},
    events: c.events?.events ?? null,
  });
  const rev = `${RULES_REVISION}.${simulationProfilesDigest()}.${digestText(definition)}`;
  revisions.set(id, rev);
  return rev;
}
