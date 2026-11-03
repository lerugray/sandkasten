Anchor: "Sandkasten is the open-source equivalent of Command: Modern Operations, with graphics and an experience drastically more player friendly than CMO." This card delivers the CMO parity inventory, Part B: the content-coverage list our own platform database must reach.

RAY-ASK: 2026-11-03 14:00 "as part of that pass, we can have kimi use that new craft anything (or everything) repo I told you about a session or two ago do a complete inventory/study of CMO, not to copy over for sandkasten but to have a strong basis for all the elements of parity we need to hit."
RAY-ASK: 2026-11-03 14:51 "build our own but the database is fine for studying purposes, we dont have to literally copy things given our engine is different but we will need the same content if that makes sense"
MOVES: the coverage target our own database is compiled against; without it the own-DB build has no checked target.

# CARD: CMO parity inventory, Part B (database coverage, study only)

Lane: cursor-agent, model kimi-k3-max, home-PC Windows CLI. Cap 5,400 s. Runs beside Part A (`CARD.md`, its own tree).
Ray owns CMO; it is installed at `D:\SteamLibrary\steamapps\common\Command - Modern Operations`. Study only: you read its
database to learn WHAT content exists, never to carry values into Sandkasten.

## 0. First, a write probe
Within two minutes create `CMO-DB-COVERAGE.md` at the repo root with the headings from step 2 and `STATUS: started <time>`;
rewrite the STATUS line after each section. If the write fails, stop and say so.

## 1. Find and open the database read-only
Find the newest `DB3K_*.db3` (SQLite) under the install's `DB` folder. Open it READ-ONLY (copy it first to a temp folder
outside the repo if your tool cannot open read-only). Never modify the install. Use whatever SQLite access this host has
(Python's sqlite3, Node's built-in `node:sqlite`, or a sqlite3.exe); check first, install nothing system-wide.
Read `DB_EXTRACTION_SPEC.md` and `scripts/extract_cmo_db.py` for the table names the old build used.

## 2. Write `CMO-DB-COVERAGE.md`
1. **Entity families and counts**: ships, submarines, aircraft, facilities and land units, satellites, weapons, sensors,
   mounts, magazines, loadouts, propulsion, comms, and any other top-level families; row counts per family and per
   nation/era where the schema allows.
2. **Field families**: for each entity family, the groups of attributes CMO tracks (e.g. sensor bands, weapon ranges by
   target type, signatures), named in your own words with the column count; the attributes our engine needs to match
   CMO's play are marked NEED, others LATER.
3. **Sandkasten today**: which of those families and field groups `src/types` and `src/lib` already model (file paths).
4. **Coverage targets**: the order in which our own database should be filled, by what a first scenario needs first
   (e.g. the Strait of Hormuz demo's platforms), with the count of entries each step needs.
5. **Sources for our own values**: per family, the public source types a compiler lane can cite (official fact sheets,
   naval registers, manufacturer data, open references), so values are ours and sourced.

Put any raw lists of platform names you need as working notes in `study/cmo-db/` (CSV is fine). These stay private
study notes; the seat files them outside the public repo.

## 3. Rules
- No code changes, no commits, no pushes. Write only `CMO-DB-COVERAGE.md` and `study/cmo-db/*`.
- Never copy CMO values, descriptions or text into any file meant for Sandkasten's code or data. Counts, family names,
  attribute group names and platform names for coverage are fine.
- Do not launch the game or Steam. Do not run `scripts/extract_cmo_db.py` into `data/` inside the repo.
- Done = all five sections filled and `STATUS: done <time>`.
