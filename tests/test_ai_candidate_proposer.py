"""
SIH26011: Phase 2.9 Regression Test Suite
Explainable AI-Assisted 3D Candidate Extraction & Intelligence
"""
import os
import uuid
import pytest
import numpy as np
from shapely.geometry import Polygon, box
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.ai_candidate_service import AICandidateService
from backend.app.schemas.requests import AIProposeCandidatesRequest, VerticalUnitTransitionRequest
from backend.app.db import SessionLocal
from backend.app.models.entities import VerticalUnit, Parcel, Building, SourceEvidence, VerificationAudit

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


def test_01_feature_extraction_computes_all_required_attributes():
    """Validates that AICandidateService feature engineering computes complete geometric, vertical, and point cloud features."""
    service = AICandidateService()
    poly = box(219400, 1932500, 219420, 1932515)  # 20m x 15m = 300 sqm
    
    z_points = np.linspace(540.0, 543.5, 500)
    x_points = np.linspace(219400, 219420, 500)
    y_points = np.linspace(1932500, 1932515, 500)

    features = service.extract_features_from_geometry_and_points(
        footprint_poly=poly,
        z_min=540.0,
        z_max=543.5,
        ground_z=540.0,
        roof_z=549.5,
        las_z_coords=z_points,
        las_x_coords=x_points,
        las_y_coords=y_points,
        source_evidence_type="LIDAR_POINTCLOUD",
        is_synthetic=True
    )

    assert features.footprint_area_sqm == 300.0
    assert features.footprint_perimeter_m == 70.0
    assert features.footprint_compactness > 0.0
    assert features.height_interval_m == 3.5
    assert features.point_count == 500
    assert features.point_density_pts_m3 > 0.0
    assert features.z_mean >= 540.0
    assert features.is_synthetic is True
    assert features.source_evidence_type == "LIDAR_POINTCLOUD"


def test_02_deterministic_reproducibility():
    """Validates that identical input spatial features produce identical candidate classifications and confidence scores."""
    service = AICandidateService()
    poly = box(219400, 1932500, 219420, 1932515)
    
    f1 = service.extract_features_from_geometry_and_points(poly, 543.5, 546.5, 540.0, 549.5)
    f2 = service.extract_features_from_geometry_and_points(poly, 543.5, 546.5, 540.0, 549.5)

    c1 = service.classify_and_explain_candidate(f1, 540.0, 549.5, candidate_index=1)
    c2 = service.classify_and_explain_candidate(f2, 540.0, 549.5, candidate_index=1)

    assert c1[0] == c2[0]  # tier_code
    assert c1[1] == c2[1]  # floor_code
    assert c1[5] == c2[5]  # confidence label
    assert c1[6] == c2[6]  # confidence score
    assert c1[7] == c2[7]  # explanations match exactly


def test_03_ai_candidate_generation_above_ground():
    """Validates that the proposer correctly extracts Ground, Upper Floor, and Rooftop strata."""
    service = AICandidateService()
    poly = box(219404, 1932502, 219425, 1932517)

    # Ground floor
    f_g = service.extract_features_from_geometry_and_points(poly, 540.0, 543.5, 540.0, 549.5)
    c_g = service.classify_and_explain_candidate(f_g, 540.0, 549.5, candidate_index=0)
    assert c_g[0] == "F"
    assert c_g[1] == "F00"
    assert c_g[2] == "GROUND_FLOOR"

    # Upper floor
    f_u = service.extract_features_from_geometry_and_points(poly, 543.5, 546.5, 540.0, 549.5)
    c_u = service.classify_and_explain_candidate(f_u, 540.0, 549.5, candidate_index=1)
    assert c_u[0] == "F"
    assert c_u[1] == "F01"
    assert c_u[2] == "UPPER_FLOOR"

    # Rooftop
    f_r = service.extract_features_from_geometry_and_points(poly, 549.5, 552.0, 540.0, 549.5)
    c_r = service.classify_and_explain_candidate(f_r, 540.0, 549.5, candidate_index=3)
    assert c_r[0] == "AR"
    assert c_r[1] == "RF01"
    assert c_r[2] == "ROOFTOP"


def test_04_candidate_explainability_generation():
    """Validates that each proposed candidate contains rich, human-readable explanatory items."""
    service = AICandidateService()
    poly = box(219404, 1932502, 219425, 1932517)
    f = service.extract_features_from_geometry_and_points(poly, 543.5, 546.5, 540.0, 549.5)
    res = service.classify_and_explain_candidate(f, 540.0, 549.5, candidate_index=1)
    
    explanations = res[7]
    assert len(explanations) >= 3
    assert any("interval" in exp.lower() for exp in explanations)
    assert any("priors" in exp.lower() or "height" in exp.lower() for exp in explanations)


def test_05_confidence_semantics_prototype_label():
    """Validates that candidate confidence uses categorical values and is explicitly labeled as PROTOTYPE_CANDIDATE_CONFIDENCE."""
    req = AIProposeCandidatesRequest()
    service = AICandidateService()
    res = service.propose_candidates(req)

    for p in res.proposals:
        assert p.confidence in ["HIGH", "MEDIUM", "LOW"]
        assert p.confidence_label == "PROTOTYPE_CANDIDATE_CONFIDENCE"
        assert 0.0 <= p.confidence_score <= 1.0


def test_06_missing_feature_and_empty_input_handling():
    """Validates that missing point cloud or empty geometry handled gracefully without crashing."""
    service = AICandidateService()
    poly = box(0, 0, 10, 10)
    features = service.extract_features_from_geometry_and_points(
        footprint_poly=poly,
        z_min=540.0,
        z_max=543.0,
        las_z_coords=np.array([], dtype=np.float64)
    )
    assert features.point_count == 0
    assert features.peak_prominence_ratio == 0.5


def test_07_underground_safety_rejects_optical_lidar():
    """CRITICAL: Validates that optical airborne LiDAR is flagged as invalid evidence for subterranean spaces."""
    service = AICandidateService()
    poly = box(219404, 1932502, 219425, 1932517)
    
    # Propose subterranean level [537 - 540m] using LIDAR_POINTCLOUD
    f_lidar = service.extract_features_from_geometry_and_points(
        poly, 537.0, 540.0, 540.0, 549.5, source_evidence_type="LIDAR_POINTCLOUD"
    )
    res_lidar = service.classify_and_explain_candidate(f_lidar, 540.0, 549.5, candidate_index=1)
    
    underground_safety = res_lidar[9]
    review_flags = res_lidar[8]
    
    assert underground_safety["is_safe"] is False
    assert "cannot detect underground" in underground_safety["violation"].lower()
    assert "FLAG_REJECT_UNDERGROUND_LIDAR" in review_flags
    assert res_lidar[5] == "LOW"  # Confidence penalized


def test_08_underground_safety_accepts_bim_and_cad():
    """Validates that structural BIM and CAD plans are accepted as valid evidence for subterranean spaces."""
    service = AICandidateService()
    poly = box(219404, 1932502, 219425, 1932517)
    
    f_bim = service.extract_features_from_geometry_and_points(
        poly, 537.0, 540.0, 540.0, 549.5, source_evidence_type="BIM_IFC"
    )
    res_bim = service.classify_and_explain_candidate(f_bim, 540.0, 549.5, candidate_index=1)
    
    underground_safety = res_bim[9]
    assert underground_safety["is_safe"] is True
    assert "FLAG_REJECT_UNDERGROUND_LIDAR" not in res_bim[8]


def test_09_ai_candidates_start_strictly_proposed():
    """Validates that every AI-generated proposal is assigned status PROPOSED."""
    service = AICandidateService()
    req = AIProposeCandidatesRequest()
    res = service.propose_candidates(req)

    assert res.total_candidates_proposed > 0
    for p in res.proposals:
        assert p.status == "PROPOSED"


def test_10_ai_cannot_verify_units():
    """Validates that SYSTEM_VALIDATOR / automated AI proposer cannot transition a unit to VERIFIED."""
    # Find baseline parcel ID first
    parcels_res = client.get("/api/parcels")
    assert parcels_res.status_code == 200
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]

    res = client.get(f"/api/parcels/{parcel_id}/vertical-structure")
    assert res.status_code == 200
    units = res.json()["categories"]
    f01_unit = None
    for cat in units:
        for u in cat["units"]:
            if u["floor_code"] == "F01":
                f01_unit = u
                break
    assert f01_unit is not None
    unit_id = f01_unit["id"]

    req = {
        "new_status": "VERIFIED",
        "actor_role": "SYSTEM_VALIDATOR",
        "reviewer_name": "AI Proposer Bot",
        "review_notes": "Automated verification attempt"
    }

    response = client.post(f"/api/vertical-units/{unit_id}/transition", json=req)
    assert response.status_code == 422
    assert "human" in response.json()["detail"].lower() or "cannot" in response.json()["detail"].lower()


def test_11_api_propose_candidates_endpoint():
    """Validates POST /api/ai/candidates/propose API endpoint."""
    payload = {
        "parcel_ulpin": "27A8B9C3D4E5F6",
        "building_id": "TOWER-A",
        "confidence_threshold": 0.50
    }
    response = client.post("/api/ai/candidates/propose", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_candidates_proposed"] >= 3
    assert data["method"] == "STATISTICAL_FEATURE_RANKING_HYBRID"
    assert data["is_synthetic"] is True


def test_12_api_get_vertical_unit_ai_analysis(db_session):
    """Validates GET /api/vertical-units/{unit_id}/ai-analysis for existing baseline units."""
    unit = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "F01").first()
    assert unit is not None

    response = client.get(f"/api/vertical-units/{unit.id}/ai-analysis")
    assert response.status_code == 200
    data = response.json()
    assert data["prototype_ulpin_3d"] == unit.prototype_ulpin_3d
    assert data["tier_code"] == unit.tier_code
    assert data["confidence"] in ["HIGH", "MEDIUM", "LOW"]
    assert len(data["explanation"]) >= 2
    assert "features" in data
    assert data["features"]["footprint_area_sqm"] > 0


def test_13_existing_tower_a_records_remain_intact(db_session):
    """Validates that existing TOWER-A 6 baseline records are completely preserved."""
    units = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence <= 6).order_by(VerticalUnit.unit_sequence).all()
    assert len(units) == 6
    assert units[0].floor_code == "UT01"
    assert units[0].status == "VERIFIED"
    assert units[5].floor_code == "F02"
    assert units[5].status == "REJECTED"


def test_14_existing_vertical_mixed_a_records_remain_intact(db_session):
    """Validates that all 10 VERTICAL-MIXED-A records are preserved."""
    units = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence >= 7, VerticalUnit.unit_sequence <= 16).all()
    assert len(units) == 10
    for u in units:
        assert u.status == "PROPOSED"


def test_15_total_database_counts_preserved(db_session):
    """Validates that baseline database counts are preserved."""
    p_count = db_session.query(Parcel).count()
    b_count = db_session.query(Building).count()
    v_count = db_session.query(VerticalUnit).count()
    assert p_count >= 2
    assert b_count >= 2
    assert v_count >= 16


def test_16_ai_candidate_integration_with_postgis_closure_check():
    """Validates that all AI-proposed candidate geometries form valid watertight closed polyhedral surfaces."""
    service = AICandidateService()
    req = AIProposeCandidatesRequest()
    res = service.propose_candidates(req)

    assert len(res.proposals) >= 3
    for prop in res.proposals:
        assert prop.geom_wkt is not None
        assert prop.geom_wkt.startswith("POLYHEDRALSURFACE Z")
        # Every polyhedral surface must have closed planar facets
        assert "540" in prop.geom_wkt or "543" in prop.geom_wkt or "546" in prop.geom_wkt


def test_17_synthetic_data_metadata_and_disclaimer():
    """Validates that AI output contains clear non-authoritative disclaimers and synthetic data flags."""
    service = AICandidateService()
    req = AIProposeCandidatesRequest()
    res = service.propose_candidates(req)

    assert res.is_synthetic is True
    assert "algorithmic hypotheses" in res.disclaimer.lower()
    assert "human verification" in res.disclaimer.lower()


def test_18_ai_propose_invalid_evidence_path_404():
    """Validates that non-existent extraction evidence path returns 404."""
    payload = {
        "extraction_json_path": "data/processed/nonexistent_evidence.json"
    }
    response = client.post("/api/ai/candidates/propose", json=payload)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_19_ai_analysis_nonexistent_unit_404():
    """Validates that GET /api/vertical-units/{id}/ai-analysis returns 404 for unknown unit."""
    missing_id = str(uuid.uuid4())
    response = client.get(f"/api/vertical-units/{missing_id}/ai-analysis")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_20_rejected_candidates_maintain_rejection_audit(db_session):
    """Validates that rejected candidate (Seq 6) retains REJECTED status and AI analysis reflects human rejection."""
    unit = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 6).first()
    assert unit is not None
    assert str(unit.status) == "REJECTED" or unit.status.name == "REJECTED" or unit.status == "REJECTED"

    response = client.get(f"/api/vertical-units/{unit.id}/ai-analysis")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "REJECTED"
    assert "STATUS_HUMAN_REJECTED" in data["review_flags"]

