# Sandkasten

## CRITICAL: Context Window Management
**Before the conversation runs out of context space, WARN the user immediately and update `SESSION_NOTES.md` with all current progress, decisions, and next steps BEFORE the conversation ends.** The user is not a programmer and cannot reconstruct lost context.

## Project Overview
Open-source WeGo naval/air/ground wargame simulation inspired by Command: Modern Operations (CMO). Built on the same tactical map and NATO symbology foundation as Auftragstaktik. The name refers to the German military sand table used for operational planning.

The core differentiator from CMO: pull real-world OSINT snapshots from Auftragstaktik as scenario starting positions. Monitor live events while playing.

## Relationship to Auftragstaktik
- Shares map renderer (MapLibre GL JS), NATO symbology (milsymbol), and theater system
- Imports Auftragstaktik's real-world data feeds as scenario seeds
- Separate codebase, separate project — linked by shared libraries

## Key Design Goals
- **WeGo multiplayer** — both sides plan simultaneously, then orders execute together
- **Open scenario editor** — community-created and shared scenarios
- **Real-world snapshots** — generate playable scenarios from live OSINT data
- **Open platform database** — community-maintained equipment specs (CMO's CWDB is proprietary)
- **Sensor/detection model** — radar ranges, ESM, visual, sonar with probability-based detection
- **Combat resolution** — weapon PK, damage, countermeasures

## Reference Material
- User owns Command: Modern Operations (can reference for mechanics research)
- BookFinder General (user's tool in `../devforge/`) can source research material from Anna's Archive
- Auftragstaktik codebase at `../Auftragstaktik/` for shared components

## Tech Stack (Proposed)
- Inherits from Auftragstaktik: Next.js, MapLibre GL JS, milsymbol, TypeScript, Tailwind
- Multiplayer: WebSocket (ws) for real-time game state sync
- Simulation engine: Server-side turn resolution
- Platform database: JSON/SQLite, community-editable

## Conventions
- **Use stop-slop** when writing any human-facing copy
- Session notes tracked in `SESSION_NOTES.md`
- Design document in `GDD.md`
- User is not a programmer — do things for them rather than giving instructions
