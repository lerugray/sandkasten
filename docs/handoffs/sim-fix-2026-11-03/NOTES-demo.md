# Demo fact check notes (scenario date fixed at 2026-03-15)

Audit source: docs/audits/SIM-AUDIT-2026-11-03.md section 3 (branch origin/dot/sandkasten-sim-audit). Research done 2026-11-03.
Files: src/lib/scenarios/demo.ts, src/lib/platforms/lookup.ts, src/lib/scenarios/__tests__/demoFacts.test.ts.
All weapon counts, ranges, Pk, damage points, missile-defense scores are simulation abstractions (unverified model assumptions).

## Corrections

1. USS Bunker Hill (CG-52) replaced by USS Chosin (CG-65). Unit id us-cg-1 kept; platform 598 deleted, new platform 9001.
   Bunker Hill decommissioned 22 Sep 2023: https://www.navy.mil/Press-Office/News-Stories/display-news/Article/3536575/uss-bunker-hill-decommissions/
   Chosin in active service, life-extended: https://en.wikipedia.org/wiki/USS_Chosin ; air-defense-commander cruiser of CSG 9 (Sep 2026): https://news.usni.org/2026/09/28/usni-news-fleet-and-marine-tracker-sept-28-2026
   Chosin is Mk 41 VLS (122 cells). Baseline number not claimed. Weapon numbers copied from the old 598 profile.
2. USS Taylor (FFG-50) replaced by USS Nitze (DDG-94, Flight IIA). Unit id us-ffg-1 kept; platform 1283 (Perry, 36 SM-1MR) deleted (no other references in src/tests), new platform 9002.
   Taylor decommissioned 8 May 2015: https://www.dvidshub.net/news/162764/uss-taylor-ffg-50-decommissions
   Nitze in active service, Flight IIA, Norfolk: https://en.wikipedia.org/wiki/USS_Nitze . Nitze's actual March 2026 tasking was not established; it is a plausible-role substitute. Weapon numbers copied from Mahan 111.
3. Cole (DDG-67) now uses own Flight I profile 9003 (was Mahan Flight II 111). Source: https://www.history.navy.mil/browse-by-topic/ships/modern-ships/uss-cole.html ; https://en.wikipedia.org/wiki/USS_Cole_(DDG-67) (90 VLS cells, 2 Phalanx). Weapon numbers copied from Mahan 111, unverified model assumption.
4. Super Hornet (342) gun: M61A1/578 changed to M61A2/412. https://www.gdots.com/wp-content/uploads/2025/11/400003005-20mm-F-A-18-E-F-Gatling-Gun-System-ARMAMENT.pdf
5. "76mm/50 OTO Melara" removed. Kaman (1088): "76mm OTO Melara Compact (76/62 family)" (Leonardo datasheet https://electronics.leonardo.com/documents/16277707/18404219/OTO_76_62_SR%2B%28MM08727%29_LQ_new.pdf?t=1625148164800). Bayandor (1652): "76mm Fajr-27 (OTO Melara type, approx.)" per https://en.wikipedia.org/wiki/Bayandor-class_corvette (2013 refit). Exact Iranian fits unverified.
6. Profile 2106 renamed "Sina Class [Kaman-derived missile boat, approximate fit]"; no longer claims Houdong. Sources: https://en.wikipedia.org/wiki/Sina-class_fast_attack_craft ; IISS and ONI p.34 links in the lookup.ts comment. Public sources list a 76 mm Fajr-27 and 40 mm gun on Sina boats; the profile's 4 C-802/Noor + ZU-23-2 fit is left as a labelled approximation.
7. New profile 9004 "Boghammar [IRGCN inshore patrol craft]": 12.7mm DShK MG (400), 107mm MRL modeled as type "gun" (12), no asm, no missileDefense, damagePoints 15. Sources: https://www.globalsecurity.org/military/world/iran/boghammar.htm ; https://admiraltytrilogy.com/scensupp/H002_OriginsHcon2021_IRGCN_Small_Boats_Briefing.pdf . demoConfig.ts reinforcements (ir-boghammar units, lines ~168 and ~177) still use 2106 and MUST be switched to 9004 by the demoConfig owner.
8. Nimitz (2740): added "RIM-116 RAM" (21 rounds, range 9 km, model assumption) as a sam entry. Capability sources: https://www.navy.mil/Resources/Photo-Gallery/igphoto/2002400143/ ; https://www.dvidshub.net/image/8679626/nimitz-launches-rolling-airframe-missile-during-live-fire-exercise . Sources establish capability, not a March 2026 magazine.

## Unverified, left as is

- Mahan 111 loadout/sensor fit (identity and Flight II are correct); Nimitz 2740 still labelled "[1998]" with Sea Sparrow 16 and Phalanx.
- Hornet 101/102 mixed AMRAAM/Harpoon loadout (authored assumption); Hawkeye 601 (E-2C, no weapons; no E-2C retirement shown before the date).
- Sina 101-103 fictional identifiers and 4 C-802/ZU-23 fit; Kaman 201/202 missile fit (C-802 vs Harpoon, counts) and the 35 km header vs 120 km C-802 range inconsistency.
- Phantom 301 (F-4E: 4 AIM-7E, 4 AIM-9P) and Tomcat 401 (F-14A: 4 AIM-54A, 2 AIM-7E, 2 AIM-9P): stocks and serviceability unverified. Unused F-14D profile 896 is not this Tomcat.
- All ranges, speeds, sensor/ECM variants, chaff counts, Pk, damage, readiness. Positions, headings, missions, callsigns are authored.

## Flagged for Ray

- Bayandor (FF-81, unit ir-ff-1, profile 1652): TWZ (https://www.twz.com/news-features/irans-key-naval-base-on-strait-of-hormuz-set-ablaze-from-strikes) quotes OSINT imagery analysis "IRIS Bayandor (81) sunk" at Konarak, 1-2 March 2026 (Operation Epic Fury); Critical Threats (https://www.criticalthreats.org/analysis/iran-update-evening-special-report-march-1-2026) is the other audit source (not independently read here); Wikipedia's Bayandor-class page lists the class as lost in the 2026 Iran war. Evidence is strong but not an official statement. Unit kept with code comments; decide whether to remove or reframe.
- Sina class: Wikipedia reports four Sina boats destroyed, two in an Israeli strike in March 2026 (date within month not checked). Not applied; the demo uses fictional Sina identifiers.
- Nimitz: in commission on 2026-03-15 but had finished its final deployment on 16 Dec 2025 and was in transit to Norfolk; service life extended to March 2027 (https://news.usni.org/2026/03/14/navy-extends-uss-nimitz-service-life-to-2027-in-line-with-carrier-john-f-kennedys-delivery). A Hormuz transit is a counterfactual premise.
- Chosin and Nitze: in commission on the date; neither was shown to be in the Gulf then (Chosin deployed with CSG 9 in Sep 2026). Counterfactual placement.
- Remaining active US cruisers in March 2026: Princeton, Robert Smalls, Gettysburg, Chosin, Cape St. George (Wikipedia Ticonderoga page). Swap Chosin for another if preferred.
- E-2C: E-2D transition scheduled for July 2026 (audit); not proof of retirement before the date.
