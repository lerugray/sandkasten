// Publicly known nuclear facilities from IAEA PRIS, NTI, FAS Nuclear Notebook
// Sources cited per entry. All coordinates from public satellite imagery.

export type FacilityType = 'reactor' | 'enrichment' | 'weapons-storage' | 'research' | 'waste' | 'test-site';
export type FacilityStatus = 'active' | 'suspended' | 'decommissioned' | 'under-construction' | 'damaged';

export interface NuclearFacility {
  id: string;
  facilityType: FacilityType;
  name: string;
  operator: string;
  lat: number;
  lng: number;
  status: FacilityStatus;
  description: string;
  source: string;
  theaterId: string;
  exclusionZoneKm?: number;  // Buffer zone radius for proximity alerts
}

// Friendly nations for SIDC affiliation
const FRIENDLY_OPERATORS = [
  'Ukraine', 'Israel', 'United States', 'United Kingdom',
  'South Korea', 'Japan', 'France', 'NATO',
];

export function isNuclearFriendly(operator: string): boolean {
  return FRIENDLY_OPERATORS.some(f => operator.includes(f));
}

export const NUCLEAR_FACILITIES: NuclearFacility[] = [
  // === UKRAINE THEATER ===
  { id: 'ua-zaporizhzhia', facilityType: 'reactor', name: 'Zaporizhzhia NPP', operator: 'Ukraine (occupied)', lat: 47.51, lng: 34.59, status: 'suspended', description: 'Europe\'s largest nuclear plant. 6 VVER-1000 reactors. Occupied by Russia since Mar 2022. IAEA monitoring team on-site. All reactors in cold shutdown.', source: 'IAEA, public reporting', theaterId: 'ukraine', exclusionZoneKm: 30 },
  { id: 'ua-chernobyl', facilityType: 'waste', name: 'Chernobyl Exclusion Zone', operator: 'Ukraine', lat: 51.39, lng: 30.10, status: 'decommissioned', description: 'Site of 1986 disaster. New Safe Confinement (NSC) over Reactor 4. Spent fuel storage. Briefly occupied by Russia Feb-Mar 2022.', source: 'IAEA PRIS, public reporting', theaterId: 'ukraine', exclusionZoneKm: 30 },
  { id: 'ua-south-ukraine', facilityType: 'reactor', name: 'South Ukraine NPP', operator: 'Ukraine', lat: 47.82, lng: 31.22, status: 'active', description: '3 VVER-1000 reactors. Operating under wartime conditions. One of Ukraine\'s four active nuclear plants.', source: 'IAEA PRIS', theaterId: 'ukraine', exclusionZoneKm: 30 },
  { id: 'ua-rivne', facilityType: 'reactor', name: 'Rivne NPP', operator: 'Ukraine', lat: 51.33, lng: 25.90, status: 'active', description: '4 reactors (2 VVER-440, 2 VVER-1000). Western Ukraine, furthest from front lines.', source: 'IAEA PRIS', theaterId: 'ukraine', exclusionZoneKm: 30 },
  { id: 'ua-khmelnytskyi', facilityType: 'reactor', name: 'Khmelnytskyi NPP', operator: 'Ukraine', lat: 50.30, lng: 26.65, status: 'active', description: '2 VVER-1000 reactors. Western Ukraine. Units 3 and 4 under construction (Westinghouse AP1000).', source: 'IAEA PRIS', theaterId: 'ukraine', exclusionZoneKm: 30 },

  // === MIDDLE EAST ===
  // Israel
  { id: 'il-dimona', facilityType: 'weapons-storage', name: 'Dimona (Negev Nuclear Research Center)', operator: 'Israel', lat: 31.00, lng: 35.15, status: 'active', description: 'Undeclared nuclear weapons facility. Plutonium production reactor (IRR-2). Israel maintains nuclear ambiguity policy. Estimated 80-90 warheads (FAS).', source: 'FAS Nuclear Notebook, satellite imagery', theaterId: 'middle-east', exclusionZoneKm: 20 },
  { id: 'il-sorek', facilityType: 'research', name: 'Soreq Nuclear Research Center', operator: 'Israel', lat: 31.67, lng: 34.70, status: 'active', description: 'Research reactor (IRR-1, 5MW). Particle accelerator facility. IAEA safeguarded.', source: 'IAEA, NTI', theaterId: 'middle-east' },

  // Iran
  { id: 'ir-natanz', facilityType: 'enrichment', name: 'Natanz Enrichment Facility', operator: 'Iran', lat: 33.72, lng: 51.73, status: 'active', description: 'Primary uranium enrichment site. Underground centrifuge halls (FEP). Enriching to 60% U-235 (weapons-grade threshold is 90%). Target of Stuxnet cyberattack (2010).', source: 'IAEA reports, satellite imagery', theaterId: 'middle-east', exclusionZoneKm: 15 },
  { id: 'ir-fordow', facilityType: 'enrichment', name: 'Fordow Fuel Enrichment Plant', operator: 'Iran', lat: 34.88, lng: 51.59, status: 'active', description: 'Underground enrichment facility built into mountain near Qom. Hardened against air strikes. Enriching to 60% U-235 since 2022.', source: 'IAEA reports, satellite imagery', theaterId: 'middle-east', exclusionZoneKm: 15 },
  { id: 'ir-isfahan-ucf', facilityType: 'research', name: 'Isfahan Nuclear Technology Center', operator: 'Iran', lat: 32.68, lng: 51.67, status: 'active', description: 'Uranium conversion facility (UCF). Converts yellowcake to UF6 for enrichment. Also zirconium production and fuel fabrication.', source: 'IAEA, NTI', theaterId: 'middle-east' },
  { id: 'ir-bushehr-reactor', facilityType: 'reactor', name: 'Bushehr Nuclear Power Plant', operator: 'Iran', lat: 28.83, lng: 50.89, status: 'active', description: 'Iran\'s only power-producing reactor. 1000MW VVER-1000, Russian-built. IAEA safeguarded. Unit 2 under construction.', source: 'IAEA PRIS', theaterId: 'middle-east', exclusionZoneKm: 20 },
  { id: 'ir-arak', facilityType: 'research', name: 'Arak Heavy Water Research Reactor', operator: 'Iran', lat: 34.04, lng: 49.24, status: 'active', description: 'IR-40 heavy water reactor. Core redesigned under JCPOA to limit plutonium output. Heavy water production plant adjacent.', source: 'IAEA reports, NTI', theaterId: 'middle-east' },

  // UAE
  { id: 'ae-barakah', facilityType: 'reactor', name: 'Barakah Nuclear Power Plant', operator: 'UAE (ENEC)', lat: 23.96, lng: 52.26, status: 'active', description: '4 APR-1400 reactors (Korean design). First nuclear plant in the Arab world. All 4 units operational as of 2024.', source: 'IAEA PRIS, ENEC', theaterId: 'middle-east', exclusionZoneKm: 20 },

  // === BALTIC / N. EUROPE ===
  { id: 'ru-leningrad-npp', facilityType: 'reactor', name: 'Leningrad NPP', operator: 'Russia', lat: 59.83, lng: 29.05, status: 'active', description: '4 RBMK-1000 reactors (Chernobyl type) + 2 VVER-1200. Near St. Petersburg. One of Russia\'s largest plants.', source: 'IAEA PRIS', theaterId: 'baltic', exclusionZoneKm: 30 },

  // === EAST ASIA / PACIFIC ===
  { id: 'kp-yongbyon', facilityType: 'enrichment', name: 'Yongbyon Nuclear Scientific Research Center', operator: 'North Korea', lat: 39.80, lng: 125.75, status: 'active', description: 'DPRK\'s primary nuclear weapons complex. 5MWe plutonium production reactor, reprocessing plant, uranium enrichment centrifuges. Source of fissile material for nuclear arsenal.', source: 'CSIS Beyond Parallel, satellite imagery', theaterId: 'east-asia', exclusionZoneKm: 15 },
  { id: 'kp-punggye-ri', facilityType: 'test-site', name: 'Punggye-ri Nuclear Test Site', operator: 'North Korea', lat: 41.28, lng: 129.08, status: 'suspended', description: '6 nuclear tests conducted (2006-2017). Tunnels reportedly collapsed/demolished May 2018. Satellite imagery suggests potential reconstruction.', source: 'CSIS Beyond Parallel, 38 North', theaterId: 'east-asia', exclusionZoneKm: 10 },
  { id: 'cn-lop-nur', facilityType: 'test-site', name: 'Lop Nur Nuclear Test Site', operator: 'China', lat: 41.57, lng: 88.30, status: 'decommissioned', description: 'China\'s nuclear weapons test site. 45 tests conducted (1964-1996). Decommissioned after CTBT signing.', source: 'NTI, FAS', theaterId: 'east-asia' },
];

export function getNuclearFacilitiesForTheater(theaterId: string): NuclearFacility[] {
  return NUCLEAR_FACILITIES.filter(site => site.theaterId === theaterId);
}

// Haversine distance in km between two points
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Check if any conflict events are near nuclear facilities
export interface ProximityAlert {
  facility: NuclearFacility;
  eventCount: number;
  closestDistanceKm: number;
}

export function getNuclearProximityAlerts(
  events: { coordinates: [number, number] }[],
  theaterId: string,
  radiusKm: number = 50
): ProximityAlert[] {
  const facilities = getNuclearFacilitiesForTheater(theaterId);
  const alerts: ProximityAlert[] = [];

  for (const facility of facilities) {
    let closest = Infinity;
    let count = 0;

    for (const event of events) {
      const dist = haversineKm(facility.lat, facility.lng, event.coordinates[1], event.coordinates[0]);
      if (dist <= radiusKm) {
        count++;
        if (dist < closest) closest = dist;
      }
    }

    if (count > 0) {
      alerts.push({
        facility,
        eventCount: count,
        closestDistanceKm: Math.round(closest * 10) / 10,
      });
    }
  }

  return alerts.sort((a, b) => a.closestDistanceKm - b.closestDistanceKm);
}
