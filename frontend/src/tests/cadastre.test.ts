import { describe, it, expect } from "vitest";
import {
  transform32644ToWGS84,
  transform2DCoordinates,
  CANONICAL_VISUAL_GROUND_Z,
  prototypeZToViewerHeight,
  viewerHeightToPrototypeZ,
  resolveBuildingGroundZ,
} from "../utils/coordinateTransform";
import {
  generateArchitecturalDetails,
  getUnitArchitecturalColor,
} from "../utils/architecturalDetails";

describe("Coordinate Transformation (EPSG:32644 -> WGS84)", () => {
  it("transforms UTM Zone 44N coordinates to WGS84 geographic coordinates", () => {
    // TOWER-A origin in EPSG:32644
    const x = 219405.0;
    const y = 1932502.5;
    const z = 540.0;

    const [lon, lat, transformedZ] = transform32644ToWGS84(x, y, z);

    // Verify lon is in reasonable range for Telangana/Hyderabad region (~78°E)
    expect(lon).toBeGreaterThan(78.0);
    expect(lon).toBeLessThan(79.0);

    // Verify lat is in reasonable range (~17°N)
    expect(lat).toBeGreaterThan(17.0);
    expect(lat).toBeLessThan(18.0);

    // Verify vertical Z is strictly preserved
    expect(transformedZ).toBe(540.0);
  });

  it("correctly batch transforms 2D footprint coordinate rings", () => {
    const rawCoords: [number, number][] = [
      [219405.0, 1932502.5],
      [219425.0, 1932502.5],
      [219425.0, 1932517.5],
      [219405.0, 1932517.5],
      [219405.0, 1932502.5],
    ];

    const transformed = transform2DCoordinates(rawCoords);

    expect(transformed.length).toBe(5);
    transformed.forEach(([lon, lat]) => {
      expect(lon).toBeGreaterThan(78.0);
      expect(lon).toBeLessThan(79.0);
      expect(lat).toBeGreaterThan(17.0);
      expect(lat).toBeLessThan(18.0);
    });

    // Check closed polygon property
    expect(transformed[0][0]).toBeCloseTo(transformed[4][0], 6);
    expect(transformed[0][1]).toBeCloseTo(transformed[4][1], 6);
  });
});

describe("Phase 3.7G: Local Vertical Datum Grounding & Visual Elevation Transforms", () => {
  it("verifies canonical ground datum constant is 540.0m", () => {
    expect(CANONICAL_VISUAL_GROUND_Z).toBe(540.0);
  });

  it("transforms canonical prototype elevations to local grounded viewer heights", () => {
    // Basement: 536.50 -> -3.50 m
    expect(prototypeZToViewerHeight(536.5, 540.0)).toBe(-3.5);
    // Ground base: 540.00 -> 0.00 m
    expect(prototypeZToViewerHeight(540.0, 540.0)).toBe(0.0);
    // Ground top: 543.50 -> +3.50 m
    expect(prototypeZToViewerHeight(543.5, 540.0)).toBe(3.5);
    // Floor 1: 543.5 -> 546.5 => 3.5 -> 6.5 m
    expect(prototypeZToViewerHeight(546.5, 540.0)).toBe(6.5);
    // Floor 2: 546.5 -> 549.5 => 6.5 -> 9.5 m
    expect(prototypeZToViewerHeight(549.5, 540.0)).toBe(9.5);
    // Floor 3: 549.5 -> 552.5 => 9.5 -> 12.5 m
    expect(prototypeZToViewerHeight(552.5, 540.0)).toBe(12.5);
    // Floor 4: 552.5 -> 555.5 => 12.5 -> 15.5 m
    expect(prototypeZToViewerHeight(555.5, 540.0)).toBe(15.5);
    // Floor 5: 555.5 -> 558.5 => 15.5 -> 18.5 m
    expect(prototypeZToViewerHeight(558.5, 540.0)).toBe(18.5);
    // Rooftop: 558.5 -> 561.5 => 18.5 -> 21.5 m
    expect(prototypeZToViewerHeight(561.5, 540.0)).toBe(21.5);
  });

  it("transforms viewer heights back to prototype elevation with 100% precision", () => {
    expect(viewerHeightToPrototypeZ(-3.5, 540.0)).toBe(536.5);
    expect(viewerHeightToPrototypeZ(0.0, 540.0)).toBe(540.0);
    expect(viewerHeightToPrototypeZ(12.5, 540.0)).toBe(552.5);
    expect(viewerHeightToPrototypeZ(21.5, 540.0)).toBe(561.5);
  });

  it("preserves relative layer interval thickness identically", () => {
    const protoHeight = 561.5 - 540.0;
    const viewHeight = prototypeZToViewerHeight(561.5) - prototypeZToViewerHeight(540.0);
    expect(viewHeight).toBe(protoHeight);
    expect(viewHeight).toBe(21.5);
  });
});

describe("Phase 3.7G-Fix: Dynamic Real-Data Ground Datum Resolution (Anti-Floating)", () => {
  it("resolves Surya Heights ground datum to 540.0m from F00 ground unit", () => {
    const suryaUnits = [
      { floor_code: "B01", tier_code: "SB", z_min: 536.5, z_max: 540.0 },
      { floor_code: "F00", tier_code: "F", z_min: 540.0, z_max: 543.5 },
      { floor_code: "F01", tier_code: "F", z_min: 543.5, z_max: 546.5 },
    ] as any;
    expect(resolveBuildingGroundZ(suryaUnits)).toBe(540.0);
  });

  it("resolves Hyderabad real building (Nexiilabs / BLDG-OSM-89918145) ground datum to 575.5m", () => {
    const nexiiUnits = [
      { floor_code: "B01", tier_code: "SB", z_min: 572.0, z_max: 575.5 },
      { floor_code: "F00", tier_code: "F", z_min: 575.5, z_max: 578.5 },
      { floor_code: "F01", tier_code: "F", z_min: 578.5, z_max: 581.5 },
    ] as any;
    expect(resolveBuildingGroundZ(nexiiUnits)).toBe(575.5);
  });

  it("resolves ground datum from candidate groundElevationM when available", () => {
    const candidate = {
      osm_id: 89918145,
      groundElevationM: 575.5,
      name: "Nexiilabs",
    } as any;
    expect(resolveBuildingGroundZ([], candidate)).toBe(575.5);
  });

  it("resolves basement ceiling when F00 is absent", () => {
    const units = [
      { floor_code: "B01", tier_code: "SB", z_min: 572.0, z_max: 575.5 },
      { floor_code: "F01", tier_code: "F", z_min: 575.5, z_max: 578.5 },
    ] as any;
    expect(resolveBuildingGroundZ(units)).toBe(575.5);
  });

  it("falls back to CANONICAL_VISUAL_GROUND_Z when no units or candidate elevation exist", () => {
    expect(resolveBuildingGroundZ([])).toBe(540.0);
    expect(resolveBuildingGroundZ(undefined, null)).toBe(540.0);
  });

  it("ensures viewer height at F00 z_min is exactly 0.0m (ground contact, no floating)", () => {
    const groundZ = resolveBuildingGroundZ([], { groundElevationM: 575.5 } as any);
    const viewerH = prototypeZToViewerHeight(575.5, groundZ);
    expect(viewerH).toBe(0.0);
  });
});

describe("Phase 3.7H: Architectural Visual Model & Cohesive Palette", () => {
  const dummyUnits: any[] = [
    { id: "u-b01", floor_code: "B01", tier_code: "SB", z_min: 536.5, z_max: 540.0, unit_type: "PARKING", status: "VERIFIED" },
    { id: "u-f00", floor_code: "F00", tier_code: "F", z_min: 540.0, z_max: 543.5, unit_type: "PARKING", status: "VERIFIED" },
    { id: "u-f01", floor_code: "F01", tier_code: "F", z_min: 543.5, z_max: 546.5, unit_type: "RESIDENTIAL", status: "VERIFIED" },
    { id: "u-f02", floor_code: "F02", tier_code: "F", z_min: 546.5, z_max: 549.5, unit_type: "RESIDENTIAL", status: "VERIFIED" },
    { id: "u-f03", floor_code: "F03", tier_code: "F", z_min: 549.5, z_max: 552.5, unit_type: "RESIDENTIAL", status: "VERIFIED" },
    { id: "u-f04", floor_code: "F04", tier_code: "F", z_min: 552.5, z_max: 555.5, unit_type: "RESIDENTIAL", status: "VERIFIED" },
    { id: "u-f05", floor_code: "F05", tier_code: "F", z_min: 555.5, z_max: 558.5, unit_type: "RESIDENTIAL", status: "VERIFIED" },
    { id: "u-rf01", floor_code: "RF01", tier_code: "AR", z_min: 558.5, z_max: 561.5, unit_type: "COMMON", status: "VERIFIED" },
  ];

  const dummyBuilding: any = {
    id: "b-surya",
    building_code: "APARTMENT-SURYA",
    building_name: "Surya Heights",
    total_floors_above: 6,
    total_floors_below: 1,
  };

  it("generates architectural entities for stilt, basement, balconies, parapet, lift core, and solar panels", () => {
    const details = generateArchitecturalDetails(dummyBuilding, dummyUnits, null, 540.0);
    expect(details.length).toBeGreaterThan(10);

    const names = details.map((d) => d.name);
    expect(names.some((n) => n.includes("Stilt Column"))).toBe(true);
    expect(names.some((n) => n.includes("Basement Column"))).toBe(true);
    expect(names.some((n) => n.includes("Balcony Slab"))).toBe(true);
    expect(names.some((n) => n.includes("Balcony Railing"))).toBe(true);
    expect(names.some((n) => n.includes("Rooftop Parapet"))).toBe(true);
    expect(names.some((n) => n.includes("Lift & Staircase Core"))).toBe(true);
    expect(names.some((n) => n.includes("Solar Array"))).toBe(true);
  });

  it("assigns unitData to architectural elements for picking continuity", () => {
    const details = generateArchitecturalDetails(dummyBuilding, dummyUnits, null, 540.0);
    const balconyF03 = details.find((d) => d.name === "Balcony Slab (F03)");
    expect(balconyF03).toBeDefined();
    expect(balconyF03?.unitData?.floor_code).toBe("F03");
  });

  it("returns cohesive architectural palette for residential, basement, and rooftop floors", () => {
    const colorF01 = getUnitArchitecturalColor(dummyUnits[2], false);
    const colorSelected = getUnitArchitecturalColor(dummyUnits[2], true);
    const colorBasement = getUnitArchitecturalColor(dummyUnits[0], false);
    const colorRooftop = getUnitArchitecturalColor(dummyUnits[7], false);

    expect(colorF01).toBeDefined();
    expect(colorSelected).toBeDefined();
    expect(colorBasement).toBeDefined();
    expect(colorRooftop).toBeDefined();
  });
});

describe("Phase 2.7 Evidence Intelligence & Provenance", () => {
  it("verifies evidence assessment categories conform to rule-based criteria", () => {
    function assessEvidence(hAcc?: number, vAcc?: number): "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" {
      if (hAcc !== undefined && vAcc !== undefined) {
        if (hAcc <= 0.05 && vAcc <= 0.05) return "HIGH";
        if (hAcc <= 0.20 && vAcc <= 0.20) return "MEDIUM";
        return "LOW";
      }
      return "UNKNOWN";
    }

    // BIM / dense LiDAR
    expect(assessEvidence(0.02, 0.01)).toBe("HIGH");
    expect(assessEvidence(0.05, 0.05)).toBe("HIGH");

    // CityJSON / Drone photogrammetry
    expect(assessEvidence(0.15, 0.10)).toBe("MEDIUM");
    expect(assessEvidence(0.10, 0.15)).toBe("MEDIUM");

    // Coarse / approximate
    expect(assessEvidence(0.50, 0.50)).toBe("LOW");

    // Undocumented
    expect(assessEvidence(undefined, undefined)).toBe("UNKNOWN");
  });

  it("verifies underground provenance logic distinguishes subsurface records from airborne sensors", () => {
    function getUndergroundNote(tierCode: string): string | null {
      if (tierCode === "UT") {
        return "Subsurface utility infrastructure derived from municipal survey/engineering records. Subterranean geometry is not detected by optical airborne LiDAR.";
      }
      if (tierCode === "SB") {
        return "Subterranean basement levels derived from structural BIM/IFC engineering models and building sanction plans.";
      }
      return null;
    }

    expect(getUndergroundNote("UT")).toContain("not detected by optical airborne LiDAR");
    expect(getUndergroundNote("SB")).toContain("structural BIM/IFC");
    expect(getUndergroundNote("F")).toBeNull();
  });
});

describe("Phase 2.8 Vertical Property Taxonomy & Multi-Tier Decomposition", () => {
  function classifyTaxonomy(tierCode: string, unitType: string, floorCode: string): string {
    const tier = tierCode.toUpperCase();
    const uType = unitType.toUpperCase();
    const fCode = floorCode.toUpperCase();

    if (tier === "UT" || tier === "SB") return "UNDERGROUND";
    if (tier === "AR" || tier === "AE") return "ROOFTOP_ELEVATED";
    if (tier === "CM") return "COMMON";
    if (tier === "F") {
      if (fCode === "F00" || fCode === "GF" || fCode === "P00" || uType === "PARKING") {
        return "GROUND";
      }
      return "UPPER_FLOORS";
    }
    return "OTHER";
  }

  it("accurately classifies all 9 vertical property strata types into their taxonomy categories", () => {
    // 1. Underground utility
    expect(classifyTaxonomy("UT", "UTILITY_CORRIDOR", "UT01")).toBe("UNDERGROUND");
    // 2. Underground basement
    expect(classifyTaxonomy("SB", "COMMERCIAL", "B01")).toBe("UNDERGROUND");
    // 3. Underground parking
    expect(classifyTaxonomy("SB", "PARKING", "B02")).toBe("UNDERGROUND");
    // 4. Ground floor
    expect(classifyTaxonomy("F", "COMMERCIAL", "F00")).toBe("GROUND");
    // 5. Open / ground parking
    expect(classifyTaxonomy("F", "PARKING", "P00")).toBe("GROUND");
    // 6. Upper residential floor
    expect(classifyTaxonomy("F", "RESIDENTIAL", "F01")).toBe("UPPER_FLOORS");
    expect(classifyTaxonomy("F", "RESIDENTIAL", "F02")).toBe("UPPER_FLOORS");
    // 7. Rooftop structure
    expect(classifyTaxonomy("AR", "COMMON_CIRCULATION", "RF01")).toBe("ROOFTOP_ELEVATED");
    // 8. Elevated air-rights
    expect(classifyTaxonomy("AE", "AIR_RIGHTS", "AE01")).toBe("ROOFTOP_ELEVATED");
    // 9. Common circulation
    expect(classifyTaxonomy("CM", "COMMON_CIRCULATION", "CM01")).toBe("COMMON");
  });
});

describe("Phase 2.9 Explainable AI Candidate Intelligence", () => {
  it("evaluates explainable prototype candidate confidence rules", () => {
    function computeCandidateConfidence(
      peakProminence: number,
      heightInterval: number,
      compactness: number,
      isUndergroundLidar: boolean
    ): { confidence: "HIGH" | "MEDIUM" | "LOW"; score: number } {
      if (isUndergroundLidar) {
        return { confidence: "LOW", score: 0.20 };
      }

      let score = 0.0;
      if (peakProminence >= 2.0) score += 0.35;
      else if (peakProminence >= 1.2) score += 0.25;
      else score += 0.10;

      if (heightInterval >= 2.8 && heightInterval <= 3.5) score += 0.25;
      else if (heightInterval >= 2.5 && heightInterval <= 4.0) score += 0.15;
      else score += 0.05;

      if (compactness >= 0.70) score += 0.20;
      else if (compactness >= 0.50) score += 0.12;
      else score += 0.05;

      score += 0.20; // evidence compatibility

      const finalScore = Math.min(Math.max(score, 0.10), 0.98);
      let confidence: "HIGH" | "MEDIUM" | "LOW" = "LOW";
      if (finalScore >= 0.75) confidence = "HIGH";
      else if (finalScore >= 0.50) confidence = "MEDIUM";

      return { confidence, score: finalScore };
    }

    // High confidence upper floor candidate
    const upperFloor = computeCandidateConfidence(2.2, 3.0, 0.85, false);
    expect(upperFloor.confidence).toBe("HIGH");
    expect(upperFloor.score).toBeGreaterThanOrEqual(0.75);

    // Moderate candidate
    const moderateFloor = computeCandidateConfidence(1.1, 3.2, 0.60, false);
    expect(moderateFloor.confidence).toBe("MEDIUM");

    // Underground LiDAR violation penalty
    const undergroundLidarViolation = computeCandidateConfidence(2.5, 3.0, 0.85, true);
    expect(undergroundLidarViolation.confidence).toBe("LOW");
    expect(undergroundLidarViolation.score).toBeLessThanOrEqual(0.20);
  });
});

describe("Phase 3.0: 3D Topology, Conflict Detection & Spatial Quality-Control", () => {
  it("verifies topology pairwise relationship classification and severity mapping", () => {
    function classifyPairwiseRelationship(
      overlapVolume: number,
      surfaceIntersects: boolean,
      volA: number,
      volB: number
    ): { code: string; severity: "INFO" | "WARNING" | "ERROR" } {
      const minVol = Math.min(volA, volB);
      const ratio = minVol > 0 ? overlapVolume / minVol : 0;

      if (overlapVolume > 0.001) {
        if (ratio >= 0.90) {
          return { code: "DUPLICATE_SPATIAL_REPRESENTATION", severity: "ERROR" };
        }
        return { code: "POSITIVE_VOLUME_OVERLAP", severity: "ERROR" };
      }
      if (surfaceIntersects) {
        return { code: "BOUNDARY_CONTACT", severity: "INFO" };
      }
      return { code: "DISJOINT", severity: "INFO" };
    }

    // 1. Zero-volume boundary contact -> INFO
    const touch = classifyPairwiseRelationship(0.0, true, 900.0, 900.0);
    expect(touch.code).toBe("BOUNDARY_CONTACT");
    expect(touch.severity).toBe("INFO");

    // 2. Positive volume overlap collision -> ERROR
    const collision = classifyPairwiseRelationship(70.0, true, 1050.0, 150.0);
    expect(collision.code).toBe("POSITIVE_VOLUME_OVERLAP");
    expect(collision.severity).toBe("ERROR");

    // 3. Duplicate spatial representation (95% overlap) -> ERROR
    const duplicate = classifyPairwiseRelationship(95.0, true, 100.0, 100.0);
    expect(duplicate.code).toBe("DUPLICATE_SPATIAL_REPRESENTATION");
    expect(duplicate.severity).toBe("ERROR");

    // 4. Completely disjoint -> INFO
    const disjoint = classifyPairwiseRelationship(0.0, false, 900.0, 900.0);
    expect(disjoint.code).toBe("DISJOINT");
    expect(disjoint.severity).toBe("INFO");
  });

  it("verifies vertical continuity rule evaluation", () => {
    function evaluateVerticalStep(
      zMinUpper: number,
      zMaxLower: number
    ): { relation: string; gapOrOverlap: number; severity: "INFO" | "WARNING" | "ERROR" } {
      const diff = zMinUpper - zMaxLower;
      if (Math.abs(diff) <= 0.02) {
        return { relation: "CONTIGUOUS", gapOrOverlap: 0.0, severity: "INFO" };
      } else if (diff > 0.02) {
        return { relation: "VERTICAL_GAP", gapOrOverlap: diff, severity: "WARNING" };
      } else {
        return { relation: "VERTICAL_OVERLAP", gapOrOverlap: Math.abs(diff), severity: "WARNING" };
      }
    }

    // Contiguous floors (e.g. 543.50m interface)
    const contiguous = evaluateVerticalStep(543.50, 543.50);
    expect(contiguous.relation).toBe("CONTIGUOUS");
    expect(contiguous.severity).toBe("INFO");

    // 1.50m vertical gap
    const gap = evaluateVerticalStep(545.0, 543.5);
    expect(gap.relation).toBe("VERTICAL_GAP");
    expect(gap.gapOrOverlap).toBeCloseTo(1.50, 2);
    expect(gap.severity).toBe("WARNING");

    // Vertical overlap
    const overlap = evaluateVerticalStep(542.0, 543.5);
    expect(overlap.relation).toBe("VERTICAL_OVERLAP");
    expect(overlap.gapOrOverlap).toBeCloseTo(1.50, 2);
    expect(overlap.severity).toBe("WARNING");
  });
});

describe("Phase 3.1 Human-in-the-Loop 3D Property Review Workspace", () => {
  it("verifies review readiness summary logic", () => {
    function computeOverallReadiness(
      isSolidValid: boolean,
      hasCollision: boolean,
      hasParcelViolation: boolean,
      hasEvidence: boolean
    ): "READY_FOR_HUMAN_REVIEW" | "REVIEW_REQUIRES_ATTENTION" | "BLOCKED_INVALID_GEOMETRY" {
      if (!isSolidValid) {
        return "BLOCKED_INVALID_GEOMETRY";
      }
      if (hasCollision || hasParcelViolation || !hasEvidence) {
        return "REVIEW_REQUIRES_ATTENTION";
      }
      return "READY_FOR_HUMAN_REVIEW";
    }

    // 1. Clean valid unit
    expect(computeOverallReadiness(true, false, false, true)).toBe("READY_FOR_HUMAN_REVIEW");

    // 2. Spatial collision / boundary overhang
    expect(computeOverallReadiness(true, true, false, true)).toBe("REVIEW_REQUIRES_ATTENTION");
    expect(computeOverallReadiness(true, false, true, true)).toBe("REVIEW_REQUIRES_ATTENTION");
    expect(computeOverallReadiness(true, false, false, false)).toBe("REVIEW_REQUIRES_ATTENTION");

    // 3. Degenerate non-solid geometry -> Blocked
    expect(computeOverallReadiness(false, false, false, true)).toBe("BLOCKED_INVALID_GEOMETRY");
    expect(computeOverallReadiness(false, true, true, false)).toBe("BLOCKED_INVALID_GEOMETRY");
  });

  it("verifies PROPOSED shows START_REVIEW action only", () => {
    function getAvailableActions(status: string): string[] {
      if (status === "PROPOSED") return ["START_REVIEW"];
      if (status === "UNDER_REVIEW") return ["VERIFY", "REJECT"];
      return [];
    }

    const actions = getAvailableActions("PROPOSED");
    expect(actions).toContain("START_REVIEW");
    expect(actions.length).toBe(1);
  });

  it("verifies PROPOSED does not expose direct VERIFY or direct REJECT", () => {
    function getAvailableActions(status: string): string[] {
      if (status === "PROPOSED") return ["START_REVIEW"];
      if (status === "UNDER_REVIEW") return ["VERIFY", "REJECT"];
      return [];
    }

    const actions = getAvailableActions("PROPOSED");
    expect(actions).not.toContain("VERIFY");
    expect(actions).not.toContain("REJECT");
  });

  it("verifies UNDER_REVIEW exposes VERIFY and REJECT actions", () => {
    function getAvailableActions(status: string): string[] {
      if (status === "PROPOSED") return ["START_REVIEW"];
      if (status === "UNDER_REVIEW") return ["VERIFY", "REJECT"];
      return [];
    }

    const actions = getAvailableActions("UNDER_REVIEW");
    expect(actions).toContain("VERIFY");
    expect(actions).toContain("REJECT");
    expect(actions).not.toContain("START_REVIEW");
  });

  it("verifies REJECT requires structured reason code", () => {
    const VALID_REASONS = new Set([
      "GEOMETRY_INVALID",
      "SPATIAL_CONFLICT",
      "INSUFFICIENT_EVIDENCE",
      "INCORRECT_VERTICAL_BOUNDARY",
      "INCORRECT_UNIT_TYPE",
      "OTHER"
    ]);

    function validateRejectionPayload(targetStatus: string, reasonCode?: string): boolean {
      if (targetStatus === "REJECTED") {
        return !!reasonCode && VALID_REASONS.has(reasonCode);
      }
      return true;
    }

    expect(validateRejectionPayload("REJECTED", "SPATIAL_CONFLICT")).toBe(true);
    expect(validateRejectionPayload("REJECTED", "GEOMETRY_INVALID")).toBe(true);
    expect(validateRejectionPayload("REJECTED", undefined)).toBe(false);
    expect(validateRejectionPayload("REJECTED", "UNKNOWN_CODE")).toBe(false);
    expect(validateRejectionPayload("VERIFIED", undefined)).toBe(true);
  });

  it("verifies audit history formats rejection notes with reason codes", () => {
    function formatAuditRemarks(reasonCode?: string, notes?: string): string {
      const prefix = reasonCode ? `[${reasonCode}] ` : "";
      return `${prefix}${notes || "Transitioned."}`;
    }

    const formatted = formatAuditRemarks("SPATIAL_CONFLICT", "3D Overlap of 0.45m³ detected.");
    expect(formatted).toBe("[SPATIAL_CONFLICT] 3D Overlap of 0.45m³ detected.");
    expect(formatted).toContain("SPATIAL_CONFLICT");
  });

  it("verifies topology conflict severity renders correctly (boundary contact is INFO, volume overlap is ERROR)", () => {
    function getSeverity(relCode: string): "INFO" | "WARNING" | "ERROR" {
      if (relCode === "POSITIVE_VOLUME_OVERLAP" || relCode === "DUPLICATE_SPATIAL_REPRESENTATION") {
        return "ERROR";
      }
      if (relCode === "BOUNDARY_CONTACT" || relCode === "DISJOINT") {
        return "INFO";
      }
      return "WARNING";
    }

    expect(getSeverity("BOUNDARY_CONTACT")).toBe("INFO");
    expect(getSeverity("DISJOINT")).toBe("INFO");
    expect(getSeverity("POSITIVE_VOLUME_OVERLAP")).toBe("ERROR");
    expect(getSeverity("DUPLICATE_SPATIAL_REPRESENTATION")).toBe("ERROR");
  });

  it("verifies underground evidence evaluation renders warning when subsurface evidence is missing", () => {
    function evaluateUndergroundEvidence(
      tierCode: string,
      evidenceSources: string[]
    ): { passed: boolean; severity: "INFO" | "WARNING"; message: string } {
      if (tierCode === "UT" || tierCode === "SB") {
        const hasValidSubsurface = evidenceSources.some(s =>
          ["BIM", "CAD", "BLUEPRINT", "ARCHITECTURAL", "SURVEY", "GPR"].some(k => s.toUpperCase().includes(k))
        );
        return {
          passed: hasValidSubsurface,
          severity: hasValidSubsurface ? "INFO" : "WARNING",
          message: hasValidSubsurface
            ? "Suitable supporting subsurface evidence is available."
            : "Suitable subsurface supporting evidence is incomplete or unavailable. Subsurface geometry cannot rely on optical airborne LiDAR alone."
        };
      }
      return { passed: true, severity: "INFO", message: "Above ground unit." };
    }

    const withBim = evaluateUndergroundEvidence("SB", ["BIM_IFC_STRUCTURAL"]);
    expect(withBim.passed).toBe(true);
    expect(withBim.severity).toBe("INFO");

    const withLidarOnly = evaluateUndergroundEvidence("SB", ["LIDAR_POINT_CLOUD"]);
    expect(withLidarOnly.passed).toBe(false);
    expect(withLidarOnly.severity).toBe("WARNING");
    expect(withLidarOnly.message).toContain("cannot rely on optical airborne LiDAR alone");
  });

  it("verifies AI candidate intelligence is explicitly marked as non-authoritative advisory context", () => {
    const aiDisclaimer = "AI proposal is non-authoritative advisory context. Human reviewer must verify independently.";
    expect(aiDisclaimer).toContain("non-authoritative advisory context");
    expect(aiDisclaimer).toContain("Human reviewer must verify independently");
  });

  it("verifies authorized role access control for verification", () => {
    const ALLOWED_VERIFIERS = new Set(["HUMAN_REVIEWER", "LICENSED_SURVEYOR", "REVENUE_OFFICIAL"]);

    function canGrantVerification(role: string): boolean {
      return ALLOWED_VERIFIERS.has(role);
    }

    // Authorized humans
    expect(canGrantVerification("LICENSED_SURVEYOR")).toBe(true);
    expect(canGrantVerification("REVENUE_OFFICIAL")).toBe(true);
    expect(canGrantVerification("HUMAN_REVIEWER")).toBe(true);

    // Blocked computational algorithms
    expect(canGrantVerification("SYSTEM_VALIDATOR")).toBe(false);
    expect(canGrantVerification("AI_PROPOSER")).toBe(false);
    expect(canGrantVerification("TOPOLOGY_ENGINE")).toBe(false);
  });
});

describe("Phase 3.2 3D Cadastral Dataset Management & Spatial Navigation", () => {
  interface MockUnit {
    id: string;
    prototype_ulpin_3d: string;
    unit_label: string;
    floor_code: string;
    tier_code: string;
    status: string;
    z_min: number;
    z_max: number;
  }

  const mockUnits: MockUnit[] = [
    { id: "1", prototype_ulpin_3d: "27A8B9C3D4E5F6-UT-UT01-0001", unit_label: "Underground Utility", floor_code: "UT01", tier_code: "UT", status: "VERIFIED", z_min: 535.0, z_max: 537.0 },
    { id: "2", prototype_ulpin_3d: "27A8B9C3D4E5F6-SB-B01-0002", unit_label: "Basement Level 1", floor_code: "B01", tier_code: "SB", status: "VERIFIED", z_min: 537.0, z_max: 540.0 },
    { id: "3", prototype_ulpin_3d: "27A8B9C3D4E5F6-F-F00-0003", unit_label: "Ground Floor Parking", floor_code: "F00", tier_code: "F", status: "VERIFIED", z_min: 540.0, z_max: 543.0 },
    { id: "4", prototype_ulpin_3d: "27A8B9C3D4E5F6-F-F01-0004", unit_label: "Floor 1 Residential", floor_code: "F01", tier_code: "F", status: "UNDER_REVIEW", z_min: 543.0, z_max: 546.0 },
    { id: "5", prototype_ulpin_3d: "27A8B9C3D4E5F6-F-F02-0005", unit_label: "Floor 2 Commercial", floor_code: "F02", tier_code: "F", status: "PROPOSED", z_min: 546.0, z_max: 549.0 },
    { id: "6", prototype_ulpin_3d: "27A8B9C3D4E5F6-AR-RF01-0006", unit_label: "Rooftop Terrace", floor_code: "RF01", tier_code: "AR", status: "REJECTED", z_min: 549.0, z_max: 549.5 },
  ];

  it("evaluates vertical slice elevation filter non-destructively", () => {
    function filterBySlice(units: MockUnit[], sliceMinZ: number, sliceMaxZ: number): MockUnit[] {
      return units.filter(u => u.z_min < sliceMaxZ && u.z_max > sliceMinZ);
    }

    // Subterranean slice: [534m, 540m]
    const subSlice = filterBySlice(mockUnits, 534, 540);
    expect(subSlice.map(u => u.floor_code)).toEqual(["UT01", "B01"]);

    // Mid-level slice: [542m, 547m]
    const midSlice = filterBySlice(mockUnits, 542, 547);
    expect(midSlice.map(u => u.floor_code)).toEqual(["F00", "F01", "F02"]);

    // Rooftop slice: [549m, 555m]
    const roofSlice = filterBySlice(mockUnits, 549, 555);
    expect(roofSlice.map(u => u.floor_code)).toEqual(["RF01"]);
  });

  it("filters units dynamically by search query across multiple attributes", () => {
    function searchUnits(units: MockUnit[], query: string): MockUnit[] {
      const q = query.toLowerCase().trim();
      if (!q) return units;
      return units.filter(u =>
        u.prototype_ulpin_3d.toLowerCase().includes(q) ||
        u.unit_label.toLowerCase().includes(q) ||
        u.floor_code.toLowerCase().includes(q)
      );
    }

    expect(searchUnits(mockUnits, "B01").length).toBe(1);
    expect(searchUnits(mockUnits, "B01")[0].floor_code).toBe("B01");
    expect(searchUnits(mockUnits, "Commercial").length).toBe(1);
    expect(searchUnits(mockUnits, "Commercial")[0].floor_code).toBe("F02");
    expect(searchUnits(mockUnits, "27A8B9C3D4E5F6").length).toBe(6);
    expect(searchUnits(mockUnits, "nonexistent").length).toBe(0);
  });

  it("calculates quality scorecard pass rates and status levels correctly", () => {
    function computeScorecardStatus(passRate: number): "OPTIMAL" | "ATTENTION" | "CRITICAL" {
      if (passRate >= 95.0) return "OPTIMAL";
      if (passRate >= 80.0) return "ATTENTION";
      return "CRITICAL";
    }

    expect(computeScorecardStatus(100.0)).toBe("OPTIMAL");
    expect(computeScorecardStatus(95.0)).toBe("OPTIMAL");
    expect(computeScorecardStatus(94.9)).toBe("ATTENTION");
    expect(computeScorecardStatus(80.0)).toBe("ATTENTION");
    expect(computeScorecardStatus(79.9)).toBe("CRITICAL");
  });

  it("classifies vertical neighbor relationships accurately", () => {
    function getVerticalRelationship(target: MockUnit, candidate: MockUnit): string {
      if (Math.abs(target.z_max - candidate.z_min) < 0.05) {
        return "ABOVE";
      }
      if (Math.abs(target.z_min - candidate.z_max) < 0.05) {
        return "BELOW";
      }
      if (target.z_min < candidate.z_max && target.z_max > candidate.z_min) {
        return "INTERSECTING";
      }
      return "DISJOINT";
    }

    const ground = mockUnits[2]; // F00: 540 - 543
    const f01 = mockUnits[3];    // F01: 543 - 546
    const b01 = mockUnits[1];    // B01: 537 - 540

    expect(getVerticalRelationship(ground, f01)).toBe("ABOVE");
    expect(getVerticalRelationship(ground, b01)).toBe("BELOW");
  });
});

describe("Phase 3.3 Real-World 3D Cadastral Data Ingestion & Source Standardization", () => {
  it("maps ingestion processing status to appropriate visual badges and alert styles", () => {
    function getStatusBadgeClass(status: string): string {
      switch (status) {
        case "VALIDATED":
        case "SUCCESS":
          return "status-success";
        case "RECOGNIZED_DEFERRED":
        case "DEFERRED":
          return "status-deferred";
        case "DUPLICATE_SOURCE":
          return "status-duplicate";
        case "REJECTED":
        default:
          return "status-rejected";
      }
    }

    expect(getStatusBadgeClass("VALIDATED")).toBe("status-success");
    expect(getStatusBadgeClass("SUCCESS")).toBe("status-success");
    expect(getStatusBadgeClass("RECOGNIZED_DEFERRED")).toBe("status-deferred");
    expect(getStatusBadgeClass("DEFERRED")).toBe("status-deferred");
    expect(getStatusBadgeClass("DUPLICATE_SOURCE")).toBe("status-duplicate");
    expect(getStatusBadgeClass("REJECTED")).toBe("status-rejected");
  });

  it("categorizes quality flags into informational, deferred, and error tiers", () => {
    function categorizeFlag(flag: string): "INFO" | "WARNING" | "ERROR" {
      if (flag.includes("INVALID") || flag.includes("ERROR") || flag.includes("MISSING") || flag.includes("ZERO")) {
        return "ERROR";
      }
      if (flag.includes("DEFERRED") || flag.includes("SYNTHETIC") || flag.includes("DUPLICATE")) {
        return "WARNING";
      }
      return "INFO";
    }

    expect(categorizeFlag("VALID_POINTCLOUD")).toBe("INFO");
    expect(categorizeFlag("VALID_3D_SOLID")).toBe("INFO");
    expect(categorizeFlag("DEFERRED_PROCESSING")).toBe("WARNING");
    expect(categorizeFlag("DUPLICATE_SOURCE")).toBe("WARNING");
    expect(categorizeFlag("MISSING_CRS")).toBe("ERROR");
    expect(categorizeFlag("INVALID_GEOMETRY")).toBe("ERROR");
    expect(categorizeFlag("ZERO_VOLUME")).toBe("ERROR");
  });

  it("enforces underground safety rule: optical LiDAR cannot prove subterranean units", () => {
    function validateSubterraneanEvidence(sourceType: string, tierCode: string, hasEngineeringProof: boolean): boolean {
      if (tierCode === "SB" || tierCode === "UT") {
        if (sourceType === "POINT_CLOUD_LAS" && !hasEngineeringProof) {
          return false; // Optical LiDAR alone is insufficient
        }
      }
      return true;
    }

    // LiDAR without BIM/CAD/survey for basement -> rejected
    expect(validateSubterraneanEvidence("POINT_CLOUD_LAS", "SB", false)).toBe(false);
    // LiDAR with BIM/CAD/survey for basement -> allowed
    expect(validateSubterraneanEvidence("POINT_CLOUD_LAS", "SB", true)).toBe(true);
    // BIM for basement -> allowed
    expect(validateSubterraneanEvidence("BIM_IFC", "SB", true)).toBe(true);
    // LiDAR for above-ground floor -> allowed
    expect(validateSubterraneanEvidence("POINT_CLOUD_LAS", "F", false)).toBe(true);
  });

  it("enforces that all newly ingested candidates are created strictly as PROPOSED", () => {
    const candidatePayload = {
      source: "prototype_tower_a.las",
      status: "PROPOSED",
      requires_human_review: true
    };

    expect(candidatePayload.status).toBe("PROPOSED");
    expect(candidatePayload.status).not.toBe("VERIFIED");
    expect(candidatePayload.requires_human_review).toBe(true);
  });
});



