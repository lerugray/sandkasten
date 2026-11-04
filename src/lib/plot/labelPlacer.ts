// Data-block placement for the tactical plot. Pure screen-space geometry, no
// DOM, so the rules are explicit and testable:
//   - no two blocks overlap
//   - a block never covers another glyph, a missile head, a weapon line or a leader
//   - a leader never crosses another block, another leader or another glyph
//   - a block without a leader is nearer its own glyph than any other
// When a block has nowhere to go it degrades: full block, then first line
// only, then first line out at the cluster's edge on a leader, then hidden.
// Friendly units, the selection and classified hostiles (keep) are placed
// first and searched farther before they give up.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

/** Does segment s touch rect r (inflated by pad)? Liang-Barsky clip. */
export function segHitsRect(s: Seg, r: Rect, pad = 0): boolean {
  const x0 = r.x - pad, y0 = r.y - pad, x1 = r.x + r.w + pad, y1 = r.y + r.h + pad;
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  let t0 = 0, t1 = 1;
  const clip = (p: number, q: number) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
    return true;
  };
  return clip(-dx, s.x1 - x0) && clip(dx, x1 - s.x1) && clip(-dy, s.y1 - y0) && clip(dy, y1 - s.y1);
}

/** Proper crossing of two segments (touching at an endpoint does not count). */
export function segsCross(a: Seg, b: Seg): boolean {
  const d = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d1 = d(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const d2 = d(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  const d3 = d(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const d4 = d(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  const eps = 1e-6;
  return ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps));
}

/** gap between two rects (0 when they touch or overlap) */
export function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.hypot(dx, dy);
}

/** shortest leader a player reliably sees */
export const MIN_LEADER = 8;

export function distToRect(x: number, y: number, r: Rect): number {
  const cx = Math.max(r.x, Math.min(x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(y, r.y + r.h));
  return Math.hypot(x - cx, y - cy);
}

export interface LabelItem {
  key: string;
  /** 0 selection, 1 friendly unit, 2 classified hostile, 3 detected, 4 unknown */
  priority: number;
  keep: boolean;
  gx: number;
  gy: number;
  glyph: Rect;
  /** the drawn symbol; distances are measured from its edge */
  core: Rect;
  fullW: number;
  fullH: number;
  compactW: number;
  compactH: number;
  /** px from the glyph to the nearest chrome edge; hemmed-in tracks place first */
  edge?: number;
}

export interface Placement {
  key: string;
  visible: boolean;
  rect: Rect;
  compact: boolean;
  leader: Seg | null;
}

export interface PlaceEnv {
  /** true when a rect is under the chrome or off the canvas */
  blocked: (r: Rect) => boolean;
  /** already-placed labels a block must not cover (ring, waypoint, measure labels) */
  fixed: Rect[];
  /** every glyph on screen, with its owner key; core is the drawn symbol, rect its frame */
  glyphs: { key: string; rect: Rect; core: Rect; x: number; y: number }[];
  /** missile heads and live bursts */
  points: Rect[];
  /** weapon track lines in screen space */
  lines: Seg[];
  /** skip the full block when another glyph is this close (px); 0 = never */
  compactWithin?: number;
}

/**
 * A block with no leader must read as its own glyph's: its gap to its own
 * glyph centre is at most this share of its gap to the next nearest glyph.
 * At 0.6 the wrong glyph is at least 1.67x farther, a difference the eye
 * reads at a glance; above about 0.75 two glyphs look equally near.
 */
export const PAIR_RATIO = 0.6;
/** a block farther than this from its glyph always carries a leader */
export const LEADER_BEYOND = 24;

const NEAR = 4;
// far candidates for kept tracks come in anchor variants (block extends right,
// left, down or up from the leader's end); the variant rides above this stride
const VAR = 100000;
const RINGS = [46, 74, 106, 142, 184];
const KEEP_RINGS = [232, 286, 344, 410, 480, 560];
const ANGLES = 24;
const UPGRADE_FRAMES = 240; // a better spot must stay free 4 s before a block moves to it
const REPAIR_COOLDOWN = 10; // frames to rest after all three repair orders failed
// A new spot is chosen with margins inside the audit's limits (rounding in the
// DOM must never tip it over); a spot already held is kept while it stays
// within slightly looser margins, still inside the limits, so blocks do not
// jump for a pixel of drift.
const PICK = { pad: 2, glyphPad: 1, ratio: 0.5, beyond: 22, leader: 9 };
const HOLD = { pad: 0.5, glyphPad: 0.5, ratio: 0.55, beyond: 23.5, leader: 8.5 };
const GAP = 13;
const PAD = 2;

interface Memory {
  cand: number;
  compact: boolean;
  better: number;
}

export class LabelPlacer {
  private memory = new Map<string, Memory>();
  private repairCooldown = 0;
  private repairAttempt = 0;
  private repairMisses = 0;
  private placedRects: Rect[] = [];
  private placedLeaders: { key: string; seg: Seg }[] = [];
  private out: Placement[] = [];
  private seen = new Set<string>();
  // scratch objects reused every call
  private cRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private cLeader: Seg = { x1: 0, y1: 0, x2: 0, y2: 0 };

  /** Lays out every item; returns placements in item order. */
  place(items: LabelItem[], env: PlaceEnv): Placement[] {
    this.seen.clear();
    for (const it of items) this.seen.add(it.key);
    for (const k of this.memory.keys()) if (!this.seen.has(k)) this.memory.delete(k);

    // stable order: priority, then key, so the same block wins each frame
    // within a priority, tracks with least room (nearest the chrome) go first,
    // in 40 px bands so small drift does not reorder them
    const band = (i: number) => Math.floor((items[i].edge ?? 999) / 40);
    const order = items.map((_, i) => i).sort((a, b) =>
      items[a].priority - items[b].priority || band(a) - band(b) || (items[a].key < items[b].key ? -1 : 1));
    let results = this.pass(items, env, order, null);
    let failed = this.failedKeep(items, results);
    let bestMemory: Map<string, Memory> | null = null;

    // Repair: a kept track found no spot. Re-place the frame with the failed
    // tracks first, trying three orders for everyone else (original order,
    // farthest-from-the-failure first, reversed), and keep the pass with
    // fewest losses. Memory then holds the repaired layout, so this only runs
    // on the frames a cluster tightens.
    if (this.repairCooldown > 0) this.repairCooldown--;
    const clone = (m: Map<string, Memory>) => new Map([...m].map(([k, v]) => [k, { ...v }]));
    // bounded: at most one extra pass per frame, cycling through the orders
    if (failed.length && this.repairCooldown === 0) {
      const attempt = this.repairAttempt;
      this.repairAttempt = (attempt + 1) % 3;
      const saved = clone(this.memory);
      const first = new Set(failed.map((i) => items[i].key));
      const fx = items[failed[0]].gx, fy = items[failed[0]].gy;
      const free = new Set<string>();
      for (const it of items) {
        if (attempt > 0 || failed.some((f) => Math.hypot(it.gx - items[f].gx, it.gy - items[f].gy) < 260)) free.add(it.key);
      }
      const rest = order.filter((i) => !first.has(items[i].key));
      if (attempt === 1) {
        rest.sort((a, b) => items[a].priority - items[b].priority ||
          Math.hypot(items[b].gx - fx, items[b].gy - fy) - Math.hypot(items[a].gx - fx, items[a].gy - fy));
      } else if (attempt === 2) {
        rest.sort((a, b) => items[a].priority - items[b].priority || (items[a].key < items[b].key ? 1 : -1));
      }
      const retryOrder = [...order.filter((i) => first.has(items[i].key)), ...rest];
      const retry = this.pass(items, env, retryOrder, free);
      const retryFailed = this.failedKeep(items, retry);
      if (retryFailed.length < failed.length) {
        results = retry;
        failed = retryFailed;
        bestMemory = clone(this.memory);
        this.repairMisses = 0;
      } else {
        this.memory = saved;
        // all three orders tried in a row without a gain: rest a little
        if (++this.repairMisses >= 3) {
          this.repairMisses = 0;
          this.repairCooldown = REPAIR_COOLDOWN;
        }
      }
    }
    if (bestMemory) this.memory = bestMemory;
    this.out.length = 0;
    for (const r of results) this.out.push(r);
    return this.out;
  }

  private failedKeep(items: LabelItem[], results: Placement[]): number[] {
    const out: number[] = [];
    for (let i = 0; i < items.length; i++) if (items[i].keep && !results[i].visible) out.push(i);
    return out;
  }

  /** One placement pass in the given order; `fresh` keys ignore last frame's spot. */
  private pass(items: LabelItem[], env: PlaceEnv, order: number[], fresh: Set<string> | null): Placement[] {
    this.placedRects.length = 0;
    for (const f of env.fixed) this.placedRects.push(f);
    this.placedLeaders.length = 0;
    const results: Placement[] = new Array(items.length);
    for (const i of order) {
      const it = items[i];
      if (fresh?.has(it.key)) this.memory.delete(it.key);
      results[i] = this.placeOne(it, env);
    }
    return results;
  }

  private placeOne(it: LabelItem, env: PlaceEnv): Placement {
    const mem = this.memory.get(it.key);
    const awayX = this.awayDir(it, env);

    // keep last frame's spot while it is still legal; move up a tier only
    // when the better spot has been free for a while (no jitter)
    if (mem && this.tryCand(it, env, mem.cand, mem.compact, awayX, HOLD)) {
      const tier = this.tier(mem.cand, mem.compact);
      if (tier > 0) {
        const best = this.firstFree(it, env, awayX, tier - 1);
        if (best) {
          mem.better++;
          if (mem.better >= UPGRADE_FRAMES) {
            mem.cand = best.cand;
            mem.compact = best.compact;
            mem.better = 0;
          }
        } else {
          mem.better = 0;
        }
        // the upgrade probe used the scratch rect: rebuild the chosen spot
        this.tryCand(it, env, mem.cand, mem.compact, awayX, mem.better === 0 ? PICK : HOLD) ||
          this.tryCand(it, env, mem.cand, mem.compact, awayX, HOLD);
      }
      return this.commit(it, mem.compact);
    }

    const found = this.firstFree(it, env, awayX, it.keep ? 3 : 2, mem ? this.sideOf(it, mem.cand) : -1, mem ? mem.cand : -1);
    if (!found) {
      this.memory.delete(it.key);
      return { key: it.key, visible: false, rect: { x: 0, y: 0, w: 0, h: 0 }, compact: false, leader: null };
    }
    this.memory.set(it.key, { cand: found.cand, compact: found.compact, better: 0 });
    this.tryCand(it, env, found.cand, found.compact, awayX);
    return this.commit(it, found.compact);
  }

  /** quadrant 0-3 (matching the near slots) a candidate sits in, seen from its glyph */
  private sideOf(it: LabelItem, cand: number): number {
    cand %= VAR;
    if (cand < NEAR) return cand;
    const k = (cand - NEAR) % ANGLES;
    const a = (k / ANGLES) * Math.PI * 2;
    const right = Math.cos(a) >= 0, down = Math.sin(a) >= 0;
    return right ? (down ? 1 : 0) : down ? 3 : 2;
  }

  /** 0 full near, 1 compact near, 2 compact on a leader, 3 compact far (keep only) */
  private tier(cand: number, compact: boolean): number {
    if (cand >= VAR) return 3;
    if (cand < NEAR) return compact ? 1 : 0;
    return cand < NEAR + RINGS.length * ANGLES ? 2 : 3;
  }

  private firstFree(it: LabelItem, env: PlaceEnv, away: { x: number; y: number }, maxTier: number, side = -1, prev = -1) {
    const crowded = !!env.compactWithin && env.glyphs.some((g) => g.key !== it.key && Math.hypot(g.x - it.gx, g.y - it.gy) < env.compactWithin!);
    // prefer the side the block was on, so a forced move does not flip it
    const near = side >= 0 ? [side, ...[0, 1, 2, 3].filter((c) => c !== side)] : [0, 1, 2, 3];
    if (!crowded) for (const c of near) if (this.tryCand(it, env, c, false, away)) return { cand: c, compact: false };
    if (maxTier < 1) return null;
    for (const c of near) if (this.tryCand(it, env, c, true, away)) return { cand: c, compact: true };
    if (maxTier < 2) return null;
    const rings = maxTier >= 3 ? RINGS.length + KEEP_RINGS.length : RINGS.length;
    // a block that lost a far spot looks along the same bearing first
    const prevK = prev % VAR >= NEAR ? ((prev % VAR) - NEAR) % ANGLES : side >= 0 ? [21, 3, 15, 9][side] : -1;
    const angles = prevK >= 0 ? this.angleNear(prevK) : this.angleOrder(away);
    for (let ring = 0; ring < rings; ring++) {
      for (const k of angles) {
        const c = NEAR + ring * ANGLES + k;
        if (this.tryCand(it, env, c, true, away)) return { cand: c, compact: true };
      }
    }
    // kept tracks hemmed in by the chrome: same bearings, block slid to either
    // side; variant 5 tries the half-step bearings between the 24
    if (maxTier >= 3) {
      for (let v = 1; v <= 5; v++) {
        for (let ring = 0; ring < rings; ring++) {
          for (const k of angles) {
            const c = v * VAR + NEAR + ring * ANGLES + k;
            if (this.tryCand(it, env, c, true, away)) return { cand: c, compact: true };
          }
        }
      }
    }
    return null;
  }

  /** direction out of the local cluster: away from the mean of nearby glyphs */
  private awayDir(it: LabelItem, env: PlaceEnv) {
    let sx = 0, sy = 0, n = 0;
    for (const g of env.glyphs) {
      if (g.key === it.key) continue;
      const dx = g.x - it.gx, dy = g.y - it.gy;
      const d = Math.hypot(dx, dy);
      if (d < 160 && d > 0.1) {
        sx += dx / d;
        sy += dy / d;
        n++;
      }
    }
    if (!n || Math.hypot(sx, sy) < 0.2) return { x: 0.7071, y: -0.7071 };
    const l = Math.hypot(sx, sy);
    return { x: -sx / l, y: -sy / l };
  }

  private angleNearCache: number[] = [];
  /** bearings ordered by how close they are to bearing k */
  private angleNear(k: number): number[] {
    const o = this.angleNearCache;
    o.length = 0;
    o.push(k);
    for (let d = 1; d <= ANGLES / 2; d++) {
      o.push((k + d) % ANGLES);
      if (d !== ANGLES / 2) o.push((k - d + ANGLES) % ANGLES);
    }
    return o;
  }

  private angleOrderCache: number[] = [];
  private angleOrder(away: { x: number; y: number }): number[] {
    const o = this.angleOrderCache;
    o.length = 0;
    for (let k = 0; k < ANGLES; k++) o.push(k);
    const score = (k: number) => {
      const a = (k / ANGLES) * Math.PI * 2;
      return -(Math.cos(a) * away.x + Math.sin(a) * away.y);
    };
    o.sort((a, b) => score(a) - score(b));
    return o;
  }

  /** Builds candidate c into cRect/cLeader and reports whether it is legal. */
  private tryCand(it: LabelItem, env: PlaceEnv, c: number, compact: boolean, away: { x: number; y: number }, m = PICK): boolean {
    void away;
    const w = compact ? it.compactW : it.fullW;
    const h = compact ? it.compactH : it.fullH;
    const r = this.cRect;
    r.w = w;
    r.h = h;
    let leader = false;
    if (c < NEAR) {
      // beside the glyph's frame, however big the glyph is drawn
      const gx = Math.max(GAP, it.glyph.w / 2 + 2), gy = Math.max(GAP, it.glyph.h / 2 + 2);
      switch (c) {
        case 0: r.x = it.gx + gx; r.y = it.gy - gy - h + 6; break;
        case 1: r.x = it.gx + gx; r.y = it.gy + gy - 4; break;
        case 2: r.x = it.gx - gx - w; r.y = it.gy - gy - h + 6; break;
        default: r.x = it.gx - gx - w; r.y = it.gy + gy - 4; break;
      }
    } else {
      const variant = Math.floor(c / VAR);
      const idx = (c % VAR) - NEAR;
      const ring = Math.floor(idx / ANGLES);
      const k = idx % ANGLES;
      const radius = ring < RINGS.length ? RINGS[ring] : KEEP_RINGS[ring - RINGS.length];
      const a = ((k + (variant === 5 ? 0.5 : 0)) / ANGLES) * Math.PI * 2;
      const dx = Math.cos(a), dy = Math.sin(a);
      const px = it.gx + dx * radius, py = it.gy + dy * radius;
      r.x = Math.abs(dx) < 0.38 ? px - w / 2 : dx > 0 ? px : px - w;
      r.y = Math.abs(dy) < 0.38 ? py - h / 2 : dy > 0 ? py : py - h;
      if (variant === 1) r.x = px;
      else if (variant === 2) r.x = px - w;
      else if (variant === 3) r.y = py;
      else if (variant === 4) r.y = py - h;
      leader = true;
    }
    r.x = Math.round(r.x);
    r.y = Math.round(r.y);

    if (env.blocked(r)) return false;
    for (const p of this.placedRects) if (rectsOverlap(r, p, m.pad)) return false;
    for (const g of env.glyphs) if (rectsOverlap(r, g.rect, g.key === it.key ? 0 : m.glyphPad)) return false;
    for (const p of env.points) if (rectsOverlap(r, p, 1)) return false;
    for (const s of env.lines) if (segHitsRect(s, r, 1)) return false;
    for (const l of this.placedLeaders) if (segHitsRect(l.seg, r, 1)) return false;

    // a block with no leader has to read as its own glyph's: close to its
    // drawn symbol, and clearly closer to it than to any other symbol
    let needsLeader = false;
    if (!leader) {
      const own = rectGap(it.core, r);
      if (own > m.beyond) needsLeader = true;
      else {
        for (const g of env.glyphs) {
          if (g.key === it.key) continue;
          if (own > m.ratio * rectGap(g.core, r)) {
            needsLeader = true;
            break;
          }
        }
      }
      leader = needsLeader;
    }

    const L = this.cLeader;
    if (leader) {
      // glyph edge to the nearest point of the block
      const nx = Math.max(r.x, Math.min(it.gx, r.x + r.w));
      const ny = Math.max(r.y, Math.min(it.gy, r.y + r.h));
      const dx = nx - it.gx, dy = ny - it.gy;
      const len = Math.hypot(dx, dy) || 1;
      const start = Math.min(len, Math.max(it.glyph.w, it.glyph.h) / 2 + 1);
      L.x1 = it.gx + (dx / len) * start;
      L.y1 = it.gy + (dy / len) * start;
      L.x2 = nx;
      L.y2 = ny;
      // a beside-the-glyph spot that only a stub of a leader would pair is
      // not good enough: move to a spot with a leader you can see
      if (needsLeader && Math.hypot(L.x2 - L.x1, L.y2 - L.y1) < m.leader) return false;
      for (const p of this.placedRects) if (segHitsRect(L, p, 1)) return false;
      // a leader may pass a neighbour's frame but never its drawn symbol
      for (const g of env.glyphs) if (g.key !== it.key && segHitsRect(L, g.core, 1)) return false;
      for (const l of this.placedLeaders) if (segsCross(L, l.seg)) return false;
      this.hasLeader = true;
    } else {
      this.hasLeader = false;
    }
    return true;
  }

  private hasLeader = false;

  private commit(it: LabelItem, compact: boolean): Placement {
    const rect = { ...this.cRect };
    this.placedRects.push(rect);
    let leader: Seg | null = null;
    if (this.hasLeader) {
      leader = { ...this.cLeader };
      this.placedLeaders.push({ key: it.key, seg: leader });
    }
    return { key: it.key, visible: true, rect, compact, leader };
  }
}

export interface AuditInput {
  blocks: { key: string; rect: Rect }[];
  leaders: { key: string; seg: Seg }[];
  glyphs: { key: string; rect: Rect; core: Rect; x: number; y: number }[];
  lines: Seg[];
  grid: Rect[];
  keptHidden: number;
  /** drawn missile heads (screen rects of the visible head mark) */
  heads: Rect[];
  /** the leader stroke as rendered: width in px and effective opacity */
  leaderStroke: { width: number; opacity: number };
}

export interface AuditCounts {
  blocks: number;
  blockOverlaps: number;
  leaderThroughBlock: number;
  leaderCrossings: number;
  leaderThroughGlyph: number;
  weaponThroughBlock: number;
  ambiguousPairing: number;
  farBlockNoVisibleLeader: number;
  blockOverGlyph: number;
  blockOverMissileHead: number;
  gridOverlaps: number;
  keptHidden: number;
}

/**
 * Independent check of a frame as drawn: block rects come from the DOM, leaders
 * and weapon lines from what the plot drew. Counts every rule violation.
 */
export function auditLabels(a: AuditInput): AuditCounts {
  const c: AuditCounts = {
    blocks: a.blocks.length,
    blockOverlaps: 0,
    leaderThroughBlock: 0,
    leaderCrossings: 0,
    leaderThroughGlyph: 0,
    weaponThroughBlock: 0,
    ambiguousPairing: 0,
    farBlockNoVisibleLeader: 0,
    blockOverGlyph: 0,
    blockOverMissileHead: 0,
    gridOverlaps: 0,
    keptHidden: a.keptHidden,
  };
  const shrink = (r: Rect, s: number): Rect => ({ x: r.x + s, y: r.y + s, w: Math.max(0, r.w - 2 * s), h: Math.max(0, r.h - 2 * s) });
  for (let i = 0; i < a.blocks.length; i++) {
    for (let j = i + 1; j < a.blocks.length; j++) {
      if (rectsOverlap(shrink(a.blocks[i].rect, 0.5), shrink(a.blocks[j].rect, 0.5))) c.blockOverlaps++;
    }
  }
  for (const l of a.leaders) {
    for (const b of a.blocks) if (b.key !== l.key && segHitsRect(l.seg, shrink(b.rect, 0.5))) c.leaderThroughBlock++;
    for (const g of a.glyphs) if (g.key !== l.key && segHitsRect(l.seg, g.core)) c.leaderThroughGlyph++;
  }
  for (let i = 0; i < a.leaders.length; i++) {
    for (let j = i + 1; j < a.leaders.length; j++) {
      if (a.leaders[i].key !== a.leaders[j].key && segsCross(a.leaders[i].seg, a.leaders[j].seg)) c.leaderCrossings++;
    }
  }
  for (const s of a.lines) for (const b of a.blocks) if (segHitsRect(s, shrink(b.rect, 0.5))) c.weaponThroughBlock++;
  // a leader a player can see: long enough, wide enough, opaque enough
  const strokeVisible = a.leaderStroke.width >= 1 && a.leaderStroke.opacity >= 0.4;
  const leaderOf = new Map(a.leaders.map((l) => [l.key, l.seg]));
  for (const b of a.blocks) {
    const own = a.glyphs.find((g) => g.key === b.key);
    if (!own) continue;
    const dOwn = rectGap(own.core, b.rect);
    const L = leaderOf.get(b.key);
    const visibleLeader = !!L && strokeVisible && Math.hypot(L.x2 - L.x1, L.y2 - L.y1) >= MIN_LEADER;
    if (!visibleLeader) {
      for (const g of a.glyphs) {
        if (g.key !== b.key && dOwn > PAIR_RATIO * rectGap(g.core, b.rect)) { c.ambiguousPairing++; break; }
      }
    }
    if (dOwn > LEADER_BEYOND && !visibleLeader) c.farBlockNoVisibleLeader++;
    for (const g of a.glyphs) if (rectsOverlap(shrink(b.rect, 0.5), g.core)) c.blockOverGlyph++;
    for (const h of a.heads) if (rectsOverlap(shrink(b.rect, 0.5), h)) c.blockOverMissileHead++;
  }
  for (let i = 0; i < a.grid.length; i++) {
    for (const b of a.blocks) if (rectsOverlap(shrink(a.grid[i], 0.5), b.rect)) c.gridOverlaps++;
    for (let j = i + 1; j < a.grid.length; j++) if (rectsOverlap(shrink(a.grid[i], 0.5), shrink(a.grid[j], 0.5))) c.gridOverlaps++;
  }
  return c;
}
