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

/** Arrival tolerance (km): 1 m, only there to absorb floating point error. */
const ARRIVAL_EPSILON_KM = 0.001;

/**
 * Commanded speed in knots. Precedence: waypoint speed, then the held authored
 * speed (cleared by any throttle or route order), then the throttle table.
 * Throttle 0 is an explicit stop.
 */
export function getUnitSpeed(unit: Unit, orders: UnitOrders): number {
  const leg = orders.waypoints[0];
  if (leg?.speed) return leg.speed;
  if (orders.speedKts !== undefined) return orders.speedKts;
  if (orders.throttle <= 0) return 0;

  const isAir = unit.altitude !== undefined && unit.altitude > 0;
  const defaults = isAir ? DEFAULT_AIR_SPEEDS : DEFAULT_SPEEDS;
  return defaults[orders.throttle] ?? defaults[2];
}

export function updateUnitMovement(
  unit: Unit,
  orders: UnitOrders,
  dtSeconds: number
): { unit: Unit; orders: UnitOrders } {
  let position = unit.position;
  let heading = unit.heading;
  let altitude = unit.altitude;
  let waypoints = orders.waypoints;
  let heldSpeed = orders.speedKts;
  let speed = getUnitSpeed(unit, orders);
  let budgetKm = (speed * KM_PER_NM * dtSeconds) / 3600;

  while (waypoints.length > 0) {
    const leg = waypoints[0];
    // A leg with its own speed changes how far the remaining time goes
    const legSpeed = leg.speed ?? speed;
    if (legSpeed !== speed && speed > 0) {
      budgetKm *= legSpeed / speed;
      speed = legSpeed;
    }
    const dist = distanceKm(position, leg.position);
    if (dist <= ARRIVAL_EPSILON_KM || dist <= budgetKm) {
      budgetKm = Math.max(0, budgetKm - dist);
      position = leg.position;
      if (leg.altitude !== undefined) altitude = leg.altitude;
      waypoints = waypoints.slice(1);
      if (waypoints.length > 0) heading = bearingDeg(position, waypoints[0].position);
      continue;
    }
    heading = bearingDeg(position, leg.position);
    position = moveAlongBearing(position, heading, budgetKm);
    budgetKm = 0;
    break;
  }

  if (waypoints.length === 0 && orders.waypoints.length > 0) {
    // Route finished: hold position there until given a new order
    heldSpeed = 0;
    speed = 0;
  } else if (waypoints.length === 0 && budgetKm > 0) {
    position = moveAlongBearing(position, heading, budgetKm);
  }

  const moved = position !== unit.position || speed !== unit.speed || heading !== unit.heading || altitude !== unit.altitude;
  const routeChanged = waypoints !== orders.waypoints || heldSpeed !== orders.speedKts;
  return {
    unit: moved ? { ...unit, position, heading, speed, ...(altitude !== undefined ? { altitude } : {}) } : unit,
    orders: routeChanged ? { ...orders, waypoints, speedKts: heldSpeed } : orders,
  };
}
