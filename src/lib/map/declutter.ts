/**
 * Pure placement helpers for the /map DOM layers (unit symbols, OSINT icons, site labels).
 * Everything is in container px, y down. A "blocker" is a rect nothing else may touch.
 */

export type Rect = { x: number; y: number; w: number; h: number };

export const rectAt = (cx: number, cy: number, w: number, h = w): Rect => ({ x: cx - w / 2, y: cy - h / 2, w, h });

/** True when the rects come closer than `gap` px on both axes (so a gap of 2 keeps 2 clear px between them). */
export function touches(a: Rect, b: Rect, gap = 0): boolean {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ox > -gap && oy > -gap;
}

export const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

const STEP = 3;
const ARC = 6;

/** Offsets around (0,0), nearest first; inside one ring, nearest to the preferred direction first. */
const ringCache = new Map<string, [number, number][]>();
export function ringOffsets(maxR: number, prefAngle = -Math.PI / 2, step = STEP): [number, number][] {
  const ck = `${maxR}|${prefAngle.toFixed(3)}|${step}`;
  const hit = ringCache.get(ck);
  if (hit) return hit;
  if (ringCache.size > 64) ringCache.clear();
  const out: [number, number][] = [[0, 0]];
  for (let r = step; r <= maxR; r += step) {
    const n = Math.max(12, Math.round((2 * Math.PI * r) / ARC));
    const da = (2 * Math.PI) / n;
    for (let k = 0; k <= n / 2; k++) {
      for (const s of k === 0 || k * 2 === n ? [1] : [1, -1]) {
        const a = prefAngle + s * k * da;
        out.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
  }
  ringCache.set(ck, out);
  return out;
}

export interface PlaceOpts {
  gap?: number;
  maxR?: number;
  /** direction tried first inside each ring (radians, y down) */
  prefAngle?: number;
  /** keep the rect inside this box when the preferred spot is inside it */
  bounds?: { w: number; h: number };
}

/**
 * Nearest spot to `pref` (centre) where a w x h rect touches no blocker. Falls back to the least-overlapping ring spot
 * when the area is solid.
 */
export function placeNearest(pref: { x: number; y: number }, w: number, h: number, blockers: Rect[], opts: PlaceOpts = {}): { x: number; y: number; free: boolean } {
  const gap = opts.gap ?? 2;
  const inside = (r: Rect) => !opts.bounds || (r.x >= 0 && r.y >= 0 && r.x + r.w <= opts.bounds.w && r.y + r.h <= opts.bounds.h);
  const wantInside = inside(rectAt(pref.x, pref.y, w, h));
  let best = { x: pref.x, y: pref.y, score: Infinity };
  for (const [dx, dy] of ringOffsets(opts.maxR ?? 150, opts.prefAngle)) {
    const r = rectAt(pref.x + dx, pref.y + dy, w, h);
    if (wantInside && !inside(r)) continue;
    let score = 0;
    for (const b of blockers) if (touches(r, b, gap)) score += 1 + overlapArea(r, b);
    if (score === 0) return { x: r.x + w / 2, y: r.y + h / 2, free: true };
    score += Math.hypot(dx, dy) * 0.01;
    if (score < best.score) best = { x: r.x + w / 2, y: r.y + h / 2, score };
  }
  return { x: best.x, y: best.y, free: false };
}

export interface Placeable {
  id: string;
  /** true point */
  x: number;
  y: number;
  /** preferred centre (the true point plus any fan-out slot) */
  px?: number;
  py?: number;
  w: number;
  h: number;
  prefAngle?: number;
}

/** Places each item in turn (later ones avoid earlier ones); returns the chosen centres and grows `blockers`. */
export function placeAll(items: Placeable[], blockers: Rect[], opts: PlaceOpts = {}): Map<string, { x: number; y: number; free: boolean }> {
  const out = new Map<string, { x: number; y: number; free: boolean }>();
  for (const it of items) {
    const pref = { x: it.px ?? it.x, y: it.py ?? it.y };
    const p = placeNearest(pref, it.w, it.h, blockers, { ...opts, prefAngle: it.prefAngle ?? opts.prefAngle });
    out.set(it.id, p);
    blockers.push(rectAt(p.x, p.y, it.w, it.h));
  }
  return out;
}
