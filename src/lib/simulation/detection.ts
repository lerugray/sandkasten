import type { Unit, Position } from "@/types/game";
import type { Contact, UnitOrders } from "./gameState";
import { distanceNm } from "./movement";
import { getPlatform } from "@/lib/platforms/lookup";

const KM_PER_NM = 1.852;

interface DetectionResult {
  detected: boolean;
  classification: Contact["classification"];
  uncertainty: number; // km
  sensorType: string;
}

/**
 * Simple radar detection model.
 *
 * Detection probability decreases linearly with range.
 * At max range: base probability (e.g. 10%)
 * At 0 range: 100%
 *
 * Modifiers:
 * - Target radar cross section (signature) — not yet used, placeholder
 * - Whether the detecting unit's radar is active
 * - Altitude advantage (higher altitude extends radar horizon)
 */
export function checkRadarDetection(
  detector: Unit,
  detectorOrders: UnitOrders,
  target: Unit,
  maxRangeNm: number
): DetectionResult {
  const noDetection: DetectionResult = {
    detected: false,
    classification: "unknown",
    uncertainty: 0,
    sensorType: "radar",
  };

  // Radar must be active
  if (!detectorOrders.radarActive) return noDetection;

  const range = distanceNm(detector.position, target.position);
  if (range > maxRangeNm) return noDetection;

  // Base detection probability: linear falloff from 1.0 at range=0 to 0.1 at max range
  const baseProbability = 1.0 - 0.9 * (range / maxRangeNm);

  // Radar horizon check (simplified)
  // Radar horizon in NM ≈ 1.23 × (√h_detector_ft + √h_target_ft)
  const detAlt = detector.altitude ?? 20; // ships ~20ft mast height
  const tgtAlt = target.altitude ?? 20;
  const radarHorizon = 1.23 * (Math.sqrt(detAlt) + Math.sqrt(tgtAlt));

  if (range > radarHorizon && (detAlt < 1000 || tgtAlt < 1000)) {
    // Below radar horizon for low-altitude units
    return noDetection;
  }

  // Roll for detection
  const roll = Math.random();
  if (roll > baseProbability) return noDetection;

  // Determine classification level based on range
  let classification: Contact["classification"];
  if (range < maxRangeNm * 0.25) {
    classification = "classified";
  } else if (range < maxRangeNm * 0.5) {
    classification = "detected";
  } else {
    classification = "unknown";
  }

  // Position uncertainty: proportional to range
  const uncertainty = Math.max(0.5, (range / maxRangeNm) * 5); // 0.5 - 5 km

  return {
    detected: true,
    classification,
    uncertainty,
    sensorType: "radar",
  };
}

/**
 * ESM (Electronic Support Measures) detection.
 * Detects radar emitters — bearing only, no range.
 * Only works if the target has active radar.
 */
export function checkESMDetection(
  detector: Unit,
  target: Unit,
  targetOrders: UnitOrders,
  maxRangeNm: number
): DetectionResult {
  const noDetection: DetectionResult = {
    detected: false,
    classification: "unknown",
    uncertainty: 0,
    sensorType: "esm",
  };

  // ESM only detects active emitters
  if (!targetOrders.radarActive) return noDetection;

  const range = distanceNm(detector.position, target.position);
  // ESM typically has longer range than radar (detects at 1.5x the emitter's range)
  if (range > maxRangeNm * 1.5) return noDetection;

  // ESM is passive — high probability of detecting active emitters
  const probability = range < maxRangeNm ? 0.95 : 0.5;
  if (Math.random() > probability) return noDetection;

  return {
    detected: true,
    classification: "unknown", // ESM gives bearing only, can't classify
    uncertainty: Math.max(2, range * 0.1), // 10% range uncertainty
    sensorType: "esm",
  };
}

/**
 * Visual detection — short range, no emissions required.
 */
export function checkVisualDetection(
  detector: Unit,
  target: Unit
): DetectionResult {
  const noDetection: DetectionResult = {
    detected: false,
    classification: "unknown",
    uncertainty: 0,
    sensorType: "visual",
  };

  const range = distanceNm(detector.position, target.position);

  // Visual range depends on target size and altitude
  const isAir = (target.altitude ?? 0) > 500;
  const maxVisualNm = isAir ? 15 : 10; // aircraft visible further

  if (range > maxVisualNm) return noDetection;

  const probability = 1.0 - (range / maxVisualNm);
  if (Math.random() > probability) return noDetection;

  // Visual gives good classification at close range
  let classification: Contact["classification"];
  if (range < 3) {
    classification = "classified";
  } else if (range < 6) {
    classification = "detected";
  } else {
    classification = "unknown";
  }

  return {
    detected: true,
    classification,
    uncertainty: Math.max(0.1, range * 0.02), // very accurate
    sensorType: "visual",
  };
}

/**
 * Run all sensor checks for one detector against one target.
 * Returns the best detection result (highest classification).
 */
export function runDetectionChecks(
  detector: Unit,
  detectorOrders: UnitOrders,
  target: Unit,
  targetOrders: UnitOrders
): DetectionResult | null {
  const platform = getPlatform(detector.platformId);
  const sensorRangeNm = platform?.sensorRangeKm
    ? platform.sensorRangeKm / KM_PER_NM
    : 50; // default 50nm

  const classificationOrder: Contact["classification"][] = [
    "unknown",
    "detected",
    "classified",
    "tracked",
  ];

  let best: DetectionResult | null = null;

  // Radar check
  const radar = checkRadarDetection(detector, detectorOrders, target, sensorRangeNm);
  if (radar.detected) {
    best = radar;
  }

  // ESM check (uses target's radar range as reference for ESM intercept range)
  const targetPlatform = getPlatform(target.platformId);
  const targetRadarNm = targetPlatform?.sensorRangeKm
    ? targetPlatform.sensorRangeKm / KM_PER_NM
    : 50;
  const esm = checkESMDetection(detector, target, targetOrders, targetRadarNm);
  if (esm.detected) {
    if (!best || classificationOrder.indexOf(esm.classification) > classificationOrder.indexOf(best.classification)) {
      best = esm;
    }
  }

  // Visual check
  const visual = checkVisualDetection(detector, target);
  if (visual.detected) {
    if (!best || classificationOrder.indexOf(visual.classification) > classificationOrder.indexOf(best.classification)) {
      best = visual;
    }
  }

  return best;
}

/**
 * Merge a new detection result with an existing contact.
 * Classification only improves, never degrades.
 * Position updates to latest sensor data.
 */
export function mergeContact(
  existing: Contact,
  newDetection: DetectionResult,
  actualPosition: Position,
  simTime: number
): Contact {
  const classificationOrder: Contact["classification"][] = [
    "unknown",
    "detected",
    "classified",
    "tracked",
  ];

  const currentIdx = classificationOrder.indexOf(existing.classification);
  const newIdx = classificationOrder.indexOf(newDetection.classification);

  // If detected by radar and tracked continuously, upgrade to tracked
  let newClassification = existing.classification;
  if (newIdx > currentIdx) {
    newClassification = newDetection.classification;
  }
  if (
    existing.classification === "classified" &&
    newDetection.sensorType === "radar" &&
    simTime - existing.lastUpdateTime < 10000
  ) {
    newClassification = "tracked";
  }

  // Apply position uncertainty
  const jitterLat = (Math.random() - 0.5) * newDetection.uncertainty * 0.009;
  const jitterLng = (Math.random() - 0.5) * newDetection.uncertainty * 0.009;

  return {
    ...existing,
    classification: newClassification,
    position: {
      lat: actualPosition.lat + jitterLat,
      lng: actualPosition.lng + jitterLng,
    },
    positionUncertainty: Math.min(existing.positionUncertainty, newDetection.uncertainty),
    lastUpdateTime: simTime,
    sensorType: newDetection.sensorType,
  };
}
