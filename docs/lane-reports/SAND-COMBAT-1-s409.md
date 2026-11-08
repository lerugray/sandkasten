SAND-COMBAT-1 PARTIAL head=2f120c6987681e6c5cb0d9f2b504871509799492 history=pass player_view=pass own_damage=pass turn_membership=pass inspection=pass two_plans=pass unit=258/258 e2e=4/4 skipped=0 gpu=ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 3050), OpenGL ES 3.1)

**Why PARTIAL.** Product work, unit proof, the two-plan UI battles and the pixel set are done and committed. Only CP1 is pushed. CP2 and CP3 were not pushed, because the card requires the full `npm test` (unit, then serial real-GPU E2E, about 30 min measured at CP1, plus about 9 min for the new spec) before every push. From about elapsed 5,400 s the host slot was held by another operator's batch (mm-ui-a-build-s411, playwright pids 784967/784968). There was no room left for a 30-minute full battery before the 8,400 s report line. The header counts are what actually ran on the final product SHA: `unit=258/258` (full vitest) and `e2e=4/4` (the new `sand-combat-1-record.spec.ts` only, real GPU, `skipped=0`). The full-battery E2E on the final SHA was not run. The last full E2E ran on the CP1 SHA: 93 passed / 2 skipped / 0 failed (`cp1-e2e.log`). The production build was not run.

`head=` is the tested product SHA (`2f120c6`). The report commit that follows it is docs-only.

## Branch and checkpoints
Branch `s409/sand-combat-1`, cut from main `b0aa28935a259147d1ee43e1df2036717e07105b`.

| CP | SHA | state |
|---|---|---|
| CP1 | `b7999a00ea251f8c11c34a82f7a30ec5cbfedce8` | pushed after full unit 257/257 and full serial real-GPU E2E 93 passed / 2 skipped (30.0 m) |
| CP2 | `fca17fe` | local only, not pushed (full battery not run) |
| tested product head | `2f120c6987681e6c5cb0d9f2b504871509799492` | local only. Adds one unit test, 258/258 |
| CP3 | not reached | this report plus evidence are committed locally on top of `2f120c6` |

Not pushed: CP2, the unit-test commit and the report commit. Pushing them needs the full battery. Nothing was force-pushed, merged or tagged. The stash `co3-t238-recaptures` was not touched.

## Player-visible result
- **Complete record.** The COMBAT area has a full, paged record (`section.tx-record`, testid `combat-record`).
  - Categories: ALL ACTIVITY / COMBAT / INTEL.
  - Own-unit filter: a dropdown of own units.
  - Scope: ALL RUN / LAST RESOLVED TURN (WeGo).
  - Each row shows an absolute scenario time (`HH:MM:SSZ`) and a readable name: LAUNCH, DEFENDED, HIT, MISS, DAMAGED, LOST (plus KILL, INTERCEPT, INTEL).
  - Rows keep the source id (`data-source-id`) and source order.
  - Paging is 20 per page. It says `SHOWING a-b OF n // PAGE p/q`, with FIRST/PREV/NEXT/LATEST.
  - An empty result states the active filter and offers CLEAR FILTERS.
  - New rows arriving while the reader is on an older page show `NEW ACTIVITY +n LATEST` and do not move the page.
- **Fog.** One pure projection, `projectRecord` in `src/lib/simulation/combatRecord.ts`, feeds the record, the review preview, the debrief preview and the teletype.
  - Own-involvement rule: an event the player's side issued, or one that touches an own unit.
  - Enemy names come from the player's own contacts (classified name, else `TNxxxx CLS`, else UNKNOWN TRACK).
  - Incoming weapons read INCOMING WEAPON.
  - A hostile defender's countermeasure is shown as "a defensive system".
  - GOD view adds separately flagged rows (`GOD VIEW +n`). They disappear as soon as GOD is off.
  - The fog/GOD/paging test injects wifs and `Math.random=0.7`, in a scratch fixture only. The two battle plans use no injection.
- **Summaries.**
  - The turn review shows the latest 5 lines with `SHOWING LATEST 5 OF n THIS TURN // k EARLIER NOT SHOWN HERE` (or `ALL n OF n THIS TURN SHOWN`) and a VIEW RECORD (n) button.
  - The debrief shows the latest 8 with the total, VIEW RECORD, and the OWN FORCE line (for example `7 UNDAMAGED // 0 DAMAGED // 0 MISSION KILL // 1 LOST`).
  - Returning (BACK TO REVIEW / BACK TO DEBRIEF) restores exactly that held summary.
  - Opening the record changes neither clock nor mode.
- **Inspection in REVIEW.** Own units, losses included, can be inspected read-only from force rows, record rows (INSPECT <unit>) and the damaged/lost chips. `orders-locked` shows, `order-panel` is absent, `cmd-engage` is disabled and `cmd-commit` is absent. The detail panel no longer overlaps the review panel (`.tx-review.has-detail { right: 408px }`).
- **Damage.** Turn membership uses cursors (`turnEventCursor`/`turnMessageCursor`, set at commit), so the same-timestamp boundary is no longer double counted. Own damage uses the real union `undamaged | damaged | mission-kill | destroyed`, ranked exhaustively in `finishTurn`. Damage, mission kill and loss are three distinct words (DAMAGED / MISSION KILL / LOST).
- **Reset.** Reset and PLAY AGAIN clear the record state. The replay frames show a clean record.

## Two actual UI battles (fresh GOD-off Hormuz, no injected victory, no fixed dice)
Both runs reached the genuine scenario result through the ordinary UI. Receipts: `plan-A-direct-flank-wego.json`, `plan-B-escorted-dogleg-continuous.json`.

- **Plan A, direct/flank, WeGo 5-min turns.**
  - Result `[ VICTORY ]` ("DECIDED BY USS Nimitz entered the transit gate (afloat, undamaged)") after 37 turns.
  - Own force at the debrief: `7 UNDAMAGED // 0 DAMAGED // 0 MISSION KILL // 1 LOST`. Lost: Hornet 101 (turn 2 review: `YOUR LOSSES HORNET 101 LOST`). `YOUR LOSSES 1 // HOSTILE KILLS CONFIRMED 5`.
  - Turn 2 staged ENGAGE with Hornet 101 as shooter, captured the staged row (`A-staged-engage`), CANCELled it (`A-staged-engage-cancelled`, staged-fire count 0), re-staged and committed.
  - The turn-2 review shows the actual outcome (`eventsThisTurn` 12, Hornet 101 lost). The debrief record has 36 rows, and the Hornet 101 filter returns 12.
  - Limit: the JSON does not carry an explicit LAUNCHED/REFUSED field for the staged order. The outcome is evidenced by the turn-2 review and record rows only (see Limits).
- **Plan B, escorted + dog-leg, continuous.**
  - Result `[ VICTORY ]` ("DECIDED BY USS Nimitz entered the transit gate (afloat, undamaged)").
  - Own force at the debrief: `5 UNDAMAGED // 0 DAMAGED // 0 MISSION KILL // 3 LOST`. Lost: USS Cole (DDG-67), Hornet 101, Hornet 102. `YOUR LOSSES 3 // HOSTILE KILLS CONFIRMED 8`.
  - The record has 420 rows. The first window reads `SHOWING 1-20 OF 420 // PAGE 1/21`. The USS Cole filter (`us-ddg-2`) returns 353 rows.
  - The earlier SAND-WEGO-1 plan-B receipt reported two Hornet losses and Cole damage that its JSON/report omitted. Old artifacts are not rewritten; the new receipt states all losses.
  - On this run Cole is reported as LOST, not damaged. Both plans' losses are given as observed, favorable or not.

## Ray/SPEC trace (SPEC step 5, "Read the whole fight")
| need | where |
|---|---|
| Read the whole fight, not a truncated tail | `CombatRecord.tsx`, paging, 420-row run reachable page by page |
| Know what happened to my units | own filter, OWN FORCE line, chips, review `YOUR LOSSES`/`DAMAGE`, debrief `OWN FORCE`/`YOUR LOSSES` |
| No hidden information | `buildFog`, own-involvement rule, `assertNoLeak` on every surface in both plans, GOD split |
| WeGo review stays honest | cursor membership, `SHOWING LATEST 5 OF n` and `k EARLIER NOT SHOWN HERE`, VIEW RECORD |
| Orders locked while reading | six command families locked in REVIEW/RESOLVING/after a result; inspection read-only |
| Keyboard reachability | every control is a real button, `onMouseDown preventDefault` keeps focus. Enter/Space on these controls does not commit or advance, because the global handler only acts when the target is `document.body` (tested) |

## Red first (on the pinned base)
- `red-base-wego.log`: 2 of 28 wego tests fail on base, covering the same-timestamp turn boundary and own damage states.
- `red-base-legacy.log`: legacy log API renders 50 rows where 60 are expected, and 1 hostile-only row leaks where 0 are expected.
- `red-base-review-inspect.log` (spec text in `red-base-review-inspect.spec.ts.txt`): `expect(n).toBe(1)` fails because the detail panel is not shown in REVIEW.
- Not reproduced on base: that raw hostile-only text leaks into the COMBAT tab as a screenshot. Observed assertions only; no inferred browser failure.

## Commands and logs (all under `docs/verification/sand-combat-1-s409/` unless noted)
- Unit, final product head: `npx vitest run` gives 22 files, 258/258 (`final-unit.log`).
  - An earlier run of the same code had 1 failure: `unit/snapshot-seed.test.ts` "one request per second..." (`expected 876 to be greater than 900`). It is a wall-clock sleep-timing assertion in an unrelated file, hit under host load. The rerun passed 258/258. The failing run is kept as `final-unit-run1-flaky-fail.log`. I did not edit that test.
- Typecheck: `npx tsc --noEmit -p .` gives `tsc-final.log`: exactly 3 errors, all in `tests/sand-001-unit-placement.spec.ts` (lines 72, 80, 100; `string | null | undefined` not assignable to `string`). These are the base's 3 nullable errors; no new diagnostic.
- Targeted real-GPU E2E on the final product code: `cp2-targeted-record-spec.log` is `npx playwright test tests/sand-combat-1-record.spec.ts --workers=1`, 4 passed (8.9 m).
  - Env: `SAND_E2E_GPU=1 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA LD_LIBRARY_PATH=/usr/lib/wsl/lib SAND_E2E_PORT=3419`, with `nice -n 15`.
  - Tests: plan A WeGo, plan B continuous, fog/GOD/paging/place-keeping/empty-filter/reset, demo→snapshot→demo→legacy navigation.
  - The `--mute-audio` flag comes from the playwright config; it is not a CLI flag.
- CP1 full battery: `cp1-unit.log` (257/257), `cp1-e2e.log` (93 passed, 2 skipped, 30.0 m). The two skips are the capture-only osint-1 frames cases.
- Renderer recorded in the receipts: `ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 3050), OpenGL ES 3.1)`.

## Frame index and hashes (DPR 2, 26 frames, 26 distinct sha256; viewport set before selection)
Named states, each captured at 1440x900 and 1920x1080: `A-review-omitted-preview-and-record-access`, `A-review-inspect-own-platform`, `A-record-last-turn`, `A-staged-engage`, `A-staged-engage-cancelled`, `A-real-debrief`, `A-record-older-activity`, `A-record-own-unit-filter`, `A-replay-clean`, `B-record-older-activity`, `B-record-own-unit-filter`, `B-real-debrief`, `B-replay-clean`. No deliberate duplicates. Manifest: `frames.json`.

| frame | viewport | DPR | bytes | sha256 |
|---|---|---|---|---|
| 1440x900-A-review-omitted-preview-and-record-access.png | 1440x900 | 2 | 1248332 | `0082b999fefcf9b0a0d7f2ce58528bb5e07e083a653dd4d9e3f522e8fdfa91b1` |
| 1920x1080-A-review-omitted-preview-and-record-access.png | 1920x1080 | 2 | 1549010 | `99f4dcbf74350a5b5eabf96fd1074507c3009e9a810d59e15ed4b438ad397646` |
| 1440x900-A-review-inspect-own-platform.png | 1440x900 | 2 | 1206528 | `9417481b9a7a93fdb2c64b7f12b86757db3322703c26909ab5d069adda52cd5d` |
| 1920x1080-A-review-inspect-own-platform.png | 1920x1080 | 2 | 1432868 | `e218bdac4e8dc220fe1041bc579de9b638c1b96a014c708d76cf54e273990f29` |
| 1440x900-A-record-last-turn.png | 1440x900 | 2 | 1372006 | `d323228e1608a713a61cde4eb8717eda0afa139a15d44668d9380cdab7b4cd18` |
| 1920x1080-A-record-last-turn.png | 1920x1080 | 2 | 1694936 | `07ac5599e6c19a8b0c210ed868400195d3fe55d986a5fd1956cac2e2d3e49ff7` |
| 1440x900-A-staged-engage.png | 1440x900 | 2 | 1175882 | `dd45e0c6bf29a0484b6c7f048dc59f7e99f363513e8cca65baf82bb93465ee17` |
| 1920x1080-A-staged-engage.png | 1920x1080 | 2 | 1457076 | `e34183a67da02e8fc46e04ffdb8a52e0da7a505eae7be41c6417dbc9e47d9e65` |
| 1440x900-A-staged-engage-cancelled.png | 1440x900 | 2 | 1199181 | `72e63c7ea0aa6364c114ac7da9ef7c5046c0db68627feabe6c88da3f051a5379` |
| 1920x1080-A-staged-engage-cancelled.png | 1920x1080 | 2 | 1429959 | `9064b52f2c8a288303bec8bf6dab1a0ab3ac35d4aaa5b1b625fb13e65bc74b66` |
| 1440x900-A-real-debrief.png | 1440x900 | 2 | 1017785 | `87aa2c162f03504782e5a41823e9f2af2e9e91a95c735f3a2695c0842180b4df` |
| 1920x1080-A-real-debrief.png | 1920x1080 | 2 | 1201924 | `289022cef5302cc28231314fc4f98d8cf28261f55396145f85b32a5329f932ea` |
| 1440x900-A-record-older-activity.png | 1440x900 | 2 | 1298082 | `5d7b969665b66fed9c516a924b14346ae7ec25e1dd1344dc3b44fe10ffcbf262` |
| 1920x1080-A-record-older-activity.png | 1920x1080 | 2 | 1582232 | `d25fc77b8b76971bdd677bd7ba9221b251c24a746308a2f43f6cb4fad38fb0bd` |
| 1440x900-A-record-own-unit-filter.png | 1440x900 | 2 | 1213056 | `ece1e5732cb766c3e468a89f1390dfa099d3c5721c60e85aca560e8db83a71c8` |
| 1920x1080-A-record-own-unit-filter.png | 1920x1080 | 2 | 1477243 | `6a2bac8b74b8be2009c6aa64f154ce85f30841a6f9c2540db2c3fa665d662b43` |
| 1440x900-A-replay-clean.png | 1440x900 | 2 | 1611699 | `48d500300b47abc173c84fb19682bfb88a0a85613a6ca7d6e078f0af7448acff` |
| 1920x1080-A-replay-clean.png | 1920x1080 | 2 | 2246122 | `33749938f01aec3deb139fee9cce69ab2a8088016b0cf72e64a796181fc1089c` |
| 1440x900-B-real-debrief.png | 1440x900 | 2 | 1063160 | `ddac817edef01fdadc03feb7abc2a1a8fc2f7200d5fde86a30eccd9261bc4430` |
| 1920x1080-B-real-debrief.png | 1920x1080 | 2 | 1537627 | `195f30ef2a27ed4bad8b05b4bfb6976ddc97eab1afc4febf78ef979c13083760` |
| 1440x900-B-record-older-activity.png | 1440x900 | 2 | 1691318 | `d7285748e4fa1f98d4cdaaadfaaf41b99250a3b547de1e9a62fb38685132fe4d` |
| 1920x1080-B-record-older-activity.png | 1920x1080 | 2 | 2307729 | `b7a0fc94bffd0552025d902cc5977bcb9c6f95842021ebfe7b0c40fe3d2c5089` |
| 1440x900-B-record-own-unit-filter.png | 1440x900 | 2 | 1659608 | `5ce758f4c653240ecc5d934e993a68e1e69e3a88de1d6f493c13c374a8ae239e` |
| 1920x1080-B-record-own-unit-filter.png | 1920x1080 | 2 | 2284369 | `48fd29aac20ef0b02993434c96f2646821e158ab2c12e42a60cb7d2f7f6b0b35` |
| 1440x900-B-replay-clean.png | 1440x900 | 2 | 1521643 | `41c07cbb3adf50f829495926b3600de5250789a41841611b2779e794f1167f13` |
| 1920x1080-B-replay-clean.png | 1920x1080 | 2 | 2185654 | `81cbd19a35b4108400150da3986f237244104fa8fa253b26968470db437de7ca` |

I inspected the A review frame and the A debrief frame by eye (omitted count plus VIEW RECORD (9) readable; OWN FORCE and losses present). The remaining frames were captured by the spec, which asserts the named state before each capture (`staged-fire` count, `orders-locked`, record window text and so on). I did not individually view every frame, so the "each frame was inspected" requirement is only partly met.

## Twelve S3 dispositions (SAND-WEGO-1 end review)
1. **Fold.** Inspection in REVIEW: implemented and proven (unit, spec, red-first on base). Frames `A-review-inspect-own-platform`.
2. **Fold.** The review preview now carries the total, the omitted count and VIEW RECORD. The debrief likewise.
3. **Fold.** Cursor-based turn membership removes the duplicate boundary event while a new same-timestamp commit-time launch stays in the new turn (wego tests, red on base).
4. **Fold in evidence.** The new receipts state every own loss and surviving damage (A: Hornet 101; B: Cole, Hornet 101, Hornet 102). The old plan-B omission is noted above; old artifacts are untouched.
5. **Fold in captures.** The viewport is set before selection and orders visible after return are asserted. This was not individually eyeballed on every frame.
6. **Fold in captures.** 26 distinct hashes, with a manifest and no duplicate counted twice.
7. **Fold in captures.** Staged ENGAGE and CANCEL pixels at both sizes.
8. **Fold (partial).** The actual outcome of the staged order is visible in the turn-2 review and the record. The JSON has no explicit LAUNCHED/REFUSED field, so this is only partly folded.
9. **Defer.** Stale-contact falsification of the AI planning test: separate AI-test carry. No planner changes.
10. **Fold.** WeGo same-tick gate-arrival/carrier-destruction unit regression (defeat still wins, the record stops at the authoritative result) is in the new `wego.test.ts` additions.
11. **Defer.** The legacy "continuous only" label is outside the terminal record fence. Navigation to legacy is exercised.
12. **Defer.** Empty-turn pacing / resolve-until-contact needs a separate time-control decision. No auto-commit, skipped review, turn-length or balance change here. (Plan A took 37 turns including empty ones.)

## Failures, skips, and process disclosures
- One flaky unrelated unit failure, described above, which passed on rerun.
- The full battery on the final SHA, the production build and the CP2/CP3 pushes were not done (time and shared slot).
- Overlap with another operator. Several of my targeted spec runs, and probably the final `cp2-targeted-record-spec.log` run, overlapped with mm-ui-a-build-s411's playwright batch. I did not stop their processes. The slot-check reported FREE (rc 0) while a real playwright batch was running, and I confirmed the real process count by hand. My waiter script refused to start the subset while their batch ran. The overlapping runs are timing-sensitive evidence.
- My subset waiter (`work/run_subset.sh`: sand-003, sand-007, sand-play-1-objective, sand-play-1-result, sand-wego-1-flow) never ran. If it produced a log, it is stated in the last section below.
- Failures during development (all fixed, not left): a React duplicate-key warning in the record that raised the Next dev overlay and made clicks time out (keys added, ids deduped); the review panel clipped the omitted-count line and VIEW RECORD (flex-column CSS); a click on a disabled FIRST button hung to test timeout (`isEnabled` guard).
- Debug leftovers in `tests/sand-combat-1-record.spec.ts`: `console.log('STEP ...')` lines, console/pageerror listeners and an `SC1_TO` env timeout override. They are harmless but should be stripped before landing.
- Scratch `next-env.d.ts` churn and regenerated tracked evidence were reverted. `tsconfig.tsbuildinfo` is untracked and left alone.

## Remaining limits
- No full-battery E2E, no production build and no Opus review on the final SHA. GS must run these before landing.
- Fog names derive from today's contacts, not the knowledge at the time of the event. Some hostile launches read `TNxxxx DET` or UNKNOWN TRACK; the record never reveals the true name.
- Plan B (continuous) has no `record-last-turn` frame (no turns in continuous mode). A has one.
- The staged-order outcome is visible only through the review and record rows, not as a dedicated outcome frame or JSON field.
- Only the terminal /play display was changed. The legacy CombatLog API and legacy views are unchanged.
- SAND-SAVE-1 (save/export/reload) is not admitted and nothing was built for it.

## Steering
`STEER.md` was checked at the start of closeout and did not exist. No steer entries were acted on.
