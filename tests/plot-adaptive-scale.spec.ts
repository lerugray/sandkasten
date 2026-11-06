import { test, expect } from "@playwright/test";
import { createAdaptiveScale, stepAdaptiveScale } from "../src/lib/plot/adaptiveScale";

// Pure logic at synthetic frame cadence: no browser, no page.

interface Run {
  s: ReturnType<typeof createAdaptiveScale>;
  t: number;
  scale: number;
  changes: { t: number; from: number; to: number }[];
}

function newRun(): Run {
  return { s: createAdaptiveScale(), t: 0, scale: 1, changes: [] };
}

function feed(r: Run, deltaMs: number, seconds: number) {
  const end = r.t + seconds * 1000;
  while (r.t < end) {
    r.t += deltaMs;
    const next = stepAdaptiveScale(r.s, r.t, deltaMs);
    if (next !== r.scale) r.changes.push({ t: r.t, from: r.scale, to: next });
    r.scale = next;
  }
}

for (const [label, hz] of [["60 Hz", 1000 / 60], ["120 Hz", 1000 / 120]] as const) {
  test.describe(label, () => {
    test("clean cadence keeps full scale", () => {
      const r = newRun();
      feed(r, hz, 10);
      expect(r.scale).toBe(1);
    });

    test("sustained slow frames drop the scale, smooth frames bring it back", () => {
      const r = newRun();
      feed(r, hz, 3);
      feed(r, 30, 5);
      expect(r.scale).toBeLessThanOrEqual(0.6);
      feed(r, hz, 10);
      expect(r.scale).toBe(1);
    });
  });
}

test("a steady 16.7 ms plot never changes scale", () => {
  const r = newRun();
  feed(r, 16.7, 120);
  expect(r.changes).toEqual([]);
});

test("a scene that cannot hold full scale settles instead of flip-flopping", () => {
  const r = newRun();
  feed(r, 16.67, 3);
  feed(r, 30, 5);
  feed(r, 16.67, 10);
  expect(r.scale).toBe(1);
  r.changes.length = 0;
  feed(r, 25, 60);
  const ups = r.changes.filter((c) => c.to > c.from);
  expect(ups.length).toBeLessThanOrEqual(3);
  for (let i = 1; i < ups.length; i++) expect(ups[i].t - ups[i - 1].t).toBeGreaterThanOrEqual(10_000);
  expect(r.changes.filter((c) => c.t > r.t - 5_000)).toEqual([]);
});

test("sustained 25 ms load keeps the scale dropped for the whole run", () => {
  const r = newRun();
  feed(r, 16.67, 3);
  feed(r, 25, 60);
  const ups = r.changes.filter((c) => c.to > c.from);
  expect(ups.length).toBeLessThanOrEqual(3);
  for (let t = 0; t < 30; t++) {
    feed(r, 25, 1);
    expect(r.scale).toBeLessThan(1);
  }
  expect(r.scale).toBeLessThanOrEqual(0.6);
});

function startup(first: number[], hz: number) {
  const r = newRun();
  for (const d of first) {
    r.t += d;
    r.scale = stepAdaptiveScale(r.s, r.t, d);
  }
  feed(r, hz, 3);
  feed(r, 30, 5);
  return r;
}

test("startup: a 4 ms first delta then 60 Hz does not slow recovery (Dot's repro)", () => {
  const r = startup([4], 1000 / 60);
  expect(r.scale).toBeLessThanOrEqual(0.6);
  feed(r, 1000 / 60, 10);
  expect(r.scale).toBe(1);
});

test("startup: a burst of tiny partial deltas then 60 Hz still recovers within 10 s", () => {
  const r = startup([1, 2, 2, 3, 1, 2, 4, 3], 1000 / 60);
  feed(r, 1000 / 60, 10);
  expect(r.scale).toBe(1);
});

test("startup: a 1 ms first delta then 120 Hz still recovers within 10 s", () => {
  const r = startup([1], 1000 / 120);
  feed(r, 1000 / 120, 10);
  expect(r.scale).toBe(1);
});

test("startup: a huge first delta then clean 60 Hz never drops", () => {
  const r = newRun();
  r.t += 100;
  r.scale = stepAdaptiveScale(r.s, r.t, 100);
  feed(r, 1000 / 60, 20);
  expect(r.changes).toEqual([]);
  expect(r.scale).toBe(1);
});
