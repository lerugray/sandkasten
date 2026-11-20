/**
 * The title screen's scenario menu, derived from the same built-in scenario data the play view
 * opens. Nothing here is invented: the name, briefing line and side come straight off the
 * scenario object; the mode and length are read from what the scenario actually carries.
 *
 * - mode: a snapshot scenario plays continuous only (see src/lib/snapshot/playConfig.ts and
 *   TerminalPlay's `modeChoice = !config.scenario.snapshot`); the Hormuz demo offers the
 *   continuous / WeGo choice.
 * - length: neither built-in carries a `duration`. The snapshot has no missions or events, so
 *   nothing ever ends it (open ended). The Hormuz demo's only endings are the transit gate and
 *   the carrier lost (see demoConfig.ts), so it has no time limit (the same "no time limit"
 *   claim the briefing presenter makes in src/lib/scenarios/objective.ts).
 */

import { demoScenario } from "@/lib/scenarios/demo";
import { exampleSnapshotScenario } from "@/lib/snapshot/example";
import type { Scenario } from "@/types/game";

export type MenuEntryKind = "scenario" | "editor" | "database" | "about";

export interface TitleMenuEntry {
  id: string;
  kind: MenuEntryKind;
  title: string;
  /** One-line briefing, the scenario's own first sentence for built-ins. */
  brief: string;
  side: string | null;
  length: string | null;
  mode: string | null;
  /** Navigation target; null for the ABOUT entry (it opens a panel instead). */
  href: string | null;
}

/** The scenario's briefing line: its first sentence, exactly as written. */
function firstSentence(text: string): string {
  const end = text.indexOf(". ");
  return end === -1 ? text : text.slice(0, end + 1);
}

function scenarioEntry(id: "hormuz" | "snapshot", scenario: Scenario): TitleMenuEntry {
  const snapshot = !!scenario.snapshot;
  return {
    id,
    kind: "scenario",
    title: scenario.name,
    brief: firstSentence(scenario.briefing),
    side: scenario.playerSide.toUpperCase(),
    length: snapshot ? "OPEN ENDED" : "NO TIME LIMIT",
    mode: snapshot ? "CONTINUOUS" : "CONTINUOUS OR WEGO",
    href: `/play?scenario=${id}`,
  };
}

/** Every built-in scenario the play view can open, in menu order. */
export const BUILTIN_SCENARIO_ENTRIES: TitleMenuEntry[] = [
  scenarioEntry("hormuz", demoScenario),
  scenarioEntry("snapshot", exampleSnapshotScenario),
];

export const TITLE_MENU: TitleMenuEntry[] = [
  ...BUILTIN_SCENARIO_ENTRIES,
  {
    id: "editor",
    kind: "editor",
    title: "BUILD YOUR OWN",
    brief: "Open the scenario editor and place your own forces.",
    side: null,
    length: null,
    mode: null,
    href: "/editor",
  },
  {
    id: "database",
    kind: "database",
    title: "PLATFORM MANUAL",
    brief: "The open platform database: real ships and aircraft, sourced and open.",
    side: null,
    length: null,
    mode: null,
    href: "/database",
  },
  {
    id: "about",
    kind: "about",
    title: "ABOUT",
    brief: "Version, credits and data sources.",
    side: null,
    length: null,
    mode: null,
    href: null,
  },
];
