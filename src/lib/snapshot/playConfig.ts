import type { ScenarioConfig } from "@/lib/simulation/session";
import type { Scenario } from "@/types/game";
import { exampleSnapshotScenario, withFacilities } from "./example";

/**
 * Play config for a snapshot scenario: no scripted missions or events (nothing to win or lose), every side on
 * weapons-hold so the real-world picture just runs, infowar off (it would call a local LLM).
 */
export function snapshotScenarioConfig(scenario: Scenario = exampleSnapshotScenario): ScenarioConfig {
  const s = scenario.facilities ? scenario : withFacilities(scenario);
  return {
    scenario: s,
    missions: [],
    sideDoctrine: Object.fromEntries(s.sides.map((side) => [side.name, { roe: "weapons-hold" as const }])),
    infowar: { enabled: false },
  };
}
