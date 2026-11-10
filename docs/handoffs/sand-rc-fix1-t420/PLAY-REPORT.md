# Sandkasten: first-time play report

**Session:** 2026-11-10, 03:26:51Z to about 04:04Z of real time, so roughly 37 minutes of play out of the 90 I was given. I stopped early because I had reached the ending three times and the one scenario I could find had nothing left to show me.
**Setup:** headless Chromium (`--mute-audio`) driven by Playwright with a small file-queue driver script. I used only mouse clicks, wheel, drags and key presses, and judged everything from screenshots. **Audio was muted, so I heard nothing. Sound and audiovisual impact are unobserved.**
**Evidence:** about 110 screenshots and `notes.md`, all in this folder. File names are numbered in the order I took them.

## What the game is (as far as its screens told me)
- The title screen loads straight onto one scenario, **"Strait of Hormuz Standoff / Operation Sentinel Passage"**, on a green phosphor map of the Gulf (01-start).
- Goal: get USS Nimitz into a marked "transit gate" while it is still afloat. You lose if Nimitz is destroyed.
- The briefing says plainly that escorts, score and clock cannot decide the mission. It also offers a **mode choice**: CONTINUOUS (real time with pause, 1x/2x/5x/10x/30x/60x) or **WEGO** (turns of 1, 5 or 15 minutes: plan, commit, both sides resolve, review) (03-play, 70-wego).
- Forces: a carrier, a cruiser, three destroyers, two Hornets and a Hawkeye. Iran has radar sites, SAMs, aircraft and Boghammar fast attack craft.
- I found **only this one scenario**. The MAIN MENU just shows it again. The EDITOR opened a blank "New Scenario", and its LOAD button gave me a browser "This page couldn't load" page (68-edload). Its Back button recovered (69-back).

## First meaningful action
After the briefing I selected USS Nimitz in the FORCES list. An ORDERS panel appeared with ADD WAYPOINT, a THROTTLE row and an ROE row (07-nimitz).
- **Input:** I clicked **ADD WAYPOINT**, then made four ordinary left clicks on the map, each about 0.4 s from mouse down to up as my tool measured it, with no hold. Then I clicked ADD WAYPOINT again to stop placing.
- **Result I caused:** a dashed route WP1→WP4 appeared on the map from the carrier north toward the gate, and the panel listed `WP1: 25.xxxN 57.xxxE` and so on (12-waypoints). The clock was held, so nothing else moved. This was clearly my doing and not ambient motion.
- **What went wrong next:** I pressed **Space** to start the clock. Because the ADD WAYPOINT button still had keyboard focus, Space pressed that button again ("PLACING…"), and the clock stayed at HOLD (13-run1x). I recovered by clicking ADD WAYPOINT off and using the on-screen **PLAY** button (14-run1x).
- I repeated the same waypoint action in all three runs, and it worked every time.

## What happened: three playthroughs, three victories

**Run 1, continuous (03:29–03:44 real time).**
- Within about 2 game-seconds of PLAY, autopause stopped the clock on "new contact" (14).
  - Each autopause also flipped the left sidebar to the COMBAT tab, so my next click (FULL throttle) landed on the wrong thing.
  - I turned off the "New contact" and "Incoming weapon" autopause options in the AUTOPAUSE popup (16, 29). The settings stayed off after a page reload and after Play Again.
- My forward Hornet 102 was shot down by an enemy Sparrow/Phoenix around 06:07 game time (30-run60). The traffic log narrated launches, hits, misses and kills well.
- **Save test:**
  - SAVE BATTLE is a browser download, which my first driver didn't capture.
  - I restarted the driver with downloads enabled. That was a tool problem, not the game, and it cost me the run, which I replayed.
  - Partway through the replay I saved at T+00:30:37 and got the file `sandkasten-hormuz-T+00h30m-…sandsave.json`. A clear "BATTLE SAVED TO A FILE" toast explained it had gone to my downloads.
  - Then I **reloaded the page**. That brought back a fresh 06:00 briefing (51-reloaded).
  - LOAD BATTLE opened a dialog. My first CHOOSE FILE click did not seem to open a picker; on the second try the picker opened and showed a preview (T+00:30:37). LOAD restored everything (55-afterload): clock 06:30:37, 77 NM to the gate, my waypoints, the lost Hornet, the contacts and the speed.
  - **Save/reload worked.**
- After loading I set every ship to ROE FREE (select the unit, press **F**). The ROE label turned red (58-roe). The escorts then fired SM-2s and Harpoons at fast boats coming out of Bandar Abbas and logged several kills (59-engage).
- **VICTORY at T+03:59:54** (64-end): 1 loss, 10 kills. The dialog states that the "US NAVY 10 / IRAN 0" header is just a tally that did not decide the ending. I was confused earlier that it never changed during combat.

**Run 2, WEGO, 15-minute turns (03:45–03:55).**
- This was the most enjoyable part. Each turn goes:
  1. PLANNING: "Time is held".
  2. COMMIT ORDERS (Enter).
  3. About 15 s of real time while the turn resolves at 30x/60x. Orders are locked, but you can look around.
  4. A REVIEW card listing losses, damage and the turn's record, then NEXT TURN (Enter).

  (76–101.)
- I kept the Hornets back over the fleet and set the escorts to FREE. They killed boats on turns 3, 4 and 9 at stand-off range.
- **VICTORY at T+03:24:23 after 14 turns**: 0 losses, 7 kills (101-wegoend).
- I also saved a WEGO battle at T+00:45 (file in `/home/ray/w/play/saves`) but didn't reload that one.

**Run 3, deliberately reckless (03:56–04:01).**
- Carrier at FLANK, ROE HOLD, escorts at STOP, a straight run at the gate.
- Nimitz **stopped dead at its last waypoint** (0 kts with FLANK still highlighted, 116-r3) until I gave it more waypoints.
- Nothing ever attacked it. **VICTORY at T+04:10:23** with 0 losses (120-r6).
- So I never saw the losing screen. In my three tries the fast boats never got to the carrier, even undefended. The scenario felt toothless.

## Time, speed and latency
- **Play speeds used:** 1x briefly, mostly 30x and 60x. At 60x, game time matched screenshots: about 18 game-minutes in about 18 s real.
- **Clicking the wrong speed:** once I meant 5x and got 10x.
- **Turn timing:** WEGO turns took about 15–17 s of real time each.
- **Input-tool latency:** this was big, because headless software rendering is slow on this busy map.
  - Ordinary clicks: 0.1–0.7 s.
  - Wheel steps: 1.5–3 s.
  - Key presses: about 1–1.5 s.
  - One map drag (10 steps): **22.7 s**.
  - Each screenshot took 2–7 s.
- **What I can't judge:** smoothness or animation timing. Still screenshots several seconds apart don't establish it. I saw units, missile labels and range rings change *between* shots, not motion itself.

## Things that confused me or looked broken
- **The sidebar layout is fragile:**
  - The ORDERS panel often sat below the forces list, and the lower part of the sidebar rendered black or clipped until I wheel-scrolled it (22, 26, 83).
  - After visiting COMBAT, the orders panel seemed to vanish entirely until I scrolled.
  - **Adding waypoints pushes the THROTTLE/ROE rows down.** One of my pre-planned clicks meant for FLANK hit **STOP** instead, and another meant for ROE hit HOLD (110–111).
- **Clicking an already-selected unit doesn't bring its orders back** (81). I had to select a different unit and then re-select it.
- **Space acts on the focused button** instead of play/pause after you've clicked any sidebar button.
- **Escorts don't follow the carrier.** They hold their own course (315° at 18–20 kts) while Nimitz runs at 30 kts, so the "strike group" spreads out.
- **Hornets hover.** On reaching a waypoint, Hornet 101 showed 0 kts at FL250.
- **The camera re-centres on whichever unit you select.** That shifted my map-click coordinates between selections, and I placed at least one Hornet waypoint somewhere I didn't intend.
- **Some controls didn't respond to me:**
  - The MEDIA tab click didn't switch tabs (99).
  - Holding ArrowUp or W for 1 s didn't pan the map (105–106). Pan seems to be by mouse drag only, which was extremely slow in my setup.
- **Editor LOAD → browser error page.**
- **Only one scenario** that I could find.

## Things that delighted me
- The **WEGO loop**: planning, a locked resolve you can still watch, then a review card with "showing latest 5 of 11". It made a fast-moving fight readable.
- **Honest UI text throughout:** the score is a tally, there's no time limit, the save "cannot confirm it reached the disk", and "generated media posts are not saved".
- The **traffic log** reads like a real ops log: LNCH, HIT, MISS, DEFD ("defeated AMRAAM with a defensive system"), "ran out of fuel".
- **GOD view** reveals true contact identities in the log (BOGHAMMAR 501 instead of UNKNOWN TRACK) (103). **TILT** gives a nice 3D perspective of the map (104).
- **The look:** the phosphor-green map, range rings and OSM-sourced airfields and ports.

## How far I got
I won the only scenario I found three times: continuous with a save→reload→load in the middle, WEGO, and a reckless dash. I never lost and never saw a defeat screen. I did not explore the editor beyond the LOAD error, nor the SENSORS, MEASURE or ENGAGE tools in any depth.
