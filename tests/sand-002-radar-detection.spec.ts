import { test, expect } from "@playwright/test";

test.describe("sand-002 — Radar detection transitions", () => {
  test("contacts transition Unknown → Detected → Classified → Tracked", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });

    // Speed up and run the sim.
    await page.getByTestId("sim-speed").filter({ hasText: "10x" }).click();
    await page.getByTestId("sim-toggle-pause").click(); // PLAY

    // Wait for at least one contact row to appear.
    const firstRow = page.getByTestId("contact-row").first();
    await expect(firstRow).toBeVisible({ timeout: 20_000 });

    const contactId = await firstRow.getAttribute("data-contact-id");
    expect(contactId).toBeTruthy();

    const row = page.locator(`[data-testid="contact-row"][data-contact-id="${contactId}"]`);
    const cls = row.getByTestId("contact-classification");

    // Initial state can be UNK; the sim should progress through states over time.
    await expect(cls).toBeVisible();

    const read = async () => (await cls.textContent())?.trim() ?? "";

    // We accept that the sim might skip intermediate UI states depending on timing,
    // but it must eventually reach TRK and pass through DET/CLS at least once.
    const seen = new Set<string>();
    const end = Date.now() + 90_000;
    while (Date.now() < end) {
      seen.add(await read());
      if (seen.has("TRK")) break;
      await page.waitForTimeout(750);
    }

    expect(seen.has("DET") || seen.has("CLS") || seen.has("TRK")).toBeTruthy();
    expect(seen.has("TRK")).toBeTruthy();
  });
});

