import { coLocationIndex } from "./sites";
import type { OsintSite } from "./sites";

export type Anchor = "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type Rect = { x: number; y: number; w: number; h: number };

export const ICON_SCALE = 0.85;
export const LABEL_EM = 12.5;
export const ICON_RADIUS = 14 * ICON_SCALE;
export const LABEL_H = 16;
export const UNIT_HALF = 27;

// Offsets in icon-size units (px at size 1) so symbols sharing a base fan out and stay clear of the facility symbol they sit on.
export const SLOT_OFFSETS: [number, number][] = [
  [0, -22],
  [24, -2],
  [-24, -2],
  [0, 22],
];
export const LABEL_SLOTS = [-1, ...SLOT_OFFSETS.map((_, i) => i)];

/** Which fan-out slot each site's symbol sits in (-1: on its own true position). */
export function siteSlots(sites: OsintSite[]): Map<string, number> {
  const loc = coLocationIndex(sites, 1500);
  const out = new Map<string, number>();
  for (const site of sites) {
    const l = loc.get(site.id)!;
    out.set(site.id, site.facilityId || l.count > 1 || site.positionBasis === "facility-anchor" ? l.index % SLOT_OFFSETS.length : -1);
  }
  return out;
}

/** Symbol offset in px for a slot, as drawn (icon size included). */
export const slotPx = (slot: number): [number, number] => {
  const o = SLOT_OFFSETS[slot] ?? [0, 0];
  return [o[0] * ICON_SCALE, o[1] * ICON_SCALE];
};

/** Where a label may sit around its OWN symbol, in preference order: [anchor, [x, y] px offset from the site point]. */
export function labelCandidates(slot: number): [Anchor, [number, number]][] {
  const [x, y] = slotPx(slot);
  const gap = ICON_RADIUS + 4;
  const side = (a: "left" | "right"): [Anchor, [number, number]] => [a, [x + (a === "left" ? gap : -gap), y]];
  const above: [Anchor, [number, number]] = ["bottom", [x, y - ICON_RADIUS - 3]];
  const below: [Anchor, [number, number]] = ["top", [x, y + ICON_RADIUS + 3]];
  const order = slot === 2 ? [side("right"), side("left")] : [side("left"), side("right")];
  const d = ICON_RADIUS + 1;
  const diag = (a: Anchor, sx: number, sy: number): [Anchor, [number, number]] => [a, [x + sx * d, y + sy * d]];
  const corners = [diag("top-left", 1, 1), diag("top-right", -1, 1), diag("bottom-left", 1, -1), diag("bottom-right", -1, -1)];
  return slot === 3 ? [...order, below, above, ...corners] : [...order, above, below, ...corners];
}

export function labelRect(anchor: Anchor, ax: number, ay: number, w: number, h = LABEL_H): Rect {
  const left = anchor.includes("left") || anchor === "left";
  const right = anchor.includes("right") || anchor === "right";
  const top = anchor.startsWith("top");
  const bottom = anchor.startsWith("bottom");
  return {
    x: left ? ax : right ? ax - w : ax - w / 2,
    y: top ? ay : bottom ? ay - h : ay - h / 2,
    w,
    h,
  };
}

const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const square = (cx: number, cy: number, half: number): Rect => ({ x: cx - half, y: cy - half, w: 2 * half, h: 2 * half });

export type LabelInput = { id: string; label: string; slot: number; x: number; y: number };
export type LabelPlacement = { id: string; cand: number; anchor: Anchor; offset: [number, number]; rect: Rect; iconX: number; iconY: number };

/**
 * Picks, for every site, the spot around its own symbol that overlaps least with unit symbols, every site symbol and
 * the labels already placed. A label is never moved to another site's symbol, and is never dropped.
 */
export function layoutLabels(items: LabelInput[], unitsPx: [number, number][], textWidth: (s: string) => number): LabelPlacement[] {
  const units = unitsPx.map(([x, y]) => square(x, y, UNIT_HALF));
  const icons = items.map((it) => {
    const [sx, sy] = slotPx(it.slot);
    return square(it.x + sx, it.y + sy, ICON_RADIUS + 2);
  });
  const placed: Rect[] = [];
  return items.map((it, n) => {
    const w = Math.ceil(textWidth(it.label)) + 4;
    const cands = labelCandidates(it.slot);
    let best = 0;
    let bestScore = Infinity;
    let bestRect: Rect = labelRect(cands[0][0], it.x + cands[0][1][0], it.y + cands[0][1][1], w);
    cands.forEach(([a, [ox, oy]], k) => {
      const r = labelRect(a, it.x + ox, it.y + oy, w);
      let score = k * 0.5;
      // a label must read as belonging to its own symbol: its centre stays nearer to that symbol than to any other
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const own = Math.hypot(cx - (icons[n].x + icons[n].w / 2), cy - (icons[n].y + icons[n].h / 2));
      icons.forEach((ic, m) => {
        if (m !== n && Math.hypot(cx - (ic.x + ic.w / 2), cy - (ic.y + ic.h / 2)) <= own + 1) score += 1e6;
      });
      for (const u of units) score += overlap(r, u) * 1;
      icons.forEach((ic, m) => (score += overlap(r, ic) * (m === n ? 8 : 4)));
      for (const p of placed) score += overlap(r, p) * 4;
      if (score < bestScore) {
        bestScore = score;
        best = k;
        bestRect = r;
      }
    });
    placed.push(bestRect);
    const [anchor, offset] = cands[best];
    const [sx, sy] = slotPx(it.slot);
    return { id: it.id, cand: best, anchor, offset, rect: bestRect, iconX: it.x + sx, iconY: it.y + sy };
  });
}
