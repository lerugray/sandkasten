// SAND-ART1 R2: a weapon row and a record line turn their lines at spaces only.
//
// The browser's own wrap also turns after a hyphen. In round 1 that showed five incoming weapons as ten rows
// ("INCOMING WEAPON -" / "> USS NIMITZ (CVN-68)") and split the weapon id in the debrief ("4x C-" / "802 NOOR").
// TerminalPlay now writes those turns itself (turnAtSpaces); this spec holds it to that at two window sizes.
import { test, expect, type Page } from "@playwright/test";
import { openPlay, runUntilResult, autopauseOff, restoreDice, GATE, type W } from "./helpers/sandPlay";

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Each matched block as the lines it is drawn in, plus every place a line turns inside a word. */
async function drawnLines(page: Page, selector: string) {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].map((block) => {
    const lines: string[] = [];
    const midWord: string[] = [];
    let top: number | null = null;
    let prev = " ";
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent ?? "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (/\s/.test(ch)) { prev = " "; if (lines.length) lines[lines.length - 1] += " "; continue; }
        const range = document.createRange();
        range.setStart(n, i);
        range.setEnd(n, i + 1);
        const rect = range.getClientRects()[0];
        if (!rect) continue;
        const y = Math.round(rect.top + rect.height / 2);
        if (top === null || Math.abs(y - top) > rect.height / 2) {
          if (top !== null && prev !== " ") midWord.push(`${lines[lines.length - 1].trim()} | ${ch}`);
          lines.push("");
          top = y;
        }
        lines[lines.length - 1] += ch;
        prev = ch;
      }
    }
    return { lines: lines.map((l) => l.replace(/\s+/g, " ").trim()), midWord };
  }), selector);
}

const WEAPONS = `(s) => {
  const units = s.gameState.sides.flatMap((x) => x.units);
  const at = (id) => units.find((u) => u.id === id).position;
  const asm = (name) => ({ name, type: "asm", rangeKm: 120, speedKts: 530, pkAir: 0, pkSurface: 90, quantity: 4, warheadDamage: 1, seekerType: "active-radar" });
  const fly = (id, name, by, side, target, from) => ({ id, name, launchedBy: by, launchedBySide: side, targetId: target,
    position: { lng: from.lng + 0.6, lat: from.lat + 0.6 }, heading: 225, speedKts: 530, rangeRemainingKm: 120, weapon: asm(name), seekerActive: false, seekerRangeKm: 10 });
  s.combatState = { ...s.combatState, weaponsInFlight: [
    fly("wrap-in-0", "C-802 Noor", "ir-fac-1", "Iran", "us-cvn-1", at("us-cvn-1")),
    fly("wrap-in-1", "C-802 Noor", "ir-fac-1", "Iran", "us-cvn-1", at("us-cvn-1")),
    fly("wrap-in-2", "C-802 Noor", "ir-fac-1", "Iran", "us-cg-1", at("us-cg-1")),
    fly("wrap-out-0", "RGM-84 Harpoon", "us-cg-1", "US Navy", "ir-ff-1", at("ir-ff-1")),
  ] };
}`;

async function begin(page: Page) {
  await openPlay(page, "/play", { e2eHandle: true });
  await expect(page.getByTestId("briefing")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("briefing")).toBeHidden();
  await autopauseOff(page);
}

for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }]) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    test("each weapon in flight is one entry: one >> mark, no line turned at a hyphen", async ({ page }) => {
      test.setTimeout(120_000);
      await begin(page);
      await page.evaluate(`(${WEAPONS})(window.__sandSession)`);
      await page.getByTestId("sidebar-tab-combat").click();
      await page.getByTestId("sim-toggle-pause").click();
      await expect(page.getByTestId("weapon-row").first()).toBeVisible({ timeout: 20_000 });
      await page.getByTestId("sim-toggle-pause").click();
      await expect(page.getByTestId("sim-state")).toContainText(/HOLD/);

      const rows = await drawnLines(page, '[data-testid="weapon-row"]');
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.midWord, row.lines.join(" / ")).toEqual([]);
        expect(row.lines[0]).toMatch(/^>> /);
        for (const line of row.lines.slice(1)) expect(line).not.toMatch(/^>/);
      }
      // the carrier's row is the one that needs two lines at this column width: it turns after the arrow
      const carrier = rows.find((r) => /NIMITZ/.test(r.lines.join(" ")));
      expect(carrier, "an incoming weapon on the carrier is listed").toBeTruthy();
      expect(carrier!.lines.join(" ")).toBe(">> INCOMING WEAPON -> USS NIMITZ (CVN-68)");
      if (carrier!.lines.length > 1) expect(carrier!.lines[0]).toMatch(/->$/);
    });

    test("debrief record lines keep a weapon id and a hull number whole", async ({ page }) => {
      test.setTimeout(240_000);
      await begin(page);
      await page.evaluate(() => { const w = window as Any; w.__origRandom = Math.random; Math.random = () => 0.7; });
      await page.evaluate((c) => {
        const s = (window as unknown as W).__sandSession as Any;
        const u = s.gameState.sides.flatMap((x: Any) => x.units).find((x: Any) => x.id === "us-cvn-1");
        u.position = { lng: c.lng, lat: c.lat };
      }, GATE.centre);
      await runUntilResult(page, 60_000);
      await restoreDice(page);

      const lines = await drawnLines(page, '[data-testid="result-record"] .tx-result-line');
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line.midWord, line.lines.join(" / ")).toEqual([]);
      // the launch lines are the ones that broke inside "C-802" and "(CVN-68)"
      const launches = lines.filter((l) => / LAUNCH /.test(l.lines[0]));
      expect(launches.length, "the opening salvo is on the record").toBeGreaterThan(0);
      for (const l of launches) expect(l.lines.join(" ")).toMatch(/C-802 NOOR AT USS NIMITZ \(CVN-68\)$/);
    });
  });
}
