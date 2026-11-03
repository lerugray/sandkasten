Anchor: "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO." This card delivers the play view rebuilt in Three.js in Ray's terminal register: a player opens /play and commands the Hormuz demo on the new display.

RAY-ASK: 2026-11-03 15:12 "we should be fully utilizing all the new UI/graphics improvements we have now, including implementing threejs or whatever the fuck its called and other tools like claude motion and whatever other tools we have now. for the UI, it needs to read more like a tom clancy style arcade/harpoon terminal as opposed to a flashy web app or saas but all that energy put towards a truly immersive and engaging setup if that makes sense"
RAY-ASK: 2026-11-03 15:2x "Build it in-game" (his pick over a mockup round)
MOVES: /play becomes the new Three.js terminal display on the real simulation; Ray judges the look in the running game.
Author: Opus 5.5 (one-line reason: 3D and motion look authoring in Ray's new register, the work Ray named Opus for on 11-02).

# BUILD CARD: the play view in Three.js, terminal register

Read first: `SPEC.md` (Direction: Look and feel; Out of spec), `GDD.md` §4-§5 and §9, `src/app/play/page.tsx`,
`src/components/map/*`, `src/components/game/*`, `src/lib/simulation/*`, `src/lib/symbols/milsymbolFactory.ts`,
`src/lib/scenarios/demo.ts`. The simulation, AI and data layers stay as they are; you replace how /play LOOKS and
FEELS, not what the game does.

## What to build
1. **A Three.js tactical display replaces the MapLibre map on /play** (add `three` as a pinned npm dependency). The
   editor (`/editor`) keeps MapLibre. Keep the old map reachable at `/play?map=legacy` for comparison only.
   - Scene: the theater as a naval combat-information plot: vector coastline and depth contours from public-domain
     Natural Earth data (vendored small GeoJSON, license noted), lat/long grid, range rings, sensor coverage.
   - Units and contacts as NATO MIL-STD-2525 symbols drawn as crisp vector glyphs (reuse milsymbol output as
     textures or redraw as geometry), each with a data block (name or track number, course, speed, altitude/depth).
     Track history dots behind moving contacts; contacts fade as their data ages (fog of war stays exactly as the sim
     reports it: only what your sensors see, God mode unchanged).
   - Weapons: missiles and their tracks animate in flight; intercepts and hits get a short, sharp effect.
   - Motion ("claude motion", code-drawn): a radar sweep on emitting ships, smooth pan and zoom with inertia, a
     subtle camera tilt mode that lifts the plot into a low 3D theater (low-poly relief, faint wireframe sensor
     domes). Motion is purposeful and readable, never decorative noise.
2. **Terminal register for all chrome**, as overlays on the scene (the scene never resizes for panels): monospace
   type (vendor an OFL font as woff2 with its license; no remote fonts), near-black field, one primary phosphor
   colour (green or amber, your choice, held consistently), one alarm colour, thin rules, bracketed labels,
   restrained scanline and bloom. A function-key style command bar exposes the existing controls (pause, speeds,
   sensor overlay S, measure M, God mode G, help ? or H). The message log reads as teletype traffic fed by the real
   combat log and autopause events. Unit, sensor and weapon panels keep their content in the new register.
3. **Immersive and engaging, never a web app:** no dashboard cards, rounded glassy panels, gradients, emoji or
   toasts. Original work: evoke the register; never reproduce any existing game's screens, layouts, logos or art
   (Harpoon, Tom Clancy titles and CMO included).
4. **Sound is out of scope** for this card (no audio added).

## Behaviour that must still work (every item, checked in the running game)
Select a unit and see Info/Sensors/Weapons; Shift+click pins range rings; S sensor coverage; M measure distance and
bearing; G God mode; waypoints and the four throttle settings; time controls (pause, 1x-60x); autopause on new
contact, damage, incoming weapon, intel message; contact classification Unknown -> Detected -> Classified -> Tracked
and fading; missile launch, flight, intercept, damage states; combat log; help panel; InfoWar tab (empty without
Ollama is fine); light theme may be dropped only if the terminal register has no light variant (say so in NOTES).

## Checks before you finish
- The Playwright suite passes. Behaviour tests (`sand-001`..`sand-006`, `simulation`, `smoke`) keep their intent;
  update selectors only, never weaken an assertion. Tests in `design-system.spec.ts` that pin the OLD look (blue
  accent, IBM Plex, MapLibre zoom controls) are superseded by Ray's 11-03 ruling: replace them with tests that pin the
  new register (font is vendored and loaded, no remote font requests, chrome overlays do not resize the canvas).
- `npm run build` passes; no console errors on /play.
- Captures with headless Chromium on THIS host using the GPU recipe (flags `--use-gl=angle --use-angle=gl-egl
  --ignore-gpu-blocklist --mute-audio`, env `GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA`):
  `docs/handoffs/threejs-play-view-2026-11-03/frames/` gets `first-screen.png` (1440x900, DPR 2, after 5 s of
  simulation at 10x with the salvo in flight), `unit-selected.png`, `tilt-3d.png`, `motion.webm` (8-10 s), and
  `renderer.txt` (the WebGL renderer string; it must name the NVIDIA GPU) plus `fps.txt` (median and 5th-percentile
  fps over 10 s; target 60 median, never under 30). Run
  `python3 /home/ray/lanes/_bin/clog-doctor-check.py --slot-check` before the Playwright suite and captures; exit 3
  or 4 = wait 10 min and retry (paid commission work holds the slot first).
- Look at your own frames and fix anything clipped, unreadable, overlapping or off-register before you stop.
- `docs/handoffs/threejs-play-view-2026-11-03/NOTES.md`: palette (hex), font and license, what moves, the
  behaviour checklist above with PASS per line, test counts before and after, known gaps.

No commits, no pushes; leave the working tree for the harvester.
