OPUS-REVIEW ACCEPT head=d17251b base=dbe7c811 answer=PARTLY S1=0 S2=0 S3=12

# SAND-WEGO-1 independent end review (Opus 5.5, co3-wegorev-t232, s260)

**Does a player now get an open-source CMO equivalent that is more player friendly than CMO: PARTLY.** The terminal plays one full Hormuz scenario in a clear Harpoon-style UI, and now in both continuous and WeGo modes, with plain phase prompts and one COMMIT/NEXT TURN key. That is friendlier than CMO's turn and pause handling, but it is still one scenario against one scripted AI, not CMO's breadth.

**Does the player get Ray's stated WeGo experience ("both singleplayer and wego", "headline it too")?** YES for the solo slice the card authorises. The first screen offers CONTINUOUS / WEGO and a 1/5/15 MIN turn length. Time is held while the player plans. COMMIT seals the orders of both sides from the same held state. The turn resolves for exactly one bounded interval, then a fog-filtered review follows, and the loop repeats until the real victory or defeat. Multiplayer WeGo is unbuilt and correctly not claimed. Feel caveat (S3-12): a 5-minute game needs 38 to 45 commits, and empty turns still cost two clicks each.

Reviewed tree: `s409/sand-wego-1` @ d17251b, with nothing tracked modified (only an untracked `tsconfig.tsbuildinfo`). d17251b differs from the tested code head 4827e37 in `docs/` only: `git diff --name-only 4827e37 d17251b` lists no non-docs paths. I changed no product code and ran no browser, E2E or build.

## 1. Diff findings (dbe7c811..d17251b, src/ read in full)

- **Fence:** the code delta is `session.ts`, `engine.ts` (a `simulationStep` export plus a `planAI` guard on Phase 0), `useSimulation.ts`, `TerminalPlay.tsx`, `terminal.css`, `HelpPanel.tsx`, `next.config.ts`, `playwright.config.ts` and tests. No platform, weapon, damage, scenario, event, objective, OSINT, font, AI-strategy or PRNG changes. No networking and no save. **In fence.**
- **Command timing and lock:** every tactical command goes through `updateOrders`/`engage`, which call `orderLock()` in the session (`session.ts` orderLock, updateOrders, engage). That covers waypoint, clear, throttle, radar, ROE and ENGAGE, so buttons, map gestures, hotkeys and direct methods are all refused in RESOLVING, REVIEW and after a result. The UI also drops the armed waypoint tool and fire target when orders close (`useEffect` on `ordersOpen`). `togglePause` is a no-op outside RESOLVING. `commit`/`nextTurn`/`cancelIntent` are guarded by phase, so a double COMMIT or NEXT TURN does nothing. Enter uses `!e.repeat` and a 400 ms guard, Space uses `!e.repeat`. Staged ENGAGE allows one intent per shooter, is checked at staging with `validateEngagement` against the shooter's own contacts, and is re-checked by `engageContact` once at commit. **OK.**
- **AI planning freeze:** `commit()` calls `runAIUpdate` once on the held turn-start `gameState`. `tickWeGo` drives `simulationStep(..., {planAI:false})`, which skips only Phase 0. Movement, detection, contact aging, TCA events, combat (auto-fire and defence with mission/doctrine context passed) and the Phase 6 terminal pass all still run. `runAIUpdate` → `threatsFor` → `contactsFor(state, side)` reads only the AI side's own contacts and skips unknowns; that code is unchanged from base. Nothing replans mid-resolve. **OK.**
- **Exact boundary:** fixed 1000 ms steps with `stepMs = min(1000, turnEnd - simTime)`, and the loop ends at `simTime < turnEnd`. Real dt is clamped to 2000 ms × speed. Leftover budget is discarded at `finishTurn`. A result breaks out on its own tick. It cannot overshoot or produce a second turn. Receipts: plan A ends at 09:06:15Z, 75 s into turn 38 (`turnStart` 1773565500000, `simTime` 1773565575000), and the review header shows `ELAPSED 05:00`. **OK.**
- **Fog in review:** `review` (TerminalPlay) keeps only events from the player's side or touching the player's units, runs them through the same `fog()` contact-name rule as the teletype, and shows only a contact *count*. Frames show `UNKNOWN TRACK` / `TN3946 TRK` and no hidden names, positions or orders. Raw `report.events` stays in session state and is not rendered. **OK.**
- **Continuous unchanged and default:** `mode` defaults to `"continuous"`, and `tick()` takes the old path verbatim when not in WeGo. The only continuous-visible changes are card-mandated: the HOLD cue is suppressed under a result, explicit briefing dismissal, and the "afloat" duplicate is removed. **OK.**
- **Test hook:** `window.__sandSession` needs `process.env.NEXT_PUBLIC_SAND_E2E === "1"`, which `next.config.ts` inlines (default `""`), as well as `window.__SAND_E2E__`. Only `playwright.config.ts` sets it. `build.log` exits 0 and the report says the emitted JS has no `__sandSession`. **OK.**

## 2. Acceptance table

| Card item | Verdict | Receipt |
|---|---|---|
| 1 Mode choice, default continuous, locked once started, held start, GOD off, 1/5/15 validated in session | PASS | unit `WeGo mode selection` (validates/locks), `the default mode is continuous…`; frames *-1, *-7; `godMode:"false"` in both plan JSONs. Snapshot says "CONTINUOUS ONLY". Legacy has no control, but also no "continuous" statement (S3-11) |
| 2 Plan without advancing; staged ENGAGE with cancel; no pre-commit side effects; one refusal; no double spend | PASS | unit `WeGo staged fire` (3 tests); `flow-queued-fire.json` and plan A `queued` (log 7→7, sim clock equal across a 2.5 s wait, log 20 after the turn) |
| 3 Commit both sides once from held state; AI from own contacts; no mid-resolve replanning; auto-fire/defence/events kept | PASS | unit `the AI plans once at commit…` (spy count 0→1→1→2), `a contact that first appears mid-turn gets legal weapons-free auto-fire, with no AI replan`; code read above. The own-contacts test is weak (S3-9) |
| 4 Exact interval, fixed substeps, early real terminal tick, turn count once, speed-independent outcomes | PASS | unit `WeGo exact resolution` (all three durations with irregular deltas and pauses, stalled frame at 60x, speed/cadence invariance with seeded RNG); plan A JSON timing |
| 5 Lock in session; pause holds but never reopens planning; alerts collected; no stale HOLD; idempotent double inputs | PASS | unit `every tactical command is refused while resolving and reviewing; inspection still works`, `pausing the burst holds it…`, `autopause preferences are kept but never interrupt…`; frames *-3, *-4 (`ALERTS NEW CONTACT DETECTED // INCOMING WEAPON DETECTED`). Exception: platform inspection is hidden in REVIEW (S3-1) |
| 6 Review then plan: turn, elapsed, own losses, fog-filtered record, NEXT TURN at held state, debrief on end, clean replay | PASS | unit `review advances no time and NEXT TURN opens planning at the exact held state`, `restarting after a result or mid-turn…`; frames *-4, *-5/6/8, *-7 |
| FINISH State and commands (red-first, separate sessions) | PASS | `red-on-base.log` (22 of 23 fail on base), unit `separate sessions never share turn state` |
| FINISH Exact resolution | PASS | as item 4. My own run: 236/237, with 1 timing flake in unchanged `unit/snapshot-seed.test.ts` (890 < 900 ms under nice 15) that passed 26/26 on rerun. Lane receipt `unit.log` 237/237 |
| FINISH Real scenarios (gate victory, carrier-loss defeat, no time/escort-only win, same-tick precedence, events once, restarts) | PASS | unit `WeGo and the real scenario` (4 tests). Same-tick precedence relies on the shared, unchanged Phase 6 path and has no WeGo-specific test (S3-10) |
| FINISH Two approaches, real UI, GOD off, fresh WeGo | PASS | E2E `plan A` / `plan B` drive only clicks and keys: `pickWeGo`, `orderShip`, `stageFire` via the `order-engage` button, `cmd-commit`, `cmd-next-turn`. The session handle is used for reads only. A: carrier alone, FLANK, 38 turns, victory 09:06:15Z, losses 2 (both Hornets), carrier undamaged, queued ENGAGE on turn 2. B: escorts plus dog-leg at FULL, 45 turns, victory 09:43:27Z, carrier undamaged. The plan B frame shows losses 2 and Cole damaged, which the report omits (S3-4). These are actual runs, not claims |
| FINISH Regression | PASS (receipts) | `e2e-full-4827e37.log`: 93 passed, 2 skipped (named `sand-osint-1-frames` capture-only), exit 0, ANGLE D3D12 RTX 3050; `tsc.log` has exactly the 3 baseline nullable errors; `build.log` exits 0; route spec covers demo→snapshot→demo→legacy |
| FINISH Look and evidence | PASS with S3s | 20 frames opened (table below); `fonts-*.json` minimum 12 px |

## 3. Frame table (every PNG opened)

| Frame | Verdict | Note |
|---|---|---|
| 1440x900-1-briefing-mode-choice | SHOWN-OK | MODE row, WEGO plus 5 MIN lit, explainer and footer legible; header `TURN 1 // 5 MIN [PLANNING]` |
| 1440x900-2-planning-orders-gate | SHOWN-OK | gate-focused, Nimitz WP1 in gate, FLANK, turn panel and COMMIT ORDERS (ENT) |
| 1440x900-3-resolving-lock | SHOWN-OK | `[RESOLVING 60X 04:03 LEFT]`, `04:03 OF 5:00 LEFT`, `ORDERS LOCKED: THE TURN IS RESOLVING.`, SPC PAUSE only |
| 1440x900-4-review | SHOWN-OK | losses, alerts, fogged record, NEXT TURN; covers the right third of the map (disclosed); record truncated (S3-2) |
| 1440x900-5-victory-debrief-A | SHOWN-OK | real victory, TURNS 38, losses 2; stale DESTROYED Hornet card behind overlay is inherited |
| 1440x900-6-victory-debrief-B | SHOWN-OK | real victory, TURNS 45, losses 2, Cole DMG visible |
| 1440x900-7-replay-start | SHOWN-OK | clean turn 1 planning plus briefing, no contacts or traffic |
| 1440x900-8-defeat-debrief | SHOWN-OK | `[ENDED]`, no HOLD, no NEXT TURN; fixture kill (disclosed) |
| 1440x900-9-gate-flat | SHOWN-OK | byte-identical to -2 (md5 5b467688…), so not independent evidence (S3-6) |
| 1440x900-10-gate-tilted | SHOWN-OK | gate as perspective trapezoid with WP1 leg |
| 1920x1080-1-briefing-mode-choice | SHOWN-OK | as 1440 |
| 1920x1080-2-planning-orders-gate | DEFECT (S3-5) | ORDERS panel for the selected Nimitz is scrolled out of view below an empty gap; only the route is shown |
| 1920x1080-3-resolving-lock | SHOWN-OK | `02:48 LEFT`, lock line, contacts on plot |
| 1920x1080-4-review | SHOWN-OK | review card legible, map mostly clear |
| 1920x1080-5-victory-debrief-A | SHOWN-OK | as 1440 |
| 1920x1080-6-victory-debrief-B | SHOWN-OK | as 1440 |
| 1920x1080-7-replay-start | SHOWN-OK | clean |
| 1920x1080-8-defeat-debrief | SHOWN-OK | as 1440 |
| 1920x1080-9-gate-flat | SHOWN-OK | orders, ROE and ENGAGE visible with gate; named carry 7 (26°45'N over QESHM INTL) visible |
| 1920x1080-10-gate-tilted | SHOWN-OK | tilted gate plus orders |

A new player can tell the phase from three places: the header tag, the left turn panel and the command bar's single primary action. Each phase has a one-line "what to do next" prompt.

## 4. Blockers

S1: none. S2: none.

## 5. S3 (non-blocking)

1. In REVIEW, the selected unit's DetailPanel is hidden (`TerminalPlay.tsx`, `selectedUnit && !(isWeGo && phase === "review" …)`), but card item 5 says platform inspection still works in REVIEW. Workaround: NEXT TURN, which advances no time.
2. The review record shows `review.record.slice(-8)` with no "more" cue. In the turn-1 frame, two INTL messages are dropped silently. The Combat tab still has the full log.
3. The review window uses `time >= turnStart`, so events stamped exactly at the previous `turnEnd` appear in two consecutive reviews (`session.ts` finishTurn).
4. The plan B receipt (JSON and lane report) omits YOUR LOSSES 2 (both Hornets) and the Cole damage, both shown in the debrief frame. Card fold item 3 asked for losses to be recorded honestly.
5. In `1920x1080-2-planning-orders-gate`, the orders panel is out of view because `shotBoth` resized after the selection. Orders are shown in 1920 -9/-10 instead.
6. `1440x900-2` and `1440x900-9` are byte-identical, so one frame is listed twice.
7. No pixel capture of a staged ENGAGE row with CANCEL (`FIRE ORDERS STAGED ≥1`). The evidence is JSON and tests only.
8. The plan A queued-fire receipt does not record the execution outcome (LAUNCHED or REFUSED).
9. The unit test `the AI reasons from its own contact store…` only checks empty contacts at t=0 and that no waypoint sits on a true US position. It has no stale-contact falsification. The code path passes on reading.
10. There is no WeGo-specific same-tick arrival/destruction precedence test. It relies on the unchanged shared Phase 6.
11. The legacy route does not state "continuous only". It has no inert control, but card item 1 says "say so".
12. Loop length: 38 to 45 turns, each needing COMMIT then NEXT TURN, with empty turns (plan B's last 27 min had no events). There is no "resolve until contact" option. This is a feel/balance carry.

Named map-layout carries 6 and 7 from SAND-PLAY-1 are still visible and were not counted.

## 6. Verdict

**ACCEPT.** Every material card contract is implemented in the session (the authority) and receipted. Phases, staged fire, a single AI plan from its own contacts, the exact boundary, fog-filtered review, unchanged default continuous play and a test-only handle all hold up in code and in the real-GPU receipts. Two real WeGo victories ran through the ordinary UI. I found no S1 or S2. GS may run the land battery.
