import { describe, it, expect } from "vitest";
import {
  DEFAULT_CUTAWAY_STATE,
  calculateUnitCentroid,
  isUnitClippedByCutaway,
  resetCutawayState,
  toggleCutawayPlane,
  updateCutawayPosition,
} from "../utils/cutawayUtils";
import type { VerticalUnit, CutawayState } from "../types/cadastre";

const mockUnits: VerticalUnit[] = [
  {
    id: "unit-sb01",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-SB01",
    floor_code: "B01",
    tier_code: "SB",
    unit_sequence: 1,
    unit_label: "SB01 Basement Parking",
    unit_type: "BASEMENT_PARKING",
    z_min: -6.0,
    z_max: -3.0,
    status: "VERIFIED",
    geom_3d: {
      srid: 32644,
      geometry_type: "PolyhedralSurface",
      geojson: {
        type: "PolyhedralSurface",
        coordinates: [
          [
            [
              [219400.0, 1932500.0, -6.0],
              [219430.0, 1932500.0, -6.0],
              [219430.0, 1932520.0, -6.0],
              [219400.0, 1932520.0, -6.0],
              [219400.0, 1932500.0, -6.0],
            ],
          ],
        ],
      },
    },
  },
  {
    id: "unit-f00",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-F00",
    floor_code: "F00",
    tier_code: "F",
    unit_sequence: 2,
    unit_label: "F00 Retail Unit",
    unit_type: "RETAIL",
    z_min: 0.0,
    z_max: 3.5,
    status: "VERIFIED",
    geom_3d: {
      srid: 32644,
      geometry_type: "PolyhedralSurface",
      geojson: {
        type: "PolyhedralSurface",
        coordinates: [
          [
            [
              [219400.0, 1932500.0, 0.0],
              [219430.0, 1932500.0, 0.0],
              [219430.0, 1932520.0, 0.0],
              [219400.0, 1932520.0, 0.0],
              [219400.0, 1932500.0, 0.0],
            ],
          ],
        ],
      },
    },
  },
  {
    id: "unit-f01-east",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-F01-102",
    floor_code: "F01",
    tier_code: "F",
    unit_sequence: 3,
    unit_label: "F01-102 Apartment",
    unit_type: "APARTMENT",
    z_min: 3.5,
    z_max: 7.0,
    status: "UNDER_REVIEW",
    geom_3d: {
      srid: 32644,
      geometry_type: "PolyhedralSurface",
      geojson: {
        type: "PolyhedralSurface",
        coordinates: [
          [
            [
              [219420.0, 1932500.0, 3.5],
              [219435.0, 1932500.0, 3.5],
              [219435.0, 1932520.0, 3.5],
              [219420.0, 1932520.0, 3.5],
              [219420.0, 1932500.0, 3.5],
            ],
          ],
        ],
      },
    },
  },
  {
    id: "unit-f01-west",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-F01-101",
    floor_code: "F01",
    tier_code: "F",
    unit_sequence: 4,
    unit_label: "F01-101 Apartment",
    unit_type: "APARTMENT",
    z_min: 3.5,
    z_max: 7.0,
    status: "VERIFIED",
    geom_3d: {
      srid: 32644,
      geometry_type: "PolyhedralSurface",
      geojson: {
        type: "PolyhedralSurface",
        coordinates: [
          [
            [
              [219395.0, 1932500.0, 3.5],
              [219410.0, 1932500.0, 3.5],
              [219410.0, 1932520.0, 3.5],
              [219395.0, 1932520.0, 3.5],
              [219395.0, 1932500.0, 3.5],
            ],
          ],
        ],
      },
    },
  },
  {
    id: "unit-f02",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-F02-201",
    floor_code: "F02",
    tier_code: "F",
    unit_sequence: 5,
    unit_label: "F02-201 Apartment",
    unit_type: "APARTMENT",
    z_min: 7.0,
    z_max: 10.5,
    status: "PROPOSED",
    geom_3d: {
      srid: 32644,
      geometry_type: "PolyhedralSurface",
      geojson: {
        type: "PolyhedralSurface",
        coordinates: [
          [
            [
              [219400.0, 1932500.0, 7.0],
              [219430.0, 1932500.0, 7.0],
              [219430.0, 1932520.0, 7.0],
              [219400.0, 1932520.0, 7.0],
              [219400.0, 1932500.0, 7.0],
            ],
          ],
        ],
      },
    },
  },
  {
    id: "unit-ar01",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-AR01",
    floor_code: "RF",
    tier_code: "AR",
    unit_sequence: 6,
    unit_label: "AR01 Rooftop Terrace",
    unit_type: "ROOFTOP_TERRACE",
    z_min: 10.5,
    z_max: 13.5,
    status: "VERIFIED",
    geom_3d: {
      srid: 32644,
      geometry_type: "PolyhedralSurface",
      geojson: {
        type: "PolyhedralSurface",
        coordinates: [
          [
            [
              [219400.0, 1932500.0, 10.5],
              [219430.0, 1932500.0, 10.5],
              [219430.0, 1932520.0, 10.5],
              [219400.0, 1932520.0, 10.5],
              [219400.0, 1932500.0, 10.5],
            ],
          ],
        ],
      },
    },
  },
];

describe("Phase 3.6A: 3D Sectional Cutaway & Orthogonal Clipping Engine", () => {
  it("Requirement 1: Cutaway default state is OFF", () => {
    expect(DEFAULT_CUTAWAY_STATE.enabled).toBe(false);
    expect(DEFAULT_CUTAWAY_STATE.xPlaneEnabled).toBe(false);
    expect(DEFAULT_CUTAWAY_STATE.yPlaneEnabled).toBe(false);
    expect(DEFAULT_CUTAWAY_STATE.zPlaneEnabled).toBe(false);
    expect(DEFAULT_CUTAWAY_STATE.xPosition).toBe(0);
    expect(DEFAULT_CUTAWAY_STATE.yPosition).toBe(0);
    expect(DEFAULT_CUTAWAY_STATE.zPosition).toBe(12);
  });

  it("Requirement 2: X plane can be enabled and updated independently", () => {
    let state = toggleCutawayPlane(DEFAULT_CUTAWAY_STATE, "x");
    expect(state.xPlaneEnabled).toBe(true);
    expect(state.yPlaneEnabled).toBe(false);
    expect(state.zPlaneEnabled).toBe(false);

    state = updateCutawayPosition(state, "x", 5.0);
    expect(state.xPosition).toBe(5.0);
  });

  it("Requirement 3: Y plane can be enabled and updated independently", () => {
    let state = toggleCutawayPlane(DEFAULT_CUTAWAY_STATE, "y");
    expect(state.yPlaneEnabled).toBe(true);
    expect(state.xPlaneEnabled).toBe(false);
    expect(state.zPlaneEnabled).toBe(false);

    state = updateCutawayPosition(state, "y", -10.0);
    expect(state.yPosition).toBe(-10.0);
  });

  it("Requirement 4: Z plane can be enabled and updated independently", () => {
    let state = toggleCutawayPlane(DEFAULT_CUTAWAY_STATE, "z");
    expect(state.zPlaneEnabled).toBe(true);
    expect(state.xPlaneEnabled).toBe(false);
    expect(state.yPlaneEnabled).toBe(false);

    state = updateCutawayPosition(state, "z", 6.5);
    expect(state.zPosition).toBe(6.5);
  });

  it("Requirement 5: Planes can be independently disabled", () => {
    let state: CutawayState = {
      enabled: true,
      xPlaneEnabled: true,
      xPosition: 0,
      yPlaneEnabled: true,
      yPosition: 0,
      zPlaneEnabled: true,
      zPosition: 5,
    };

    state = toggleCutawayPlane(state, "x");
    expect(state.xPlaneEnabled).toBe(false);
    expect(state.yPlaneEnabled).toBe(true);
    expect(state.zPlaneEnabled).toBe(true);

    state = toggleCutawayPlane(state, "z");
    expect(state.xPlaneEnabled).toBe(false);
    expect(state.yPlaneEnabled).toBe(true);
    expect(state.zPlaneEnabled).toBe(false);
  });

  it("Requirement 6: Reset restores default state", () => {
    const mutated: CutawayState = {
      enabled: true,
      xPlaneEnabled: true,
      xPosition: 15,
      yPlaneEnabled: true,
      yPosition: -20,
      zPlaneEnabled: true,
      zPosition: 3.5,
    };
    expect(mutated.enabled).toBe(true);
    const reset = resetCutawayState();
    expect(reset.enabled).toBe(false);
    expect(reset.xPlaneEnabled).toBe(false);
    expect(reset.yPlaneEnabled).toBe(false);
    expect(reset.zPlaneEnabled).toBe(false);
    expect(reset.xPosition).toBe(0);
    expect(reset.yPosition).toBe(0);
    expect(reset.zPosition).toBe(12);
  });

  it("Requirement 7: Plane state does not clip anything when Cutaway is disabled", () => {
    const disabledState: CutawayState = {
      enabled: false,
      xPlaneEnabled: true,
      xPosition: 0,
      yPlaneEnabled: true,
      yPosition: 0,
      zPlaneEnabled: true,
      zPosition: 0,
    };

    for (const unit of mockUnits) {
      expect(isUnitClippedByCutaway(unit, disabledState)).toBe(false);
    }
  });

  it("Requirement 8: Z-Axis Horizontal Floor Stratification Clipping", () => {
    const cutawayZ: CutawayState = {
      enabled: true,
      xPlaneEnabled: false,
      xPosition: 0,
      yPlaneEnabled: false,
      yPosition: 0,
      zPlaneEnabled: true,
      zPosition: 5.0, // cut above 5.0m elevation
    };

    const sbUnit = mockUnits.find((u) => u.id === "unit-sb01")!;
    const f00Unit = mockUnits.find((u) => u.id === "unit-f00")!;
    const f02Unit = mockUnits.find((u) => u.id === "unit-f02")!;
    const ar01Unit = mockUnits.find((u) => u.id === "unit-ar01")!;

    // Units below or spanning across 5.0m elevation should NOT be clipped
    expect(isUnitClippedByCutaway(sbUnit, cutawayZ)).toBe(false);
    expect(isUnitClippedByCutaway(f00Unit, cutawayZ)).toBe(false);

    // Units strictly above 5.0m (F02 z_min=7.0, AR01 z_min=10.5) MUST be clipped
    expect(isUnitClippedByCutaway(f02Unit, cutawayZ)).toBe(true);
    expect(isUnitClippedByCutaway(ar01Unit, cutawayZ)).toBe(true);
  });

  it("Requirement 9: X-Axis East-West Sectional Cutaway Clipping", () => {
    const centerAnchor = { x: 219415.0, y: 1932510.0 };
    const cutawayX: CutawayState = {
      enabled: true,
      xPlaneEnabled: true,
      xPosition: 0, // Cut at anchor X = 219415.0
      yPlaneEnabled: false,
      yPosition: 0,
      zPlaneEnabled: false,
      zPosition: 12,
    };

    const westUnit = mockUnits.find((u) => u.id === "unit-f01-west")!; // centroid X ~ 219402.5
    const eastUnit = mockUnits.find((u) => u.id === "unit-f01-east")!; // centroid X ~ 219427.5

    expect(calculateUnitCentroid(westUnit).x).toBeLessThan(centerAnchor.x);
    expect(calculateUnitCentroid(eastUnit).x).toBeGreaterThan(centerAnchor.x);

    // West unit remains visible (not clipped)
    expect(isUnitClippedByCutaway(westUnit, cutawayX, centerAnchor)).toBe(false);
    // East unit lies on clipped side (clipped)
    expect(isUnitClippedByCutaway(eastUnit, cutawayX, centerAnchor)).toBe(true);
  });

  it("Requirement 10: Underground Subterranean Unit Inspection Compatibility", () => {
    const undergroundCutaway: CutawayState = {
      enabled: true,
      xPlaneEnabled: false,
      xPosition: 0,
      yPlaneEnabled: false,
      yPosition: 0,
      zPlaneEnabled: true,
      zPosition: 0.0, // Cuts all superstructure above ground level (z >= 0)
    };

    const sbUnit = mockUnits.find((u) => u.id === "unit-sb01")!; // z_min = -6.0, z_max = -3.0
    const f00Unit = mockUnits.find((u) => u.id === "unit-f00")!; // z_min = 0.0

    // Subterranean unit remains visible for inspection
    expect(isUnitClippedByCutaway(sbUnit, undergroundCutaway)).toBe(false);
    // Ground floor unit (z_min >= 0.0) is clipped, exposing basement
    expect(isUnitClippedByCutaway(f00Unit, undergroundCutaway)).toBe(true);
  });
});
