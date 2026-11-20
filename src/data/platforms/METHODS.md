# Platform database methods

Every record in `records/` is compiled from public sources listed in the record's own `sources[]`.
Rows tagged `verified` are published figures read from the cited
source. Rows tagged `estimated` are our abstractions for the Sandkasten engine or figures the public record gives only as
a range. Real-world facts are the shared starting point; the engine values below are ours.

## Engine ids

Every record carries a Sandkasten-owned `engineId`: **10001+ in the record order of `index.ts`**
(10001 Nimitz, 10002 Ticonderoga, 10003 Arleigh Burke Flight II, 10004 Flight IIA, 10005 Perry,
10006 F/A-18E, 10007 F-14D, 10008 E-2C, 10009 P-3C, 10010 SH-60B, 10011 Sina, 10012 Bayandor,
10013 Kaman, 10014 Boghammar, 10015 F-4E, 10016 F-14A). The sim-fix profiles in `lookup.ts` that have
no record yet continue the scheme (10017 Chosin, 10018 Cole); the snapshot placeholders keep their
engine-side ids 9900/9901. No id in this database comes from any other game or database.

## Labels in the viewer
- A spec block (dimensions, performance) has one source and tag. A single field that needs a different tag carries its own
  `fieldCitations` entry and shows that source and EST on its row only; the rest of the block keeps the block's tag.
- A spec the public record does not give is `null` in the record and shows as NOT PUBLISHED; it is never omitted.
- SOURCES label per source: VERIFIED only when no citing row is estimated; MIXED when verified and estimated rows both cite
  it (both counts shown); ESTIMATED when only estimated rows cite it; REFERENCE when no row cites it.

## Variant-specific figures
A figure is `verified` only when a cited source states it for this variant. A table for a different variant (F-14D, F-14B)
does not verify the same figure for another model.
- F-14A performance (`iriaf-f-14a-tomcat`): the cited tables (s3 Wikipedia, s1 and s8 F-14 pages) describe the F-14D or F-14B
  (F110 engines) or the F-14 in general. The Iranian F-14A has TF30 engines, so max speed, cruise speed, ceiling, combat
  radius and range are those published F-14 figures applied to the A model and are tagged `estimated`. Airframe dimensions
  (length, wingspan, height) are shared by all variants and stay verified.
- Nimitz draft (`nimitz-cvn-68`): FAS s1 gives no draft. s13 (Wikipedia) states the ship was "initially designed with a
  full-load displacement of 87,000 long tons and a draft of 37 ft" (11.3 m). The record's displacement is the 97,000 t
  full-load figure from s1, so the 11.3 m design draft is tagged `estimated` rather than read as the draft at that load.

## Re-derivation of the engine numbers (lane s463)

The engine-read numbers (`sensorRangeKm`, `weaponRangeKm`, `damagePoints`, `missileDefense`, and every weapon and
defense row's `rangeKm`, `speedKts`, `pkAir`, `pkSurface`, `quantity`, `warheadDamage`, `effectiveness`) were originally
carried over from the pre-database engine, which had taken them from a third-party game database. That carry-over is
removed: **every engine number is now derived from the public facts in the record's cited sources by the formulas below.**
The full before/after table, with the formula or source for each value, is in `docs/cards/DATA-REDERIVE-REPORT.md`.
Where a derived number disagrees with a published figure it is because the formula is an engine abstraction; the
record's descriptive spec blocks always show the published figure.

### damagePoints
- Ships: `round(10 x sqrt(full-load displacement in tons))`. Hull points grow sub-linearly with size: a bigger ship
  absorbs more damage, but resilience per ton falls as displacement grows, so a carrier is not an order of magnitude
  harder to kill than a destroyer. The displacement is the record's published `displacementFullTons`
  (e.g. Nimitz 97,000 t -> 3,114; Mahan 8,637 t -> 929; Kaman 275 t -> 166; Boghammar 6.4 t -> 25).
- Aircraft and helicopters: 2-5 by airframe size and redundancy — rotary-wing 2 (SH-60B), medium twin-turboprop 3
  (E-2C), large four-engine turboprop 5 (P-3C), twin-engine fighters 4-5 by size (single-seat F/A-18E 4, two-seat
  F-14/F-4 5).

### missileDefense
The engine sizes anti-missile salvos at `2 x missileDefense` (clamped to 2-8). The value is the number of independent
engagement channels the platform can run at once against sea-skimmers: **missile fire-control directors + CIWS mounts
(+1 per autonomous fire-and-forget launcher)**. Gun-only boats count their gun director as 1 channel; craft with no
director at all carry 0 (the Boghammar profile leaves the field undefined). Examples: Mahan 3 SPG-62 + 2 Phalanx = 5;
Flight IIA 3 + 1 = 4; Ticonderoga 3 + 2 = 5; Nimitz 2 Sea Sparrow directors + 3 Phalanx + 1 RAM launcher = 6;
Perry 1 Mk 13 director + 1 Phalanx = 2. Mount counts are the published class fits (Wikipedia Arleigh Burke class:
DDG-51 to 84 carry 2 Phalanx, DDG-85 onward 1).

### sensorRangeKm / weaponRangeKm
- `sensorRangeKm`: the range of the strongest sensor in the record's `sensors[]` — a published detection or instrumented
  range where a source states it (SPY-1 370 km / 200 nmi; SPS-49 463 km per FAS, 474 km maximum instrumented per
  Wikipedia; APG-79 150 km; APS-145 / Hawkeye 2000 >640 km), otherwise the row's documented open estimate against
  fighter-size or surface targets (AWG-9 220 km, APG-71 250 km, APQ-120 130 km, APS-115 280 km, APS-124 120 km,
  the Iranian boat radars 46/65 km, Decca 12 km).
- `weaponRangeKm`: the longest `rangeKm` in `weapons[]` (0 for unarmed aircraft).

### Weapon rangeKm and speedKts
- `rangeKm`: the published range of the weapon from the cited source — SM-2MR 167 km (Navy fact file, up to 90 nmi),
  SM-1MR 74 km (40 nmi), Harpoon 124 km ship-launched (Navy fact file, over 67 nmi) / 220 km air-launched Block IC
  (120 nmi), C-802 120 km, AIM-54A 135 km / AIM-54C 184 km, AIM-120C 90 km, AIM-7E 50 km, AIM-9P 18 km (cited spec),
  Sea Sparrow 19 km, RAM 9 km, OTO 76/62 16 km (HE-PFF maximum), ZU-23-2 2.5 km effective, DShK 2 km effective,
  Type 63 8 km, Phalanx 1.5 km (1,486 m maximum effective). Where the published figure is a maximum kinematic range
  the row says so; effective-range estimates (40 mm AA 4 km, M61A2 1.8 km) are tagged as ours.
- `speedKts`: the published speed converted to knots, rounded to the nearest knot — km/h / 1.852, m/s x 1.94384,
  or Mach x 1,225 km/h (sea-level standard sound speed) / 1.852. SM-2 Mach 3.5 (4,290 km/h) -> 2,316; Sea Sparrow
  4,256 km/h -> 2,298; RAM >Mach 2 (2,500 km/h) -> 1,350; Harpoon 864 km/h -> 467; C-802 Mach 0.9 cruise -> 595;
  AIM-54A Mach 4.3 (1,460 m/s) -> 2,838; AIM-54C Mach 5 (1,700 m/s) -> 3,305; AIM-120 Mach 4 (1,372 m/s) -> 2,667;
  AIM-7 Mach 4 (4,939 km/h) -> 2,667; AIM-9 Mach 2.5 -> 1,654. Guns fire at 0 (instantaneous in the engine).

### pkAir / pkSurface (0-100)
Single-shot kill probability against the target class, from a stated table over the published guidance type and the
condition of the stock. No public source gives a certified Pk for these weapons; the table is our abstraction:
- Active-radar AAM 80; aged or embargoed stock derated (AIM-54C 75, Iranian AIM-54A 60).
- Semi-active AAM 50; IR AAM 60.
- Semi-active area-defence SAM 75 (SM-2), older SM-1 65; point-defence SAM 70 (Sea Sparrow, RAM).
- Active-radar ASM 90 (Harpoon, C-802).
- SAM anti-ship mode 60 (SM-2) / 50 (SM-1): a semi-active air-defence missile is less reliable against a manoeuvring
  small surface target than a dedicated ASM.
- Guns by calibre and fire control: radar-directed CIWS 50 air / 30 surface; aircraft cannon 30 / 20; 76 mm 10 / 60;
  40 mm 20 / 40; 23 mm 15 / 20; 12.7 mm 5 / 25; unguided 107 mm rockets 0 / 15.

### quantity
Published mount or magazine counts where a source states them (Harpoon 8 = two quad launchers; C-802 4 = two twin
launchers / four box launchers; Sea Sparrow 16 = two 8-round launchers; RAM 21 = one launcher; Phalanx 1,550-round
magazine; OTO Compact 80 ready rounds; M61A2 412-round maximum; 12-tube MRL), otherwise a documented typical mix or
estimate (VLS SM-2 mixes 50/56/80, aircraft missile fits, round counts for the light guns).

### warheadDamage
- Missiles: `round(published warhead mass in kg)`, capped at 170 — one damage point per kilogram of warhead.
  Harpoon 221 kg -> 170 (cap); C-802 165 kg -> 165; AIM-54 60 kg -> 60; Sea Sparrow 41 kg -> 41; AIM-7E 29 kg -> 29;
  AIM-120 20 kg -> 20; AIM-9 9.4 kg -> 9; RAM 11.3 kg -> 11. The SM-2/SM-1 Mk 125 warhead mass is not published in the
  cited sources; 100 kg is our estimate (about 14% of the published 707 kg SM-2 launch mass, a typical blast-fragmentation
  SAM warhead fraction), giving 100. The cap keeps one heavy ASM hit devastating but not instantly fatal to a large
  combatant.
- Guns and rockets: a calibre table (our abstraction) — 12.7 mm 2, 20 mm 5, 23 mm 3, 40 mm 8, 76 mm 15,
  107 mm rocket 5. The original Type 63-2 rocket's 1.3 kg warhead is published, but the Iranian Fadjr-1 copy's warhead
  is not, so the rocket follows the calibre table.

### effectiveness (0-1)
Chance the defense defeats one incoming round, from a stated table over the system type: chaff 0.2-0.35
(ship SRBOC 0.3, Kaman launchers 0.2, Hornet 0.35, F-14D 0.3, Iranian fighters 0.25), ECM 0.2-0.3
(SLQ-32(V)2 0.2, (V)3 0.25, (V)4 0.3, ALQ-214 0.3), CIWS 0.5 single mount / 0.65 Nimitz's three, towed decoy 0.2.
Expendable counts are the record's published or estimated launcher/round counts.

### Signature grade
Five steps from `very-low` to `very-high`, set from published radar cross-section, hull and exhaust
data where available, otherwise from class and size. Always accompanied by a one-sentence note.
