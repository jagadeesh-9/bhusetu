/**
 * Phase 3.11C: Robust Building Discovery Provider
 * Identifies and normalizes OpenStreetMap building footprint candidates
 * using direct building detection, progressive radius expansion (180m -> 300m -> 500m),
 * candidate proximity tiering, and in-memory caching.
 */
import type { BuildingCandidate, LocationSearchResult } from "../types/cadastre";
import { fetchReferenceBuildingCandidates } from "../api/cadastreApi";

export interface IBuildingDiscoveryProvider {
  discoverBuildings(
    latitude: number,
    longitude: number,
    searchContext?: LocationSearchResult | null,
    radiusMeters?: number
  ): Promise<BuildingCandidate[]>;
}

// Canonical OSM Way 356027047 geometry in EPSG:4326 WGS84 for Surya Heights demo fallback
const CANONICAL_SURYA_WGS84_FOOTPRINT: [number, number][] = [
  [78.361905, 17.464805],
  [78.361895, 17.464951],
  [78.362114, 17.464965],
  [78.362124, 17.464819],
  [78.361905, 17.464805],
];

// Canonical HITECH City reference landmarks (EPSG:4326 WGS84) for offline demo resilience
const CANONICAL_NEXIILABS_WGS84_FOOTPRINT: [number, number][] = [
  [78.3759887, 17.4464655], [78.3760151, 17.4465361], [78.3763771, 17.4464129],
  [78.3763734, 17.446379], [78.3764159, 17.4463462], [78.3764909, 17.4463376],
  [78.3765243, 17.4463652], [78.3768861, 17.4462536], [78.3768612, 17.44618],
  [78.3768989, 17.4461683], [78.3771659, 17.4469563], [78.3771021, 17.446976],
  [78.3770714, 17.4468853], [78.3767398, 17.4469876], [78.3767089, 17.4470318],
  [78.3766493, 17.4470529], [78.3765765, 17.4470466], [78.3762339, 17.447161],
  [78.3762609, 17.4472346], [78.376196, 17.4472562], [78.3760817, 17.4469448],
  [78.37615, 17.4469219], [78.3760814, 17.4467351], [78.3760444, 17.4467474],
  [78.3759409, 17.4464655], [78.3759887, 17.4464655]
];

const CANONICAL_DELOITTE_WGS84_FOOTPRINT: [number, number][] = [
  [78.3757458, 17.4485086], [78.376144, 17.4483923], [78.3760036, 17.4479546],
  [78.3759136, 17.4479809], [78.3758879, 17.4479008], [78.3757825, 17.4479315],
  [78.3758122, 17.4480242], [78.3757181, 17.4480516], [78.3756095, 17.4480833],
  [78.3757458, 17.4485086]
];

/**
 * Calculates haversine distance in meters between two lat/lon coordinates.
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Calculates planar geodesic area of a polygon in square meters using local projection.
 */
export function calculatePolygonAreaSqm(
  coords: [number, number][],
  centerLat?: number
): number {
  if (!coords || coords.length < 3) return 0;
  const lat = centerLat !== undefined ? centerLat : coords[0][1];
  if (isNaN(lat)) return 0;

  const latToMeters = 111320;
  const lonToMeters = 111320 * Math.cos((lat * Math.PI) / 180);

  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const x1 = coords[i][0] * lonToMeters;
    const y1 = coords[i][1] * latToMeters;
    const x2 = coords[j][0] * lonToMeters;
    const y2 = coords[j][1] * latToMeters;
    area += x1 * y2 - x2 * y1;
  }
  return Math.round(Math.abs(area) / 2);
}

export type DiscoveryDiagnosticStatus =
  | "SUCCESS"
  | "NO_OSM_BUILDINGS_RETURNED"
  | "BUILDINGS_FILTERED_OUT"
  | "OSM_REQUEST_FAILED";

export interface DiscoveryDiagnostic {
  status: DiscoveryDiagnosticStatus;
  message: string;
  rawElementsCount?: number;
  validBuildingsCount?: number;
  searchRadiusMeters?: number;
  endpointUsed?: string;
  error?: string;
}

export const DEFAULT_OVERPASS_ENDPOINTS: string[] = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

interface CacheEntry {
  timestamp: number;
  candidates: BuildingCandidate[];
}

/**
 * OpenStreetMap Overpass Building Discovery Provider with Progressive Search & Direct Matching
 */
export class OverpassBuildingDiscoveryProvider implements IBuildingDiscoveryProvider {
  private timeoutMs: number;
  private endpoints: string[];
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTtlMs: number = 10 * 60 * 1000; // 10 minutes cache TTL
  private lastDiagnostic: DiscoveryDiagnostic | null = null;

  constructor(
    timeoutMs: number = 8500,
    endpoints: string[] = DEFAULT_OVERPASS_ENDPOINTS
  ) {
    this.timeoutMs = timeoutMs;
    this.endpoints = endpoints;
  }

  /**
   * Returns diagnostic information about the most recent building discovery operation.
   */
  public getLastDiagnostic(): DiscoveryDiagnostic | null {
    return this.lastDiagnostic;
  }

  /**
   * Clears in-memory query cache (useful for tests)
   */
  public clearCache(): void {
    this.cache.clear();
  }

  async discoverBuildings(
    latitude: number,
    longitude: number,
    searchContext?: LocationSearchResult | null,
    radiusMeters?: number
  ): Promise<BuildingCandidate[]> {
    if (isNaN(latitude) || isNaN(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return [];
    }

    // 1. Check in-memory cache
    const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}_${searchContext?.osmId || ""}_${radiusMeters || "prog"}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.candidates;
    }

    try {
      let candidates: BuildingCandidate[] = [];

      // 2. Direct Building Result Detection (Phase 2)
      if (searchContext && this.isDirectBuildingResult(searchContext)) {
        const directCandidate = await this.fetchDirectBuildingCandidate(searchContext);
        if (directCandidate) {
          candidates.push(directCandidate);
        }
      }

      // 3. Progressive Building Discovery if no candidates found yet or to complement direct result
      if (candidates.length === 0) {
        if (radiusMeters && radiusMeters > 0) {
          // Explicit single radius requested
          candidates = await this.queryOverpassRadius(latitude, longitude, radiusMeters);
        } else {
          // Progressive search strategy: 180m -> 300m -> 500m
          const progressiveRadii = [180, 300, 500];
          let lastErr: any = null;
          for (const rad of progressiveRadii) {
            try {
              const found = await this.queryOverpassRadius(latitude, longitude, rad);
              if (found.length > 0) {
                candidates = found;
                break; // Stop progressive expansion as soon as candidates are discovered
              }
            } catch (err: any) {
              lastErr = err;
              console.warn(`Progressive radius ${rad}m query failed:`, err?.message || err);
              // If rate limited (429), stop expanding and throw immediately
              if (err?.message?.includes("429")) {
                throw err;
              }
            }
          }

          // If all radii threw network/server errors and no candidates found, re-throw
          if (candidates.length === 0 && lastErr) {
            throw lastErr;
          }
        }
      }

      // 4. Candidate Ranking & Proximity Tiering (Phase 4)
      candidates = this.rankAndNormalizeCandidates(candidates, latitude, longitude);

      // 5. Fallback for Surya Heights demo if offline / fallback
      if (candidates.length === 0) {
        candidates = this.getFallbackCandidates(latitude, longitude);
      }

      // Diagnostic recording
      if (candidates.length > 0) {
        this.lastDiagnostic = {
          status: "SUCCESS",
          message: `Discovered ${candidates.length} candidate building footprints.`,
          validBuildingsCount: candidates.length,
          searchRadiusMeters: candidates[0]?.searchRadiusUsedMeters || 0,
        };
      } else {
        this.lastDiagnostic = {
          status: "NO_OSM_BUILDINGS_RETURNED",
          message: "Progressive discovery searched up to 500m radius without detecting building outlines.",
          validBuildingsCount: 0,
        };
      }

      // Store in cache
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        candidates,
      });

      return candidates;
    } catch (err: any) {
      // If network fails, try fallback
      const fallback = this.getFallbackCandidates(latitude, longitude);
      if (fallback.length > 0) {
        this.lastDiagnostic = {
          status: "SUCCESS",
          message: "Used fallback candidate data for demo location.",
          validBuildingsCount: fallback.length,
        };
        return fallback;
      }

      this.lastDiagnostic = {
        status: "OSM_REQUEST_FAILED",
        message: "OpenStreetMap building discovery query could not be completed.",
        error: err?.message || String(err),
      };
      throw err;
    }
  }

  /**
   * Determines if a search result directly represents an OSM building.
   * Checks that category is explicitly "building" or isReferenceBuilding is set.
   * Prevents false positives from place/landuse/highway results (e.g. commercial place).
   */
  private isDirectBuildingResult(result: LocationSearchResult): boolean {
    if (result.isReferenceBuilding) return true;
    if (result.category === "building") return true;
    if (
      result.osmId &&
      (result.osmId.startsWith("way/") || result.osmId.startsWith("relation/")) &&
      result.category === "building"
    ) {
      return true;
    }
    return false;
  }

  /**
   * Executes an Overpass QL query with automatic failover across official mirrors.
   */
  private async executeOverpassQuery(query: string): Promise<{ data: any; endpoint: string }> {
    let lastError: any = null;

    for (let i = 0; i < this.endpoints.length; i++) {
      const endpoint = this.endpoints[i];
      const url = `${endpoint}?data=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "SIH26011-3D-ULPIN/1.0",
          },
        });

        clearTimeout(timer);

        if (!response) {
          // If in test environment mock was not configured for subsequent calls
          break;
        }

        if (response.status === 429) {
          // Rate limit reached - do not spam other endpoints, rethrow immediately
          throw new Error(`Overpass API returned status: 429`);
        }

        if (!response.ok) {
          lastError = new Error(`Overpass API returned status: ${response.status}`);
          // For server errors (504, 502, 503), try next mirror if available
          continue;
        }

        let data: any;
        if (typeof response.json === "function") {
          data = await response.json();
        } else if (typeof (response as any).text === "function") {
          const text = await (response as any).text();
          data = JSON.parse(text);
        } else {
          data = response;
        }

        return { data, endpoint };
      } catch (err: any) {
        clearTimeout(timer);
        if (err.message && err.message.includes("status: 429")) {
          throw err;
        }
        if (err.name === "AbortError") {
          lastError = new Error("Overpass API request timed out");
        } else {
          lastError = err;
        }
        // Try next mirror
        continue;
      }
    }

    throw lastError || new Error("All Overpass API endpoints failed");
  }

  /**
   * Directly fetches the geometry and metadata of an OSM building entity.
   */
  private async fetchDirectBuildingCandidate(result: LocationSearchResult): Promise<BuildingCandidate | null> {
    const rawOsmId = result.osmId || "";
    let osmType = result.osmType || "way";
    let numericId = "";

    if (rawOsmId.includes("/")) {
      const parts = rawOsmId.split("/");
      osmType = parts[0] as any;
      numericId = parts[1];
    } else if (/^\d+$/.test(rawOsmId)) {
      numericId = rawOsmId;
    }

    if (!numericId) return null;

    const query = `[out:json][timeout:12];(${osmType}(${numericId}););out geom;`;

    try {
      const { data } = await this.executeOverpassQuery(query);
      if (!data || !Array.isArray(data.elements) || data.elements.length === 0) return null;

      const el = data.elements[0];
      if (!Array.isArray(el.geometry) || el.geometry.length < 3) return null;

      const footprint: [number, number][] = el.geometry.map((pt: any) => [
        parseFloat(pt.lon),
        parseFloat(pt.lat),
      ]);

      // Ensure polygon ring is closed
      if (
        footprint.length >= 3 &&
        (footprint[0][0] !== footprint[footprint.length - 1][0] ||
          footprint[0][1] !== footprint[footprint.length - 1][1])
      ) {
        footprint.push([footprint[0][0], footprint[0][1]]);
      }

      let sumLat = 0;
      let sumLon = 0;
      el.geometry.forEach((pt: any) => {
        sumLat += pt.lat;
        sumLon += pt.lon;
      });
      const cLat = sumLat / el.geometry.length;
      const cLon = sumLon / el.geometry.length;

      const dist = calculateDistanceMeters(result.latitude, result.longitude, cLat, cLon);
      const area = calculatePolygonAreaSqm(footprint, cLat);
      const isSurya =
        el.id === 356027047 ||
        (Math.abs(cLat - 17.464877) < 0.0003 && Math.abs(cLon - 78.361956) < 0.0003);

      const tags = el.tags || {};
      const buildingType = tags.building && tags.building !== "yes" ? tags.building : (result.type || "building");
      const buildingName = tags.name || tags["addr:housename"] || result.displayName.split(",")[0] || undefined;
      const levels = tags["building:levels"] ? parseInt(tags["building:levels"], 10) : undefined;

      return {
        id: `osm-${el.type || osmType}-${el.id || numericId}`,
        osmId: `${el.type || osmType}/${el.id || numericId}`,
        osmType: el.type || osmType,
        source: "OpenStreetMap",
        name: buildingName,
        buildingType,
        levels,
        centroid: {
          latitude: Number(cLat.toFixed(6)),
          longitude: Number(cLon.toFixed(6)),
        },
        footprintCoordinates: footprint,
        approxAreaSqm: area || 250,
        distanceMeters: dist,
        modelAvailable: isSurya,
        buildingCode: isSurya ? "APARTMENT-SURYA-OSM" : undefined,
        parcelId: isSurya ? "36A1B2C3D4E5F9" : undefined,
        isDirectMatch: true,
        proximityTier: "EXACT_OR_VERY_NEAR",
        searchRadiusUsedMeters: 0,
        tags,
        attribution: "© OpenStreetMap contributors",
      };
    } catch {
      return null;
    }
  }

  /**
   * Queries Overpass API for building footprints within a specific radius around coordinates.
   */
  private async queryOverpassRadius(
    latitude: number,
    longitude: number,
    radiusMeters: number
  ): Promise<BuildingCandidate[]> {
    const query = `[out:json][timeout:12];(way["building"](around:${radiusMeters},${latitude},${longitude}););out geom 15;`;

    const { data } = await this.executeOverpassQuery(query);
    if (!data || !Array.isArray(data.elements)) {
      return [];
    }

    const candidates: BuildingCandidate[] = [];

    for (const el of data.elements) {
      if (el.type === "way" && Array.isArray(el.geometry) && el.geometry.length >= 3) {
        const footprint: [number, number][] = el.geometry.map((pt: any) => [
          parseFloat(pt.lon),
          parseFloat(pt.lat),
        ]);

        // Ensure polygon ring is closed
        if (
          footprint.length >= 3 &&
          (footprint[0][0] !== footprint[footprint.length - 1][0] ||
            footprint[0][1] !== footprint[footprint.length - 1][1])
        ) {
          footprint.push([footprint[0][0], footprint[0][1]]);
        }

        let sumLat = 0;
        let sumLon = 0;
        el.geometry.forEach((pt: any) => {
          sumLat += pt.lat;
          sumLon += pt.lon;
        });
        const cLat = sumLat / el.geometry.length;
        const cLon = sumLon / el.geometry.length;

        const dist = calculateDistanceMeters(latitude, longitude, cLat, cLon);
        const area = calculatePolygonAreaSqm(footprint, cLat);

        const isSurya =
          el.id === 356027047 ||
          (Math.abs(cLat - 17.464877) < 0.0003 && Math.abs(cLon - 78.361956) < 0.0003);

        const tags = el.tags || {};
        const buildingType = tags.building && tags.building !== "yes" ? tags.building : "building";
        const buildingName = tags.name || tags["addr:housename"] || undefined;
        const levels = tags["building:levels"] ? parseInt(tags["building:levels"], 10) : undefined;

        candidates.push({
          id: `osm-way-${el.id}`,
          osmId: `way/${el.id}`,
          osmType: "way",
          source: "OpenStreetMap",
          name: buildingName,
          buildingType,
          levels,
          centroid: {
            latitude: Number(cLat.toFixed(6)),
            longitude: Number(cLon.toFixed(6)),
          },
          footprintCoordinates: footprint,
          approxAreaSqm: area || 250,
          distanceMeters: dist,
          modelAvailable: isSurya,
          buildingCode: isSurya ? "APARTMENT-SURYA-OSM" : undefined,
          parcelId: isSurya ? "36A1B2C3D4E5F9" : undefined,
          searchRadiusUsedMeters: radiusMeters,
          tags,
          attribution: "© OpenStreetMap contributors",
        });
      }
    }

    return candidates;
  }

  /**
   * Normalizes and ranks candidates based on direct match, distance, and tag completeness.
   */
  private rankAndNormalizeCandidates(
    candidates: BuildingCandidate[],
    searchLat: number,
    searchLon: number
  ): BuildingCandidate[] {
    // Remove duplicates by osmId
    const uniqueMap = new Map<string, BuildingCandidate>();
    for (const c of candidates) {
      if (!uniqueMap.has(c.osmId)) {
        uniqueMap.set(c.osmId, c);
      }
    }

    const normalized = Array.from(uniqueMap.values()).map((c) => {
      const dist =
        c.distanceMeters !== undefined
          ? c.distanceMeters
          : calculateDistanceMeters(searchLat, searchLon, c.centroid.latitude, c.centroid.longitude);
      const isVeryNear = dist <= 30 || c.isDirectMatch === true;

      return {
        ...c,
        distanceMeters: dist,
        proximityTier: (isVeryNear ? "EXACT_OR_VERY_NEAR" : "NEARBY") as "EXACT_OR_VERY_NEAR" | "NEARBY",
      };
    });

    // Ranking algorithm:
    // 1. Direct match first
    // 2. Ascending distance
    // 3. Named buildings or specific types before generic "building"
    // 4. Larger footprint area
    normalized.sort((a, b) => {
      if (a.isDirectMatch && !b.isDirectMatch) return -1;
      if (!a.isDirectMatch && b.isDirectMatch) return 1;

      if (a.distanceMeters !== b.distanceMeters) {
        return a.distanceMeters - b.distanceMeters;
      }

      const aHasName = !!a.name;
      const bHasName = !!b.name;
      if (aHasName && !bHasName) return -1;
      if (!aHasName && bHasName) return 1;

      return (b.approxAreaSqm || 0) - (a.approxAreaSqm || 0);
    });

    return normalized;
  }

  /**
   * Provides fallback candidate data if external network request is unavailable.
   */
  private getFallbackCandidates(latitude: number, longitude: number): BuildingCandidate[] {
    const isNearSurya =
      Math.abs(latitude - 17.464877) < 0.0015 && Math.abs(longitude - 78.361956) < 0.0015;

    if (isNearSurya) {
      const dist = calculateDistanceMeters(latitude, longitude, 17.464877, 78.361956);
      return [
        {
          id: "osm-way-356027047",
          osmId: "way/356027047",
          osmType: "way",
          source: "OpenStreetMap",
          name: "Surya Heights",
          buildingType: "apartments",
          centroid: {
            latitude: 17.464877,
            longitude: 78.361956,
          },
          footprintCoordinates: CANONICAL_SURYA_WGS84_FOOTPRINT,
          approxAreaSqm: 384,
          distanceMeters: dist,
          modelAvailable: true,
          buildingCode: "APARTMENT-SURYA-OSM",
          parcelId: "36A1B2C3D4E5F9",
          isDirectMatch: dist <= 30,
          proximityTier: dist <= 30 ? "EXACT_OR_VERY_NEAR" : "NEARBY",
          attribution: "© OpenStreetMap contributors",
        },
      ];
    }

    const isNearHitec =
      Math.abs(latitude - 17.447400) < 0.008 && Math.abs(longitude - 78.376200) < 0.008;

    if (isNearHitec) {
      const distNexii = calculateDistanceMeters(latitude, longitude, 17.446708, 78.376556);
      const distDeloitte = calculateDistanceMeters(latitude, longitude, 17.448221, 78.375876);
      return [
        {
          id: "real-ref-116079893",
          osmId: "116079893",
          osmType: "way",
          source: "REAL_REFERENCE",
          name: "Nexiilabs",
          buildingType: "commercial",
          levels: 4,
          groundElevationM: 575.5,
          elevMaxM: 590.5,
          zSource: "Copernicus_GLO30_DSM",
          centroid: {
            latitude: 17.446708,
            longitude: 78.376556,
          },
          footprintCoordinates: CANONICAL_NEXIILABS_WGS84_FOOTPRINT,
          approxAreaSqm: 1450,
          distanceMeters: distNexii,
          modelAvailable: false,
          isDirectMatch: distNexii <= 50,
          isReferenceBuilding: true,
          proximityTier: distNexii <= 50 ? "EXACT_OR_VERY_NEAR" : "NEARBY",
          attribution: "© OpenStreetMap contributors | Real Hyderabad Reference Dataset",
        },
        {
          id: "real-ref-89918045",
          osmId: "89918045",
          osmType: "way",
          source: "REAL_REFERENCE",
          name: "Deloitte",
          buildingType: "commercial",
          levels: 4,
          groundElevationM: 575.5,
          elevMaxM: 590.5,
          zSource: "Copernicus_GLO30_DSM",
          centroid: {
            latitude: 17.448221,
            longitude: 78.375876,
          },
          footprintCoordinates: CANONICAL_DELOITTE_WGS84_FOOTPRINT,
          approxAreaSqm: 880,
          distanceMeters: distDeloitte,
          modelAvailable: false,
          isDirectMatch: distDeloitte <= 50,
          isReferenceBuilding: true,
          proximityTier: distDeloitte <= 50 ? "EXACT_OR_VERY_NEAR" : "NEARBY",
          attribution: "© OpenStreetMap contributors | Real Hyderabad Reference Dataset",
        },
      ];
    }

    return [];
  }
}

/**
 * Phase 3.12B: Hybrid Building Discovery Provider
 * Integrates local real Hyderabad reference geospatial buildings (Priority 1)
 * with live Overpass API discovery (Priority 2) and canonical fallback (Priority 3).
 */
export class HybridBuildingDiscoveryProvider implements IBuildingDiscoveryProvider {
  private overpassProvider: OverpassBuildingDiscoveryProvider;
  private lastDiagnostic: DiscoveryDiagnostic | null = null;

  constructor(overpassProvider: OverpassBuildingDiscoveryProvider = new OverpassBuildingDiscoveryProvider()) {
    this.overpassProvider = overpassProvider;
  }

  getLastDiagnostic(): DiscoveryDiagnostic | null {
    return this.lastDiagnostic || this.overpassProvider.getLastDiagnostic();
  }

  async discoverBuildings(
    latitude: number,
    longitude: number,
    searchContext?: LocationSearchResult | null,
    radiusMeters?: number
  ): Promise<BuildingCandidate[]> {
    if (isNaN(latitude) || isNaN(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return [];
    }

    // 1. Check Local Real Reference Hyderabad Dataset (Priority 1)
    try {
      const localCandidates = await fetchReferenceBuildingCandidates(
        latitude,
        longitude,
        radiusMeters || 1000
      );
      if (localCandidates && localCandidates.length > 0) {
        this.lastDiagnostic = {
          status: "SUCCESS",
          message: `Discovered ${localCandidates.length} real Hyderabad reference building footprints.`,
          validBuildingsCount: localCandidates.length,
          searchRadiusMeters: radiusMeters || 1000,
        };
        return localCandidates;
      }
    } catch (err) {
      console.warn("Local reference dataset search bypassed:", err);
    }

    // 2. Delegate to Overpass / Progressive Discovery (Priority 2)
    const overpassResults = await this.overpassProvider.discoverBuildings(
      latitude,
      longitude,
      searchContext,
      radiusMeters
    );
    this.lastDiagnostic = this.overpassProvider.getLastDiagnostic();
    return overpassResults;
  }
}

// Export default singleton instance
export const defaultBuildingDiscoveryProvider = new HybridBuildingDiscoveryProvider();
