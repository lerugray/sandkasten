<div align="center">

![Sand Table](US_Army_53265_2LTs_complete_Leader_Forge.jpg)

# SANDKASTEN

**Open-source wargame simulation. NATO symbology. Real-world platform data. Continuous time or WeGo multiplayer. Fog of war. Community scenarios.**

*Named for the German military sand table used for operational planning.*

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![MapLibre](https://img.shields.io/badge/MapLibre-GL-blue)
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
| **Platform database** | Proprietary (CWDB) | Community-maintained, or import from CMO if you own it |
| **Scenario scripting** | Lua + complex editor | Visual trigger-condition-action system |
| **UI** | Built for defense analysts | Built for players |
| **Multiplayer** | TCP/IP real-time | WeGo simultaneous turns (planned) |
| **Real-world data** | None | OSINT snapshots via Auftragstaktik (planned) |

---

## Current State

### Foundation
- Dark tactical map with NATO MIL-STD-2525 symbols
- Demo scenario: US carrier strike group vs. Iranian naval forces, Strait of Hormuz
- Click units for detailed Info/Sensors/Weapons panels
- Shift+click to pin sensor range rings
- Dark/light theme
- Scenario editor at `/editor` — place units, set sides, save/load JSON
- Platform database API with 60k+ extracted CMO records

### Simulation
- Real-time simulation at `/play`
- Waypoint-based movement with four throttle settings
- Radar detection (range-based probability, radar horizon)
- ESM passive detection of active emitters
- Contact classification: Unknown → Detected → Classified → Tracked
- Fog of war — you see only what your sensors report
- Contacts degrade and fade without fresh sensor data
- Time controls: pause/play, 1x through 60x speed

### OPFOR AI
- Doctrine: ROE, engagement range, radar usage, evasion, withdrawal
- Missions: patrol, strike, CAP, escort, transit
- Trigger-Condition-Action event scripting for scenario narratives
- Cascading doctrine: side → mission → unit overrides

### Combat
- Anti-ship missile launch, flight, intercept
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

---

## Setup

**You need:** [Node.js 18+](https://nodejs.org) and [Git](https://git-scm.com).

```bash
git clone https://github.com/lerugray/sandkasten.git
cd sandkasten
npm install
npm run dev
```

Open `http://localhost:3000`.

### Platform Database (Optional)

The demo scenario includes a built-in platform set. For the full database (4,700 ships, 7,100 aircraft, 4,200 weapons, 7,200 sensors), install [Command: Modern Operations](https://store.steampowered.com/app/1076160/Command_Modern_Operations/) and run:

```bash
python scripts/extract_cmo_db.py
```

Reads CMO's SQLite database files, outputs JSON to `data/extraction/`. Gitignored — derived from proprietary game files.

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
| **Combat** | Missiles, SAM defense, damage model, countermeasures | Complete |
| **InfoWar Feed** | Media coverage from game events via local LLM | Complete |
| **Help System** | In-game help panel with controls and concepts | Complete |
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
