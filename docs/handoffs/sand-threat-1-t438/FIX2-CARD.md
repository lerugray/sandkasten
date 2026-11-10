**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**

# SAND-THREAT-1 FIX2 — re-aim the three stale end-to-end pins (co-seat 3, 2026-11-10)

grounded: newest candidate = 1df1434c9a93b9b38739ac56aa31aba751445231 (`claude/sand-threat-1-t438-lane-fr9no6`); `docs/verification/sand-threat-1-t438/seed-tables.md` proves do-nothing defeat 5/5, careless carrier-alone defeat 5/5, escort-screen victory 5/5 and southern-dogleg/air victory 5/5. The full battery on that sha is 118 passed / 5 failed / 2 skipped / 1 not run. Start from exactly 1df1434c. Cap 5,400 s.

RAY-ASK: 2026-11-03, quoted by SPEC step 6 and the adopted SAND-THREAT-1 card: scenarios must not be "scripted in such a way that only one solution is viable". Main s422 23:28 ordered: "TUNE THE HORMUZ THREAT BEFORE EA." Main s426 09:30 confirmed that the carrier-alone defeat and the settled save premise stand; this card changes no scenario or save rule.

MOVES: Sandkasten's first public EA build. The intended threat behaviour now passes its gameplay proofs, but three old end-to-end tests still demand the deliberately removed carrier-alone victory. When this lands, those tests exercise the new intended outcomes or a proven sensible plan, so the completing land battery can measure the candidate rather than its superseded expectations.

## Scope — tests and report only

1. `tests/sand-play-1-plans.spec.ts`: the continuous carrier-alone / FLANK / straight-to-gate plan must now assert the real DEFEAT debrief through the ordinary UI. Rename the test and its screenshot/result artifacts so none claims a victory. Keep the distinct escorted southern-dogleg victory test unchanged and passing.
2. `tests/sand-wego-1-flow.spec.ts`: re-aim only the equivalent 5-minute WeGo carrier-alone plan A to the real DEFEAT outcome. Preserve its queued ENGAGE, orders/commit/resolution path and replay behaviour assertions. Do not change the turn length or tune 15-minute WeGo here: SAND-THREAT-2 owns that separate defect. Keep sensible plan B as a real victory.
3. `tests/sand-save-1-flow.spec.ts`: keep the real checkpoint, download, fresh-page load, saved clock/orders/fog and resume assertions intact. Adapt the resumed orders to one of the candidate's already proven sensible victories (escort screen with ROE FREE, or southern dog-leg with air support) so the resumed run still reaches a real victory. Do not weaken this into a crash-only or load-only check, do not replace the real saved file with a fixture, and do not merely delete the victory assertion. If neither proven plan can be applied from that real checkpoint, stop with the exact blocker and leave the assertion unchanged.
4. Write `docs/lane-reports/SAND-THREAT-1-FIX2-REPORT.md`: for each test, name the old assertion, new assertion and the candidate proof that justifies it. Report exactly what was and was not executed. This is a NO_EXEC Cursor lane: no browser or Playwright run in the lane; never claim a browser pass. Static inspection and non-browser focused checks are allowed.

## Map overlap — attribution at harvest, not guessed by the author

The same battery also has two `/map` failures: the `Qeshm / Khalij Fars` label intersects `apt-ir-0057` at both viewports. Do not alter map code, labels, scenario data or map assertions in this NO_EXEC lane. The seat will run the existing map check against base fc337505 and candidate 1df1434c on a browser-capable host and attribute it before any fix. This separation is deliberate: the stale combat expectations are not evidence that the map overlap has the same cause.

## Fence and done

- Edit only the three named test files and the new FIX2 report. No `src/` change, scenario retune, save-format/fixture/config-revision change, new rule, new feature or snapshot update.
- Preserve every assertion about save/restore integrity, WeGo turn mechanics and the two viable winning approaches. No test deletion, skip, broader timeout or looser regex used to hide a defect.
- Do not commit or push; the orchestrator harvests the tree as found. Stop at the cap with an honest partial report.
- Harvest: diff review on a non-author model, then the existing full battery with at most 2 Playwright workers on a free browser host. The seat separately runs the base-vs-candidate map attribution before deciding any map fix. Land only after the settled gate is green.
