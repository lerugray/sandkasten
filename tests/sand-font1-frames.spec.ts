// SAND-FONT1 capture: five screens × three faces × two sizes.
//   SAND_FONT1_CAPTURE=1 npx playwright test tests/sand-font1-frames.spec.ts --workers=1
// Skipped in the ordinary battery.
import { test, expect, type Page, type Browser } from "@playwright/test";
import path from "node:path";
import { mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { openPlay, autopauseOff } from "./helpers/sandPlay";
import type { TerminalFontId } from "@/lib/terminalFont";

const RUN = process.env.SAND_FONT1_CAPTURE === "1";
const OUT = path.join(process.cwd(), "docs", "verification", "sand-font1");
const FACES: TerminalFontId[] = ["vt323", "glasstty", "ibm3270"];
const SIZES = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
] as const;

test.skip(!RUN, "capture tool: set SAND_FONT1_CAPTURE=1");
test.describe.configure({ mode: "serial" });

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function installClock(page: Page) {
  await page.addInitScript(() => {
    const w = window as Any;
    const raf = window.requestAnimationFrame.bind(window);
    const pnow = performance.now.bind(performance);
    const clock = { offset: 0, frozen: null as number | null, watch: null as null | (() => void) };
    const v = () => clock.frozen ?? pnow() + clock.offset;
    performance.now = () => v();
    window.requestAnimationFrame = (cb: FrameRequestCallback) => raf(() => { clock.watch?.(); cb(v()); });
    w.__art = {
      clock,
      freeze() { clock.frozen = (Math.floor(v() / 60000) + 1) * 60000; },
      freezeIn(ms: number) { clock.frozen = v() + ms; },
      release() { if (clock.frozen !== null) { clock.offset = clock.frozen - pnow(); clock.frozen = null; } },
      until: null as null | ((s: Any) => boolean),
      done: false,
    };
    let vnow = Date.now();
    Date.now = () => vnow;
    const si = window.setInterval.bind(window);
    window.setInterval = ((fn: (...a: unknown[]) => void, ms?: number, ...rest: unknown[]) =>
      si(() => {
        if (ms === 50) vnow += 50;
        fn(...rest);
        const s = w.__sandSession;
        if (ms === 50 && s && w.__art.until && !s.gameState.isPaused && w.__art.until(s)) {
          s.pause();
          w.__art.until = null;
          w.__art.done = true;
        }
      }, ms)) as typeof window.setInterval;
  });
}

async function readTextIssues(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="terminal-root"]') ?? document.body;
    const orphans: string[] = [];
    const clipped: string[] = [];
    const vis = (el: Element) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const blocks = new Set<Element>();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const el = t.parentElement;
      if (!el) continue;
      let hidden = false;
      for (let a: Element | null = el; a && a !== root.parentElement; a = a.parentElement) {
        if (!vis(a)) { hidden = true; break; }
      }
      if (hidden) continue;
      let b: Element | null = el;
      while (b && /^inline/.test(getComputedStyle(b).display) && getComputedStyle(b).display !== "inline-block" && getComputedStyle(b).display !== "inline-flex") {
        b = b.parentElement;
      }
      if (b) blocks.add(b);
    }
    for (const b of blocks) {
      const cs = getComputedStyle(b);
      if (cs.whiteSpace.startsWith("pre") || cs.whiteSpace === "nowrap") continue;
      const lines = new Map<number, string[]>();
      const tw = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
      let own = true;
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const txt = n.textContent ?? "";
        const re = /\S+/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(txt))) {
          const r = document.createRange();
          r.setStart(n, m.index);
          r.setEnd(n, m.index + m[0].length);
          const pe = n.parentElement!;
          if (pe !== b && !/^inline/.test(getComputedStyle(pe).display)) own = false;
          for (const rect of r.getClientRects()) {
            if (rect.width === 0) continue;
            const key = Math.round((rect.top + rect.height / 2) / 6);
            const arr = lines.get(key) ?? [];
            arr.push(m[0]);
            lines.set(key, arr);
          }
        }
      }
      if (own && lines.size >= 2) {
        const keys = [...lines.keys()].sort((p, q) => p - q);
        const last = lines.get(keys[keys.length - 1])!;
        if (last.length === 1) {
          const all = keys.flatMap((k) => lines.get(k)!).join(" ");
          orphans.push(`${(b.getAttribute("data-testid") ?? b.className ?? b.tagName).toString().slice(0, 48)} :: ...${all.slice(-70)} :: last "${last[0]}"`);
        }
      }
      if (b.scrollWidth > b.clientWidth + 2 || b.scrollHeight > b.clientHeight + 2) {
        const label = (b.getAttribute("data-testid") ?? b.className ?? b.tagName).toString().slice(0, 48);
        const sample = (b.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
        clipped.push(`${label} :: overflow ${b.scrollWidth}x${b.scrollHeight} in ${b.clientWidth}x${b.clientHeight} :: "${sample}"`);
      }
    }
    orphans.sort();
    clipped.sort();
    return { orphans, clipped };
  });
}

const MISSILES = `(s) => {
  const tgt = s.gameState.sides.flatMap((x) => x.units).find((u) => u.id === "us-cvn-1");
  const weapon = { name: "C-802 Noor", type: "asm", rangeKm: 120, speedKts: 530, pkAir: 0, pkSurface: 90, quantity: 4, warheadDamage: 167, seekerType: "active-radar" };
  const own = { name: "RGM-84 Harpoon", type: "asm", rangeKm: 130, speedKts: 530, pkAir: 0, pkSurface: 85, quantity: 8, warheadDamage: 220, seekerType: "active-radar" };
  const wifs = Array.from({ length: 5 }, (_, i) => {
    const brg = (20 + i * 9) * Math.PI / 180, d = 0.16 + i * 0.035;
    return { id: "font-in-" + i, name: weapon.name, launchedBy: "ir-fac-1", launchedBySide: "Iran", targetId: "us-cvn-1",
      position: { lng: tgt.position.lng + Math.sin(brg) * d, lat: tgt.position.lat + Math.cos(brg) * d }, heading: (200 + i * 9) % 360,
      speedKts: 530, rangeRemainingKm: 120, weapon, seekerActive: true, seekerRangeKm: 10 };
  });
  const out = [0, 1].map((i) => ({ id: "font-out-" + i, name: own.name, launchedBy: "us-cg-1", launchedBySide: "US Navy", targetId: "ir-ff-1",
    position: { lng: 57.38 + i * 0.07, lat: 25.38 + i * 0.05 }, heading: 75, speedKts: 530, rangeRemainingKm: 130, weapon: own, seekerActive: false, seekerRangeKm: 10 }));
  s.combatState = { ...s.combatState, weaponsInFlight: [...s.combatState.weaponsInFlight, ...wifs, ...out] };
}`;

function logIssue(face: string, screen: string, w: number, kind: string, lines: string[]) {
  if (!lines.length) return;
  const report = path.join(OUT, "FINDINGS.md");
  appendFileSync(report, `\n### ${face} / ${screen} @ ${w} — ${kind}\n`);
  for (const l of lines) appendFileSync(report, `- ${l}\n`);
}

test("five screens × three faces × two sizes", async ({ browser }) => {
  test.setTimeout(900_000);
  mkdirSync(OUT, { recursive: true });
  const findings = path.join(OUT, "FINDINGS.md");
  writeFileSync(
    findings,
    `# SAND-FONT1 capture findings\n\nMachine dump from the last \`SAND_FONT1_CAPTURE=1\` run. Narrative + default proposal live in REPORT.md.\n\n`,
  );

  for (const face of FACES) {
    for (const size of SIZES) {
      const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      await installClock(page);
      try {
        await openPlay(page, `/play?font=${face}`, { e2eHandle: true });
        await expect(page.getByTestId("terminal-root")).toHaveAttribute("data-font", face, { timeout: 10_000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1200);

        const shot = async (screen: string) => {
          await page.evaluate(() => (window as Any).__art?.freeze?.());
          await page.waitForTimeout(300);
          const issues = await readTextIssues(page);
          const file = `${face}-${screen}-${size.width}.png`;
          await page.screenshot({ path: path.join(OUT, file) });
          writeFileSync(path.join(OUT, `${face}-${screen}-${size.width}.json`), JSON.stringify(issues, null, 1));
          logIssue(face, screen, size.width, "orphan last lines", issues.orphans);
          logIssue(face, screen, size.width, "clipped/overflow", issues.clipped);
          await page.evaluate(() => (window as Any).__art?.release?.());
        };

        // 1. briefing
        await expect(page.getByTestId("briefing")).toBeVisible();
        await shot("briefing");

        // 2. plot
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("briefing")).toBeHidden();
        await page.waitForTimeout(2000);
        await shot("plot");

        // 3. missiles
        await page.getByTestId("force-row").filter({ hasText: "USS Nimitz" }).first().click();
        await page.evaluate((d) => (window as Any).__sandPlot.setDist(d), 150);
        await page.waitForTimeout(2500);
        await page.keyboard.press("Escape");
        await autopauseOff(page);
        await page.evaluate(`(${MISSILES})(window.__sandSession)`);
        await page.waitForTimeout(800);
        await page.getByTestId("sim-speed").filter({ hasText: "5x" }).click().catch(() => {});
        await page.getByTestId("sim-toggle-pause").click().catch(() => {});
        await page.waitForTimeout(2500);
        await page.getByTestId("sim-toggle-pause").click().catch(() => {});
        await page.waitForTimeout(500);
        await shot("missiles");

        // 4. combat tab
        await page.getByTestId("sidebar-tab-combat").click();
        await page.waitForTimeout(500);
        await shot("combat");

        // 5. god view
        await page.getByTestId("sidebar-tab-forces").click();
        await page.keyboard.press("g");
        await expect(page.getByRole("button", { name: "Toggle god mode" })).toHaveAttribute("data-active", "true");
        await page.evaluate(() => (window as Any).__sandPlot.setDist(1000));
        await page.waitForTimeout(1500);
        await shot("god");
      } finally {
        await ctx.close();
      }
    }
  }

  appendFileSync(
    findings,
    `\n## Summary\n\nCapture finished for faces ${FACES.join(", ")} at widths ${SIZES.map((s) => s.width).join(", ")}.\nEmpty issue sections mean none found for that pose.\n`,
  );
});
