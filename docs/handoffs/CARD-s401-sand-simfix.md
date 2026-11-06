Anchor: "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO." (SPEC.md, Ray 2026-11-03). This card finishes the four simulation fixes Dot's end review found incomplete, so the Hormuz demo ends, fights and sees the way the game shows it.

RAY-ASK: 2026-11-03 16:1x "we should make sure we aren't relying on any legacy buggy code or whatever as I remember sandkasten didn't really play perfectly when I tried it, so it should be looked at and made better if it isn't already, the idea being to make everything easy and streamlined."
RAY-ASK (push order): 2026-11-06 02:1x "if you're able to still push other projects like TKC, Dinky and Sandkasten at all its appreciated"
MOVES: a player who plays the Hormuz demo to its end gets the result that matches what happened on the water (a ship lost as it enters the gate is a defeat), a Red order no longer freezes Blue, fuel-dry missiles stop hitting, and Red strikes only what Red has detected; this clears the REJECT that holds sim-fix off Ray's Mac.
START: branch sand/sim-fix-s387 @ 7022130 (base fdac68d). Source: Dot RESULT #ask-dot-s400-4 (0 new S1 / 4 S2); the seat re-checked each against this tree and all four are REAL.

# FIX CARD: sim-fix completions S2-8 / S2-9 / S2-15 / S2-18 (s401 seat)

Rule for all four: write the failing test FIRST (vitest, `npm run test:unit`), watch it fail on the unfixed tree, then fix the cause. Every existing unit test stays green. Quote the red-to-green counts in NOTES.md.

## 1. S2-8: the 0.5 km arrival override ignores fuel (src/lib/simulation/combat.ts:203-204)
`arrived = (distToTarget <= 0.5 && wif.rangeRemainingKm > 0) || distToTarget <= reachKm` lets a weapon with any fuel left hit a target up to 0.5 km away.
Repro (Dot, executed): target 0.4003 km away, rangeRemainingKm 0.01, 530 kt, `runCombatPhase(state, combat, ctx(), 0.05)` gives an impact; correct is "ran out of fuel".
Required: a weapon never impacts a target it lacks the fuel to reach. The 0.5 km override applies only when `wif.rangeRemainingKm >= distToTarget`. The two existing S2-8 cases (0.111 km with 0.2 km fuel impacts; 5 km out of reach runs dry) stay green.
Test (`src/lib/simulation/__tests__/combat.test.ts`, inside "S2-8"): Dot's repro expects the fuel miss and no hit/defended entry; a 0.4 km target with 5 km of fuel and the same short step still impacts.

## 2. S2-9: mission doctrine overrides ignore side (src/lib/ai/events.ts:310-319 writes, src/lib/ai/effectiveDoctrine.ts:31-32 reads)
`missionDoctrineOverrides` is keyed by the bare mission name, so one side's order lands on every same-named mission.
Repro (Dot, executed): Blue and Red each have a mission named "Patrol" with free fire; `ChangeDoctrine { side: "Red", mission: "Patrol", changes: { roe: "weapons-hold" } }` makes BOTH sides' Patrol units hold.
Required: key the store by side plus mission reference (`action.side` is always present) in the writer, and read the same key for `unit.side` + `mission.id` / `mission.name` in `resolveUnitDoctrine`. Existing "P1" and "Quiet Patrol" tests stay green. Update the comment on `gameState.ts:68` if you change what the key means.
Test (`src/lib/ai/__tests__/ai.test.ts`, S2-9 block): two sides, same mission name, Red's hold applied; `resolveUnitDoctrine` for the Blue unit is unchanged and Red's holds.

## 3. S2-15: the scenario result is decided before combat (src/lib/simulation/engine.ts:123-147, terminal guard at :47)
Events run in Phase 4 on pre-combat state; combat in Phase 5 can then destroy the unit; the next tick returns at :47 because a result exists, so the defeat is never evaluated.
Repro (Dot, executed): the protected ship enters the gate on the tick a lethal weapon arrives: ship destroyed, result victory, still victory next tick. The demo has this pair (`scenarios/demoConfig.ts:188-211`, "Transit Complete" victory vs "Carrier Lost" defeat).
Required: a tick's final outcome is decided after the whole tick completes. Events still run before combat so doctrine changes take effect, but an `EndScenario` result is held until combat has finished, then terminal events are re-evaluated on post-combat state; defeat beats draw beats victory across both passes (`RESULT_PRIORITY`, events.ts). The second pass evaluates only events that contain `EndScenario` and must not double-fire any repeatable event. Once set, the result stays final and the substep loop still stops (:56).
Tests (new `src/lib/simulation/__tests__/terminal.test.ts`, using `fixedRoll()` and a one-hit-kill low-damage platform): unit inside the gate with a weapon arriving that tick, both demo events registered, expect `scenarioResult.result === "defeat"` after the tick and after a second tick; control without the weapon is victory.

## 4. S2-18: strike missions use the target's true position (src/lib/ai/aiController.ts:223-226, executeStrike at :212)
`allUnits.find(u => u.id === mission.targetUnitId)` then `targetPos = target.position` aims at the real unit even with an empty contact store.
Repro (Dot, executed): a Red strike mission with `targetUnitId` on a Blue ship and no Red contacts still gets a waypoint at the ship's exact position.
Required: `executeStrike` uses the acting side's own contact for the target (the per-side `threats` from `threatsFor`, already passed to patrol and CAP); with no contact it falls back to the mission's strike-area reference point (the existing fallback at :229-232) and never reads another side's unit position. Drop the now-unused `allUnits` parameter from `executeStrike`.
Test (`src/lib/ai/__tests__/ai.test.ts`): empty contacts, waypoint equals the reference point, not the ship; a Red contact reported offset from the true position, waypoint equals the reported position.

FENCE: only `src/lib/simulation/combat.ts`, `src/lib/simulation/engine.ts`, `src/lib/ai/events.ts`, `src/lib/ai/effectiveDoctrine.ts`, `src/lib/ai/aiController.ts`, the comment at `src/lib/simulation/gameState.ts:68`, the test files named above, and a short "s401 completions" section in `docs/handoffs/sim-fix-2026-11-03/NOTES.md`. Not in this card: platform ids and `src/lib/platforms/lookup.ts` (the platform-db reconciliation is its own later card), the NOTES `@@PLAY@@` placeholder, demo content.
Do not commit or push; the seat harvests the tree.
