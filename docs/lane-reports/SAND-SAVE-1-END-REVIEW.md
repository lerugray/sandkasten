SAND-SAVE-1 END-REVIEW VERDICT: ACCEPT S1=0 S2=0 S3=3

Open-source CMO equivalent, friendlier than CMO: PARTLY (save and resume now work as a player expects).

Reviewer co-seat 3 t405 (Opus 5.5). Candidate `claude/sand-save-1-lane-mmiq6g` `3102005`, code at CP3 `87737e8`; base `69ee411d`.

## 1 Card requirements
- Versioned codec, checkpoint/restore boundary: MET (`battleSave.ts:26-122`, `session.ts:614,654`).
- State inventory: MET. I checked every field of the session, GameState, AIState, CombatState and EventState, plus all module `let`s. Nothing that affects the outcome is missing.
- Revision covers SIMFIX profiles and the definition: MET (`builtins.ts:37-50`, `lookup.ts:291`). No module config swap: MET.
- Restore-safe ids: MET (`battleSave.ts:740-746`, reserve* in engine/combat).
- Controls, preview, confirm, paused load, clean view, media excluded: MET (`TerminalPlay.tsx:468,500,883`, `BattleFile.tsx:13`, `useInfoWar.ts:41,81`, README:126).
- Round trip, same-stream continuation, boundaries, refusals: MET (`battleSave.test.ts:75-437`).
- Fresh-page resume to victory and second plan: MET (`resumed-run.json`, `second-plan.json`; rerun in 5).
- Touched S3 #8: NOT MET (S3-1).

## 2–4
No S1 or S2. Continuation equals the uninterrupted control. Loading: 8 MB bound, prototype keys refused, fields copied, text rendered as text. Refusal is pure, and the swap happens only after restore returns. My hostile edits of a real save (prototype keys, dangling contact, negative damage, WeGo state in a continuous battle) were refused, with no pollution. No rule, data or control changed: engine/combat gained counter accessors only.

## 5 Runs (SwiftShader, `--mute-audio`)
- vitest 306/306, exit 0. `tsc --noEmit` exit 2: the 3 errors base already has in an untouched spec.
- Lane save specs, `--workers=1`: 6/6 passed (22 min, 0 skipped). My rerun resumed the real checkpoint in a fresh page to VICTORY at hour 3.10. The second plan won at 3.70.
- Hands-on: I saved at T+00:06:02 while 60x ran, and [HOLD] showed. Then I reloaded the page and used LOAD BATTLE. The battle came back paused at the same clock (unchanged 3 s later), with no briefing, selection or God mode. Log, weapons in flight, ammo, fired events, score and orders were all equal. PLAY continued with no refill and no repeat. 0 page errors.

## Findings (S3)
1. `33d54f1` committed `next-env.d.ts` churn (`.next/dev/types`), but the report says it did not. Revert that line.
2. A crafted file is accepted when a unit has no orders entry, or its damageState disagrees with its damage. WeGo `contactId` is unchecked. Each of these ran without a crash, and a real save never produces them.
3. Fence: the brief names `gs/sand-save-1-review-t405`, but this session may push only to `claude/sand-save-1-review-t405-8fata1`.
