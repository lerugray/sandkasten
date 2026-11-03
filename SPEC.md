**Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO.**
(Ray, 2026-11-03: "the opensource equivalent", "drastically make the graphics/experience more player friendly than CMO". Source: GS-private pings inbox 2026-11-03 14:00.)

# SPEC — the anchor every card answers to

Every card quotes the sentence above on line 1 and names the step it delivers. Every end review opens with: "Does a player
now get an open-source CMO equivalent that is more player friendly than CMO: YES / PARTLY / NO". This file changes only when
Ray changes his intent, quoting him.

## What the player does, in order
1. Opens a scenario (bundled or community-made) or builds one in the scenario editor. (GDD.md §7, README "Scenario editor")
2. Gives orders: waypoints and throttle, targets, rules of engagement, sensor use, aircraft launch and recovery, missions.
   (GDD.md §2.1)
3. Runs time: continuous with pause and speed control as the primary mode; WeGo simultaneous turns as a second mode.
   (GDD.md §2.1, §2.2; README hero "Continuous time or WeGo multiplayer")
4. Sees only what the sensors report: contacts move from unknown to tracked and fade without fresh data. (GDD.md §4)
5. Fights: missiles, air defense, countermeasures, damage, all in a readable combat log. (GDD.md §5, README "Combat")
6. Wins or loses on the scenario's victory conditions, and can play it again a different way. (GDD.md §6.5; Ray
   2026-11-03 names CMO scenarios that are "scripted in such a way that only one solution is viable" as the thing to beat)

## Direction (Ray, 2026-11-03)
- Restart and push: "I want to restart development and start pushing again on sandkasten".
- Graphics: "the jumps that have been made in code graphics with our stack and threejs will make that project exceptional".
- Parity: "a complete inventory/study of CMO, not to copy over for sandkasten but to have a strong basis for all the
  elements of parity we need to hit".

## Out of spec
- Copying CMO: its files, art, text or data ("not to copy over", Ray 2026-11-03).
- A defense-analyst interface at the player's expense (README: CMO is "built for defense analysts", Sandkasten is
  "built for players").
- Scenarios scripted so only one solution works (Ray 2026-11-03).
- "Differentiate on turn structure alone": the 2026-06-12 direction memo's thesis is superseded, because CMO now offers
  WeGo too (Ray 2026-11-03: "CMO decided to also offer WEGO functionality"). WeGo stays a mode, not the whole pitch.

## Platform database (Ray, 2026-11-03 14:5x)
- "build our own": Sandkasten ships its own platform database, compiled independently for our engine.
- "we will need the same content": it aims to cover the same platforms, weapons and sensors a CMO player can field.
- "we dont have to literally copy things given our engine is different": no record, value or text is copied from CMO's
  database. No build may bundle or require data extracted from a CMO install; `scripts/extract_cmo_db.py` output stays
  gitignored and local. (This replaces the "copy the CMO database" idea in Ray's first 11-03 message, per his ruling.)
- Treat it like a historical order of battle (Ray, 2026-11-03 15:0x): "wargames borrow those all the time and iterate on
  them to make them their own". The real-world facts are the shared starting point; our sourcing, abstractions and
  values for our engine make the database ours.
