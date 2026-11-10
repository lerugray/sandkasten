import type { Scenario } from "@/types/game";

export type ParseScenarioResult =
  | { ok: true; scenario: Scenario }
  | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isPos = (v: unknown): boolean => isObj(v) && isNum(v.lat) && isNum(v.lng);

/**
 * Parse the text of a scenario file chosen in the editor. Valid JSON that is not a scenario (a battle
 * save, an array, `null`) must be refused with a message, never handed to the editor state: the
 * editor reads `scenario.sides` on every render, so a wrong shape ends in the browser's error page.
 */
export function parseScenarioFile(text: string): ParseScenarioResult {
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
  for (const side of raw.sides) {
    if (!isObj(side) || typeof side.name !== "string" || !Array.isArray(side.units)) {
      return { ok: false, error: "That file is not a scenario: a side has no name or units list." };
    }
    for (const unit of side.units) {
      if (!isObj(unit) || typeof unit.id !== "string" || !isPos(unit.position)) {
        return { ok: false, error: "That file is not a scenario: a unit has no id or position." };
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
