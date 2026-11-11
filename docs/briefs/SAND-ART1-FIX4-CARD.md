**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**

# SAND-ART1-FIX4 — land-battery reds on ART1+FIX3 tip d882b59 (GS co-seat 3, night-s409 t529)

This codebase is yours: what it's for and how it's build are your call, and you'll keep building on it.

grounded: sandkasten tip `co3/sand-art1-fix3-landbat` @`d882b5984af237083b9a86dd2fc1c3a9a1a56a05` (merge of ART1+FIX3). Land battery t525 RunPod cpu5c: unit PASS 352/352; e2e killed at 7200s (rc=124) after test #95/142 with four unique reds below. Custody: GS-private `/home/ray/lanes/_co3/sandart1fix3land-t525pod/HARVEST.md`. Ray s432 KEEP ART1 / REVISE font: land ART1 only on green unit+e2e; wrap FAIL alone blocks land (HANDOFF). MOVES: clears the ART1+FIX3 land gate so ART2 @d9762b5 and SAND-FONT1 can follow.

## Defects (fix only these; do not change the look Ray KEPT)
1. **S2 wrap — debrief record mid-word breaks (`tests/sand-art1-wrap.spec.ts`).** At 1920x1080 and 1280x720 the debrief `.tx-result-line` rows split inside weapon id `C-802` and hull `(CVN-68)`. Required: every drawn line's `midWord` is empty; every `LAUNCH` line joins to match `/C-802 NOOR AT USS NIMITZ \(CVN-68\)$/`. Fix presentation CSS/layout (nowrap tokens, break opportunities) in the combat/debrief record only. Do not weaken the test.
2. **S2 WeGo combat record — plan A times out (`tests/sand-combat-1-record.spec.ts` plan A WeGo).** The test's own 20 min cap fires ×3. Reproduce with that single test; find the stall (orders phase, ENGAGE/CANCEL, commit, resolution, record/debrief) and fix the player path so the staged flow completes under the existing timeout. No sim-balance or threat-table changes.
3. **S2 Oghab 44 panel (`tests/sand-map-2-plot-facilities.spec.ts`).** Clicking facility `apt-ir-0161` (Oghab 44) must open `facility-panel` with title containing "Oghab", one `facility-runway-row` showing `2,733 m`, and X closes it. Fix hit-target / panel wiring only.
4. **S2 OSINT overlap at 1920x1080 (`tests/sand-osint-1-overlap-plot.spec.ts`).** Zero overlaps among labels, blocks, symbols, icons and the scale bar across all seven walkPlotViews at 1920×1080 (1440×900 already passed on t525). Fix label placement / occupancy only; do not drop labels or the scale bar.

## Fence
- No font swap (SAND-FONT1 is a later card after ART2 lands).
- No new features, no scenario/balance/sensor/combat-math edits, no save-format change.
- Do not merge to main. Leave dirty tree for the harvester; checkpoint-commit on your session branch only if the brief's host contract says so — this Cursor fix lane leaves the tree uncommitted.

## Battery and done
- `npx vitest run` green.
- Targeted e2e green: the four specs above (`npx playwright test tests/sand-art1-wrap.spec.ts tests/sand-combat-1-record.spec.ts tests/sand-map-2-plot-facilities.spec.ts tests/sand-osint-1-overlap-plot.spec.ts --workers=1`).
- Write `docs/lane-reports/SAND-ART1-FIX4-REPORT.md`: per defect, cause, files touched, proof command, pass/fail counts. Cap 7200 s.
