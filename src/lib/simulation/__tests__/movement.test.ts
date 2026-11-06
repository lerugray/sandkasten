import { describe, it, expect } from "vitest";
import { updateUnitMovement, distanceKm } from "../movement";
import { unit } from "./fixtures";
import type { UnitOrders } from "../gameState";

const orders = (o: Partial<UnitOrders> = {}): UnitOrders => ({
  unitId: "s",
  waypoints: [],
  throttle: 2,
  radarActive: true,
  ...o,
});

describe("S2-2 throttle applies without waypoints", () => {
  it("a 15-knot ship with its route cleared goes 30 knots at flank", () => {
    const ship = unit("s", "US Navy", 111, 56, 26, { speed: 15, heading: 90 });
    let u = ship;
    for (let i = 0; i < 60; i++) u = updateUnitMovement(u, orders({ throttle: 4 }), 1).unit;
    expect(u.speed).toBe(30);
    expect(distanceKm(ship.position, u.position)).toBeCloseTo((30 * 1.852 * 60) / 3600, 2);
  });

  it("an explicit stop (throttle 0) holds position", () => {
    const ship = unit("s", "US Navy", 111, 56, 26, { speed: 15, heading: 90 });
    const r = updateUnitMovement(ship, orders({ throttle: 0 }), 60);
    expect(r.unit.position).toEqual(ship.position);
    expect(r.unit.speed).toBe(0);
  });

  it("a held authored speed keeps a unit moving until a throttle order", () => {
    const ship = unit("s", "US Navy", 111, 56, 26, { speed: 20, heading: 90 });
    const r = updateUnitMovement(ship, orders({ throttle: 2, speedKts: 20 }), 60);
    expect(r.unit.speed).toBe(20);
  });
});

describe("S2-3 waypoint arrival", () => {
  it("does not teleport a ship 400 m to a waypoint in one 50 ms tick", () => {
    const ship = unit("s", "US Navy", 111, 56, 26, { speed: 30, heading: 0 });
    const wp = { position: { lng: 56, lat: 26 + 0.4 / 111.19 } }; // 400 m north
    const r = updateUnitMovement(ship, orders({ throttle: 4, waypoints: [wp] }), 0.05);
    expect(distanceKm(ship.position, r.unit.position) * 1000).toBeLessThan(2);
    expect(r.orders.waypoints).toHaveLength(1);
  });

  it("carries the travel budget across several close legs in one step", () => {
    const ship = unit("s", "US Navy", 111, 56, 26, { speed: 30, heading: 0 });
    // 30 kt flank covers ~463 m in 30 s; three legs of 100 m each
    const step = 0.1 / 111.19;
    const wps = [1, 2, 3].map((n) => ({ position: { lng: 56, lat: 26 + n * step } }));
    const r = updateUnitMovement(ship, orders({ throttle: 4, waypoints: wps }), 30);
    expect(r.orders.waypoints).toHaveLength(0);
    const travelled = distanceKm(ship.position, r.unit.position) * 1000;
    expect(travelled).toBeGreaterThan(290);
    expect(travelled).toBeLessThan(310);
  });

  it("still reaches a waypoint exactly when the budget allows", () => {
    const ship = unit("s", "US Navy", 111, 56, 26, { speed: 30, heading: 0 });
    const wp = { position: { lng: 56, lat: 26 + 0.1 / 111.19 } };
    const r = updateUnitMovement(ship, orders({ throttle: 4, waypoints: [wp] }), 30);
    expect(r.orders.waypoints).toHaveLength(0);
    expect(r.unit.position.lat).toBeGreaterThanOrEqual(wp.position.lat - 1e-9);
  });
});
