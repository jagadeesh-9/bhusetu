import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { GisAnalysisWorkspace } from "../components/GisAnalysisWorkspace";
import type { Parcel, Building, VerticalUnit, LayerVisibility } from "../types/cadastre";
import { DEFAULT_CUTAWAY_STATE } from "../utils/cutawayUtils";
import { DEFAULT_MEASUREMENT_STATE, DEFAULT_COORD_HUD_STATE } from "../utils/measurementUtils";

describe("GIS Analysis Workspace Component (Phase 1 Feature Expansion)", () => {
  const mockLayers: LayerVisibility = {
    parcel: true,
    building: true,
    groundFloors: true,
    upperFloors: true,
    basements: true,
    utilities: true,
    rooftopElevated: true,
    commonCirculation: true,
    undergroundMode: false,
    wireframeMode: false,
    elevationLevels: false,
    showVerified: true,
    showProposed: true,
    showUnderReview: true,
    showRejected: true,
    showConflictsOnly: false,
    sliceMode: false,
    sliceMinZ: -10,
    sliceMaxZ: 30,
    cutaway: DEFAULT_CUTAWAY_STATE,
    measurement: DEFAULT_MEASUREMENT_STATE,
    coordHUD: DEFAULT_COORD_HUD_STATE,
  };

  const mockParcel: Parcel = {
    id: "par-surya-osm-canonical",
    ulpin_2d: "36A1B2C3D4E5F9",
    survey_number: "Sy.No. 41/2",
    district: "Hyderabad",
    state: "Telangana",
    area_sqm: 1420.5,
    building_count: 1,
    vertical_unit_count: 3,
    geom_2d: {
      srid: 4326,
      geometry_type: "Polygon",
      geojson: {
        type: "Polygon",
        coordinates: [
          [
            [78.4744, 17.3616],
            [78.4750, 17.3616],
            [78.4750, 17.3622],
            [78.4744, 17.3622],
            [78.4744, 17.3616],
          ],
        ],
      },
    },
    created_at: "2026-01-01T00:00:00Z",
  };

  const mockBuilding: Building = {
    id: "bldg-surya-osm",
    parcel_id: "par-surya-osm-canonical",
    building_code: "SURYA-HEIGHTS-MAIN",
    building_name: "Surya Heights Residential Apartment",
    total_floors_above: 5,
    total_floors_below: 1,
    footprint_2d: {
      srid: 4326,
      geometry_type: "Polygon",
      geojson: {
        type: "Polygon",
        coordinates: [
          [
            [78.4745, 17.3617],
            [78.4749, 17.3617],
            [78.4749, 17.3621],
            [78.4745, 17.3621],
            [78.4745, 17.3617],
          ],
        ],
      },
    },
    unit_count: 3,
    created_at: "2026-01-01T00:00:00Z",
  };

  const mockUnits: VerticalUnit[] = [
    {
      id: "unit-bm1",
      parcel_id: "par-surya-osm-canonical",
      building_id: "bldg-surya-osm",
      prototype_ulpin_3d: "36A1B2C3D4E5F9-BM1",
      tier_code: "SB",
      floor_code: "B01",
      unit_sequence: 1,
      unit_label: "Basement Level -1",
      unit_type: "BASEMENT",
      z_min: -3.0,
      z_max: 0.0,
      status: "VERIFIED",
      geom_3d: { srid: 4326, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
    },
    {
      id: "unit-g0",
      parcel_id: "par-surya-osm-canonical",
      building_id: "bldg-surya-osm",
      prototype_ulpin_3d: "36A1B2C3D4E5F9-G0",
      tier_code: "F",
      floor_code: "F00",
      unit_sequence: 2,
      unit_label: "Ground Floor",
      unit_type: "GROUND",
      z_min: 0.0,
      z_max: 3.0,
      status: "VERIFIED",
      geom_3d: { srid: 4326, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
    },
    {
      id: "unit-f1",
      parcel_id: "par-surya-osm-canonical",
      building_id: "bldg-surya-osm",
      prototype_ulpin_3d: "36A1B2C3D4E5F9-F1",
      tier_code: "F",
      floor_code: "F01",
      unit_sequence: 3,
      unit_label: "Floor 1",
      unit_type: "RESIDENTIAL",
      z_min: 3.0,
      z_max: 6.0,
      status: "VERIFIED",
      geom_3d: { srid: 4326, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
    },
  ];

  it("does not render when isOpen is false", () => {
    const html = renderToString(
      <GisAnalysisWorkspace
        isOpen={false}
        onClose={() => {}}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={mockUnits}
        layers={mockLayers}
        onChangeLayers={() => {}}
      />
    );
    expect(html).toBe("");
  });

  it("renders modal workspace container and header when isOpen is true", () => {
    const html = renderToString(
      <GisAnalysisWorkspace
        isOpen={true}
        onClose={() => {}}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={mockUnits}
        layers={mockLayers}
        onChangeLayers={() => {}}
      />
    );
    expect(html).toContain('data-testid="gis-analysis-workspace"');
    expect(html).toContain("GIS Analysis Workspace");
    expect(html).toContain("36A1B2C3D4E5F9");
    expect(html).toContain("Sy.No. 41/2");
    expect(html).toContain("data-testid=\"return-to-3d-button\"");
  });

  it("displays cadastral metrics (parcel area, ground elevation, building heights)", () => {
    const html = renderToString(
      <GisAnalysisWorkspace
        isOpen={true}
        onClose={() => {}}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={mockUnits}
        layers={mockLayers}
        onChangeLayers={() => {}}
      />
    );
    expect(html).toContain("1420.5 m²"); // Parcel Area
    expect(html).toContain("+540.00 m Ground Z"); // Ground Elevation
    expect(html).toContain("18.0 m"); // Building Height
    expect(html).toContain("+558.00 m"); // Roof Elevation (540 + 18)
    expect(html).toContain("EPSG:32644"); // Projected coordinate system
  });

  it("displays vertical strata count and level metrics", () => {
    const html = renderToString(
      <GisAnalysisWorkspace
        isOpen={true}
        onClose={() => {}}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={mockUnits}
        layers={mockLayers}
        onChangeLayers={() => {}}
      />
    );
    expect(html).toContain("3 Volumetric Levels");
    expect(html).toContain("Namespace: 36A1B2C3D4E5F9-U*");
  });

  it("renders layer visibility control toggles", () => {
    const html = renderToString(
      <GisAnalysisWorkspace
        isOpen={true}
        onClose={() => {}}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={mockUnits}
        layers={mockLayers}
        onChangeLayers={() => {}}
        initialTab="layers"
      />
    );
    expect(html).toContain("PARCEL BOUNDARY");
    expect(html).toContain("BUILDING 3D MESH");
    expect(html).toContain("VERTICAL UNITS / STRATA");
    expect(html).toContain("REFERENCE FOOTPRINTS");
    expect(html).toContain("ELEVATION OVERLAY");
    expect(html).toContain("SPATIAL INTERROGATION HUD");
  });

  it("displays Cadastral QC & Validation tab and return to 3D button", () => {
    const html = renderToString(
      <GisAnalysisWorkspace
        isOpen={true}
        onClose={() => {}}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={mockUnits}
        layers={mockLayers}
        onChangeLayers={() => {}}
      />
    );
    expect(html).toContain("Cadastral QC &amp; Validation");
    expect(html).toContain("Return to 3D Viewport");
    expect(html).toContain("Nearby Reference Buildings (0)");
  });

  it("gracefully handles null parcel without throwing", () => {
    const html = renderToString(
      <GisAnalysisWorkspace
        isOpen={true}
        onClose={() => {}}
        parcel={null}
        building={null}
        verticalUnits={[]}
        layers={mockLayers}
        onChangeLayers={() => {}}
      />
    );
    expect(html).toContain('data-testid="gis-analysis-workspace"');
    expect(html).toContain("No Active Parcel");
  });
});
