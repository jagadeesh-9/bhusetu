/**
 * Phase 3.6B: Interactive 3D Measurement & Spatial Interrogation Utilities.
 * Pure computational geometry and measurement state functions operating in EPSG:32644.
 */
import type {
  MeasuredPoint,
  MeasurementResult,
  MeasurementState,
  MeasurementMode,
  CoordinateHUDState,
} from "../types/cadastre";
import {
  viewerHeightToPrototypeZ,
  CANONICAL_VISUAL_GROUND_Z,
  transformWGS84To32644,
} from "./coordinateTransform";
import * as Cesium from "cesium";

export const DEFAULT_MEASUREMENT_STATE: MeasurementState = {
  mode: "OFF",
  pointA: null,
  pointB: null,
  result: null,
  statusMessage: null,
};

export const DEFAULT_COORD_HUD_STATE: CoordinateHUDState = {
  enabled: true,
  currentCoords: null,
};

export interface CameraSpatialContext {
  easting: number;
  northing: number;
  elevation: number;
  longitude: number;
  latitude: number;
  heading: number;
  pitch: number;
  roll: number;
}

/**
 * Computes authoritative 3D spatial context directly from the active Cesium Camera view.
 * Derives EPSG:32644 Easting/Northing and WGS84 coordinates from camera state rather than cursor position.
 */
export function computeCameraSpatialContext(
  camera: {
    positionCartographic?: { longitude: number; latitude: number; height: number } | null;
    heading?: number;
    pitch?: number;
    roll?: number;
  },
  groundElevation: number = CANONICAL_VISUAL_GROUND_Z
): CameraSpatialContext | null {
  const carto = camera?.positionCartographic;
  if (!carto) return null;

  const lon = Cesium.Math.toDegrees(carto.longitude);
  const lat = Cesium.Math.toDegrees(carto.latitude);
  const rawViewerHeight = carto.height;
  const prototypeElevation = viewerHeightToPrototypeZ(rawViewerHeight, groundElevation);
  const [easting, northing] = transformWGS84To32644(lon, lat, prototypeElevation);

  const headingDeg = Cesium.Math.toDegrees(camera.heading ?? 0);
  const pitchDeg = Cesium.Math.toDegrees(camera.pitch ?? 0);
  const rollDeg = Cesium.Math.toDegrees(camera.roll ?? 0);

  return {
    easting: Number(easting.toFixed(2)),
    northing: Number(northing.toFixed(2)),
    elevation: Number(prototypeElevation.toFixed(2)),
    longitude: Number(lon.toFixed(6)),
    latitude: Number(lat.toFixed(6)),
    heading: Number((((headingDeg % 360) + 360) % 360).toFixed(1)),
    pitch: Number(pitchDeg.toFixed(1)),
    roll: Number(rollDeg.toFixed(1)),
  };
}

/**
 * Deadband threshold filter to prevent excessive React state churn while guaranteeing
 * smooth HUD coordinate updates on camera rotation, pitch, elevation, zoom, pan, and fly-to.
 */
export function shouldUpdateCameraSpatialHUD(
  prev: CameraSpatialContext | null,
  curr: CameraSpatialContext,
  thresholds = {
    posDeg: 0.000001,
    heightM: 0.05,
    angleDeg: 0.2,
  }
): boolean {
  if (!prev) return true;
  return (
    Math.abs(curr.longitude - prev.longitude) >= thresholds.posDeg ||
    Math.abs(curr.latitude - prev.latitude) >= thresholds.posDeg ||
    Math.abs(curr.elevation - prev.elevation) >= thresholds.heightM ||
    Math.abs(curr.heading - prev.heading) >= thresholds.angleDeg ||
    Math.abs(curr.pitch - prev.pitch) >= thresholds.angleDeg ||
    Math.abs(curr.roll - prev.roll) >= thresholds.angleDeg
  );
}

/**
 * Calculates 3D Euclidean distance in meters between two points in EPSG:32644.
 * Formula: D_3D = sqrt((X2 - X1)^2 + (Y2 - Y1)^2 + (Z2 - Z1)^2)
 */
export function calculate3DDistance(p1: MeasuredPoint, p2: MeasuredPoint): number {
  const dx = p2.easting - p1.easting;
  const dy = p2.northing - p1.northing;
  const dz = p2.elevation - p1.elevation;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return Number(dist.toFixed(2));
}

/**
 * Calculates Horizontal 2D distance in meters in EPSG:32644.
 * Formula: D_2D = sqrt((X2 - X1)^2 + (Y2 - Y1)^2)
 */
export function calculateHorizontalDistance(p1: MeasuredPoint, p2: MeasuredPoint): number {
  const dx = p2.easting - p1.easting;
  const dy = p2.northing - p1.northing;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Number(dist.toFixed(2));
}

/**
 * Calculates Vertical Differential (Delta Z) in meters.
 * Formula: Delta_Z = |Z2 - Z1|
 */
export function calculateDeltaZ(p1: MeasuredPoint, p2: MeasuredPoint): number {
  const dz = Math.abs(p2.elevation - p1.elevation);
  return Number(dz.toFixed(2));
}

/**
 * Computes all 3 measurement metrics for a pair of measured 3D points.
 */
export function computeMeasurementResult(
  p1: MeasuredPoint,
  p2: MeasuredPoint
): MeasurementResult {
  return {
    distance3D: calculate3DDistance(p1, p2),
    horizontalDistance: calculateHorizontalDistance(p1, p2),
    deltaZ: calculateDeltaZ(p1, p2),
  };
}

/**
 * Transitions the measurement subsystem to a new mode.
 */
export function setMeasurementMode(
  current: MeasurementState,
  mode: MeasurementMode
): MeasurementState {
  if (mode === "OFF") {
    return {
      ...DEFAULT_MEASUREMENT_STATE,
    };
  }

  // If we already have 2 points measured, recompute results for the new mode
  let result = current.result;
  if (current.pointA && current.pointB) {
    result = computeMeasurementResult(current.pointA, current.pointB);
  }

  return {
    ...current,
    mode,
    result,
    statusMessage: current.pointA
      ? current.pointB
        ? "Measurement active."
        : "Point A recorded. Click second point for measurement."
      : "Mode active. Click first 3D scene point.",
  };
}

/**
 * Registers a clicked 3D point in the measurement state.
 */
export function addMeasurementPoint(
  current: MeasurementState,
  point: MeasuredPoint
): MeasurementState {
  if (current.mode === "OFF") {
    return current;
  }

  if (!current.pointA || (current.pointA && current.pointB)) {
    // Start new measurement pair with Point A
    return {
      ...current,
      pointA: point,
      pointB: null,
      result: null,
      statusMessage: "Point A recorded. Click second point for measurement.",
    };
  }

  // Record Point B and compute results
  const result = computeMeasurementResult(current.pointA, point);
  return {
    ...current,
    pointB: point,
    result,
    statusMessage: "Measurement complete.",
  };
}

/**
 * Clears current measured points and results while preserving active measurement mode.
 */
export function clearMeasurement(current: MeasurementState): MeasurementState {
  return {
    ...current,
    pointA: null,
    pointB: null,
    result: null,
    statusMessage: current.mode !== "OFF" ? "Points cleared. Click first 3D scene point." : null,
  };
}

/**
 * Completely resets measurement state to default.
 */
export function resetMeasurementState(): MeasurementState {
  return { ...DEFAULT_MEASUREMENT_STATE };
}
