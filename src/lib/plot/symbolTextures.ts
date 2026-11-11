// Unit and contact glyphs for the plot, drawn here in code (no copied art). milsymbol no longer draws anything
// on the plot; it is asked only for the box each symbol used to occupy, so every data block and label is placed
// exactly where it was before the redraw.
//
// The frame keeps the MIL-STD-2525 meaning the plot has always used, so nothing has to be relearned:
//   friendly = round (circle at sea, arch in the air, cup under water, box on land)
//   hostile  = pointed (diamond; tent in the air, vee under water)
//   unknown  = quatrefoil, neutral = square
// Inside the frame sits a silhouette of the platform (carrier, combatant, merchant, submarine, fixed-wing,
// helicopter, ground unit, installation). How sure the sensors are is drawn into the frame itself:
//   own / tracked : heavy solid frame over a tinted plate (tracked adds four lock ticks)
//   classified    : thin solid frame, no tint
//   detected      : solid quatrefoil with a question mark
//   unknown       : dotted quatrefoil with a bare centre dot
//   stale         : the frame breaks into dashes (the plot also fades it)
// Every glyph sits on a dark plate a little larger than its frame, so no grid line, coast or ring can run
// through it and a unit is never lost against the map.
import ms from "milsymbol";
import * as THREE from "three";
import type { Affiliation, BattleDimension } from "@/lib/symbols/milsymbolFactory";
import { PALETTE } from "./palette";

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

export interface SymbolTexture {
  texture: THREE.CanvasTexture;
  // CSS pixel size of the glyph's layout box and its anchor inside that box as a sprite centre (0..1). The box is
  // what labels keep clear of; the drawing itself is GLYPH_PX square, centred on the anchor.
  width: number;
  height: number;
  center: THREE.Vector2;
}

/** How firmly the sensors hold what the glyph stands for. Own units are always "own". */
export type GlyphCertainty = "own" | "tracked" | "classified" | "detected" | "unknown";
export interface GlyphState {
  certainty: GlyphCertainty;
  /** No fresh report for a while: the frame is drawn broken. */
  stale?: boolean;
  /** Own unit hurt: 1 = damaged (one alarm slash across the frame), 2 = mission kill (crossed out). */
  damage?: 0 | 1 | 2;
}

/** CSS px of the glyph box (square), frame and plate included. */
export const GLYPH_PX = 42;
/** The glyph is designed on a 36 unit square and scaled to GLYPH_PX. */
const DESIGN = 36;

const cache = new Map<string, SymbolTexture>();
const boxes = new Map<string, { width: number; height: number; cx: number; cy: number }>();

/** The layout box of a symbol: the same numbers the plot's label placement has always worked from. */
function layoutBox(sidc: string) {
  let b = boxes.get(sidc);
  if (!b) {
    const symbol = new ms.Symbol(sidc, { size: 22, strokeWidth: 3, outlineWidth: 0, infoFields: false });
    const size = symbol.getSize();
    const anchor = symbol.getAnchor();
    b = { width: size.width, height: size.height, cx: anchor.x / size.width, cy: 1 - anchor.y / size.height };
    boxes.set(sidc, b);
  }
  return b;
}

/** `"unknown"` is the 2525 unknown battle dimension (Z): a sensor has a track but not its domain. */
export function sidcFor(affiliation: Affiliation, dimension: BattleDimension | "unknown", functionId: string): string {
  const dim = dimension === "unknown" ? "Z" : DIMENSION_CHAR[dimension];
  return "S" + AFFILIATION_CHAR[affiliation] + dim + "P" + (functionId + "------").slice(0, 10);
}

type G = CanvasRenderingContext2D;
type Aff = "F" | "H" | "N" | "U";
type Dim = "A" | "G" | "S" | "U" | "Z";

/** The frame outline around (0,0). Air frames are open below, subsurface frames open above. */
function framePath(g: G, aff: Aff, dim: Dim, close: boolean) {
  g.beginPath();
  const air = dim === "A", sub = dim === "U";
  const flip = sub ? -1 : 1; // subsurface frames are the air frames upside down
  if (aff === "F") {
    if (air || sub) {
      g.moveTo(-12, 11 * flip);
      g.lineTo(-12, -1 * flip);
      if (air) g.arc(0, -1, 12, Math.PI, 0, false);
      else g.arc(0, 1, 12, Math.PI, 0, true);
      g.lineTo(12, 11 * flip);
    } else if (dim === "G") {
      g.rect(-15, -10, 30, 20);
      return;
    } else {
      g.arc(0, 0, 13, 0, Math.PI * 2);
      return;
    }
  } else if (aff === "H") {
    if (air || sub) {
      g.moveTo(-12, 12 * flip);
      g.lineTo(-12, -3 * flip);
      g.lineTo(0, -15 * flip);
      g.lineTo(12, -3 * flip);
      g.lineTo(12, 12 * flip);
    } else {
      g.moveTo(0, -15); g.lineTo(15, 0); g.lineTo(0, 15); g.lineTo(-15, 0);
      g.closePath();
      return;
    }
  } else if (aff === "N") {
    if (air || sub) {
      g.moveTo(-12, 12 * flip); g.lineTo(-12, -12 * flip); g.lineTo(12, -12 * flip); g.lineTo(12, 12 * flip);
    } else {
      g.rect(-12, -12, 24, 24);
      return;
    }
  } else {
    // quatrefoil: four half circles on a square of side 2r
    const r = 7.2;
    if (air) {
      g.moveTo(-r, r);
      g.arc(-r, 0, r, Math.PI / 2, -Math.PI / 2, false);
      g.arc(0, -r, r, Math.PI, 0, false);
      g.arc(r, 0, r, -Math.PI / 2, Math.PI / 2, false);
    } else if (sub) {
      g.moveTo(-r, -r);
      g.arc(-r, 0, r, -Math.PI / 2, Math.PI / 2, true);
      g.arc(0, r, r, Math.PI, 0, true);
      g.arc(r, 0, r, Math.PI / 2, -Math.PI / 2, true);
    } else {
      g.moveTo(-r, r);
      g.arc(-r, 0, r, Math.PI / 2, -Math.PI / 2, false);
      g.arc(0, -r, r, Math.PI, 0, false);
      g.arc(r, 0, r, -Math.PI / 2, Math.PI / 2, false);
      g.arc(0, r, r, 0, Math.PI, false);
      g.closePath();
      return;
    }
  }
  if (close) g.closePath();
}

/** Where the four lock ticks of a firm track start, as unit directions scaled to the frame edge. */
function lockTicks(aff: Aff, dim: Dim): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const diag = aff === "F" || aff === "N" || dim === "A" || dim === "U";
  if (aff === "H" && !(dim === "A" || dim === "U")) {
    for (const [x, y] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) out.push([x * 15.5, y * 15.5, x * 17.6, y * 17.6]);
  } else if (diag) {
    const k = Math.SQRT1_2;
    for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push([x * k * 15.5, y * k * 15.5, x * k * 18, y * k * 18]);
  }
  return out;
}

function poly(g: G, pts: number[]) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fill();
}

/** The platform silhouette inside the frame. Ships are seen from the side, aircraft from above. */
function icon(g: G, dim: Dim, fn: string, aff: Aff) {
  const f = fn.replace(/-/g, "");
  // air and subsurface frames are open on one side; the icon sits toward the closed side
  const dy = dim === "A" ? 1 : dim === "U" ? -1 : 0;
  g.save();
  g.translate(0, dy);
  if (dim === "S") {
    if (f.startsWith("CV")) {
      // carrier: long flat deck, island aft of midships
      poly(g, [-10, 1.6, 10, 1.6, 8.4, 5.4, -8.6, 5.4]);
      g.fillRect(-10.8, 0.2, 21.6, 1.5);
      g.fillRect(2.4, -4.2, 3.8, 4.5);
      g.fillRect(3.7, -7, 1.1, 3);
    } else if (f.startsWith("X")) {
      // merchant: deep hull, bridge aft, cargo forward
      poly(g, [-9.6, 1.4, 9.8, 1.4, 8.4, 5.4, -8.6, 5.4]);
      g.fillRect(-8.6, -3.8, 4, 5.3);
      g.fillRect(-3.2, -0.9, 3.1, 2.4);
      g.fillRect(0.9, -0.9, 3.1, 2.4);
      g.fillRect(5, -0.9, 3.1, 2.4);
    } else {
      // surface combatant: raked bow, gun, bridge, mast
      poly(g, [-9.4, 1.8, 10.2, 1.8, 7.4, 5.4, -8.4, 5.4]);
      g.fillRect(-4.4, -1.4, 7.2, 3.3);
      g.fillRect(-1.6, -3.6, 3.2, 2.4);
      g.fillRect(-0.55, -7.4, 1.1, 4);
      g.fillRect(-2.2, -5.9, 4.4, 1);
      g.fillRect(4.6, 0.3, 3.2, 1.5);
    }
  } else if (dim === "U") {
    // submarine: cigar hull and sail
    g.beginPath();
    g.ellipse(0, 2.2, 9.6, 2.9, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(-1.2, -3.4, 4.2, 4.4);
    g.fillRect(0.6, -5.6, 0.9, 2.4);
  } else if (dim === "A") {
    if (f.startsWith("MH") || f.startsWith("CH")) {
      // helicopter: rotor disc, cabin, tail boom
      g.lineWidth = 1.5;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(-7, -6.5); g.lineTo(7, 4.5);
      g.moveTo(7, -6.5); g.lineTo(-7, 4.5);
      g.stroke();
      g.beginPath();
      g.ellipse(0, -1, 2.5, 3.8, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(-0.6, 2, 1.2, 5.4);
      g.fillRect(-2.2, 6.6, 4.4, 1.1);
    } else {
      // fixed-wing: swept wing, tailplane
      poly(g, [0, -9, 1.5, -4, 1.5, 4.6, 0, 7.4, -1.5, 4.6, -1.5, -4]);
      poly(g, [1.2, -2.6, 9, 2.6, 9, 4.6, 1.2, 1.8]);
      poly(g, [-1.2, -2.6, -9, 2.6, -9, 4.6, -1.2, 1.8]);
      poly(g, [1, 4, 4.4, 6.8, 4.4, 8, 1, 6.6]);
      poly(g, [-1, 4, -4.4, 6.8, -4.4, 8, -1, 6.6]);
    }
  } else if (dim === "G") {
    if (f.startsWith("I")) {
      // installation: a building under a roof bar
      g.fillRect(-6.5, -5.6, 13, 1.8);
      g.fillRect(-5, -2.6, 10, 7.4);
    } else {
      // ground unit: the crossed straps every wargamer reads as a land force
      g.lineWidth = 1.6;
      g.lineCap = "butt";
      const [hx, hy] = aff === "F" ? [14, 9] : [6.5, 6.5];
      g.beginPath();
      g.moveTo(-hx, -hy); g.lineTo(hx, hy);
      g.moveTo(hx, -hy); g.lineTo(-hx, hy);
      g.stroke();
    }
  } else {
    g.beginPath();
    g.arc(0, 0, 2.4, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function questionMark(g: G) {
  g.lineWidth = 2.2;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  g.arc(0, -3.6, 3.9, Math.PI * 1.05, Math.PI * 0.42, false);
  g.lineTo(0, 2.6);
  g.stroke();
  g.beginPath();
  g.arc(0, 6.6, 1.4, 0, Math.PI * 2);
  g.fill();
}

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Draw one glyph into a fresh canvas of GLYPH_PX * resolution device pixels. */
export function drawGlyph(sidc: string, color: string, resolution: number, state: GlyphState = { certainty: "own" }): HTMLCanvasElement {
  const aff = (sidc[1] ?? "U") as Aff;
  const dim = (sidc[2] ?? "Z") as Dim;
  const fn = sidc.slice(4);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.round(GLYPH_PX * resolution);
  const g = canvas.getContext("2d")!;
  g.scale((resolution * GLYPH_PX) / DESIGN, (resolution * GLYPH_PX) / DESIGN);
  g.translate(DESIGN / 2, DESIGN / 2);
  const c = state.certainty;
  const firm = c === "own" || c === "tracked";

  // the plate: the closed frame in the field tone, grown by a dark rim
  framePath(g, aff, dim, true);
  g.lineJoin = "round";
  g.lineWidth = 5;
  g.strokeStyle = rgba(PALETTE.field, 0.9);
  g.stroke();
  g.fillStyle = rgba(PALETTE.field, 0.9);
  g.fill();
  if (firm) {
    g.fillStyle = rgba(color, c === "tracked" ? 0.2 : 0.15);
    g.fill();
  }

  // the frame
  framePath(g, aff, dim, false);
  g.strokeStyle = color;
  g.lineJoin = "miter";
  g.lineCap = "butt";
  g.lineWidth = c === "tracked" ? 2.4 : c === "own" ? 2.1 : c === "classified" ? 1.5 : 1.8;
  if (c === "unknown") {
    g.lineCap = "round";
    g.setLineDash(state.stale ? [0.1, 6] : [0.1, 3.6]);
  } else if (state.stale) {
    g.setLineDash([5, 3.4]);
  }
  g.stroke();
  g.setLineDash([]);

  if (c === "tracked" && !state.stale) {
    g.lineWidth = 1.6;
    g.lineCap = "butt";
    g.beginPath();
    for (const [x0, y0, x1, y1] of lockTicks(aff, dim)) { g.moveTo(x0, y0); g.lineTo(x1, y1); }
    g.stroke();
  }

  // what is inside
  g.fillStyle = color;
  g.strokeStyle = color;
  g.globalAlpha = state.stale ? 0.7 : c === "classified" ? 0.9 : 1;
  if (c === "unknown") {
    g.beginPath();
    g.arc(0, 0, 1.9, 0, Math.PI * 2);
    g.fill();
  } else if (c === "detected") {
    questionMark(g);
  } else {
    icon(g, dim, fn, aff);
  }
  g.globalAlpha = 1;

  // damage: struck through in the alarm hue, over a dark under-stroke so it reads on any frame
  if (state.damage) {
    const strokes: [number, number, number, number][] = [[-13, 13, 13, -13]];
    if (state.damage === 2) strokes.push([-13, -13, 13, 13]);
    g.lineCap = "round";
    for (const [w, c2] of [[5, rgba(PALETTE.field, 0.9)], [2.4, PALETTE.alarm]] as [number, string][]) {
      g.lineWidth = w;
      g.strokeStyle = c2;
      g.beginPath();
      for (const [x0, y0, x1, y1] of strokes) { g.moveTo(x0, y0); g.lineTo(x1, y1); }
      g.stroke();
    }
  }
  return canvas;
}

export function symbolTexture(sidc: string, color: string, resolution: number, state: GlyphState = { certainty: "own" }): SymbolTexture {
  const key = `${sidc}|${color}|${resolution}|${state.certainty}|${state.stale ? 1 : 0}|${state.damage ?? 0}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const texture = new THREE.CanvasTexture(drawGlyph(sidc, color, resolution, state));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const box = layoutBox(sidc);
  const entry: SymbolTexture = { texture, width: box.width, height: box.height, center: new THREE.Vector2(box.cx, box.cy) };
  cache.set(key, entry);
  return entry;
}
