import { describe, it, expect } from "vitest";
import {
  DEFAULT_MEASUREMENT_STATE,
  calculate3DDistance,
  calculateHorizontalDistance,
  calculateDeltaZ,
  computeMeasurementResult,
  setMeasurementMode,
  addMeasurementPoint,
  clearMeasurement,
  resetMeasurementState,
} from "../utils/measurementUtils";
import {
  transform32644ToWGS84,
  transformWGS84To32644,
} from "../utils/coordinateTransform";
import type { MeasuredPoint, MeasurementState } from "../types/cadastre";

describe("Phase 3.6B: 3D Measurement & Spatial Interrogation Engine", () => {
  const p1: MeasuredPoint = {
    easting: 219415.0,
    northing: 1932510.0,
    elevation: 540.0,
    longitude: 78.486,
    latitude: 17.452,
  };

  const p2: MeasuredPoint = {
    easting: 219425.0,
    northing: 1932520.0,
    elevation: 545.0,
    longitude: 78.487,
    latitude: 17.453,
  };

  it("Requirement 1: 3D Euclidean distance calculation", () => {
    // dx = 10, dy = 10, dz = 5 -> dist = sqrt(100 + 100 + 25) = sqrt(225) = 15.00
    const d3d = calculate3DDistance(p1, p2);
    expect(d3d).toBe(15.0);
  });

  it("Requirement 2: Horizontal 2D distance calculation", () => {
    // dx = 10, dy = 10 -> dist = sqrt(200) ≈ 14.14
    const d2d = calculateHorizontalDistance(p1, p2);
    expect(d2d).toBe(14.14);
  });

  it("Requirement 3: Vertical differential Delta Z calculation", () => {
    // dz = |545 - 540| = 5.00
    const dz = calculateDeltaZ(p1, p2);
    expect(dz).toBe(5.0);
  });

  it("Requirement 4 & 5: Zero distance with identical points", () => {
    expect(calculate3DDistance(p1, p1)).toBe(0.0);
    expect(calculateHorizontalDistance(p1, p1)).toBe(0.0);
    expect(calculateDeltaZ(p1, p1)).toBe(0.0);
  });

  it("Requirement 6: Pure vertical displacement", () => {
    const pVertical: MeasuredPoint = {
      ...p1,
      elevation: 548.5,
    };
    expect(calculate3DDistance(p1, pVertical)).toBe(8.5);
    expect(calculateHorizontalDistance(p1, pVertical)).toBe(0.0);
    expect(calculateDeltaZ(p1, pVertical)).toBe(8.5);
  });

  it("Requirement 7: Pure horizontal displacement", () => {
    const pHorizontal: MeasuredPoint = {
      ...p1,
      easting: 219415.0 + 12.0,
      northing: 1932510.0 + 16.0,
    };
    // dx = 12, dy = 16 -> sqrt(144 + 256) = sqrt(400) = 20.00
    expect(calculate3DDistance(p1, pHorizontal)).toBe(20.0);
    expect(calculateHorizontalDistance(p1, pHorizontal)).toBe(20.0);
    expect(calculateDeltaZ(p1, pHorizontal)).toBe(0.0);
  });

  it("Requirement 8 & 9: Subterranean negative elevation coordinates", () => {
    const pBasement1: MeasuredPoint = {
      easting: 219400.0,
      northing: 1932500.0,
      elevation: -6.0,
      longitude: 78.485,
      latitude: 17.451,
    };
    const pBasement2: MeasuredPoint = {
      easting: 219403.0,
      northing: 1932504.0,
      elevation: -2.0,
      longitude: 78.486,
      latitude: 17.452,
    };
    // dx = 3, dy = 4, dz = |-2 - (-6)| = 4 -> sqrt(9 + 16 + 16) = sqrt(41) ≈ 6.40
    expect(calculate3DDistance(pBasement1, pBasement2)).toBe(6.4);
    expect(calculateHorizontalDistance(pBasement1, pBasement2)).toBe(5.0);
    expect(calculateDeltaZ(pBasement1, pBasement2)).toBe(4.0);
  });

  it("Requirement 10: Precision and result bundle formatting", () => {
    const result = computeMeasurementResult(p1, p2);
    expect(result.distance3D).toBe(15.0);
    expect(result.horizontalDistance).toBe(14.14);
    expect(result.deltaZ).toBe(5.0);
  });

  it("Requirement 11 & 12: Coordinate transformation bidirectional roundtrip", () => {
    const origE = 219415.0;
    const origN = 1932510.0;
    const origZ = 540.0;

    const [lon, lat, h] = transform32644ToWGS84(origE, origN, origZ);
    expect(lon).toBeGreaterThan(70);
    expect(lat).toBeGreaterThan(15);
    expect(h).toBe(540.0);

    const [roundE, roundN, roundZ] = transformWGS84To32644(lon, lat, h);
    expect(Math.abs(roundE - origE)).toBeLessThan(0.001);
    expect(Math.abs(roundN - origN)).toBeLessThan(0.001);
    expect(roundZ).toBe(origZ);
  });

  it("Requirement 13: State transition OFF -> DISTANCE_3D and back to OFF", () => {
    let state = setMeasurementMode(DEFAULT_MEASUREMENT_STATE, "DISTANCE_3D");
    expect(state.mode).toBe("DISTANCE_3D");
    expect(state.pointA).toBeNull();
    expect(state.pointB).toBeNull();
    expect(state.result).toBeNull();

    state = setMeasurementMode(state, "OFF");
    expect(state.mode).toBe("OFF");
    expect(state.pointA).toBeNull();
    expect(state.pointB).toBeNull();
  });

  it("Requirement 14: Adding Point A and Point B calculates results", () => {
    let state = setMeasurementMode(DEFAULT_MEASUREMENT_STATE, "DISTANCE_3D");

    // Add Point A
    state = addMeasurementPoint(state, p1);
    expect(state.pointA).toEqual(p1);
    expect(state.pointB).toBeNull();
    expect(state.result).toBeNull();
    expect(state.statusMessage).toContain("Point A recorded");

    // Add Point B
    state = addMeasurementPoint(state, p2);
    expect(state.pointA).toEqual(p1);
    expect(state.pointB).toEqual(p2);
    expect(state.result).not.toBeNull();
    expect(state.result?.distance3D).toBe(15.0);
    expect(state.statusMessage).toContain("Measurement complete");

    // Adding a 3rd point restarts the measurement with Point A
    const p3: MeasuredPoint = { ...p1, easting: 219450.0 };
    state = addMeasurementPoint(state, p3);
    expect(state.pointA).toEqual(p3);
    expect(state.pointB).toBeNull();
    expect(state.result).toBeNull();
  });

  it("Requirement 15: Mode transitions preserve existing points and recomputes metrics", () => {
    let state: MeasurementState = {
      mode: "DISTANCE_3D",
      pointA: p1,
      pointB: p2,
      result: computeMeasurementResult(p1, p2),
      statusMessage: "Measurement complete.",
    };

    state = setMeasurementMode(state, "DISTANCE_HORIZONTAL");
    expect(state.mode).toBe("DISTANCE_HORIZONTAL");
    expect(state.result?.horizontalDistance).toBe(14.14);

    state = setMeasurementMode(state, "DELTA_Z");
    expect(state.mode).toBe("DELTA_Z");
    expect(state.result?.deltaZ).toBe(5.0);
  });

  it("Requirement 16: Clear measurement resets points while retaining active mode", () => {
    let state: MeasurementState = {
      mode: "DISTANCE_3D",
      pointA: p1,
      pointB: p2,
      result: computeMeasurementResult(p1, p2),
      statusMessage: "Measurement complete.",
    };

    state = clearMeasurement(state);
    expect(state.mode).toBe("DISTANCE_3D");
    expect(state.pointA).toBeNull();
    expect(state.pointB).toBeNull();
    expect(state.result).toBeNull();
    expect(state.statusMessage).toContain("Points cleared");
  });

  it("Requirement 17: Reset measurement restores initial default state", () => {
    const reset = resetMeasurementState();
    expect(reset.mode).toBe("OFF");
    expect(reset.pointA).toBeNull();
    expect(reset.pointB).toBeNull();
    expect(reset.result).toBeNull();
  });
});
