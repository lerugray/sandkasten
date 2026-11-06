# Platform database methods

Every record in `records/` is compiled from public sources listed in the record's own `sources[]`. Nothing is copied
from Command: Modern Operations or any extraction of it. Rows tagged `verified` are published figures read from the cited
source. Rows tagged `estimated` are our abstractions for the Sandkasten engine or figures the public record gives only as
a range. Real-world facts are the shared starting point; the engine values below are ours.

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

## Carry-over rule for the 14 original Hormuz platforms
The demo scenario and its tests were tuned against the numbers `lookup.ts` held before this database. Those engine-read
numbers (`sensorRangeKm`, `weaponRangeKm`, `damagePoints`, `missileDefense`, and every weapon and defense row's
`rangeKm`, `speedKts`, `pkAir`, `pkSurface`, `quantity`, `warheadDamage`, `effectiveness`) are carried over unchanged so the
simulation behaves exactly as before. The `sim-fix` lane owns changing them. Where a carried-over number disagrees with the
published figure it is tagged `estimated` and the record's descriptive spec blocks show the published figure.

## Engine abstractions (used for the two new records and any later record)
- `damagePoints`: hull points the engine subtracts hits from. Ships: roughly full-load displacement in tons x 0.12 for
  combatants, x 0.07 for carriers (armour, compartmentation and size resist more per ton than the displacement alone
  suggests, but a carrier is not 14x harder to kill than a destroyer in this model). Aircraft and helicopters: 2-5 by
  airframe size and redundancy (single-engine helicopter 2, big turboprop 3-5, twin-engine fighter 4-5).
- `missileDefense`: the engine sizes anti-missile salvos at `2 x missileDefense`. Set to the number of independent
  engagement channels the platform can run at once against sea-skimmers: 1 for gun-only, 2-4 for point-defence missile or
  gun ships, 8-24 for multi-channel area-defence combatants with Aegis-class directors and a CIWS.
- `pkAir` / `pkSurface` (0-100): single-shot kill probability against the target class, from open-source ranges of
  published figures (when a source gives none) scaled down: semi-active SAMs 65-85, active-radar ASMs 90-95, guns 10-60 by
  calibre and fire control, IR AAMs 55-65.
- `warheadDamage`: warhead mass in kg x 0.2 for missiles (cap 170), 5-15 for guns by calibre.
- `effectiveness` (0-1): chance the defense defeats one incoming round. Chaff 0.2-0.35, ECM 0.2-0.3, CIWS 0.5-0.65,
  towed decoy 0.2.
- `sensorRangeKm`: the longest-range search radar's published range against a large aircraft, or the strongest sensor's
  maximum instrumented range when the source gives it. `weaponRangeKm`: the longest-range weapon in `weapons[]`.
- Signature `grade`: five steps from `very-low` to `very-high`, set from published radar cross-section, hull and exhaust
  data where available, otherwise from class and size. Always accompanied by a one-sentence note.
