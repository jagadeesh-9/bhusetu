import { describe, it, expect } from "vitest";
import type { VerticalUnit } from "../types/cadastre";
import { getUnitArchitecturalColor } from "../utils/architecturalDetails";
import { deriveElevationLevels } from "../utils/elevationOverlay";

describe("Phase 3.10C: Individual Flat Subdivision Frontend Visualization", () => {
  const mockParentF01: VerticalUnit = {
    id: "unit-f01-parent",
    parcel_id: "parcel-surya",
    building_id: "bldg-surya",
    prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-F-6131-F01",
    floor_code: "F01",
    tier_code: "F",
    unit_sequence: 3,
    unit_label: "Floor F01 (First Floor)",
    unit_type: "STOREY",
    unit_level: "STOREY",
    z_min: 543.50,
    z_max: 546.50,
    status: "PROPOSED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  };

  const mockFlat101: VerticalUnit = {
    id: "unit-f01-101",
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
    z_min: 543.50,
    z_max: 546.50,
    status: "PROPOSED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  };

  const mockFlat102: VerticalUnit = {
    id: "unit-f01-102",
    parcel_id: "parcel-surya",
    building_id: "bldg-surya",
    parent_unit_id: "unit-f01-parent",
    prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-F-6133-U102",
    floor_code: "F01",
    tier_code: "F",
    unit_sequence: 102,
    unit_label: "Flat 102 (2BHK)",
    unit_type: "APARTMENT",
    unit_level: "FLAT",
    flat_number: "102",
    z_min: 543.50,
    z_max: 546.50,
    status: "PROPOSED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  };

  const mockCore: VerticalUnit = {
    id: "unit-f01-core",
    parcel_id: "parcel-surya",
    building_id: "bldg-surya",
    parent_unit_id: "unit-f01-parent",
    prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-F-6136-CORE",
    floor_code: "F01",
    tier_code: "F",
    unit_sequence: 105,
    unit_label: "Floor 1 Common Corridor & Lobby",
    unit_type: "COMMON_AREA",
    unit_level: "COMMON_CIRCULATION",
    flat_number: "CORE",
    z_min: 543.50,
    z_max: 546.50,
    status: "PROPOSED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  };

  it("assigns distinct architectural colors for each flat and common core", () => {
    const c101 = getUnitArchitecturalColor(mockFlat101, null);
    const c102 = getUnitArchitecturalColor(mockFlat102, null);
    const cCore = getUnitArchitecturalColor(mockCore, null);

    expect(c101).toBeDefined();
    expect(c102).toBeDefined();
    expect(cCore).toBeDefined();
    // Compare red/green/blue channels to verify distinct tints
    expect(c101.red).not.toBe(c102.red);
  });

  it("filters out sub-units from elevation marker derivation so floor elevations are not duplicated", () => {
    const allUnits = [mockParentF01, mockFlat101, mockFlat102, mockCore];
    const elevationLevels = deriveElevationLevels(allUnits, 540.0);

    // Only storey-level units should create elevation markers
    const f01Markers = elevationLevels.filter((lvl) => lvl.floorCode === "F01");
    expect(f01Markers.length).toBe(1);
    expect(f01Markers[0].prototypeZ).toBe(543.50);
    expect(f01Markers[0].displayElevation).toBe("+3.50 m");
  });

  it("correctly models spatial properties for 3D Cadastral units", () => {
    const height = mockFlat101.z_max - mockFlat101.z_min;
    expect(height).toBeCloseTo(3.00, 2);

    const groundRef = 540.0;
    const relElevation = mockFlat101.z_min - groundRef;
    expect(relElevation).toBeCloseTo(3.50, 2);
    expect(mockFlat101.parent_unit_id).toBe("unit-f01-parent");
  });
});
