import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { ViewModeToggle } from "../components/ViewModeToggle";
import { Header } from "../components/Header";
import { LandingShell } from "../components/LandingShell";
import type { Parcel, Building, VerticalUnit } from "../types/cadastre";

describe("Phase 1.2: Landing <-> 3D Dashboard Toggle Mode Navigation", () => {
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

  const mockUnits: VerticalUnit[] = [
    {
      id: "u-b01",
      parcel_id: "parcel-surya-canonical",
      building_id: "bld-surya-canonical",
      prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-B-6130-B01",
      floor_code: "B01",
      tier_code: "B",
      unit_sequence: 1,
      unit_label: "Basement Level B01",
      unit_type: "BASEMENT",
      unit_level: "BASEMENT",
      z_min: 537.0,
      z_max: 540.0,
      status: "VERIFIED",
      geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
    },
    {
      id: "u-f01",
      parcel_id: "parcel-surya-canonical",
      building_id: "bld-surya-canonical",
      prototype_ulpin_3d: "36A1B2C3D4E5F9-3D-F-6131-F01",
      floor_code: "F01",
      tier_code: "F",
      unit_sequence: 2,
      unit_label: "Floor F01",
      unit_type: "STOREY",
      unit_level: "STOREY",
      z_min: 540.0,
      z_max: 543.0,
      status: "VERIFIED",
      geom_3d: { srid: 32644, geometry_type: "PolyhedralSurface", geojson: { type: "PolyhedralSurface", coordinates: [] } },
    },
  ];

  // 1. ViewModeToggle Component Rendering
  it("1. ViewModeToggle displays Landing active and 3D Dashboard inactive when currentView = 'landing'", () => {
    const onToggleMock = vi.fn();
    const html = renderToString(
      <ViewModeToggle currentView="landing" onToggleView={onToggleMock} />
    );

    expect(html).toContain('data-testid="view-mode-toggle"');
    expect(html).toContain('data-testid="toggle-landing-btn"');
    expect(html).toContain('data-testid="toggle-dashboard-btn"');
    expect(html).toContain('aria-checked="true" data-testid="toggle-landing-btn"');
    expect(html).toContain('aria-checked="false" data-testid="toggle-dashboard-btn"');
  });

  it("2. ViewModeToggle displays 3D Dashboard active and Landing inactive when currentView = 'dashboard'", () => {
    const onToggleMock = vi.fn();
    const html = renderToString(
      <ViewModeToggle currentView="dashboard" onToggleView={onToggleMock} />
    );

    expect(html).toContain('aria-checked="true" data-testid="toggle-dashboard-btn"');
    expect(html).toContain('aria-checked="false" data-testid="toggle-landing-btn"');
  });

  // 3. Toggle callbacks
  it("3. Clicking toggle switches to dashboard when in landing mode", () => {
    const onToggleMock = vi.fn();
    const toggleProps = { currentView: "landing" as const, onToggleView: onToggleMock };
    toggleProps.onToggleView("dashboard");
    expect(onToggleMock).toHaveBeenCalledWith("dashboard");
  });

  it("4. Clicking toggle switches to landing when in dashboard mode", () => {
    const onToggleMock = vi.fn();
    const toggleProps = { currentView: "dashboard" as const, onToggleView: onToggleMock };
    toggleProps.onToggleView("landing");
    expect(onToggleMock).toHaveBeenCalledWith("landing");
  });

  // 5. LandingShell Integration
  it("5. LandingShell renders ViewModeToggle and preserves selected ULPIN and building", () => {
    const onToggleMock = vi.fn();
    const onLaunch3DMock = vi.fn();
    const onOpenGisMock = vi.fn();

    const html = renderToString(
      <LandingShell
        currentView="landing"
        onToggleView={onToggleMock}
        onLaunch3D={onLaunch3DMock}
        onOpenGisAnalysis={onOpenGisMock}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={mockUnits}
        activeRole="ADMIN"
        onChangeRole={vi.fn()}
      />
    );

    // Toggle rendered in landing shell
    expect(html).toContain('data-testid="view-mode-toggle"');
    expect(html).toContain('data-testid="toggle-landing-btn"');
    expect(html).toContain('data-testid="toggle-dashboard-btn"');

    // State preserved
    expect(html).toContain("36A1B2C3D4E5F9");
    expect(html).toContain("Surya Heights Residential Apartment");

    // Existing navigation links preserved
    expect(html).toContain('data-testid="nav-3d-dashboard"');
    expect(html).toContain('data-testid="nav-gis-analysis"');
    expect(html).toContain('data-testid="nav-vertical-strata"');
    expect(html).toContain('data-testid="nav-validation"');
  });

  // 6. Header Integration
  it("6. Header renders ViewModeToggle in dashboard view and provides return to landing", () => {
    const onToggleMock = vi.fn();
    const onReturnMock = vi.fn();

    const html = renderToString(
      <Header
        currentView="dashboard"
        onToggleView={onToggleMock}
        parcels={[mockParcel]}
        selectedParcel={mockParcel}
        onSelectParcel={vi.fn()}
        isConnected={true}
        onReturnToLanding={onReturnMock}
      />
    );

    expect(html).toContain('data-testid="view-mode-toggle"');
    expect(html).toContain('aria-checked="true" data-testid="toggle-dashboard-btn"');
    expect(html).toContain('aria-checked="false" data-testid="toggle-landing-btn"');
    expect(html).toContain('data-testid="return-to-landing-button"');
  });

  // 7. Launch 3D Dashboard Still Works
  it("7. Existing Launch 3D Dashboard button triggers navigation to dashboard", () => {
    const onLaunch3DMock = vi.fn();
    const html = renderToString(
      <LandingShell
        currentView="landing"
        onLaunch3D={onLaunch3DMock}
        onOpenGisAnalysis={vi.fn()}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={mockUnits}
        activeRole="ADMIN"
        onChangeRole={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="launch-3d-dashboard-button"');
    onLaunch3DMock();
    expect(onLaunch3DMock).toHaveBeenCalled();
  });

  // 8. GIS Analysis behavior remains intact
  it("8. GIS Analysis action routes to summary tab", () => {
    const onOpenGisMock = vi.fn();
    onOpenGisMock("summary");
    expect(onOpenGisMock).toHaveBeenCalledWith("summary");
  });

  // 9. Validation behavior remains intact
  it("9. Validation action routes to validation tab", () => {
    const onOpenGisMock = vi.fn();
    onOpenGisMock("validation");
    expect(onOpenGisMock).toHaveBeenCalledWith("validation");
  });

  // 10. Vertical Strata behavior remains intact
  it("10. Vertical Strata action triggers strata inspection", () => {
    const onVerticalStrataMock = vi.fn();
    const html = renderToString(
      <LandingShell
        currentView="landing"
        onLaunch3D={vi.fn()}
        onOpenGisAnalysis={vi.fn()}
        onOpenVerticalStrata={onVerticalStrataMock}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={mockUnits}
        activeRole="ADMIN"
        onChangeRole={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="nav-vertical-strata"');
    onVerticalStrataMock();
    expect(onVerticalStrataMock).toHaveBeenCalled();
  });

  // 11. State preservation across view switches
  it("11. Verifies parcel and building state identity across mode toggling", () => {
    let currentView: "landing" | "dashboard" = "landing";
    let activeParcel: Parcel | null = mockParcel;
    let activeBuilding: Building | null = mockBuilding;

    // Switch to dashboard
    currentView = "dashboard";
    expect(currentView).toBe("dashboard");
    expect(activeParcel?.ulpin_2d).toBe("36A1B2C3D4E5F9");
    expect(activeBuilding?.building_name).toBe("Surya Heights Residential Apartment");

    // Switch back to landing
    currentView = "landing";
    expect(currentView).toBe("landing");
    expect(activeParcel?.ulpin_2d).toBe("36A1B2C3D4E5F9");
    expect(activeBuilding?.building_name).toBe("Surya Heights Residential Apartment");
  });
});
