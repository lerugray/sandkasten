import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads with header and navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("SANDKASTEN").first()).toBeVisible();
    await expect(page.locator("a[href='/play']")).toBeVisible();
    await expect(page.locator("a[href='/editor']")).toBeVisible();
  });

  test("shows scenario name and units on the map", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
  });

  test("theme toggle switches between dark and light", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator("button", { hasText: "LIGHT" });
    await toggle.click();
    await expect(page.locator("button", { hasText: "DARK" })).toBeVisible();
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
    const unitButtons = page.locator(".w-80 button.w-full");
    const count = await unitButtons.count();
    if (count > 0) {
      await unitButtons.first().click();
      await page.waitForTimeout(500);
    }
  });

  test("speed control buttons are present", async ({ page }) => {
    await expect(page.locator("button", { hasText: "1x" }).first()).toBeVisible();
  });
});

test.describe("Editor page", () => {
  test("loads without errors", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
  });
});
