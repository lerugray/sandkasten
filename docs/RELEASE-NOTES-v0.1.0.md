# Sandkasten v0.1.0

Sandkasten is a free, open-source wargame. You command naval and air forces on a tactical map of the Strait of Hormuz. This is the first public release.

Play it free in your browser: https://csl-sandkasten.com

## What is in this release

- Two built-in scenarios. "Strait of Hormuz Standoff" puts a US carrier strike group against Iranian naval forces. "Hormuz air traffic, 6 November 2026, 19:02 UTC" is a real ADS-B snapshot of air traffic over the theater.
- Orders. Waypoints, throttle, targets, rules of engagement, and sensor use.
- Aircraft launch and recovery. A carrier or airbase holds an air wing. Aircraft launch, fly, and recover, with fuel and turnaround limits.
- Player missions. Create patrol, strike, and intercept missions and assign your own units.
- Two time modes. Continuous time with pause and speed control, or WeGo turns where both sides plan and then the turn resolves.
- Fog of war. You see only what your sensors report. Contacts fade without fresh data.
- Combat. Anti-ship missiles, air defence, point defence, countermeasures, damage, and a combat log.
- Victory and defeat. Each scenario ends on its own rules, with a debrief that names the deciding rule.
- Save and resume. Save a battle to a local file and load it later.
- A scenario editor at /editor. Place units, set sides, draw reference points, and write victory conditions in plain words.
- A platform manual at /database. 16 Hormuz ships and aircraft with real photos and specs.
- Real-world data. Airfields, ports, runways, radar and air-defence sites, and an ADS-B snapshot.

## How to play

Open https://csl-sandkasten.com to play the Strait of Hormuz scenario (also at /play). The real ADS-B snapshot is at /play?scenario=snapshot. The editor is at /editor. The platform manual is at /database.

Keys: B for the briefing, Space to pause, 1 through 6 for speed, H or ? for help. E engages the chosen contact, N moves to the next contact, R cycles rules of engagement, F is weapons free, X is weapons hold. S toggles sensors, M measures, G toggles god mode, T tilts the plot, A toggles autopause.

## Known limits

- Single player. WeGo turns are against the AI. There is no online multiplayer yet.
- One theater: the Strait of Hormuz.
- The platform manual covers 16 Hormuz platforms. The full roster comes later.
- No submarines or ground units yet.
- The media feed needs a local LLM (Ollama) and is off in the web release.
- The web release has no audio and no live snapshot fetching. The snapshot is a committed example from 6 November 2026.
- Battle saves are local files in your browser. There is no autosave, no save slots, and no cloud storage.
- Aircraft altitude and climb are simplified. Magazine management is simplified.

## How to report a bug

Open a new issue on the GitHub repository and use the bug report template. Say what you did, what you expected, and what happened. Include your browser and device.
