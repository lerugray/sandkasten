// SAND-TITLE-1 frame tool. Shoots the title, the menu (selection moved) and the ABOUT panel at
// 1400x730 and 1280x720, headless Chromium. It is a capture tool, not a pass/fail gate: run it
// with SAND_TITLE_FRAMES=1 and the ordinary battery leaves the committed frames alone.
//
//   SAND_TITLE_FRAMES=1 npx playwright test tests/sand-title-1-frames.spec.ts --workers=1
import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const ROOT = path.join(process.cwd(), "docs", "verification", "sand-title-1-s467");
const SIZES = [
  { width: 1400, height: 730 },
  { width: 1280, height: 720 },
];

test.skip(!process.env.SAND_TITLE_FRAMES, "capture tool: set SAND_TITLE_FRAMES=1 to shoot the frames");

async function shoot(page: Page, name: string) {
  const vp = page.viewportSize()!;
  const manifest: Record<string, unknown> = {};
  for (const s of SIZES) {
    await page.setViewportSize(s);
    await page.waitForTimeout(400);
    const file = `${s.width}x${s.height}-${name}.png`;
    const buf = await page.screenshot({ path: path.join(ROOT, file) });
    manifest[file] = { sha256: createHash("sha256").update(buf).digest("hex"), bytes: buf.length, viewport: `${s.width}x${s.height}` };
  }
  await page.setViewportSize(vp);
  return manifest;
}

test("title, menu and about frames", async ({ page }) => {
  mkdirSync(ROOT, { recursive: true });
  const manifest: Record<string, unknown> = {};

  await page.goto("/");
  await expect(page.getByTestId("title-root")).toBeVisible();
  await page.waitForTimeout(1200); // let the type-on finish
  manifest.title = await shoot(page, "title");

  await page.keyboard.press("ArrowDown"); // selection on the snapshot entry
  await page.waitForTimeout(200);
  manifest.menu = await shoot(page, "menu");

  await page.keyboard.press("a"); // ABOUT panel
  await expect(page.getByTestId("title-about")).toBeVisible();
  await page.waitForTimeout(300);
  manifest.about = await shoot(page, "about");

  writeFileSync(path.join(ROOT, "frames.json"), JSON.stringify(manifest, null, 2));
});
