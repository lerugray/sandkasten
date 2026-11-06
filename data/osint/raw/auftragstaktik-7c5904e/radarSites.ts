// Publicly known radar installations and major sensor systems
// Sources: GlobalSecurity.org, CSIS Missile Threat, FAS, public satellite imagery

export type RadarType = 'early-warning' | 'theater' | 'coastal' | 'tracking' | 'space-surveillance';
export type RadarStatus = 'confirmed' | 'suspected' | 'under-construction';

export interface RadarInstallation {
  id: string;
  system: string;
  radarType: RadarType;
  operator: string;
  location: string;
  lat: number;
  lng: number;
  detectionRangeKm: number;
  trackingRangeKm?: number;   // If different from detection range
  status: RadarStatus;
  lastConfirmed: string;
  source: string;
  theaterId: string;
}

// Friendly nations — same logic as AD layer
const FRIENDLY_OPERATORS = [
  'Ukraine', 'Israel', 'Saudi Arabia', 'NATO', 'United States',
  'United Kingdom', 'South Korea', 'Japan', 'Taiwan', 'Finland',
  'Sweden', 'Norway', 'Poland', 'Estonia', 'Latvia', 'Lithuania',
];

export function isRadarFriendly(operator: string): boolean {
  return FRIENDLY_OPERATORS.some(f => operator.includes(f));
}

export const RADAR_SITES: RadarInstallation[] = [
  // === UKRAINE THEATER ===
  { id: 'ru-voronezh-armavir', system: 'Voronezh-DM', radarType: 'early-warning', operator: 'Russia', location: 'Armavir, Krasnodar', lat: 44.98, lng: 40.22, detectionRangeKm: 6000, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'Russian MoD, satellite imagery', theaterId: 'ukraine' },
  { id: 'ru-voronezh-orsk', system: 'Voronezh-M', radarType: 'early-warning', operator: 'Russia', location: 'Orsk, Orenburg', lat: 51.20, lng: 58.60, detectionRangeKm: 6000, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'Russian MoD public reporting', theaterId: 'ukraine' },
  { id: 'ru-nebo-m-crimea', system: 'Nebo-M', radarType: 'theater', operator: 'Russia', location: 'Crimea', lat: 45.12, lng: 34.05, detectionRangeKm: 600, trackingRangeKm: 400, status: 'suspected', lastConfirmed: '2024-03-01', source: 'OSINT analysts, satellite imagery', theaterId: 'ukraine' },
  { id: 'ru-rezonans-ne', system: 'Rezonans-NE', radarType: 'theater', operator: 'Russia', location: 'Rostov Oblast', lat: 47.50, lng: 40.10, detectionRangeKm: 1100, trackingRangeKm: 600, status: 'confirmed', lastConfirmed: '2023-12-01', source: 'Russian defense press', theaterId: 'ukraine' },
  { id: 'ru-monolit-crimea', system: 'Monolit-B', radarType: 'coastal', operator: 'Russia', location: 'Cape Tarkhankut, Crimea', lat: 45.35, lng: 32.49, detectionRangeKm: 450, status: 'confirmed', lastConfirmed: '2024-06-01', source: 'Satellite imagery', theaterId: 'ukraine' },

  // === MIDDLE EAST ===
  { id: 'ir-ghadir', system: 'Ghadir', radarType: 'early-warning', operator: 'Iran', location: 'Central Iran', lat: 33.50, lng: 52.00, detectionRangeKm: 1100, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'Iranian state media, satellite imagery', theaterId: 'middle-east' },
  { id: 'ir-sepehr', system: 'Sepehr', radarType: 'early-warning', operator: 'Iran', location: 'Southern Iran', lat: 29.50, lng: 53.00, detectionRangeKm: 3000, status: 'suspected', lastConfirmed: '2023-06-01', source: 'Iranian state media claims, unverified range', theaterId: 'middle-east' },
  { id: 'ir-khalij-fars', system: 'Khalij Fars', radarType: 'coastal', operator: 'Iran', location: 'Strait of Hormuz coast', lat: 26.95, lng: 56.10, detectionRangeKm: 300, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'Iranian Navy public statements', theaterId: 'middle-east' },
  { id: 'il-elta-2080', system: 'EL/M-2080 Green Pine', radarType: 'tracking', operator: 'Israel', location: 'Negev Desert', lat: 30.95, lng: 34.75, detectionRangeKm: 500, trackingRangeKm: 500, status: 'confirmed', lastConfirmed: '2024-10-01', source: 'Public reporting, part of Arrow system', theaterId: 'middle-east' },
  { id: 'sa-an-fps-117', system: 'AN/FPS-117', radarType: 'theater', operator: 'Saudi Arabia', location: 'Northern Saudi Arabia', lat: 28.40, lng: 41.00, detectionRangeKm: 470, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'US FMS records', theaterId: 'middle-east' },

  // === BALTIC / N. EUROPE ===
  { id: 'ru-voronezh-lekhtu', system: 'Voronezh-M', radarType: 'early-warning', operator: 'Russia', location: 'Lekhtusi, Leningrad Oblast', lat: 60.28, lng: 30.55, detectionRangeKm: 6000, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'Russian MoD, satellite imagery', theaterId: 'baltic' },
  { id: 'ru-voronezh-kaliningrad', system: 'Voronezh-DM', radarType: 'early-warning', operator: 'Russia', location: 'Pionersky, Kaliningrad', lat: 54.95, lng: 20.22, detectionRangeKm: 6000, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'Russian MoD, public reporting', theaterId: 'baltic' },
  { id: 'ru-container-mordovia', system: 'Container (29B6)', radarType: 'early-warning', operator: 'Russia', location: 'Kovylkino, Mordovia', lat: 54.00, lng: 43.90, detectionRangeKm: 3000, status: 'confirmed', lastConfirmed: '2023-12-01', source: 'Russian defense press', theaterId: 'baltic' },
  { id: 'no-globus-iii', system: 'Globus III', radarType: 'space-surveillance', operator: 'Norway / United States', location: 'Vardø, Norway', lat: 70.37, lng: 31.11, detectionRangeKm: 5000, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'Norwegian government, public reporting', theaterId: 'baltic' },

  // === EAST ASIA / PACIFIC ===
  { id: 'cn-type-7010', system: 'Type 7010', radarType: 'early-warning', operator: 'China', location: 'Xuanhua, Hebei', lat: 40.60, lng: 115.03, detectionRangeKm: 3000, status: 'confirmed', lastConfirmed: '2023-06-01', source: 'US DoD China Military Power report', theaterId: 'east-asia' },
  { id: 'cn-skywave-oth', system: 'OTH-B Skywave', radarType: 'early-warning', operator: 'China', location: 'Hubei Province', lat: 30.80, lng: 112.50, detectionRangeKm: 3000, status: 'suspected', lastConfirmed: '2023-01-01', source: 'Satellite imagery analysis, academic papers', theaterId: 'east-asia' },
  { id: 'kr-tps-880k', system: 'TPS-880K Green Pine', radarType: 'tracking', operator: 'South Korea', location: 'Seongju, South Korea', lat: 35.90, lng: 128.20, detectionRangeKm: 800, trackingRangeKm: 500, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'South Korean MND, public reporting', theaterId: 'east-asia' },
  { id: 'jp-fps-5', system: 'J/FPS-5', radarType: 'early-warning', operator: 'Japan', location: 'Shimokoshiki Island', lat: 31.70, lng: 129.90, detectionRangeKm: 2000, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'Japan MoD, public reporting', theaterId: 'east-asia' },
  { id: 'us-thaad-guam', system: 'AN/TPY-2 (THAAD)', radarType: 'tracking', operator: 'United States', location: 'Andersen AFB, Guam', lat: 13.58, lng: 144.92, detectionRangeKm: 1000, trackingRangeKm: 600, status: 'confirmed', lastConfirmed: '2024-01-01', source: 'US Indo-Pacific Command', theaterId: 'east-asia' },
];

export function getRadarSitesForTheater(theaterId: string): RadarInstallation[] {
  return RADAR_SITES.filter(site => site.theaterId === theaterId);
}
