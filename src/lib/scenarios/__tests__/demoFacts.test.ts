import { describe, it, expect } from "vitest";
import { demoScenario } from "@/lib/scenarios/demo";
import { getPlatform, getAllPlatforms } from "@/lib/platforms/lookup";

const BOGHAMMAR_ID = 9004;

describe("demo scenario fact checks (2026-03-15)", () => {
  const units = demoScenario.sides.flatMap((s) => s.units);

  it("every platformId used by demo units resolves", () => {
    for (const u of units) {
      expect(getPlatform(u.platformId), `${u.id} -> ${u.platformId}`).toBeDefined();
    }
  });

  it("no unit is a decommissioned ship (Bunker Hill, Taylor)", () => {
    for (const u of units) {
      expect(u.name).not.toContain("Bunker Hill");
      expect(u.name).not.toContain("Taylor");
    }
  });

  it("Super Hornet gun is M61A2 with 412 rounds", () => {
    const gun = getPlatform(342)!.weapons!.find((w) => w.type === "gun")!;
    expect(gun.name).toContain("M61A2");
    expect(gun.quantity).toBe(412);
  });

  it("no weapon is named 76mm/50", () => {
    for (const p of getAllPlatforms()) {
      for (const w of p.weapons ?? []) {
        expect(w.name).not.toContain("76mm/50");
      }
    }
  });

  it("Boghammar profile has no anti-ship missiles and no missile defense", () => {
    const b = getPlatform(BOGHAMMAR_ID)!;
    expect(b.name).toContain("Boghammar");
    expect(b.dimension).toBe("sea");
    expect(b.missileDefense).toBeUndefined();
    expect((b.weapons ?? []).some((w) => w.type === "asm")).toBe(false);
  });

  it("platform ids are unique", () => {
    const ids = getAllPlatforms().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
