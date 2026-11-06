sed -i 's/distToTarget <= 0.5 && wif.rangeRemainingKm > 0/distToTarget <= 0.5 \&\& wif.rangeRemainingKm >= distToTarget/' src/lib/simulation/combat.ts
