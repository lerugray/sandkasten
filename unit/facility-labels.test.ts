import { describe, it, expect } from "vitest";
import { shortFacilityName, FACILITY_LABEL_MAX } from "@/lib/facilities/labels";

describe("shortFacilityName", () => {
  it("abbreviates International Airport to Intl", () => {
    expect(shortFacilityName("Dubai International Airport")).toBe("Dubai Intl");
  });
  it("leaves short names alone", () => {
    expect(shortFacilityName("Oghab 44 Airbase")).toBe("Oghab 44 Airbase");
  });
  it("strips parentheticals", () => {
    expect(shortFacilityName("Kish Island (Old) Airport")).toBe("Kish Island Airport");
  });
  it("never cuts a word in half", () => {
    const names = [
      "Sheikh Zayed Bin Sultan Al Nahyan Naval Maintenance Base",
      "Abu Musa Island Airport Extended Service",
      "Bandar Abbas International Airport and Air Force Base",
    ];
    for (const n of names) {
      const out = shortFacilityName(n);
      expect(out.length).toBeLessThanOrEqual(FACILITY_LABEL_MAX);
      for (const w of out.split(" ")) expect(n.split(" ").concat(["Apt", "Intl", "Heli", "Univ", "Hosp", "Term"])).toContain(w);
    }
  });
  it("keeps a single over-long word whole", () => {
    expect(shortFacilityName("Qeshmqeshmqeshmqeshmqeshm123")).toBe("Qeshmqeshmqeshmqeshmqeshm123");
  });
});
