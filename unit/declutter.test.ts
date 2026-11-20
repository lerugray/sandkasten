import { describe, it, expect } from "vitest";
import { placeAll, placeNearest, rectAt, touches } from "../src/lib/map/declutter";

describe("declutter", () => {
  it("keeps a free item exactly where it wants to be", () => {
    const p = placeNearest({ x: 100, y: 100 }, 20, 20, []);
    expect(p).toEqual({ x: 100, y: 100, free: true });
  });

  it("moves an item off a blocker, to the nearest free spot", () => {
    const blocker = rectAt(100, 100, 30);
    const p = placeNearest({ x: 100, y: 100 }, 20, 20, [blocker], { gap: 2 });
    expect(p.free).toBe(true);
    expect(touches(rectAt(p.x, p.y, 20), blocker, 2)).toBe(false);
    expect(Math.hypot(p.x - 100, p.y - 100)).toBeLessThan(40);
  });

  it("placeAll leaves a pile of identical points with no two touching", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ id: `u${i}`, x: 200, y: 200, w: 30, h: 26 }));
    const out = placeAll(items, [rectAt(200, 200, 28)], { gap: 3, maxR: 130 });
    const rects = items.map((it) => rectAt(out.get(it.id)!.x, out.get(it.id)!.y, it.w, it.h));
    for (let i = 0; i < rects.length; i++) {
      expect(touches(rects[i], rectAt(200, 200, 28), 0)).toBe(false);
      for (let j = i + 1; j < rects.length; j++) expect(touches(rects[i], rects[j], 0)).toBe(false);
    }
  });

  it("stays inside the bounds when the wanted spot is inside them", () => {
    const p = placeNearest({ x: 12, y: 12 }, 20, 20, [rectAt(12, 12, 30)], { bounds: { w: 400, h: 300 } });
    expect(p.x - 10).toBeGreaterThanOrEqual(0);
    expect(p.y - 10).toBeGreaterThanOrEqual(0);
  });
});
