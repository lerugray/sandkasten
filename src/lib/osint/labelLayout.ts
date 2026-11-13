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

/**
 * Where a label may sit around its OWN symbol, in preference order: [anchor, [x, y] px offset from the site point].
 * `shift` moves the symbol off its slot (when the layout had to push the symbol clear of something).
 */
export function labelCandidates(slot: number, shift: [number, number] = [0, 0]): [Anchor, [number, number]][] {
  const [sx, sy] = slotPx(slot);
  const x = sx + shift[0];
  const y = sy + shift[1];
  const gap = ICON_RADIUS + 4;
  const side = (a: "left" | "right"): [Anchor, [number, number]] => [a, [x + (a === "left" ? gap : -gap), y]];
  const above: [Anchor, [number, number]] = ["bottom", [x, y - ICON_RADIUS - 3]];
  const below: [Anchor, [number, number]] = ["top", [x, y + ICON_RADIUS + 3]];
  const order = slot === 2 ? [side("right"), side("left")] : [side("left"), side("right")];
  const d = ICON_RADIUS + 1;
  const diag = (a: Anchor, dx: number, dy: number): [Anchor, [number, number]] => [a, [x + dx * d, y + dy * d]];
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
const near = (a: Rect, b: Rect, gap: number) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > -gap && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > -gap;

export type LabelInput = {
  id: string;
  label: string;
  slot: number;
  /** the site point */
  x: number;
  y: number;
  /** centre of the symbol as drawn when the layout moved it off its slot (default: site point + slot offset) */
  iconX?: number;
  iconY?: number;
};
export type LabelPlacement = {
  id: string;
  cand: number;
  anchor: Anchor;
  offset: [number, number];
  rect: Rect;
  iconX: number;
  iconY: number;
  /** true when the label sits away from its symbol and needs a leader line to it */
  leader: boolean;
};
export type LabelOpts = {
  /** unit symbol frames as drawn (replaces the UNIT_HALF squares around `unitsPx`) */
  unitRects?: Rect[];
  /** any other rect a label must stay clear of: facility icons, contact markers */
  blockers?: Rect[];
  /**
   * Dense /map zooms (many facility discs on screen): skip the least-bad fallback so computeMapLayout
   * omits the plate instead of leaving a residue overlap the e2e catches at 1920.
   */
  omitIfBlocked?: boolean;
};

const LABEL_GAP = 1.5;

/**
 * Picks, for every site, the spot around its own symbol that overlaps least with unit symbols, every site symbol and
 * the labels already placed. A label is never moved to another site's symbol and is never dropped: when no spot beside
 * its symbol is clear it moves out along a ring and gets a leader line.
 */
export function layoutLabels(items: LabelInput[], unitsPx: [number, number][], textWidth: (s: string) => number, opts: LabelOpts = {}): LabelPlacement[] {
  const units = opts.unitRects ?? unitsPx.map(([x, y]) => square(x, y, UNIT_HALF));
  const others = opts.blockers ?? [];
  const centres = items.map((it) => {
    const [sx, sy] = slotPx(it.slot);
    return [it.iconX ?? it.x + sx, it.iconY ?? it.y + sy] as [number, number];
  });
  const icons = centres.map(([cx, cy]) => square(cx, cy, ICON_RADIUS + 2));
  const placed: Rect[] = [];
  return items.map((it, n) => {
    const w = Math.ceil(textWidth(it.label)) + 4;
    const [icx, icy] = centres[n];
    const [sx, sy] = slotPx(it.slot);
    const cands = labelCandidates(it.slot, [icx - it.x - sx, icy - it.y - sy]);
    const rects = cands.map(([a, [ox, oy]]) => labelRect(a, it.x + ox, it.y + oy, w));
    const hard = (r: Rect, ownGap: number) =>
      units.some((u) => near(r, u, LABEL_GAP)) ||
      others.some((o) => near(r, o, LABEL_GAP)) ||
      placed.some((p) => near(r, p, LABEL_GAP)) ||
      icons.some((ic, m) => near(r, ic, m === n ? ownGap : LABEL_GAP));
    // a label must read as belonging to its own symbol: its centre stays nearer to that symbol than to any other
    const ownerOk = (r: Rect) => {
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const own = Math.hypot(cx - icx, cy - icy);
      return !icons.some((ic, m) => m !== n && Math.hypot(cx - (ic.x + ic.w / 2), cy - (ic.y + ic.h / 2)) <= own + 1);
    };
    let best = -1;
    for (let k = 0; k < rects.length; k++) {
      if (ownerOk(rects[k]) && !hard(rects[k], 0)) {
        best = k;
        break;
      }
    }
    if (best >= 0) {
      placed.push(rects[best]);
      return { id: it.id, cand: best, anchor: cands[best][0], offset: cands[best][1], rect: rects[best], iconX: icx, iconY: icy, leader: false };
    }
    // no clear spot beside the symbol: walk outward on a ring, flanks first, and tie the label back with a leader
    const flank = [0, Math.PI, -0.5, Math.PI + 0.5, 0.5, Math.PI - 0.5, -1, Math.PI + 1, 1, Math.PI - 1, -Math.PI / 2, Math.PI / 2];
    const dirs = [...flank, ...Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6 + Math.PI / 12)];
    // 220 px: denser 1920-wide theatre views pack more facilities on screen than the old 140 px ring could escape
    for (let d = ICON_RADIUS + 9; d <= ICON_RADIUS + 220; d += 4) {
      for (const a of dirs) {
        const cx = icx + Math.cos(a) * (d + (w / 2) * Math.abs(Math.cos(a)));
        const cy = icy + Math.sin(a) * (d + (LABEL_H / 2) * Math.abs(Math.sin(a)));
        const r: Rect = { x: cx - w / 2, y: cy - LABEL_H / 2, w, h: LABEL_H };
        if (hard(r, LABEL_GAP)) continue;
        placed.push(r);
        return { id: it.id, cand: cands.length, anchor: "top-left" as Anchor, offset: [r.x - it.x, r.y - it.y] as [number, number], rect: r, iconX: icx, iconY: icy, leader: true };
      }
    }
    if (opts.omitIfBlocked) {
      // No clear ring spot: leave a zero-size rect so computeMapLayout drops the plate (no least-bad residue).
      const empty: Rect = { x: -1e6, y: -1e6, w: 0, h: 0 };
      placed.push(empty);
      return { id: it.id, cand: -1, anchor: "top-left" as Anchor, offset: [0, 0], rect: empty, iconX: icx, iconY: icy, leader: false };
    }
    // solid area: least-bad adjacent spot (computeMapLayout may still drop it if the residue overlaps)
    let bestScore = Infinity;
    let bi = 0;
    rects.forEach((r, k) => {
      let score = k * 0.5 + (ownerOk(r) ? 0 : 1e6);
      for (const u of units) score += overlap(r, u);
      for (const o of others) score += overlap(r, o) * 4;
      icons.forEach((ic, m) => (score += overlap(r, ic) * (m === n ? 8 : 4)));
      for (const pl of placed) score += overlap(r, pl) * 4;
      if (score < bestScore) {
        bestScore = score;
        bi = k;
      }
    });
    placed.push(rects[bi]);
    return { id: it.id, cand: bi, anchor: cands[bi][0], offset: cands[bi][1], rect: rects[bi], iconX: icx, iconY: icy, leader: false };
  });
}
