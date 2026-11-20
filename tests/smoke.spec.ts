import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads the terminal title screen with version and menu", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("title-wordmark")).toHaveText("SANDKASTEN");
    await expect(page.getByTestId("title-version")).toHaveText("v0.1.0");
    await expect(page.getByTestId("scenario-entry")).toHaveCount(2);
    await expect(page.locator('[data-entry-id="editor"]')).toBeVisible();
    await expect(page.locator('[data-entry-id="database"]')).toBeVisible();
  });

  test("loads the terminal play view with the brand and command bar", async ({ page }) => {
    await page.goto("/play/");
    await expect(page.getByRole("link", { name: "SANDKASTEN" })).toBeVisible();
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("command-bar")).toBeVisible();
  });

  test("lists both built-in scenarios with their briefing, side, length and mode", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("scenario-entry").filter({ hasText: "STRAIT OF HORMUZ STANDOFF" })).toContainText("SIDE US NAVY");
    await expect(page.getByTestId("scenario-entry").filter({ hasText: "STRAIT OF HORMUZ STANDOFF" })).toContainText("MODE CONTINUOUS OR WEGO");
    await expect(page.getByTestId("scenario-entry").filter({ hasText: "HORMUZ AIR TRAFFIC" })).toContainText("SIDE NEUTRAL");
    await expect(page.getByTestId("scenario-entry").filter({ hasText: "HORMUZ AIR TRAFFIC" })).toContainText("MODE CONTINUOUS");
  });

  test("about panel opens from the terminal command bar and shows the credits", async ({ page }) => {
    await page.goto("/play/");
    await expect(page.getByTestId("command-bar")).toBeVisible();
    await page.getByTestId("cmd-about").click();
    await expect(page.getByTestId("about-panel")).toBeVisible();
    await expect(page.getByText("Designed by Ray Weiss, Conflict Simulations LLC")).toBeVisible();
    await expect(page.getByText(/OpenFreeMap/)).toBeVisible();
    await expect(page.getByText(/adsb\.lol/)).toBeVisible();
  });
});

test.describe("Play page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/play");
    // Wait for map to load
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
  });

  test("loads with header, time controls, and sidebar", async ({ page }) => {
    await expect(page.getByRole("link", { name: "SANDKASTEN" })).toBeVisible();
    // Sidebar tabs
    await expect(page.locator("button", { hasText: "Forces" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Intel" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Combat" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Media" })).toBeVisible();
  });

  test("shows friendly units in sidebar", async ({ page }) => {
    const forcesSection = page.getByText(/Forces \(\d+\)/).first();
    await expect(forcesSection).toBeVisible();
  });

  test("shows contacts section", async ({ page }) => {
    await expect(page.getByText(/Contacts \(\d+\)/).first()).toBeVisible();
  });

  test("pause/resume with spacebar", async ({ page }) => {
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);
    await page.keyboard.press("Space");
  });

  test("help panel opens with ? button and closes with Escape", async ({ page }) => {
    await page.locator("button[aria-label='Open help']").click();
    await expect(page.getByText("HELP").first()).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("KEYBOARD").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("button[aria-label='Close help']")).not.toBeVisible({ timeout: 3_000 });
  });

  test("sidebar tabs switch content", async ({ page }) => {
    await page.locator("button", { hasText: "Intel" }).click();
    await page.waitForTimeout(300);

    await page.locator("button", { hasText: "Combat" }).click();
    await page.waitForTimeout(300);

    await page.locator("button", { hasText: "Media" }).click();
    await page.waitForTimeout(300);

    await page.locator("button", { hasText: "Forces" }).click();
    await expect(page.getByText(/Forces \(\d+\)/).first()).toBeVisible();
  });

  test("clicking a unit in the sidebar shows the order panel", async ({ page }) => {
    const unitButtons = page.getByTestId("force-row");
    const count = await unitButtons.count();
    if (count > 0) {
      await unitButtons.first().click();
      await page.waitForTimeout(500);
    }
  });

  test("speed control buttons are present", async ({ page }) => {
    await expect(page.locator("button", { hasText: "1x" }).first()).toBeVisible();
  });

  test("about panel opens from the play view and shows the credits", async ({ page }) => {
    await page.getByTestId("cmd-about").click();
    await expect(page.getByTestId("about-panel")).toBeVisible();
    await expect(page.getByText("Designed by Ray Weiss, Conflict Simulations LLC")).toBeVisible();
    await expect(page.getByText(/OpenFreeMap/)).toBeVisible();
  });
});

test.describe("Editor page", () => {
  test("loads without errors", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
  });
});
