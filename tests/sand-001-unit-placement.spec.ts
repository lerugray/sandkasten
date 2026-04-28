import { test, expect } from "@playwright/test";

/**
 * Assumption: Editor unit placement works by selecting a platform in the
 * `UnitPlacer` overlay, then clicking the map once per placement.
 */

test.describe("sand-001 — Unit placement + selection (editor)", () => {
  test("place 3 units, drag one, select each and verify detail panel", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("editor-tool-place-unit").click();
    await expect(page.getByTestId("unit-placer")).toBeVisible();

    const platform = page.getByTestId("unit-placer-platform").first();
    await expect(platform).toBeVisible();

    const mapCanvas = page.locator("canvas").first();

    // Place 3 units (re-select platform each time).
    for (let i = 0; i < 3; i++) {
      await platform.click();
      await expect(page.getByTestId("unit-placer-waiting")).toBeVisible();
      await mapCanvas.click({ position: { x: 300, y: 300 + i * 20 } });
    }

    const markers = page.getByTestId("unit-marker");
    await expect(markers).toHaveCount(3, { timeout: 10_000 });

    // Select first unit and read its POS.
    await markers.nth(0).click();
    await expect(page.getByTestId("detail-panel")).toBeVisible();
    await expect(page.getByTestId("detail-platform-class")).toBeVisible();

    const pos0 = await page.getByTestId("detail-unit-pos").textContent();
    expect(pos0).toBeTruthy();

    // Drag the first unit a bit.
    const box = await markers.nth(0).boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 40);
      await page.mouse.up();
    }

    // Re-select to ensure detail panel reflects updated unit state.
    await markers.nth(0).click();
    await expect
      .poll(async () => page.getByTestId("detail-unit-pos").textContent(), {
        timeout: 10_000,
      })
      .not.toBe(pos0);

    // Click each unit to verify selection populates detail panel.
    for (let i = 0; i < 3; i++) {
      await markers.nth(i).click();
      await expect(page.getByTestId("detail-panel")).toBeVisible();
      await expect(page.getByTestId("detail-platform-class")).toBeVisible();
    }
  });
});

