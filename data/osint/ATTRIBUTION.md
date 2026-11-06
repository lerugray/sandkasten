# OSINT data attribution

`hormuz.json` (sites) and the `osint` fields in `../facilities/hormuz.json` come from two inputs.

## Auftragstaktik (MIT)

Sandkasten's sister project, <https://github.com/lerugray/auftragstaktik>, commit
`7c5904e30d89fa34ec31181c62d7073f4074a778` (2026-05-09). Its README declares the MIT licence (the
repository has no separate LICENSE file at that commit). Four data files are copied unmodified into
`raw/auftragstaktik-7c5904e/` so the import regenerates offline:

- `airDefense.ts`, `radarSites.ts`, `nuclearFacilities.ts`, `militaryInstallations.ts` (`src/lib/data/`)

Copyright (c) the Auftragstaktik authors. Permission is granted under the MIT licence to use, copy,
modify and distribute these files provided this notice is kept:

> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
> LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

Each record keeps its own `source` citation (CSIS Missile Threat, IAEA PRIS, NTI, FAS, satellite imagery,
public reporting), and each site carries a citation to the Auftragstaktik file and record id.

Only records inside the Hormuz bbox (S22.5 W50 N30 E61) are imported: 3 radar sites (2 Auftragstaktik, 1 curated AN/TPY-2), 2 nuclear sites, 3 installations. Auftragstaktik holds no
air defence site inside this bbox.

## Curated supplement (`curated/hormuz-supplement.json`)

Because Auftragstaktik has no Hormuz air defence, the supplement adds notional sites. The SYSTEM is
publicly documented in service with the operator; the PLACEMENT is anchored to a named real facility and
is a scenario assumption, not a surveyed location. Ranges are published maximum figures. Each entry cites
its sources (Wikipedia articles, the CSIS Missile Defense Project, US Navy public information). Every
AD/radar site is marked ESTIMATED because the platform database has no land-based SAM or radar record.

## Platform database

Sites are matched against `src/data/platforms/records` by weapon/sensor name (`scripts/lib/osint.mjs`,
`PLATFORM_ALIASES`). A match takes the DB range and drops the ESTIMATED flag; a miss keeps the OSINT range.
The platform database itself is not edited.
