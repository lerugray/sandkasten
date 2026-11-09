# CMO parity study excerpt (vendored for SAND-SAVE-1; source generalstaff-private state/sandkasten/study/CMO-PARITY-STUDY-2026-11-03.md, reviewed blob 28c981b8). Current code overrides stale statuses.

## 12. Time, turn and pause modes (incl. WeGo)

| Element | What CMO does | Sandkasten today | Parity call |
|---|---|---|---|
| Primary mode | Real-time pausable; product page lists "Play Style: Real-Time Pausable, Players: 1" (https://www.matrixgames.com/game/command-modern-operations) | Present — continuous time, pause, 1–60x (`src/lib/simulation/gameState.ts`) | MUST (done) |
| Time compression ladder | 1x/2x/5x/15x on a 0.1s pulse, then coarse 1s ("flame") and 5s ("double-flame") pulses (https://command.matrixgames.com/manual/07-6-simulation-philosophy-and-engine-internals/) | Present — 1/2/5/10/30/60x (`src/lib/simulation/gameState.ts` SPEED_OPTIONS) | MUST (done) |
| WeGo mode | **Not in commercial CMO.** WeGo-style asynchronous turn submission exists only in Command-PE (Professional Edition); an unofficial mod (IKE) adds PBEM/hotseat WeGo to CMO via Lua injection (https://command.matrixgames.com/manual/03-introduction/, https://github.com/musurca/IKE) | Absent — WeGo multiplayer planned (GDD §2.2, §8) | MUST for Sandkasten's roadmap — and it is a *differentiator*, not parity: commercial CMO does not have it (this corrects the "CMO decided to also offer WEGO" assumption in SPEC.md; CMO's v1.10 multiplayer is real-time, below) |
| Auto-slowdown / autopause | Single-player can auto-drop speed on events like new contacts (RTMP disables this) (https://command.matrixgames.com/manual/05-4-realtime-multiplayer/) | Present — configurable autopause (`src/lib/simulation/autopause.ts`) | MUST (done) |
| Saves & resume | Save/load games, autosave, and snapshot/resume what-if branching (https://command.matrixgames.com/manual/03-introduction/, /07-6-simulation-philosophy-and-engine-internals/) | Absent — README lists game save/load as a remaining gap | MUST — players bounce off losing an hour of progress |
| Turn flow (WeGo reference) | IKE model: fixed or Harpoon-style variable turn lengths, simultaneous order phases, auto-stop at turn end, loss/message summary per turn (https://github.com/musurca/IKE) | Absent — designed in GDD §2.2 | SHOULD consult IKE's public design when building WeGo |
| Determinism | Mixed: deterministic physics/sensors, stochastic weapon impact and damage (https://command.matrixgames.com/manual/07-6-simulation-philosophy-and-engine-internals/) | Present — same mix (`Math.random()` rolls in `src/lib/simulation/detection.ts`, `combat.ts`) | SHOULD — document the same philosophy |

## 15. Interface, tutorials and learning curve

| Element | What CMO does | Sandkasten today | Parity call |
|---|---|---|---|
| Manual | 350-page PDF/e-book manual plus the online manual used throughout this study (https://www.matrixgames.com/game/command-modern-operations) | Absent — in-game help panel instead (`src/components/game/help/HelpPanel.tsx`) | MUST for help panel (done); SHOULD keep a written manual-style doc set |
| Tutorials | 43 tutorial scenarios in the base game, 57 standalone scenarios, 600+ free community scenarios (CMO lead dev on Reddit: https://www.reddit.com/r/computerwargames/comments/1ihbi20/) | Partial — one demo scenario; one bundled tutorial scenario planned at MVP (GDD §10) | MUST — a guided tutorial path is the #1 answer to CMO's learning cliff |
| Onboarding time | Players report ~20–30 hours to work through the tutorials (https://steamcommunity.com/app/1076160/discussions/0/3199243212167852146/) | N/A (target: minutes to first contact) | MUST beat this — it is the anchor's core promise |
| Quick Battle Generator | Instant preset matchups (e.g. F-16 vs MiG-29) for fast play (https://command.matrixgames.com/manual/03-introduction/) | Absent | SHOULD — a "quick skirmish" button lowers the first-run barrier |
| Info presentation | Right-side info panel, context menus, databoxes; doctrine/WRA windows per unit/group/mission/side (https://command.matrixgames.com/manual/05-3-shortcut-buttons-and-windows/) | Partial — DetailPanel with Info/Sensors/Weapons tabs (`src/components/map/DetailPanel.tsx`) | MUST (done) — and keep it readable (14px rule, CLAUDE.md) |
| Why-did-that-happen feedback | Message log reports events (e.g. GNSS drift messages); doctrine deconfliction suggests fixes (https://command.matrixgames.com/manual/07-3-battle/, /05-3-shortcut-buttons-and-windows/) | Partial — combat log + message log (`src/components/game/CombatLog.tsx`, `MessageLog.tsx`) | MUST — and every "weapon won't fire" needs a stated reason (CMO's own pain point: https://command.matrixgames.com/manual/07-3-battle/) |
| 3D view | Tacview integration for real-time 3D; after-action playback only in Pro (https://www.reddit.com/r/computerwargames/comments/lsmq89/) | Absent | LATER — resolution playback planned for WeGo review phase (GDD §2.2) |
| Difficulty rating | Store lists difficulty "Expert" (https://www.matrixgames.com/game/command-modern-operations) | N/A | MUST target "approachable first hour" instead |
| Media/after-action flavor | None native (community AAR culture instead) | Present — InfoWar media feed via local LLM (`src/lib/infowar/`) | Differentiator, keep |

---

## Where players say CMO is hard to play

Concrete complaints from public discussion, each with the Sandkasten design answer it suggests.

1. **The learning cliff.** "it's learning curve is more like a learning cliff" (https://www.reddit.com/r/SeaPower_NCMA/comments/1h2hd7g/) and ~30 hours of tutorials (https://steamcommunity.com/app/1076160/discussions/0/3199243212167852146/).
   → Sandkasten answer: playable first scenario in minutes, one bundled tutorial, in-game help (`H`/`?`), autopause catching what a new player would miss.
2. **UI built for analysts, not players.** Graphics "like a software used for filling out tax forms crossed with Google maps" (https://www.reddit.com/r/SeaPower_NCMA/comments/1h2hd7g/); "the map, the resolution is terrible" (https://www.reddit.com/r/computerwargames/comments/1ihbi20/).
   → Sandkasten answer: modern map stack (MapLibre now, three.js-class graphics per SPEC direction), dark tactical theme, 14px minimum text (CLAUDE.md).
3. **Hard to know *why* something happened.** "What can be hard is knowing why you got certain outcomes and what you did good/bad" (https://www.reddit.com/r/computerwargames/comments/lsmq89/); CMO's own manual needs a long "My @#%^@#% weapon won't fire!!!" chapter (https://command.matrixgames.com/manual/07-3-battle/).
   → Sandkasten answer: readable combat log with reasons (weapon refused = stated envelope reason), doctrine deconfliction-style hints before mistakes happen.
4. **Opaque database.** "there are tags I can't find explanations for... Understanding the capabilities of sensor x vs target y takes testing" (https://www.reddit.com/r/computerwargames/comments/1ihbi20/).
   → Sandkasten answer: plain-language unit info panels (name, role, range in km, one-line description), not raw DB fields.
5. **One-solution scenario design.** "scenarios usually don't have strategic depth and boil down to either luck or single correct approach" (https://www.reddit.com/r/computerwargames/comments/12tgll9/); the AI "is not trying to solve problems. It is trying to follow orders" (https://forums.matrixgames.com/viewtopic.php?t=412902).
   → Sandkasten answer: SPEC's out-of-spec explicitly bans only-one-solution scripting; design scenarios with multiple viable axes (GDD §6.5: replayable a different way).
6. **Micromanagement tax.** Players intervene constantly to stop "situationally stupid" AI behavior (https://forums.matrixgames.com/viewtopic.php?t=397352); "Just too much micromanagement and overly complicated for no reason" (https://www.reddit.com/r/computerwargames/comments/12tgll9).
   → Sandkasten answer: missions + doctrine defaults that do the right thing, autopause instead of hovering, sensible salvo sizing (WRA) out of the box.
7. **Coordinating strikes is hard.** "The most difficult thing is synchronizing attack/arrival etc. times" (https://www.reddit.com/r/computerwargames/comments/lsmq89/).
   → Sandkasten answer: pause-anytime planning, waypoint ETAs on the map, and (LATER) flight-plan/time-on-target tooling.
8. **Price and content gating.** $80 sticker plus DLC campaigns (https://www.reddit.com/r/SeaPower_NCMA/comments/1h2hd7g/).
   → Sandkasten answer: free, open source, community scenario repository (GDD §7.3).
9. **No after-action replay in the consumer version.** Tacview is real-time only; playback is a Pro feature (https://www.reddit.com/r/computerwargames/comments/lsmq89/).
   → Sandkasten answer: combat log history now; WeGo review-phase playback on the roadmap (GDD §2.2).

## Top 25 MUST items

Ordered by what a first-time player meets first. (Status in parentheses.)

1. Open a scenario with a readable briefing and pick a side (present — `/play`, `src/lib/scenarios/`)
2. Dark tactical map, pan/zoom, NATO symbols (present — `src/components/map/`, `src/lib/symbols/`)
3. Continuous time: pause/play, 1–60x speed, scenario clock (present — `src/lib/simulation/gameState.ts`, `src/components/game/TimeControls.tsx`)
4. Autopause on new contact / attack / weapon impact (present — `src/lib/simulation/autopause.ts`)
5. Click a unit → readable info: name, type, speed, sensors, weapons (present — `src/components/map/DetailPanel.tsx`)
6. Waypoint orders with throttle settings (present — `src/lib/simulation/movement.ts`)
7. Altitude orders for aircraft (partial — orders carry altitude; sim use incomplete per README gap list)
8. Fog of war: own units fully known, everything else only via sensors (present — `src/lib/simulation/gameState.ts`)
9. Radar detection with range probability and radar horizon (present — `src/lib/simulation/detection.ts`)
10. Contact classification Unknown → Detected → Classified → Tracked with uncertainty circles (present — `src/lib/simulation/detection.ts`, `src/components/map/ContactLayer.tsx`)
11. Contacts fade and drop without fresh data (present — `src/lib/simulation/engine.ts`)
12. ESM: passive detection of active emitters — radiating reveals you (present — `src/lib/simulation/detection.ts`)
13. EMCON: radar on/off per unit (present — `src/lib/simulation/gameState.ts` radarActive)
14. Doctrine cascade side → mission → unit with ROE free/tight/hold (present — `src/lib/ai/doctrine.ts`)
15. Missions: patrol, strike, CAP, escort, transit, support with prosecution range (present — `src/lib/ai/missions.ts`)
16. Reference points and areas the player can draw (present — `src/types/game.ts`)
17. Fuel: consumption by throttle/altitude, bingo RTB (absent — top gap; air ops are fake without it)
18. Weapon envelopes enforced, with the *reason* shown when a shot is impossible (absent — the anti-frustration feature)
19. Missile engagements: launch → flight → intercept with visible tracks and PK rolls (present — `src/lib/simulation/combat.ts`, `src/components/map/WeaponTrackLayer.tsx`)
20. Layered defense: SAMs, CIWS, chaff/ECM/flares (present — `src/lib/simulation/combat.ts`)
21. WRA: sensible default salvo sizes per target type (present — `src/lib/simulation/combat.ts`)
22. Damage states with a readable combat log (present — `src/lib/simulation/combat.ts`, `src/components/game/CombatLog.tsx`)
23. Finite magazines: ordnance depletes and that decision matters (partial — counts deplete; no reload model)
24. Victory: score events, thresholds, end-scenario result the player can see coming (partial — scoring/events exist; no victory dialog)
25. Save/load game, and an editor to place units and save scenarios as JSON (save/load absent per README; editor present — `src/components/editor/`)

