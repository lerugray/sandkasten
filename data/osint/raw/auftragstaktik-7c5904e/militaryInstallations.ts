// Publicly known military installations, bases, HQs, and strategic chokepoints
// Sources: GlobalSecurity.org, CSIS, public satellite imagery, official government statements

export type InstallationType = 'airbase' | 'naval-base' | 'hq' | 'logistics' | 'chokepoint' | 'infrastructure';
export type InstallationStatus = 'active' | 'damaged' | 'destroyed' | 'contested';

export interface MilitaryInstallation {
  id: string;
  type: InstallationType;
  name: string;
  operator: string;
  lat: number;
  lng: number;
  status: InstallationStatus;
  description: string;
  source: string;
  theaterId: string;
}

// Friendly nations per context — used for SIDC affiliation
const FRIENDLY_OPERATORS = [
  'Ukraine', 'Israel', 'Saudi Arabia', 'NATO', 'United States',
  'United Kingdom', 'South Korea', 'Japan', 'Taiwan', 'Finland',
  'Sweden', 'Norway', 'Poland', 'Estonia', 'Latvia', 'Lithuania',
];

export function isFriendlyOperator(operator: string): boolean {
  return FRIENDLY_OPERATORS.some(f => operator.includes(f));
}

export const MILITARY_INSTALLATIONS: MilitaryInstallation[] = [
  // === UKRAINE THEATER ===
  // Russian bases
  { id: 'ru-engels-2', type: 'airbase', name: 'Engels-2 Air Base', operator: 'Russia', lat: 51.48, lng: 46.20, status: 'active', description: 'Strategic bomber base. Tu-95MS and Tu-160 long-range strike aircraft. Primary launch point for cruise missile attacks on Ukraine.', source: 'Public reporting, satellite imagery', theaterId: 'ukraine' },
  { id: 'ru-morozovsk', type: 'airbase', name: 'Morozovsk Air Base', operator: 'Russia', lat: 48.32, lng: 41.78, status: 'active', description: 'Tactical fighter base, 559th Bomber Aviation Regiment. Su-34 fullback operations against Ukraine.', source: 'Satellite imagery, OSINT analysts', theaterId: 'ukraine' },
  { id: 'ru-akhtubinsk', type: 'airbase', name: 'Akhtubinsk Air Base', operator: 'Russia', lat: 48.32, lng: 46.15, status: 'active', description: 'Flight test center. VKS weapons testing and evaluation facility.', source: 'Public Russian MoD reporting', theaterId: 'ukraine' },
  { id: 'ru-saki', type: 'airbase', name: 'Saki Air Base (Novofedorivka)', operator: 'Russia', lat: 45.09, lng: 33.59, status: 'damaged', description: 'Crimean airbase. Struck by Ukraine in Aug 2022, partially operational.', source: 'Satellite imagery, Ukrainian MoD', theaterId: 'ukraine' },
  { id: 'ru-sevastopol-naval', type: 'naval-base', name: 'Sevastopol Naval Base', operator: 'Russia (Black Sea Fleet)', lat: 44.62, lng: 33.52, status: 'active', description: 'Black Sea Fleet headquarters. Multiple warships damaged or sunk by Ukrainian attacks since 2022.', source: 'Public reporting, satellite imagery', theaterId: 'ukraine' },
  { id: 'ru-novorossiysk', type: 'naval-base', name: 'Novorossiysk Naval Base', operator: 'Russia (Black Sea Fleet)', lat: 44.72, lng: 37.79, status: 'active', description: 'Secondary Black Sea Fleet base. BSF assets relocated here after Sevastopol attacks.', source: 'Satellite imagery, public reporting', theaterId: 'ukraine' },
  { id: 'ru-rostov-hq', type: 'hq', name: 'Southern Military District HQ', operator: 'Russia', lat: 47.23, lng: 39.72, status: 'active', description: 'Southern Military District headquarters. Commands operations in Ukraine theater.', source: 'Russian MoD, public reporting', theaterId: 'ukraine' },
  { id: 'ua-starokostiantyniv', type: 'airbase', name: 'Starokostiantyniv Air Base', operator: 'Ukraine', lat: 49.39, lng: 27.10, status: 'active', description: 'Ukrainian Air Force base. Expected to host F-16s.', source: 'Ukrainian Air Force public statements', theaterId: 'ukraine' },
  { id: 'kerch-bridge', type: 'infrastructure', name: 'Kerch Strait Bridge', operator: 'Russia', lat: 45.31, lng: 36.51, status: 'damaged', description: 'Road and rail bridge connecting Crimea to Russia. Struck by Ukraine in Oct 2022 and Jul 2023. Critical logistics link.', source: 'Public reporting, satellite imagery', theaterId: 'ukraine' },

  // === MIDDLE EAST ===
  // Israel
  { id: 'il-nevatim', type: 'airbase', name: 'Nevatim Air Base', operator: 'Israel (IAF)', lat: 31.21, lng: 34.94, status: 'active', description: 'F-35I Adir squadron base. Primary stealth fighter operations.', source: 'Israeli government, public reporting', theaterId: 'middle-east' },
  { id: 'il-ramat-david', type: 'airbase', name: 'Ramat David Air Base', operator: 'Israel (IAF)', lat: 32.67, lng: 35.18, status: 'active', description: 'Northern Israel fighter base. F-16 operations, targeted by Iranian ballistic missiles Oct 2024.', source: 'Public reporting, satellite imagery', theaterId: 'middle-east' },
  { id: 'il-haifa-naval', type: 'naval-base', name: 'Haifa Naval Base', operator: 'Israel (IN)', lat: 32.82, lng: 34.97, status: 'active', description: 'Israeli Navy main base. Sa\'ar corvettes, Dolphin-class submarines.', source: 'Public reporting', theaterId: 'middle-east' },

  // Iran
  { id: 'ir-bandar-abbas', type: 'naval-base', name: 'Bandar Abbas Naval Base', operator: 'Iran (IRIN)', lat: 27.15, lng: 56.27, status: 'active', description: 'IRIN main fleet base. Controls Strait of Hormuz. Frigates, fast attack craft, midget submarines.', source: 'Satellite imagery, public reporting', theaterId: 'middle-east' },
  { id: 'ir-isfahan-airbase', type: 'airbase', name: 'Isfahan (Khatami) Air Base', operator: 'Iran (IRIAF)', lat: 32.75, lng: 51.86, status: 'active', description: 'IRIAF tactical fighter base. F-14 Tomcat operations (one of last operators worldwide).', source: 'Satellite imagery', theaterId: 'middle-east' },
  { id: 'ir-bushehr-airbase', type: 'airbase', name: 'Bushehr Air Base', operator: 'Iran (IRIAF)', lat: 28.95, lng: 50.83, status: 'active', description: 'Coastal air base near Bushehr nuclear reactor. Air defense and maritime patrol.', source: 'Satellite imagery', theaterId: 'middle-east' },

  // Syria / Russia
  { id: 'sy-hmeimim', type: 'airbase', name: 'Hmeimim Air Base', operator: 'Russia (VKS)', lat: 35.41, lng: 35.95, status: 'active', description: 'Russian forward operating base in Syria. Su-35, Su-34, Su-24 tactical air operations.', source: 'Russian MoD, satellite imagery', theaterId: 'middle-east' },
  { id: 'sy-tartus', type: 'naval-base', name: 'Tartus Naval Facility', operator: 'Russia (VMF)', lat: 34.89, lng: 35.87, status: 'active', description: 'Russia\'s only Mediterranean naval base. Logistics hub for Mediterranean deployments.', source: 'Satellite imagery, public reporting', theaterId: 'middle-east' },

  // Strategic chokepoints
  { id: 'cp-hormuz', type: 'chokepoint', name: 'Strait of Hormuz', operator: 'International', lat: 26.57, lng: 56.25, status: 'active', description: '21% of global oil transit. 21 miles wide at narrowest point. Iran controls northern shore.', source: 'EIA, public data', theaterId: 'middle-east' },
  { id: 'cp-bab-el-mandeb', type: 'chokepoint', name: 'Bab el-Mandeb Strait', operator: 'International', lat: 12.58, lng: 43.33, status: 'contested', description: 'Red Sea chokepoint. Houthi anti-ship attacks since late 2023 disrupted global shipping. 26 miles wide.', source: 'Public reporting, shipping data', theaterId: 'middle-east' },
  { id: 'cp-suez', type: 'chokepoint', name: 'Suez Canal', operator: 'Egypt', lat: 30.46, lng: 32.35, status: 'active', description: '12% of global trade. Red Sea attacks drove traffic down ~50% in early 2024.', source: 'Suez Canal Authority, public data', theaterId: 'middle-east' },
  { id: 'ir-kharg-island', type: 'infrastructure', name: 'Kharg Island Oil Terminal', operator: 'Iran', lat: 29.23, lng: 50.31, status: 'active', description: '90% of Iran\'s crude oil exports. Most critical single point of failure for Iranian economy.', source: 'EIA, satellite imagery', theaterId: 'middle-east' },

  // === BALTIC / N. EUROPE ===
  { id: 'ru-kaliningrad-baltiysk', type: 'naval-base', name: 'Baltiysk Naval Base', operator: 'Russia (Baltic Fleet)', lat: 54.65, lng: 19.92, status: 'active', description: 'Baltic Fleet headquarters. Corvettes, landing ships, submarines.', source: 'Public reporting, satellite imagery', theaterId: 'baltic' },
  { id: 'ru-chkalovsk', type: 'airbase', name: 'Chkalovsk Air Base', operator: 'Russia (VKS)', lat: 54.77, lng: 20.38, status: 'active', description: 'Kaliningrad naval aviation. Su-24, Su-27 fighters. Nuclear-capable Iskander missiles nearby.', source: 'Satellite imagery, public reporting', theaterId: 'baltic' },
  { id: 'ru-severomorsk', type: 'naval-base', name: 'Severomorsk Naval Base', operator: 'Russia (Northern Fleet)', lat: 69.07, lng: 33.42, status: 'active', description: 'Northern Fleet headquarters. SSBNs, cruisers, destroyers. Primary nuclear submarine force.', source: 'Public reporting', theaterId: 'baltic' },
  { id: 'cp-bosphorus', type: 'chokepoint', name: 'Bosphorus Strait', operator: 'Turkey', lat: 41.12, lng: 29.05, status: 'active', description: 'Black Sea access control. Turkey closed to warships under Montreux Convention after Feb 2022 invasion.', source: 'Public reporting, Montreux Convention', theaterId: 'baltic' },

  // === EAST ASIA / PACIFIC ===
  { id: 'cn-yulin', type: 'naval-base', name: 'Yulin Naval Base', operator: 'China (PLAN)', lat: 18.22, lng: 109.55, status: 'active', description: 'Underground submarine pens on Hainan Island. SSBNs, nuclear attack submarines. South China Sea power projection.', source: 'Satellite imagery, CSIS Asia Maritime', theaterId: 'east-asia' },
  { id: 'cn-woody-island', type: 'airbase', name: 'Woody Island Air Base', operator: 'China (PLAAF)', lat: 16.83, lng: 112.34, status: 'active', description: 'Militarized artificial island in Paracels. Fighter aircraft, HQ-9 SAMs, anti-ship missiles.', source: 'CSIS Asia Maritime, satellite imagery', theaterId: 'east-asia' },
  { id: 'cn-fiery-cross', type: 'airbase', name: 'Fiery Cross Reef', operator: 'China (PLA)', lat: 9.55, lng: 112.89, status: 'active', description: 'Militarized artificial island in Spratlys. 3km runway, radar, weapons systems.', source: 'CSIS Asia Maritime, satellite imagery', theaterId: 'east-asia' },
  { id: 'tw-hualien', type: 'airbase', name: 'Hualien Air Base', operator: 'Taiwan (ROCAF)', lat: 24.02, lng: 121.62, status: 'active', description: 'Eastern Taiwan fighter base with mountain hangars. F-16V operations.', source: 'Public reporting', theaterId: 'east-asia' },
  { id: 'kr-osan', type: 'airbase', name: 'Osan Air Base', operator: 'United States (USAF)', lat: 37.09, lng: 127.03, status: 'active', description: '51st Fighter Wing. USFK primary tactical air base. A-10, F-16 operations.', source: 'USFK public information', theaterId: 'east-asia' },
  { id: 'jp-yokosuka', type: 'naval-base', name: 'Yokosuka Naval Base', operator: 'United States (USN) / Japan (JMSDF)', lat: 35.28, lng: 139.67, status: 'active', description: 'US 7th Fleet headquarters. Forward-deployed carrier (USS Ronald Reagan). Largest US naval facility in Pacific.', source: 'US Navy public information', theaterId: 'east-asia' },
  { id: 'kp-sunchon', type: 'airbase', name: 'Sunchon Air Base', operator: 'North Korea (KPAF)', lat: 39.42, lng: 125.90, status: 'active', description: 'MiG-29 operations. One of DPRK\'s most capable fighter bases.', source: 'Satellite imagery, CSIS Beyond Parallel', theaterId: 'east-asia' },
  { id: 'cp-malacca', type: 'chokepoint', name: 'Strait of Malacca', operator: 'International', lat: 2.50, lng: 101.50, status: 'active', description: '25-30% of global trade. 1.5 miles wide at narrowest. China\'s critical oil supply vulnerability ("Malacca Dilemma").', source: 'Public data, EIA', theaterId: 'east-asia' },
  { id: 'cp-taiwan-strait', type: 'chokepoint', name: 'Taiwan Strait', operator: 'International', lat: 24.50, lng: 119.50, status: 'active', description: '88 miles wide. ~50% of global container traffic transits annually. Flashpoint for PRC-Taiwan tensions.', source: 'Public data', theaterId: 'east-asia' },
];

export function getInstallationsForTheater(theaterId: string): MilitaryInstallation[] {
  return MILITARY_INSTALLATIONS.filter(site => site.theaterId === theaterId);
}
