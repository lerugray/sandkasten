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
