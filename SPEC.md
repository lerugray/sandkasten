**Sandkasten is an open-source naval wargame with graphics and an experience drastically more player friendly than the genre usually offers.**
(Ray, 2026-11-03: "drastically make the graphics/experience more player friendly". Source: GS-private pings inbox 2026-11-03 14:00. Reworded 2026-11-20 to drop a comparison with a commercial title.)

# SPEC — the anchor every card answers to

Every card quotes the sentence above on line 1 and names the step it delivers. Every end review opens with: "Does a player
now get an open-source naval wargame that is drastically more player friendly: YES / PARTLY / NO". This file changes only when
Ray changes his intent, quoting him.

## What the player does, in order
1. Opens a scenario (bundled or community-made) or builds one in the scenario editor. (GDD.md §7, README "Scenario editor")
2. Gives orders: waypoints and throttle, targets, rules of engagement, sensor use, aircraft launch and recovery, missions.
   (GDD.md §2.1)
3. Runs time: continuous with pause and speed control, or WeGo simultaneous turns (orders phase, then a resolution
   burst), a headline mode (GDD.md §2.1, §2.2; README hero "Continuous time or WeGo multiplayer"; Ray 2026-11-03
   "Headline it too"). Both modes ship (Ray 2026-11-03: "it should probably be both singleplayer and wego"); each
   scenario says which mode suits it.
4. Sees only what the sensors report: contacts move from unknown to tracked and fade without fresh data. (GDD.md §4)
5. Fights: missiles, air defense, countermeasures, damage, all in a readable combat log. (GDD.md §5, README "Combat")
6. Wins or loses on the scenario's victory conditions, and can play it again a different way. (GDD.md §6.5; Ray
   2026-11-03 names scenarios that are "scripted in such a way that only one solution is viable" as the thing to beat)
7. Saves a game in progress and resumes it later. (Ray, 2026-11-09 15:3x, asked "Should Sandkasten get save and
   resume?": "Yes, add saves". Source: GS-private pings inbox 2026-11-09, RULING row. Until then the SAND-SAVE-1 card
   was refused at the spec gate because this file did not cover saving.)

## Direction (Ray, 2026-11-03)
- Restart and push: "I want to restart development and start pushing again on sandkasten".
- Graphics: "the jumps that have been made in code graphics with our stack and threejs will make that project exceptional".
- Look and feel (Ray, 2026-11-03 15:1x): "we should be fully utilizing all the new UI/graphics improvements we have now,
  including implementing threejs ... and other tools like claude motion"; "for the UI, it needs to read more like a tom
  clancy style arcade/harpoon terminal as opposed to a flashy web app or saas but all that energy put towards a truly
  immersive and engaging setup".

## Out of spec
- Copying another game's files, art, text or data ("not to copy over", Ray 2026-11-03).
- A defense-analyst interface at the player's expense: Sandkasten is "built for players".
- A "flashy web app or saas" look (Ray 2026-11-03): no dashboard cards, marketing gradients or generic web-app chrome.
- Scenarios scripted so only one solution works (Ray 2026-11-03).
- "Differentiate on turn structure alone": Ray's 2026-11-03 pitch leads with a more player-friendly experience and look
  AND WeGo simultaneous turns (Ray 2026-11-03 15:2x: "Headline it too"); the 2026-06-12 memo's turn-structure-only thesis
  is superseded.

## Platform database (Ray, 2026-11-03 14:5x)
- "build our own": Sandkasten ships its own platform database, compiled independently for our engine.
- "we will need the same content": it aims to cover the real-world platforms, weapons and sensors a modern naval wargame needs.
- "we dont have to literally copy things given our engine is different": every record, value and text is Sandkasten's own,
  compiled from public sources; no build bundles or requires data taken from another game.
- First class (Ray, 2026-11-03 16:0x): "real pictures of hardware along with their complete specs and
  some understandable english as to how they are used and what kind of missions they are typically used for". Every
  platform entry carries photos, full specs, a plain-English "how it is used" and "typical missions". Photos are real and
  licensed: public domain (e.g. US government) or openly licensed (e.g. CC BY / CC BY-SA), each with its source, author,
  license and attribution stored beside it and shown in game; no image of unclear license and no image generator output.
- Treat it like a historical order of battle (Ray, 2026-11-03 15:0x): "wargames borrow those all the time and iterate on
  them to make them their own". The real-world facts are the shared starting point; our sourcing, abstractions and
  values for our engine make the database ours.
