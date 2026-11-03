Anchor: "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO." This card delivers the CMO parity inventory, Part A (public sources), the basis for every later build card.

RAY-ASK: 2026-11-03 14:00 "as part of that pass, we can have kimi use that new craft anything (or everything) repo I told you about a session or two ago do a complete inventory/study of CMO, not to copy over for sandkasten but to have a strong basis for all the elements of parity we need to hit."
RAY-ASK: 2026-11-03 14:3x "Start now on Cursor" (door choice for this study)
MOVES: the parity list every Sandkasten build card is planned from; without it the restart has no checked target.

# CARD: CMO parity inventory, Part A (public sources)

Lane: cursor-agent, model kimi-k3-max, home-PC Windows CLI. Cap 7,200 s. Base: sandkasten main (this card's commit).
Part B (a clean-room look at the installed game through craft-anything: only what a player sees) is a separate card
after CMO finishes installing. Do not start it here.

## 0. First, a write probe
Within your first two minutes, create `CMO-PARITY-STUDY.md` at the repo root with the section headings from step 3 and
the line `STATUS: started <time>`. Rewrite that STATUS line and save the file after every section you finish, so progress
is visible on disk. If the write fails, stop and say so.

## 1. Read Sandkasten first (15 minutes at most)
`SPEC.md`, `GDD.md`, `README.md`, `DB_EXTRACTION_SPEC.md` (for which platform fields the current build expects), and skim
`src/lib/` to learn what the sim does today. You will mark each CMO element as present / partial / absent in Sandkasten
with a file path.

## 2. Sources (public only)
Use your web tools; if you have none, fetch pages from the shell (PowerShell `Invoke-WebRequest` or `curl.exe`).
Good sources: the Matrix Games / Slitherine product pages, update and release notes (include the recent WeGo mode),
the official CMO Lua documentation, the public CMO database viewer site, the Matrix Games forums, Steam store page and
reviews, Reddit (r/wargames, r/CommandModernOps), and tutorial videos' descriptions. If a CMO manual PDF is already on
`D:\SteamLibrary\` you may read it (the game is still downloading; do not wait for it). Clean room: never open, decode
or extract any game file or database; never run the game.

## 3. Write `CMO-PARITY-STUDY.md`, one section per domain
Domains: (1) platforms and units, (2) the platform database's coverage and field families (what kinds of entities and
attributes it holds, and publicly stated sizes; never values, never record dumps), (3) sensors and detection,
(4) contacts, classification and fog of war, (5) weapons, engagements, damage and countermeasures, (6) air operations,
loadouts, fuel and altitude, (7) naval and submarine specifics, land units, (8) logistics and magazines, (9) AI,
doctrine, missions and event scripting (including Lua), (10) scenario editor and scenario format, (11) victory and
scoring, (12) time, turn and pause modes including CMO's WeGo mode (how it works, from release notes), (13) multiplayer,
(14) map, terrain, weather and environment, (15) interface, tutorials and learning curve.

For every element, one table row: element | what CMO does (one line, with a source URL) | Sandkasten today (present /
partial / absent + file path) | parity call (MUST / SHOULD / LATER) and why in one line.

Then two closing sections:
- **Where players say CMO is hard to play**: concrete complaints from public player discussion (cited), each with the
  Sandkasten design answer it suggests in one line. Look for scenario design that leaves only one viable solution.
- **Top 25 MUST items**, ordered by what a first-time player meets first.

## 4. Rules
- No code changes, no commits, no pushes. Write only `CMO-PARITY-STUDY.md` (and optional notes under `study/`).
- Summarize in your own words; quote at most one short line (under 15 words) from any source, in quotation marks.
- Every factual claim about CMO carries a source URL. Unknown is a fine answer; never guess.
- Done = all 15 sections filled, both closing sections written, `STATUS: done <time>` on line 1 of the status line.
