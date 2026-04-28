import { test, expect } from "@playwright/test";

async function ensureChecked(checkbox: import("@playwright/test").Locator) {
  const checked = await checkbox.isChecked();
  if (!checked) await checkbox.click();
}

test.describe("sand-004 — Autopause trigger system", () => {
  test("autopauses on new contact, incoming weapon, and switches tabs", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });

    // Configure autopause triggers.
    await page.getByRole("button", { name: "Autopause settings" }).click();
    await expect(page.getByTestId("autopause-settings")).toBeVisible();

    // Ensure enabled.
    const enabledBtn = page.getByTestId("autopause-toggle-enabled");
    if ((await enabledBtn.textContent())?.trim() === "OFF") {
      await enabledBtn.click();
    }

    await ensureChecked(page.getByTestId("autopause-trigger-newContact"));
    await ensureChecked(page.getByTestId("autopause-trigger-weaponIncoming"));
    await ensureChecked(page.getByTestId("autopause-trigger-friendlyDamaged"));

    // Start sim fast.
    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await page.getByTestId("sim-toggle-pause").click(); // PLAY

    // Autopause should fire on first new contact.
    await expect(page.getByTestId("sim-toggle-pause")).toHaveText("PLAY", { timeout: 30_000 });
    await expect(page.getByTestId("autopause-reason")).toContainText("NEW CONTACT", { timeout: 5_000 });

    // Resume and wait for an incoming-weapon autopause (combat tab suggested).
    await page.getByTestId("sim-toggle-pause").click(); // resume
    await expect(page.getByTestId("sim-toggle-pause")).toHaveText("PLAY", { timeout: 120_000 });
    await expect(page.getByTestId("autopause-reason")).toContainText("INCOMING WEAPON", { timeout: 5_000 });

    // Sidebar should auto-switch to combat for incoming weapon.
    await expect(page.getByTestId("sidebar-tab-combat")).toHaveAttribute("data-active", "true");
  });
});

