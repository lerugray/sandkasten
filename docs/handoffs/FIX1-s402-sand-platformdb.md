# FIX1 s402: sand-platformdb (branch sand/platformdb-fix1-s402)

**Round 2 verdict: FIX READY** (round 1 below; round 2 section at the end).

**Round 1 verdict: FIX READY.** All 3 S2s fixed with red then green unit tests, the drop list is done, `npm run build` passes. e2e/Playwright was not run (host rule); specs for the seat are listed below.

Base: 1f8ad044 (Jules harvest). Commits: c4a6af8 drop list, aa02648 vitest plus red tests, d0107e5 fixes.

## Findings, red then green
`npm run test:unit` is new (vitest, `unit/platform-db.test.tsx`, renders `PlatformDatabase` to static HTML). Red run was on the unchanged code and data (commit aa02648): 13 tests, 6 failed, 7 passed. Green after d0107e5: 13 passed.

| Finding | Test (red -> green) | Fix |
|---|---|---|
| S2-1 per-field citation | "F-14A dimensions: published rows stay plain, only the estimated weights read EST"; "Sina dimensions: only the conflicting displacement figure reads EST"; "every fieldCitations entry names a field the block carries and a source the record lists" (3 red -> 3 green) | `SpecBlock.fieldCitations` in `src/types/platformDb.ts`; viewer resolves each row's tag per field (`fieldCite`); F-14A dimensions and performance blocks now verified with `weightEmptyKg`/`weightMaxKg` estimated; Sina dimensions verified with `displacementFullTons` estimated |
| S2-2 MIXED label | "a source cited by both verified and estimated rows reads MIXED with both counts; VERIFIED only when no estimated row cites it"; "f-14d-tomcat SRC 3 ... is not labelled VERIFIED" (2 red -> 2 green) | `sourceLabel()` in `PlatformDatabase.tsx`: VERIFIED / MIXED / ESTIMATED / REFERENCE (review counted 19 mixed-cited sources, all read VERIFIED) |
| S2-3 Harpoon quote | "NOTES.md quotes the FAS line relied on" (red -> green) | NOTES.md quotes FAS s1: "The modifications require removal of Harpoon missile capability." s3 (Wikipedia) has no Harpoon text. Row stays an estimated scenario assumption |

S3s:
- Null check: unit test pins the exact not-published set (Nimitz, SH-60B, Sina `cruiseSpeedKts`) and the viewer test checks NOT PUBLISHED renders. The Playwright data test now requires number or explicit `null` (was `"x" in d`).
- Sensor/defense/loadout rows: the engine-wording scan now covers all row kinds, plus a verified-sensor test.
- Failing-first evidence: the red commit aa02648 is on the branch.

## Drop list (done, c4a6af8)
Removed: `frames/*.png` (4) and `console-errors.txt`, `CARD-s401-sand-platformdb.md`, `capture.mjs`. `package-lock.json` restored to main, then vitest and @types/react-dom added to devDependencies (lockfile change is only those). No deleted file needed restoring (none named; the diff had no deletions of main files). NOTES.md references to the removed files were cleaned.

## Judgment calls for the seat
- Fence: added `vitest.config.ts`, `unit/`, `package.json` script, `@types/react-dom` (needed for the typecheck that `next build` runs). CLAUDE.md says run `npm test` before push; the brief's host rule overrode that.
- (Superseded in round 2: the F-14A performance block is estimated again, see below.)

## e2e specs for the seat
- `tests/platform-database.spec.ts` (4; the data test was tightened, the viewer sweep reads spec tables and sources)
- Unchanged but on the touched path: sand-001..006, simulation.spec.ts, smoke.spec.ts, design-system.spec.ts (read platforms via lookup.ts; the diff here does not touch lookup.ts)

Build: `npm run build` PASS (/database present). `tsc --noEmit`: only the 3 existing sand-001 errors.

---
# Round 2 (Dot re-review of c8cea105: REJECT, 2 S2 plus lockfile)

**Verdict: FIX READY.** Both data-honesty S2s fixed red then green, lockfile reverted to main's entries, `npm run build` PASS. Playwright/e2e not run (host rule).

Commits: lockfile checkpoint, red tests, then the fix commit (see `git log`). Unit tests: red run was 16 tests, 3 failed, 13 passed; green is 16 passed (vitest 3.2.7).

| Finding | Test (red -> green) | Fix |
|---|---|---|
| S2-A `iriaf-f-14a-tomcat.json` performance block promoted to VERIFIED from F-14D tables | "Iranian F-14A performance is not verified from F-14D/F-14B tables; METHODS.md gives the method" | Block back to `estimated` (s3 is the F-14D table with F110 engines, s1 says F-14B, s8 is generic; the Iranian F-14A has TF30s). Method in METHODS.md "Variant-specific figures". Length, wingspan, height stay verified (shared airframe); weights stay per-field EST |
| S2-B `nimitz-cvn-68.json` draft 11.3 m VERIFIED against FAS s1, which gives no draft | "Nimitz draft is not verified against FAS s1 ... cites the source that states it, tagged estimated"; "the row renders EST for Nimitz draft and plain for its other dimensions" | `fieldCitations.draftM` = s13 (Wikipedia: designed with "a draft of 37 ft" = 11.3 m, at the original 87,000 LT displacement), tagged `estimated`; the quote is in NOTES.md and METHODS.md. Other Nimitz dimensions stay verified against s1 (re-read: 1,092 ft, 134 ft beam, ~97,000 t, 30+ kt all on the page) |
| Lockfile | script check: every pre-existing entry in `package-lock.json` equals main's | vitest 5 and 4 pull vite 8, which bumped postcss, nanoid, tinyglobby, picomatch, source-map-js (and sourcemap-codec, acorn). Now vitest 3.2.7 (vite 7) + `@types/react-dom` 19.2.3: 0 pre-existing entries changed or removed, 94 added, `npm ci` exit 0. The one transitive bump (`@types/estree` 1.0.10, which rollup requires) is nested under rollup so the root 1.0.8 entry is untouched |

The generic "every VERIFIED figure has a quoted source" check was not built; the two cases the seat named are covered, each with the quote in NOTES/METHODS. Not re-audited: other records' verified figures beyond these two.

e2e specs for the seat (unchanged from round 1): `tests/platform-database.spec.ts` (4); on the same path: sand-001..006, simulation.spec.ts, smoke.spec.ts, design-system.spec.ts. This round changed only two record JSONs, METHODS.md, NOTES.md, the unit test, package.json and the lockfile.

