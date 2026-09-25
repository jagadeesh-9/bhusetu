"""
Tests for Phase 2.5: Multi-Source 3D Candidate Unit Integration.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import app
from backend.app.db import SessionLocal
from scripts.reconstruct_3d_units import build_polyhedralsurface_wkt_from_footprint

client = TestClient(app)


@pytest.fixture
def sample_footprint():
    # Bounding footprint for TOWER-A within parcel 27A8B9C3D4E5F6
    return [
        [219405.0, 1932502.5],
        [219425.0, 1932502.5],
        [219425.0, 1932517.5],
        [219405.0, 1932517.5],
        [219405.0, 1932502.5]
    ]


@pytest.fixture(autouse=True)
def clean_dynamic_test_units():
    """Ensures dynamic test units are cleaned up before and after every test, preserving the 4 canonical datasets."""
    db = SessionLocal()
    try:
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
        """))
        db.commit()
    finally:
        db.close()

    yield

    db = SessionLocal()
    try:
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
        """))
        db.commit()
    finally:
        db.close()



def test_01_idempotent_integration_of_existing_tower_a_candidates():
    """Test 1: Re-integrating existing TOWER-A floors F00/F01/F02 is idempotent and does not create duplicates."""
    response = client.post(
        "/api/candidates/integrate",
        json={
            "parcel_ulpin_2d": "27A8B9C3D4E5F6",
            "building_code": "TOWER-A",
            "source_type": "LIDAR_POINTCLOUD",
            "dataset_name": "prototype_tower_a.las",
            "file_uri": "data/simulated/prototype_tower_a.las",
            "candidates": [
                {
                    "floor_code": "F00",
                    "tier_code": "F",
                    "z_min": 540.05,
                    "z_max": 543.45,
                    "geom_wkt": build_polyhedralsurface_wkt_from_footprint(
                        [[219405.0, 1932502.5], [219425.0, 1932502.5], [219425.0, 1932517.5], [219405.0, 1932517.5], [219405.0, 1932502.5]],
                        540.05, 543.45
                    )[0]
                },
                {
                    "floor_code": "F01",
                    "tier_code": "F",
                    "z_min": 543.45,
                    "z_max": 546.45,
                    "geom_wkt": build_polyhedralsurface_wkt_from_footprint(
                        [[219405.0, 1932502.5], [219425.0, 1932502.5], [219425.0, 1932517.5], [219405.0, 1932517.5], [219405.0, 1932502.5]],
                        543.45, 546.45
                    )[0]
                }
            ]
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "COMPLETED"
    assert data["newly_created_count"] == 0
    assert data["idempotent_existing_count"] == 2
    assert len(data["integrated_units"]) == 2
    assert data["integrated_units"][0]["is_newly_created"] is False
    assert data["integrated_units"][1]["is_newly_created"] is False


def test_02_integration_creates_new_candidate_unit_in_proposed_status(sample_footprint):
    """Test 2: Integrating a new candidate floor (e.g. rooftop F03 / solar installation) initializes in PROPOSED state."""
    db = SessionLocal()
    try:
        # Create a new candidate floor F03 (549.50 to 552.50m)
        wkt_f03, _ = build_polyhedralsurface_wkt_from_footprint(sample_footprint, 549.50, 552.50)

        response = client.post(
            "/api/candidates/integrate",
            json={
                "parcel_ulpin_2d": "27A8B9C3D4E5F6",
                "building_code": "TOWER-A",
                "source_type": "BIM_IFC",
                "dataset_name": "tower_a_structural_v2.ifc",
                "file_uri": "models/bim/tower_a_structural_v2.ifc",
                "accuracy_horizontal_m": 0.02,
                "accuracy_vertical_m": 0.02,
                "candidates": [
                    {
                        "candidate_key": "TOWER_A_F03_BIM_CANDIDATE",
                        "floor_code": "F03_TEST_P25",
                        "tier_code": "F",
                        "unit_label": "Synthetic Rooftop Strata F03",
                        "unit_type": "RESIDENTIAL",
                        "z_min": 549.50,
                        "z_max": 552.50,
                        "geom_wkt": wkt_f03,
                        "analytical_metadata": {"method": "BIM_EXTRUSION", "nominal_height": 3.0}
                    }
                ]
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["newly_created_count"] == 1
        unit = data["integrated_units"][0]
        assert unit["status"] == "PROPOSED"
        assert unit["is_newly_created"] is True
        assert unit["floor_code"] == "F03_TEST_P25"
        assert "3D-F-" in unit["prototype_ulpin_3d"]

        # Verify source evidence and verification audit in DB
        created_unit_id = unit["unit_id"]
        evidence_row = db.execute(
            text("SELECT source_type, dataset_name, file_uri FROM source_evidence WHERE unit_id = :uid;"),
            {"uid": created_unit_id}
        ).mappings().first()
        assert evidence_row is not None
        assert evidence_row["source_type"] == "BIM_IFC"

        audit_row = db.execute(
            text("SELECT action, new_status, reviewer_role FROM verification_audit WHERE unit_id = :uid;"),
            {"uid": created_unit_id}
        ).mappings().first()
        assert audit_row is not None
        assert audit_row["action"] == "AUTO_INGESTION"
        assert audit_row["new_status"] == "PROPOSED"

    finally:
        db.close()


def test_03_invalid_geometry_rejected_with_422(sample_footprint):
    """Test 3: Non-solid / invalid WKT geometry is rejected during candidate integration."""
    invalid_wkt = "POLYHEDRALSURFACE Z (((219405.0 1932502.5 540.0, 219425.0 1932502.5 540.0, 219425.0 1932517.5 540.0, 219405.0 1932502.5 540.0)))"

    response = client.post(
        "/api/candidates/integrate",
        json={
            "parcel_ulpin_2d": "27A8B9C3D4E5F6",
            "building_code": "TOWER-A",
            "source_type": "LIDAR_POINTCLOUD",
            "dataset_name": "prototype_tower_a.las",
            "file_uri": "data/simulated/prototype_tower_a.las",
            "candidates": [
                {
                    "floor_code": "F99_INVALID",
                    "tier_code": "F",
                    "z_min": 540.0,
                    "z_max": 543.0,
                    "geom_wkt": invalid_wkt
                }
            ]
        }
    )

    assert response.status_code == 422
    assert "validation" in response.json()["detail"].lower()


def test_04_unknown_parcel_returns_404(sample_footprint):
    """Test 4: Non-existent parent parcel returns 404 NOT FOUND."""
    wkt, _ = build_polyhedralsurface_wkt_from_footprint(sample_footprint, 540.0, 543.0)
    response = client.post(
        "/api/candidates/integrate",
        json={
            "parcel_ulpin_2d": "UNKNOWN_PARCEL",
            "building_code": "TOWER-A",
            "source_type": "LIDAR_POINTCLOUD",
            "dataset_name": "prototype_tower_a.las",
            "file_uri": "data/simulated/prototype_tower_a.las",
            "candidates": [
                {
                    "floor_code": "F01",
                    "tier_code": "F",
                    "z_min": 540.0,
                    "z_max": 543.0,
                    "geom_wkt": wkt
                }
            ]
        }
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_05_unsupported_source_type_rejected():
    """Test 5: Unsupported evidence source type fails request validation."""
    response = client.post(
        "/api/candidates/integrate",
        json={
            "parcel_ulpin_2d": "27A8B9C3D4E5F6",
            "source_type": "BLOCKCHAIN_TOKEN_INVALID",
            "dataset_name": "invalid.dat",
            "file_uri": "invalid://data",
            "candidates": []
        }
    )

    assert response.status_code == 422


def test_06_human_verification_state_machine_preservation(sample_footprint):
    """Test 6: Verifies that newly integrated PROPOSED unit cannot be verified by SYSTEM_VALIDATOR, but requires human reviewer."""
    wkt_unit, _ = build_polyhedralsurface_wkt_from_footprint(sample_footprint, 555.00, 558.00)

    # 1. Integrate candidate as PROPOSED
    res = client.post(
        "/api/candidates/integrate",
        json={
            "parcel_ulpin_2d": "27A8B9C3D4E5F6",
            "building_code": "TOWER-A",
            "source_type": "ARCHITECTURAL_PLAN_2D",
            "dataset_name": "architectural_blueprint_v1.dxf",
            "file_uri": "cad/architectural_blueprint_v1.dxf",
            "candidates": [
                {
                    "floor_code": "F04_REVIEW_TEST",
                    "tier_code": "F",
                    "z_min": 555.00,
                    "z_max": 558.00,
                    "geom_wkt": wkt_unit
                }
            ]
        }
    )
    assert res.status_code == 200
    unit_id = res.json()["integrated_units"][0]["unit_id"]

    # 2. Transition PROPOSED -> UNDER_REVIEW
    t1 = client.post(
        f"/api/vertical-units/{unit_id}/transition",
        json={
            "new_status": "UNDER_REVIEW",
            "actor_role": "SYSTEM_VALIDATOR",
            "reviewer_name": "Automated Review Bot"
        }
    )
    assert t1.status_code == 200
    assert t1.json()["status"] == "UNDER_REVIEW"

    # 3. Automated SYSTEM_VALIDATOR attempting VERIFIED must be strictly forbidden (422)
    t_sys = client.post(
        f"/api/vertical-units/{unit_id}/transition",
        json={
            "new_status": "VERIFIED",
            "actor_role": "SYSTEM_VALIDATOR",
            "reviewer_name": "Automated Verification Engine"
        }
    )
    assert t_sys.status_code == 422
    assert "cannot grant" in t_sys.json()["detail"].lower()

    # 4. Human Reviewer / Licensed Surveyor can legally verify
    t_human = client.post(
        f"/api/vertical-units/{unit_id}/transition",
        json={
            "new_status": "VERIFIED",
            "actor_role": "LICENSED_SURVEYOR",
            "reviewer_name": "Er. S. Ramanujan",
            "review_notes": "Field GPS and building blueprint verification complete."
        }
    )
    assert t_human.status_code == 200
    assert t_human.json()["status"] == "VERIFIED"
