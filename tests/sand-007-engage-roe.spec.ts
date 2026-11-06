import { test, expect, type Page } from "@playwright/test";

const US_LAUNCH = /(Hornet \d+|USS \w+)[^]*? launched/i;

async function openPlay(page: Page) {
  await page.goto("/play");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });
  await page.getByLabel("Autopause settings").click();
  const toggle = page.getByTestId("autopause-toggle-enabled");
  if (((await toggle.textContent()) ?? "").trim() === "ON") await toggle.click();
  await page.getByLabel("Autopause settings").click();
}

async function usLaunches(page: Page) {
  const texts = await page.locator('[data-testid="combat-log-entry"][data-event-type="launch"]').allTextContents();
  return texts.filter((t) => US_LAUNCH.test(t));
}

test.describe("sand-007 — player ENGAGE order and ROE", () => {
  test("the US fires at an Iranian contact through the order panel", async ({ page }) => {
    test.setTimeout(120_000);
    await openPlay(page);

    await page.getByTestId("sim-speed").filter({ hasText: "10x" }).click();
    await page.getByTestId("sim-toggle-pause").click(); // PLAY
    await expect(page.getByTestId("contact-row").first()).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("sim-toggle-pause").click(); // HOLD

    // The ROE default is TIGHT
    await page.getByTestId("force-row").filter({ hasText: "Hornet 101" }).click();
    await expect(page.getByTestId("order-fire-controls")).toBeVisible();
    await expect(page.locator('[data-testid="order-roe"][data-roe="weapons-tight"]')).toHaveAttribute("aria-pressed", "true");

    // Try the shooters and contacts the panel offers until one order is accepted
    const shooters = ["Hornet 101", "Hornet 102", "USS Cole", "USS Mahan", "USS Chosin", "USS Nitze"];
    let accepted = false;
    for (const name of shooters) {
      await page.getByTestId("force-row").filter({ hasText: name }).click();
      const select = page.getByTestId("order-engage-contact");
      if (!(await select.isVisible())) continue;
      const options = await select.locator("option").count();
      for (let i = 1; i < options && !accepted; i++) {
        await select.selectOption({ index: i });
        await page.getByTestId("order-engage").click();
        accepted = (await page.getByTestId("order-engage-feedback").getAttribute("data-ok")) === "true";
      }
      if (accepted) break;
    }
    expect(accepted).toBe(true);
    await expect(page.getByTestId("order-engage-feedback")).toContainText(/launched/i);

    await page.getByTestId("sidebar-tab-combat").click();
    await expect.poll(async () => (await usLaunches(page)).length, { timeout: 10_000 }).toBeGreaterThan(0);
  });

  test("a unit with no weapons gets no ENGAGE control", async ({ page }) => {
    test.setTimeout(60_000);
    await openPlay(page);
    await page.getByTestId("sim-speed").filter({ hasText: "10x" }).click();
    await page.getByTestId("sim-toggle-pause").click();
    await expect(page.getByTestId("contact-row").first()).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("sim-toggle-pause").click();

    // The Hawkeye carries no weapons
    await page.getByTestId("force-row").filter({ hasText: "Hawkeye" }).click();
    await expect(page.getByTestId("order-fire-controls")).toBeVisible();
    await expect(page.getByTestId("order-engage")).toHaveCount(0);
  });

  test("ROE keys and buttons change the selected unit's rules", async ({ page }) => {
    await openPlay(page);
    await page.getByTestId("force-row").filter({ hasText: "USS Cole" }).click();
    const pressed = (roe: string) =>
      expect(page.locator(`[data-testid="order-roe"][data-roe="${roe}"]`)).toHaveAttribute("aria-pressed", "true");
    await pressed("weapons-tight");
    await page.keyboard.press("f");
    await pressed("weapons-free");
    await page.keyboard.press("x");
    await pressed("weapons-hold");
    await page.keyboard.press("r");
    await pressed("weapons-tight");
    await page.getByTestId("cmd-roe").click();
    await pressed("weapons-free");
    await page.getByTestId("cmd-roe").click();
    await pressed("weapons-hold");
    await page.getByTestId("cmd-roe").click();
    await pressed("weapons-tight");
    // ROE is per unit
    await page.getByTestId("force-row").filter({ hasText: "USS Mahan" }).click();
    await pressed("weapons-tight");
  });

  test("under the default TIGHT ROE a unit under attack fires back on its own", async ({ page }) => {
    test.setTimeout(180_000);
    await openPlay(page);
    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await page.getByTestId("sim-toggle-pause").click();
    await page.getByTestId("sidebar-tab-combat").click();
    await expect.poll(async () => (await usLaunches(page)).length, { timeout: 150_000 }).toBeGreaterThan(0);
  });
});
