Anchor: "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO." This card delivers the look bake-off for the play view: three rendered directions Ray picks from, so the build lanes implement a look he has seen.

RAY-ASK: 2026-11-03 15:12 "we should be fully utilizing all the new UI/graphics improvements we have now, including implementing threejs or whatever the fuck its called and other tools like claude motion and whatever other tools we have now. for the UI, it needs to read more like a tom clancy style arcade/harpoon terminal as opposed to a flashy web app or saas but all that energy put towards a truly immersive and engaging setup if that makes sense"
MOVES: Ray's pick becomes the design register every Sandkasten UI card builds from; without it the Three.js build has no approved look.

# CARD: play-view look bake-off (three directions)

Three lanes, one direction each, on home-PC. Your lane name ends in `-A`, `-B` or `-C`: do ONLY your direction.
Read `SPEC.md` first (Direction: Look and feel; Out of spec). Then `src/lib/scenarios/demo.ts` and `demoConfig.ts`: every
direction shows THAT scenario (Strait of Hormuz, the real unit names and sides in it) mid-engagement: a carrier group's
radar holding several contacts, one anti-ship salvo in flight, one being intercepted, fog of war visible.

## The common deliverable (each lane)
Folder `opendesign/mockups/play-view-<a|b|c>/` containing:
1. `index.html`: ONE self-contained page, no build step, no framework. Three.js vendored into the folder as a pinned
   module file (e.g. three@0.170.0 `three.module.js` from the npm package or jsdelivr, with its MIT LICENSE beside it).
   Fonts vendored as woff2 with their OFL license file; never Google Fonts or any remote URL at runtime. Coastline and
   depth from public-domain data (Natural Earth) vendored as a small GeoJSON. Units drawn in code (NATO MIL-STD-2525
   symbology or code-built low-poly meshes): no image-generator output, no art copied from any game.
2. The page animates on its own (no input needed): at least radar sweep or track updates, the salvo flying, the
   intercept. This is the "claude motion" part: code-drawn motion, smooth, purposeful, never decorative noise.
3. Chrome (panels, HUD, command bar, message log) is an OVERLAY on the scene; the scene never resizes for it.
4. `frames/first-screen.png` at 1440x900 CSS px, device scale factor 2, captured after 4 s of animation; and
   `frames/motion.webm` (6-10 s) of the same view. Capture with headless Chromium using the GPU recipe:
   flags `--use-gl=angle --use-angle=gl-egl --ignore-gpu-blocklist --mute-audio`, env `GALLIUM_DRIVER=d3d12
   MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA`. Write the WebGL renderer string into `frames/renderer.txt` (it must name the
   NVIDIA GPU; SwiftShader/llvmpipe means the capture is invalid: fix the flags). Before capturing, run
   `python3 /home/ray/lanes/_bin/clog-doctor-check.py --slot-check`; exit 3 or 4 = wait 10 min and retry (paid
   commission work holds the slot first).
5. `NOTES.md`: palette (hex), type, what moves and why, and one paragraph on how it would carry into the full game
   (order panel, unit panel, time controls).

## Direction A: "Combat information center plot" (top-down terminal)
The tactical plot is the hero. Orthographic Three.js scene: vector coastline and depth contours, range rings, track
symbols as glowing vector glyphs with history dots and data blocks, a sweeping radar. A phosphor terminal register
(near-black field, green or amber primary, one alarm colour), monospace type, scanline and bloom used with restraint,
a teletype message log, bracketed function-key command bar. It must read as a naval combat terminal, instantly legible.

## Direction B: "Theater 3D" (techno-thriller arcade)
A perspective Three.js theater at night or dusk: code-built low-poly sea surface and terrain relief, ships and aircraft
as faceted low-poly silhouettes, sensor coverage as faint wireframe domes, missile arcs with trails, an intercept flash.
A terminal HUD overlay (monospace, thin rules, target brackets, bearing and range readouts). The camera glides slowly
during the clip. Cinematic energy, still a command display, never a shooter.

## Direction C: OFF-SIGNATURE (author: do not read anything but SPEC.md line 1 and the scenario files)
Your own interpretation of an immersive, engaging play view for this scenario that is deliberately NOT a green/amber
terminal and NOT a 3D theater. Label the page and NOTES.md "OFF-SIGNATURE". Same technical rules (Three.js, overlay
chrome, code-drawn, vendored assets, captures).

## Rules for all three
- Evoke the register; never reproduce any existing game's actual screens, layouts, logos, fonts or art (Harpoon, Tom
  Clancy titles or CMO included). Original work only.
- No "flashy web app or saas" tells: no dashboard cards, rounded glassy panels, marketing gradients, emoji, toasts.
- Touch nothing outside your `opendesign/mockups/play-view-<x>/` folder. No app code changes. No commits, no pushes.
- The repo's Playwright battery does not apply (no app code changes); your checks are step 4's captures and renderer
  string. Do not start the Next.js dev server.
- Done = all five deliverables present, `renderer.txt` names the NVIDIA GPU, and you have looked at your own
  first-screen.png and fixed anything clipped, unreadable or overlapping.
