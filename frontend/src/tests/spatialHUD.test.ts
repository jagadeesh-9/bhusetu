import { describe, it, expect } from "vitest";
import * as Cesium from "cesium";
import {
  computeCameraSpatialContext,
  shouldUpdateCameraSpatialHUD,
  type CameraSpatialContext,
} from "../utils/measurementUtils";
import { CANONICAL_VISUAL_GROUND_Z } from "../utils/coordinateTransform";

describe("Spatial Interrogation HUD: Camera-Driven Coordinate Updates", () => {
  const mockCameraAtSurya = {
    positionCartographic: {
      longitude: Cesium.Math.toRadians(78.3615),
      latitude: Cesium.Math.toRadians(17.4625),
      height: 620.0,
    },
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-26),
    roll: Cesium.Math.toRadians(0),
  };

  it("computes authoritative EPSG:32644 and WGS84 coordinates from camera state", () => {
    const context = computeCameraSpatialContext(mockCameraAtSurya, CANONICAL_VISUAL_GROUND_Z);
    expect(context).not.toBeNull();
    expect(context?.longitude).toBeCloseTo(78.3615, 4);
    expect(context?.latitude).toBeCloseTo(17.4625, 4);
    expect(context?.elevation).toBeCloseTo(620.0 + CANONICAL_VISUAL_GROUND_Z, 1);
    expect(context?.heading).toBe(0);
    expect(context?.pitch).toBe(-26);
    expect(context?.easting).toBeGreaterThan(200000);
    expect(context?.northing).toBeGreaterThan(1900000);
  });

  it("RULE 1: Mouse movement alone does NOT update HUD coordinate state", () => {
    // When the mouse moves across the screen, camera state is completely unchanged
    const initialContext = computeCameraSpatialContext(mockCameraAtSurya, CANONICAL_VISUAL_GROUND_Z)!;

    // Simulate mouse moving to different cursor positions: (100, 100) -> (500, 300)
    // The camera context is unchanged:
    const cursorMoveContext = computeCameraSpatialContext(mockCameraAtSurya, CANONICAL_VISUAL_GROUND_Z)!;

    const shouldUpdate = shouldUpdateCameraSpatialHUD(initialContext, cursorMoveContext);
    expect(shouldUpdate).toBe(false);
  });

  it("RULE 2: Camera heading change DOES update HUD", () => {
    const initialContext = computeCameraSpatialContext(mockCameraAtSurya, CANONICAL_VISUAL_GROUND_Z)!;

    // Camera heading rotates by 15 degrees during orbit
    const rotatedCamera = {
      ...mockCameraAtSurya,
      heading: Cesium.Math.toRadians(15),
    };
    const updatedContext = computeCameraSpatialContext(rotatedCamera, CANONICAL_VISUAL_GROUND_Z)!;

    expect(updatedContext.heading).toBe(15);
    const shouldUpdate = shouldUpdateCameraSpatialHUD(initialContext, updatedContext);
    expect(shouldUpdate).toBe(true);
  });

  it("RULE 3: Camera pitch change DOES update HUD", () => {
    const initialContext = computeCameraSpatialContext(mockCameraAtSurya, CANONICAL_VISUAL_GROUND_Z)!;

    // Camera tilts up or down
    const tiltedCamera = {
      ...mockCameraAtSurya,
      pitch: Cesium.Math.toRadians(-45),
    };
    const updatedContext = computeCameraSpatialContext(tiltedCamera, CANONICAL_VISUAL_GROUND_Z)!;

    expect(updatedContext.pitch).toBe(-45);
    const shouldUpdate = shouldUpdateCameraSpatialHUD(initialContext, updatedContext);
    expect(shouldUpdate).toBe(true);
  });

  it("RULE 4: Camera elevation/height change (zoom) DOES update HUD", () => {
    const initialContext = computeCameraSpatialContext(mockCameraAtSurya, CANONICAL_VISUAL_GROUND_Z)!;

    // Camera zooms out from 620m to 700m
    const zoomedCamera = {
      ...mockCameraAtSurya,
      positionCartographic: {
        ...mockCameraAtSurya.positionCartographic,
        height: 700.0,
      },
    };
    const updatedContext = computeCameraSpatialContext(zoomedCamera, CANONICAL_VISUAL_GROUND_Z)!;

    expect(updatedContext.elevation).toBeCloseTo(700.0 + CANONICAL_VISUAL_GROUND_Z, 1);
    const shouldUpdate = shouldUpdateCameraSpatialHUD(initialContext, updatedContext);
    expect(shouldUpdate).toBe(true);
  });

  it("RULE 5: Camera pan / fly-to another building location DOES update HUD", () => {
    const initialContext = computeCameraSpatialContext(mockCameraAtSurya, CANONICAL_VISUAL_GROUND_Z)!;

    // Camera flies to Gachibowli reference building (e.g. +0.005 lon, +0.005 lat)
    const flownCamera = {
      ...mockCameraAtSurya,
      positionCartographic: {
        longitude: Cesium.Math.toRadians(78.3665),
        latitude: Cesium.Math.toRadians(17.4675),
        height: 650.0,
      },
    };
    const updatedContext = computeCameraSpatialContext(flownCamera, CANONICAL_VISUAL_GROUND_Z)!;

    expect(updatedContext.longitude).toBeCloseTo(78.3665, 4);
    expect(updatedContext.latitude).toBeCloseTo(17.4675, 4);
    const shouldUpdate = shouldUpdateCameraSpatialHUD(initialContext, updatedContext);
    expect(shouldUpdate).toBe(true);
  });

  it("Deadband filtering prevents spurious re-renders on sub-threshold noise", () => {
    const initialContext = computeCameraSpatialContext(mockCameraAtSurya, CANONICAL_VISUAL_GROUND_Z)!;

    // Sub-millimeter floating point jitter
    const noisyContext: CameraSpatialContext = {
      ...initialContext,
      heading: initialContext.heading + 0.05, // < 0.2 deg threshold
      elevation: initialContext.elevation + 0.01, // < 0.05m threshold
    };

    expect(shouldUpdateCameraSpatialHUD(initialContext, noisyContext)).toBe(false);
  });
});
