import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  NominatimLocationSearchProvider,
  CANONICAL_DEMO_PRESETS,
} from "../services/locationSearchProvider";

describe("Phase 3.11A: General Address Search & Geocoding Provider", () => {
  const provider = new NominatimLocationSearchProvider(1500);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles short or empty queries safely without triggering network calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const emptyResults = await provider.search("");
    expect(emptyResults).toEqual([]);

    const shortResults = await provider.search("a");
    expect(shortResults).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("performs live geocoding query and normalizes Nominatim responses", async () => {
    const mockNominatimResponse = [
      {
        place_id: 123456,
        osm_type: "way",
        osm_id: 982341201,
        lat: "17.468200",
        lon: "78.432100",
        display_name: "Lane 3, Road No. 4, Anjaneya Nagar, Moosapet, Hyderabad, Telangana, 500018, India",
        class: "highway",
        type: "residential",
        boundingbox: ["17.467", "17.469", "78.431", "78.433"],
        address: {
          road: "Lane 3",
          suburb: "Anjaneya Nagar",
          city: "Hyderabad",
          state: "Telangana",
        },
      },
      {
        place_id: 123457,
        osm_type: "node",
        osm_id: 982341202,
        lat: "17.469100",
        lon: "78.433200",
        display_name: "Moosapet Metro Station, Hyderabad, Telangana",
        class: "railway",
        type: "station",
        address: {
          suburb: "Moosapet",
          city: "Hyderabad",
          state: "Telangana",
        },
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNominatimResponse,
    } as any);

    const results = await provider.search("Lane 3 Road No 4 Anjaneya Nagar Moosapet");
    expect(results.length).toBe(2);

    const first = results[0];
    expect(first.displayName).toContain("Lane 3");
    expect(first.latitude).toBeCloseTo(17.4682, 4);
    expect(first.longitude).toBeCloseTo(78.4321, 4);
    expect(first.osmId).toBe("way/982341201");
    expect(first.shortAddress).toContain("Lane 3, Hyderabad, Telangana");
    expect(first.modelAvailable).toBe(false);
    expect(first.attribution).toBe("© OpenStreetMap contributors");
  });

  it("detects modelAvailable=true when geocoded location matches Surya Heights coordinates", async () => {
    const mockSuryaResponse = [
      {
        place_id: 999,
        osm_type: "way",
        osm_id: 356027047,
        lat: "17.464877",
        lon: "78.361956",
        display_name: "Surya Heights, Kondapur Main Road, Serilingampally, Hyderabad, Telangana, 500084, India",
        class: "building",
        type: "apartments",
        address: {
          building: "Surya Heights",
          road: "Kondapur Main Road",
          city: "Hyderabad",
          state: "Telangana",
        },
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuryaResponse,
    } as any);

    const results = await provider.search("Surya Heights Kondapur");
    expect(results.length).toBe(1);
    expect(results[0].modelAvailable).toBe(true);
    expect(results[0].buildingCode).toBe("APARTMENT-SURYA-OSM");
    expect(results[0].parcelId).toBe("36A1B2C3D4E5F9");
  });

  it("throws descriptive error when geocoding server returns HTTP failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as any);

    await expect(provider.search("Banjara Hills Hyderabad")).rejects.toThrow(
      "Geocoding server responded with status: 503"
    );
  });

  it("verifies canonical demo presets are available for quick access", () => {
    expect(CANONICAL_DEMO_PRESETS.length).toBe(5);
    const surya = CANONICAL_DEMO_PRESETS.find((p) => p.id === "preset-surya-heights");
    expect(surya?.modelAvailable).toBe(true);

    const moosapet = CANONICAL_DEMO_PRESETS.find((p) => p.id === "preset-moosapet");
    expect(moosapet?.modelAvailable).toBe(false);
  });
});

describe("Phase 3.15: ULPIN Direct Lookup & Main Search Bar Navigation", () => {
  it("verifies canonical ULPIN presets have valid 14-character alphanumeric formats", async () => {
    const { CANONICAL_ULPIN_PRESETS } = await import("../components/LocationSearchBar");
    expect(CANONICAL_ULPIN_PRESETS.length).toBeGreaterThanOrEqual(3);

    const ulpinRegex = /^[A-Z0-9]{14}$/;
    for (const preset of CANONICAL_ULPIN_PRESETS) {
      expect(preset.ulpin).toMatch(ulpinRegex);
      expect(preset.name).toBeTruthy();
      expect(preset.desc).toBeTruthy();
    }
  }, 15000);

  it("fetchParcelByUlpin calls /api/parcels/by-ulpin/{ulpin} and returns parcel", async () => {
    const { fetchParcelByUlpin } = await import("../api/cadastreApi");

    const mockParcel = {
      id: "parcel-surya-osm-uuid",
      ulpin_2d: "36A1B2C3D4E5F9",
      survey_number: "SY-101",
      district: "Hyderabad",
      state: "Telangana",
      area_sqm: 1250.0,
      geom_2d: { srid: 4326, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
      building_count: 1,
      vertical_unit_count: 22,
      created_at: new Date().toISOString(),
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockParcel,
    } as any);

    const result = await fetchParcelByUlpin("36a1b2c3d4e5f9");
    expect(result.ulpin_2d).toBe("36A1B2C3D4E5F9");
    expect(result.vertical_unit_count).toBe(22);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/parcels/by-ulpin/36A1B2C3D4E5F9");
  });

  it("fetchParcelByUlpin throws descriptive error on 404", async () => {
    const { fetchParcelByUlpin } = await import("../api/cadastreApi");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ detail: "Parcel not found" }),
    } as any);

    await expect(fetchParcelByUlpin("99ZZ99ZZ99ZZ99")).rejects.toThrow(
      "ULPIN not found in the project reference registry."
    );
  });

  it("fetchParcelByUlpin resolves real reference candidate ULPIN (36116079893D2B)", async () => {
    const { fetchParcelByUlpin } = await import("../api/cadastreApi");

    const mockNexiiParcel = {
      id: "parcel-nexii-osm-uuid",
      ulpin_2d: "36116079893D2B",
      survey_number: "SY-OSM-116079893 (Ref)",
      district: "Hyderabad",
      state: "Telangana",
      area_sqm: 8055.4,
      geom_2d: { srid: 32644, geometry_type: "Polygon", geojson: { type: "Polygon", coordinates: [] } },
      building_count: 1,
      vertical_unit_count: 17,
      created_at: new Date().toISOString(),
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockNexiiParcel,
    } as any);

    const result = await fetchParcelByUlpin("36116079893D2B");
    expect(result.ulpin_2d).toBe("36116079893D2B");
    expect(result.survey_number).toContain("SY-OSM-116079893");
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/parcels/by-ulpin/36116079893D2B");
  });

  it("fetchParcelByUlpin throws validation error on 422", async () => {
    const { fetchParcelByUlpin } = await import("../api/cadastreApi");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: async () => ({ detail: "Invalid ULPIN" }),
    } as any);

    await expect(fetchParcelByUlpin("INVALID")).rejects.toThrow(
      "ULPIN must be a valid 14-character alphanumeric identifier."
    );
  });
});

