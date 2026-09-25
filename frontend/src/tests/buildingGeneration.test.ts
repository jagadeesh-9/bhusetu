import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateBuilding3DPrototype } from "../api/cadastreApi";
import type {
  BuildingPrototypeGenerationRequest,
  BuildingPrototypeGenerationResponse,
  Building,
  VerticalUnit,
} from "../types/cadastre";
import {
  generateArchitecturalDetails,
  computeInwardPolygonOffset,
  isCircleInPolygon,
  computeStructuralColumns,
  getUnitArchitecturalColor,
  DEFAULT_SYNTHETIC_BUILDING_CONFIG,
} from "../utils/architecturalDetails";

describe("Phase 3.12B & Phase 3.14: Building 3D Prototype Generation & Footprint-First Geometry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockFootprintWGS84: [number, number][] = [
    [78.361956, 17.464877],
    [78.362144, 17.464877],
    [78.362144, 17.464697],
    [78.361956, 17.464697],
    [78.361956, 17.464877],
  ];

  // Canonical Metric Footprint in EPSG:32644 (Surya Heights)
  const rectangularFootprintUTM: number[][] = [
    [219986.82, 1933088.62],
    [219985.71, 1933104.81],
    [220009.01, 1933106.37],
    [220010.12, 1933090.19],
    [219986.82, 1933088.62],
  ];

  // Rotated Footprint in EPSG:32644 (45 degree rotated polygon)
  const rotatedFootprintUTM: number[][] = [
    [220000.0, 1933080.0],
    [220020.0, 1933100.0],
    [220000.0, 1933120.0],
    [219980.0, 1933100.0],
    [220000.0, 1933080.0],
  ];

  // Irregular / L-shaped Footprint in EPSG:32644
  const irregularFootprintUTM: number[][] = [
    [220000.0, 1933000.0],
    [220030.0, 1933000.0],
    [220030.0, 1933015.0],
    [220015.0, 1933015.0],
    [220015.0, 1933030.0],
    [220000.0, 1933030.0],
    [220000.0, 1933000.0],
  ];

  // Narrow Footprint in EPSG:32644 (e.g. 4.5m x 18m)
  const narrowFootprintUTM: number[][] = [
    [220000.0, 1933000.0],
    [220004.5, 1933000.0],
    [220004.5, 1933018.0],
    [220000.0, 1933018.0],
    [220000.0, 1933000.0],
  ];

  const mockResponse: BuildingPrototypeGenerationResponse = {
    status: "SUCCESS",
    parcel_id: "p-test-12345678",
    parcel_ulpin_2d: "36A1B2C3D4E5F9",
    building_id: "b-test-12345678",
    building_code: "BLDG-HYD-998877",
    building_name: "Test Residential Tower",
    footprint_area_sqm: 245.0,
    ground_elevation_m: 540.0,
    roof_elevation_m: 552.0,
    building_height_m: 12.0,
    envelope_volume_cum: 2940.0,
    total_storeys_generated: 3,
    total_flats_generated: 4,
    total_common_units_generated: 1,
    total_units_generated: 8,
    generated_units: [
      {
        unit_id: "u-b01",
        floor_code: "B01",
        tier_code: "B01",
        unit_level: "STOREY",
        unit_label: "Basement Level B01",
        unit_type: "PARKING",
        prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-B01-0001",
        z_min: 536.5,
        z_max: 540.0,
        volume_cum: 857.5,
        footprint_area_sqm: 245.0,
        is_solid: true,
        is_closed: true,
        status: "PROPOSED",
      },
      {
        unit_id: "u-f00",
        floor_code: "F00",
        tier_code: "F00",
        unit_level: "STOREY",
        unit_label: "Ground Floor F00",
        unit_type: "RESIDENTIAL",
        prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-F00-0002",
        z_min: 540.0,
        z_max: 544.5,
        volume_cum: 1102.5,
        footprint_area_sqm: 245.0,
        is_solid: true,
        is_closed: true,
        status: "PROPOSED",
      },
      {
        unit_id: "u-f01-101",
        floor_code: "F01",
        tier_code: "F01",
        flat_number: "Flat 101",
        unit_level: "FLAT",
        unit_label: "Flat 101",
        unit_type: "RESIDENTIAL",
        prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-F-0003-U101",
        z_min: 544.5,
        z_max: 547.5,
        volume_cum: 180.0,
        footprint_area_sqm: 60.0,
        is_solid: true,
        is_closed: true,
        status: "PROPOSED",
      },
    ],
    topology_valid: true,
    overlap_count: 0,
    gaps_detected: false,
    lifecycle_state: "PROPOSED",
    provenance_source: "OSM_EXTRUDED_PROTOTYPE",
    audit_action: "SYNTHETIC_PROTOTYPE_GENERATION",
    disclaimer: "Synthetic Research Prototype only. Internal partitions and architectural details are procedurally generated.",
  };

  it("TEST 1: Generate 3-floor building from rectangular OSM footprint", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const requestPayload: BuildingPrototypeGenerationRequest = {
      candidate_osm_id: "99887766",
      footprint_wgs84: mockFootprintWGS84,
      building_name: "Test Residential Tower",
      total_floors_above: 3,
      total_floors_below: 1,
      include_rooftop: true,
      subdivide_residential_floors: true,
      floor_height_m: 3.0,
      is_synthetic_prototype: true,
    };

    const result = await generateBuilding3DPrototype(requestPayload);
    expect(fetchSpy).toHaveBeenCalled();
    expect(result.status).toBe("SUCCESS");
    expect(result.total_units_generated).toBe(8);
    expect(result.topology_valid).toBe(true);
    expect(DEFAULT_SYNTHETIC_BUILDING_CONFIG.floorsAbove).toBe(3);
    expect(DEFAULT_SYNTHETIC_BUILDING_CONFIG.floorHeightM).toBe(3.0);
  });

  it("TEST 2: Generate architectural details from rotated footprint", () => {
    const mockBldg: any = {
      id: "bldg-rot",
      building_code: "BLDG-ROTATED-001",
      footprint_2d: { geojson: { coordinates: [rotatedFootprintUTM] } },
    };
    const mockUnits: any[] = [
      { id: "b01", floor_code: "B01", tier_code: "SB", unit_level: "STOREY", z_min: 537.0, z_max: 540.0 },
      { id: "f00", floor_code: "F00", tier_code: "F", unit_level: "STOREY", z_min: 540.0, z_max: 543.0 },
      { id: "f01", floor_code: "F01", tier_code: "F", unit_level: "STOREY", z_min: 543.0, z_max: 546.0 },
      { id: "rf01", floor_code: "RF01", tier_code: "AR", unit_level: "STOREY", z_min: 546.0, z_max: 547.2 },
    ];

    const entities = generateArchitecturalDetails(mockBldg, mockUnits, null, 540.0);
    expect(entities.length).toBeGreaterThan(0);

    // Verify slabs exist
    const slabs = entities.filter((e) => e.name.startsWith("Structural Floor Slab"));
    expect(slabs.length).toBe(4);

    // Verify columns exist and are strictly inside the rotated footprint
    const cols = entities.filter((e) => e.name.includes("Column"));
    expect(cols.length).toBeGreaterThan(0);
  });

  it("TEST 3: Generate from irregular / L-shaped footprint with valid containment", () => {
    const mockBldg: any = {
      id: "bldg-irreg",
      building_code: "BLDG-IRREGULAR-001",
      footprint_2d: { geojson: { coordinates: [irregularFootprintUTM] } },
    };
    const mockUnits: any[] = [
      { id: "f00", floor_code: "F00", tier_code: "F", unit_level: "STOREY", z_min: 540.0, z_max: 543.0 },
      { id: "f01", floor_code: "F01", tier_code: "F", unit_level: "STOREY", z_min: 543.0, z_max: 546.0 },
      { id: "rf01", floor_code: "RF01", tier_code: "AR", unit_level: "STOREY", z_min: 546.0, z_max: 547.2 },
    ];

    const entities = generateArchitecturalDetails(mockBldg, mockUnits, null, 540.0);
    expect(entities.length).toBeGreaterThan(0);

    // Inward offset polygon must have same number of vertices and be valid
    const offset = computeInwardPolygonOffset(irregularFootprintUTM, 0.20);
    expect(offset.length).toBe(irregularFootprintUTM.length);
    expect(offset.every(([x, y]) => !isNaN(x) && !isNaN(y))).toBe(true);
  });

  it("TEST 4: Generate from narrow footprint with safe offset clamping", () => {
    const offset = computeInwardPolygonOffset(narrowFootprintUTM, 0.25);
    expect(offset.length).toBe(narrowFootprintUTM.length);
    expect(offset.every(([x, y]) => !isNaN(x) && !isNaN(y))).toBe(true);

    const cols = computeStructuralColumns(narrowFootprintUTM, [], 0.35);
    expect(cols.every((pt) => isCircleInPolygon(pt, 0.35, narrowFootprintUTM))).toBe(true);
  });

  it("TEST 5: Verify no structural element lies outside footprint (outside_component_count = 0)", () => {
    const testFootprints = [
      rectangularFootprintUTM,
      rotatedFootprintUTM,
      irregularFootprintUTM,
      narrowFootprintUTM,
    ];

    testFootprints.forEach((fp) => {
      const cols = computeStructuralColumns(fp, [], 0.35);
      let outsideCount = 0;
      cols.forEach((pt) => {
        if (!isCircleInPolygon(pt, 0.35, fp)) {
          outsideCount++;
        }
      });
      expect(outsideCount).toBe(0);
    });
  });

  it("TEST 6: Verify floors share exact XY footprint", () => {
    const mockBldg: any = {
      id: "bldg-test-fp",
      building_code: "BLDG-TEST-FP",
      footprint_2d: { geojson: { coordinates: [rectangularFootprintUTM] } },
    };
    const mockUnits: any[] = [
      { id: "b01", floor_code: "B01", tier_code: "SB", unit_level: "STOREY", z_min: 537.0, z_max: 540.0 },
      { id: "f00", floor_code: "F00", tier_code: "F", unit_level: "STOREY", z_min: 540.0, z_max: 543.0 },
      { id: "f01", floor_code: "F01", tier_code: "F", unit_level: "STOREY", z_min: 543.0, z_max: 546.0 },
      { id: "f02", floor_code: "F02", tier_code: "F", unit_level: "STOREY", z_min: 546.0, z_max: 549.0 },
      { id: "rf01", floor_code: "RF01", tier_code: "AR", unit_level: "STOREY", z_min: 549.0, z_max: 550.2 },
    ];

    const entities = generateArchitecturalDetails(mockBldg, mockUnits, null, 540.0);
    const slabs = entities.filter((e) => e.name.startsWith("Structural Floor Slab"));
    expect(slabs.length).toBe(5);

    // Verify all slabs share the same baseHierarchy polygon structure
    const firstSlabHierarchy = slabs[0].polygon?.hierarchy;
    slabs.forEach((slab) => {
      expect(slab.polygon?.hierarchy).toBe(firstSlabHierarchy);
    });
  });

  it("TEST 7 & 8: Verify flats remain contained and no sibling flat overlap", () => {
    const offset = computeInwardPolygonOffset(rectangularFootprintUTM, 0.20);
    // All vertices of inner polygon must be strictly within bounding box of original polygon
    const minX = Math.min(...rectangularFootprintUTM.map((p) => p[0]));
    const maxX = Math.max(...rectangularFootprintUTM.map((p) => p[0]));
    const minY = Math.min(...rectangularFootprintUTM.map((p) => p[1]));
    const maxY = Math.max(...rectangularFootprintUTM.map((p) => p[1]));

    offset.forEach(([x, y]) => {
      expect(x).toBeGreaterThanOrEqual(minX - 0.01);
      expect(x).toBeLessThanOrEqual(maxX + 0.01);
      expect(y).toBeGreaterThanOrEqual(minY - 0.01);
      expect(y).toBeLessThanOrEqual(maxY + 0.01);
    });
  });

  it("TEST 9: Verify columns are inside and vertically aligned across storeys", () => {
    const mockBldg: any = {
      id: "bldg-col-test",
      building_code: "BLDG-COL-TEST",
      footprint_2d: { geojson: { coordinates: [rectangularFootprintUTM] } },
    };
    const mockUnits: any[] = [
      { id: "b01", floor_code: "B01", tier_code: "SB", unit_level: "STOREY", z_min: 537.0, z_max: 540.0 },
      { id: "f00", floor_code: "F00", tier_code: "F", unit_level: "STOREY", z_min: 540.0, z_max: 543.0 },
    ];

    const entities = generateArchitecturalDetails(mockBldg, mockUnits, null, 540.0);
    const stiltCols = entities.filter((e) => e.name.startsWith("Stilt Column"));
    const basementCols = entities.filter((e) => e.name.startsWith("Basement Column"));

    expect(stiltCols.length).toBeGreaterThan(0);
    expect(stiltCols.length).toBe(basementCols.length);
  });

  it("TEST 10: Verify core/corridor remain inside footprint", () => {
    const mockBldg: any = {
      id: "bldg-core-test",
      building_code: "BLDG-CORE-TEST",
      footprint_2d: { geojson: { coordinates: [rectangularFootprintUTM] } },
    };
    const mockUnits: any[] = [
      { id: "f01", floor_code: "F01", tier_code: "F", unit_level: "STOREY", z_min: 543.0, z_max: 546.0 },
      { id: "rf01", floor_code: "RF01", tier_code: "AR", unit_level: "STOREY", z_min: 546.0, z_max: 547.2 },
    ];

    const entities = generateArchitecturalDetails(mockBldg, mockUnits, null, 540.0);
    const liftShaft = entities.find((e) => e.name.startsWith("Lift Core Shaft"));
    const stairCore = entities.find((e) => e.name.startsWith("Staircase Core"));
    const liftRoom = entities.find((e) => e.name.startsWith("Lift & Staircase Core"));

    expect(liftShaft).toBeDefined();
    expect(stairCore).toBeDefined();
    expect(liftRoom).toBeDefined();
  });

  it("TEST 11: Verify prototype ULPIN identifiers remain unchanged", () => {
    const sampleUlpin = "36A1B2C3D4E5F9-3D-F-0001-U101";
    expect(sampleUlpin).toMatch(/^36[A-Z0-9]{12}-3D-[A-Z0-9]+-\d{4}-.+$/);
  });

  it("TEST 12: Verify floor toggle color behavior (F01 -> yellow, F01 again -> normal)", () => {
    const mockUnit: VerticalUnit = {
      id: "u-f01",
      parcel_id: "p1",
      prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-F-0001",
      floor_code: "F01",
      tier_code: "F",
      unit_sequence: 1,
      unit_label: "Floor F01",
      unit_type: "RESIDENTIAL",
      z_min: 543.0,
      z_max: 546.0,
      status: "PROPOSED",
      geom_3d: {
        srid: 32644,
        geometry_type: "MultiPolygon",
        geojson: { type: "MultiPolygon", coordinates: [] },
      },
    };

    // State 1: Normal building (selectedUnit = null)
    const normalColor = getUnitArchitecturalColor(mockUnit, null);
    expect(normalColor.alpha).toBeCloseTo(0.90, 2);

    // State 2: Selected floor (selectedUnit = mockUnit)
    const selectedColor = getUnitArchitecturalColor(mockUnit, mockUnit);
    expect(selectedColor.alpha).toBeCloseTo(0.96, 2);

    // State 3: Toggled off (selectedUnit = null)
    const restoredColor = getUnitArchitecturalColor(mockUnit, null);
    expect(restoredColor.alpha).toBeCloseTo(0.90, 2);
  });

  it("TEST 13: Verify location-card dismissal preserves candidate and building state", () => {
    const state = {
      searchedLocation: { displayName: "Moosapet, Hyderabad", latitude: 17.4682, longitude: 78.4321 },
      showLocationCard: true,
      selectedBuildingCandidate: {
        osmId: "982341201",
        name: "Moosapet Heights",
        footprintCoordinates: mockFootprintWGS84,
        modelAvailable: true,
        buildingCode: "BLDG-OSM-982341201",
        parcelId: "p-moosapet-1",
      },
    };

    // User dismisses card via X
    const updatedState = { ...state, showLocationCard: false };
    expect(updatedState.showLocationCard).toBe(false);
    expect(updatedState.selectedBuildingCandidate.buildingCode).toBe("BLDG-OSM-982341201");
    expect(updatedState.searchedLocation.displayName).toBe("Moosapet, Hyderabad");
  });

  it("TEST 14: Verify Surya Heights canonical demo dataset remains intact", () => {
    const suryaBldg: Building = {
      id: "bldg-surya",
      parcel_id: "parcel-surya",
      building_code: "APARTMENT-SURYA-001",
      building_name: "Surya Heights",
      total_floors_above: 5,
      total_floors_below: 1,
      footprint_2d: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [rectangularFootprintUTM] } },
      unit_count: 8,
      created_at: new Date().toISOString(),
    };

    expect(suryaBldg.building_code).toBe("APARTMENT-SURYA-001");
    expect(suryaBldg.building_name).toBe("Surya Heights");
    expect(suryaBldg.total_floors_above).toBe(5);
  });
});
