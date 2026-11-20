import { test, expect } from "@playwright/test";

// SAND-TITLE-1: the front door is a terminal title screen, not the play view.
// Every built-in scenario is listed with its briefing, side, length and mode,
// and each menu entry opens the right place.

const HORMUZ = "STRAIT OF HORMUZ STANDOFF";
const SNAPSHOT = "HORMUZ AIR TRAFFIC, 6 NOVEMBER 2026, 19:02 UTC";

test.describe("Title screen", () => {
  test("the title screen shows the wordmark, version and credits", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("title-root")).toBeVisible();
    await expect(page.getByTestId("title-wordmark")).toHaveText("SANDKASTEN");
    await expect(page.getByTestId("title-version")).toHaveText("v0.1.0");
    await expect(page.getByText("DESIGNED BY RAY WEISS, CONFLICT SIMULATIONS LLC")).toBeVisible();
    // it is not the play view
    await expect(page.getByTestId("terminal-root")).toHaveCount(0);
  });

  test("every built-in scenario is listed, with briefing, side, length and mode", async ({ page }) => {
    await page.goto("/");
    const entries = page.getByTestId("scenario-entry");
    await expect(entries).toHaveCount(2);

    const hormuz = entries.filter({ hasText: HORMUZ });
    await expect(hormuz).toHaveCount(1);
    await expect(hormuz).toContainText("SIDE US NAVY");
    await expect(hormuz).toContainText("LENGTH NO TIME LIMIT");
    await expect(hormuz).toContainText("MODE CONTINUOUS OR WEGO");

    const snapshot = entries.filter({ hasText: SNAPSHOT });
    await expect(snapshot).toHaveCount(1);
    await expect(snapshot).toContainText("SIDE NEUTRAL");
    await expect(snapshot).toContainText("LENGTH OPEN ENDED");
    await expect(snapshot).toContainText("MODE CONTINUOUS");
  });

  test("the menu also lists build your own, platform manual and about", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('[data-entry-id="editor"]')).toContainText("BUILD YOUR OWN");
    await expect(page.locator('[data-entry-id="database"]')).toContainText("PLATFORM MANUAL");
    await expect(page.locator('[data-entry-id="about"]')).toContainText("ABOUT");
  });
});

test.describe("Scenario menu entries", () => {
  test("Hormuz entry opens the Hormuz scenario", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-entry-id="hormuz"]').click();
    await expect(page.getByTestId("terminal-root")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(HORMUZ).first()).toBeVisible();
  });

  test("snapshot entry opens the real-world snapshot", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-entry-id="snapshot"]').click();
    await expect(page.getByTestId("terminal-root")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(SNAPSHOT).first()).toBeVisible();
  });

  test("build your own entry opens the editor", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-entry-id="editor"]').click();
    await expect(page.getByTestId("editor-play")).toBeVisible({ timeout: 30_000 });
  });

  test("platform manual entry opens the database", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-entry-id="database"]').click();
    await expect(page.getByTestId("db-root")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("PLATFORM MANUAL").first()).toBeVisible();
  });

  test("about entry opens the about panel with credits", async ({ page }) => {
    await page.goto("/");
    await page.locator('[data-entry-id="about"]').click();
    await expect(page.getByTestId("title-about")).toBeVisible();
    await expect(page.getByTestId("about-byline")).toHaveText("Designed by Ray Weiss, Conflict Simulations LLC");
    await expect(page.getByTestId("about-description")).toBeVisible();
    await expect(page.getByTestId("title-about")).toContainText("v0.1.0");
    await expect(page.getByTestId("title-about")).toContainText("adsb.lol (ODbL)");
  });
});

test.describe("Keyboard", () => {
  test("arrow keys move the selection and Enter opens", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("title-root")).toBeVisible();
    // move down to the snapshot entry, then open it
    await page.keyboard.press("ArrowDown");
    await expect(page.locator('[data-entry-id="snapshot"]')).toHaveAttribute("data-active", "true");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("terminal-root")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(SNAPSHOT).first()).toBeVisible();
  });

  test("number keys jump straight to an entry", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("2");
    await expect(page.getByTestId("terminal-root")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(SNAPSHOT).first()).toBeVisible();
  });

  test("the A key opens the about panel and Escape closes it", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("a");
    await expect(page.getByTestId("title-about")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("title-about")).toHaveCount(0);
  });
});
