import type { Unit, Position } from "@/types/game";
import type { UnitOrders, Waypoint } from "./gameState";

const EARTH_RADIUS_KM = 6371;
const KM_PER_NM = 1.852;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function distanceKm(a: Position, b: Position): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLng = (b.lng - a.lng) * DEG_TO_RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(a.lat * DEG_TO_RAD) *
      Math.cos(b.lat * DEG_TO_RAD) *
      sinLng *
      sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function distanceNm(a: Position, b: Position): number {
  return distanceKm(a, b) / KM_PER_NM;
}

export function bearingDeg(from: Position, to: Position): number {
  const dLng = (to.lng - from.lng) * DEG_TO_RAD;
  const lat1 = from.lat * DEG_TO_RAD;
  const lat2 = to.lat * DEG_TO_RAD;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return ((Math.atan2(y, x) * RAD_TO_DEG) + 360) % 360;
}

export function moveAlongBearing(
  from: Position,
  bearingDeg: number,
  distanceKm: number
): Position {
  const lat1 = from.lat * DEG_TO_RAD;
  const lng1 = from.lng * DEG_TO_RAD;
  const brng = bearingDeg * DEG_TO_RAD;
  const d = distanceKm / EARTH_RADIUS_KM;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
      Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: lat2 * RAD_TO_DEG,
    lng: lng2 * RAD_TO_DEG,
  };
}

// Speed in knots for a given throttle setting
// Falls back to simple defaults if no platform speed profile
const DEFAULT_SPEEDS: Record<number, number> = {
  1: 5, // loiter
  2: 15, // cruise
  3: 25, // full
  4: 30, // flank
};

const DEFAULT_AIR_SPEEDS: Record<number, number> = {
  1: 200,
  2: 350,
  3: 450,
  4: 550,
};

export function getUnitSpeed(unit: Unit, orders: UnitOrders): number {
  // If unit has explicit speed set, use it
  if (unit.speed > 0 && orders.waypoints.length === 0) return unit.speed;

  // Check if current waypoint has a speed override
  if (orders.waypoints.length > 0 && orders.waypoints[0].speed) {
    return orders.waypoints[0].speed;
  }

  // Use throttle-based default
  const isAir = unit.altitude !== undefined && unit.altitude > 0;
  const defaults = isAir ? DEFAULT_AIR_SPEEDS : DEFAULT_SPEEDS;
  return defaults[orders.throttle] ?? defaults[2];
}

export function updateUnitMovement(
  unit: Unit,
  orders: UnitOrders,
  dtSeconds: number
): { unit: Unit; orders: UnitOrders } {
  if (orders.waypoints.length === 0) {
    // No waypoints — unit holds position at current speed/heading
    if (unit.speed > 0) {
      // Move along current heading
      const distKm = (unit.speed * KM_PER_NM * dtSeconds) / 3600;
      const newPos = moveAlongBearing(unit.position, unit.heading, distKm);
      return {
        unit: { ...unit, position: newPos },
        orders,
      };
    }
    return { unit, orders };
  }

  const speed = getUnitSpeed(unit, orders);
  const distKm = (speed * KM_PER_NM * dtSeconds) / 3600;

  const target = orders.waypoints[0].position;
  const distToWaypoint = distanceKm(unit.position, target);
  const bearing = bearingDeg(unit.position, target);

  // Arrival threshold: 0.5 km
  if (distToWaypoint <= 0.5 || distKm >= distToWaypoint) {
    // Reached waypoint — pop it and move to next
    const newWaypoints = orders.waypoints.slice(1);
    const newUnit = {
      ...unit,
      position: target,
      heading: newWaypoints.length > 0
        ? bearingDeg(target, newWaypoints[0].position)
        : bearing,
      speed,
    };

    // Apply altitude from waypoint if set
    if (orders.waypoints[0].altitude !== undefined) {
      newUnit.altitude = orders.waypoints[0].altitude;
    }

    return {
      unit: newUnit,
      orders: { ...orders, waypoints: newWaypoints },
    };
  }

  // Move toward waypoint
  const newPos = moveAlongBearing(unit.position, bearing, distKm);
  return {
    unit: {
      ...unit,
      position: newPos,
      heading: bearing,
      speed,
    },
    orders,
  };
}
