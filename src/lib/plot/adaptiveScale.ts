export const SCALE_MIN = 0.5;

const STEP = 0.85;
const CHECK_MS = 1000;
const WINDOW_MS = 2000;
const REFRESH_MIN = 4;
const REFRESH_MAX = 17.5; // nothing slower than ~57 Hz is treated as the display's own rate
const REFRESH_RISE = 0.033; // per 1 s check: the envelope rises slowly, falls at once
const DROP_MS = 20;
const DROP_RATIO = 1.25;
const CALM_RATIO = 1.15;
const BASE_CALM_CHECKS = 3;
const MAX_CALM_CHECKS = 30;
const QUICK_DROP_MS = 10_000;

export interface AdaptiveScaleState {
  scale: number;
  frameMs: number;
  /** The display's own frame interval: slow lower envelope of recent rAF deltas. */
  refreshMs: number;
  checkAt: number;
  calmChecks: number;
  calmNeeded: number;
  lastUpgradeAt: number;
  recent: { t: number; d: number }[];
}

export function createAdaptiveScale(): AdaptiveScaleState {
  return {
    scale: 1,
    frameMs: 16.7,
    refreshMs: 16.7,
    checkAt: 0,
    calmChecks: 0,
    calmNeeded: BASE_CALM_CHECKS,
    lastUpgradeAt: -Infinity,
    recent: [],
  };
}

function percentile20(recent: { d: number }[]): number {
  const sorted = recent.map((r) => r.d).sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * 0.2)];
}

/**
 * Feed one rAF delta; returns the (possibly changed) render scale.
 * Drops one step after a second of long frames; recovers to full scale after
 * `calmNeeded` calm seconds, where calm is judged against the display's own
 * refresh interval so a smooth 60 Hz plot (16.7 ms) counts as calm.
 */
export function stepAdaptiveScale(s: AdaptiveScaleState, nowMs: number, frameDeltaMs: number): number {
  const d = Math.min(frameDeltaMs, 100);
  s.frameMs += (d - s.frameMs) * 0.08;
  s.recent.push({ t: nowMs, d });
  while (s.recent.length > 1 && s.recent[0].t < nowMs - WINDOW_MS) s.recent.shift();
  if (nowMs < s.checkAt) return s.scale;
  s.checkAt = nowMs + CHECK_MS;

  const candidate = Math.min(REFRESH_MAX, Math.max(REFRESH_MIN, percentile20(s.recent)));
  s.refreshMs = candidate < s.refreshMs ? candidate : s.refreshMs + (candidate - s.refreshMs) * REFRESH_RISE;

  const dropAbove = Math.max(DROP_MS, DROP_RATIO * s.refreshMs);
  if (s.frameMs > dropAbove && s.scale > SCALE_MIN) {
    s.scale = Math.max(SCALE_MIN, s.scale * STEP);
    s.calmChecks = 0;
    if (nowMs - s.lastUpgradeAt < QUICK_DROP_MS) {
      s.calmNeeded = Math.min(MAX_CALM_CHECKS, s.calmNeeded * 2);
      s.lastUpgradeAt = -Infinity;
    }
  } else if (s.frameMs <= s.refreshMs * CALM_RATIO && s.scale < 1) {
    if (++s.calmChecks >= s.calmNeeded) {
      s.scale = 1;
      s.calmChecks = 0;
      s.lastUpgradeAt = nowMs;
    }
  } else {
    s.calmChecks = 0;
  }
  if (s.scale === 1 && nowMs - s.lastUpgradeAt >= QUICK_DROP_MS) s.calmNeeded = BASE_CALM_CHECKS;
  return s.scale;
}
