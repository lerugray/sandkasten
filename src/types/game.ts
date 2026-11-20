import type { Facility } from "@/lib/facilities/facilities";
import type { OsintSite } from "@/lib/osint/types";

export interface Position {
  lng: number;
  lat: number;
}

export interface Unit {
  id: string;
  name: string;
  platformId: number;
  side: string;
  position: Position;
  heading: number;
  speed: number;
  altitude?: number;
  damageState: "undamaged" | "damaged" | "mission-kill" | "destroyed";
  /** Damage points taken so far; damageState derives from this against the platform's damagePoints. */
  damage?: number;
  mission?: string;
  /** Real-world base this unit operates from (facility id from data/facilities); runwayEnd is the threshold it starts on. */
  homeBase?: { facilityId: string; runwayEnd?: string };
  /**
   * Real-world type designator when the unit came from a snapshot (ICAO type code, e.g. "B738", "F18S").
   * Informational only: the sim reads `platformId`.
   */
  typeCode?: string;
  /**
   * True for a snapshot contact whose type is not in the platform DB. It carries a generic
   * placeholder platformId (UNKNOWN_AIR_PLATFORM_ID / UNKNOWN_SURFACE_PLATFORM_ID in
   * lib/platforms/lookup.ts: unarmed, default sensors) and sits on the Neutral side,
   * which isHostileSide() already keeps out of combat.
   */
  unknown?: true;
  /**
   * Air operations (SAND-AIR-1). A carrier or airbase holds aircraft in an air wing, counted
   * by platform type. Launching moves one aircraft out as a new airborne unit; recovery brings
   * it back and starts its turnaround timer before it can launch again.
   */
  airWing?: AirWingSlot[];
  /** A launched aircraft returns to this host unit (carrier/airbase id). */
  hostUnitId?: string;
  /** What a launched aircraft is doing right now. Absent for ground/surface units and for scenario-authored airborne aircraft. */
  airStatus?: AirStatus;
  /** Sim time (ms) at which a launching aircraft becomes airborne. */
  launchReadyAtMs?: number;
  /** Sim time (ms) at which a landing aircraft touches down and rejoins its host's air wing. */
  landReadyAtMs?: number;
  /** Remaining flight endurance in sim ms; an airborne aircraft is lost when it reaches zero. */
  fuelRemainingMs?: number;
  /** An airborne aircraft has been ordered to return to its host. */
  recovering?: boolean;
}

export type AirStatus = "launching" | "airborne" | "landing";

export interface AirWingSlot {
  /** Platform-database id of the held aircraft type. */
  platformId: number;
  /** Aircraft of this type currently parked on the host. */
  count: number;
  /** Sim time (ms) at which the slot's next aircraft finishes turnaround and may launch. */
  readyAtMs: number;
  /** Rearm/refuel turnaround time in sim ms after a recovered aircraft parks. */
  turnaroundMs: number;
}

export interface Side {
  name: string;
  color: string;
  isAI: boolean;
  units: Unit[];
}

export interface ReferencePoint {
  id: string;
  name: string;
  type: "point" | "area";
  side?: string;
  points: Position[];
}

export type VictoryConditionKind =
  | "destroy-unit"
  | "destroy-side"
  | "protect-unit"
  | "reach-area"
  | "hold-area"
  | "time-limit"
  | "score";

export type VictoryResult = "victory" | "defeat" | "draw";

/**
 * One victory condition the scenario editor authors. Stored on the scenario in plain, friendly form;
 * `lib/scenarios/victoryConditions.ts` compiles the list into the TCA events the engine already
 * evaluates, so the editor never edits raw triggers/conditions/actions.
 */
export interface VictoryCondition {
  id: string;
  kind: VictoryConditionKind;
  result: VictoryResult;
  /** Debrief message shown on the result card. */
  message: string;
  /** Side the rule is about; defaults to the player's side at compile time. */
  side?: string;
  /** Target unit for destroy-unit / protect-unit; optional for reach-area. */
  unitId?: string;
  /** Reference area (must be type "area") for reach-area / hold-area. */
  areaId?: string;
  /** Minimum own units afloat for hold-area (default 1). */
  count?: number;
  /** Score threshold for score (default 0). */
  threshold?: number;
  /** Score comparison for score (default "gte"). */
  comparison?: "gte" | "lte";
  /** Minutes after scenario start for time-limit / hold-area (default 0). */
  minutes?: number;
}

/** One data source behind a real-world snapshot scenario (see lib/snapshot/seed.ts). */
export interface SnapshotSource {
  id: string;
  name: string;
  url: string;
  terms: string;
  rateLimit: string;
  /** ISO UTC time of the (last) request; null when the source was skipped without a request. */
  fetchedAt: string | null;
  status: "used" | "skipped" | "failed";
  /** Why a source was skipped or failed. */
  reason?: string;
  counts?: Record<string, number>;
}

/** Provenance block of a snapshot scenario; absent on hand-authored scenarios. */
export interface SnapshotMeta {
  schema: 1;
  kind: "adsb-snapshot";
  fetchedAt: string;
  bbox: [number, number, number, number];
  sources: SnapshotSource[];
  limitations: string[];
  counts: {
    units: number;
    /** Military aircraft mapped to a platform-DB record, by ICAO type code. */
    mappedByType: Record<string, number>;
    /** Aircraft/vessels left as UNKNOWN contacts (generic placeholder platform). */
    unknownContacts: number;
    bySide: Record<string, number>;
  };
}

export interface Scenario {
  name: string;
  description: string;
  briefing: string;
  theater: {
    center: Position;
    zoom: number;
    bounds?: [number, number, number, number];
  };
  startTime: string;
  playerSide: string;
  sides: Side[];
  referencePoints: ReferencePoint[];
  /** Victory conditions authored in the editor; compiled to TCA events when the scenario is played. */
  victoryConditions?: VictoryCondition[];
  /** Real-world installations (airbases, naval bases, ports) shown on the map; loaded from data/facilities. */
  facilities?: Facility[];
  /** Real-world OSINT air defence / radar / nuclear sites (data/osint) owned by a side; map objects with published ranges, not simulated units. */
  osint?: OsintSite[];
  /** Set only on real-world snapshot scenarios (lib/snapshot/seed.ts). */
  snapshot?: SnapshotMeta;
}

export type Affiliation = "friendly" | "hostile" | "neutral" | "unknown";

export function getAffiliation(
  unit: Unit,
  playerSide: string
): Affiliation {
  if (unit.side === playerSide) return "friendly";
  if (unit.side === "Civilian" || unit.side === "Neutral") return "neutral";
  return "hostile";
}

/** Sides that never take part in combat: no detection of them as enemies, no automatic fire on them. */
const NON_COMBATANT_SIDES = new Set(["Civilian", "Neutral"]);

/** The one hostility predicate shared by detection, AI and combat. */
export function isHostileSide(a: string, b: string): boolean {
  return a !== b && !NON_COMBATANT_SIDES.has(a) && !NON_COMBATANT_SIDES.has(b);
}
