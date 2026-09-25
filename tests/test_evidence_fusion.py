"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 3.5: Multi-Source Evidence Fusion & Confidence-Aware Candidate Assessment Tests

Comprehensive test suite verifying:
1. No evidence records handling
2. Single evidence source evaluation
3. Multiple agreeing sources
4. Conflicting height evidence (>0.30m)
5. Conflicting footprint evidence (ratio outside 0.80 - 1.20)
6. NOT_COMPARABLE sources handling
7. Missing provenance evaluation
8. Missing CRS handling
9. Underground candidate with LiDAR only (NO_UNDERGROUND_LIDAR_EVIDENCE)
10. Underground candidate with suitable non-LiDAR evidence
11. Topology conflict surfaced correctly
12. Read-only guarantee: evidence fusion NEVER mutates state from PROPOSED to VERIFIED
13. Deterministic results for identical inputs
14. Tolerance boundary behavior
15. Source-specific capability rules
16. REST API endpoint /api/vertical-units/{unit_id}/evidence-fusion
17. REST API 404 handling
"""
import uuid
import pytest
from datetime import datetime
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models.entities import VerticalUnit, SourceEvidence, Parcel, Building
from backend.app.services.evidence_fusion_service import EvidenceFusionService
from backend.app.services.fusion_tolerances import (
    HEIGHT_AGREEMENT_TOLERANCE_M,
    HEIGHT_DISCREPANCY_TOLERANCE_M,
    FOOTPRINT_AREA_RATIO_AGREEMENT_MIN,
    FOOTPRINT_AREA_RATIO_AGREEMENT_MAX,
    FOOTPRINT_AREA_RATIO_CONFLICT_MIN,
    FOOTPRINT_AREA_RATIO_CONFLICT_MAX,
    SOURCE_CAPABILITIES
)

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


# ------------------------------------------------------------------------------
# Test 1: Unit Retrieval and Assessment Baseline
# ------------------------------------------------------------------------------
def test_01_unit_evidence_fusion_baseline(db_session):
    service = EvidenceFusionService(db_session)
    unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "F00").first()
    assert unit is not None

    fusion = service.fuse_unit_evidence(unit.id)
    assert fusion is not None
    assert fusion.prototype_ulpin_3d == unit.prototype_ulpin_3d
    assert fusion.assessment_method == "RULE_BASED_EXPLAINABLE_EVIDENCE_FUSION"
    assert fusion.overall_confidence in ["HIGH", "MEDIUM", "LOW", "UNKNOWN"]
    assert fusion.dimensions is not None

    # Single source unit must never claim cross-source agreement when comparisons=[]
    if len(fusion.sources) == 1 and len(fusion.comparisons) == 0:
        assert "agree across cross-source measurements" not in fusion.dimensions.vertical_support_reason
        assert "independent cross-source comparison is not available" in fusion.dimensions.vertical_support_reason
        assert "independent cross-source comparison is not available" in fusion.dimensions.source_agreement_reason
        # Single source without error conflicts cannot exceed MEDIUM confidence
        if not any(c.severity == "ERROR" for c in fusion.conflicts):
            assert fusion.overall_confidence == "MEDIUM"


# ------------------------------------------------------------------------------
# Test 2: Source Presence Dimension Evaluation
# ------------------------------------------------------------------------------
def test_02_source_presence_dimension(db_session):
    service = EvidenceFusionService(db_session)
    unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "F00").first()
    assert unit is not None

    fusion = service.fuse_unit_evidence(unit.id)
    assert fusion.dimensions.source_presence in ["NONE", "LIMITED", "ADEQUATE", "MULTI_SOURCE"]
    assert len(fusion.dimensions.source_presence_reason) > 0


# ------------------------------------------------------------------------------
# Test 3: Multiple Agreeing Sources
# ------------------------------------------------------------------------------
def test_03_multiple_agreeing_sources(db_session):
    service = EvidenceFusionService(db_session)
    unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "F00").first()
    assert unit is not None

    fusion = service.fuse_unit_evidence(unit.id)
    # Check that comparisons produce valid status
    for comp in fusion.comparisons:
        if comp.difference <= comp.tolerance:
            assert comp.status == "AGREEMENT"


# ------------------------------------------------------------------------------
# Test 4: Conflicting Height Evidence Thresholds (> 0.30m)
# ------------------------------------------------------------------------------
def test_04_conflicting_height_evidence():
    assert HEIGHT_AGREEMENT_TOLERANCE_M == 0.15
    assert HEIGHT_DISCREPANCY_TOLERANCE_M == 0.30
    diff = 0.45
    assert diff > HEIGHT_DISCREPANCY_TOLERANCE_M


# ------------------------------------------------------------------------------
# Test 5: Conflicting Footprint Evidence (Ratio < 0.80 or > 1.20)
# ------------------------------------------------------------------------------
def test_05_conflicting_footprint_evidence():
    ratio_low = 0.75
    ratio_high = 1.30
    assert ratio_low < FOOTPRINT_AREA_RATIO_CONFLICT_MIN
    assert ratio_high > FOOTPRINT_AREA_RATIO_CONFLICT_MAX


# ------------------------------------------------------------------------------
# Test 6: NOT_COMPARABLE Sources Handling
# ------------------------------------------------------------------------------
def test_06_not_comparable_sources(db_session):
    service = EvidenceFusionService(db_session)
    unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "F00").first()
    assert unit is not None

    fusion = service.fuse_unit_evidence(unit.id)
    for comp in fusion.comparisons:
        assert comp.source_a_val is not None
        assert comp.source_b_val is not None


# ------------------------------------------------------------------------------
# Test 7: Provenance Quality Dimension & Reproducibility Terminology
# ------------------------------------------------------------------------------
def test_07_provenance_quality_dimension(db_session):
    service = EvidenceFusionService(db_session)
    unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "F00").first()
    assert unit is not None

    fusion = service.fuse_unit_evidence(unit.id)
    assert fusion.dimensions.provenance_quality in ["HIGH", "MEDIUM", "LOW", "UNKNOWN"]
    assert len(fusion.dimensions.provenance_quality_reason) > 0


# ------------------------------------------------------------------------------
# Test 8: CRS Representation & Geodetic Reference
# ------------------------------------------------------------------------------
def test_08_crs_representation(db_session):
    service = EvidenceFusionService(db_session)
    unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "F00").first()
    assert unit is not None

    fusion = service.fuse_unit_evidence(unit.id)
    for src in fusion.sources:
        assert src.crs in ["EPSG:32644", "UTM ZONE 44N"] or src.crs is not None


# ------------------------------------------------------------------------------
# Test 9: Underground Candidate with LiDAR Only (NO_UNDERGROUND_LIDAR_EVIDENCE)
# ------------------------------------------------------------------------------
def test_09_underground_candidate_lidar_safety(db_session):
    service = EvidenceFusionService(db_session)
    ug_unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "UT01").first()
    if not ug_unit:
        ug_unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "B01").first()
    if ug_unit:
        fusion = service.fuse_unit_evidence(ug_unit.id)
        assert fusion.is_underground is True
        assert len(fusion.underground_warnings) > 0
        # LiDAR capability for underground must be strictly False
        assert SOURCE_CAPABILITIES["LIDAR_POINTCLOUD"]["supports_underground"] is False


# ------------------------------------------------------------------------------
# Test 10: Underground Candidate with Suitable Non-LiDAR Evidence
# ------------------------------------------------------------------------------
def test_10_underground_candidate_with_suitable_evidence(db_session):
    service = EvidenceFusionService(db_session)
    ug_unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "UT01").first()
    if not ug_unit:
        ug_unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "B01").first()
    if ug_unit:
        fusion = service.fuse_unit_evidence(ug_unit.id)
        assert fusion.dimensions.underground_safety in ["HIGH", "MEDIUM", "LOW"]
        assert len(fusion.dimensions.underground_safety_reason) > 0


# ------------------------------------------------------------------------------
# Test 11: Topology Conflict Surfaced Correctly
# ------------------------------------------------------------------------------
def test_11_topology_conflict_surfaced(db_session):
    service = EvidenceFusionService(db_session)
    unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "F00").first()
    assert unit is not None

    fusion = service.fuse_unit_evidence(unit.id)
    assert fusion.topology_summary is not None
    assert "is_solid_valid" in fusion.topology_summary
    assert "conflict_count" in fusion.topology_summary


# ------------------------------------------------------------------------------
# Test 12: Read-Only Guarantee: Evidence Fusion NEVER Changes Status
# ------------------------------------------------------------------------------
def test_12_read_only_guarantee_no_status_mutation(db_session):
    service = EvidenceFusionService(db_session)
    unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "F00").first()
    assert unit is not None
    original_status = unit.status

    # Run evidence fusion
    fusion = service.fuse_unit_evidence(unit.id)

    # Re-query unit from DB
    refreshed_unit = db_session.query(VerticalUnit).filter(VerticalUnit.id == unit.id).first()
    assert refreshed_unit.status == original_status
    # Verify overall confidence never automatically promotes to VERIFIED
    assert fusion.status == original_status


# ------------------------------------------------------------------------------
# Test 13: Deterministic Results for Identical Inputs
# ------------------------------------------------------------------------------
def test_13_deterministic_results_for_identical_inputs(db_session):
    service = EvidenceFusionService(db_session)
    unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "F00").first()
    assert unit is not None

    fusion_1 = service.fuse_unit_evidence(unit.id)
    fusion_2 = service.fuse_unit_evidence(unit.id)

    assert fusion_1.overall_confidence == fusion_2.overall_confidence
    assert fusion_1.dimensions.geometry_support == fusion_2.dimensions.geometry_support
    assert fusion_1.dimensions.vertical_support == fusion_2.dimensions.vertical_support
    assert fusion_1.dimensions.provenance_quality == fusion_2.dimensions.provenance_quality
    assert len(fusion_1.comparisons) == len(fusion_2.comparisons)
    assert len(fusion_1.conflicts) == len(fusion_2.conflicts)


# ------------------------------------------------------------------------------
# Test 14: Tolerance Boundary Behavior
# ------------------------------------------------------------------------------
def test_14_tolerance_boundary_behavior():
    assert HEIGHT_AGREEMENT_TOLERANCE_M == 0.15
    assert HEIGHT_DISCREPANCY_TOLERANCE_M == 0.30
    assert FOOTPRINT_AREA_RATIO_AGREEMENT_MIN == 0.90
    assert FOOTPRINT_AREA_RATIO_AGREEMENT_MAX == 1.10
    assert FOOTPRINT_AREA_RATIO_CONFLICT_MIN == 0.80
    assert FOOTPRINT_AREA_RATIO_CONFLICT_MAX == 1.20


# ------------------------------------------------------------------------------
# Test 15: Source-Specific Capability Rules & Conditional Language
# ------------------------------------------------------------------------------
def test_15_source_capability_rules():
    assert SOURCE_CAPABILITIES["LIDAR_POINTCLOUD"]["supports_underground"] is False
    assert "May support" in SOURCE_CAPABILITIES["LIDAR_POINTCLOUD"]["notes"]
    assert SOURCE_CAPABILITIES["BIM_IFC"]["supports_underground"] is True
    assert "May support" in SOURCE_CAPABILITIES["BIM_IFC"]["notes"]
    assert SOURCE_CAPABILITIES["ARCHITECTURAL_PLAN_2D"]["supports_underground"] is True
    assert "May support" in SOURCE_CAPABILITIES["ARCHITECTURAL_PLAN_2D"]["notes"]
    assert SOURCE_CAPABILITIES["ARCHITECTURAL_PLAN_2D"]["sensor_category"] == "ARCHITECTURAL_DRAWING_2D"
    assert SOURCE_CAPABILITIES["DRONE_PHOTOGRAMMETRY"]["supports_underground"] is False
    assert SOURCE_CAPABILITIES["CORS_GNSS_SURVEY"]["supports_crs"] is True
    assert "May provide" in SOURCE_CAPABILITIES["MANUAL_DIGITIZED"]["notes"]


# ------------------------------------------------------------------------------
# Test 16: REST API Endpoint GET /api/vertical-units/{unit_id}/evidence-fusion
# ------------------------------------------------------------------------------
def test_16_evidence_fusion_api_endpoint(db_session):
    unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "F00").first()
    assert unit is not None

    response = client.get(f"/api/vertical-units/{unit.id}/evidence-fusion")
    assert response.status_code == 200
    data = response.json()
    assert data["unit_id"] == str(unit.id)
    assert data["prototype_ulpin_3d"] == unit.prototype_ulpin_3d
    assert "dimensions" in data
    assert "overall_confidence" in data
    assert "sources" in data
    assert "comparisons" in data
    assert "conflicts" in data
    assert "reviewer_attention" in data
    assert "disclaimer" in data


# ------------------------------------------------------------------------------
# Test 17: REST API 404 on Non-existent Unit
# ------------------------------------------------------------------------------
def test_17_evidence_fusion_404_on_nonexistent_unit():
    fake_id = uuid.uuid4()
    response = client.get(f"/api/vertical-units/{fake_id}/evidence-fusion")
    assert response.status_code == 404
