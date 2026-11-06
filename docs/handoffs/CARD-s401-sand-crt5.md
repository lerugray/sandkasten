Anchor: "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO." (SPEC.md, Ray 2026-11-03). This card fixes the one defect Dot found in CRT round 5: the plot's adaptive resolution drops on a hitch and then cannot come back on a normal 60 Hz screen.

RAY-ASK: 2026-11-03 17:45 "its a little laggy on my mac but that could be for a number of reasons, maybe we are over engineering the UI a little bit as a looks a little vibecoded compared to like an old school terminal ... i figure it should look more like its on a classic monitor or CRT with bulkier/chunkier font and UI"
RAY-ASK (push order): 2026-11-06 02:1x "if you're able to still push other projects like TKC, Dinky and Sandkasten at all its appreciated"
MOVES: on Ray's Mac (60 Hz) /play stays sharp after a hitch: today one slow second can leave the plot at half resolution (effective DPR 1 at scale 0.5) for the rest of the session; after this, it returns to full sharpness within seconds of running smoothly. Clears the REJECT that holds round 5 (the three display modes) off Ray's Mac.
START: branch sand/crt-round5-wip-s388 @ 946d2de (base a3ff86f), card docs/handoffs/threejs-play-view-2026-11-03/ROUND5.md section 3 ("drop render scale when frame time stays over ~20 ms, recover when it is low"). Source: Dot RESULT #ask-dot-s400-5 (0 S1 / 1 S2). Seat verdict: REAL.

# FIX CARD: adaptive render scale recovers at 60 Hz (s401 seat)

## The defect (src/lib/plot/TacticalPlot.ts:1316-1332, `adaptScale`; state at :295-300)
`frameMs` is a moving average of the requestAnimationFrame delta. The drop test is `frameMs > 20`; the recovery test is `frameMs < 14`, three checks in a row. A rAF delta cannot go below the display's refresh interval, so on a 60 Hz display a perfectly smooth plot settles at about 16.67 ms and `< 14` is never true: the scale only goes down. Only a screen above about 71 Hz can ever satisfy it; Ray's Mac (A18 Pro MacBook) is taken as 60 Hz.
Repro (GS, per Dot): on a 60 Hz screen induce sustained slow frames until `__plot.renderScale()` drops, remove the load, run smoothly 10+ s: today the scale stays low.

## Required behaviour
- Recovery is refresh-aware. Track the display's own frame interval `refreshMs` (the lower envelope of recent rAF deltas, for example the 20th percentile of the last ~2 s, clamped to 4-34 ms) and recover when `frameMs <= refreshMs * 1.15` for 3 consecutive 1 s checks. Drop stays "frames over ~20 ms for a second" (the card), raised to `1.25 * refreshMs` only if that is higher.
- No flip-flop: if a drop follows an upgrade within 10 s, double the calm wait for the next upgrade (cap 30 s). A scene that cannot hold full scale settles at the lower scale instead of flipping every few seconds.
- The decision logic leaves `TacticalPlot` as a pure module `src/lib/plot/adaptiveScale.ts` (state plus `step(nowMs, frameDeltaMs)` returning the scale; no THREE, no DOM) so it can be tested at synthetic cadence. `TacticalPlot.adaptScale` calls it and keeps `forcedScale`, `resize()` on change and the `__plot.renderScale` / `setRenderScale` hooks exactly as they are.

## Failing-first test (`tests/plot-adaptive-scale.spec.ts`, Playwright runner, imports the module by relative path, no browser)
Port the current logic into the module unchanged first and write this first; case 3 must fail there, then change the logic:
1. Clean 60 Hz (16.67 ms deltas, 10 s): scale stays 1.
2. 5 s of 30 ms deltas: scale falls to 0.6 or lower.
3. Then 10 s of 16.67 ms deltas: scale is back to 1 (this is the one that fails today).
4. 120 Hz (8.33 ms) variant of 1-3 behaves the same.
5. Constant 25 ms deltas for 60 s after an upgrade: at most one upgrade attempt per 10 s, and at most three in total.
The lane GPU is SwiftShader (0.4-2.1 fps in Dot's evidence) so it cannot prove smoothness; do not claim it does. The seat repeats Dot's 60 Hz repro by hand on the Mac.

FENCE: only `src/lib/plot/adaptiveScale.ts` (new), the `adaptScale` method and its state fields in `src/lib/plot/TacticalPlot.ts`, `tests/plot-adaptive-scale.spec.ts` (new), and the "recovers after 3 s under 14 ms" sentence at `docs/handoffs/threejs-play-view-2026-11-03/NOTES.md:247-248`. Do not touch the CRT effects, label placer, palette, display-mode switch, simulation, scenarios, platform database or database viewer. Not in this card: the three failing tests in the author's NOTES, OFF-SIGNATURE font sizes, frame evidence.
Do not commit or push; the seat harvests the tree.
