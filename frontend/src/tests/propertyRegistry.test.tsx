import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { PropertyRegistryModal } from "../components/PropertyRegistryModal";
import { Header } from "../components/Header";
import { LocationSearchBar } from "../components/LocationSearchBar";
import type { Parcel, Building } from "../types/cadastre";

describe("Phase 2: 3D Property Registry / Property Explorer", () => {
  const mockParcelSurya: Parcel = {
    id: "parcel-surya-uuid",
    ulpin_2d: "36A1B2C3D4E5F9",
    survey_number: "124/2",
    district: "Hyderabad",
    state: "Telangana",
    village_code: "SERILINGAMPALLY",
    area_sqm: 1450.0,
    building_count: 1,
    vertical_unit_count: 22,
    geom_2d: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
    created_at: "2026-03-01T10:00:00Z",
  };

  const mockParcelNoSurvey: Parcel = {
    id: "parcel-nosurvey-uuid",
    ulpin_2d: "27A8B9C3D4E5F7",
    survey_number: "", // No survey number assigned
    district: "Mumbai",
    state: "Maharashtra",
    area_sqm: 850.0,
    building_count: 0,
    vertical_unit_count: 0,
    geom_2d: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
    created_at: "2026-03-05T12:00:00Z",
  };

  const mockBuildingSurya: Building = {
    id: "bldg-surya-uuid",
    parcel_id: "parcel-surya-uuid",
    building_code: "APARTMENT-SURYA-OSM",
    building_name: "Surya Heights",
    total_floors_above: 5,
    total_floors_below: 1,
    footprint_2d: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
    envelope_3d: {
      srid: 32644,
      geometry_type: "PolyhedralSurfaceZ",
      geojson: {
        type: "PolyhedralSurface",
        coordinates: [
          [[[221000, 1931000, 540], [221020, 1931000, 540], [221020, 1931020, 540], [221000, 1931000, 540]]],
          [[[221000, 1931000, 557], [221020, 1931000, 557], [221020, 1931020, 557], [221000, 1931000, 557]]],
        ],
      },
    },
    unit_count: 22,
    created_at: "2026-03-01T10:00:00Z",
  };

  const mockBuildingAI: Building = {
    id: "bldg-ai-uuid-12345",
    parcel_id: "parcel-surya-uuid",
    building_code: "BLDG-PROP-87654",
    building_name: "Proposed 3D Apartment (AI Reconstruction)",
    total_floors_above: 4,
    total_floors_below: 0,
    footprint_2d: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
    envelope_3d: {
      srid: 32644,
      geometry_type: "PolyhedralSurfaceZ",
      geojson: {
        type: "PolyhedralSurface",
        coordinates: [
          [[[221000, 1931000, 540], [221020, 1931000, 540], [221020, 1931020, 540], [221000, 1931000, 540]]],
          [[[221000, 1931000, 552.8], [221020, 1931000, 552.8], [221020, 1931020, 552.8], [221000, 1931000, 552.8]]],
        ],
      },
    },
    unit_count: 8,
    created_at: "2026-03-10T14:30:00Z",
  };

  it("1. Renders 3D Property Registry modal with title, subtitle, search input, and dynamic count", () => {
    const html = renderToString(
      <PropertyRegistryModal
        isOpen={true}
        onClose={vi.fn()}
        parcels={[mockParcelSurya]}
        selectedParcel={mockParcelSurya}
        onSelectParcel={vi.fn()}
        buildings={[mockBuildingSurya]}
        activeBuilding={mockBuildingSurya}
        onSelectBuilding={vi.fn()}
        onViewIn3D={vi.fn()}
        onOpenVerticalStrata={vi.fn()}
        onOpenGisAnalysis={vi.fn()}
      />
    );

    // Modal structure
    expect(html).toContain('data-testid="property-registry-modal"');
    expect(html).toContain("3D PROPERTY REGISTRY");
    expect(html).toContain("Search and inspect mapped 3D properties and their cadastral context.");
    // Search input
    expect(html).toContain('placeholder="Search properties, ULPIN, survey number..."');
    // Filter selectors
    expect(html).toContain('data-testid="registry-filter-status"');
    expect(html).toContain('data-testid="registry-filter-source"');
    expect(html).toContain('data-testid="registry-filter-type"');
    // Dynamic counter
    expect(html).toContain('data-testid="registry-property-counter"');
    expect(html).toContain("01 PROPERTIES");
  });

  it("2. Lists real canonical property with correct metadata fields (ULPIN, survey number, floors, source)", () => {
    const html = renderToString(
      <PropertyRegistryModal
        isOpen={true}
        onClose={vi.fn()}
        parcels={[mockParcelSurya]}
        selectedParcel={mockParcelSurya}
        onSelectParcel={vi.fn()}
        buildings={[mockBuildingSurya]}
        activeBuilding={mockBuildingSurya}
        onSelectBuilding={vi.fn()}
        onViewIn3D={vi.fn()}
        onOpenVerticalStrata={vi.fn()}
        onOpenGisAnalysis={vi.fn()}
      />
    );

    // Property Card
    expect(html).toContain('data-testid="registry-property-card-bldg-surya-uuid"');
    expect(html).toContain("SURYA HEIGHTS");
    expect(html).toContain("36A1B2C3D4E5F9");
    expect(html).toContain("124/2");
    expect(html).toContain("Hyderabad, Telangana");
    expect(html).toContain("6 Storeys");
    expect(html).toContain("REFERENCE");
    // Action buttons
    expect(html).toContain('data-testid="btn-open-property-bldg-surya-uuid"');
    expect(html).toContain('data-testid="btn-view-3d-bldg-surya-uuid"');
  });

  it("3. Never fabricates survey number when not present, displaying 'Not available'", () => {
    const html = renderToString(
      <PropertyRegistryModal
        isOpen={true}
        onClose={vi.fn()}
        parcels={[mockParcelNoSurvey]}
        selectedParcel={mockParcelNoSurvey}
        onSelectParcel={vi.fn()}
        buildings={[]}
        activeBuilding={null}
        onSelectBuilding={vi.fn()}
        onViewIn3D={vi.fn()}
        onOpenVerticalStrata={vi.fn()}
        onOpenGisAnalysis={vi.fn()}
      />
    );

    expect(html).toContain("27A8B9C3D4E5F7");
    expect(html).toContain("Not available");
  });

  it("4. AI-generated proposed building appears in registry with PROPOSED status and AI source", () => {
    const html = renderToString(
      <PropertyRegistryModal
        isOpen={true}
        onClose={vi.fn()}
        parcels={[mockParcelSurya]}
        selectedParcel={mockParcelSurya}
        onSelectParcel={vi.fn()}
        buildings={[mockBuildingSurya, mockBuildingAI]}
        activeBuilding={mockBuildingAI}
        onSelectBuilding={vi.fn()}
        onViewIn3D={vi.fn()}
        onOpenVerticalStrata={vi.fn()}
        onOpenGisAnalysis={vi.fn()}
      />
    );

    expect(html).toContain("PROPOSED 3D APARTMENT (AI RECONSTRUCTION)");
    expect(html).toContain("PROPOSED");
    expect(html).toContain("AI Image → 3D Reconstruction");
    expect(html).toContain("02 PROPERTIES");
  });

  it("5. Header navigation includes 3D Property Registry button", () => {
    const onOpenRegistry = vi.fn();
    const html = renderToString(
      <Header
        parcels={[mockParcelSurya]}
        selectedParcel={mockParcelSurya}
        onSelectParcel={vi.fn()}
        isConnected={true}
        onOpenPropertyRegistry={onOpenRegistry}
      />
    );

    expect(html).toContain('data-testid="nav-property-registry"');
    expect(html).toContain("3D Registry");
    expect(html).toContain('title="Open 3D Property Registry Explorer"');
  });

  it("6. Global Search dropdown includes shortcut to inspect property in registry", () => {
    const html = renderToString(
      <LocationSearchBar
        onSelectLocation={vi.fn()}
        parcels={[mockParcelSurya]}
        selectedParcel={mockParcelSurya}
        initialMode="ALL"
        onOpenPropertyRegistry={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="global-search-container"');
  });
});
