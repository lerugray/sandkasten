# SAND-ART1-LANDGATE — facility / OSINT / shots only (RE-PLAN after 3 landbat reds)

SPEC anchor (Ray): Sandkasten play presentation must stay readable and clickable — facility panels open, OSINT labels do not overlap at theatre viewports, and play shots at 1920×1080 stay within the ratified look.

RAY-ASK: 2026-11-11 04:11 KEEP the art, change the font later. This card does NOT change fonts. It only clears the product e2e reds that block landing ART1 after Ray's KEEP.

## Why (RE-PLAN)
Land batteries at tip `72eef47` (`co3/sand-art1-fix6-wip`) failed the same way on RunPod t555 and t559: UNIT green; wrap/save/play-plans green; E2E_RC=124 (suite timeout) with these hard reds ×3 each:
1. `sand-map-1-facilities` globe/terrain/satellite toggle
2. `sand-map-2-plot-facilities` Oghab 44 panel + Havadarya panel
3. `sand-osint-1-overlap-plot` overlaps at 1920×1080
4. `sand-play-1-shots` pixel inspection at 1920×1080 DPR 2

Out of scope (host-class flake, do not touch): `sand-combat-1-record` plan A WeGo 20-min timeout. Leave it red; next landbat may skip or soft-fail that case only if the card's green list below is green.

## Moves (YES)
- Production plot/map/OSINT presentation code and styles needed so those four specs pass on Chromium under Xvfb.
- Tiny Playwright helper waits only if a flake is proven host-timing (prefer product fix).
- One short `docs/lane-reports/SAND-ART1-LANDGATE-REPORT.md` naming files changed and what stayed red on purpose.

## Does not move (NO)
- Fonts (SAND-FONT1 later). Art KEEP stands.
- Combat math, sensors, scenario content, save format, wrap debrief (already green via FIX6).
- New features. No Ray packet.

## Door / caps
Cursor auto, NO_EXEC OK for code (harvester runs targeted e2e). Cap 7200s. One owner.

## Done when
- Diff stays inside map/plot/OSINT/shots presentation paths.
- Author leaves working tree dirty (no commit). Harvester WIP-commits, runs:
  - `npx vitest run` green
  - targeted e2e workers=1: the four specs above green at 1920 where applicable
- Then seat re-runs full landbat (e2e hard stop ≥12600s) and lands ART1 tip on green.

## Dispatch gate
Lands SAND-ART1 after Ray's KEEP so ART2 @d9762b5 and SAND-FONT1 can follow toward first public EA.
