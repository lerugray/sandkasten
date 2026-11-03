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

export function sidcFor(affiliation: Affiliation, dimension: BattleDimension, functionId: string): string {
  return "S" + AFFILIATION_CHAR[affiliation] + DIMENSION_CHAR[dimension] + "P" + (functionId + "------").slice(0, 10);
}

export function symbolTexture(sidc: string, color: string, resolution: number): SymbolTexture {
  const key = `${sidc}|${color}|${resolution}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const symbol = new ms.Symbol(sidc, {
    size: 22,
    monoColor: color,
    strokeWidth: 3,
    outlineWidth: 0,
    infoFields: false,
  });
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
