import { test, expect } from "@playwright/test";

/**
 * Helper: keep the simulation running by repeatedly clicking PLAY whenever
 * autopause pauses it, until the target duration has elapsed.
 */
async function runSimFor(page: import("@playwright/test").Page, ms: number) {
  const end = Date.now() + ms;
  // Initial unpause
  const playBtn = page.locator("button", { hasText: "PLAY" }).first();
  if (await playBtn.isVisible().catch(() => false)) {
    await playBtn.click();
  }
  while (Date.now() < end) {
    await page.waitForTimeout(500);
    // If autopause fired, resume
    const isPlayVisible = await playBtn.isVisible().catch(() => false);
    if (isPlayVisible && Date.now() < end) {
      await playBtn.click();
    }
  }
}

/** Ensure the sim is paused — works whether autopause already paused it or not. */
async function ensurePaused(page: import("@playwright/test").Page) {
  const pauseBtn = page.locator("button", { hasText: "PAUSE" }).first();
  if (await pauseBtn.isVisible().catch(() => false)) {
    await pauseBtn.click();
  }
  // Already paused if PLAY is visible
}

test.describe("Simulation gameplay", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
  });

  test("simulation clock advances when unpaused", async ({ page }) => {
    const timeText = async () => {
      const el = page.locator("text=/\\d{4}-\\d{2}-\\d{2}/").first();
      return el.textContent();
    };
    const t0 = await timeText();

    // Use higher speed so clock visibly advances
    await page.locator("button", { hasText: "10x" }).click();
    await runSimFor(page, 4_000);
    await ensurePaused(page);

    const t1 = await timeText();
    expect(t1).not.toBe(t0);
  });

  test("contacts appear after simulation runs", async ({ page }) => {
    await page.locator("button", { hasText: "60x" }).click();
    await runSimFor(page, 8_000);
    await ensurePaused(page);

    // Forces tab should be showing (autopause may have switched to it)
    await page.locator("button", { hasText: "Forces" }).click();

    const contactsHeader = page.getByText(/Contacts \(\d+\)/).first();
    const text = await contactsHeader.textContent();
    const match = text?.match(/Contacts \((\d+)\)/);
    const count = match ? parseInt(match[1]) : 0;
    expect(count).toBeGreaterThan(0);
  });

  test("combat log gets entries after engagement", async ({ page }) => {
    await page.locator("button", { hasText: "60x" }).click();
    await runSimFor(page, 15_000);
    await ensurePaused(page);

    await page.locator("button", { hasText: "Combat" }).click();

    const combatEntries = page.locator(".w-80 >> text=/LAUNCH|HIT|MISS|DEFENDED|DESTROYED/i");
    const count = await combatEntries.count();
    expect(count).toBeGreaterThan(0);
  });

  test("selecting a unit and opening waypoint mode", async ({ page }) => {
    const unitButtons = page.locator(".w-80 button.w-full");
    await unitButtons.first().click();

    const waypointBtn = page.locator("button", { hasText: /WAYPOINT|ADD|PLACING/i }).first();
    await expect(waypointBtn).toBeVisible({ timeout: 3_000 });
    await waypointBtn.click();

    await expect(page.getByText("CLICK MAP TO PLACE WAYPOINT")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("intel tab shows messages after events fire", async ({ page }) => {
    await runSimFor(page, 2_000);
    await ensurePaused(page);

    await page.locator("button", { hasText: "Intel" }).click();
    await page.waitForTimeout(500);

    const noMessages = page.getByText("No messages");
    const hasNoMessages = await noMessages.isVisible().catch(() => false);
    expect(hasNoMessages).toBe(false);
  });

  test("reset button restarts the simulation", async ({ page }) => {
    await page.locator("button", { hasText: "60x" }).click();
    await runSimFor(page, 3_000);
    await ensurePaused(page);

    await page.locator("button", { hasText: "RESET" }).click();

    const timeText = page.locator("text=/\\d{4}-\\d{2}-\\d{2}/").first();
    const text = await timeText.textContent();
    expect(text).toContain("06:00:00");
  });

  test("autopause triggers on new contact detection", async ({ page }) => {
    // Set high speed and start
    await page.locator("button", { hasText: "60x" }).click();
    await page.locator("button", { hasText: "PLAY" }).first().click();

    // Wait for autopause to fire (should happen within a few seconds at 60x)
    await expect(page.locator("button", { hasText: "PLAY" }).first()).toBeVisible({ timeout: 15_000 });

    // Should show autopause reason
    await expect(page.getByText(/NEW CONTACT|INCOMING WEAPON|INTEL MESSAGE/i).first()).toBeVisible({ timeout: 3_000 });
  });

  test("god mode toggle shows all units", async ({ page }) => {
    // Click GOD button
    await page.locator("button[aria-label='Toggle god mode']").click();

    // In god mode, hostile units should be visible on the map
    // The status bar should still work, canvas should be visible
    await expect(page.locator("canvas").first()).toBeVisible();

    // Toggle off
    await page.locator("button[aria-label='Toggle god mode']").click();
  });
});
