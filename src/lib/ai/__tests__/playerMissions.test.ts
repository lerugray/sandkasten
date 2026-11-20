import { describe, it, expect } from "vitest";
import {
  assignPlayerMissionUnit,
  createPlayerMission,
  launchPlayerMissionAircraft,
  runPlayerMissions,
  unassignPlayerMissionUnit,
  BINGO_FUEL_MS,
} from "../playerMissions";
import type { AIState } from "../aiController";
import { unit, makeState } from "@/lib/simulation/__tests__/fixtures";
import { createCombatState } from "@/lib/simulation/combat";

const MAHAN = 10003;
const NIMITZ = 10001;
const HORNET = 10006;

const ai: AIState = { missions: [], sideDoctrine: {} };

describe("SAND-MISSIONS-1 player missions", () => {
  it("creates a patrol mission and rejects a mission without reference points", () => {
    const state = makeState([unit("us-1", "US Navy", MAHAN, 57, 25)]);
    const bad = createPlayerMission(state, { type: "patrol", referencePoints: [] }, "US Navy");
    expect(bad.ok).toBe(false);

    const good = createPlayerMission(
      state,
      { type: "patrol", referencePoints: [{ lng: 57, lat: 25 }, { lng: 58, lat: 26 }] },
      "US Navy"
    );
    expect(good.ok).toBe(true);
    expect(good.state.playerMissions).toHaveLength(1);
    expect(good.state.playerMissions[0].type).toBe("patrol");
    expect(good.state.playerMissions[0].side).toBe("US Navy");
  });

  it("assigns and unassigns one of the player's own units", () => {
    const state = makeState([unit("us-1", "US Navy", MAHAN, 57, 25)]);
    const made = createPlayerMission(state, { type: "patrol", referencePoints: [{ lng: 57, lat: 25 }] }, "US Navy");

    const assigned = assignPlayerMissionUnit(made.state, "us-1", made.missionId!);
    expect(assigned.ok).toBe(true);
    expect(assigned.state.playerMissions[0].assignedUnitIds).toContain("us-1");

    const again = assignPlayerMissionUnit(assigned.state, "us-1", made.missionId!);
    expect(again.ok).toBe(false);

    const unassigned = unassignPlayerMissionUnit(assigned.state, "us-1", made.missionId!);
    expect(unassigned.ok).toBe(true);
    expect(unassigned.state.playerMissions[0].assignedUnitIds).not.toContain("us-1");
  });

  it("launches an aircraft straight onto a mission from its host's air wing", () => {
    const host = unit("cv", "US Navy", NIMITZ, 57.5, 25.2, {
      airWing: [{ platformId: HORNET, count: 4, readyAtMs: 0, turnaroundMs: 120_000 }],
    });
    const state = makeState([host]);
    const made = createPlayerMission(state, { type: "strike", referencePoints: [{ lng: 58, lat: 26 }] }, "US Navy");

    const launched = launchPlayerMissionAircraft(made.state, createCombatState(), made.missionId!, "cv");
    expect(launched.ok).toBe(true);
    const aircraft = launched.state.sides.flatMap((s) => s.units).find((u) => u.hostUnitId === "cv");
    expect(aircraft).toBeTruthy();
    expect(launched.state.playerMissions[0].assignedUnitIds).toContain(aircraft!.id);
  });

  it("drives a patrol-assigned ship to its reference points", () => {
    const boat = unit("us-1", "US Navy", MAHAN, 57, 25);
    let state = makeState([boat]);
    const made = createPlayerMission(
      state,
      { type: "patrol", referencePoints: [{ lng: 58, lat: 26 }, { lng: 57, lat: 25 }] },
      "US Navy"
    );
    state = assignPlayerMissionUnit(made.state, "us-1", made.missionId!).state;

    const result = runPlayerMissions(state, ai);
    expect(result.orders.get("us-1")!.waypoints.length).toBeGreaterThan(0);
  });

  it("orders a low-fuel mission aircraft to return to its host", () => {
    const host = unit("cv", "US Navy", NIMITZ, 57.5, 25.2);
    const aircraft = unit("air-1", "US Navy", HORNET, 57.5, 25.4, {
      altitude: 25_000,
      airStatus: "airborne",
      hostUnitId: "cv",
      fuelRemainingMs: BINGO_FUEL_MS - 1,
    });
    let state = makeState([host, aircraft]);
    const made = createPlayerMission(state, { type: "cap", referencePoints: [{ lng: 58, lat: 26 }] }, "US Navy");
    state = assignPlayerMissionUnit(made.state, "air-1", made.missionId!).state;

    const result = runPlayerMissions(state, ai);
    const after = result.state.sides.flatMap((s) => s.units).find((u) => u.id === "air-1");
    expect(after!.recovering).toBe(true);
  });
});
