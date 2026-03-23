/**
 * Mission system — defines what AI units do.
 * Units assigned to a mission receive waypoints and behavior from the mission AI.
 *
 * See GDD Section 6.1 for mission types and settings.
 */

import type { Position, Unit } from "@/types/game";
import type { Doctrine } from "./doctrine";

export type MissionType =
  | "patrol"
  | "strike"
  | "cap"
  | "escort"
  | "transit"
  | "support";

export interface Mission {
  id: string;
  name: string;
  side: string;
  type: MissionType;
  assignedUnitIds: string[];
  referencePoints: Position[]; // patrol area vertices, strike target, CAP station, etc.
  prosecutionRange: number; // km — how far to chase contacts
  repeating: boolean;
  doctrineOverrides?: Partial<Doctrine>;
  // Strike-specific
  targetUnitId?: string; // for strike: specific unit to attack
  // Escort-specific
  escortTargetId?: string; // unit ID to escort
}

/**
 * Generate AI waypoints for a patrol mission.
 * Units cycle through reference points in order.
 */
export function generatePatrolWaypoints(
  mission: Mission,
  unit: Unit,
  currentWaypointIndex: number
): Position[] {
  if (mission.referencePoints.length === 0) return [];

  // Build a loop of waypoints starting from where we left off
  const waypoints: Position[] = [];
  const pts = mission.referencePoints;
  const startIdx = currentWaypointIndex % pts.length;

  // Add remaining points in the cycle, then loop back
  for (let i = 0; i < pts.length; i++) {
    waypoints.push(pts[(startIdx + i) % pts.length]);
  }

  return waypoints;
}

/**
 * Generate waypoints for a CAP (Combat Air Patrol) mission.
 * Orbit between two points in a racetrack pattern.
 */
export function generateCAPWaypoints(
  mission: Mission,
  unit: Unit
): Position[] {
  if (mission.referencePoints.length === 0) return [];

  if (mission.referencePoints.length === 1) {
    // Single point — orbit in a small box around it
    const center = mission.referencePoints[0];
    const offset = 0.15; // ~15km at typical latitudes
    return [
      { lng: center.lng - offset, lat: center.lat + offset },
      { lng: center.lng + offset, lat: center.lat + offset },
      { lng: center.lng + offset, lat: center.lat - offset },
      { lng: center.lng - offset, lat: center.lat - offset },
    ];
  }

  // Two+ points — racetrack between first two points
  return [mission.referencePoints[0], mission.referencePoints[1]];
}

/**
 * Generate waypoints for a strike mission.
 * Head toward target, then return to first reference point.
 */
export function generateStrikeWaypoints(
  mission: Mission,
  targetPosition: Position
): Position[] {
  const waypoints: Position[] = [targetPosition];

  // Return to base (first reference point) after strike
  if (mission.referencePoints.length > 0) {
    waypoints.push(mission.referencePoints[0]);
  }

  return waypoints;
}

/**
 * Generate waypoints for an escort mission.
 * Stay near the escorted unit — no fixed waypoints.
 * Returns a single waypoint toward the escort target.
 */
export function generateEscortWaypoint(
  escortTarget: Unit,
  escortUnit: Unit,
  stationOffsetKm: number = 5
): Position {
  // Station slightly ahead and to the side of the escorted unit
  const headingRad = (escortTarget.heading * Math.PI) / 180;
  const offsetLat = (stationOffsetKm / 111) * Math.cos(headingRad + Math.PI / 4);
  const offsetLng =
    (stationOffsetKm / (111 * Math.cos((escortTarget.position.lat * Math.PI) / 180))) *
    Math.sin(headingRad + Math.PI / 4);

  return {
    lat: escortTarget.position.lat + offsetLat,
    lng: escortTarget.position.lng + offsetLng,
  };
}

/**
 * Generate waypoints for a transit mission.
 * Straight-line to destination (last reference point).
 */
export function generateTransitWaypoints(mission: Mission): Position[] {
  return [...mission.referencePoints];
}
