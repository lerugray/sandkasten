import ms from "milsymbol";

const symbolCache = new Map<string, string>();

export type Affiliation = "friendly" | "hostile" | "neutral" | "unknown";
export type BattleDimension = "air" | "ground" | "sea" | "subsurface";

const AFFILIATION_CHAR: Record<Affiliation, string> = {
  friendly: "F",
  hostile: "H",
  neutral: "N",
  unknown: "U",
};

const DIMENSION_CHAR: Record<BattleDimension, string> = {
  air: "A",
  ground: "G",
  sea: "S",
  subsurface: "U",
};

// Common function IDs for unit types we'll use
export const FUNCTION_IDS = {
  // Air
  fixedWing: "MF",
  helicopter: "MH",
  uav: "MF",
  // Sea
  surfaceCombatant: "CL",
  carrier: "CV",
  merchant: "XM",
  submarine: "S",
  // Ground
  airDefense: "UCD",
  infantry: "UCI",
  armor: "UCA",
  artillery: "UCF",
  // Weapons
  missile: "MF",
};

export interface SymbolOptions {
  affiliation: Affiliation;
  dimension: BattleDimension;
  functionId?: string;
  size?: number;
  heading?: number;
  quantity?: string;
  staffComments?: string;
}

export function createSymbolSVG(options: SymbolOptions): string {
  const {
    affiliation,
    dimension,
    functionId = "",
    size = 30,
    heading,
    quantity,
    staffComments,
  } = options;

  const sidc =
    "S" +
    AFFILIATION_CHAR[affiliation] +
    DIMENSION_CHAR[dimension] +
    "P" +
    (functionId + "------").slice(0, 10);

  const cacheKey = `${sidc}-${size}-${heading ?? ""}`;

  if (symbolCache.has(cacheKey)) {
    return symbolCache.get(cacheKey)!;
  }

  const symbol = new ms.Symbol(sidc, {
    size,
    ...(heading !== undefined && { direction: heading }),
    ...(quantity && { quantity }),
    ...(staffComments && { staffComments }),
  });

  const svg = symbol.asSVG();
  symbolCache.set(cacheKey, svg);
  return svg;
}

export function getSymbolAnchor(options: SymbolOptions): {
  x: number;
  y: number;
} {
  const { affiliation, dimension, functionId = "", size = 30 } = options;
  const sidc =
    "S" +
    AFFILIATION_CHAR[affiliation] +
    DIMENSION_CHAR[dimension] +
    "P" +
    (functionId + "------").slice(0, 10);

  const symbol = new ms.Symbol(sidc, { size });
  const anchor = symbol.getAnchor();
  return { x: anchor.x, y: anchor.y };
}
