import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  OverpassBuildingDiscoveryProvider,
  HybridBuildingDiscoveryProvider,
  calculateDistanceMeters,
  calculatePolygonAreaSqm,
} from "../services/buildingDiscoveryProvider";
import type { LocationSearchResult } from "../types/cadastre";

describe("Phase 3.11C: Robust Building Discovery & Search-to-Building Matching", () => {
  let provider: OverpassBuildingDiscoveryProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    provider = new OverpassBuildingDiscoveryProvider(8000);
    provider.clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    provider.clearCache();
  });

  describe("Geometric Utility Functions", () => {
    it("calculates haversine distance between two coordinates accurately", () => {
      // Hyderabad center (17.3850, 78.4867) to Secunderabad (17.4399, 78.4983) is approx 6.2 km
      const distance = calculateDistanceMeters(17.385, 78.4867, 17.4399, 78.4983);
      expect(distance).toBeGreaterThan(6000);
      expect(distance).toBeLessThan(6500);

      // Same point distance is 0
      expect(calculateDistanceMeters(17.464877, 78.361956, 17.464877, 78.361956)).toBe(0);
    });

    it("calculates polygon area in square meters using spherical shoelace formula", () => {
      // A small bounding box ~10m x 10m around Hyderabad (approx 100 sqm)
      const coords: [number, number][] = [
        [78.3619, 17.4648],
        [78.3620, 17.4648],
        [78.3620, 17.4649],
        [78.3619, 17.4649],
        [78.3619, 17.4648],
      ];
      const area = calculatePolygonAreaSqm(coords);
      expect(area).toBeGreaterThan(90);
      expect(area).toBeLessThan(150);
    });

    it("returns 0 area for degraded polygons with fewer than 3 vertices", () => {
      expect(calculatePolygonAreaSqm([])).toBe(0);
      expect(calculatePolygonAreaSqm([[78.36, 17.46]])).toBe(0);
      expect(calculatePolygonAreaSqm([[78.36, 17.46], [78.37, 17.47]])).toBe(0);
    });
  });

  describe("Direct Building Result Detection (Phase 2)", () => {
    it("directly queries and returns exact building candidate when search result is an OSM building", async () => {
      const buildingSearchResult: LocationSearchResult = {
        id: "osm-way-356027047",
        displayName: "Surya Heights, Kondapur Main Rd, Hyderabad",
        shortAddress: "Kondapur, Hyderabad",
        latitude: 17.464877,
        longitude: 78.361956,
        osmId: "way/356027047",
        osmType: "way",
        category: "building",
        type: "apartments",
        modelAvailable: true,
        isReferenceBuilding: true,
        attribution: "© OpenStreetMap contributors",
      };

      const mockDirectOverpass = {
        version: 0.6,
        elements: [
          {
            type: "way",
            id: 356027047,
            geometry: [
              { lat: 17.464805, lon: 78.361905 },
              { lat: 17.464951, lon: 78.361895 },
              { lat: 17.464965, lon: 78.362114 },
              { lat: 17.464819, lon: 78.362124 },
              { lat: 17.464805, lon: 78.361905 },
            ],
            tags: {
              building: "apartments",
              name: "Surya Heights",
              "building:levels": "5",
            },
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockDirectOverpass,
      } as any);

      const candidates = await provider.discoverBuildings(
        buildingSearchResult.latitude,
        buildingSearchResult.longitude,
        buildingSearchResult
      );

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(candidates.length).toBe(1);
      expect(candidates[0].osmId).toBe("way/356027047");
      expect(candidates[0].isDirectMatch).toBe(true);
      expect(candidates[0].proximityTier).toBe("EXACT_OR_VERY_NEAR");
      expect(candidates[0].modelAvailable).toBe(true);
      expect(candidates[0].buildingCode).toBe("APARTMENT-SURYA-OSM");
    });
  });

  describe("Progressive Building Discovery (Phase 3)", () => {
    it("returns candidates from Tier 1 (180m) without expanding to 300m or 500m", async () => {
      const searchLat = 17.4682;
      const searchLon = 78.4321;

      const mock180Response = {
        version: 0.6,
        elements: [
          {
            type: "way",
            id: 2001,
            geometry: [
              { lat: 17.4683, lon: 78.4322 },
              { lat: 17.4684, lon: 78.4322 },
              { lat: 17.4684, lon: 78.4323 },
              { lat: 17.4683, lon: 78.4323 },
              { lat: 17.4683, lon: 78.4322 },
            ],
            tags: {
              building: "commercial",
              name: "Moosapet Plaza",
            },
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mock180Response,
      } as any);

      const candidates = await provider.discoverBuildings(searchLat, searchLon);

      // Only one network call made for 180m
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(candidates.length).toBe(1);
      expect(candidates[0].osmId).toBe("way/2001");
      expect(candidates[0].searchRadiusUsedMeters).toBe(180);
      expect(candidates[0].proximityTier).toBe("EXACT_OR_VERY_NEAR");
    });

    it("progressively expands from 180m (empty) to 300m when no buildings within 180m", async () => {
      const searchLat = 17.4474;
      const searchLon = 78.3762;

      const mockEmptyResponse = { version: 0.6, elements: [] };
      const mock300Response = {
        version: 0.6,
        elements: [
          {
            type: "way",
            id: 3001,
            geometry: [
              { lat: 17.4492, lon: 78.3775 },
              { lat: 17.4494, lon: 78.3775 },
              { lat: 17.4494, lon: 78.3778 },
              { lat: 17.4492, lon: 78.3778 },
              { lat: 17.4492, lon: 78.3775 },
            ],
            tags: {
              building: "office",
              name: "Cyber Pearl",
            },
          },
        ],
      };

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEmptyResponse,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mock300Response,
        } as any);

      const candidates = await provider.discoverBuildings(searchLat, searchLon);

      // Two calls made: 180m (empty) -> 300m (found)
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(candidates.length).toBe(1);
      expect(candidates[0].osmId).toBe("way/3001");
      expect(candidates[0].name).toBe("Cyber Pearl");
      expect(candidates[0].searchRadiusUsedMeters).toBe(300);
    });

    it("progressively expands from 180m and 300m (both empty) to 500m", async () => {
      const searchLat = 17.3616;
      const searchLon = 78.4747;

      const mockEmptyResponse = { version: 0.6, elements: [] };
      const mock500Response = {
        version: 0.6,
        elements: [
          {
            type: "way",
            id: 4001,
            geometry: [
              { lat: 17.3645, lon: 78.4772 },
              { lat: 17.3648, lon: 78.4772 },
              { lat: 17.3648, lon: 78.4776 },
              { lat: 17.3645, lon: 78.4776 },
              { lat: 17.3645, lon: 78.4772 },
            ],
            tags: {
              building: "historic",
              name: "Mecca Masjid Heritage Annex",
            },
          },
        ],
      };

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEmptyResponse,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEmptyResponse,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mock500Response,
        } as any);

      const candidates = await provider.discoverBuildings(searchLat, searchLon);

      // Three calls made: 180m -> 300m -> 500m
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(candidates.length).toBe(1);
      expect(candidates[0].osmId).toBe("way/4001");
      expect(candidates[0].searchRadiusUsedMeters).toBe(500);
      expect(candidates[0].proximityTier).toBe("NEARBY");
    });

    it("returns clean empty array when 180m, 300m, and 500m all yield no mapped buildings", async () => {
      const searchLat = 15.0000;
      const searchLon = 75.0000;

      const mockEmptyResponse = { version: 0.6, elements: [] };

      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEmptyResponse,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEmptyResponse,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEmptyResponse,
        } as any);

      const candidates = await provider.discoverBuildings(searchLat, searchLon);
      expect(candidates).toEqual([]);
    });
  });

  describe("Candidate Ranking & Proximity Tiering (Phase 4)", () => {
    it("ranks direct building match first, followed by proximity and named status", async () => {
      const searchLat = 17.4682;
      const searchLon = 78.4321;

      const mockOverpassResponse = {
        version: 0.6,
        elements: [
          {
            type: "way",
            id: 1001,
            geometry: [
              { lat: 17.4685, lon: 78.4323 },
              { lat: 17.4687, lon: 78.4323 },
              { lat: 17.4687, lon: 78.4325 },
              { lat: 17.4685, lon: 78.4325 },
              { lat: 17.4685, lon: 78.4323 },
            ],
            tags: {
              building: "apartments",
              name: "Anjaneya Residency",
              "building:levels": "4",
            },
          },
          {
            type: "way",
            id: 1002,
            geometry: [
              { lat: 17.46822, lon: 78.43212 }, // ~5m from search point
              { lat: 17.46832, lon: 78.43212 },
              { lat: 17.46832, lon: 78.43222 },
              { lat: 17.46822, lon: 78.43222 },
              { lat: 17.46822, lon: 78.43212 },
            ],
            tags: {
              building: "residential",
            },
          },
        ],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockOverpassResponse,
      } as any);

      const candidates = await provider.discoverBuildings(searchLat, searchLon);

      expect(candidates.length).toBe(2);
      // Closer building (1002) is ~5m away -> EXACT_OR_VERY_NEAR tier
      expect(candidates[0].osmId).toBe("way/1002");
      expect(candidates[0].distanceMeters).toBeLessThan(20);
      expect(candidates[0].proximityTier).toBe("EXACT_OR_VERY_NEAR");

      // Farther building (1001) is ~45m away -> NEARBY tier
      expect(candidates[1].osmId).toBe("way/1001");
      expect(candidates[1].distanceMeters).toBeGreaterThan(30);
      expect(candidates[1].proximityTier).toBe("NEARBY");
    });
  });

  describe("In-Memory Caching (Phase 10)", () => {
    it("caches results and does not make duplicate network requests for same coordinates", async () => {
      const searchLat = 17.4682;
      const searchLon = 78.4321;

      const mockResponse = {
        version: 0.6,
        elements: [
          {
            type: "way",
            id: 9999,
            geometry: [
              { lat: 17.4683, lon: 78.4322 },
              { lat: 17.4684, lon: 78.4322 },
              { lat: 17.4684, lon: 78.4323 },
              { lat: 17.4683, lon: 78.4323 },
              { lat: 17.4683, lon: 78.4322 },
            ],
            tags: { building: "yes" },
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any);

      // First call -> network hit
      const firstResult = await provider.discoverBuildings(searchLat, searchLon);
      expect(firstResult.length).toBe(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call for exact same coords -> served from cache
      const secondResult = await provider.discoverBuildings(searchLat, searchLon);
      expect(secondResult.length).toBe(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Call count remains 1!
    });
  });

  describe("Error Handling & Input Validation", () => {
    it("rejects invalid or NaN coordinates cleanly", async () => {
      const results = await provider.discoverBuildings(NaN, 78.36);
      expect(results).toEqual([]);

      const outOfBounds = await provider.discoverBuildings(95, 200);
      expect(outOfBounds).toEqual([]);
    });

    it("handles Overpass network failure gracefully without crashing", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 429,
      } as any);

      await expect(provider.discoverBuildings(17.4682, 78.4321)).rejects.toThrow(
        "Overpass API returned status: 429"
      );
    });

    it("does not treat commercial place search results as direct buildings and falls back to progressive search", async () => {
      const placeSearchResult: LocationSearchResult = {
        id: "preset-hitec-city",
        displayName: "HITEC City, Madhapur, Hyderabad, Telangana",
        shortAddress: "Cyber Towers, HITEC City, Hyderabad",
        latitude: 17.447400,
        longitude: 78.376200,
        osmId: "way/245812901",
        osmType: "way",
        category: "place",
        type: "commercial",
        modelAvailable: false,
        isReferenceBuilding: false,
        attribution: "© OpenStreetMap contributors",
      };

      const mockBuildingResponse = {
        version: 0.6,
        elements: [
          {
            type: "way",
            id: 89914109,
            geometry: [
              { lat: 17.4475, lon: 78.3763 },
              { lat: 17.4477, lon: 78.3763 },
              { lat: 17.4477, lon: 78.3765 },
              { lat: 17.4475, lon: 78.3765 },
              { lat: 17.4475, lon: 78.3763 },
            ],
            tags: {
              building: "commercial",
              name: "HSBC",
            },
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockBuildingResponse,
      } as any);

      const candidates = await provider.discoverBuildings(
        placeSearchResult.latitude,
        placeSearchResult.longitude,
        placeSearchResult
      );

      // fetch should be called for progressive search, NOT direct query for way(245812901)
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(candidates.length).toBe(1);
      expect(candidates[0].osmId).toBe("way/89914109");
      expect(candidates[0].name).toBe("HSBC");
      expect(provider.getLastDiagnostic()?.status).toBe("SUCCESS");
    });

    it("falls back to secondary Overpass endpoint when primary endpoint returns 504 Gateway Timeout", async () => {
      const searchLat = 17.4474;
      const searchLon = 78.3762;

      const mockSuccessResponse = {
        version: 0.6,
        elements: [
          {
            type: "way",
            id: 89914117,
            geometry: [
              { lat: 17.4476, lon: 78.3764 },
              { lat: 17.4478, lon: 78.3764 },
              { lat: 17.4478, lon: 78.3766 },
              { lat: 17.4476, lon: 78.3766 },
              { lat: 17.4476, lon: 78.3764 },
            ],
            tags: {
              building: "office",
              name: "Motorola",
            },
          },
        ],
      };

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce({
          ok: false,
          status: 504,
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockSuccessResponse,
        } as any);

      const candidates = await provider.discoverBuildings(searchLat, searchLon);

      // First endpoint (504) -> fell back to second endpoint (200)
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(candidates.length).toBe(1);
      expect(candidates[0].name).toBe("Motorola");
      expect(candidates[0].osmId).toBe("way/89914117");
      expect(provider.getLastDiagnostic()?.status).toBe("SUCCESS");
    });
  });

  describe("Phase 3.12B: Hybrid Reference + Overpass Discovery Provider", () => {
    it("prioritizes local real reference Hyderabad building candidates over external Overpass", async () => {
      const mockReferenceBuildings = [
        {
          id: "real-ref-116079893",
          osmId: "116079893",
          osmType: "way",
          source: "REAL_REFERENCE",
          name: "Nexiilabs",
          buildingType: "commercial",
          levels: 4,
          groundElevationM: 575.5,
          centroid: { latitude: 17.446708, longitude: 78.376556 },
          footprintCoordinates: [[78.375988, 17.446465], [78.376377, 17.446412], [78.375988, 17.446465]],
          approxAreaSqm: 1450,
          distanceMeters: 85.5,
          modelAvailable: false,
          isReferenceBuilding: true,
          attribution: "© OpenStreetMap contributors | Real Hyderabad Reference Dataset",
        },
      ];

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockReferenceBuildings,
      } as any);

      const hybridProvider = new HybridBuildingDiscoveryProvider();
      const results = await hybridProvider.discoverBuildings(17.4474, 78.3762);

      // Successfully discovered from local reference endpoint without calling Overpass
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("Nexiilabs");
      expect(results[0].source).toBe("REAL_REFERENCE");
      expect(results[0].groundElevationM).toBe(575.5);
      expect(hybridProvider.getLastDiagnostic()?.status).toBe("SUCCESS");
    });

    it("falls back to Overpass when local reference dataset returns no candidates for location", async () => {
      const mockOverpassResponse = {
        version: 0.6,
        elements: [
          {
            type: "way",
            id: 89914109,
            nodes: [1, 2, 3, 1],
            geometry: [
              { lat: 17.4474, lon: 78.3762 },
              { lat: 17.4476, lon: 78.3762 },
              { lat: 17.4476, lon: 78.3764 },
              { lat: 17.4474, lon: 78.3762 },
            ],
            tags: { building: "commercial", name: "HSBC" },
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch")
        // 1st call: reference dataset returns empty []
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        } as any)
        // 2nd call: Overpass returns element
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockOverpassResponse,
        } as any);

      const hybridProvider = new HybridBuildingDiscoveryProvider();
      const results = await hybridProvider.discoverBuildings(17.4474, 78.3762);

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(results.length).toBe(1);
      expect(results[0].name).toBe("HSBC");
    });
  });
});
