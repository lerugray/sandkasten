import type { Scenario } from "@/types/game";

export type ParseScenarioResult =
  | { ok: true; scenario: Scenario }
  | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isPos = (v: unknown): boolean => isObj(v) && isNum(v.lat) && isNum(v.lng);
const onMap = (v: unknown): boolean => isObj(v) && isNum(v.lat) && isNum(v.lng) && Math.abs(v.lat) <= 90 && Math.abs(v.lng) <= 180;

/** The editor reads the whole file into memory and renders every unit: bound both. */
export const MAX_SCENARIO_CHARS = 5 * 1024 * 1024;
export const MAX_SCENARIO_UNITS = 5000;
const MAP_MAX_ZOOM = 24; // MapLibre GL JS accepts zoom 0..24

const refuse = (error: string): ParseScenarioResult => ({ ok: false, error });

/**
 * Parse the text of a scenario file chosen in the editor. Valid JSON that is not a scenario (a battle
 * save, an array, `null`) must be refused with a message, never handed to the editor state: the
 * editor reads `scenario.sides` on every render, so a wrong shape ends in the browser's error page.
 */
export function parseScenarioFile(text: string): ParseScenarioResult {
  if (text.length > MAX_SCENARIO_CHARS) {
    return refuse("That file is too big to be a scenario (over 5 MB of text).");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (!isObj(raw)) return { ok: false, error: "That file is not a scenario." };
  if (!Array.isArray(raw.sides)) {
    return {
      ok: false,
      error: "That file is not a scenario: it has no sides list. A saved battle (.sandsave.json) opens from LOAD BATTLE in the play screen, not here.",
    };
  }
  const theater = raw.theater;
  if (!isObj(theater) || !isPos(theater.center) || !isNum(theater.zoom)) {
    return { ok: false, error: "That file is not a scenario: the theater centre or zoom is missing." };
  }
  if (!onMap(theater.center)) return refuse("That scenario's theater centre is off the map (latitude must be -90 to 90, longitude -180 to 180).");
  const zoom = theater.zoom as number;
  if (zoom < 0 || zoom > MAP_MAX_ZOOM) return refuse("That scenario's theater zoom is out of range (it must be 0 to 24).");
  if (theater.bounds !== undefined) {
    const b = theater.bounds;
    const ok = Array.isArray(b) && b.length === 4 && b.every(isNum)
      && Math.abs(b[0] as number) <= 180 && Math.abs(b[2] as number) <= 180 && Math.abs(b[1] as number) <= 90 && Math.abs(b[3] as number) <= 90;
    if (!ok) return refuse("That scenario's theater bounds are off the map.");
  }
  let unitCount = 0;
  for (const side of raw.sides) {
    if (!isObj(side) || typeof side.name !== "string" || !Array.isArray(side.units)) {
      return refuse("That file is not a scenario: a side has no name or units list.");
    }
    if (side.color !== undefined && typeof side.color !== "string") {
      return refuse("That file is not a scenario: a side's colour is not text.");
    }
    unitCount += side.units.length;
    if (unitCount > MAX_SCENARIO_UNITS) return refuse("That scenario has too many units (over 5,000).");
    for (const unit of side.units) {
      if (!isObj(unit) || typeof unit.id !== "string" || !isPos(unit.position)) {
        return refuse("That file is not a scenario: a unit has no id or position.");
      }
      if (!onMap(unit.position)) return refuse("That scenario is refused: a unit's position is off the map (latitude must be -90 to 90, longitude -180 to 180).");
      if ((unit.name !== undefined && typeof unit.name !== "string") || (unit.side !== undefined && typeof unit.side !== "string")) {
        return refuse("That file is not a scenario: a unit's name or side is not text.");
      }
      // platformId is the platform database number everywhere the game writes a scenario
      if (unit.platformId !== undefined && !isNum(unit.platformId)) {
        return refuse("That file is not a scenario: a unit's platformId is not a number.");
      }
    }
  }
  if (Array.isArray(raw.referencePoints)) {
    for (const rp of raw.referencePoints) {
      if (isObj(rp) && Array.isArray(rp.points) && rp.points.some((pt) => isPos(pt) && !onMap(pt))) {
        return refuse("That scenario is refused: a reference point is off the map.");
      }
    }
  }
  const sides = raw.sides as Scenario["sides"];
  const playerSide = typeof raw.playerSide === "string" && sides.some((s) => s.name === raw.playerSide)
    ? raw.playerSide
    : (sides[0]?.name ?? "Side A");
  const scenario: Scenario = {
    ...(raw as unknown as Scenario),
    name: typeof raw.name === "string" ? raw.name : "Untitled Scenario",
    description: typeof raw.description === "string" ? raw.description : "",
    briefing: typeof raw.briefing === "string" ? raw.briefing : "",
    startTime: typeof raw.startTime === "string" && !Number.isNaN(Date.parse(raw.startTime)) ? raw.startTime : new Date().toISOString(),
    playerSide,
    sides,
    referencePoints: Array.isArray(raw.referencePoints) ? (raw.referencePoints as Scenario["referencePoints"]) : [],
  };
  return { ok: true, scenario };
}
