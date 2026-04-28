import { test, expect } from "@playwright/test";

async function getMapHandles(page: import("@playwright/test").Page) {
  return await page.evaluate(() => {
    const mapEl = document.querySelector(".maplibregl-map") as any;
    const map = mapEl?.__maplibreMap;
    if (!map) return { hasMap: false };
    const weaponSource = map.getSource("weapon-tracks");
    return {
      hasMap: true,
      hasWeaponSource: !!weaponSource,
    };
  });
}

test.describe("sand-003 — Combat launch + impact", () => {
  test("weapon tracks appear, WIF count updates, combat log shows impacts", async ({ page }) => {
    await page.goto("/play");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });

    // Run fast to reach engagement.
    await page.getByTestId("sim-speed").filter({ hasText: "60x" }).click();
    await page.getByTestId("sim-toggle-pause").click(); // PLAY

    // Wait for weapon track source to be created and populated.
    await expect
      .poll(async () => getMapHandles(page), { timeout: 90_000 })
      .toMatchObject({ hasMap: true, hasWeaponSource: true });

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const mapEl = document.querySelector(".maplibregl-map") as any;
            const map = mapEl?.__maplibreMap;
            const src = map?.getSource("weapon-tracks") as any;
            const data = src?._data;
            const features = data?.features ?? [];
            const hasFriendlyLine = features.some((f: any) => f.properties?.type === "line" && !!f.properties?.friendly);
            const hasHostileLine = features.some((f: any) => f.properties?.type === "line" && !f.properties?.friendly);
            return { featureCount: features.length, hasFriendlyLine, hasHostileLine };
          }),
        { timeout: 120_000 }
      )
      .toMatchObject({ hasFriendlyLine: true, hasHostileLine: true });

    // Weapons-in-flight UI count updates.
    await page.getByTestId("sidebar-tab-combat").click();
    await expect(page.getByTestId("weapons-in-flight-count")).toBeVisible({ timeout: 20_000 });

    // Impact / damage events should eventually appear in combat log.
    const combatLog = page.getByTestId("combat-log");
    await expect(combatLog).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(
        async () => {
          const hit = await page.locator(`[data-testid="combat-log-entry"][data-event-type="hit"]`).count();
          const damaged = await page.locator(`[data-testid="combat-log-entry"][data-event-type="damaged"]`).count();
          const destroyed = await page.locator(`[data-testid="combat-log-entry"][data-event-type="destroyed"]`).count();
          return hit + damaged + destroyed > 0;
        },
        { timeout: 120_000 }
      )
      .toBe(true);
  });
});

