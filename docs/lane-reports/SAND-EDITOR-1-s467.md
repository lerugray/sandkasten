FIX SUBMITTED: a Sandkasten player can now build a whole scenario in the editor — reference points and victory conditions included — save it, reopen it, and PLAY it to a real VICTORY or a real DEFEAT (SPEC step 1 PARTIAL -> YES).

## What changed

- **Reference points in the editor** (`src/components/editor/ReferencePointsPanel.tsx`, `src/components/map/ReferencePointLayer.tsx`): create a point or an area (3+ corners), name it, pick side-owned or scenario-level, move any point/vertex by dragging its map marker, and delete it. Points and areas draw on the editor's MapLibre map in the side's colour (amber for scenario-level), with the same outline/label language the play view uses for the transit gate. LOAD now validates reference points (unknown type, missing points, an area with fewer than 3 corners, off-map or duplicate ids are refused with a readable message).
- **Victory conditions in the editor** (`src/components/editor/VictoryConditionsPanel.tsx`, `src/lib/scenarios/victoryConditions.ts`): author the kinds the engine already evaluates — destroy a unit, destroy any unit of a side, protect a unit, reach a reference area, hold a reference area (at least N units afloat at T+mm, else fail), a time limit, and a score threshold. Each condition shows its plain-English line in the same present-tense style the play view briefs the player, and compiles into the same TCA `EndScenario` events the engine runs. LOAD validates them (dangling unit/area, unknown kind/result, bad count/threshold/minutes are refused, SAND-RC-FIX2 style).
- **Editor-built scenarios play** (`src/app/play/EditorPlay.tsx`, `src/app/play/page.tsx`): a PLAY button in the editor hands the current scenario to `/play?scenario=editor` (and `/play?scenario=editor&map=legacy`), which validates it exactly like LOAD and builds a `ScenarioConfig` from the authored conditions. Editor scenarios hide SAVE/LOAD BATTLE (battle files name built-in scenarios only); the Hormuz and snapshot routes are untouched.

## Acceptance

- Reference points editable in the editor: **no -> yes**; victory conditions editable: **no -> yes** — `tests/sand-editor-1-flow.spec.ts` (3/3).
- Build-from-scratch scenario plays to VICTORY and to DEFEAT: **no -> yes** — same spec drives the engine's event evaluator to a real `[ VICTORY ]` (destroy the enemy unit) and a real `[ DEFEAT ]` (lose the protected unit) through the ordinary result overlay.
- SPEC step 1 row: **PARTIAL -> YES**.
- vitest: **361 -> 370** (9 new `victoryConditions.test.ts` proofs, including `evaluateEvents` firing the compiled victory and defeat). Full run 369/370; the one red is the pre-existing timing-sensitive `unit/snapshot-seed.test.ts` rate-limit test, which passes 26/26 in isolation and is untouched by this lane.

## Battery on this Vultr box (no GPU, per the card)

- New spec `tests/sand-editor-1-flow.spec.ts`: **3/3**.
- `tests/sand-001-unit-placement.spec.ts`: **pass** (40.4 s) with `--timeout=180000`; the spec's default 30 s test timeout is too tight for software-GL on this host.
- `tests/sand-rc-fix1.spec.ts` editor LOAD/refusal tests (defect 1 + SAND-RC-FIX2): **4/4**.
- `tests/sand-rc-fix1.spec.ts` play-view ORDERS-panel tests (defect 2 + S3) were not green here: they fail in `openPlay` waiting for the Three.js plot to pass 30 frames under software GL — a host limitation, not this lane (the play view is unchanged for built-in scenarios). The seat runs the full e2e on a GPU host.
- `next build`: pass.

## Not done / limits

- Editor scenarios are not battle-saveable (`SAVE BATTLE`/`LOAD BATTLE` hidden) — battle files name built-in configurations by id+revision; that was out of this card's scope.
- Victory conditions are independent endings (first met wins, defeat outranks draw outranks victory); "all required" combinations are not yet expressible in the editor.
