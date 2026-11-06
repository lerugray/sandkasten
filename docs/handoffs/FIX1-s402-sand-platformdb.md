# FIX1 s402: sand-platformdb (branch sand/platformdb-fix1-s402)

**Verdict: FIX READY.** All 3 S2s fixed with red then green unit tests, the drop list is done, `npm run build` passes. e2e/Playwright was not run (host rule); specs for the seat are listed below.

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
- Flipped the F-14A performance block to verified: every figure is in the cited Wikipedia table. Weights tagged estimated because that table shows F-14D values.

## e2e specs for the seat
- `tests/platform-database.spec.ts` (4; the data test was tightened, the viewer sweep reads spec tables and sources)
- Unchanged but on the touched path: sand-001..006, simulation.spec.ts, smoke.spec.ts, design-system.spec.ts (read platforms via lookup.ts; the diff here does not touch lookup.ts)

Build: `npm run build` PASS (/database present). `tsc --noEmit`: only the 3 existing sand-001 errors.
