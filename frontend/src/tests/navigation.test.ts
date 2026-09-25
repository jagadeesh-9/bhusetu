import { describe, it, expect } from "vitest";
import type { VerticalUnit, Building, Parcel, BuildingCandidate, LocationSearchResult } from "../types/cadastre";
import { getUnitArchitecturalColor } from "../utils/architecturalDetails";
import { deriveBuildingOverview } from "../utils/coordinateTransform";

// Mock Data
const mockBuilding: Building = {
  id: "bldg-surya",
  parcel_id: "parcel-surya",
  building_code: "APARTMENT-SURYA-001",
  building_name: "Surya Heights",
  total_floors_above: 5,
  total_floors_below: 1,
  footprint_2d: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
  unit_count: 8,
  created_at: new Date().toISOString(),
};

const mockParcel: Parcel = {
  id: "parcel-surya",
  ulpin_2d: "36A1B2C3D4E5F9",
  survey_number: "SY-101",
  district: "Ranga Reddy",
  state: "Telangana",
  area_sqm: 1450.0,
  geom_2d: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
  building_count: 1,
  vertical_unit_count: 8,
  created_at: new Date().toISOString(),
};

const mockFloorF01: VerticalUnit = {
  id: "unit-f01-parent",
  parcel_id: "parcel-surya",
  building_id: "bldg-surya",
  prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-F-6131-F01",
  floor_code: "F01",
  tier_code: "F",
  unit_sequence: 1,
  unit_label: "Floor F01 (First Floor)",
  unit_type: "STOREY",
  unit_level: "STOREY",
  z_min: 543.5,
  z_max: 546.5,
  status: "PROPOSED",
  geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
};

const mockFloorF02: VerticalUnit = {
  id: "unit-f02-parent",
  parcel_id: "parcel-surya",
  building_id: "bldg-surya",
  prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-F-6132-F02",
  floor_code: "F02",
  tier_code: "F",
  unit_sequence: 2,
  unit_label: "Floor F02 (Second Floor)",
  unit_type: "STOREY",
  unit_level: "STOREY",
  z_min: 546.5,
  z_max: 549.5,
  status: "PROPOSED",
  geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
};

const mockFlat101: VerticalUnit = {
  id: "unit-f01-flat101",
  parcel_id: "parcel-surya",
  building_id: "bldg-surya",
  parent_unit_id: "unit-f01-parent",
  prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-F-6132-U101",
  floor_code: "F01",
  tier_code: "F",
  unit_sequence: 101,
  unit_label: "Flat 101 (2BHK)",
  unit_type: "APARTMENT",
  unit_level: "FLAT",
  flat_number: "101",
  z_min: 543.5,
  z_max: 546.5,
  status: "PROPOSED",
  geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
};

describe("Phase 3.13: Toggle Floor & Flat Selection State Machine", () => {

  // State machine simulator with single-source-of-truth toggle selection logic
  class SelectionManager {
    selectedUnit: VerticalUnit | null = null;
    activeBuilding: Building | null = mockBuilding;
    selectedParcel: Parcel | null = mockParcel;

    handleSelectUnit(unit: VerticalUnit | null) {
      if (!unit) {
        this.selectedUnit = null;
        return;
      }
      if (this.selectedUnit?.id === unit.id) {
        this.selectedUnit = null;
      } else {
        this.selectedUnit = unit;
      }
    }
  }

  it("TEST 1: Initial state has selectedUnit = null (normal building overview)", () => {
    const manager = new SelectionManager();
    expect(manager.selectedUnit).toBeNull();
    expect(manager.activeBuilding).not.toBeNull();
    expect(manager.selectedParcel).not.toBeNull();

    // Verify all floors have normal building colors (not glowing yellow)
    const colorF01 = getUnitArchitecturalColor(mockFloorF01, manager.selectedUnit);
    const colorF02 = getUnitArchitecturalColor(mockFloorF02, manager.selectedUnit);
    expect(colorF01.alpha).toBeCloseTo(0.90, 2);
    expect(colorF02.alpha).toBeCloseTo(0.90, 2);
  });

  it("TEST 2: Click F01 selects F01 and highlights F01 yellow", () => {
    const manager = new SelectionManager();
    manager.handleSelectUnit(mockFloorF01);

    expect(manager.selectedUnit?.id).toBe(mockFloorF01.id);
    expect(manager.selectedUnit?.floor_code).toBe("F01");

    // F01 highlighted yellow (alpha 0.96), F02 dimmed (alpha 0.45)
    const colorF01 = getUnitArchitecturalColor(mockFloorF01, manager.selectedUnit);
    const colorF02 = getUnitArchitecturalColor(mockFloorF02, manager.selectedUnit);
    expect(colorF01.alpha).toBeCloseTo(0.96, 2);
    expect(colorF02.alpha).toBeCloseTo(0.45, 2);
  });

  it("TEST 3: Click F01 AGAIN toggles selection off (selectedUnit = null, Building Overview restored)", () => {
    const manager = new SelectionManager();
    // First click: select
    manager.handleSelectUnit(mockFloorF01);
    expect(manager.selectedUnit?.id).toBe(mockFloorF01.id);

    // Second click on SAME floor: toggle off
    manager.handleSelectUnit(mockFloorF01);
    expect(manager.selectedUnit).toBeNull();

    // Verify building overview appearance restored
    const colorF01 = getUnitArchitecturalColor(mockFloorF01, manager.selectedUnit);
    const colorF02 = getUnitArchitecturalColor(mockFloorF02, manager.selectedUnit);
    expect(colorF01.alpha).toBeCloseTo(0.90, 2);
    expect(colorF02.alpha).toBeCloseTo(0.90, 2);
  });

  it("TEST 4: Click F01 → F02 deselects F01 and selects F02", () => {
    const manager = new SelectionManager();
    // Select F01
    manager.handleSelectUnit(mockFloorF01);
    expect(manager.selectedUnit?.floor_code).toBe("F01");

    // Click F02
    manager.handleSelectUnit(mockFloorF02);
    expect(manager.selectedUnit?.floor_code).toBe("F02");

    const colorF01 = getUnitArchitecturalColor(mockFloorF01, manager.selectedUnit);
    const colorF02 = getUnitArchitecturalColor(mockFloorF02, manager.selectedUnit);
    expect(colorF01.alpha).toBeCloseTo(0.45, 2);
    expect(colorF02.alpha).toBeCloseTo(0.96, 2);
  });

  it("TEST 5: Click F02 AGAIN clears selection (selectedUnit = null)", () => {
    const manager = new SelectionManager();
    manager.handleSelectUnit(mockFloorF01);
    manager.handleSelectUnit(mockFloorF02);
    expect(manager.selectedUnit?.floor_code).toBe("F02");

    // Click F02 again
    manager.handleSelectUnit(mockFloorF02);
    expect(manager.selectedUnit).toBeNull();
  });

  it("TEST 6: Select F01 → Flat 101 preserves flat selection and flat toggle", () => {
    const manager = new SelectionManager();
    // Click F01
    manager.handleSelectUnit(mockFloorF01);
    expect(manager.selectedUnit?.floor_code).toBe("F01");

    // Click Flat 101
    manager.handleSelectUnit(mockFlat101);
    expect(manager.selectedUnit?.flat_number).toBe("101");
    expect(manager.selectedUnit?.id).toBe("unit-f01-flat101");

    // Click Flat 101 again -> toggles off to null
    manager.handleSelectUnit(mockFlat101);
    expect(manager.selectedUnit).toBeNull();
  });

  it("TEST 7: After deselecting a floor, building and parcel remain completely intact", () => {
    const manager = new SelectionManager();
    manager.handleSelectUnit(mockFloorF01);
    expect(manager.selectedUnit?.floor_code).toBe("F01");

    // Deselect
    manager.handleSelectUnit(mockFloorF01);
    expect(manager.selectedUnit).toBeNull();

    // Critical invariant checks
    expect(manager.activeBuilding).not.toBeNull();
    expect(manager.activeBuilding?.building_name).toBe("Surya Heights");
    expect(manager.selectedParcel).not.toBeNull();
    expect(manager.selectedParcel?.ulpin_2d).toBe("36A1B2C3D4E5F9");
  });
});

describe("Phase 3.14: Selected Building Overview Dynamic Binding & Anti-Stale State Machine", () => {
  const nexiiCandidate: BuildingCandidate = {
    id: "cand-nexii",
    osmId: "89914115",
    osmType: "way",
    source: "REAL_REFERENCE",
    name: "Nexiilabs",
    buildingType: "commercial",
    floorCount: 5,
    levels: 5,
    groundElevationM: 575.50,
    elevMinM: 575.50,
    elevMaxM: 590.50,
    approxAreaSqm: 1540,
    distanceMeters: 85.5,
    modelAvailable: true,
    isReferenceBuilding: true,
    centroid: { latitude: 17.4470569, longitude: 78.3754332 },
    footprintCoordinates: [[78.3754, 17.4470], [78.3756, 17.4470], [78.3756, 17.4472], [78.3754, 17.4470]],
    attribution: "© OpenStreetMap contributors | Real Hyderabad Reference Dataset",
  };

  const deloitteCandidate: BuildingCandidate = {
    id: "cand-deloitte",
    osmId: "89918045",
    osmType: "way",
    source: "REAL_REFERENCE",
    name: "Deloitte",
    buildingType: "commercial",
    floorCount: 5,
    levels: 5,
    groundElevationM: 575.50,
    elevMinM: 575.50,
    elevMaxM: 590.50,
    approxAreaSqm: 2100,
    distanceMeters: 97.6,
    modelAvailable: false,
    isReferenceBuilding: true,
    centroid: { latitude: 17.4465, longitude: 78.3768 },
    footprintCoordinates: [[78.3765, 17.4465], [78.3770, 17.4465], [78.3770, 17.4470], [78.3765, 17.4465]],
    attribution: "© OpenStreetMap contributors | Real Hyderabad Reference Dataset",
  };

  const motorolaCandidate: BuildingCandidate = {
    id: "cand-motorola",
    osmId: "89914117",
    osmType: "way",
    source: "REAL_REFERENCE",
    name: "Motorola",
    buildingType: "office",
    floorCount: 5,
    levels: 5,
    groundElevationM: 575.50,
    elevMinM: 575.50,
    elevMaxM: 590.50,
    approxAreaSqm: 1800,
    distanceMeters: 123.3,
    modelAvailable: false,
    isReferenceBuilding: true,
    centroid: { latitude: 17.4480, longitude: 78.3750 },
    footprintCoordinates: [[78.3750, 17.4480], [78.3755, 17.4480], [78.3755, 17.4485], [78.3750, 17.4480]],
    attribution: "© OpenStreetMap contributors | Real Hyderabad Reference Dataset",
  };

  const hitechLocation: LocationSearchResult = {
    id: "loc-hitech",
    displayName: "HITECH City, Madhapur, Hyderabad, Telangana, 500081, India",
    latitude: 17.4474,
    longitude: 78.3762,
    modelAvailable: true,
    attribution: "© OpenStreetMap contributors",
  };

  it("TEST 1: Default state with no candidate selected returns canonical Surya Heights details", () => {
    const overview = deriveBuildingOverview({
      candidate: null,
      building: mockBuilding,
      parcel: mockParcel,
      verticalUnits: [mockFloorF01, mockFloorF02],
    });

    expect(overview.isSurya).toBe(true);
    expect(overview.buildingName).toBe("Surya Heights");
    expect(overview.buildingType).toBe("Residential Apartment");
    expect(overview.locationString).toBe("Kondapur · Hyderabad, Telangana, India");
    expect(overview.groundZ).toBe(540.0);
    expect(overview.roofZ).toBe(561.5);
    expect(overview.totalHeightM).toBe("21.50");
    expect(overview.osmAnchor).toBe("Way 356027047");
    expect(overview.easting).toBeCloseTo(219997.91, 1);
    expect(overview.northing).toBeCloseTo(1933097.50, 1);
  });

  it("TEST 2: Selecting Nexiilabs dynamically sets all Building Overview fields to Nexiilabs", () => {
    const overview = deriveBuildingOverview({
      candidate: nexiiCandidate,
      locationContext: hitechLocation,
    });

    expect(overview.isSurya).toBe(false);
    expect(overview.buildingName).toBe("Nexiilabs");
    expect(overview.buildingType).toBe("Commercial Building");
    expect(overview.locationString).toContain("HITECH City");
    expect(overview.groundZ).toBe(575.50);
    expect(overview.roofZ).toBe(590.50);
    expect(overview.totalHeightM).toBe("15.00");
    expect(overview.floorsAbove).toBe(5);
    expect(overview.osmAnchor).toBe("Way 89914115");
    expect(overview.osmId).toBe("89914115");
    expect(overview.approxArea).toBe("~1540 m²");
    expect(overview.isRealReference).toBe(true);
    // Transformed Easting/Northing in UTM 44N should be near 221335 / 1931051
    expect(overview.easting).toBeGreaterThan(220000);
    expect(overview.northing).toBeGreaterThan(1930000);
  });

  it("TEST 3: Selecting Deloitte dynamically sets Building Overview to Deloitte", () => {
    const overview = deriveBuildingOverview({
      candidate: deloitteCandidate,
      locationContext: hitechLocation,
    });

    expect(overview.isSurya).toBe(false);
    expect(overview.buildingName).toBe("Deloitte");
    expect(overview.buildingType).toBe("Commercial Building");
    expect(overview.osmAnchor).toBe("Way 89918045");
    expect(overview.approxArea).toBe("~2100 m²");
  });

  it("TEST 4: Selecting Motorola dynamically sets Building Overview to Motorola", () => {
    const overview = deriveBuildingOverview({
      candidate: motorolaCandidate,
      locationContext: hitechLocation,
    });

    expect(overview.isSurya).toBe(false);
    expect(overview.buildingName).toBe("Motorola");
    expect(overview.buildingType).toBe("Office Building");
    expect(overview.aboveFloorLabel).toBe("Office Floors");
    expect(overview.osmAnchor).toBe("Way 89914117");
    expect(overview.approxArea).toBe("~1800 m²");
  });

  it("TEST 5: Rapid selection switching sequence never leaks stale Surya Heights data", () => {
    // 1. Start at Surya Heights
    let ov = deriveBuildingOverview({ candidate: null, building: mockBuilding, parcel: mockParcel });
    expect(ov.buildingName).toBe("Surya Heights");

    // 2. Select Nexiilabs
    ov = deriveBuildingOverview({ candidate: nexiiCandidate, locationContext: hitechLocation });
    expect(ov.buildingName).toBe("Nexiilabs");
    expect(ov.isSurya).toBe(false);

    // 3. Select Deloitte
    ov = deriveBuildingOverview({ candidate: deloitteCandidate, locationContext: hitechLocation });
    expect(ov.buildingName).toBe("Deloitte");
    expect(ov.isSurya).toBe(false);

    // 4. Select Motorola
    ov = deriveBuildingOverview({ candidate: motorolaCandidate, locationContext: hitechLocation });
    expect(ov.buildingName).toBe("Motorola");
    expect(ov.isSurya).toBe(false);

    // 5. Select Surya Heights demo
    ov = deriveBuildingOverview({ candidate: null, building: mockBuilding, parcel: mockParcel });
    expect(ov.buildingName).toBe("Surya Heights");
    expect(ov.isSurya).toBe(true);

    // 6. Return to Nexiilabs
    ov = deriveBuildingOverview({ candidate: nexiiCandidate, locationContext: hitechLocation });
    expect(ov.buildingName).toBe("Nexiilabs");
    expect(ov.isSurya).toBe(false);
    expect(ov.osmId).toBe("89914115");
  });

  it("TEST 6: Even if previous parcel was Surya Heights, selecting a candidate overrides stale parcel", () => {
    // Stale state simulation: parcel still points to Surya Heights, but user clicked Nexiilabs candidate
    const ov = deriveBuildingOverview({
      candidate: nexiiCandidate,
      parcel: mockParcel, // Stale parcel
      building: mockBuilding, // Stale building
      locationContext: hitechLocation,
    });

    expect(ov.isSurya).toBe(false);
    expect(ov.buildingName).toBe("Nexiilabs");
    expect(ov.osmId).toBe("89914115");
    expect(ov.groundZ).toBe(575.50);
  });

  it("TEST 7: Generated vertical units update Roof Z and floor counts with 100% precision", () => {
    const generatedUnits: VerticalUnit[] = [
      {
        id: "u-b01",
        parcel_id: "p-nexii",
        prototype_ulpin_3d: "ULPIN-B01",
        floor_code: "B01",
        tier_code: "SB",
        unit_sequence: 1,
        unit_label: "Basement",
        unit_type: "PARKING",
        z_min: 572.0,
        z_max: 575.5,
        status: "VERIFIED",
        geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
      },
      {
        id: "u-f00",
        parcel_id: "p-nexii",
        prototype_ulpin_3d: "ULPIN-F00",
        floor_code: "F00",
        tier_code: "F",
        unit_sequence: 2,
        unit_label: "Ground Floor",
        unit_type: "LOBBY",
        z_min: 575.5,
        z_max: 578.5,
        status: "VERIFIED",
        geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
      },
      {
        id: "u-f01",
        parcel_id: "p-nexii",
        prototype_ulpin_3d: "ULPIN-F01",
        floor_code: "F01",
        tier_code: "F",
        unit_sequence: 3,
        unit_label: "Level 1",
        unit_type: "OFFICE",
        z_min: 578.5,
        z_max: 581.5,
        status: "VERIFIED",
        geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
      },
      {
        id: "u-rf01",
        parcel_id: "p-nexii",
        prototype_ulpin_3d: "ULPIN-RF01",
        floor_code: "RF01",
        tier_code: "F",
        unit_sequence: 4,
        unit_label: "Rooftop Terrace",
        unit_type: "TERRACE",
        z_min: 581.5,
        z_max: 584.5,
        status: "VERIFIED",
        geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
      },
    ];

    const ov = deriveBuildingOverview({
      candidate: nexiiCandidate,
      verticalUnits: generatedUnits,
      locationContext: hitechLocation,
    });

    expect(ov.groundZ).toBe(575.50);
    expect(ov.roofZ).toBe(584.50);
    expect(ov.totalHeightM).toBe("9.00");
    expect(ov.floorsBelow).toBe(1);
    expect(ov.floorsAbove).toBe(2); // F00 and F01 (RF excluded)
  });
});
