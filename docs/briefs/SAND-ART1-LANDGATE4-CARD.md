**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**

# SAND-ART1-LANDGATE4 — RE-PLAN: /plot and /play tactical plot never paints (after LANDGATE3)

This codebase is yours: what it's for and how it's build are your call, and you'll keep building on it.

RAY-ASK: 2026-11-11 04:11 KEEP the art, change the font later. This card does NOT change fonts.
RE-PLAN (HANDOFF s436 / posture 1(e)): LANDGATE3 was the third gate round. A fourth round is allowed only with this written re-plan. Scope is narrower than LANDGATE3: OSINT /map is DONE; only the tactical plot on /plot and /play remains broken for players.

grounded: t590 home-PC RTX 3050 (real GPU, GALLIUM_DRIVER=d3d12) targeted e2e on LANDGATE3 tip `f872514` RESULT=FAIL 2pass/4fail (9.7m). Custody `/home/ray/lanes/_co3/sandlandgate3-t589-harvest/RESULT.txt`. MAP @1440+1920 **PASS** (LANDGATE3 decode/settle claim holds). On /plot and /play the tactical plot handle appears but the scene never paints: Playwright's witness `__sandPlot.frames()>30` stays at 0 through the full openPlot 30s / openPlay 60s budgets at 1440 and 1920 (play-shots at DPR2). A player opening Plot or Play sees a frozen/blank theater instead of the moving tactical view the KEEP art lives in. LANDGATE3's softGl path + `warmFrames(36)` did not fix real-GPU paint. Vitest 355/355 on the tip.

MOVES: YES — restores the player-visible tactical plot animation on Plot and Play so ART1's kept art can land, then ART2 @d9762b5 and SAND-FONT1 can follow toward first public EA.

## Defect (fix only this)
**S2 Plot/Play blank theater** — after the page mounts `__sandPlot`, the plot must paint continuously (frame counter advancing past 30 within the existing openPlay 60s / openPlot 30s budgets) at 1440 and 1920, including play-shots at DPR2, on real GPU. Prefer a fix that starts the same paint loop the player sees, right after the handle is live, without waiting for focusArea. Do not raise timeouts. Do not touch /map layout. The frames() helper is the witness for "the theater is alive", not the product.

## Already green (do not regress; do not edit for this card)
- vitest (355/355); map@1440; map@1920; LANDGATE3 map decode/settle/omit work
- fonts (SAND-FONT1 later); combat/WeGo soft known

## Fence
- No fonts. No /map layout churn. No combat/WeGo/sensors/scenario/save. No merge to main. Dirty tree for harvester. No host-only Playwright GPU overlay commits. No fifth gate round after this without another written re-plan.

## Battery and done
- NO_EXEC: code only. Harvester on home-PC GPU: `npx vitest run` + `npx playwright test --workers=1 tests/sand-osint-1-overlap-map.spec.ts tests/sand-play-1-shots.spec.ts tests/sand-osint-1-overlap-plot.spec.ts`
- Write `docs/lane-reports/SAND-ART1-LANDGATE4-REPORT.md` naming the root cause and why LANDGATE3 warmFrames missed real GPU.
- Cap 7200s.
- Final message first line: FIX SUBMITTED or FIX BLOCKED <why>.

## Dispatch gate
Unblocks SAND-ART1 land after Ray's KEEP so ART2 and SAND-FONT1 can follow toward first public EA.
