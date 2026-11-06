<div align="center">

![Sand Table](US_Army_53265_2LTs_complete_Leader_Forge.jpg)

# SANDKASTEN

**Open-source wargame simulation. NATO symbology. Real-world platform data. Continuous time or WeGo multiplayer. Fog of war. Community scenarios.**

*Named for the German military sand table used for operational planning.*

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![MapLibre](https://img.shields.io/badge/MapLibre-GL-blue)
![Three.js](https://img.shields.io/badge/Three.js-r187-black)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

---

## What Is This?

A tactical wargame inspired by [Command: Modern Operations](https://www.matrixgames.com/game/command-modern-operations). Command naval and air forces on a tactical map against scripted opponents. Radar detection, anti-ship missiles, SAM defense, fog of war. Continuous time with pause/play/speed controls.

Shares its map renderer and NATO symbology with [Auftragstaktik](https://github.com/lerugray/auftragstaktik), a tactical OSINT terminal. Sandkasten imports real-world snapshots from Auftragstaktik as playable scenario starting positions.

### How It Differs From CMO

| | CMO | Sandkasten |
|---|---|---|
| **Cost** | $80+ | Free, open source |
| **Platform database** | Proprietary (CWDB), no photos | Our own, sourced and open: real licensed photos, full specs, plain-English briefings |
| **Scenario scripting** | Lua + complex editor | Visual trigger-condition-action system |
| **UI** | Built for defense analysts | Built for players |
| **Multiplayer** | TCP/IP real-time | WeGo simultaneous turns (planned) |
| **Real-world data** | None | OSINT snapshots via Auftragstaktik (planned) |

---

## Current State

### Play View (Three.js terminal display)
- `/play` draws the theater in Three.js as a naval plot: Natural Earth coastline and depth contours, lat/long grid, range scale
- NATO MIL-STD-2525 glyphs with data blocks (name or track number, course, speed, flight level) that move aside so they don't overlap
- Track history dots, contacts fade as their data ages, radar sweeps on emitting units
- Missiles fly with trails and target lines; intercepts and hits flash briefly
- Drag to pan (it coasts when you let go), wheel to zoom at the cursor, `T` tilts the plot into a low 3D theater with NOAA relief, wireframe sensor domes and aircraft at altitude
- Terminal chrome: vendored JetBrains Mono, one phosphor green, one alarm red, function-key command bar, teletype traffic strip fed by the combat log, intel and autopause
- Keys: `Space` pause, `1`-`6` speed, `S` sensors, `M` measure, `G` god mode, `T` tilt, `A` autopause, `H`/`?` help
- The old MapLibre map stays at `/play?map=legacy` for comparison

### Foundation
- Dark tactical map with NATO MIL-STD-2525 symbols (home page, editor, legacy play view)
- Demo scenario: US carrier strike group vs. Iranian naval forces, Strait of Hormuz
- Click units for detailed Info/Sensors/Weapons panels
- Shift+click to pin sensor range rings
- Sensor coverage overlay — toggle radar coverage circles (`S` key)
- Measurement tools — click two points for distance/bearing (`M` key)
- Dark/light theme (MapLibre pages; the terminal play view is dark only)
- Scenario editor at `/editor` — place units, drag to reposition, set sides, save/load JSON
- Platform manual at `/database`: 16 Hormuz platforms (ships and aircraft) with real open-license photos and credits, sourced specs, plain-English "what it is / how it is used / typical missions", sensors, weapons, defenses and a numbered bibliography. Records live in `src/data/platforms/records/`; the simulation reads them through `src/lib/platforms/lookup.ts`. Estimation methods are in `src/data/platforms/METHODS.md`. Nothing is copied from CMO.

### Simulation
- Real-time simulation at `/play`
- Waypoint-based movement with four throttle settings
- Radar detection (range-based probability, radar horizon)
- ESM passive detection of active emitters
- Contact classification: Unknown → Detected → Classified → Tracked
- Fog of war — you see only what your sensors report
- God mode toggle to see all units (`G` key)
- Contacts degrade and fade without fresh sensor data
- Time controls: pause/play, 1x through 60x speed
- Autopause on new contacts, damage, incoming weapons, intel messages (configurable)

### OPFOR AI
- Doctrine: ROE, engagement range, radar usage, evasion, withdrawal
- Missions: patrol, strike, CAP, escort, transit
- Trigger-Condition-Action event scripting for scenario narratives
- Cascading doctrine: side → mission → unit overrides

### Combat
- Anti-ship missile launch, flight, intercept
- WRA-based salvo sizing — ships fire 2-8 missiles based on target's missile defense
- Weapon tracks on map — dashed lines showing missiles in flight
- SAM defense and CIWS point defense
- Damage: undamaged → damaged → mission-kill → destroyed
- Countermeasures: chaff, ECM, decoys
- Combat log with full event history

### InfoWar Feed
- Game events produce simulated media coverage via local LLM ([Ollama](https://ollama.com))
- Personas: state media, wire services, OSINT analysts, pundits, civilians, troll farms
- Media channels match the scenario era — 1980s get radio and newspapers, 2020s get tweets and Telegram
- Game runs fine without Ollama; the Media tab stays empty

### Help System
- In-game help panel (press `?` or `H`)
- Covers controls, game concepts, sidebar guide, and media feed setup

### Testing
- 36 Playwright E2E tests covering page loads, simulation gameplay, combat, autopause, and the terminal design system (vendored font, no remote fonts, chrome never resizes the plot)
- `npm test` runs all tests headless; `npm run test:ui` opens the visual debugger

---

## Setup

**You need:** [Node.js 18+](https://nodejs.org) and [Git](https://git-scm.com).

```bash
git clone https://github.com/lerugray/sandkasten.git
cd sandkasten
npm install
npm run dev
```

Open `http://localhost:3001` (port 3001 to avoid colliding with Auftragstaktik on 3000).

To run E2E tests (auto-starts the dev server):

```bash
npm test
```

### Platform Database

Sandkasten ships its own platform database (`src/data/platforms/`); no CMO install is needed. Optional and local only: for CMO-derived reference data on your own machine (4,700 ships, 7,100 aircraft, 4,200 weapons, 7,200 sensors), install [Command: Modern Operations](https://store.steampowered.com/app/1076160/Command_Modern_Operations/) and run:

```bash
python scripts/extract_cmo_db.py
```

Reads CMO's SQLite database files, outputs JSON to `data/extraction/`. Gitignored, derived from proprietary game files. The game never reads or bundles it.

### InfoWar Feed (Optional)

Install [Ollama](https://ollama.com), then:

```bash
ollama pull mistral
```

The Media tab connects automatically when Ollama is running.

---

## Tech Stack

- **Next.js 16** — TypeScript, Tailwind CSS
- **MapLibre GL JS** — tactical map (dark Carto basemap)
- **milsymbol** — NATO MIL-STD-2525 symbol rendering
- **Ollama** — local LLM for InfoWar media generation (optional)
- **Python** — CMO database extraction (sqlite3, standard library)

---

## Project Structure

```
sandkasten/
├── src/
│   ├── app/                    # Next.js pages (home, /play, /editor)
│   ├── components/
│   │   ├── map/                # TacticalMap, UnitLayer, RangeRings, DetailPanel
│   │   ├── game/               # Time controls, orders, intel, combat log
│   │   │   ├── infowar/        # InfoWar feed UI (media cards, status)
│   │   │   └── help/           # In-game help panel
│   │   └── editor/             # Scenario editor
│   ├── lib/
│   │   ├── map/                # Basemap styles, range ring geometry
│   │   ├── symbols/            # milsymbol factory with caching
│   │   ├── platforms/          # Platform database lookup
│   │   ├── scenarios/          # Scenario loader, demo scenario
│   │   ├── simulation/         # Sim engine, movement, detection, combat
│   │   ├── ai/                 # OPFOR doctrine, missions, TCA events
│   │   └── infowar/            # InfoWar engine, Ollama service, personas
│   └── types/                  # TypeScript interfaces
├── scripts/
│   └── extract_cmo_db.py       # CMO database extraction
├── data/                       # Extracted platform data (gitignored)
├── tests/                      # Playwright E2E tests
├── GDD.md                      # Game Design Document
├── TASKS.md                    # Development task breakdown
├── DB_EXTRACTION_SPEC.md       # CMO database schema reference
└── SESSION_NOTES.md            # Development log
```

---

## Development Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Foundation** | Map, NATO symbols, scenario editor, platform database | Complete |
| **Simulation** | Movement, radar detection, fog of war, time controls | Complete |
| **OPFOR AI** | Doctrine, missions, TCA event scripting | Complete |
| **Combat** | Missiles, SAM defense, damage, salvos, weapon tracks | Complete |
| **InfoWar Feed** | Media coverage from game events via local LLM | Complete |
| **Polish** | Autopause, god mode, sensors overlay, measurement, E2E tests | Complete |
| **Look** | Three.js terminal play view, motion, 3D tilt | Built, awaiting Ray's in-game review |
| **Platform database** | Own sourced records, photos and `/database` viewer for the Hormuz roster | Built, awaiting Ray's review; full roster is a later job |
| **Remaining gaps** | Fuel consumption, aircraft altitude, game save/load | Next |
| **WeGo Multiplayer** | WebSocket sync, turn system, lobby, server-side fog of war | Planned |
| **Community** | Scenario sharing, Auftragstaktik OSINT import, campaign mode | Planned |

See [TASKS.md](TASKS.md) for the full breakdown and [GDD.md](GDD.md) for design details.

---

## Related

- **[Auftragstaktik](https://github.com/lerugray/auftragstaktik)** — Tactical OSINT terminal. Shares the map renderer and NATO symbology. Sandkasten imports its real-world data as scenario starting positions.

---

## License

MIT

---

*Built with [Claude Code](https://claude.ai/claude-code).*
