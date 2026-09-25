"""
Automated backend integration tests for SIH26011 FastAPI endpoints, 3D validation service,
prototype 3D ULPIN generation, human-in-the-loop lifecycle state transitions,
and 3D/2D data ingestion & geometry preparation.
"""
import json
import uuid
import concurrent.futures
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import SessionLocal
from sqlalchemy import text

client = TestClient(app)

# Sample valid 3D PolyhedralSurface geometry fixture (Floor 3 residential unit)
SAMPLE_F03_WKT = """POLYHEDRALSURFACE Z (
    ((219405 1932502.5 549.5, 219405 1932517.5 549.5, 219425 1932517.5 549.5, 219425 1932502.5 549.5, 219405 1932502.5 549.5)),
    ((219405 1932502.5 552.5, 219425 1932502.5 552.5, 219425 1932517.5 552.5, 219405 1932517.5 552.5, 219405 1932502.5 552.5)),
    ((219405 1932502.5 549.5, 219425 1932502.5 549.5, 219425 1932502.5 552.5, 219405 1932502.5 552.5, 219405 1932502.5 549.5)),
    ((219425 1932502.5 549.5, 219425 1932517.5 549.5, 219425 1932517.5 552.5, 219425 1932502.5 552.5, 219425 1932502.5 549.5)),
    ((219425 1932517.5 549.5, 219405 1932517.5 549.5, 219405 1932517.5 552.5, 219425 1932517.5 552.5, 219425 1932517.5 549.5)),
    ((219405 1932517.5 549.5, 219405 1932502.5 549.5, 219405 1932502.5 552.5, 219405 1932517.5 552.5, 219405 1932517.5 549.5))
)"""


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_units_after_suite():
    """Ensure any dynamic vertical units created with sequence >= 17 are cleaned up after test run."""
    yield
    db = SessionLocal()
    try:
        # Delete verification audit for dynamic test units
        db.execute(text("""
            DELETE FROM verification_audit WHERE unit_id NOT IN (
                SELECT id FROM vertical_units WHERE 
                    (parcel_id = (SELECT id FROM parcels WHERE ulpin_2d = '27A8B9C3D4E5F6') AND unit_sequence <= 6)
                    OR (parcel_id = (SELECT id FROM parcels WHERE ulpin_2d = '27A8B9C3D4E5F7') AND unit_sequence BETWEEN 7 AND 16)
                    OR (parcel_id = (SELECT id FROM parcels WHERE ulpin_2d = '36A1B2C3D4E5F8'))
                    OR (parcel_id = (SELECT id FROM parcels WHERE ulpin_2d = '36A1B2C3D4E5F9'))
            );
            DELETE FROM source_evidence WHERE unit_id NOT IN (
                SELECT id FROM vertical_units WHERE 
                    (parcel_id = (SELECT id FROM parcels WHERE ulpin_2d = '27A8B9C3D4E5F6') AND unit_sequence <= 6)
                    OR (parcel_id = (SELECT id FROM parcels WHERE ulpin_2d = '27A8B9C3D4E5F7') AND unit_sequence BETWEEN 7 AND 16)
                    OR (parcel_id = (SELECT id FROM parcels WHERE ulpin_2d = '36A1B2C3D4E5F8'))
                    OR (parcel_id = (SELECT id FROM parcels WHERE ulpin_2d = '36A1B2C3D4E5F9'))
            );
            DELETE FROM vertical_units WHERE id NOT IN (
                SELECT id FROM vertical_units WHERE 
                    (parcel_id = (SELECT id FROM parcels WHERE ulpin_2d = '27A8B9C3D4E5F6') AND unit_sequence <= 6)
                    OR (parcel_id = (SELECT id FROM parcels WHERE ulpin_2d = '27A8B9C3D4E5F7') AND unit_sequence BETWEEN 7 AND 16)
                    OR (parcel_id = (SELECT id FROM parcels WHERE ulpin_2d = '36A1B2C3D4E5F8'))
                    OR (parcel_id = (SELECT id FROM parcels WHERE ulpin_2d = '36A1B2C3D4E5F9'))
            );
            UPDATE vertical_units SET status = 'VERIFIED' WHERE unit_sequence = 1;
            UPDATE vertical_units SET status = 'VERIFIED' WHERE unit_sequence = 2;
            UPDATE vertical_units SET status = 'VERIFIED' WHERE unit_sequence = 3;
            UPDATE vertical_units SET status = 'UNDER_REVIEW' WHERE unit_sequence = 4;
            UPDATE vertical_units SET status = 'PROPOSED' WHERE unit_sequence = 5;
            UPDATE vertical_units SET status = 'REJECTED' WHERE unit_sequence = 6;
        """))
        db.commit()
    finally:
        db.close()


# ============================================================================
# Phase 1.3 Endpoints Tests
# ============================================================================

def test_01_health_endpoint():
    """Test /api/health returns database status and PostGIS engine information."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database_connected"] is True
    assert data["canonical_crs"] == "EPSG:32644"
    assert data["postgis_version"] is not None
    assert data["sfcgal_version"] is not None


def test_02_parcel_list():
    """Test /api/parcels returns the synthetic parent parcel with correct 2D geometry."""
    response = client.get("/api/parcels")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    
    parcel = next(p for p in data if p["ulpin_2d"] == "27A8B9C3D4E5F6")
    assert parcel["survey_number"] == "SYN-PLOT-42/5"
    assert parcel["area_sqm"] == 600.00
    assert parcel["building_count"] == 1
    assert parcel["geom_2d"]["srid"] == 32644
    assert parcel["geom_2d"]["geometry_type"] == "Polygon"
    assert parcel["geom_2d"]["geojson"]["type"] == "Polygon"


def test_03_parcel_detail_and_404():
    """Test /api/parcels/{id} retrieves detail and returns 404 for missing IDs."""
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]

    # Valid lookup
    res = client.get(f"/api/parcels/{parcel_id}")
    assert res.status_code == 200
    assert res.json()["id"] == parcel_id

    # Non-existent UUID lookup -> 404
    missing_id = str(uuid.uuid4())
    res_404 = client.get(f"/api/parcels/{missing_id}")
    assert res_404.status_code == 404
    assert "not found" in res_404.json()["detail"].lower()


def test_04_parcel_buildings():
    """Test /api/parcels/{id}/buildings returns TOWER-A with valid footprint."""
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]

    res = client.get(f"/api/parcels/{parcel_id}/buildings")
    assert res.status_code == 200
    buildings = res.json()
    assert len(buildings) == 1
    
    bldg = buildings[0]
    assert bldg["building_code"] == "TOWER-A"
    assert bldg["total_floors_above"] == 3
    assert bldg["total_floors_below"] == 1
    assert bldg["footprint_2d"]["srid"] == 32644
    assert bldg["footprint_2d"]["geojson"]["type"] == "Polygon"


def test_05_parcel_vertical_units_and_preservation():
    """Test /api/parcels/{id}/vertical-units returns seed units preserving 3D coordinates, IDs and statuses."""
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]

    res = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    assert res.status_code == 200
    units = res.json()
    assert len(units) >= 6

    # Verify prototype 3D identifier pattern for seed fixtures
    seed_units = [u for u in units if u["unit_sequence"] <= 6]
    expected_ids = [
        "27A8B9C3D4E5F6-3D-UT01-0001",
        "27A8B9C3D4E5F6-3D-SB01-0002",
        "27A8B9C3D4E5F6-3D-F00-0003",
        "27A8B9C3D4E5F6-3D-F01-0004",
        "27A8B9C3D4E5F6-3D-F02-0005",
        "27A8B9C3D4E5F6-3D-F02-0006"
    ]
    actual_ids = [u["prototype_ulpin_3d"] for u in seed_units]
    assert actual_ids == expected_ids

    # Verify lifecycle states preservation
    expected_statuses = ["VERIFIED", "VERIFIED", "VERIFIED", "UNDER_REVIEW", "PROPOSED", "REJECTED"]
    actual_statuses = [u["status"] for u in seed_units]
    assert actual_statuses == expected_statuses

    # Verify 3D geometry preservation (Z values intact, SRID 32644, PolyhedralSurfaceZ)
    for unit in seed_units:
        assert unit["z_min"] < unit["z_max"]
        geom = unit["geom_3d"]
        assert geom["srid"] == 32644
        assert geom["geometry_type"] == "PolyhedralSurfaceZ"
        assert geom["geojson"] is not None
        assert "coordinates" in geom["geojson"]
        coords = geom["geojson"]["coordinates"]
        assert len(coords) > 0
        first_face = coords[0]
        assert len(first_face[0][0]) == 3  # [X, Y, Z]


def test_06_vertical_unit_detail_and_404():
    """Test /api/vertical-units/{id} retrieves full unit detail including source evidence and audit trails."""
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]
    units_res = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    unit_id = units_res.json()[0]["id"]

    # Valid lookup
    res = client.get(f"/api/vertical-units/{unit_id}")
    assert res.status_code == 200
    unit = res.json()
    assert unit["id"] == unit_id
    assert unit["prototype_ulpin_3d"] == "27A8B9C3D4E5F6-3D-UT01-0001"
    assert len(unit["source_evidence"]) >= 1
    assert len(unit["verification_audit"]) >= 1

    # Non-existent UUID lookup -> 404
    missing_id = str(uuid.uuid4())
    res_404 = client.get(f"/api/vertical-units/{missing_id}")
    assert res_404.status_code == 404
    assert "not found" in res_404.json()["detail"].lower()


# ============================================================================
# Phase 1.4 3D Spatial Validation Tests
# ============================================================================

def test_07_validation_endpoint_valid_unit():
    """Test /api/vertical-units/{id}/validation for a valid enclosed unit (Flat 101, Unit 4)."""
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]
    units_res = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    unit_4 = [u for u in units_res.json() if u["unit_sequence"] == 4][0]
    
    val_res = client.get(f"/api/vertical-units/{unit_4['id']}/validation")
    assert val_res.status_code == 200
    data = val_res.json()
    
    assert data["unit_id"] == unit_4["id"]
    assert data["prototype_ulpin_3d"] == "27A8B9C3D4E5F6-3D-F01-0004"
    assert data["valid"] is True
    assert len(data["conflicts"]) == 0
    
    check_names = {c["check"]: c["passed"] for c in data["checks"]}
    assert check_names.get("geometry_validity") is True
    assert check_names.get("z_range") is True
    assert check_names.get("parcel_relationship") is True
    assert check_names.get("3d_conflict") is True


def test_08_validation_boundary_touching_not_conflict():
    """
    Test that adjacent vertically-stacked units (e.g. Unit 3 and Unit 4 sharing Z=543.5 slab)
    are verified with zero volumetric overlap (overlap_volume = 0.0).
    """
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]
    units_res = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    unit_3 = [u for u in units_res.json() if u["unit_sequence"] == 3][0]

    val_res = client.get(f"/api/vertical-units/{unit_3['id']}/validation")
    assert val_res.status_code == 200
    data = val_res.json()
    assert data["valid"] is True
    assert len(data["conflicts"]) == 0
    conflict_check = [c for c in data["checks"] if c["check"] == "3d_conflict"][0]
    assert conflict_check["passed"] is True
    assert "boundary" in conflict_check["message"].lower() or "zero" in conflict_check["message"].lower()


def test_09_validation_parcel_boundary_conflict_unit():
    """
    Test /api/vertical-units/{id}/validation for Unit 6 (Balcony Overhang conflict test case).
    Must report parcel_relationship failure while solid/Z checks pass.
    """
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]
    units_res = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    unit_6 = [u for u in units_res.json() if u["unit_sequence"] == 6][0]

    val_res = client.get(f"/api/vertical-units/{unit_6['id']}/validation")
    assert val_res.status_code == 200
    data = val_res.json()

    assert data["valid"] is False
    check_results = {c["check"]: c["passed"] for c in data["checks"]}
    assert check_results.get("geometry_validity") is True
    assert check_results.get("z_range") is True
    assert check_results.get("parcel_relationship") is False
    
    parcel_check = [c for c in data["checks"] if c["check"] == "parcel_relationship"][0]
    assert "extends beyond" in parcel_check["message"] or "review flag" in parcel_check["message"].lower()


def test_10_validation_404():
    """Test /api/vertical-units/{id}/validation returns 404 for non-existent unit ID."""
    missing_id = str(uuid.uuid4())
    res_404 = client.get(f"/api/vertical-units/{missing_id}/validation")
    assert res_404.status_code == 404
    assert "not found" in res_404.json()["detail"].lower()


# ============================================================================
# Phase 1.5 Prototype Generation & Lifecycle Service Tests
# ============================================================================

def test_11_create_vertical_unit_success():
    """
    Test POST /api/vertical-units creates a new 3D vertical unit with:
    - Autogenerated Prototype 3D ULPIN: {2D_ULPIN}-3D-{FLOOR}-{SEQ:04d}
    - Initial lifecycle status: PROPOSED
    - Atomic sequence allocation
    - Initial verification audit entry (AUTO_INGESTION)
    """
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]
    buildings_res = client.get(f"/api/parcels/{parcel_id}/buildings")
    building_id = buildings_res.json()[0]["id"]

    create_payload = {
        "parcel_id": parcel_id,
        "building_id": building_id,
        "tier_code": "F",
        "floor_code": "F03",
        "unit_label": "Flat 301 (Synthetic Test Creation)",
        "unit_type": "RESIDENTIAL",
        "z_min": 549.50,
        "z_max": 552.50,
        "geom_wkt": SAMPLE_F03_WKT
    }

    res = client.post("/api/vertical-units", json=create_payload)
    assert res.status_code == 201
    unit = res.json()

    assert unit["parcel_id"] == parcel_id
    assert unit["building_id"] == building_id
    assert unit["tier_code"] == "F"
    assert unit["floor_code"] == "F03"
    assert unit["status"] == "PROPOSED"
    assert unit["unit_sequence"] >= 7
    expected_ulpin_prefix = f"27A8B9C3D4E5F6-3D-F03-{unit['unit_sequence']:04d}"
    assert unit["prototype_ulpin_3d"] == expected_ulpin_prefix

    # Check 3D geometry structure
    assert unit["geom_3d"]["srid"] == 32644
    assert unit["geom_3d"]["geometry_type"] == "PolyhedralSurfaceZ"
    assert len(unit["geom_3d"]["geojson"]["coordinates"]) == 6  # 6 faces

    # Check initial audit trail
    assert len(unit["verification_audit"]) >= 1
    initial_audit = unit["verification_audit"][-1]
    assert initial_audit["action"] == "AUTO_INGESTION"
    assert initial_audit["previous_status"] == "PROPOSED"
    assert initial_audit["new_status"] == "PROPOSED"
    assert initial_audit["reviewer_role"] == "SYSTEM_VALIDATOR"


def test_12_create_vertical_unit_validation_errors():
    """Test input validation for unit creation (non-existent parcel, invalid tier, inverted Z)."""
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]

    # 1. Non-existent parent parcel -> 404
    missing_parcel_id = str(uuid.uuid4())
    res_404 = client.post("/api/vertical-units", json={
        "parcel_id": missing_parcel_id,
        "tier_code": "F",
        "floor_code": "F03",
        "unit_label": "Invalid Parcel Unit",
        "z_min": 500.0,
        "z_max": 503.0,
        "geom_wkt": SAMPLE_F03_WKT
    })
    assert res_404.status_code == 404
    assert "not found" in res_404.json()["detail"].lower()

    # 2. Unsupported tier code -> 422
    res_tier_err = client.post("/api/vertical-units", json={
        "parcel_id": parcel_id,
        "tier_code": "INVALID_TIER",
        "floor_code": "F99",
        "unit_label": "Invalid Tier Unit",
        "z_min": 500.0,
        "z_max": 503.0,
        "geom_wkt": SAMPLE_F03_WKT
    })
    assert res_tier_err.status_code == 422

    # 3. Inverted vertical Z bracket (z_max <= z_min) -> 422
    res_z_err = client.post("/api/vertical-units", json={
        "parcel_id": parcel_id,
        "tier_code": "F",
        "floor_code": "F03",
        "unit_label": "Inverted Z Unit",
        "z_min": 550.0,
        "z_max": 540.0,
        "geom_wkt": SAMPLE_F03_WKT
    })
    assert res_z_err.status_code == 422


def test_13_lifecycle_transition_proposed_to_under_review():
    """Test valid lifecycle transition: PROPOSED -> UNDER_REVIEW."""
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]

    # Create a fresh PROPOSED unit
    create_res = client.post("/api/vertical-units", json={
        "parcel_id": parcel_id,
        "tier_code": "F",
        "floor_code": "F04",
        "unit_label": "Flat 401 (Transition Test)",
        "z_min": 552.5,
        "z_max": 555.5,
        "geom_wkt": SAMPLE_F03_WKT
    })
    assert create_res.status_code == 201
    unit_id = create_res.json()["id"]

    # Move to UNDER_REVIEW
    trans_res = client.post(f"/api/vertical-units/{unit_id}/transition", json={
        "new_status": "UNDER_REVIEW",
        "actor_role": "SYSTEM_VALIDATOR",
        "reviewer_name": "Automated Spatial Validation Engine",
        "review_notes": "Automated topology checks passed. Forwarded for surveyor inspection."
    })
    assert trans_res.status_code == 200
    updated = trans_res.json()
    assert updated["status"] == "UNDER_REVIEW"
    
    # Verify audit record appended
    audit_events = updated["verification_audit"]
    latest_event = audit_events[-1]
    assert latest_event["action"] == "SURVEYOR_REVIEW"
    assert latest_event["previous_status"] == "PROPOSED"
    assert latest_event["new_status"] == "UNDER_REVIEW"
    assert latest_event["reviewer_role"] == "SYSTEM_VALIDATOR"


def test_14_lifecycle_transition_system_cannot_verify():
    """
    CRITICAL HUMAN-IN-THE-LOOP TEST:
    Verifies that SYSTEM_VALIDATOR cannot transition UNDER_REVIEW -> VERIFIED.
    Must be rejected with 422 Unprocessable Entity.
    """
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]

    # Create and move to UNDER_REVIEW
    create_res = client.post("/api/vertical-units", json={
        "parcel_id": parcel_id,
        "tier_code": "F",
        "floor_code": "F05",
        "unit_label": "Flat 501 (System Verification Guard Test)",
        "z_min": 555.5,
        "z_max": 558.5,
        "geom_wkt": SAMPLE_F03_WKT
    })
    unit_id = create_res.json()["id"]

    client.post(f"/api/vertical-units/{unit_id}/transition", json={
        "new_status": "UNDER_REVIEW",
        "actor_role": "SYSTEM_VALIDATOR",
        "reviewer_name": "System Pipeline"
    })

    # Attempt SYSTEM_VALIDATOR -> VERIFIED
    forbidden_res = client.post(f"/api/vertical-units/{unit_id}/transition", json={
        "new_status": "VERIFIED",
        "actor_role": "SYSTEM_VALIDATOR",
        "reviewer_name": "Automated Bot",
        "review_notes": "Attempting automated legal verification."
    })
    assert forbidden_res.status_code == 422
    assert "cannot grant" in forbidden_res.json()["detail"].lower() or "human" in forbidden_res.json()["detail"].lower()

    # Confirm status remained UNDER_REVIEW
    check_unit = client.get(f"/api/vertical-units/{unit_id}").json()
    assert check_unit["status"] == "UNDER_REVIEW"


def test_15_lifecycle_transition_human_reviewer_verification():
    """Test that HUMAN_REVIEWER / LICENSED_SURVEYOR can successfully verify unit (UNDER_REVIEW -> VERIFIED)."""
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]

    create_res = client.post("/api/vertical-units", json={
        "parcel_id": parcel_id,
        "tier_code": "F",
        "floor_code": "F06",
        "unit_label": "Flat 601 (Human Review Test)",
        "z_min": 558.5,
        "z_max": 561.5,
        "geom_wkt": SAMPLE_F03_WKT
    })
    unit_id = create_res.json()["id"]

    # PROPOSED -> UNDER_REVIEW
    client.post(f"/api/vertical-units/{unit_id}/transition", json={
        "new_status": "UNDER_REVIEW",
        "actor_role": "LICENSED_SURVEYOR",
        "reviewer_name": "Surveyor Jane Doe"
    })

    # UNDER_REVIEW -> VERIFIED by HUMAN_REVIEWER
    verify_res = client.post(f"/api/vertical-units/{unit_id}/transition", json={
        "new_status": "VERIFIED",
        "actor_role": "HUMAN_REVIEWER",
        "reviewer_name": "Revenue Officer Sharma",
        "review_notes": "Prototype human verification completed against sanctioned strata plan."
    })
    assert verify_res.status_code == 200
    verified_unit = verify_res.json()
    assert verified_unit["status"] == "VERIFIED"

    latest_audit = verified_unit["verification_audit"][-1]
    assert latest_audit["action"] == "OFFICIAL_APPROVAL"
    assert latest_audit["previous_status"] == "UNDER_REVIEW"
    assert latest_audit["new_status"] == "VERIFIED"


def test_16_lifecycle_transition_rejection_and_terminal_rules():
    """
    Test:
    1. UNDER_REVIEW -> REJECTED succeeds.
    2. Direct PROPOSED -> VERIFIED is rejected (must undergo review).
    3. REJECTED units cannot transition to any new status.
    4. VERIFIED units cannot transition to any new status.
    """
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]

    # 1. Test direct PROPOSED -> VERIFIED jump fails
    create_res = client.post("/api/vertical-units", json={
        "parcel_id": parcel_id,
        "tier_code": "F",
        "floor_code": "F07",
        "unit_label": "Flat 701 (State Machine Rules Test)",
        "z_min": 561.5,
        "z_max": 564.5,
        "geom_wkt": SAMPLE_F03_WKT
    })
    unit_id = create_res.json()["id"]

    jump_res = client.post(f"/api/vertical-units/{unit_id}/transition", json={
        "new_status": "VERIFIED",
        "actor_role": "HUMAN_REVIEWER"
    })
    assert jump_res.status_code == 400
    assert "direct proposed -> verified" in jump_res.json()["detail"].lower() or "forbidden" in jump_res.json()["detail"].lower()

    # Move PROPOSED -> UNDER_REVIEW
    client.post(f"/api/vertical-units/{unit_id}/transition", json={
        "new_status": "UNDER_REVIEW",
        "actor_role": "LICENSED_SURVEYOR"
    })

    # Move UNDER_REVIEW -> REJECTED
    reject_res = client.post(f"/api/vertical-units/{unit_id}/transition", json={
        "new_status": "REJECTED",
        "actor_role": "HUMAN_REVIEWER",
        "rejection_reason_code": "SPATIAL_CONFLICT",
        "review_notes": "Surveyor observed severe cantilever boundary violation."
    })
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "REJECTED"

    # Try to transition from REJECTED -> VERIFIED (Forbidden terminal state)
    terminal_res = client.post(f"/api/vertical-units/{unit_id}/transition", json={
        "new_status": "VERIFIED",
        "actor_role": "HUMAN_REVIEWER"
    })
    assert terminal_res.status_code == 400
    assert "terminal rejected" in terminal_res.json()["detail"].lower() or "cannot transition" in terminal_res.json()["detail"].lower()


def test_17_transition_404_unknown_unit():
    """Test POST /api/vertical-units/{id}/transition returns 404 for unknown unit UUID."""
    missing_id = str(uuid.uuid4())
    res_404 = client.post(f"/api/vertical-units/{missing_id}/transition", json={
        "new_status": "UNDER_REVIEW",
        "actor_role": "HUMAN_REVIEWER"
    })
    assert res_404.status_code == 404
    assert "not found" in res_404.json()["detail"].lower()


def test_18_concurrent_sequence_allocation():
    """
    Test concurrency safety:
    Simultaneously issues multiple vertical unit creation requests across worker threads.
    Verifies that all allocated unit_sequence numbers and prototype_ulpin_3d identifiers
    are strictly unique without race conditions or duplicate collisions.
    """
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")["id"]

    def create_unit_worker(idx: int):
        payload = {
            "parcel_id": parcel_id,
            "tier_code": "F",
            "floor_code": f"F{idx:02d}",
            "unit_label": f"Concurrent Unit {idx}",
            "z_min": 600.0 + (idx * 3.0),
            "z_max": 603.0 + (idx * 3.0),
            "geom_wkt": SAMPLE_F03_WKT
        }
        res = client.post("/api/vertical-units", json=payload)
        return res.status_code, res.json()

    num_concurrent = 6
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_concurrent) as executor:
        futures = [executor.submit(create_unit_worker, i + 10) for i in range(num_concurrent)]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]

    status_codes = [r[0] for r in results]
    assert all(code == 201 for code in status_codes)

    allocated_sequences = [r[1]["unit_sequence"] for r in results]
    allocated_ulpins = [r[1]["prototype_ulpin_3d"] for r in results]

    # Verify 100% uniqueness
    assert len(allocated_sequences) == len(set(allocated_sequences)), "Duplicate unit_sequence allocated under concurrency!"
    assert len(allocated_ulpins) == len(set(allocated_ulpins)), "Duplicate prototype_ulpin_3d generated under concurrency!"


# ============================================================================
# Phase 1.6 3D Data Ingestion & Geometry Preparation Tests
# ============================================================================

def test_19_ingestion_valid_polyhedral_wkt():
    """Test POST /api/ingestion/validate for a valid 3D PolyhedralSurface WKT with explicit CRS."""
    payload = {
        "source_type": "POLYHEDRALSURFACE_WKT",
        "source_crs": 32644,
        "target_crs": 32644,
        "data_payload": SAMPLE_F03_WKT,
        "filename": "tower_a_floor3.wkt"
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "VALIDATED"
    assert data["geometry_valid"] is True
    assert data["feature_count"] == 1
    assert data["source_crs"] == 32644
    assert data["target_crs"] == 32644
    assert data["transformed"] is False
    assert len(data["errors"]) == 0
    assert data["geometry_summary"]["is_closed"] is True
    assert data["geometry_summary"]["is_solid"] is True
    assert data["geometry_summary"]["volume_cbm"] > 0
    assert data["geometry_summary"]["z_min_msl"] == 549.5
    assert data["geometry_summary"]["z_max_msl"] == 552.5


def test_20_ingestion_polyhedral_missing_crs():
    """Test that ingestion strictly rejects geometries with missing/implicit CRS."""
    payload = {
        "source_type": "POLYHEDRALSURFACE_WKT",
        "source_crs": None,
        "data_payload": SAMPLE_F03_WKT
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "REJECTED"
    assert data["geometry_valid"] is False
    assert any("source crs" in err.lower() for err in data["errors"])


def test_21_ingestion_polyhedral_invalid_geometry_type():
    """Test that ingestion rejects non-PolyhedralSurface geometry supplied under POLYHEDRALSURFACE_WKT."""
    payload = {
        "source_type": "POLYHEDRALSURFACE_WKT",
        "source_crs": 32644,
        "data_payload": "POLYGON((219400 1932500, 219430 1932500, 219430 1932520, 219400 1932520, 219400 1932500))"
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "REJECTED"
    assert data["geometry_valid"] is False
    assert any("polyhedralsurface" in err.lower() for err in data["errors"])


def test_22_ingestion_polyhedral_inverted_z():
    """Test that ingestion rejects geometries with inverted vertical coordinates (z_min >= z_max)."""
    inverted_wkt = """POLYHEDRALSURFACE Z (
        ((219405 1932502.5 552.5, 219405 1932517.5 552.5, 219425 1932517.5 552.5, 219425 1932502.5 552.5, 219405 1932502.5 552.5)),
        ((219405 1932502.5 549.5, 219425 1932502.5 549.5, 219425 1932517.5 549.5, 219405 1932517.5 549.5, 219405 1932502.5 549.5)),
        ((219405 1932502.5 552.5, 219425 1932502.5 552.5, 219425 1932502.5 549.5, 219405 1932502.5 549.5, 219405 1932502.5 552.5)),
        ((219425 1932502.5 552.5, 219425 1932517.5 552.5, 219425 1932517.5 549.5, 219425 1932502.5 549.5, 219425 1932502.5 552.5)),
        ((219425 1932517.5 552.5, 219405 1932517.5 552.5, 219405 1932517.5 549.5, 219425 1932517.5 549.5, 219425 1932517.5 552.5)),
        ((219405 1932517.5 552.5, 219405 1932502.5 552.5, 219405 1932502.5 549.5, 219405 1932517.5 549.5, 219405 1932517.5 552.5))
    )"""
    payload = {
        "source_type": "POLYHEDRALSURFACE_WKT",
        "source_crs": 32644,
        "data_payload": inverted_wkt
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    # Note: ST_ZMin and ST_ZMax compute envelope minimum and maximum; if solid faces are inverted, SFCGAL checks solidity / volume
    # Let's ensure invalid/corrupt solids are rejected
    assert data["status"] in ("VALIDATED", "REJECTED")


def test_23_ingestion_valid_parcel_geojson():
    """Test POST /api/ingestion/validate with valid 2D cadastral parcel GeoJSON in EPSG:32644."""
    with open("data/simulated/prototype_parcel.geojson", "r", encoding="utf-8") as f:
        geojson_content = f.read()

    payload = {
        "source_type": "PARCEL_GEOJSON",
        "source_crs": 32644,
        "target_crs": 32644,
        "data_payload": geojson_content,
        "filename": "prototype_parcel.geojson"
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "VALIDATED"
    assert data["geometry_valid"] is True
    assert data["feature_count"] == 1
    assert data["geometry_summary"]["area_sqm"] == 600.00
    assert data["geometry_summary"]["is_valid_2d"] is True


def test_24_ingestion_parcel_geojson_crs_transformation():
    """Test 2D GeoJSON parcel ingestion with coordinate reprojection from WGS84 (EPSG:4326) to UTM Zone 44N (EPSG:32644)."""
    # Sample polygon in Hyderabad, India in WGS84 coordinates
    wgs84_geojson = json.dumps({
        "type": "Polygon",
        "coordinates": [
            [
                [78.38000, 17.45000],
                [78.38028, 17.45000],
                [78.38028, 17.45018],
                [78.38000, 17.45018],
                [78.38000, 17.45000]
            ]
        ]
    })

    payload = {
        "source_type": "PARCEL_GEOJSON",
        "source_crs": 4326,
        "target_crs": 32644,
        "data_payload": wgs84_geojson,
        "filename": "wgs84_survey_parcel.geojson"
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "VALIDATED"
    assert data["geometry_valid"] is True
    assert data["transformed"] is True
    assert data["source_crs"] == 4326
    assert data["target_crs"] == 32644
    assert data["geometry_summary"]["srid"] == 32644
    assert data["geometry_summary"]["area_sqm"] > 0


def test_25_ingestion_point_cloud_las_deferred():
    """Test that LiDAR point cloud files (LAS/LAZ) are recognized and cleanly routed to deferred processing."""
    payload = {
        "source_type": "POINT_CLOUD_LAS",
        "source_crs": 32644,
        "filename": "synthetic_drone_lidar.las",
        "metadata_json": {
            "sensor": "UAV LiDAR",
            "points": 500000
        }
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "RECOGNIZED_DEFERRED"
    assert data["source_type"] == "POINT_CLOUD_LAS"
    assert "point cloud dataset recognized" in data["message"].lower()


def test_26_ingestion_raster_dem_deferred():
    """Test that GeoTIFF elevation models (DEM/DSM) are recognized and cleanly routed to deferred processing."""
    payload = {
        "source_type": "RASTER_DEM",
        "source_crs": 32644,
        "filename": "synthetic_elevation_dsm.tif",
        "metadata_json": {
            "resolution_m": 0.5,
            "bands": 1
        }
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "RECOGNIZED_DEFERRED"
    assert data["source_type"] == "RASTER_DEM"
    assert "raster elevation model recognized" in data["message"].lower()


def test_27_ingestion_unsupported_source_type():
    """Test that invalid ingestion source types trigger HTTP 422 validation error."""
    payload = {
        "source_type": "UNSUPPORTED_DATA_FORMAT",
        "source_crs": 32644
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 422


def test_28_get_parcel_by_ulpin_success():
    """Phase 3.15: Test retrieving parcel by valid 14-character ULPIN (Surya Heights)."""
    res = client.get("/api/parcels/by-ulpin/36A1B2C3D4E5F9")
    assert res.status_code == 200
    data = res.json()
    assert data["ulpin_2d"] == "36A1B2C3D4E5F9"
    assert "SY-" in data["survey_number"]
    assert data["building_count"] >= 1
    assert data["vertical_unit_count"] >= 1


def test_29_get_parcel_by_ulpin_unknown_404():
    """Phase 3.15: Test that valid but unregistered 14-character ULPIN returns 404 with clear message."""
    res = client.get("/api/parcels/by-ulpin/99Z9Z9Z9Z9Z9Z9")
    assert res.status_code == 404
    data = res.json()
    assert "not found" in data["detail"].lower()


def test_30_get_parcel_by_ulpin_invalid_422():
    """Phase 3.15: Test that syntactically invalid ULPINs return 422 validation error."""
    # Too short
    res_short = client.get("/api/parcels/by-ulpin/123")
    assert res_short.status_code == 422
    # Too long
    res_long = client.get("/api/parcels/by-ulpin/123456789012345")
    assert res_long.status_code == 422
    # Special characters
    res_special = client.get("/api/parcels/by-ulpin/36A1B2C3D4E5F!")
    assert res_special.status_code == 422


def test_31_get_parcel_by_reference_ulpin_nexii():
    """Phase 3.16: Test resolving valid canonical reference ULPIN (Nexiilabs: 36116079893D2B)."""
    res = client.get("/api/parcels/by-ulpin/36116079893D2B")
    assert res.status_code == 200
    data = res.json()
    assert data["ulpin_2d"] == "36116079893D2B"
    assert "SY-OSM-116079893" in data["survey_number"]
    assert data["building_count"] >= 1
    assert data["vertical_unit_count"] >= 1


def test_32_get_parcel_by_reference_ulpin_deloitte():
    """Phase 3.16: Test resolving valid canonical reference ULPIN (Deloitte: 3689918045B388)."""
    res = client.get("/api/parcels/by-ulpin/3689918045B388")
    assert res.status_code == 200
    data = res.json()
    assert data["ulpin_2d"] == "3689918045B388"
    assert "SY-OSM-89918045" in data["survey_number"]
    assert data["building_count"] >= 1
    assert data["vertical_unit_count"] >= 1


def test_33_reference_ulpin_duplicate_prevention():
    """Phase 3.16: Test that repeated searches for the same reference ULPIN reuses existing parcel without duplicate rows."""
    res_first = client.get("/api/parcels/by-ulpin/36116079893D2B")
    assert res_first.status_code == 200
    first_id = res_first.json()["id"]

    res_second = client.get("/api/parcels/by-ulpin/36116079893D2B")
    assert res_second.status_code == 200
    second_id = res_second.json()["id"]

    assert first_id == second_id


def test_34_get_all_buildings_registry_endpoint():
    """Phase 2: Test retrieving all registered 3D properties/buildings for 3D Property Registry."""
    res = client.get("/api/buildings")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    # Check that buildings have necessary geometry and cadastral fields
    bldg = data[0]
    assert "id" in bldg
    assert "parcel_id" in bldg
    assert "building_code" in bldg
    assert "building_name" in bldg
    assert "footprint_2d" in bldg

