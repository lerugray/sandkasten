SAND-VICTORY-1 PARTIAL head=c386c11 rules=pass score_cause=pass replay=pass two_plays=pass carries=3/3 unit=286/286 e2e=102/105 skipped=2 build=pass gpu=ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 3050), OpenGL ES 3.1)

# SAND-VICTORY-1 (s409), SPEC step 6: win or lose on the scenario's rules, play it again a different way

Branch `s409/sand-victory-1`, from `63db218`. Operator co3-sandvictory-t264 (Sonnet 5.5, backup account).

**Why PARTIAL and not READY.** The full E2E on `8c41ebf` was 102 passed, 1 failed, 2 skipped (105). The one failure was a harness race in `runUntilResult`, not the product (details below). I fixed the helper in `c386c11` and re-ran the affected specs: 14/14 green with `--repeat-each=2`. The one-hour full E2E was not re-run on `c386c11`: there was no budget left for it. Everything else in the brief is delivered.

## Player-visible result

- **Which rule ended the run.** The debrief now shows `DECIDED BY` followed by the real rule in player words. Examples: "USS Nimitz entered the transit gate (afloat, undamaged)." and "Ending rule met: US Navy score is at least 40." Internal event names are never rendered (asserted in a spec).
- **Score beside the verdict.** The debrief shows `FINAL SCORE US NAVY n // IRAN m` plus a one-line cause note. "SCORE IS A TALLY. IT DID NOT DECIDE THIS ENDING." appears when a non-score rule ended the run. "THE SCORE DECIDED THIS ENDING." appears when a score rule did. A combat-loss defeat says it was a tally.
- **Briefing and mission panel.** Both state the win and lose rules and any public score rules. If the scenario has endings the player cannot know, the UI says "OTHER ENDINGS NOT BRIEFED" instead of implying the list is complete. The Help panel has a new "How a Run Ends" section.
- **Reviewing without moving time.**
  - REVIEW RECORD collapses the debrief to a strip. VIEW RECORD opens the combat record with "BACK TO DEBRIEF". Both leave the clock frozen.
  - The strip was moved to `top: 96px; left: 360px` (`terminal.css`). The first version overlapped the OSINT toggle row, which was a real clip found by the new intersection proof.
  - Strip intersections: 0 hits and not clipped at 1440x900 and 1920x1080 (`strip-intersections.json`, plus the hold strip in the plan A JSON).
- **Clean second run.**
  - PLAY AGAIN and RESET return to the paused briefing with score 0, no result or provenance, fired events cleared, the event list equal to the base scenario's, no intents or log, no selected target and an unfiltered record.
  - Window listeners and intervals are unchanged after two replays (probe counts 3 / 25 / 3 before and after each round).
  - Space on the focused PLAY AGAIN deliberately does nothing, because Space is the clock key. Enter and click replay. A double Enter is one reset.

## Source trace

- **`src/lib/ai/events.ts`.** `ScenarioResult` gains additive `source = {event, forcedBy?}`. It is stamped where a deferred EndScenario result is merged, so the first result wins as before and `engine.ts` is unchanged.
- **`src/lib/scenarios/objective.ts` (presenter only; it never evaluates rules).**
  - `describeEndings`, `explainResult` and `endingNotes` turn the scenario's own events into player text.
  - Hidden triggers, hostile-named targets, dependencies, random chance and hostile areas are dropped and set `limited=true`.
  - Events with an undescribable EndScenario are noted rather than invented.
- **`src/components/terminal/TerminalPlay.tsx`.** Debrief (`result-deciding`, `result-score`, `result-score-note`), mission panel, briefing rules, strip and guards.
- **`src/lib/simulation/trackNumber.ts` (new).** One track-number hash shared by the plot, the ENGAGE selector and the staged row. That closes S3-7.
- **Also changed:** `session.ts` (stageEngage uses the shared number), `TacticalPlot.ts` (re-export), `HelpPanel.tsx`, `README.md`, `terminal.css`.

## Checkpoints (all on origin `s409/sand-victory-1`)

| CP | commits | content |
|---|---|---|
| CP1 | `587a187`, `2d244d8` | provenance, ending presenter, score beside debrief, shared track number, help/README; red-to-green unit tests |
| CP2 | `24dbe5e`, `901e868`, `11ac4aa`, `fd49c03`, `e1a3f68`, `a049fdc` | strip fix, carries, replay/navigation spec, two-plays spec |
| CP3 | `8c41ebf` (tested), `c386c11` (test-helper fix + logs + index), report commit | final battery, evidence, report |

- Last product-code commit: `11ac4aa` (`terminal.css`). The full battery ran on `8c41ebf`, which has the identical product code.
- `c386c11` changes only `tests/helpers/sandPlay.ts` and evidence files. The report commit after it is docs only.

## Proof

- **Red to green.** `unit-red-on-base.log` shows the new unit tests run against the base source: 24 failed, 232 passed. Vitest is now 286/286 (base 260, +26).
- **Rules.** `endings.test.ts` has 15 ending-presenter fixtures. `events.test.ts` and `wego.test.ts`/`terminal.test.ts` carry the provenance (forced-event chain, first-result-wins) and shared-track-number tests. The E2E specs run a scripted score victory, a draw and a combat-loss defeat. The carrier loss goes through the production combat path.
- **Score cause.** The score card must equal the session's own score. The shipped Hormuz events add +10, so a seeded 40 shows as 50 and the spec asserts `shown >= 40 && shown == session score`. This is recorded here because it surprised me.
- **Two played solutions** (`two-plays.json`, real mouse/keyboard, GOD off). Both end on the same rule with different orders and different tallies.
  1. Nimitz alone, one FLANK waypoint at the gate, continuous 60x. Victory by the transit rule. Losses 2, hostile kills 3.
  2. After PLAY AGAIN: WeGo 5 min, Chosin/Mahan/Cole forward to (56.5, 26.6) FULL and Nimitz by a southern dog-leg via (57.0, 25.9). Victory in 45 turns by the same rule. Losses 1, hostile kills 6.
  - `freshAfterReplay` in the same JSON shows the clean state between them.
- **Replay/navigation** (`sand-victory-1-replay.spec.ts`, `replay-rounds.json`).
  - Debrief to record to debrief via Enter, with the same verdict and score text.
  - Space does not replay. Enter replays, and the double press is one reset.
  - Two rounds, each with a distinct fixture ending, leave listeners and intervals unchanged and the record filters reset.
  - RESET in a WeGo plan and RESET from the record strip both reach a fresh briefing.
  - The existing `sand-combat-1-record` spec covers demo, snapshot, demo, legacy navigation and held-review record to return.
- **Real GPU.** Renderer from `rendererInfo()`: ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 3050), OpenGL ES 3.1). Env: `SAND_E2E_GPU=1 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA LD_LIBRARY_PATH=/usr/lib/wsl/lib SAND_E2E_PORT=3421`, `--workers=1`, nice 15, muted.

## The three carried combat-review items

All three are closed by `sand-combat-1-record.spec.ts` plan A. Evidence: `combat-1-carries/plan-A-direct-flank-wego.json` plus screenshots at both sizes.

- **S3-3 (fire receipt). CLOSED.**
  - Turn 2 receipt: Hornet 101 (`us-fa18-1`) to TN9484 DET (`contact-6`), status `launched`, text "HORNET 101 -> TN9484 DET: LAUNCHED". It is read in the held review before NEXT TURN.
  - Cancel is a separate event. The visible CANCEL on the staged row removes it. The order panel says "Fire order cancelled." and the JSON records the cancel (`cancel`).
  - The other outcome is covered by a labelled FIXTURE: the contact is removed from the live session between staging and commit. Turn 3 receipt: Hornet 101 to TN2103 DET, status `refused`, text "REFUSED, NO SUCH CONTACT" (`refusedFixture`). That one is a fixture, not a refusal from natural play.
- **S3-4 (strip overlap). CLOSED.** Hold strip: x=360, y=96, hits `[]`, clipped false at 1440x900 and 1920x1080. Final-record strip: the same in `strip-intersections.json`.
- **S3-7 (target identity). CLOSED.** One contact id and one 4-digit track number across the selector option, the staged row, cancel and re-stage, and the receipt (`data-contact-id` asserted at each step).

## Commands and outputs

All logs are in `docs/verification/sand-victory-1-s409/final/` (`battery.txt` has exit statuses), on `8c41ebf`:

| command | result |
|---|---|
| `npm run test:unit` | exit 0, 286/286 |
| `npx tsc --noEmit` | exit 2, 3 errors, all in `tests/sand-001-unit-placement.spec.ts`; the same 3 exist on the base and are not mine |
| `npm run build` | exit 0 |
| `npm run test:e2e -- --workers=1 --reporter=line` | exit 1, 102 passed, 1 failed, 2 skipped, 52.6 min |

- **The failure.** `sand-victory-1.spec.ts:110` ("scripted draw and combat-loss defeat") timed out at 400 s inside `runUntilResult`, although its failure screenshot shows the DRAW overlay up and the page alive.
- **The 2 skipped** are the `sand-osint-1-frames` capture tests, gated on `SAND_CAPTURE=1`. They were skipped the same way on the base.
- **Helper fix verification.** `e2e-helper-fix-verify.log` (on `c386c11`): `sand-victory-1`, `sand-victory-1-replay` and `sand-play-1-shots` with `--repeat-each=2` gave 14/14 passed.
- **Earlier runs** (logged, all before the final battery): `e2e-early.log` was a full run with 5 failures, 96 passed, 2 skipped. Four were my own spec or test-ID errors (the plan A `data-contact-id` locator, `sand-victory-1` and `plays` assertions) and were fixed, and the fifth was the `sand-play-1-shots` stall. `e2e-rerun.log` (10 specs) and `e2e-rerun3.log` (5 tests) failed on the plan A locator and on two replay-spec assertions of my own (`record-scope-run` is absent in continuous mode; `sim-toggle-pause` is absent in WeGo), and again the shots stall. All were fixed before `8c41ebf`.

## Remaining limits and candid notes

- **Flaky harness, root cause is a hypothesis.**
  - `runUntilResult` clicked PLAY with no click timeout. If the result overlay appears between its visibility check and the click, the overlay intercepts the click and Playwright retries until the test timeout. I believe that is what stalled `sand-victory-1.spec.ts:110`.
  - The same stall signature hit `sand-play-1-shots` at 1440x900 in three earlier batch runs (the first full run, `e2e-rerun.log` and `e2e-rerun3.log`). That test passed alone, in the final full run, and in the post-fix repeat run.
  - I did not run the base to separate flake from regression. `runUntilResult` was changed to give the click and read a 2 s timeout, and the 14/14 repeat run passed.
  - The race is intermittent, so passing runs after the fix do not prove it is gone.
- **Score-decided endings are fixture-proven only.** The shipped Hormuz scenario has no score ending (score is a tally there). The score-decided win, draw and "SCORE DECIDED" note are tested with scripted events added to the live session.
- **Rule text is a presenter, not the evaluator.** `objective.ts` describes own-side and public endings only. Hidden or conditional endings show "OTHER ENDINGS NOT BRIEFED", which is deliberate but means the briefing can be incomplete by design.
- **No natural defeat play through the UI.** The two played solutions are both transit victories. Defeat is shown through the production combat path with a fixed-dice carrier kill, and the draw is a fixture.
- **Not done:** SAND-SAVE-1 (not admitted); the full E2E on the very last helper-only commit; image inspection of every PNG. I looked at: `1440x900-final-record-strip`, `1920x1080-fixture-score-victory-debrief`, `1440x900-play1-debrief`, `1440x900-play2-debrief`, `combat-1-carries/1440x900-A-review-fire-refusal-fixture`, `combat-1-carries/1440x900-A-staged-engage-cancelled`, and the failure screenshot of the flaky test. The rest are covered by the layout and intersection assertions, not by my eye.
- **Hygiene.** Full E2E runs overwrite other lanes' tracked evidence (`sand-play-1-s409`, `sand-wego-1-s409`, `sand-combat-1-s409`) and `next-env.d.ts`. I restored those with `git checkout --` before every commit. No stash was dropped or popped (`co3-t264-pre-victory` is still stash@{0}).
- **STEER.** `STEER.md` was checked at every checkpoint and before this report and never existed, so no steer entries were acted on.

## Image and JSON index

`docs/verification/sand-victory-1-s409/INDEX.json` has sha256 and byte size for every file in the evidence directory (74 files at `c386c11`). Key items:

- Debrief and strip PNGs at 1440x900 and 1920x1080: `fixture-score-victory/draw/carrier-loss`, `play-briefing`, `play1-debrief`, `play2-orders`, `play2-debrief`, `final-record-strip`.
- `combat-1-carries/`: staged, cancelled, receipt and refusal-fixture PNGs plus `plan-A-direct-flank-wego.json`, `plan-B-escorted-dogleg-continuous.json` and `frames.json`.
- JSON: `frames.json` (per-frame hashes, DPR 2), `strip-intersections.json`, `two-plays.json`, `replay-rounds.json`.
- Logs: `final/*.log`, `final/battery.txt`, `e2e-early.log`, `e2e-rerun.log`, `e2e-rerun3.log`, `unit-red-on-base.log`.

## FIX1 (S2-1, Opus review round 2)

`objective.ts` now walks TriggerEvent chains transitively (cycle-safe): an event that forces an ending is an ending route, a Time forcer sets `limited=true` and drops the "no time limit" note, and a forced target is never treated as pure transit. Hormuz briefing text is asserted byte-identical. Unit 290/290 and build pass (`final/fix1-unit.log`, `final/fix1-build.log`); no e2e run (land battery).
