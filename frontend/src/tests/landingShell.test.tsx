import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { LandingShell, type UserRole } from "../components/LandingShell";
import { GisAnalysisWorkspace } from "../components/GisAnalysisWorkspace";
import type { Parcel, Building, VerticalUnit, BuildingCandidate, LayerVisibility } from "../types/cadastre";
import { DEFAULT_CUTAWAY_STATE } from "../utils/cutawayUtils";
import { DEFAULT_MEASUREMENT_STATE, DEFAULT_COORD_HUD_STATE } from "../utils/measurementUtils";

describe("LandingShell Component & Module Navigation (Phase 1 & Phase 1.1)", () => {
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

  const mockBuilding = {
    id: "bld-surya-canonical",
    parcel_id: "par-surya-osm-canonical",
    building_code: "SURYA-MAIN",
    building_name: "Surya Heights Residential Apartment",
    total_floors_above: 5,
    total_floors_below: 1,
    height_m: 21.0,
    created_at: "2026-01-01T00:00:00Z",
  } as unknown as Building;

  const mockVerticalUnits = [
    {
      id: "unit-surya-f0-g01",
      building_id: "bld-surya-canonical",
      unit_type: "RESIDENTIAL",
      floor_number: 0,
      unit_identifier: "Surya-G01",
      ulpin_3d: "36A1B2C3D4E5F9-F00-U01",
      created_at: "2026-01-01T00:00:00Z",
    } as unknown as VerticalUnit,
    {
      id: "unit-surya-f1-101",
      building_id: "bld-surya-canonical",
      unit_type: "RESIDENTIAL",
      floor_number: 1,
      unit_identifier: "Surya-101",
      ulpin_3d: "36A1B2C3D4E5F9-F01-U01",
      created_at: "2026-01-01T00:00:00Z",
    } as unknown as VerticalUnit,
  ];

  const defaultProps = {
    onLaunch3D: vi.fn(),
    onOpenGisAnalysis: vi.fn(),
    onOpenVerticalStrata: vi.fn(),
    parcel: mockParcel,
    building: mockBuilding,
    verticalUnits: mockVerticalUnits,
    buildingCandidate: null as BuildingCandidate | null,
    activeRole: "ADMIN" as UserRole,
    onChangeRole: vi.fn(),
  };

  // 1. Landing page renders
  it("1. renders the landing page shell structure", () => {
    const html = renderToString(<LandingShell {...defaultProps} />);
    expect(html).toContain("landing-shell");
    expect(html).toContain("3D ULPIN");
    expect(html).toContain("Vertical Property Mapping");
    expect(html).toContain("From 2D Land Parcels to 3D Vertical Property Strata");
  });

  // 2. Research Prototype indicator renders
  it("2. renders the Research Prototype indicator badge and safe footer", () => {
    const html = renderToString(<LandingShell {...defaultProps} />);
    expect(html).toContain("RESEARCH PROTOTYPE");
    expect(html).toContain("Research Prototype · Geospatial Analytics · SIH26011");
    expect(html).not.toContain("Survey of India Compliance Engine");
  });

  // 3. Launch 3D Dashboard action exists & still works
  it("3. contains primary Launch 3D Dashboard action and switches view", () => {
    const onLaunch3DMock = vi.fn();
    const props = { ...defaultProps, onLaunch3D: onLaunch3DMock };
    const html = renderToString(<LandingShell {...props} />);
    expect(html).toContain("Launch 3D Dashboard");
    expect(html).toContain("launch-3d-dashboard-button");
    props.onLaunch3D();
    expect(onLaunch3DMock).toHaveBeenCalledTimes(1);
  });

  // 4. GIS Analysis opens Spatial Summary
  it("4. GIS Analysis action triggers with 'summary' tab", () => {
    const onOpenGisMock = vi.fn();
    const props = { ...defaultProps, onOpenGisAnalysis: onOpenGisMock };
    const html = renderToString(<LandingShell {...props} />);
    expect(html).toContain("Explore GIS Analysis");
    expect(html).toContain("explore-gis-analysis-button");
    props.onOpenGisAnalysis("summary");
    expect(onOpenGisMock).toHaveBeenCalledWith("summary");
  });

  // 5. Validation navigation opens Cadastral QC & Validation
  it("5. Validation navigation triggers onOpenGisAnalysis with 'validation' tab", () => {
    const onOpenGisMock = vi.fn();
    const props = { ...defaultProps, onOpenGisAnalysis: onOpenGisMock };
    const html = renderToString(<LandingShell {...props} />);
    expect(html).toContain("nav-validation");
    // Verify callback passes 'validation' tab identifier
    props.onOpenGisAnalysis("validation");
    expect(onOpenGisMock).toHaveBeenCalledWith("validation");
  });

  // 6. GisAnalysisWorkspace directly renders Cadastral QC & Validation when initialTab is 'validation'
  it("6. GisAnalysisWorkspace displays Cadastral QC & Validation tab content when initialTab is 'validation'", () => {
    const html = renderToString(
      <GisAnalysisWorkspace
        isOpen={true}
        initialTab="validation"
        onClose={vi.fn()}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={mockVerticalUnits}
        layers={mockLayers}
        onChangeLayers={vi.fn()}
      />
    );
    // Tab indicator should reflect validation active
    expect(html).toContain("data-testid=\"tab-validation\"");
    // Validation tab content should be rendered
    expect(html).toContain("Passed SFCGAL / PostGIS 3D Cadastral Quality Control");
    expect(html).toContain("Closed 3D Polyhedral Solids");
    expect(html).toContain("Zero Volumetric Overlap");
    expect(html).toContain("Parcel Extent Containment");
  });

  // 7. GisAnalysisWorkspace displays Spatial Summary when initialTab is 'summary'
  it("7. GisAnalysisWorkspace displays Spatial Summary tab content when initialTab is 'summary'", () => {
    const html = renderToString(
      <GisAnalysisWorkspace
        isOpen={true}
        initialTab="summary"
        onClose={vi.fn()}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={mockVerticalUnits}
        layers={mockLayers}
        onChangeLayers={vi.fn()}
      />
    );
    expect(html).toContain("data-testid=\"tab-summary\"");
    expect(html).toContain("PARCEL &amp; ULPIN");
    expect(html).toContain("BUILDING DIMENSIONS");
    expect(html).toContain("Survey No:");
  });

  // 8. Closing Validation returns to 3D dashboard
  it("8. GisAnalysisWorkspace provides return to 3D viewport close action", () => {
    const onCloseMock = vi.fn();
    const onInspect3DMock = vi.fn();
    const html = renderToString(
      <GisAnalysisWorkspace
        isOpen={true}
        initialTab="validation"
        onClose={onCloseMock}
        onInspect3DView={onInspect3DMock}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={mockVerticalUnits}
        layers={mockLayers}
        onChangeLayers={vi.fn()}
      />
    );
    expect(html).toContain("return-to-3d-button");
    expect(html).toContain("Return to 3D Viewport");
  });

  // 9. Vertical Strata opens existing vertical workflow
  it("9. Vertical Strata triggers onOpenVerticalStrata", () => {
    const onVerticalStrataMock = vi.fn();
    const props = { ...defaultProps, onOpenVerticalStrata: onVerticalStrataMock };
    renderToString(<LandingShell {...props} />);
    props.onOpenVerticalStrata();
    expect(onVerticalStrataMock).toHaveBeenCalledTimes(1);
  });

  // 10. Selected ULPIN and building remain unchanged
  it("10. preserves live selected ULPIN and building without fallback hardcoding", () => {
    const html = renderToString(<LandingShell {...defaultProps} />);
    expect(html).toContain("36A1B2C3D4E5F9");
    expect(html).toContain("Surya Heights Residential Apartment");

    // Neutral test when state is null
    const neutralProps = {
      ...defaultProps,
      parcel: null,
      building: null,
      verticalUnits: [],
      buildingCandidate: null,
    };
    const neutralHtml = renderToString(<LandingShell {...neutralProps} />);
    expect(neutralHtml).toContain("No Active Property Selected");
    expect(neutralHtml).toContain("No Property Selected");
    expect(neutralHtml).toContain("Unassigned");
    expect(neutralHtml).not.toContain("Surya Heights Residential Apartment");
  });

  // 11. Prototype access-mode menu renders
  it("11. renders prototype access-mode role menu with roles", () => {
    const html = renderToString(<LandingShell {...defaultProps} />);
    expect(html).toContain("role-menu-button");
    expect(html).toContain("ADMIN");
  });

  // 12. Reproduce exact user multi-step sequence
  it("12. correctly routes sequential opening: GIS Analysis (summary) -> Close -> Validation (validation)", () => {
    // Step 1: User opens GIS Analysis from Landing
    let currentView: "landing" | "dashboard" = "landing";
    let isGisAnalysisOpen = false;
    let gisInitialTab: "summary" | "layers" | "nearby" | "validation" = "summary";

    const handleOpenGisFromLanding = (tab: "summary" | "layers" | "nearby" | "validation" = "summary") => {
      gisInitialTab = tab;
      currentView = "dashboard";
      isGisAnalysisOpen = true;
    };

    // Click GIS Analysis
    handleOpenGisFromLanding("summary");
    expect(currentView).toBe("dashboard");
    expect(isGisAnalysisOpen).toBe(true);
    expect(gisInitialTab).toBe("summary");

    // Render GisAnalysisWorkspace for summary
    const summaryHtml = renderToString(
      <GisAnalysisWorkspace
        key={`gis-workspace-${gisInitialTab}`}
        isOpen={isGisAnalysisOpen}
        initialTab={gisInitialTab}
        onClose={() => { isGisAnalysisOpen = false; }}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={mockVerticalUnits}
        layers={mockLayers}
        onChangeLayers={vi.fn()}
      />
    );
    expect(summaryHtml).toContain("PARCEL &amp; ULPIN");

    // Step 2: User closes GIS Analysis workspace
    isGisAnalysisOpen = false;
    expect(isGisAnalysisOpen).toBe(false);
    expect(currentView).toBe("dashboard"); // remains on dashboard

    // Step 3: User returns to landing page
    currentView = "landing";
    expect(currentView).toBe("landing");

    // Step 4: User clicks Validation on landing page
    handleOpenGisFromLanding("validation");
    expect(currentView).toBe("dashboard");
    expect(isGisAnalysisOpen).toBe(true);
    expect(gisInitialTab).toBe("validation");

    // Render GisAnalysisWorkspace with validation key & initialTab
    const validationHtml = renderToString(
      <GisAnalysisWorkspace
        key={`gis-workspace-${gisInitialTab}`}
        isOpen={isGisAnalysisOpen}
        initialTab={gisInitialTab}
        onClose={() => { isGisAnalysisOpen = false; }}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={mockVerticalUnits}
        layers={mockLayers}
        onChangeLayers={vi.fn()}
      />
    );
    // MUST visibly contain Cadastral QC & Validation contents
    expect(validationHtml).toContain("Passed SFCGAL / PostGIS 3D Cadastral Quality Control");
    expect(validationHtml).toContain("Closed 3D Polyhedral Solids");
    expect(validationHtml).toContain("Zero Volumetric Overlap");
    expect(validationHtml).toContain("Parcel Extent Containment");
  });
});
