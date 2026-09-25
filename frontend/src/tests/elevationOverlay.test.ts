import { describe, it, expect } from "vitest";
import {
  deriveElevationLevels,
  calculateElevationOverlayAnchors,
  generateElevationOverlayEntities,
} from "../utils/elevationOverlay";
import type { VerticalUnit, Building } from "../types/cadastre";

const mockUnits: VerticalUnit[] = [
  {
    id: "unit-sb01",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-SB01",
    floor_code: "B01",
    tier_code: "SB",
    unit_sequence: 1,
    unit_label: "Basement Parking Level",
    unit_type: "BASEMENT_PARKING",
    z_min: 536.50,
    z_max: 540.00,
    status: "VERIFIED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  },
  {
    id: "unit-f00",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-F00",
    floor_code: "F00",
    tier_code: "F",
    unit_sequence: 2,
    unit_label: "Ground Floor Stilt & Lobby",
    unit_type: "COMMON_CIRCULATION",
    z_min: 540.00,
    z_max: 543.50,
    status: "VERIFIED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  },
  {
    id: "unit-f01",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-F01",
    floor_code: "F01",
    tier_code: "F",
    unit_sequence: 3,
    unit_label: "First Floor Residential Unit",
    unit_type: "RESIDENTIAL",
    z_min: 543.50,
    z_max: 546.50,
    status: "VERIFIED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  },
  {
    id: "unit-f02",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-F02",
    floor_code: "F02",
    tier_code: "F",
    unit_sequence: 4,
    unit_label: "Second Floor Residential Unit",
    unit_type: "RESIDENTIAL",
    z_min: 546.50,
    z_max: 549.50,
    status: "VERIFIED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  },
  {
    id: "unit-f03",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-F03",
    floor_code: "F03",
    tier_code: "F",
    unit_sequence: 5,
    unit_label: "Third Floor Residential Unit",
    unit_type: "RESIDENTIAL",
    z_min: 549.50,
    z_max: 552.50,
    status: "VERIFIED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  },
  {
    id: "unit-f04",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-F04",
    floor_code: "F04",
    tier_code: "F",
    unit_sequence: 6,
    unit_label: "Fourth Floor Residential Unit",
    unit_type: "RESIDENTIAL",
    z_min: 552.50,
    z_max: 555.50,
    status: "VERIFIED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  },
  {
    id: "unit-f05",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-F05",
    floor_code: "F05",
    tier_code: "F",
    unit_sequence: 7,
    unit_label: "Fifth Floor Residential Unit",
    unit_type: "RESIDENTIAL",
    z_min: 555.50,
    z_max: 558.50,
    status: "VERIFIED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  },
  {
    id: "unit-rf01",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-RF01",
    floor_code: "RF01",
    tier_code: "AR",
    unit_sequence: 8,
    unit_label: "Rooftop Common Terrace",
    unit_type: "COMMON_TERRACE",
    z_min: 558.50,
    z_max: 561.50,
    status: "VERIFIED",
    geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
  },
];

const mockBuilding = {
  id: "bldg-1",
  parcel_id: "parcel-1",
  building_code: "APARTMENT-SURYA-OSM",
  building_name: "Surya Heights Residential Apartment",
  total_floors_above: 6,
  total_floors_below: 1,
  unit_count: 8,
  created_at: new Date().toISOString(),
  footprint_2d: {
    srid: 32644,
    geometry_type: "Polygon",
    geojson: {
      type: "Polygon",
      coordinates: [
        [
          [219986.82, 1933088.62],
          [219985.71, 1933104.81],
          [220009.01, 1933106.37],
          [220010.12, 1933090.19],
          [219986.82, 1933088.62],
        ],
      ],
    },
  },
} as unknown as Building;

describe("Phase 3.7R Architectural Vertical Elevation Overlay", () => {
  it("derives correct vertical elevation levels relative to ground reference Z=540.0m", () => {
    const levels = deriveElevationLevels(mockUnits, 540.0);

    expect(levels.length).toBe(8);

    const b01 = levels.find((l) => l.floorCode === "B01");
    expect(b01).toBeDefined();
    expect(b01?.renderZ).toBe(-3.50);
    expect(b01?.displayElevation).toBe("-3.50 m");
    expect(b01?.isBasement).toBe(true);

    const f00 = levels.find((l) => l.floorCode === "F00");
    expect(f00).toBeDefined();
    expect(f00?.renderZ).toBe(0.00);
    expect(f00?.displayElevation).toBe("±0.00 m");
    expect(f00?.isGround).toBe(true);

    const f01 = levels.find((l) => l.floorCode === "F01");
    expect(f01?.renderZ).toBe(3.50);
    expect(f01?.displayElevation).toBe("+3.50 m");

    const f02 = levels.find((l) => l.floorCode === "F02");
    expect(f02?.renderZ).toBe(6.50);
    expect(f02?.displayElevation).toBe("+6.50 m");

    const f03 = levels.find((l) => l.floorCode === "F03");
    expect(f03?.renderZ).toBe(9.50);
    expect(f03?.displayElevation).toBe("+9.50 m");

    const f04 = levels.find((l) => l.floorCode === "F04");
    expect(f04?.renderZ).toBe(12.50);
    expect(f04?.displayElevation).toBe("+12.50 m");

    const f05 = levels.find((l) => l.floorCode === "F05");
    expect(f05?.renderZ).toBe(15.50);
    expect(f05?.displayElevation).toBe("+15.50 m");

    const rf01 = levels.find((l) => l.floorCode === "RF01");
    expect(rf01?.renderZ).toBe(18.50);
    expect(rf01?.displayElevation).toBe("+18.50 m");
    expect(rf01?.isRooftop).toBe(true);
  });

  it("calculates East facade horizontal anchor lines accurately", () => {
    const anchors = calculateElevationOverlayAnchors(mockBuilding);
    expect(anchors.startX).toBeCloseTo(220010.12, 1);
    expect(anchors.endX).toBeGreaterThan(anchors.startX);
    expect(anchors.endX - anchors.startX).toBeCloseTo(6.0, 1);
  });

  it("generates Cesium entity definitions for all elevation levels with selection emphasis", () => {
    const selectedUnit = mockUnits[4]; // F03
    const entities = generateElevationOverlayEntities(mockUnits, selectedUnit, mockBuilding, 540.0);

    expect(entities.length).toBeGreaterThan(16); // Polylines + points + labels

    const f03Line = entities.find(
      (e) => e.polyline && e.levelData?.floorCode === "F03"
    );
    expect(f03Line).toBeDefined();
    expect(f03Line?.polyline.width).toBe(3.5); // Selected emphasis

    const f01Line = entities.find(
      (e) => e.polyline && e.levelData?.floorCode === "F01"
    );
    expect(f01Line).toBeDefined();
    expect(f01Line?.polyline.width).toBe(1.8); // Subdued non-selected

    const f03Label = entities.find(
      (e) => e.label && e.levelData?.floorCode === "F03"
    );
    expect(f03Label?.label.text).toContain("F03   +9.50 m");
    expect(f03Label?.label.showBackground).toBe(true);
    expect(f03Label?.label.font).toContain("bold 14px");
  });

  describe("Phase 8 Explicit Tests (TEST 1 to TEST 7)", () => {
    it("TEST 1: 3-floor generated prototype with standard 3.0m floors (F00=±0.00m, F01=+3.00m, F02=+6.00m, F03=+9.00m)", () => {
      const generatedUnits: VerticalUnit[] = [
        {
          id: "gen-f00",
          parcel_id: "p1",
          building_id: "b1",
          prototype_ulpin_3d: "ULPIN-MOCK",
          floor_code: "F00",
          tier_code: "F",
          unit_sequence: 1,
          unit_label: "Ground Stilt",
          unit_type: "COMMON_CIRCULATION",
          z_min: 540.0,
          z_max: 543.0,
          status: "VERIFIED",
          geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
        },
        {
          id: "gen-f01",
          parcel_id: "p1",
          building_id: "b1",
          prototype_ulpin_3d: "ULPIN-MOCK",
          floor_code: "F01",
          tier_code: "F",
          unit_sequence: 2,
          unit_label: "Floor 1",
          unit_type: "RESIDENTIAL",
          z_min: 543.0,
          z_max: 546.0,
          status: "VERIFIED",
          geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
        },
        {
          id: "gen-f02",
          parcel_id: "p1",
          building_id: "b1",
          prototype_ulpin_3d: "ULPIN-MOCK",
          floor_code: "F02",
          tier_code: "F",
          unit_sequence: 3,
          unit_label: "Floor 2",
          unit_type: "RESIDENTIAL",
          z_min: 546.0,
          z_max: 549.0,
          status: "VERIFIED",
          geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
        },
        {
          id: "gen-f03",
          parcel_id: "p1",
          building_id: "b1",
          prototype_ulpin_3d: "ULPIN-MOCK",
          floor_code: "F03",
          tier_code: "F",
          unit_sequence: 4,
          unit_label: "Floor 3",
          unit_type: "RESIDENTIAL",
          z_min: 549.0,
          z_max: 552.0,
          status: "VERIFIED",
          geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
        },
      ];

      const levels = deriveElevationLevels(generatedUnits, 540.0);
      expect(levels.find((l) => l.floorCode === "F00")?.displayElevation).toBe("±0.00 m");
      expect(levels.find((l) => l.floorCode === "F01")?.displayElevation).toBe("+3.00 m");
      expect(levels.find((l) => l.floorCode === "F02")?.displayElevation).toBe("+6.00 m");
      expect(levels.find((l) => l.floorCode === "F03")?.displayElevation).toBe("+9.00 m");
    });

    it("TEST 2: Prototype with custom floor height 3.2m (F01=+3.20m, F02=+6.40m, F03=+9.60m)", () => {
      const customUnits: VerticalUnit[] = [
        {
          id: "cust-f00",
          parcel_id: "p1",
          building_id: "b1",
          prototype_ulpin_3d: "ULPIN-MOCK",
          floor_code: "F00",
          tier_code: "F",
          unit_sequence: 1,
          unit_label: "Ground Floor",
          unit_type: "COMMON_CIRCULATION",
          z_min: 540.0,
          z_max: 543.2,
          status: "VERIFIED",
          geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
        },
        {
          id: "cust-f01",
          parcel_id: "p1",
          building_id: "b1",
          prototype_ulpin_3d: "ULPIN-MOCK",
          floor_code: "F01",
          tier_code: "F",
          unit_sequence: 2,
          unit_label: "Floor 1",
          unit_type: "RESIDENTIAL",
          z_min: 543.2,
          z_max: 546.4,
          status: "VERIFIED",
          geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
        },
        {
          id: "cust-f02",
          parcel_id: "p1",
          building_id: "b1",
          prototype_ulpin_3d: "ULPIN-MOCK",
          floor_code: "F02",
          tier_code: "F",
          unit_sequence: 3,
          unit_label: "Floor 2",
          unit_type: "RESIDENTIAL",
          z_min: 546.4,
          z_max: 549.6,
          status: "VERIFIED",
          geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
        },
        {
          id: "cust-f03",
          parcel_id: "p1",
          building_id: "b1",
          prototype_ulpin_3d: "ULPIN-MOCK",
          floor_code: "F03",
          tier_code: "F",
          unit_sequence: 4,
          unit_label: "Floor 3",
          unit_type: "RESIDENTIAL",
          z_min: 549.6,
          z_max: 552.8,
          status: "VERIFIED",
          geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
        },
      ];

      const levels = deriveElevationLevels(customUnits, 540.0);
      expect(levels.find((l) => l.floorCode === "F00")?.displayElevation).toBe("±0.00 m");
      expect(levels.find((l) => l.floorCode === "F01")?.displayElevation).toBe("+3.20 m");
      expect(levels.find((l) => l.floorCode === "F02")?.displayElevation).toBe("+6.40 m");
      expect(levels.find((l) => l.floorCode === "F03")?.displayElevation).toBe("+9.60 m");
    });

    it("TEST 3: Basement relative elevation is negative configured basement height", () => {
      const basementUnit: VerticalUnit = {
        id: "b-01",
        parcel_id: "p1",
        building_id: "b1",
        prototype_ulpin_3d: "ULPIN-MOCK-B01",
        floor_code: "B01",
        tier_code: "SB",
        unit_sequence: 1,
        unit_label: "Sub-Basement Level",
        unit_type: "BASEMENT_PARKING",
        z_min: 536.5,
        z_max: 540.0,
        status: "VERIFIED",
        geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
      };
      const groundUnit: VerticalUnit = {
        id: "g-00",
        parcel_id: "p1",
        building_id: "b1",
        prototype_ulpin_3d: "ULPIN-MOCK-G00",
        floor_code: "F00",
        tier_code: "F",
        unit_sequence: 2,
        unit_label: "Ground Floor",
        unit_type: "COMMON_CIRCULATION",
        z_min: 540.0,
        z_max: 543.0,
        status: "VERIFIED",
        geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
      };

      const levels = deriveElevationLevels([basementUnit, groundUnit], 540.0);
      const b01 = levels.find((l) => l.floorCode === "B01");
      expect(b01?.renderZ).toBe(-3.50);
      expect(b01?.displayElevation).toBe("-3.50 m");
      expect(b01?.isBasement).toBe(true);
    });

    it("TEST 4: Rooftop derives relative elevation directly from actual Z values (+12.00m)", () => {
      const unitsWithRooftop: VerticalUnit[] = [
        {
          id: "g-00",
          parcel_id: "p1",
          building_id: "b1",
          prototype_ulpin_3d: "ULPIN-MOCK",
          floor_code: "F00",
          tier_code: "F",
          unit_sequence: 1,
          unit_label: "Ground Floor",
          unit_type: "COMMON_CIRCULATION",
          z_min: 540.0,
          z_max: 543.0,
          status: "VERIFIED",
          geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
        },
        {
          id: "rf-01",
          parcel_id: "p1",
          building_id: "b1",
          prototype_ulpin_3d: "ULPIN-MOCK",
          floor_code: "RF01",
          tier_code: "AR",
          unit_sequence: 2,
          unit_label: "Terrace Deck",
          unit_type: "COMMON_TERRACE",
          z_min: 552.0,
          z_max: 554.5,
          status: "VERIFIED",
          geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
        },
      ];

      const levels = deriveElevationLevels(unitsWithRooftop, 540.0);
      const rf01 = levels.find((l) => l.floorCode === "RF01");
      expect(rf01?.renderZ).toBe(12.00);
      expect(rf01?.displayElevation).toBe("+12.00 m");
      expect(rf01?.isRooftop).toBe(true);
    });

    it("TEST 5 & 6: Entity generation with selected unit and deselected unit preserve elevation correctness", () => {
      const levels = deriveElevationLevels(mockUnits, 540.0);
      // Floor selected
      const selectedEntities = generateElevationOverlayEntities(mockUnits, mockUnits[2], mockBuilding, 540.0); // F01 selected
      const f01Label = selectedEntities.find((e) => e.label && e.levelData?.floorCode === "F01");
      expect(f01Label?.label.text).toBe("F01   +3.50 m");

      // No floor selected (building overview)
      const unselectedEntities = generateElevationOverlayEntities(mockUnits, null, mockBuilding, 540.0);
      const f01UnselectedLabel = unselectedEntities.find((e) => e.label && e.levelData?.floorCode === "F01");
      expect(f01UnselectedLabel?.label.text).toBe("F01   +3.50 m");
      expect(levels.length).toBe(8);
    });

    it("TEST 7: Surya Heights canonical elevation values are strictly preserved", () => {
      const levels = deriveElevationLevels(mockUnits, 540.0);
      const expectedSurya = {
        RF01: "+18.50 m",
        F05: "+15.50 m",
        F04: "+12.50 m",
        F03: "+9.50 m",
        F02: "+6.50 m",
        F01: "+3.50 m",
        F00: "±0.00 m",
        B01: "-3.50 m",
      };

      for (const [code, expectedText] of Object.entries(expectedSurya)) {
        const found = levels.find((l) => l.floorCode === code);
        expect(found, `Floor ${code} should exist`).toBeDefined();
        expect(found?.displayElevation, `Floor ${code} elevation mismatch`).toBe(expectedText);
      }
    });
  });
});
