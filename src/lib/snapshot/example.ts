// The committed example snapshot (data/snapshots/*.scenario.json) as a ready-to-open Scenario.
// To switch the example, regenerate with scripts/snapshot-seed.mjs and change the import below.
import type { Scenario } from "@/types/game";
import { hormuzFacilities } from "@/lib/facilities/facilities";
import { osintSites } from "@/lib/osint/sites";
import raw from "../../../data/snapshots/hormuz-adsb-20261106T190240Z.scenario.json";

/** The scenario file as committed (no facilities embedded). */
export const exampleSnapshotRaw = raw as unknown as Scenario;

/** What the editor and /play open: the file plus the Hormuz facilities and OSINT sites, which the app attaches itself. */
export function withFacilities(scenario: Scenario): Scenario {
  return { ...scenario, facilities: hormuzFacilities, osint: osintSites };
}

export const exampleSnapshotScenario: Scenario = withFacilities(exampleSnapshotRaw);
