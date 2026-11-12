**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**

# SAND-ART1-LANDGATE4 — RE-PLAN: plot/play frames()>30 only (after LANDGATE3)

This codebase is yours: what it's for and how it's build are your call, and you'll keep building on it.

RAY-ASK: 2026-11-11 04:11 KEEP the art, change the font later. This card does NOT change fonts.
RE-PLAN (HANDOFF s436 / posture 1(e)): LANDGATE3 was the third gate round. A fourth round is allowed only with this written re-plan. Scope is narrower than LANDGATE3: map is DONE; only the frames counter on /plot and /play remains.

grounded: t590 home-PC GPU targeted e2e on LANDGATE3 tip `f872514` RESULT=FAIL 2pass/4fail (9.7m). Custody `/home/ray/lanes/_co3/sandlandgate3-t589-harvest/RESULT.txt`. MAP @1440+1920 **PASS** (LANDGATE3 decode/settle claim holds). PLOT @1440+1920 FAIL: `plotViews.openPlot` `__sandPlot.frames()>30` 30s timeout. PLAY @1440+1920 FAIL: `sandPlay.openPlay` same gate 60s timeout. Real NVIDIA GPU (GALLIUM_DRIVER=d3d12), not soft-GL — so LANDGATE3's softGl path + `warmFrames(36)` did not make frames advance on this host. Vitest 355/355 on the tip. MOVES: YES — clears the remaining landgate-class reds so ART1 can re-landbat after Ray's KEEP.

## Defect (fix only this)
**S2 plot + play frames** — after `__sandPlot` exists, `frames()` must exceed 30 inside the existing openPlay (60s) and openPlot (30s) budgets at 1440 and 1920 (DPR2 for play-shots). Prove on real GPU reasoning: warmFrames may run before the React handle is published, frames may reset on remount, RAF may not run while the tab is hidden, or the counter may not be the one the helper reads. Prefer a fix that advances the same counter the helpers read, immediately after the handle is live, without waiting for focusArea. Do not raise timeouts. Do not touch /map layout.

## Already green (do not regress; do not edit for this card)
- vitest (355/355); map@1440; map@1920; LANDGATE3 map decode/settle/omit work
- fonts (SAND-FONT1 later); combat/WeGo soft known

## Fence
- No fonts. No /map layout churn. No combat/WeGo/sensors/scenario/save. No merge to main. Dirty tree for harvester. No host-only Playwright GPU overlay commits. No fourth-plus round after this without another written re-plan.

## Battery and done
- NO_EXEC: code only. Harvester on home-PC GPU: `npx vitest run` + `npx playwright test --workers=1 tests/sand-osint-1-overlap-map.spec.ts tests/sand-play-1-shots.spec.ts tests/sand-osint-1-overlap-plot.spec.ts`
- Write `docs/lane-reports/SAND-ART1-LANDGATE4-REPORT.md` naming the root cause and why LANDGATE3 warmFrames missed real GPU.
- Cap 7200s.
- Final message first line: FIX SUBMITTED or FIX BLOCKED <why>.

## Dispatch gate
Unblocks SAND-ART1 land after Ray's KEEP so ART2 @d9762b5 and SAND-FONT1 can follow toward first public EA.
