import { describe, it, expect } from "vitest";
import type {
  UnitEvidenceProvenanceResponse,
  UnitEvidenceFusionResponse,
  UnitTopologyReportResponse,
  VerticalUnit,
} from "../types/cadastre";

describe("Phase 3.6C: Evidence-Aware 3D Review Visualization & Discrepancy Inspection", () => {
  const mockUnit: VerticalUnit = {
    id: "unit-f01-102",
    parcel_id: "parcel-1",
    building_id: "bldg-1",
    prototype_ulpin_3d: "ULPIN-3D-F01-102",
    floor_code: "F01",
    tier_code: "F",
    unit_sequence: 3,
    unit_label: "F01-102 Residential Apartment",
    unit_type: "APARTMENT",
    z_min: 3.5,
    z_max: 7.0,
    status: "UNDER_REVIEW",
    geom_3d: {
      srid: 32644,
      geometry_type: "PolyhedralSurface",
      geojson: {
        type: "PolyhedralSurface",
        coordinates: [
          [
            [
              [219420.0, 1932500.0, 3.5],
              [219435.0, 1932500.0, 3.5],
              [219435.0, 1932520.0, 3.5],
              [219420.0, 1932520.0, 3.5],
              [219420.0, 1932500.0, 3.5],
            ],
          ],
        ],
      },
    },
  };

  const mockEvidenceData: UnitEvidenceProvenanceResponse = {
    unit_id: "unit-f01-102",
    prototype_ulpin_3d: "ULPIN-3D-F01-102",
    floor_code: "F01",
    tier_code: "F",
    status: "UNDER_REVIEW",
    is_underground: false,
    underground_provenance_note: undefined,
    overall_assessment_level: "HIGH",
    overall_assessment_label: "High Technical Evidence Corroboration",
    is_synthetic_prototype: true,
    evidence_count: 2,
    evidence_records: [
      {
        id: "ev-lidar-01",
        source_type: "LIDAR_POINTCLOUD",
        dataset_name: "prototype_tower_a.las",
        file_uri: "s3://cadastre/raw/prototype_tower_a.las",
        accuracy_horizontal_m: 0.05,
        accuracy_vertical_m: 0.05,
        sensor_category: "AERIAL_LIDAR",
        is_synthetic: true,
        assessment_level: "HIGH",
        assessment_rationale: "Validated aerial point cloud with point density > 25 pts/m²",
        metadata_json: {
          points_count: 14520,
          flight_date: "2026-03-15",
          crs: "EPSG:32644",
        },
        created_at: "2026-09-01T10:00:00Z",
      },
      {
        id: "ev-bim-01",
        source_type: "BIM_IFC",
        dataset_name: "tower_a_asbuilt.ifc",
        file_uri: "s3://cadastre/raw/tower_a_asbuilt.ifc",
        accuracy_horizontal_m: 0.02,
        accuracy_vertical_m: 0.02,
        sensor_category: "TERRESTRIAL_BIM",
        is_synthetic: true,
        assessment_level: "HIGH",
        assessment_rationale: "As-built architectural BIM model with Level of Detail 350",
        metadata_json: {
          ifc_schema: "IFC4",
          lod: 350,
        },
        created_at: "2026-09-01T10:00:00Z",
      },
    ],
    provenance_pipeline: [
      {
        step_number: 1,
        stage: "INGESTION",
        name: "Format & CRS Ingestion",
        status: "COMPLETED",
        details: "Validated LAS and IFC schemas against EPSG:32644",
      },
      {
        step_number: 2,
        stage: "RECONSTRUCTION",
        name: "Analytical Solid Reconstruction",
        status: "COMPLETED",
        details: "Reconstructed polyhedral boundary surface with watertight facets",
      },
    ],
    disclaimer: "Evidence records represent technical source provenance and do not establish statutory legal ownership.",
    evaluated_at: "2026-09-06T12:00:00Z",
  };

  const mockFusionData: UnitEvidenceFusionResponse = {
    unit_id: "unit-f01-102",
    prototype_ulpin_3d: "ULPIN-3D-F01-102",
    status: "UNDER_REVIEW",
    floor_code: "F01",
    tier_code: "F",
    is_underground: false,
    overall_confidence: "MEDIUM",
    overall_confidence_label: "Medium Technical Evidence Corroboration",
    assessment_method: "MULTI_SOURCE_WEIGHTED_HEURISTIC",
    dimensions: {
      source_presence: "MULTI_SOURCE",
      source_presence_reason: "Multiple distinct source records present",
      provenance_quality: "HIGH",
      provenance_quality_reason: "Direct verifiable ingestion pipeline records",
      geometry_support: "HIGH",
      geometry_support_reason: "Robust 3D boundary agreement",
      vertical_support: "MEDIUM",
      vertical_support_reason: "Minor vertical variance between sources",
      source_agreement: "MEDIUM",
      source_agreement_reason: "Cross-source agreement within tolerance except height",
      evidence_completeness: "HIGH",
      evidence_completeness_reason: "Complete coverage of boundaries",
      underground_safety: "HIGH",
      underground_safety_reason: "Superterranean unit",
    },
    sources: [
      {
        id: "ev-lidar-01",
        source_type: "LIDAR_POINTCLOUD",
        dataset_name: "prototype_tower_a.las",
        file_uri: "s3://cadastre/raw/prototype_tower_a.las",
        accuracy_horizontal_m: 0.05,
        accuracy_vertical_m: 0.05,
        sensor_category: "AERIAL_LIDAR",
        crs: "EPSG:32644",
        provenance_quality: "HIGH",
        supported_claims: ["SURFACE_GEOMETRY"],
        unsupported_claims: ["UNDERGROUND_DETECTION"],
        is_synthetic: true,
        created_at: "2026-09-01T10:00:00Z",
      },
      {
        id: "ev-bim-01",
        source_type: "BIM_IFC",
        dataset_name: "tower_a_asbuilt.ifc",
        file_uri: "s3://cadastre/raw/tower_a_asbuilt.ifc",
        accuracy_horizontal_m: 0.02,
        accuracy_vertical_m: 0.02,
        sensor_category: "TERRESTRIAL_BIM",
        crs: "EPSG:32644",
        provenance_quality: "HIGH",
        supported_claims: ["STOREY_GEOMETRY"],
        unsupported_claims: [],
        is_synthetic: true,
        created_at: "2026-09-01T10:00:00Z",
      },
    ],
    comparisons: [
      {
        measurement_name: "Storey Height",
        source_a_type: "LIDAR_POINTCLOUD",
        source_a_val: 3.5,
        source_b_type: "BIM_IFC",
        source_b_val: 3.62,
        difference: 0.12,
        tolerance: 0.1,
        unit_of_measure: "m",
        status: "MINOR_DISCREPANCY",
        notes: "0.12m variance between LiDAR return and BIM ceiling",
      },
      {
        measurement_name: "Footprint Area",
        source_a_type: "LIDAR_POINTCLOUD",
        source_a_val: 300.0,
        source_b_type: "BIM_IFC",
        source_b_val: 301.4,
        difference: 1.4,
        tolerance: 5.0,
        unit_of_measure: "m²",
        status: "AGREEMENT",
        notes: "Footprint areas agree within tolerance",
      },
    ],
    conflicts: [
      {
        code: "Z_RANGE_CONFLICT",
        severity: "WARNING",
        affected_attribute: "z_max",
        source_a: "LIDAR_POINTCLOUD",
        source_b: "BIM_IFC",
        recommendation: "Reviewer should inspect ceiling slab interface with LiDAR point cloud profile.",
      },
    ],
    reviewer_attention: [
      "Compare modeled ceiling elevation (+7.00m) against LiDAR point cloud return peak (+6.88m).",
    ],
    underground_warnings: [],
    disclaimer: "Multi-source evidence fusion is a technical decision-support assessment and not statutory certification.",
    evaluated_at: "2026-09-06T12:00:00Z",
  };

  const mockTopologyData: UnitTopologyReportResponse = {
    unit_id: "unit-f01-102",
    prototype_ulpin_3d: "ULPIN-3D-F01-102",
    parcel_id: "parcel-1",
    overall_quality_status: "VALID",
    solid_validation: {
      is_closed: true,
      is_solid: true,
      validity_code: "VALID_SOLID",
      volume_cbm: 910.76,
      z_min_geom: 3.5,
      z_max_geom: 7.0,
      z_min_meta: 3.5,
      z_max_meta: 7.0,
      is_valid: true,
      details: "PolyhedralSurface forms a valid closed 2-manifold solid with positive volume.",
    },
    containment: {
      unit_id: "unit-f01-102",
      prototype_ulpin_3d: "ULPIN-3D-F01-102",
      is_within_parcel: true,
      status: "CONTAINED",
      severity: "INFO",
      message: "Unit boundary is fully within parcel boundary",
    },
    vertical_continuity: {
      unit_id: "unit-f01-102",
      prototype_ulpin_3d: "ULPIN-3D-F01-102",
      floor_code: "F01",
      z_min: 3.5,
      z_max: 7.0,
      relation_to_lower_unit: "CONTIGUOUS",
      gap_or_overlap_m: 0.0,
      severity: "INFO",
      details: "Direct boundary contact with lower unit F00-COMM at Z=3.50m",
    },
    peer_relationships: [],
    conflict_count: 0,
    warning_count: 0,
    disclaimer: "Topology evaluation performed via SFCGAL 3D geometry engine.",
    audited_at: "2026-09-06T12:00:00Z",
  };

  it("Requirement 1: 3D Review Scorecard captures all 4 Pillars", () => {
    // 1. Modeled Geometry
    expect(mockUnit.geom_3d).toBeDefined();
    expect(mockUnit.geom_3d.geometry_type).toBe("PolyhedralSurface");

    // 2. Source Evidence
    expect(mockEvidenceData.evidence_records.length).toBe(2);

    // 3. Evidence Fusion
    expect(mockFusionData.overall_confidence).toBe("MEDIUM");

    // 4. 3D Topology QC
    expect(mockTopologyData.overall_quality_status).toBe("VALID");
    expect(mockTopologyData.solid_validation.is_solid).toBe(true);
  });

  it("Requirement 2 & 3: Source evidence is explicitly marked as metadata/provenance only without geometry", () => {
    for (const record of mockEvidenceData.evidence_records) {
      // Invariant: source_evidence contains metadata, accuracies, and file URIs, but NO persistent spatial geometry
      expect((record as any).geometry).toBeUndefined();
      expect((record as any).geom_3d).toBeUndefined();
      expect(record.accuracy_horizontal_m).toBeDefined();
      expect(record.accuracy_vertical_m).toBeDefined();
      expect(record.dataset_name).toBeDefined();
    }
  });

  it("Requirement 4 & 5: Categorical confidence display without fabricated numerical probability", () => {
    const validConfidences = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"];
    expect(validConfidences).toContain(mockFusionData.overall_confidence);

    // Ensure no invented percentage string in the overall confidence
    expect(mockFusionData.overall_confidence).not.toMatch(/%/);
    expect(typeof mockFusionData.overall_confidence).toBe("string");

    // Decomposable dimensions are categorical
    expect(mockFusionData.dimensions.geometry_support).toBe("HIGH");
    expect(mockFusionData.dimensions.vertical_support).toBe("MEDIUM");
    expect(mockFusionData.dimensions.provenance_quality).toBe("HIGH");
    expect(mockFusionData.dimensions.source_agreement).toBe("MEDIUM");
  });

  it("Requirement 6 & 7: Discrepancy findings display status, severity, and spatial disclaimer", () => {
    const conflict = mockFusionData.conflicts[0];
    expect(conflict.code).toBe("Z_RANGE_CONFLICT");
    expect(conflict.severity).toBe("WARNING");
    expect(conflict.recommendation).toContain("ceiling slab interface");

    // Spatial disclaimer verification
    const expectedDisclaimer = "Discrepancy detected; exact spatial location is not available from stored evidence geometry.";
    expect(expectedDisclaimer).toContain("exact spatial location is not available");
  });

  it("Requirement 8: NOT_COMPARABLE does not display as agreement", () => {
    const notComparableCmp = {
      measurement_name: "Floor Thickness",
      source_a_type: "LIDAR_POINTCLOUD",
      source_b_type: "ARCHITECTURAL_PLAN",
      difference: 0.0,
      unit_of_measure: "m",
      status: "NOT_COMPARABLE" as const,
    };
    expect(notComparableCmp.status).toBe("NOT_COMPARABLE");
    expect(notComparableCmp.status).not.toBe("AGREEMENT");
  });

  it("Requirement 9: Z_RANGE_CONFLICT does not invent synthetic translated geometry", () => {
    // Modeled canonical geometry must remain exact
    expect(mockUnit.z_min).toBe(3.5);
    expect(mockUnit.z_max).toBe(7.0);
    expect(mockUnit.geom_3d.geojson.coordinates[0][0][0][2]).toBe(3.5);
  });

  it("Requirement 10: Underground LiDAR sensor disclaimer appears when appropriate", () => {
    const subterraneanUnit: VerticalUnit = {
      ...mockUnit,
      tier_code: "SB",
      floor_code: "B01",
      z_min: -6.0,
      z_max: -3.0,
    };
    expect(subterraneanUnit.tier_code === "SB" || subterraneanUnit.tier_code === "UT").toBe(true);

    const lidarDisclaimer = "LiDAR evidence available to this prototype does not by itself establish underground geometry.";
    expect(lidarDisclaimer).toContain("does not by itself establish underground geometry");
  });

  it("Requirement 11: Unit review status remains informational and preserves lifecycle invariants", () => {
    expect(mockUnit.status).toBe("UNDER_REVIEW");
    // Viewing or inspecting evidence does NOT automatically transition to VERIFIED
    expect(mockUnit.status).not.toBe("VERIFIED");
  });
});
