**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**

# SAND-ART1-LANDGATE3 — map@1920 residue + play-shots frames (after LANDGATE2)

This codebase is yours: what it's for and how it's build are your call, and you'll keep building on it.

RAY-ASK: 2026-11-11 04:11 KEEP the art, change the font later. This card does NOT change fonts.

grounded: t588 home-PC GPU targeted e2e on LANDGATE2 tip `b20748e` RESULT=FAIL 3pass/3fail. Vitest 353/353. Custody `/home/ray/lanes/_co3/sandlandgate2-t586-harvest/`. map@1440 + plot@1440/1920 green. Hard reds unchanged in class: (1) `tests/sand-osint-1-overlap-map.spec.ts` `/map has zero overlaps at 1920x1080` (240s timeout; snapshot overlaps remain e.g. bandar-abbas labels vs facility icons); (2) `tests/sand-play-1-shots.spec.ts` both DPR2 sizes — `openPlay` waits for `__sandPlot.frames()>30` and times out at 60s. LANDGATE2's style-clear + focusArea snap + soft-GL DPR cap did not clear these on this host. MOVES: YES — clears the two remaining landgate-class reds so ART1 can re-landbat after Ray's KEEP.

## Defects (fix only these)
1. **S2 OSINT map@1920** — after LANDGATE2, 1920 still leaves colliding labels/icons. Prefer stronger omit/collision on `/map` only at dense zooms; do not weaken the assert. Keep 1440 green.
2. **S2 play-shots frames** — plot must produce >30 frames within the openPlay budget at 1440 and 1920 DPR2 on GPU and soft-GL. Prefer starting the sim/warm so frames advance immediately after load (not only after focusArea); keep focusArea snap. Do not raise timeouts as the fix.

## Already green (do not regress)
- vitest; map@1440; osint plot overlaps 1440+1920; facilities/RC-FIX as before LANDGATE2

## Fence
- No fonts. No combat/WeGo/sensors/scenario/save. No merge to main. Dirty tree for harvester. No host-only Playwright GPU overlay commits.

## Battery and done
- NO_EXEC: code only. Harvester: `npx vitest run` + `npx playwright test --workers=1 tests/sand-osint-1-overlap-map.spec.ts tests/sand-play-1-shots.spec.ts tests/sand-osint-1-overlap-plot.spec.ts`
- Write `docs/lane-reports/SAND-ART1-LANDGATE3-REPORT.md`. Cap 7200s.
- Final message first line: FIX SUBMITTED or FIX BLOCKED <why>.

## Dispatch gate
Unblocks SAND-ART1 land after Ray's KEEP so ART2 @d9762b5 and SAND-FONT1 can follow toward first public EA.
