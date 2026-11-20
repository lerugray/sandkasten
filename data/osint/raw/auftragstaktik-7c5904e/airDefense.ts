// Publicly confirmed air defense installations from OSINT sources
// Sources: CSIS Missile Threat, NTI, satellite imagery analysis, public reporting

export type ADStatus = 'confirmed' | 'suspected' | 'relocated';

export interface AirDefenseInstallation {
  id: string;
  system: string;        // e.g., "S-400 Triumf"
  operator: string;      // e.g., "Russia"
  location: string;      // Human-readable name
  lat: number;
  lng: number;
  rangeKm: number;       // Engagement envelope radius in km
  status: ADStatus;
  lastConfirmed: string; // YYYY-MM-DD
  source: string;        // Citation
  theaterId: string;     // Which theater this belongs to
}

// System name → max engagement range in km (publicly available figures)
const SYSTEM_RANGES: Record<string, number> = {
  'S-400 Triumf': 400,
  'S-300PM': 200,
  'S-300PMU-2': 200,
  'MIM-104 Patriot': 160,
  'NASAMS': 40,
  'IRIS-T SLM': 40,
  'Iron Dome': 70,
  "David's Sling": 300,
};

export const AIR_DEFENSE_SITES: AirDefenseInstallation[] = [
  // === UKRAINE THEATER ===
  {
    id: 'ru-s400-crimea-1',
    system: 'S-400 Triumf',
    operator: 'Russia',
    location: 'Sevastopol, Crimea',
    lat: 44.58, lng: 33.47,
    rangeKm: 400,
    status: 'confirmed',
    lastConfirmed: '2024-06-01',
    source: 'Satellite imagery, multiple OSINT analysts',
    theaterId: 'ukraine',
  },
  {
    id: 'ru-s400-crimea-2',
    system: 'S-400 Triumf',
    operator: 'Russia',
    location: 'Dzhankoi, Crimea',
    lat: 45.71, lng: 34.39,
    rangeKm: 400,
    status: 'confirmed',
    lastConfirmed: '2024-03-01',
    source: 'Satellite imagery',
    theaterId: 'ukraine',
  },
  { id: 'ru-s300-belgorod', system: 'S-300PM', operator: 'Russia', location: 'Belgorod Oblast', lat: 50.63, lng: 36.60, rangeKm: 200, status: 'confirmed', lastConfirmed: '2024-07-01', source: 'Open-source satellite analysis', theaterId: 'ukraine' },
  { id: 'ru-s400-rostov', system: 'S-400 Triumf', operator: 'Russia', location: 'Rostov-on-Don', lat: 47.24, lng: 39.71, rangeKm: 400, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'Russian MoD public imagery', theaterId: 'ukraine' },
  { id: 'ua-patriot-kyiv', system: 'MIM-104 Patriot', operator: 'Ukraine', location: 'Kyiv area', lat: 50.45, lng: 30.52, rangeKm: 160, status: 'confirmed', lastConfirmed: '2024-08-01', source: 'Public reporting, confirmed by Ukrainian officials', theaterId: 'ukraine' },
  { id: 'ua-nasams-1', system: 'NASAMS', operator: 'Ukraine', location: 'Central Ukraine', lat: 49.23, lng: 32.05, rangeKm: 40, status: 'suspected', lastConfirmed: '2024-06-01', source: 'Norwegian/US delivery confirmed, exact position unconfirmed', theaterId: 'ukraine' },
  { id: 'ua-iris-t', system: 'IRIS-T SLM', operator: 'Ukraine', location: 'Southern Ukraine', lat: 47.85, lng: 35.10, rangeKm: 40, status: 'suspected', lastConfirmed: '2024-05-01', source: 'German delivery confirmed, general area from public reporting', theaterId: 'ukraine' },

  // === MIDDLE EAST ===
  { id: 'il-irondome-1', system: 'Iron Dome', operator: 'Israel', location: 'Tel Aviv area', lat: 32.07, lng: 34.78, rangeKm: 70, status: 'confirmed', lastConfirmed: '2024-10-01', source: 'Publicly known deployment zone', theaterId: 'middle-east' },
  { id: 'il-irondome-2', system: 'Iron Dome', operator: 'Israel', location: 'Haifa area', lat: 32.80, lng: 34.99, rangeKm: 70, status: 'confirmed', lastConfirmed: '2024-10-01', source: 'Publicly known deployment zone', theaterId: 'middle-east' },
  { id: 'il-davids-sling', system: "David's Sling", operator: 'Israel', location: 'Central Israel', lat: 31.90, lng: 34.81, rangeKm: 300, status: 'confirmed', lastConfirmed: '2024-04-01', source: 'Israeli MoD public statements', theaterId: 'middle-east' },
  { id: 'ir-s300-isfahan', system: 'S-300PMU-2', operator: 'Iran', location: 'Isfahan nuclear facility', lat: 32.65, lng: 51.68, rangeKm: 200, status: 'confirmed', lastConfirmed: '2024-04-01', source: 'Satellite imagery, CSIS Missile Threat', theaterId: 'middle-east' },
  { id: 'ir-s300-tehran', system: 'S-300PMU-2', operator: 'Iran', location: 'Tehran', lat: 35.69, lng: 51.39, rangeKm: 200, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'Satellite imagery', theaterId: 'middle-east' },
  { id: 'sa-patriot-riyadh', system: 'MIM-104 Patriot', operator: 'Saudi Arabia', location: 'Riyadh', lat: 24.71, lng: 46.68, rangeKm: 160, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'Public reporting, confirmed intercepts', theaterId: 'middle-east' },
  { id: 'sy-s300-masyaf', system: 'S-300PM', operator: 'Syria / Russia', location: 'Masyaf, Syria', lat: 35.07, lng: 36.34, rangeKm: 200, status: 'confirmed', lastConfirmed: '2023-12-01', source: 'Satellite imagery, confirmed by Russian MoD', theaterId: 'middle-east' },
  { id: 'sy-s400-hmeimim', system: 'S-400 Triumf', operator: 'Russia', location: 'Hmeimim Air Base, Syria', lat: 35.41, lng: 35.95, rangeKm: 400, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'Russian MoD, satellite imagery', theaterId: 'middle-east' },

  // === BALTIC ===
  { id: 'ru-s400-kaliningrad', system: 'S-400 Triumf', operator: 'Russia', location: 'Kaliningrad Oblast', lat: 54.95, lng: 20.48, rangeKm: 400, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'Russian MoD public reporting, satellite imagery', theaterId: 'baltic' },
  { id: 'ru-s300-kaliningrad', system: 'S-300PM', operator: 'Russia', location: 'Baltiysk, Kaliningrad', lat: 54.65, lng: 19.92, rangeKm: 200, status: 'confirmed', lastConfirmed: '2023-06-01', source: 'Satellite imagery', theaterId: 'baltic' },
];

export function getAirDefenseForTheater(theaterId: string): AirDefenseInstallation[] {
  return AIR_DEFENSE_SITES.filter(site => site.theaterId === theaterId);
}
