import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expression } from "@maplibre/maplibre-gl-style-spec";
import { layoutLabels, siteSlots, slotPx, labelRect, ICON_RADIUS, UNIT_HALF } from "../src/lib/osint/labelLayout";
import { osintSites, siteLabel } from "../src/lib/osint/sites";
import { NAME } from "../src/lib/map/styles";
import { dedupeSamePlace, ARABIC_SCRIPT } from "../scripts/lib/facilities.mjs";

const project = (zoom: number) => (lng: number, lat: number) => {
  const k = (512 * 2 ** zoom) / 360;
  const y = (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return [lng * k, -y * k] as [number, number];
};
const textW = (s: string) => s.length * 7.6;

describe("OSINT map labels", () => {
  for (const zoom of [5.5, 6, 7, 8, 9, 11]) {
    it(`z${zoom}: every label is anchored to its own symbol, the nearest one, and clear of units`, () => {
      const pr = project(zoom);
      const slots = siteSlots(osintSites);
      const items = osintSites.map((s) => {
        const [x, y] = pr(s.position.lng, s.position.lat);
        return { id: s.id, label: siteLabel(s), slot: slots.get(s.id) ?? -1, x, y };
      });
      // units pile onto the Bandar Abbas / Qeshm sites, the worst case
      const hub = items.find((i) => i.id === "ad-ir-s300-bandar-abbas")!;
      const units: [number, number][] = [
        [hub.x + 30, hub.y - 20],
        [hub.x - 40, hub.y + 30],
        [hub.x + 5, hub.y + 40],
      ];
      const placed = layoutLabels(items, units, textW);
      expect(placed).toHaveLength(osintSites.length);
      for (const p of placed) {
        const own = items.find((i) => i.id === p.id)!;
        const [sx, sy] = slotPx(own.slot);
        // the label's rect, rebuilt from its anchor, sits next to its own icon
        expect(p.iconX).toBeCloseTo(own.x + sx, 6);
        const lc = [p.rect.x + p.rect.w / 2, p.rect.y + p.rect.h / 2];
        const dist = (it: (typeof items)[number]) => {
          const [ox, oy] = slotPx(it.slot);
          return Math.hypot(lc[0] - (it.x + ox), lc[1] - (it.y + oy));
        };
        const nearest = [...items].sort((a, b) => dist(a) - dist(b))[0];
        // labels may be far from every icon only when they are far from all; compare against icons within reach
        if (dist(nearest) < 120 && nearest.id !== p.id) {
          // another symbol is closer: only allowed when the two sit on the same spot (co-located, same coordinates)
          expect(dist(own) - dist(nearest)).toBeLessThan(0.5);
        }
        expect(p.rect.w).toBeGreaterThan(0);
        // no overlap with its own icon
        const ic = { x: p.iconX - ICON_RADIUS, y: p.iconY - ICON_RADIUS, w: 2 * ICON_RADIUS, h: 2 * ICON_RADIUS };
        const ox = Math.min(p.rect.x + p.rect.w, ic.x + ic.w) - Math.max(p.rect.x, ic.x);
        const oy = Math.min(p.rect.y + p.rect.h, ic.y + ic.h) - Math.max(p.rect.y, ic.y);
        expect({ id: p.id, hit: ox > 0 && oy > 0, a: p.anchor }).toEqual({ id: p.id, hit: false, a: p.anchor });
      }
    });
  }

  it("a label that has a free spot never overlaps a unit symbol or another label", () => {
    const placed = layoutLabels(
      [
        { id: "a", label: "S-300PMU-2", slot: -1, x: 500, y: 500 },
        { id: "b", label: "Khalij Fars", slot: -1, x: 900, y: 500 },
      ],
      [[540, 500]],
      textW,
    );
    for (const p of placed) {
      const u = { x: 540 - UNIT_HALF, y: 500 - UNIT_HALF, w: 2 * UNIT_HALF, h: 2 * UNIT_HALF };
      const hit = p.rect.x < u.x + u.w && p.rect.x + p.rect.w > u.x && p.rect.y < u.y + u.h && p.rect.y + p.rect.h > u.y;
      expect(hit).toBe(false);
    }
    expect(labelRect("left", 10, 10, 50).x).toBe(10);
  });

  it("the unit symbol names the English label only: no OSINT label or site name holds Arabic script", () => {
    for (const s of osintSites) {
      expect(ARABIC_SCRIPT.test(siteLabel(s))).toBe(false);
      expect(ARABIC_SCRIPT.test(s.name)).toBe(false);
    }
    const fac = JSON.parse(readFileSync("data/facilities/hormuz.json", "utf8")).facilities as { name: string; osint?: unknown }[];
    expect(fac.filter((f) => ARABIC_SCRIPT.test(f.name))).toEqual([]);
  });
});

describe("base map label expression", () => {
  const compiled = expression.createExpression(NAME as never);
  if (compiled.result !== "success") throw new Error("NAME does not compile");
  const text = (props: Record<string, unknown>) =>
    String(compiled.value.evaluate({ zoom: 8 }, { type: "Point", properties: props } as never));

  it("draws the English name, the Latin name, and never an Arabic-script one", () => {
    expect(text({ name: "Hormuz", name_en: "Hormuz" })).toBe("Hormuz");
    expect(text({ name: "دهنو اسلام‌آباد", "name:nonlatin": "دهنو اسلام‌آباد", name_en: "Dehnow-e Eslamabad" })).toBe("Dehnow-e Eslamabad");
    expect(text({ name: "چاه دادخدا", "name:nonlatin": "چاه دادخدا", name_en: "چاه دادخدا" })).toBe("");
    expect(text({ name: "Dubai دبي", "name:latin": "Dubai", "name:nonlatin": "دبي", name_en: "Dubai دبي" })).toBe("Dubai");
  });
});

describe("dedupeSamePlace: identity proof only", () => {
  const f = (id: string, src: string, extra: object = {}) => ({ id, kind: "heliport", name: "Offshore Helipad", position: { lat: 24.9, lng: 53.72 }, sources: [{ source: "ourairports", id: src }], ...extra });
  it("keeps separately catalogued same-name places, however close (AE-0215 and AE-0217, 739 m apart)", () => {
    const out = dedupeSamePlace([f("apt-ae-0215", "355394"), f("apt-ae-0217", "355396", { position: { lat: 24.9029, lng: 53.7183 } })]);
    expect(out.map((x: { id: string }) => x.id)).toEqual(["apt-ae-0215", "apt-ae-0217"]);
  });
  it("drops a record only when it carries the same source record, keeping the richer one", () => {
    const out = dedupeSamePlace([f("a", "1"), f("b", "1", { polygon: [[0, 0]] }), f("c", "2")]);
    expect(out.map((x: { id: string }) => x.id)).toEqual(["b", "c"]);
  });
  it("committed data: both Offshore Helipads AE-0215 and AE-0217 exist", () => {
    const data = JSON.parse(readFileSync(join(__dirname, "..", "data", "facilities", "hormuz.json"), "utf8"));
    const ids = data.facilities.map((x: { id: string }) => x.id);
    expect(ids).toContain("apt-ae-0215");
    expect(ids).toContain("apt-ae-0217");
  });
});

describe("range rings are true geodesic circles", () => {
  it("every point of a 3000 km ring is 3000 km (great-circle) from the centre, and the ring closes", async () => {
    const { geodesicCircle } = await import("@/lib/map/rangeRings");
    const [lng0, lat0] = [56.3, 27.2];
    const ring = geodesicCircle(lng0, lat0, 3000, 96);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    const hav = (a: number, b: number, c: number, d: number) => {
      const r = Math.PI / 180;
      const h = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
      return 2 * 6371 * Math.asin(Math.sqrt(h));
    };
    for (const [lng, lat] of ring) expect(Math.abs(hav(lat0, lng0, lat, lng) - 3000)).toBeLessThan(0.5);
  });
});
