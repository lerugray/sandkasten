# SAND-THREAT-1 FIX2 — independent end review

Does a player now get an open-source CMO equivalent that is more player friendly than CMO: PARTLY

**Verdict: ACCEPT. S1=0 S2=0 S3=0.** Independent non-author Kimi K3.1-pro review of `1df1434c..7d553ae1`, static only; no browser/Playwright was run by the reviewer or the NO_EXEC author.

- The complete diff touches only the three authorized specs and the new FIX2 report. No production files, fixtures, snapshots, skips, test counts or timeouts changed.
- Continuous plan A now requires DEFEAT, Nimitz destroyed and failed mission status; the shared helper preserves the original victory assertions, replay checks and escorted plan B victory (`tests/sand-play-1-plans.spec.ts`).
- Five-minute WeGo retains `playOut`, queued ENGAGE, commit/resolution/review, result turns and clean replay; only plan A's intended outcome and artifact names changed, while sensible plan B remains a victory (`tests/sand-wego-1-flow.spec.ts`).
- Save/resume still downloads the real checkpoint, loads it into fresh contexts and verifies paused clock, exact restored orders, fog, expended weapons, fired events and score. It then applies the proven four-escort ROE-FREE screen through ordinary controls and still requires victory; the unchanged-save-file assertion remains (`tests/sand-save-1-flow.spec.ts`).
- The author report accurately states that no browser, Playwright or battery execution occurred (`docs/lane-reports/SAND-THREAT-1-FIX2-REPORT.md`).

The completing browser battery and the separate base-fc337505-vs-candidate Qeshm map attribution remain the harvest gates. This ACCEPT is not a claim that either browser check has run.
