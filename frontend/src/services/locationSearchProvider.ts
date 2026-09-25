/**
 * Phase 3.11A: General Address Search & Geocoding Provider
 * Performs real geocoding queries against OpenStreetMap Nominatim for general addresses.
 * Demo presets are kept strictly separate from live search queries.
 */
import type { LocationSearchResult } from "../types/cadastre";

export interface ILocationSearchProvider {
  search(query: string): Promise<LocationSearchResult[]>;
}

// Canonical Demo Reference Presets (Optional quick-access shortcuts, separate from live search)
export const CANONICAL_DEMO_PRESETS: LocationSearchResult[] = [
  {
    id: "preset-surya-heights",
    displayName: "Surya Heights, Kondapur, Hyderabad, Telangana",
    shortAddress: "Kondapur Main Rd, Serilingampally, Hyderabad",
    latitude: 17.464877,
    longitude: 78.361956,
    osmId: "way/356027047",
    osmType: "way",
    category: "building",
    type: "apartments",
    modelAvailable: true,
    buildingCode: "APARTMENT-SURYA-OSM",
    parcelId: "36A1B2C3D4E5F9",
    isReferenceBuilding: true,
    attribution: "© OpenStreetMap contributors",
  },
  {
    id: "preset-moosapet",
    displayName: "Moosapet, Hyderabad, Telangana, India",
    shortAddress: "Moosapet, Kukatpally, Hyderabad",
    latitude: 17.468200,
    longitude: 78.432100,
    osmId: "node/982341201",
    osmType: "node",
    category: "place",
    type: "suburb",
    modelAvailable: false,
    isReferenceBuilding: false,
    attribution: "© OpenStreetMap contributors",
  },
  {
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
  },
  {
    id: "preset-gachibowli",
    displayName: "Gachibowli Financial District, Hyderabad, Telangana",
    shortAddress: "Financial District, Nanakramguda, Gachibowli",
    latitude: 17.440100,
    longitude: 78.348900,
    osmId: "way/410294812",
    osmType: "way",
    category: "place",
    type: "commercial",
    modelAvailable: false,
    isReferenceBuilding: false,
    attribution: "© OpenStreetMap contributors",
  },
  {
    id: "preset-charminar",
    displayName: "Charminar, Old City, Hyderabad, Telangana",
    shortAddress: "Charminar Rd, Char Kaman, Ghansi Bazaar, Hyderabad",
    latitude: 17.361600,
    longitude: 78.474700,
    osmId: "way/32578129",
    osmType: "way",
    category: "historic",
    type: "monument",
    modelAvailable: false,
    isReferenceBuilding: false,
    attribution: "© OpenStreetMap contributors",
  },
];

/**
 * OpenStreetMap Nominatim Geocoding Provider
 * Executes live address search against Nominatim API.
 */
export class NominatimLocationSearchProvider implements ILocationSearchProvider {
  private timeoutMs: number;

  constructor(timeoutMs: number = 4000) {
    this.timeoutMs = timeoutMs;
  }

  async search(query: string): Promise<LocationSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      return [];
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      trimmed
    )}&countrycodes=in&limit=6&addressdetails=1`;

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "SIH26011-3D-ULPIN/1.0",
        },
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(`Geocoding server responded with status: ${response.status}`);
      }

      const rawItems: any[] = await response.json();
      if (!Array.isArray(rawItems)) {
        return [];
      }

      return rawItems.map((item) => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);

        // Check if matching Surya Heights prototype footprint (within 100m)
        const isNearSurya =
          Math.abs(lat - 17.464877) < 0.001 && Math.abs(lon - 78.361956) < 0.001;

        let shortAddr = "";
        if (item.address) {
          const parts = [
            item.address.road || item.address.suburb || item.address.neighbourhood,
            item.address.city || item.address.town || item.address.state_district,
            item.address.state,
          ].filter(Boolean);
          shortAddr = parts.join(", ");
        }

        return {
          id: `osm-${item.osm_type || "item"}-${item.osm_id || Math.random()}`,
          displayName: item.display_name || trimmed,
          shortAddress: shortAddr || undefined,
          latitude: lat,
          longitude: lon,
          boundingBox: item.boundingbox
            ? [
                parseFloat(item.boundingbox[0]),
                parseFloat(item.boundingbox[1]),
                parseFloat(item.boundingbox[2]),
                parseFloat(item.boundingbox[3]),
              ]
            : undefined,
          osmId: item.osm_id ? `${item.osm_type || "osm"}/${item.osm_id}` : undefined,
          osmType: item.osm_type,
          category: item.class || item.category,
          type: item.type,
          modelAvailable: isNearSurya,
          buildingCode: isNearSurya ? "APARTMENT-SURYA-OSM" : undefined,
          parcelId: isNearSurya ? "36A1B2C3D4E5F9" : undefined,
          isReferenceBuilding: isNearSurya || item.class === "building",
          attribution: "© OpenStreetMap contributors",
        };
      });
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError") {
        throw new Error("Geocoding request timed out. Please try again.");
      }
      throw err;
    }
  }
}

// Export default singleton instance
export const defaultLocationSearchProvider = new NominatimLocationSearchProvider();
