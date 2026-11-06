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
