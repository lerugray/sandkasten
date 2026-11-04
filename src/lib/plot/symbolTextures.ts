// MIL-STD-2525 glyphs from milsymbol, drawn once into canvas textures in a
// single colour so they read as vector strokes on the plot.
import ms from "milsymbol";
import * as THREE from "three";
import type { Affiliation, BattleDimension } from "@/lib/symbols/milsymbolFactory";

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
  // CSS pixel size of the glyph and its anchor as a sprite centre (0..1)
  width: number;
  height: number;
  center: THREE.Vector2;
}

const cache = new Map<string, SymbolTexture>();

/** `"unknown"` is the 2525 unknown battle dimension (Z): a sensor has a track but not its domain. */
export function sidcFor(affiliation: Affiliation, dimension: BattleDimension | "unknown", functionId: string): string {
  const dim = dimension === "unknown" ? "Z" : DIMENSION_CHAR[dimension];
  return "S" + AFFILIATION_CHAR[affiliation] + dim + "P" + (functionId + "------").slice(0, 10);
}

export interface SymbolStyle {
  size: number;
  stroke: number;
  /** fill the frame with this colour so linework under it does not show */
  knockout: string | null;
}

const DEFAULT_STYLE: SymbolStyle = { size: 22, stroke: 3, knockout: null };

export function symbolTexture(sidc: string, color: string, resolution: number, style: SymbolStyle = DEFAULT_STYLE): SymbolTexture {
  const key = `${sidc}|${color}|${resolution}|${style.size}|${style.stroke}|${style.knockout ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const all = (c: string) => ({ Civilian: c, Friend: c, Hostile: c, Neutral: c, Unknown: c, Suspect: c });
  const symbol = new ms.Symbol(
    sidc,
    style.knockout
      ? {
          size: style.size,
          frameColor: all(color),
          iconColor: all(color),
          fill: true,
          fillColor: style.knockout,
          fillOpacity: 1,
          strokeWidth: style.stroke,
          outlineWidth: 0,
          infoFields: false,
        }
      : {
          size: style.size,
          monoColor: color,
          strokeWidth: style.stroke,
          outlineWidth: 0,
          infoFields: false,
        },
  );
  const canvas = symbol.asCanvas(resolution);
  const size = symbol.getSize();
  const anchor = symbol.getAnchor();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const entry: SymbolTexture = {
    texture,
    width: size.width,
    height: size.height,
    center: new THREE.Vector2(anchor.x / size.width, 1 - anchor.y / size.height),
  };
  cache.set(key, entry);
  return entry;
}
