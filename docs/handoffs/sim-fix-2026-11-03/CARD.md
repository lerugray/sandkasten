Anchor: "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO." This card makes the simulation play correctly: the player can fight, damage adds up, and the systems a player relies on behave as shown.

RAY-ASK: 2026-11-03 16:1x "we should make sure we aren't relying on any legacy buggy code or whatever as I remember sandkasten didn't really play perfectly when I tried it, so it should be looked at and made better if it isn't already, the idea being to make everything easy and streamlined."
RAY-ASK: 2026-11-03 16:1x "Both (Recommended)" (the Hormuz demo stays a fixed-date standoff with every unit fact-checked for its date)
MOVES: a player can command the Hormuz demo and actually fight it to a real result; today the player side can never fire and large ships never take damage.
Author: Sonnet 5.5 (build); end review on a different model.

# BUILD CARD: simulation fix pass (Dot audit S1/S2 + demo fact check)

Source of findings: `docs/audits/SIM-AUDIT-2026-11-03.md` on branch `dot/sandkasten-sim-audit` (commit 2d74c07; read it with
`git show origin/dot/sandkasten-sim-audit:docs/audits/SIM-AUDIT-2026-11-03.md`). The seat verified S1-1 and S1-2 in code.
Every other finding is a claim until you reproduce it.

## Method (every finding)
1. Write a failing unit test that reproduces the finding from the audit's receipt (vitest or the repo's existing runner; add
   one if none exists, `npm test` must run it). If you cannot make it fail, mark the finding NOT REPRODUCED in NOTES with
   what you tried, and do not change code for it.
2. Make the smallest fix the audit names (or a better one you justify), test goes green, no other test weakens.

## Scope
- **S1-1 player fire.** Give the player real engagement, using only what their sensors know (never true positions):
  (a) an ENGAGE order: select own unit, select a contact that is at least DETECTED, choose a weapon (or AUTO), launch;
  validation shared with the AI (range, ammo, target domain, weapon state); (b) player-side rules of engagement
  WEAPONS FREE / TIGHT / HOLD per unit (default TIGHT: self-defense against incoming weapons and contacts classified
  hostile), driven by the existing doctrine fields. Expose both in the existing order panel and as keys in the command bar
  (keep the terminal register; no new visual style). A Playwright test: the US side fires at an Iranian contact through
  the UI, and self-defense fires under TIGHT.
- **S1-2 damage.** Persist accumulated damage per unit; every successful hit subtracts; damage states derive from the
  total. Keep any deliberate one-hit rule for aircraft separate and named.
- **S2-1 .. S2-19**: all of them, by the method above.
- **Demo fact check (section 3):** correct `demo.ts` / `lookup.ts` for the stated date 2026-03-15 using the audit's public
  sources: replace USS Bunker Hill (CG-52, retired 2023) and USS Taylor (FFG-50, retired 2015) with ships in service on
  that date in a plausible carrier group role (cite a source for each in a comment); fix the obsolete SM-1 fit; leave
  unverified loadouts as they are but list them in NOTES. Do not change the scenario's date or premise.
- **S2-15 victory:** the demo wins on a successful transit (per the scenario text), not on elapsed time.
- Out of scope: the play view's look (src/lib/plot, src/components/terminal, terminal.css) except the minimal order-panel
  and command-bar hooks for ENGAGE and ROE; section 2 "streamline" items (they go to Ray after he plays); the S3s.

## Checks
- `npm run build` passes; the full Playwright suite passes on home-PC's GPU (lane-local config: copy
  `/home/ray/lanes/sand-threejs-play-s386/pw-gpu.config.ts` beside your tree and point REPO at your tree; run
  `python3 /home/ray/lanes/_bin/clog-doctor-check.py --slot-check` first, exit 3/4 = wait 10 min); every new unit test
  passes; test counts before and after in NOTES.
- One scripted play check: at 10x on /play, the US side engages and damages an Iranian unit, a large US ship takes
  cumulative damage from repeated hits, and the scenario reaches a result. Record the combat-log lines in NOTES.

`docs/handoffs/sim-fix-2026-11-03/NOTES.md`: per finding FIXED (test name) / NOT REPRODUCED (why); demo corrections with
sources; test counts. No commits, no pushes; leave the working tree for the harvester.
