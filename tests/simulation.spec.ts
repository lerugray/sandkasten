import { test, expect } from "@playwright/test";

test.describe("Simulation gameplay", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
  });

  test("simulation clock advances when unpaused", async ({ page }) => {
    // Grab initial time display
    const timeText = async () => {
      const el = page.locator("text=/\\d{4}-\\d{2}-\\d{2}/").first();
      return el.textContent();
    };
    const t0 = await timeText();

    // Unpause (click PLAY button)
    await page.locator("button", { hasText: "PLAY" }).first().click();

    // Wait for sim to advance
    await page.waitForTimeout(3_000);

    const t1 = await timeText();
    expect(t1).not.toBe(t0);
  });

  test("contacts appear after simulation runs", async ({ page }) => {
    // Set high speed
    await page.locator("button", { hasText: "60x" }).click();

    // Unpause
    await page.locator("button", { hasText: "PLAY" }).first().click();

    // Wait for detection to happen (at 60x, a few seconds of real time = minutes of sim time)
    await page.waitForTimeout(8_000);

    // Pause to check state
    await page.locator("button", { hasText: "PAUSE" }).first().click();

    // Check contacts count increased from 0
    const contactsHeader = page.getByText(/Contacts \(\d+\)/).first();
    const text = await contactsHeader.textContent();
    // Extract number — should be > 0 after detection happens
    const match = text?.match(/Contacts \((\d+)\)/);
    const count = match ? parseInt(match[1]) : 0;
    expect(count).toBeGreaterThan(0);
  });

  test("combat log gets entries after engagement", async ({ page }) => {
    // Set max speed and unpause
    await page.locator("button", { hasText: "60x" }).click();
    await page.locator("button", { hasText: "PLAY" }).first().click();

    // Wait for combat to happen (at 60x, need enough real time for units to close and engage)
    await page.waitForTimeout(15_000);

    // Pause
    await page.locator("button", { hasText: "PAUSE" }).first().click();

    // Switch to combat tab
    await page.locator("button", { hasText: "Combat" }).click();

    // Check for any combat log entries (launch, hit, miss, defended, destroyed)
    const combatEntries = page.locator(".w-80 >> text=/LAUNCH|HIT|MISS|DEFENDED|DESTROYED/i");
    const count = await combatEntries.count();
    expect(count).toBeGreaterThan(0);
  });

  test("selecting a unit and opening waypoint mode", async ({ page }) => {
    // Click first unit in sidebar
    const unitButtons = page.locator(".w-80 button.w-full");
    await unitButtons.first().click();

    // Look for the waypoint/navigation button in the order panel
    const waypointBtn = page.locator("button", { hasText: /WAYPOINT|ADD|PLACING/i }).first();
    await expect(waypointBtn).toBeVisible({ timeout: 3_000 });

    // Click it to enter waypoint mode
    await waypointBtn.click();

    // Should show the waypoint placement indicator
    await expect(page.getByText("CLICK MAP TO PLACE WAYPOINT")).toBeVisible();

    // Press Escape to exit waypoint mode
    await page.keyboard.press("Escape");
  });

  test("intel tab shows messages after events fire", async ({ page }) => {
    // Unpause so the ScenarioLoaded event fires and generates messages
    await page.locator("button", { hasText: "PLAY" }).first().click();
    await page.waitForTimeout(2_000);
    await page.locator("button", { hasText: "PAUSE" }).first().click();

    // Switch to Intel tab
    await page.locator("button", { hasText: "Intel" }).click();
    await page.waitForTimeout(500);

    // Should NOT show "No messages" — the briefing should have appeared
    const noMessages = page.getByText("No messages");
    const hasNoMessages = await noMessages.isVisible().catch(() => false);
    // If there are messages, the "No messages" text should be gone
    // If still no messages, the event system might need more time — that's a real finding
    expect(hasNoMessages).toBe(false);
  });

  test("reset button restarts the simulation", async ({ page }) => {
    // Unpause and let it run briefly
    await page.locator("button", { hasText: "60x" }).click();
    await page.locator("button", { hasText: "PLAY" }).first().click();
    await page.waitForTimeout(3_000);
    await page.locator("button", { hasText: "PAUSE" }).first().click();

    // Click RESET
    await page.locator("button", { hasText: "RESET" }).click();

    // Time should reset back to start time
    const timeText = page.locator("text=/\\d{4}-\\d{2}-\\d{2}/").first();
    const text = await timeText.textContent();
    expect(text).toContain("06:00:00");
  });
});
