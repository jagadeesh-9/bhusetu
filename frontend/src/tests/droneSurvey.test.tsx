import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { DroneSurveyWorkspace } from "../components/DroneSurveyWorkspace";
import { Header } from "../components/Header";
import { LandingShell } from "../components/LandingShell";
import type { Parcel, Building } from "../types/cadastre";
import type { DroneSurveyAnalysisResponse } from "../types/droneSurvey";

describe("Phase 5: Drone Survey / Survey Data Input Workspace Frontend Test Suite", () => {
  const mockParcel: Parcel = {
    id: "parcel-surya-canonical",
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
            [78.475, 17.3616],
            [78.475, 17.3622],
            [78.4744, 17.3622],
            [78.4744, 17.3616],
          ],
        ],
      },
    },
    created_at: "2026-01-01T00:00:00Z",
  };

  const mockBuilding: Building = {
    id: "bld-surya-canonical",
    parcel_id: "parcel-surya-canonical",
    building_code: "SURYA-MAIN",
    building_name: "Surya Heights Residential Apartment",
    total_floors_above: 5,
    total_floors_below: 1,
    footprint_2d: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
    unit_count: 3,
    created_at: "2026-01-01T00:00:00Z",
  };

  const mockAnalysisResult: DroneSurveyAnalysisResponse = {
    survey_id: "SRV-TEST-001",
    image_count: 3,
    is_demo_survey: true,
    available_evidence: ["Nadir Imagery", "Oblique Facades", "GCPs"],
    missing_evidence: ["LiDAR Point Cloud"],
    warnings: [],
    cadastral_legal_notice: "Ordinary drone photographs and aerial reconstructions are not survey-grade cadastral evidence and do not determine legal ownership.",
    survey_coverage_metadata: {
      survey_id: "SRV-TEST-001",
      capture_date: "2026-09-17",
      operator_agency: "Telangana Geospatial Drone Survey Unit",
      camera_source: "DJI Zenmuse P1",
      approx_area_sqm: 1850.0,
      crs: "EPSG:32644",
      ground_control_available: true,
      gcp_count: 4,
      has_point_cloud: false,
      point_cloud_ref: null,
      average_flight_altitude_m: 60.0,
      ground_elevation_datum_m: 540.0,
      dem_source: "Copernicus 30m Global DEM"
    },
    quality_checks: [
      {
        check_name: "Nadir Roof Imagery",
        category: "IMAGERY",
        status: "AVAILABLE",
        details: "High-resolution nadir orthophoto present",
        provenance: "OBSERVED"
      },
      {
        check_name: "Oblique Facade Imagery",
        category: "IMAGERY",
        status: "AVAILABLE",
        details: "Multi-angle facade elevations present",
        provenance: "OBSERVED"
      },
      {
        check_name: "Ground Control Points (GCP)",
        category: "METRIC",
        status: "AVAILABLE",
        details: "4 DGPS GCPs surveyed",
        provenance: "OBSERVED"
      },
      {
        check_name: "Prototype Vertical Elevation Reference",
        category: "VERTICAL_DATUM",
        status: "AVAILABLE",
        details: "Ground Z reference established at 540.0 m (DEM-derived prototype reference)",
        provenance: "REFERENCE"
      },
      {
        check_name: "Surveyor License & Agency Stamp",
        category: "GOVERNANCE",
        status: "AVAILABLE",
        details: "Telangana Geospatial Drone Survey Unit",
        provenance: "OBSERVED"
      }
    ],
    derived_products: [
      {
        product_name: "True Orthomosaic (TIF/COG)",
        product_type: "ORTHOMOSAIC",
        resolution_or_spec: "0.021m GSD",
        status: "GENERATED",
        provenance: "OBSERVED",
        notes: "0.021m GSD nadir composite"
      }
    ],
    provenance_matrix: [
      {
        source: "Drone Survey Flight Photos",
        type: "UAV Optical RGB",
        status: "AVAILABLE",
        used_for: "Aspect ratio and elevation profiles",
        provenance: "OBSERVED"
      }
    ],
    underground_limitation_notice: "STATUTORY LIMITATION NOTICE: Subsurface Structures & Basements. Drone photogrammetry and optical sensors cannot detect underground structures or subsurface utilities.",
    point_cloud_support_notice: "PHOTOGRAMMETRY & LIDAR POINT CLOUD INTEGRATION: System architecture supports dense photogrammetric point clouds.",
    handoff_payload: {
      parcel_id: "parcel-surya-canonical",
      images: []
    }
  };

  it("1. Does not render workspace modal when isOpen is false", () => {
    const html = renderToString(
      <DroneSurveyWorkspace
        isOpen={false}
        onClose={vi.fn()}
      />
    );
    expect(html).toBe("");
  });

  it("2. Renders workspace modal when isOpen is true with survey metadata and title", () => {
    const html = renderToString(
      <DroneSurveyWorkspace
        isOpen={true}
        onClose={vi.fn()}
        parcel={mockParcel}
        building={mockBuilding}
      />
    );
    expect(html).toContain("DRONE SURVEY / SURVEY DATA WORKSPACE");
    expect(html).toContain("Mission Parameters");
    expect(html).toContain("Load Demo Drone Survey");
  });

  it("3. Displays statutory underground disclaimer banner", () => {
    const html = renderToString(
      <DroneSurveyWorkspace
        isOpen={true}
        onClose={vi.fn()}
        parcel={mockParcel}
      />
    );
    expect(html).toContain("STATUTORY LIMITATION NOTICE: Subsurface Structures &amp; Basements");
    expect(html).toContain("Drone photogrammetry and optical sensors cannot detect underground structures");
  });

  it("4. Displays photogrammetric / LiDAR architecture support notice", () => {
    const html = renderToString(
      <DroneSurveyWorkspace
        isOpen={true}
        onClose={vi.fn()}
        parcel={mockParcel}
      />
    );
    expect(html).toContain("PHOTOGRAMMETRY &amp; LIDAR POINT CLOUD INTEGRATION");
    expect(html).toContain("LAS / LAZ / E57 / COPC");
  });

  it("5. Displays 8-point evidence checklist table when analysisResult is present", () => {
    const html = renderToString(
      <DroneSurveyWorkspace
        isOpen={true}
        onClose={vi.fn()}
        parcel={mockParcel}
        initialAnalysisResult={mockAnalysisResult}
      />
    );
    expect(html).toContain("Stage 2: Quality Checklist");
    expect(html).toContain("Nadir Roof Imagery");
    expect(html).toContain("Oblique Facade Imagery");
    expect(html).toContain("Ground Control Points (GCP)");
    expect(html).toContain("Prototype Vertical Elevation Reference");
    expect(html).toContain("STAGE 4: Cadastral Handoff to AI Image");
    expect(html).toContain("data-testid=\"btn-send-to-ai\"");
  });

  it("6. Header renders nav-drone-survey button in top navigation", () => {
    const html = renderToString(
      <Header
        parcels={[mockParcel]}
        selectedParcel={mockParcel}
        onSelectParcel={vi.fn()}
        isConnected={true}
        currentView="dashboard"
        onOpenDroneSurvey={vi.fn()}
      />
    );
    expect(html).toContain("data-testid=\"nav-drone-survey\"");
    expect(html).toContain("Drone Survey");
  });

  it("7. LandingShell renders nav-drone-survey button in top navigation", () => {
    const html = renderToString(
      <LandingShell
        onLaunch3D={vi.fn()}
        onOpenGisAnalysis={vi.fn()}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={[]}
        activeRole="ADMIN"
        onChangeRole={vi.fn()}
        currentView="landing"
        onOpenDroneSurvey={vi.fn()}
      />
    );
    expect(html).toContain("data-testid=\"nav-drone-survey\"");
    expect(html).toContain("Drone Survey");
  });

  it("8. Ground-Z is labeled as DEM-derived prototype reference without AMSL", () => {
    const html = renderToString(
      <DroneSurveyWorkspace
        isOpen={true}
        onClose={vi.fn()}
        parcel={mockParcel}
        initialAnalysisResult={mockAnalysisResult}
      />
    );
    expect(html).not.toContain("540.0m AMSL");
    expect(html).not.toContain("AMSL");
    expect(html).toContain("Prototype Vertical Elevation Reference");
    expect(html).toContain("Ground Z: 540.0 m");
    expect(html).toContain("Source: DEM-derived prototype reference");
  });

  it("9. Renders statutory distinction between flight altitude / AGL, Ground Z, and cadastral datum", () => {
    const html = renderToString(
      <DroneSurveyWorkspace
        isOpen={true}
        onClose={vi.fn()}
        parcel={mockParcel}
        initialAnalysisResult={mockAnalysisResult}
      />
    );
    expect(html).toContain("Flight altitude / AGL ≠ Ground Z ≠ absolute cadastral elevation datum");
    expect(html).toContain("Drone imagery provides surface/visual elevation evidence. Ground Z is resolved from available DEM/reference geospatial data.");
  });

  it("10. Renders explicit unavailable state when ground elevation datum is null", () => {
    const nullElevationResult = {
      ...mockAnalysisResult,
      survey_coverage_metadata: {
        ...mockAnalysisResult.survey_coverage_metadata,
        ground_elevation_datum_m: null
      }
    };
    const html = renderToString(
      <DroneSurveyWorkspace
        isOpen={true}
        onClose={vi.fn()}
        parcel={mockParcel}
        initialAnalysisResult={nullElevationResult}
      />
    );
    expect(html).toContain("Ground Z unavailable");
    expect(html).toContain("Authoritative/reference elevation required");
  });
});
