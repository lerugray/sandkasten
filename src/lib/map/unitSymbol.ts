import { createSymbolSVG, getSymbolAnchor } from "@/lib/symbols/milsymbolFactory";
import type { BattleDimension } from "@/lib/symbols/milsymbolFactory";
import { getPlatform } from "@/lib/platforms/lookup";
import { getAffiliation } from "@/types/game";
import type { Unit } from "@/types/game";

export interface UnitSymbolSpec {
  svg: string;
  /** symbol centre inside the svg (the svg also holds the heading leader, so it is taller than the frame) */
  anchor: { x: number; y: number; width: number; height: number };
  /** the symbol frame alone, no heading leader */
  frame: { w: number; h: number };
}

const frames = new Map<string, { w: number; h: number }>();

function symbolOpts(unit: Unit, playerSide: string) {
  const platform = getPlatform(unit.platformId);
  const affiliation = getAffiliation(unit, playerSide);
  const dimension: BattleDimension = platform?.dimension ?? "sea";
  const functionId = platform?.functionId ?? "CL";
  return { affiliation, dimension, functionId, size: 25, heading: unit.heading };
}

/** Size of the symbol frame alone (no heading leader); cached per affiliation / dimension / function. */
export function unitFrame(unit: Unit, playerSide: string): { w: number; h: number } {
  const opts = symbolOpts(unit, playerSide);
  const key = `${opts.affiliation}-${opts.dimension}-${opts.functionId}`;
  let frame = frames.get(key);
  if (!frame) {
    const a = getSymbolAnchor({ ...opts, heading: undefined });
    frame = { w: a.width, h: a.height };
    frames.set(key, frame);
  }
  return frame;
}

export function unitSymbolSpec(unit: Unit, playerSide: string): UnitSymbolSpec {
  const opts = symbolOpts(unit, playerSide);
  return { svg: createSymbolSVG(opts), anchor: getSymbolAnchor(opts), frame: unitFrame(unit, playerSide) };
}
