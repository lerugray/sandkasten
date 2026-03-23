// Types matching the extracted CMO database JSON schema
// See DB_EXTRACTION_SPEC.md for field descriptions and source table mappings

export interface SpeedProfileEntry {
  altitudeBand: number;
  throttle: number; // 1=loiter, 2=cruise, 3=full, 4=flank/afterburner
  speed: number; // knots
  altitudeMin: number; // feet
  altitudeMax: number; // feet
  consumption: number; // fuel units/hour
}

export interface Propulsion {
  id: number;
  name: string;
  typeId: number;
  numberOfEngines: number;
  numberOfShafts: number;
  combinedTypeId: number;
  thrustMilitary: number;
  thrustAfterburner: number;
  sfcMilitary: number;
  sfcAfterburner: number;
  speedProfile: SpeedProfileEntry[];
}

export interface Fuel {
  typeId: number;
  capacity: number;
}

export interface Signature {
  typeId: number;
  front: number;
  side: number;
  rear: number;
  top?: number; // ships/aircraft have top, weapons don't
}

export interface OODACycle {
  detection: number; // seconds
  targeting: number;
  evasion: number;
}

// --- Ships ---

export interface ShipArmor {
  belt: number;
  bulkheads: number;
  deck: number;
  bridge: number;
  cic: number;
  engineering: number;
  rudder: number;
}

export interface ShipRecord {
  id: number;
  name: string;
  categoryId: number;
  typeId: number;
  countryId: number;
  serviceId: number;
  yearCommissioned: number;
  yearDecommissioned: number;
  comments: string;
  length: number;
  beam: number;
  draft: number;
  height: number;
  displacementEmpty: number;
  displacementStandard: number;
  displacementFull: number;
  crew: number;
  damagePoints: number;
  missileDefense: number;
  maxSeaState: number;
  armor: ShipArmor;
  ooda: OODACycle;
  ergonomicsId: number;
  physicalSizeId: number;
  csGenId: number;
  propulsion: Propulsion[];
  fuel: Fuel[];
  sensorIds: number[];
  mountIds: number[];
  signatures: Signature[];
}

// --- Aircraft ---

export interface AircraftArmor {
  engine: number;
  fuselage: number;
  cockpit: number;
}

export interface AircraftRecord {
  id: number;
  name: string;
  categoryId: number;
  typeId: number;
  countryId: number;
  serviceId: number;
  yearCommissioned: number;
  yearDecommissioned: number;
  comments: string;
  length: number;
  span: number;
  height: number;
  weightEmpty: number;
  weightMax: number;
  weightPayload: number;
  crew: number;
  agility: number;
  climbRate: number;
  endurance: number; // minutes
  damagePoints: number;
  cockpitGenId: number;
  physicalSizeId: number;
  runwayLengthId: number;
  autonomousControlLevel: number;
  armor: AircraftArmor;
  ooda: OODACycle;
  ergonomicsId: number;
  propulsion: Propulsion[];
  fuel: Fuel[];
  sensorIds: number[];
  mountIds: number[];
  loadoutIds: number[];
  signatures: Signature[];
}

// --- Weapons ---

export interface PKValues {
  air: number;
  surface: number;
  land: number;
  subsurface: number;
}

export interface RangeMinMax {
  min: number;
  max: number;
}

export interface LaunchConstraints {
  speedMin: number;
  speedMax: number;
  altitudeMin: number;
  altitudeMax: number;
}

export interface TorpedoPerformance {
  speedCruise: number;
  rangeCruise: number;
  speedFull: number;
  rangeFull: number;
}

export interface Warhead {
  id: number;
  name: string;
  typeId: number;
  damagePoints: number;
  explosivesTypeId: number;
  explosivesWeight: number;
  numberOfWarheads: number;
}

export interface WRAEntry {
  targetTypeId: number;
  weaponQty: number; // negative values have special meaning, see DB_EXTRACTION_SPEC.md
  shooterQty: number;
  autoFireRange: number;
  selfDefenseRange: number;
}

export interface WeaponRecord {
  id: number;
  name: string;
  typeId: number;
  generationId: number;
  comments: string;
  length: number;
  span: number;
  diameter: number;
  weight: number;
  cruiseAltitude: number;
  maxFlightTime: number;
  climbRate: number;
  waypointNumber: number;
  cep: number;
  cepSurface: number;
  pk: PKValues;
  range: {
    air: RangeMinMax;
    surface: RangeMinMax;
    land: RangeMinMax;
    subsurface: RangeMinMax;
  };
  launch: LaunchConstraints;
  target: LaunchConstraints;
  torpedo: TorpedoPerformance;
  warhead: Warhead | null;
  validTargetIds: number[];
  seekerSensorIds: number[];
  wra: WRAEntry[];
  propulsion: Propulsion[];
  signatures: Signature[];
}

// --- Sensors ---

export interface SensorMaxContacts {
  air: number;
  surface: number;
  submarine: number;
  illuminate: number;
}

export interface SensorResolution {
  range: number;
  height: number;
  angle: number;
}

export interface RadarParams {
  horizontalBeamwidth: number;
  verticalBeamwidth: number;
  systemNoiseLevel: number;
  processingGainLoss: number;
  peakPower: number;
  pulseWidth: number;
  blindTime: number;
  prf: number;
}

export interface ESMParams {
  sensitivity: number;
  systemLoss: number;
  numberOfChannels: number;
  preciseEmitterID: boolean;
}

export interface ECMParams {
  gain: number;
  peakPower: number;
  bandwidth: number;
  numberOfTargets: number;
  pokReduction: number;
}

export interface SonarParams {
  sourceLevel: number;
  pulseLength: number;
  directivityIndex: number;
  recognitionDifferentialActive: number;
  recognitionDifferentialPassive: number;
  sensorToMachineryDistance: number;
  towLength: number;
  minDeploymentDepth: number;
  maxDeploymentDepth: number;
  czNumber: number;
}

export interface VisualIRParams {
  detectionZoomLevel: number;
  classificationZoomLevel: number;
}

export interface MinimumSignatures {
  radar: number;
  visual: number;
  ir: number;
  esm: number;
  activeSonar: number;
  passiveSonar: number;
}

export interface SensorRecord {
  id: number;
  name: string;
  typeId: number;
  roleId: number;
  generationId: number;
  comments: string;
  rangeMin: number;
  rangeMax: number; // nautical miles
  altitudeMin: number;
  altitudeMax: number;
  scanInterval: number; // seconds
  maxContacts: SensorMaxContacts;
  resolution: SensorResolution;
  availability: number; // percent
  capabilityIds: number[];
  radar: RadarParams;
  radarIlluminate: RadarParams;
  esm: ESMParams;
  ecm: ECMParams;
  sonar: SonarParams;
  visual: VisualIRParams;
  ir: VisualIRParams;
  minimumSignature: MinimumSignatures;
  frequencySearchTrack: number[];
  frequencyIlluminate: number[];
  frequencyUpper: number;
  frequencyLower: number;
}

// --- Mounts ---

export interface MountRecord {
  id: number;
  name: string;
  comments: string;
  rof: number; // rounds per minute
  capacity: number; // ready rounds
  magazineROF: number;
  magazineCapacity: number;
  damagePoints: number;
  armorGeneralId: number;
  trainable: boolean;
  autonomous: boolean;
  localControl: boolean;
  availability: number;
  weaponIds: number[];
  sensorIds: number[];
}

// --- Loadouts ---

export interface LoadoutRecord {
  id: number;
  name: string;
  roleId: number;
  readyTime: number; // seconds
  readyTimeSustained: number;
  combatRadius: number; // nautical miles
  timeOnStation: number; // minutes
  missionProfileId: number;
  timeOfDayId: number;
  weatherId: number;
  quickTurnaround: boolean;
  quickTurnaroundReadyTime: number;
  quickTurnaroundMaxSorties: number;
  weaponIds: number[];
}

// --- Extracted file wrapper ---

export interface ExtractedData<T> {
  _meta: {
    source: string;
    extractedAt: string;
    table: string;
    count: number;
  };
  records: T[];
}

// --- Enum lookup ---

export interface EnumFile {
  _meta: {
    source: string;
    extractedAt: string;
    table: string;
    count: number;
  };
  entries: Record<string, string | Record<string, unknown>>;
}
