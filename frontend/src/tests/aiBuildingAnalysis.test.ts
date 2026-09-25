import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deriveBuildingOverview } from "../utils/coordinateTransform";
import { analyzeBuildingWithAI, fetchBuildingEvidence } from "../api/cadastreApi";
import type { BuildingCandidate } from "../types/cadastre";

describe("AI Building Analysis & Evidence Matrix", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  describe("deriveBuildingOverview Evidence Matrix", () => {
    it("derives all 9 evidence matrix fields for real reference building candidate", () => {
      const candidate: BuildingCandidate = {
        id: "osm-way-356027047",
        osmId: "356027047",
        osmType: "way",
        source: "REAL_REFERENCE",
        isReferenceBuilding: true,
        name: "Cyber Gateway Tower A",
        buildingType: "commercial",
        centroid: { latitude: 17.4485, longitude: 78.3762 },
        footprintCoordinates: [
          [78.3760, 17.4480],
          [78.3765, 17.4480],
          [78.3765, 17.4485],
          [78.3760, 17.4485],
        ],
        approxAreaSqm: 1250.0,
        distanceMeters: 15.0,
        modelAvailable: true,
        levels: 5,
        floorCount: 5,
        buildingCode: "BLDG-OSM-356027047",
        groundElevationM: 542.5,
        attribution: "© OpenStreetMap contributors | Real Hyderabad Reference Dataset",
      };

      const overview = deriveBuildingOverview({ candidate });

      expect(overview.sourceName).toBe("OpenStreetMap");
      expect(overview.referenceType).toBe("Real Reference Footprint");
      expect(overview.sourceId).toBe("Way 356027047");
      expect(overview.sourceDataset).toBe("Hyderabad Buildings GeoPackage / OSM");
      expect(overview.elevationSource).toBe("Copernicus DSM 30m (COG N17 E078)");
      expect(overview.geometryStatus).toContain("Watertight 3D Solid");
      expect(overview.modelStatus).toContain("Generated Prototype");
      expect(overview.validationStatus).toContain("Passed PostGIS/SFCGAL 3D QC");
      expect(overview.verificationStatus).toBe("PROPOSED");
      expect(overview.undergroundEvidenceNote).toContain("cannot detect subterranean spaces");
    });

    it("derives fallback fields for candidate without 3D model", () => {
      const candidate: BuildingCandidate = {
        id: "osm-way-999888777",
        osmId: "999888777",
        osmType: "way",
        source: "OPENSTREETMAP",
        attribution: "© OpenStreetMap contributors",
        name: "Unextruded Commercial Complex",
        buildingType: "commercial",
        centroid: { latitude: 17.45, longitude: 78.38 },
        footprintCoordinates: [
          [78.38, 17.45],
          [78.381, 17.45],
          [78.381, 17.451],
        ],
        approxAreaSqm: 800.0,
        distanceMeters: 50.0,
        modelAvailable: false,
      };

      const overview = deriveBuildingOverview({ candidate });

      expect(overview.geometryStatus).toBe("2D Footprint Boundary");
      expect(overview.modelStatus).toBe("Discovered Footprint (Unextruded)");
      expect(overview.validationStatus).toBe("Not Validated");
    });
  });

  describe("API Client functions", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("analyzeBuildingWithAI sends proper payload and returns response", async () => {
      const mockResponse = {
        target_building_code: "BLDG-OSM-356027047",
        building_name: "Cyber Gateway Tower A",
        parent_parcel_ulpin: "36116079893D2B",
        footprint_source: "OpenStreetMap",
        elevation_source: "Copernicus DSM 30m",
        footprint_area_sqm: 1250.0,
        ground_elevation_m: 540.0,
        roof_elevation_m: 555.0,
        building_height_m: 15.0,
        floor_count_estimated: 4,
        floor_count_basis: "COPERNICUS_DSM_HEIGHT_METRIC",
        method: "EXPLAINABLE_SPATIAL_FEATURE_ESTIMATOR_HYBRID",
        model_version: "2.9.1-explainable-prototype",
        data_classifications: [
          { component: "Footprint", classification: "REFERENCE", source_description: "OSM", is_authoritative: false },
          { component: "Ground Elevation", classification: "OBSERVED", source_description: "Copernicus DSM", is_authoritative: false },
        ],
        proposals: [
          {
            candidate_id: "AI-BLDG-OSM-356027047-F00",
            candidate_type: "GROUND_FLOOR",
            tier_code: "F",
            floor_code: "F00",
            suggested_label: "Ground Floor",
            suggested_unit_type: "COMMERCIAL",
            z_min: 540.0,
            z_max: 543.0,
            confidence: "HIGH",
            confidence_score: 0.85,
            explanation: ["Ground level matches Copernicus datum"],
            review_flags: [],
            status: "PROPOSED",
          },
        ],
        underground_safety_assessment: {
          is_safe: true,
          flag_reject_underground_lidar: true,
          notes: "Optical LiDAR penetration penalty applied.",
        },
        review_flags: ["PROTOTYPE_HYPOTHESIS_PROPOSED"],
        disclaimer: "AI-assisted candidate proposals are algorithmic hypotheses.",
        evaluated_at: new Date().toISOString(),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as any));

      const result = await analyzeBuildingWithAI({
        candidate_osm_id: "356027047",
        ground_elevation_m: 540.0,
        elev_max_m: 555.0,
        levels_metadata: 4,
      });

      expect(fetch).toHaveBeenCalledWith(
        "/api/ai/candidates/analyze-building",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Accept: "application/json",
          }),
        })
      );
      expect(result.method).toBe("EXPLAINABLE_SPATIAL_FEATURE_ESTIMATOR_HYBRID");
      expect(result.floor_count_estimated).toBe(4);
      expect(result.proposals).toHaveLength(1);
      expect(result.underground_safety_assessment.flag_reject_underground_lidar).toBe(true);
      expect(result.data_classifications[0].classification).toBe("REFERENCE");
    });

    it("fetchBuildingEvidence fetches 9-field evidence record", async () => {
      const mockEvidence = {
        building_id: "11111111-1111-1111-1111-111111111111",
        building_code: "BLDG-SURYA-01",
        building_name: "Surya Heights",
        parcel_id: "22222222-2222-2222-2222-222222222222",
        parcel_ulpin_2d: "36A1B2C3D4E5F9",
        source_name: "Cadastral Survey / Seed",
        reference_type: "Cadastral Seed Parcel",
        source_id: "BLDG-SURYA-01",
        source_dataset: "SIH26011 Canonical Cadastral Seed",
        elevation_source: "Copernicus DSM 30m",
        geometry_status: "Watertight 3D Solid (PolyhedralSurface Z)",
        model_status: "Verified Cadastral Model",
        validation_status: "Passed PostGIS/SFCGAL 3D QC",
        verification_status: "VERIFIED",
        footprint_area_sqm: 1200.0,
        ground_elevation_m: 540.0,
        roof_elevation_m: 555.0,
        total_height_m: 15.0,
        total_storeys: 5,
        total_units: 8,
        evidence_items: [],
        underground_evidence_note: "Physical architectural plans verified.",
        disclaimer: "Research prototype evidence.",
        evaluated_at: new Date().toISOString(),
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockEvidence,
      } as any));

      const result = await fetchBuildingEvidence("11111111-1111-1111-1111-111111111111");

      expect(result.building_code).toBe("BLDG-SURYA-01");
      expect(result.verification_status).toBe("VERIFIED");
      expect(result.validation_status).toContain("Passed PostGIS/SFCGAL");
      expect(result.geometry_status).toContain("Watertight 3D Solid");
    });
  });
});
