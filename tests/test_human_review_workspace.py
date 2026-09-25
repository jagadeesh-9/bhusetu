"""
SIH26011: Phase 3.1 Test Suite
Human-in-the-Loop 3D Property Review & Decision Workspace
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models.entities import VerticalUnit, Parcel, Building, VerificationAudit
from backend.app.services.review_service import ReviewService
from backend.app.services.spatial_service import SpatialService
from backend.app.schemas.requests import (
    VerticalUnitTransitionRequest,
    VerticalUnitCreateRequest
)
from scripts.reconstruct_3d_units import build_polyhedralsurface_wkt_from_footprint

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


from sqlalchemy import text

@pytest.fixture(autouse=True)
def cleanup_test_state():
    yield
    db = SessionLocal()
    try:
        db.execute(text("DELETE FROM verification_audit WHERE unit_id NOT IN (SELECT id FROM vertical_units WHERE building_id IN (SELECT id FROM buildings WHERE building_code IN ('TOWER-A', 'MIXED-TOWER-A', 'APARTMENT-SURYA', 'APARTMENT-SURYA-OSM')));"))
        db.execute(text("DELETE FROM source_evidence WHERE unit_id NOT IN (SELECT id FROM vertical_units WHERE building_id IN (SELECT id FROM buildings WHERE building_code IN ('TOWER-A', 'MIXED-TOWER-A', 'APARTMENT-SURYA', 'APARTMENT-SURYA-OSM')));"))
        db.execute(text("DELETE FROM vertical_units WHERE building_id NOT IN (SELECT id FROM buildings WHERE building_code IN ('TOWER-A', 'MIXED-TOWER-A', 'APARTMENT-SURYA', 'APARTMENT-SURYA-OSM'));"))
        db.execute(text("""
            DELETE FROM verification_audit 
            WHERE id IN (
                SELECT id FROM (
                    SELECT id, ROW_NUMBER() OVER (PARTITION BY unit_id ORDER BY timestamp DESC) as rn 
                    FROM verification_audit
                ) sub WHERE rn > 1
            );
        """))
        db.execute(text("UPDATE vertical_units SET status = 'VERIFIED' WHERE unit_sequence = 1;"))
        db.execute(text("UPDATE vertical_units SET status = 'VERIFIED' WHERE unit_sequence = 2;"))
        db.execute(text("UPDATE vertical_units SET status = 'VERIFIED' WHERE unit_sequence = 3;"))
        db.execute(text("UPDATE vertical_units SET status = 'UNDER_REVIEW' WHERE unit_sequence = 4;"))
        db.execute(text("UPDATE vertical_units SET status = 'PROPOSED' WHERE unit_sequence = 5;"))
        db.execute(text("UPDATE vertical_units SET status = 'REJECTED' WHERE unit_sequence = 6;"))
        db.execute(text("UPDATE vertical_units SET status = 'PROPOSED' WHERE unit_sequence >= 7;"))
        db.execute(text("""
            INSERT INTO source_evidence (id, unit_id, source_type, dataset_name, file_uri, accuracy_horizontal_m, accuracy_vertical_m, metadata_json)
            SELECT gen_random_uuid(), vu.id, 'MANUAL_DIGITIZED', 'Baseline Cadastral Plan', 'https://cadastre.gov.in/baseline.pdf', 0.05, 0.02, '{"source": "baseline"}'::jsonb
            FROM vertical_units vu
            LEFT JOIN source_evidence se ON vu.id = se.unit_id
            WHERE se.id IS NULL
        """))
        db.execute(text("""
            INSERT INTO verification_audit (id, unit_id, action, previous_status, new_status, reviewer_name, reviewer_role, review_notes, integrity_hash)
            SELECT gen_random_uuid(), vu.id, 'AUTO_INGESTION', vu.status, vu.status, 
                CASE WHEN vu.status = 'VERIFIED' THEN 'Govt Cadastral Surveyor' ELSE 'System Ingestion' END,
                CASE WHEN vu.status = 'VERIFIED' THEN 'LICENSED_SURVEYOR'::reviewer_role_type ELSE 'SYSTEM_VALIDATOR'::reviewer_role_type END,
                'Baseline initialization', 'hash_' || vu.prototype_ulpin_3d
            FROM vertical_units vu
            LEFT JOIN verification_audit va ON vu.id = va.unit_id
            WHERE va.id IS NULL
        """))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def test_01_review_case_endpoint_aggregates_complete_dossier(db_session):
    """Validates that GET /api/vertical-units/{id}/review returns complete case dossier."""
    u = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 1).first()
    assert u is not None

    response = client.get(f"/api/vertical-units/{u.id}/review")
    assert response.status_code == 200
    data = response.json()

    # Core identity & metadata
    assert data["unit_id"] == str(u.id)
    assert data["prototype_ulpin_3d"] == u.prototype_ulpin_3d
    assert data["parcel_id"] == str(u.parcel_id)
    assert "27A8B9C3D4E5" in data["parcel_ulpin_2d"]
    assert data["tier_code"] == u.tier_code
    assert data["floor_code"] == u.floor_code

    # Quality & Intelligence Modules
    assert "topology" in data
    assert "evidence" in data
    assert "readiness" in data
    assert "audit_history" in data
    assert isinstance(data["available_actions"], list)
    assert "disclaimer" in data
    assert "research prototype" in data["disclaimer"].lower()


def test_02_review_readiness_checklist_items(db_session):
    """Validates computational readiness checklist calculation."""
    u = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 3).first() # F00
    assert u is not None

    response = client.get(f"/api/vertical-units/{u.id}/review")
    assert response.status_code == 200
    data = response.json()
    readiness = data["readiness"]

    assert readiness["overall_readiness"] in ["READY_FOR_HUMAN_REVIEW", "REVIEW_REQUIRES_ATTENTION", "BLOCKED_INVALID_GEOMETRY"]
    assert readiness["passed_count"] >= 3
    assert len(readiness["items"]) >= 5

    item_codes = [it["code"] for it in readiness["items"]]
    assert "SOLID_WATERTIGHTNESS" in item_codes
    assert "POSITIVE_VOLUME" in item_codes
    assert "PARCEL_CONTAINMENT" in item_codes
    assert "TOPOLOGY_COLLISION" in item_codes
    assert "EVIDENCE_ATTACHED" in item_codes


def test_03_conflict_candidate_readiness_flags_attention(db_session):
    """Validates that a unit with parcel boundary or spatial conflicts requires attention."""
    u_rej = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 6).first()
    assert u_rej is not None

    response = client.get(f"/api/vertical-units/{u_rej.id}/review")
    assert response.status_code == 200
    data = response.json()
    readiness = data["readiness"]

    assert readiness["error_count"] >= 1
    assert readiness["overall_readiness"] == "REVIEW_REQUIRES_ATTENTION"


def test_04_underground_supporting_evidence_protocol(db_session):
    """Validates that subsurface units (UT/SB) assess subsurface supporting evidence."""
    u_ut = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "UT01").first()
    if not u_ut:
        u_ut = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 8).first()
    assert u_ut is not None

    response = client.get(f"/api/vertical-units/{u_ut.id}/review")
    assert response.status_code == 200
    data = response.json()

    codes = [it["code"] for it in data["readiness"]["items"]]
    assert "UNDERGROUND_EVIDENCE" in codes


def test_05_chronological_audit_history_preservation(db_session):
    """Validates that audit history contains chronological events."""
    u = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 1).first()
    assert u is not None

    response = client.get(f"/api/vertical-units/{u.id}/review")
    assert response.status_code == 200
    data = response.json()
    audit_history = data["audit_history"]

    assert len(audit_history) >= 1
    first_event = audit_history[0]
    assert "action" in first_event
    assert "actor_role" in first_event
    assert "timestamp" in first_event


@pytest.fixture(scope="function")
def ephemeral_unit(db_session):
    footprint = [
        [219405.0, 1932502.5],
        [219425.0, 1932502.5],
        [219425.0, 1932517.5],
        [219405.0, 1932517.5],
        [219405.0, 1932502.5]
    ]
    wkt_3d, _ = build_polyhedralsurface_wkt_from_footprint(footprint, 570.0, 573.0)
    parcel = db_session.query(Parcel).first()
    building = db_session.query(Building).first()
    spatial_service = SpatialService(db_session)
    unit_res = spatial_service.create_vertical_unit(
        VerticalUnitCreateRequest(
            parcel_id=parcel.id,
            building_id=building.id,
            tier_code="F",
            floor_code="F99",
            unit_label="Ephemeral Test Unit",
            unit_type="RESIDENTIAL",
            z_min=570.0,
            z_max=573.0,
            geom_wkt=wkt_3d
        )
    )
    yield unit_res
    db = SessionLocal()
    try:
        db.execute(text(f"DELETE FROM verification_audit WHERE unit_id = '{unit_res.id}';"))
        db.execute(text(f"DELETE FROM source_evidence WHERE unit_id = '{unit_res.id}';"))
        db.execute(text(f"DELETE FROM vertical_units WHERE id = '{unit_res.id}';"))
        db.commit()
    finally:
        db.close()


def test_06_state_transition_proposed_to_under_review(ephemeral_unit):
    """Validates transitioning a PROPOSED unit to UNDER_REVIEW."""
    res = client.post(
        f"/api/vertical-units/{ephemeral_unit.id}/transition",
        json={
            "new_status": "UNDER_REVIEW",
            "actor_role": "HUMAN_REVIEWER",
            "reviewer_name": "Senior Reviewer A",
            "review_notes": "Starting technical review of 3D geometry and topology."
        }
    )
    assert res.status_code == 200
    assert res.json()["status"] == "UNDER_REVIEW"


def test_07_system_validator_cannot_verify(ephemeral_unit):
    """Validates that SYSTEM_VALIDATOR is strictly blocked from granting verification (HTTP 422)."""
    client.post(
        f"/api/vertical-units/{ephemeral_unit.id}/transition",
        json={
            "new_status": "UNDER_REVIEW",
            "actor_role": "HUMAN_REVIEWER",
            "reviewer_name": "Reviewer"
        }
    )

    res = client.post(
        f"/api/vertical-units/{ephemeral_unit.id}/transition",
        json={
            "new_status": "VERIFIED",
            "actor_role": "SYSTEM_VALIDATOR",
            "reviewer_name": "Automated Validator",
            "review_notes": "Attempting automated approval."
        }
    )
    assert res.status_code == 422
    assert "cannot grant verification" in res.json()["detail"]


def test_08_human_roles_allowed_for_verification():
    """Validates that authorized human roles (LICENSED_SURVEYOR / REVENUE_OFFICIAL) are permitted."""
    allowed_roles = ["LICENSED_SURVEYOR", "REVENUE_OFFICIAL", "HUMAN_REVIEWER"]
    for role in allowed_roles:
        req = VerticalUnitTransitionRequest(
            new_status="VERIFIED",
            actor_role=role,
            reviewer_name=f"Official {role}"
        )
        assert req.actor_role == role


def test_09_direct_proposed_to_verified_forbidden(ephemeral_unit):
    """Validates that a unit cannot jump directly from PROPOSED to VERIFIED."""
    res = client.post(
        f"/api/vertical-units/{ephemeral_unit.id}/transition",
        json={
            "new_status": "VERIFIED",
            "actor_role": "LICENSED_SURVEYOR",
            "reviewer_name": "Senior Surveyor",
            "review_notes": "Attempting direct jump."
        }
    )
    assert res.status_code == 400
    assert "Direct PROPOSED -> VERIFIED transition is forbidden" in res.json()["detail"]


def test_10_direct_proposed_to_rejected_forbidden(ephemeral_unit):
    """Validates that a unit cannot jump directly from PROPOSED to REJECTED."""
    res = client.post(
        f"/api/vertical-units/{ephemeral_unit.id}/transition",
        json={
            "new_status": "REJECTED",
            "actor_role": "LICENSED_SURVEYOR",
            "reviewer_name": "Senior Surveyor",
            "rejection_reason_code": "SPATIAL_CONFLICT",
            "review_notes": "Attempting direct rejection from PROPOSED."
        }
    )
    assert res.status_code == 400
    assert "Units must be in UNDER_REVIEW before being marked REJECTED" in res.json()["detail"]


def test_11_under_review_can_verify(ephemeral_unit):
    """Validates that an authorized human can verify an UNDER_REVIEW unit."""
    t1 = client.post(
        f"/api/vertical-units/{ephemeral_unit.id}/transition",
        json={
            "new_status": "UNDER_REVIEW",
            "actor_role": "HUMAN_REVIEWER",
            "reviewer_name": "Reviewer 1"
        }
    )
    assert t1.status_code == 200

    res = client.post(
        f"/api/vertical-units/{ephemeral_unit.id}/transition",
        json={
            "new_status": "VERIFIED",
            "actor_role": "LICENSED_SURVEYOR",
            "reviewer_name": "Surveyor Official",
            "review_notes": "All checks verified and valid."
        }
    )
    assert res.status_code == 200
    assert res.json()["status"] == "VERIFIED"


def test_12_rejection_requires_structured_reason_code(ephemeral_unit):
    """Validates that transitioning to REJECTED without reason code fails with 422."""
    t1 = client.post(
        f"/api/vertical-units/{ephemeral_unit.id}/transition",
        json={
            "new_status": "UNDER_REVIEW",
            "actor_role": "HUMAN_REVIEWER",
            "reviewer_name": "Reviewer 1"
        }
    )
    assert t1.status_code == 200

    res = client.post(
        f"/api/vertical-units/{ephemeral_unit.id}/transition",
        json={
            "new_status": "REJECTED",
            "actor_role": "LICENSED_SURVEYOR",
            "reviewer_name": "Surveyor Official",
            "review_notes": "Attempting rejection without structured code."
        }
    )
    assert res.status_code == 422
    assert "rejection_reason_code is required" in res.json()["detail"]


def test_13_invalid_reviewer_role_rejected():
    """Validates that invalid reviewer role fails schema validation."""
    with pytest.raises(ValueError):
        VerticalUnitTransitionRequest(
            new_status="UNDER_REVIEW",
            actor_role="UNAUTHORIZED_ACTOR"
        )


def test_14_human_rejection_with_structured_reason(ephemeral_unit, db_session):
    """Validates rejecting an UNDER_REVIEW unit with a structured rejection reason code."""
    # 1. Transition PROPOSED -> UNDER_REVIEW
    t1 = client.post(
        f"/api/vertical-units/{ephemeral_unit.id}/transition",
        json={
            "new_status": "UNDER_REVIEW",
            "actor_role": "HUMAN_REVIEWER",
            "reviewer_name": "Reviewer 1",
            "review_notes": "Moving to review stage."
        }
    )
    assert t1.status_code == 200

    # 2. Transition UNDER_REVIEW -> REJECTED with rejection_reason_code
    res = client.post(
        f"/api/vertical-units/{ephemeral_unit.id}/transition",
        json={
            "new_status": "REJECTED",
            "actor_role": "LICENSED_SURVEYOR",
            "reviewer_name": "Surveyor Verification Officer",
            "rejection_reason_code": "SPATIAL_CONFLICT",
            "review_notes": "Volumetric collision detected against adjoining core."
        }
    )
    assert res.status_code == 200
    assert res.json()["status"] == "REJECTED"

    # Check audit entry contains rejection code
    audit = (
        db_session.query(VerificationAudit)
        .filter(VerificationAudit.unit_id == ephemeral_unit.id)
        .order_by(VerificationAudit.timestamp.desc())
        .first()
    )
    assert audit is not None
    assert "SPATIAL_CONFLICT" in audit.review_notes
    assert str(audit.new_status) == "REJECTED" or audit.new_status.name == "REJECTED"


def test_15_terminal_state_preservation(db_session):
    """Validates that once REJECTED or VERIFIED, units cannot transition again."""
    u_rej = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 6).first()
    assert u_rej is not None

    res = client.post(
        f"/api/vertical-units/{u_rej.id}/transition",
        json={
            "new_status": "UNDER_REVIEW",
            "actor_role": "HUMAN_REVIEWER",
            "reviewer_name": "Auditor"
        }
    )
    assert res.status_code == 400
    assert "terminal REJECTED status" in res.json()["detail"]


def test_16_review_case_404_for_unknown_unit():
    """Validates that requesting review for unknown unit returns 404."""
    unknown_id = str(uuid.uuid4())
    res = client.get(f"/api/vertical-units/{unknown_id}/review")
    assert res.status_code == 404


def test_17_read_only_review_case_query_no_mutations(db_session):
    """Validates that fetching review case dossier performs zero mutations."""
    count_parcels = db_session.query(Parcel).count()
    count_units = db_session.query(VerticalUnit).count()
    count_audits = db_session.query(VerificationAudit).count()

    u = db_session.query(VerticalUnit).first()
    client.get(f"/api/vertical-units/{u.id}/review")

    assert db_session.query(Parcel).count() == count_parcels
    assert db_session.query(VerticalUnit).count() == count_units
    assert db_session.query(VerificationAudit).count() == count_audits


def test_18_review_case_available_actions_logic(db_session):
    """Validates that available actions accurately match unit status."""
    service = ReviewService(db_session)

    u_rej = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 6).first()
    case_rej = service.get_review_case(u_rej.id)
    assert case_rej.available_actions == []

    u_ver = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 3).first()
    case_ver = service.get_review_case(u_ver.id)
    assert case_ver.available_actions == []


def test_19_resubmission_creates_new_candidate_without_overwriting_rejected(db_session):
    """Validates that creating a corrected candidate creates a distinct record."""
    u_rej = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 6).first()
    assert u_rej is not None
    original_id = u_rej.id

    footprint_coords = [
        [219405.0, 1932502.5],
        [219425.0, 1932502.5],
        [219425.0, 1932517.5],
        [219405.0, 1932517.5],
        [219405.0, 1932502.5]
    ]
    wkt_3d, _ = build_polyhedralsurface_wkt_from_footprint(footprint_coords, 546.5, 549.5)

    spatial_service = SpatialService(db_session)
    create_req = VerticalUnitCreateRequest(
        parcel_id=u_rej.parcel_id,
        building_id=u_rej.building_id,
        tier_code="F",
        floor_code="F02",
        unit_label="Unit 201 (Corrected)",
        unit_type="RESIDENTIAL",
        z_min=546.5,
        z_max=549.5,
        geom_wkt=wkt_3d
    )

    new_unit_res = spatial_service.create_vertical_unit(create_req)
    try:
        assert new_unit_res.id != original_id
        assert new_unit_res.status == "PROPOSED"

        # Original rejected record remains intact
        u_rej_still = db_session.query(VerticalUnit).filter(VerticalUnit.id == original_id).first()
        assert u_rej_still is not None
        assert str(u_rej_still.status) == "REJECTED" or u_rej_still.status.name == "REJECTED"
    finally:
        # Clean up the resubmitted unit
        db = SessionLocal()
        try:
            db.execute(text(f"DELETE FROM verification_audit WHERE unit_id = '{new_unit_res.id}';"))
            db.execute(text(f"DELETE FROM source_evidence WHERE unit_id = '{new_unit_res.id}';"))
            db.execute(text(f"DELETE FROM vertical_units WHERE id = '{new_unit_res.id}';"))
            db.commit()
        finally:
            db.close()
