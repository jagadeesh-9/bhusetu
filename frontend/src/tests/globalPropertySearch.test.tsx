import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToString } from "react-dom/server";
import { LocationSearchBar, CANONICAL_ULPIN_PRESETS } from "../components/LocationSearchBar";
import { Header } from "../components/Header";
import type { Parcel } from "../types/cadastre";

describe("Phase 1: Professional Global Property Search", () => {
  const mockParcel1: Parcel = {
    id: "parcel-surya-uuid",
    ulpin_2d: "36A1B2C3D4E5F9",
    survey_number: "SY-101",
    district: "Ranga Reddy",
    state: "Telangana",
    area_sqm: 1450.0,
    building_count: 1,
    vertical_unit_count: 22,
    geom_2d: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
    created_at: new Date().toISOString(),
  };

  const mockParcel2: Parcel = {
    id: "parcel-nexii-uuid",
    ulpin_2d: "36116079893D2B",
    survey_number: "SY-OSM-116079893",
    district: "Hyderabad",
    state: "Telangana",
    area_sqm: 8055.4,
    building_count: 1,
    vertical_unit_count: 17,
    geom_2d: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
    created_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Structure & Placeholder
  it("1. Renders compact GIS search input with exact placeholder and all 6 modes", () => {
    const html = renderToString(
      <LocationSearchBar
        onSelectLocation={vi.fn()}
        parcels={[mockParcel1, mockParcel2]}
        selectedParcel={mockParcel1}
        initialMode="ALL"
      />
    );

    // Placeholder
    expect(html).toContain('placeholder="Search ULPIN, survey number, property or address..."');
    // Mode selector test ID
    expect(html).toContain('data-testid="search-mode-select"');
    // Global search input
    expect(html).toContain('data-testid="global-property-search"');
    // All 6 required modes
    expect(html).toContain('value="ALL"');
    expect(html).toContain('Search All');
    expect(html).toContain('value="ULPIN"');
    expect(html).toContain('ULPIN');
    expect(html).toContain('value="SURVEY_NO"');
    expect(html).toContain('Survey Number');
    expect(html).toContain('value="PROPERTY_ID"');
    expect(html).toContain('Property / Building ID');
    expect(html).toContain('value="ADDRESS"');
    expect(html).toContain('Address');
    expect(html).toContain('value="LOCATION"');
    expect(html).toContain('Location');
  });

  // 2. Empty Input: Results & Permanent UI Clutter Verification
  it("2. Does NOT display results or permanent preset cards when input is empty", () => {
    const html = renderToString(
      <LocationSearchBar
        onSelectLocation={vi.fn()}
        parcels={[mockParcel1, mockParcel2]}
        selectedParcel={mockParcel1}
        initialMode="ALL"
      />
    );

    // Results dropdown must not render
    expect(html).not.toContain('data-testid="search-results-dropdown"');
    // No permanent Surya Heights preset text or Quick ULPIN Presets list clutter
    expect(html).not.toContain("Quick ULPIN / Bhu-Aadhaar Presets:");
    expect(html).not.toContain("Quick Location Presets:");
    expect(html).not.toContain("Surya Heights (Canonical OSM Anchor)");
  });

  // 3. Header Integration & Cleanup
  it("3. Header embeds compact search and removes duplicate permanent parcel dropdown", () => {
    const onSelectParcelMock = vi.fn();
    const onSearchUlpinMock = vi.fn();

    const html = renderToString(
      <Header
        currentView="dashboard"
        parcels={[mockParcel1, mockParcel2]}
        selectedParcel={mockParcel1}
        onSelectParcel={onSelectParcelMock}
        onSearchUlpin={onSearchUlpinMock}
        onSelectLocation={vi.fn()}
        isConnected={true}
        showSearch={true}
      />
    );

    // Embedded GIS search container is present when showSearch is enabled
    expect(html).toContain('data-testid="global-search-container"');
    expect(html).toContain('data-testid="search-mode-select"');
    expect(html).toContain('data-testid="global-property-search"');

    // Duplicate visible parcel dropdown is removed from the visible UI
    expect(html).not.toContain('class="parcel-selector-container"');
    expect(html).not.toContain('class="parcel-select"');
  });

  it("3b. Header removes top search bar by default to prevent duplicate search bars", () => {
    const html = renderToString(
      <Header
        currentView="dashboard"
        parcels={[mockParcel1]}
        selectedParcel={mockParcel1}
        onSelectParcel={vi.fn()}
        isConnected={true}
      />
    );
    expect(html).not.toContain('data-testid="global-search-container"');
  });

  // 4. Preserved Navigation & Tools
  it("4. Top navigation preserves 3D Dashboard, GIS Analysis, Vertical Strata, Validation, AI Image and Drone Survey", () => {
    const html = renderToString(
      <Header
        currentView="dashboard"
        parcels={[mockParcel1]}
        selectedParcel={mockParcel1}
        onSelectParcel={vi.fn()}
        isConnected={true}
      />
    );

    expect(html).toContain('data-testid="nav-3d-dashboard"');
    expect(html).toContain('data-testid="nav-gis-analysis"');
    expect(html).toContain('data-testid="nav-vertical-strata"');
    expect(html).toContain('data-testid="nav-validation"');
    expect(html).toContain('data-testid="nav-ai-reconstruction"');
    expect(html).toContain('data-testid="nav-drone-survey"');
  });

  // 5. Canonical Presets Preserved in Data Layer
  it("5. Verifies CANONICAL_ULPIN_PRESETS is preserved for data resolution without leaking UI clutter", () => {
    expect(CANONICAL_ULPIN_PRESETS.length).toBeGreaterThanOrEqual(4);
    const surya = CANONICAL_ULPIN_PRESETS.find((p) => p.ulpin === "36A1B2C3D4E5F9");
    expect(surya).toBeDefined();
    expect(surya?.name).toContain("Surya Heights");

    const nexii = CANONICAL_ULPIN_PRESETS.find((p) => p.ulpin === "36116079893D2B");
    expect(nexii).toBeDefined();
    expect(nexii?.name).toContain("Nexiilabs");
  });

  // 6. Active Property Synchronization
  it("6. Live ULPIN pill in header continues to reflect the selected property state", () => {
    const html = renderToString(
      <Header
        currentView="dashboard"
        parcels={[mockParcel2]}
        selectedParcel={mockParcel2}
        onSelectParcel={vi.fn()}
        isConnected={true}
      />
    );

    expect(html).toContain('data-testid="live-ulpin-pill"');
    expect(html).toContain("36116079893D2B");
  });

  // 7. Floating Map Search Overlay Verification
  it("7. Global Property Search mounts as a floating GIS overlay inside the map viewport", () => {
    const html = renderToString(
      <div className="map-search-overlay" data-testid="map-search-overlay">
        <LocationSearchBar
          onSelectLocation={vi.fn()}
          onClearLocation={vi.fn()}
          onSearchUlpin={vi.fn()}
          onSelectParcel={vi.fn()}
          parcels={[mockParcel1, mockParcel2]}
          selectedParcel={mockParcel1}
          initialMode="ALL"
        />
      </div>
    );

    expect(html).toContain('data-testid="map-search-overlay"');
    expect(html).toContain('class="map-search-overlay"');
    expect(html).toContain('data-testid="global-search-container"');
    expect(html).toContain('data-testid="search-mode-select"');
    expect(html).toContain('data-testid="global-property-search"');
  });
});
