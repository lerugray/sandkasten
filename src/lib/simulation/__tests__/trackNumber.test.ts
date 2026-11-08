import { describe, it, expect } from "vitest";
import { trackNumber } from "../trackNumber";
import { trackNumber as plotTrackNumber } from "@/lib/plot/TacticalPlot";

describe("shared track number", () => {
  it("is a stable four-digit number per contact id and the plot uses the same function", () => {
    for (const id of ["contact-1", "contact-2", "contact-17", "x"]) {
      expect(trackNumber(id)).toMatch(/^[1-9]\d{3}$/);
      expect(trackNumber(id)).toBe(trackNumber(id));
      expect(plotTrackNumber(id)).toBe(trackNumber(id));
    }
    expect(trackNumber("contact-1")).not.toBe(trackNumber("contact-2"));
  });
});
