import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { AIBuildingReconstructionWorkspace } from "../components/AIBuildingReconstructionWorkspace";
import { Header } from "../components/Header";
import { LandingShell } from "../components/LandingShell";
import type { Parcel, Building } from "../types/cadastre";

describe("Phase 2: AI-Assisted Building Image -> 3D Reconstruction Frontend Test Suite", () => {
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

  // 1. Workspace does not render when isOpen is false
  it("1. Does not render workspace modal when isOpen is false", () => {
    const html = renderToString(
      <AIBuildingReconstructionWorkspace
        isOpen={false}
        onClose={vi.fn()}
      />
    );
    expect(html).toBe("");
  });

  // 2. Workspace renders header and input controls when isOpen is true
  it("2. Renders workspace modal container, header, and upload controls when isOpen is true", () => {
    const html = renderToString(
      <AIBuildingReconstructionWorkspace
        isOpen={true}
        onClose={vi.fn()}
        parcel={mockParcel}
        building={mockBuilding}
      />
    );

    expect(html).toContain('data-testid="ai-building-reconstruction-workspace"');
    expect(html).toContain("AI-ASSISTED BUILDING IMAGE → 3D RECONSTRUCTION");
    expect(html).toContain("PROPOSED CADASTRE");
    expect(html).toContain('data-testid="mode-multiview"');
    expect(html).toContain('data-testid="mode-singleimage"');
    expect(html).toContain('data-testid="btn-load-demo-photos"');
    expect(html).toContain('data-testid="btn-run-reconstruction"');
  });

  // 3. Multi-View Mode contains Front, Side, and Top view upload slots
  it("3. Multi-view mode contains Front, Side, and Top view slots", () => {
    const html = renderToString(
      <AIBuildingReconstructionWorkspace
        isOpen={true}
        onClose={vi.fn()}
        parcel={mockParcel}
      />
    );

    expect(html).toContain("Front View (Elevation &amp; Storeys)");
    expect(html).toContain("Side View (Depth &amp; Setback)");
    expect(html).toContain("Top / Aerial View (2D Footprint)");
  });

  // 4. Priors and Anchoring inputs render with target parcel anchor
  it("4. Displays architectural priors form and active parcel anchor", () => {
    const html = renderToString(
      <AIBuildingReconstructionWorkspace
        isOpen={true}
        onClose={vi.fn()}
        parcel={mockParcel}
      />
    );

    expect(html).toContain("Floor Height Prior (m)");
    expect(html).toContain("Expect Basement");
    expect(html).toContain("Proposed Building Name");
    expect(html).toContain("ANCHOR: 36A1B2C3D4E5F9");
  });

  // 5. Header navigation includes AI Image -> 3D button
  it("5. 3D Dashboard Header renders AI Image -> 3D navigation button", () => {
    const onOpenAiMock = vi.fn();
    const html = renderToString(
      <Header
        currentView="dashboard"
        parcels={[mockParcel]}
        selectedParcel={mockParcel}
        onSelectParcel={vi.fn()}
        isConnected={true}
        onOpenAiReconstruction={onOpenAiMock}
      />
    );

    expect(html).toContain('data-testid="nav-ai-reconstruction"');
    expect(html).toContain("AI Image → 3D");
  });

  // 6. LandingShell navigation includes AI Image -> 3D button
  it("6. LandingShell renders AI Image -> 3D navigation button", () => {
    const onOpenAiMock = vi.fn();
    const html = renderToString(
      <LandingShell
        currentView="landing"
        onToggleView={vi.fn()}
        onLaunch3D={vi.fn()}
        onOpenGisAnalysis={vi.fn()}
        parcel={mockParcel}
        building={mockBuilding}
        verticalUnits={[]}
        activeRole="ADMIN"
        onChangeRole={vi.fn()}
        onOpenAiReconstruction={onOpenAiMock}
      />
    );

    expect(html).toContain('data-testid="nav-ai-reconstruction"');
    expect(html).toContain("AI Image → 3D");
  });

  // 7. Workspace renders 6-stage workflow pipeline bar
  it("7. Workspace renders 6-stage visual workflow pipeline bar", () => {
    const html = renderToString(
      <AIBuildingReconstructionWorkspace
        isOpen={true}
        onClose={vi.fn()}
        onViewIn3D={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="ai-workflow-pipeline-bar"');
    expect(html).toContain("IMAGE EVIDENCE");
    expect(html).toContain("3D RECONSTRUCTION");
    expect(html).toContain("HUMAN REVIEW");
  });

  // 8. Initializes with canonical low-rise residential priors (3.5m floor height, no basement default)
  it("8. Initializes with canonical low-rise residential priors (3.5m floor height, no basement default)", () => {
    const html = renderToString(
      <AIBuildingReconstructionWorkspace
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('value="3.5"');
    expect(html).toContain('value="Proposed Modern Residential Building"');
    expect(html).not.toContain('Surya Heights West Extension');
  });
});

