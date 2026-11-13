**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**

# SAND-ART1-LANDGATE2 — osint map@1920 + play-shots (RE-PLAN after t576 landbat)

This codebase is yours: what it's for and how it's build are your call, and you'll keep building on it.

RAY-ASK: 2026-11-11 04:11 KEEP the art, change the font later. This card does NOT change fonts.

grounded: RunPod landbat t576 want `c3a4f3b` (`co3/sand-art1-landgate-fix-t571`) RESULT=FAIL UNIT_RC=0 E2E_RC=124. Custody `/home/ray/lanes/_ship/durable/co3-sandart1land-t576pod/`. Facilities/map-2/osint-plot/play-plans/RC-FIX green. Hard reds left in landgate class: (1) `tests/sand-osint-1-overlap-map.spec.ts` `/map has zero overlaps at 1920x1080` ×3; (2) `tests/sand-play-1-shots.spec.ts` pixel inspection at 1440×900 and 1920×1080 DPR 2 ×3 each. Out of scope soft: `sand-combat-1-record` plan A WeGo + plan B continuous (same host-class soft as LANDGATE). MOVES: YES — clears the two landgate-class reds so ART1 can re-landbat after Ray's KEEP.

## Defects (fix only these)
1. **S2 OSINT map@1920** — `/map` label/icon/scale overlaps at 1920×1080 (1440 and plot@1920 already green). Prefer production map label layout / collision; tiny wait only if proven host-timing under Xvfb.
2. **S2 play-shots** — pixel inspection fails at both 1440 and 1920 DPR2. Prefer product presentation so shots match ratified look; update committed baselines only if the pixels are the intended ART1 KEEP look and the assertion is baseline-drift (document why in the report). Do not weaken thresholds to hide a clip/overlap.

## Already green on this tip (do not regress)
- map-1/map-2 facilities, osint plot overlaps + rings, play-1 plans/result, RC-FIX1/2, wrap, vitest 352/352
- Flaky design-system tilt/unit (must stay green on retry)

## Fence
- No fonts (SAND-FONT1 later). No combat math/sensors/scenario/save. No WeGo/combat-record work.
- No merge to main. Leave dirty tree for harvester. No host-only Playwright GPU overlay commits.

## Battery and done
- Lane is **NO_EXEC**: write the fix only; no Playwright here. `npx vitest run` OK if node_modules exist.
- Harvester: `npx vitest run` green; targeted e2e `--workers=1`: `tests/sand-osint-1-overlap-map.spec.ts` `tests/sand-play-1-shots.spec.ts` (and smoke `tests/sand-osint-1-overlap-plot.spec.ts`).
- Write `docs/lane-reports/SAND-ART1-LANDGATE2-REPORT.md`: cause, files, what stayed soft on purpose. Cap 7200s.
- Final message first line: FIX SUBMITTED or FIX BLOCKED <why>.

## Dispatch gate
Unblocks SAND-ART1 land after Ray's KEEP so ART2 @d9762b5 and SAND-FONT1 can follow toward first public EA.
