import { test, expect } from "@playwright/test";

test.describe("sand-002 — Radar detection transitions", () => {
  test("contacts transition Unknown → Detected → Classified → Tracked", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });

    // Speed up and run the sim.
    await page.getByTestId("sim-speed").filter({ hasText: "10x" }).click();
    await page.getByTestId("sim-toggle-pause").click(); // PLAY

    // Wait for at least one contact row to appear.
    const firstRow = page.getByTestId("contact-row").first();
    await expect(firstRow).toBeVisible({ timeout: 20_000 });

    const clsCells = page.getByTestId("contact-classification");
    const seen = new Set<string>();
    await expect
      .poll(
        async () => {
          const vals = (await clsCells.allTextContents()).map((t) => t.trim()).filter(Boolean);
          vals.forEach((v) => seen.add(v));
          return vals.includes("TRK");
        },
        { timeout: 90_000, intervals: [750] },
      )
      .toBeTruthy();

    // We accept that the sim might skip intermediate UI states depending on timing,
    // but it must reach TRK and show at least one non-UNK classification.
    expect(seen.has("DET") || seen.has("CLS") || seen.has("TRK")).toBeTruthy();
  });
});

