import { describe, it, expect, afterEach, afterAll } from "vitest";
import { writeFileSync } from "node:fs";
import { SimulationSession } from "@/lib/simulation/session";
import { DEFAULT_AUTOPAUSE } from "@/lib/simulation/autopause";
import { distanceKm, bearingDeg } from "@/lib/simulation/movement";
import { demoScenario } from "@/lib/scenarios/demo";
import { demoScenarioConfig } from "@/lib/scenarios/demoConfig";

// SAND-THREAT-1: the Hormuz defeat is reachable in real play. Every run below is the shipped scenario in the production
// session at the UI's top speed (continuous, 60x). Nothing is injected: the only thing a test controls is the dice seed.

const SEEDS = [1, 2, 3, 4, 5];
const START = new Date(demoScenarioConfig.scenario.startTime).getTime();
const GATE_CENTRE = { lng: 56.45, lat: 26.65 };
const NIMITZ = "us-cvn-1";

function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const realRandom = Math.random;
afterEach(() => {
  Math.random = realRandom;
});

type Plan = (s: SimulationSession) => void;

/** Give the orders, press play at 60x and let the clock run until the scenario's own rules end it (or `maxHours` pass). */
function play(plan: Plan, seed: number, maxHours = 12) {
  // Replaced directly, not spied on: a spy would record millions of calls over a run this long.
  Math.random = seeded(seed * 7919);
  const s = new SimulationSession(demoScenarioConfig);
  s.autopausePrefs = { ...DEFAULT_AUTOPAUSE, enabled: false };
  plan(s);
  s.setSpeed(60);
  s.togglePause();
  // The first engageable (not merely "unknown") contact Iran holds on a US ship: who the threat met first.
  let firstShipContact: string | undefined;
  const ships = new Set(demoScenario.sides[0].units.filter((u) => u.altitude === undefined).map((u) => u.id));
  while (!s.ended && s.snapshot().gameState.simTime - START < maxHours * 3.6e6) {
    s.tick(50);
    if (!firstShipContact) {
      firstShipContact = (s.snapshot().gameState.sideContacts["Iran"] ?? []).find(
        (c) => c.classification !== "unknown" && ships.has(c.actualUnitId),
      )?.actualUnitId;
    }
  }
  Math.random = realRandom;
  const snap = s.snapshot();
  const units = snap.gameState.sides.flatMap((x) => x.units);
  const sideOf = new Map(units.map((u) => [u.id, u.side]));
  const log = snap.combatState.combatLog;
  const hitsOnCarrier = log.filter((e) => e.type === "hit" && e.targetId === NIMITZ);
  return {
    result: snap.eventState?.scenarioResult?.result,
    decidedBy: snap.eventState?.scenarioResult?.source?.event,
    hours: (snap.gameState.simTime - START) / 3.6e6,
    carrier: units.find((u) => u.id === NIMITZ)!,
    firstShipContact,
    /** Hits on the carrier by weapons Iranian units launched in this run. */
    iranianHits: hitsOnCarrier.filter((e) => sideOf.get(e.unitId ?? "") === "Iran").length,
    missileHits: hitsOnCarrier.filter((e) => e.description.startsWith("C-802")).length,
    escortsLost: units.filter((u) => u.side === "US Navy" && u.id !== NIMITZ && u.altitude === undefined && u.damageState === "destroyed").length,
  };
}

const count = <T,>(list: T[], pred: (x: T) => boolean) => list.filter(pred).length;

// SAND_THREAT_TABLE=<file> writes the per-seed table of every proof run (the tables in the lane report come from it).
const table: string[] = ["| proof | seed | result | decided by | T+ hours | Nimitz damage | hits on Nimitz (C-802) | escorts lost |", "|---|---|---|---|---|---|---|---|"];
function record(proof: string, runs: ReturnType<typeof play>[]) {
  runs.forEach((r, i) =>
    table.push(
      `| ${proof} | ${SEEDS[i]} | ${r.result ?? "undecided"} | ${r.decidedBy ?? "-"} | ${r.hours.toFixed(2)} | ${Math.round(r.carrier.damage ?? 0)} / 3600 ${r.carrier.damageState} | ${r.iranianHits} (${r.missileHits}) | ${r.escortsLost} |`,
    ),
  );
  return runs;
}
afterAll(() => {
  if (process.env.SAND_THREAT_TABLE) writeFileSync(process.env.SAND_THREAT_TABLE, table.join("\n") + "\n");
});

// --- the plans -------------------------------------------------------------------------------------------------------

/** Proof 1: no orders at all. */
const doNothing: Plan = () => {};

/** Proof 2: the careless transit. Nimitz alone, one FLANK waypoint straight at the gate, ROE HOLD, escorts left behind. */
const carelessFlankAlone: Plan = (s) => {
  s.addWaypoint(NIMITZ, GATE_CENTRE);
  s.setThrottle(NIMITZ, 4);
  s.setRoe(NIMITZ, "weapons-hold");
};

/** Proof 3a: the four escorts go ahead of the carrier with ROE FREE; the carrier follows the direct course at cruise. */
const escortScreenForwardRoeFree: Plan = (s) => {
  for (const id of ["us-cg-1", "us-ddg-1", "us-ddg-2", "us-ffg-1"]) {
    s.setRoe(id, "weapons-free");
    s.addWaypoint(id, { lng: 56.5, lat: 26.6 });
    s.setThrottle(id, 3);
  }
  s.addWaypoint(NIMITZ, GATE_CENTRE);
  s.setThrottle(NIMITZ, 2);
};

/**
 * Proof 3b: a southern dog-leg down the Omani side, clear of the picket line, with the air wing in support: both Hornets
 * held over the route with ROE FREE and the Hawkeye kept on station. Chosin and Mahan stay in company, weapons tight.
 */
const southernDoglegWithAirSupport: Plan = (s) => {
  for (const id of ["us-fa18-1", "us-fa18-2"]) {
    s.setRoe(id, "weapons-free");
    s.addWaypoint(id, { lng: 56.8, lat: 25.5 });
  }
  s.addWaypoint("us-e2c-1", { lng: 56.7, lat: 25.4 });
  for (const id of [NIMITZ, "us-cg-1", "us-ddg-1"]) {
    s.addWaypoint(id, { lng: 56.85, lat: 25.6 });
    s.addWaypoint(id, { lng: 56.62, lat: 26.3 });
    s.addWaypoint(id, GATE_CENTRE);
    s.setThrottle(id, 3);
  }
};

// --- proofs ----------------------------------------------------------------------------------------------------------

describe("SAND-THREAT-1: a passive or careless player loses the Hormuz transit", () => {
  it("do-nothing loses: no orders, clock run to the end at 60x, DEFEAT in at least 4 of 5 seeds", () => {
    const runs = record("1 do-nothing", SEEDS.map((seed) => play(doNothing, seed)));
    expect(count(runs, (r) => r.result === "defeat")).toBeGreaterThanOrEqual(4);
    for (const r of runs.filter((x) => x.result === "defeat")) {
      // the scenario's own loss rule, reached by damage Iranian weapons did through the combat phase
      expect(r.decidedBy).toBe("Carrier Lost");
      expect(r.carrier.damageState).toBe("destroyed");
      expect(r.iranianHits).toBeGreaterThan(50);
      expect(r.missileHits).toBeGreaterThan(0);
      expect(r.hours).toBeLessThan(4);
    }
    // the pickets meet the carrier before any escort: that is what makes a weapons-tight group lose
    expect(count(runs, (r) => r.firstShipContact === NIMITZ)).toBeGreaterThanOrEqual(4);
  }, 120_000);

  it("careless loses: Nimitz alone, one FLANK waypoint straight to the gate, ROE HOLD, DEFEAT in at least 3 of 5 seeds", () => {
    const runs = record("2 careless", SEEDS.map((seed) => play(carelessFlankAlone, seed)));
    expect(count(runs, (r) => r.result === "defeat")).toBeGreaterThanOrEqual(3);
    for (const r of runs.filter((x) => x.result === "defeat")) {
      expect(r.decidedBy).toBe("Carrier Lost");
      expect(r.carrier.damageState).toBe("destroyed");
      expect(r.iranianHits).toBeGreaterThan(50);
      // lost before the gate: at FLANK the carrier would have entered it at about T+3.1 h
      expect(r.hours).toBeLessThan(3.1);
    }
  }, 120_000);
});

describe("SAND-THREAT-1: two different sensible plans still win", () => {
  it("plan A, escort screen forward with ROE FREE ahead of the carrier, wins in at least 3 of 5 seeds", () => {
    const runs = record("3a escort screen forward, ROE FREE", SEEDS.map((seed) => play(escortScreenForwardRoeFree, seed)));
    expect(count(runs, (r) => r.result === "victory")).toBeGreaterThanOrEqual(3);
    for (const r of runs.filter((x) => x.result === "victory")) expect(r.decidedBy).toBe("Transit Complete");
  }, 120_000);

  it("plan B, southern dog-leg clear of the pickets with CAP and Hawkeye support, wins in at least 3 of 5 seeds", () => {
    const runs = record("3b southern dog-leg, air support", SEEDS.map((seed) => play(southernDoglegWithAirSupport, seed)));
    expect(count(runs, (r) => r.result === "victory")).toBeGreaterThanOrEqual(3);
    for (const r of runs.filter((x) => x.result === "victory")) expect(r.decidedBy).toBe("Transit Complete");
  }, 120_000);

  it("the two winning plans are different solutions: different routes, different timetables, different shooters", () => {
    const a = play(escortScreenForwardRoeFree, 1);
    const b = play(southernDoglegWithAirSupport, 1);
    expect(a.result).toBe("victory");
    expect(b.result).toBe("victory");
    expect(Math.abs(a.hours - b.hours)).toBeGreaterThan(1);
  }, 120_000);
});

describe("SAND-THREAT-1: the picket line is scenario data, laid against the strike group's base course", () => {
  const units = demoScenario.sides.flatMap((s) => s.units);
  const nimitz = units.find((u) => u.id === NIMITZ)!;
  const pickets = units.filter((u) => u.id.startsWith("ir-pc-"));
  const mission = demoScenarioConfig.missions!.find((m) => m.id === "iran-missile-boat-patrol")!;

  /** Signed distance (km) of a point from the line through `origin` on `course`: positive to starboard (north-east here). */
  const offCourseKm = (origin: { lng: number; lat: number }, course: number, p: { lng: number; lat: number }) => {
    const d = distanceKm(origin, p);
    const rel = ((bearingDeg(origin, p) - course) * Math.PI) / 180;
    return d * Math.sin(rel);
  };

  it("six Kaman boats, all on the picket mission, all existing platform 1088 with its existing loadout", () => {
    expect(pickets).toHaveLength(6);
    expect(mission.assignedUnitIds.slice().sort()).toEqual(pickets.map((u) => u.id).sort());
    for (const u of pickets) expect(u.platformId).toBe(1088);
    expect(mission.type).toBe("patrol");
  });

  it("every boat and both ends of the line lie 15.5 to 20.3 km north-east of the Nimitz base course (the measured window)", () => {
    for (const p of [...pickets.map((u) => u.position), ...mission.referencePoints]) {
      const off = offCourseKm(nimitz.position, nimitz.heading, p);
      expect(off).toBeGreaterThan(15.5);
      expect(off).toBeLessThan(20.3);
    }
  });

  it("the escorts ahead of the carrier pass outside a picket's surface radar horizon, the carrier inside it", () => {
    // engine radar horizon for two ships (detection.ts): 1.23 * (sqrt(20 ft) + sqrt(20 ft)) nautical miles
    const horizonKm = 1.23 * 2 * Math.sqrt(20) * 1.852;
    const lineOff = offCourseKm(nimitz.position, nimitz.heading, mission.referencePoints[0]);
    expect(lineOff).toBeLessThan(horizonKm);
    for (const id of ["us-cg-1", "us-ddg-2"]) {
      const escort = units.find((u) => u.id === id)!;
      expect(escort.heading).toBe(nimitz.heading);
      // the escort's own track is parallel to the carrier's; its distance from the picket line is the difference of offsets
      const escortOff = offCourseKm(nimitz.position, nimitz.heading, escort.position);
      expect(lineOff - escortOff).toBeGreaterThan(horizonKm);
    }
  });

  it("the pickets close only on a contact inside 25 km", () => {
    expect(mission.prosecutionRange).toBe(25);
  });
});
