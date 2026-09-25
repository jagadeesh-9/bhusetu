"""
Unit and integration tests for Phase 2.7: Evidence Intelligence & Provenance Visualization.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import app
from backend.app.db import SessionLocal

client = TestClient(app)


def test_01_evidence_provenance_endpoint_exists():
    """Test 1: GET /api/vertical-units/{id}/evidence returns 200 for seed units."""
    parcels_res = client.get("/api/parcels")
    assert parcels_res.status_code == 200
    parcel_id = next(p["id"] for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")
    
    units_res = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    assert units_res.status_code == 200
    units = units_res.json()
    assert len(units) >= 6
    
    unit_f00 = [u for u in units if u["floor_code"] == "F00"][0]
    
    ev_res = client.get(f"/api/vertical-units/{unit_f00['id']}/evidence")
    assert ev_res.status_code == 200
    data = ev_res.json()
    
    assert data["unit_id"] == unit_f00["id"]
    assert data["prototype_ulpin_3d"] == unit_f00["prototype_ulpin_3d"]
    assert data["floor_code"] == "F00"
    assert data["tier_code"] == "F"
    assert data["is_synthetic_prototype"] is True
    assert data["is_underground"] is False
    assert data["evidence_count"] >= 1
    assert "disclaimer" in data
    assert "ownership" in data["disclaimer"].lower() or "legal" in data["disclaimer"].lower()


def test_02_evidence_record_fields_and_accuracy():
    """Test 2: Evidence records include source type, dataset, accuracy, and sensor category."""
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p["id"] for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")
    units_res = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    unit_f00 = [u for u in units_res.json() if u["floor_code"] == "F00"][0]
    
    ev_res = client.get(f"/api/vertical-units/{unit_f00['id']}/evidence")
    assert ev_res.status_code == 200
    data = ev_res.json()
    
    records = data["evidence_records"]
    assert len(records) > 0
    rec = records[0]
    
    assert rec["source_type"] == "BIM_IFC"
    assert "SYN_TOWER_A_REVIT_2026.ifc" in rec["dataset_name"]
    assert rec["accuracy_horizontal_m"] == 0.02
    assert rec["accuracy_vertical_m"] == 0.01
    assert rec["sensor_category"] == "BUILDING_INFORMATION_MODEL"
    assert rec["assessment_level"] == "HIGH"
    assert "high precision" in rec["assessment_rationale"].lower()
    assert rec["metadata_json"]["ifc_class"] == "IfcSpace"


def test_03_rule_based_evidence_quality_assessment():
    """Test 3: Rule-based assessment grades high precision (<=0.05m) as HIGH and moderate (<=0.20m) as MEDIUM."""
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p["id"] for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")
    units_res = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    
    # Unit 5 (F02 with CityJSON LoD2, acc H: 0.15m, V: 0.10m -> MEDIUM)
    unit_f02_prop = [u for u in units_res.json() if u["prototype_ulpin_3d"] == "27A8B9C3D4E5F6-3D-F02-0005"][0]
    ev_f02_res = client.get(f"/api/vertical-units/{unit_f02_prop['id']}/evidence")
    assert ev_f02_res.status_code == 200
    data_f02 = ev_f02_res.json()
    assert data_f02["overall_assessment_level"] == "MEDIUM"
    assert "MEDIUM" in data_f02["overall_assessment_label"]
    
    # Unit 3 (F00 with BIM IFC, acc H: 0.02m, V: 0.01m -> HIGH)
    unit_f00 = [u for u in units_res.json() if u["floor_code"] == "F00"][0]
    ev_f00_res = client.get(f"/api/vertical-units/{unit_f00['id']}/evidence")
    data_f00 = ev_f00_res.json()
    assert data_f00["overall_assessment_level"] == "HIGH"
    assert "HIGH" in data_f00["overall_assessment_label"]


def test_04_provenance_pipeline_steps_continuity():
    """Test 4: Provenance pipeline contains complete 5-stage reconstruction and verification sequence."""
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p["id"] for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")
    units_res = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    unit_f01 = [u for u in units_res.json() if u["floor_code"] == "F01"][0]
    
    ev_res = client.get(f"/api/vertical-units/{unit_f01['id']}/evidence")
    assert ev_res.status_code == 200
    pipeline = ev_res.json()["provenance_pipeline"]
    
    assert len(pipeline) == 5
    stages = [step["stage"] for step in pipeline]
    assert stages == [
        "SOURCE_DATASET",
        "EXTRACTION_SEGMENTATION",
        "3D_SOLID_RECONSTRUCTION",
        "SPATIAL_VALIDATION",
        "LIFECYCLE_STATE"
    ]
    
    step_5 = pipeline[4]
    assert step_5["status"] == "UNDER_REVIEW"
    assert "surveyor review in progress" in step_5["details"].lower()


def test_05_underground_evidence_differentiation():
    """Test 5: Subterranean units (SB and UT) are identified with non-optical LiDAR provenance explanations."""
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p["id"] for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F7")
    units_res = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    
    # Utility UT01
    unit_ut01 = [u for u in units_res.json() if u["tier_code"] == "UT"][0]
    ev_ut01 = client.get(f"/api/vertical-units/{unit_ut01['id']}/evidence").json()
    assert ev_ut01["is_underground"] is True
    assert "optical airborne lidar" in ev_ut01["underground_provenance_note"].lower()
    assert "utility" in ev_ut01["underground_provenance_note"].lower()
    
    # Basement SB01
    unit_sb01 = [u for u in units_res.json() if u["tier_code"] == "SB"][0]
    ev_sb01 = client.get(f"/api/vertical-units/{unit_sb01['id']}/evidence").json()
    assert ev_sb01["is_underground"] is True
    assert "basement" in ev_sb01["underground_provenance_note"].lower()


def test_06_evidence_endpoint_404_for_nonexistent_unit():
    """Test 6: Requesting evidence for unknown UUID returns 404."""
    random_id = str(uuid.uuid4())
    res = client.get(f"/api/vertical-units/{random_id}/evidence")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_07_evidence_inspection_is_read_only_and_preserves_state():
    """Test 7: Reading evidence does not mutate database or vertical unit lifecycle status."""
    parcels_res = client.get("/api/parcels")
    parcel_id = next(p["id"] for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")
    units_res = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    unit_f02_rej = [u for u in units_res.json() if u["status"] == "REJECTED"][0]
    
    # Query evidence multiple times
    for _ in range(3):
        res = client.get(f"/api/vertical-units/{unit_f02_rej['id']}/evidence")
        assert res.status_code == 200
        assert res.json()["status"] == "REJECTED"
        
    # Verify unit status remains REJECTED
    unit_check = client.get(f"/api/vertical-units/{unit_f02_rej['id']}").json()
    assert unit_check["status"] == "REJECTED"


def test_08_multiple_evidence_support():
    """Test 8: Database supports multiple evidence records attached to a single unit."""
    import json
    db = SessionLocal()
    test_unit_id = uuid.uuid4()
    ev1_id = uuid.uuid4()
    ev2_id = uuid.uuid4()
    try:
        parcel_id = db.execute(text("SELECT id FROM parcels LIMIT 1;")).scalar()
        bldg_id = db.execute(text("SELECT id FROM buildings LIMIT 1;")).scalar()

        db.execute(text("""
            INSERT INTO vertical_units (
                id, parcel_id, building_id, prototype_ulpin_3d, tier_code, floor_code,
                unit_sequence, unit_label, unit_type, z_min, z_max, geom_3d, status
            ) VALUES (
                :id, :parcel_id, :bldg_id, '27A8B9C3D4E5F6-3D-F99-9999', 'F', 'F99',
                9999, 'Multi-Evidence Test Unit', 'RESIDENTIAL', 550.0, 553.0,
                ST_SetSRID(ST_GeomFromText('POLYHEDRALSURFACE Z (((219405 1932502.5 550, 219425 1932502.5 550, 219425 1932517.5 550, 219405 1932517.5 550, 219405 1932502.5 550)), ((219405 1932502.5 553, 219405 1932517.5 553, 219425 1932517.5 553, 219425 1932502.5 553, 219405 1932502.5 553)), ((219405 1932502.5 550, 219405 1932502.5 553, 219425 1932502.5 553, 219425 1932502.5 550, 219405 1932502.5 550)), ((219425 1932502.5 550, 219425 1932502.5 553, 219425 1932517.5 553, 219425 1932517.5 550, 219425 1932502.5 550)), ((219425 1932517.5 550, 219425 1932517.5 553, 219405 1932517.5 553, 219405 1932517.5 550, 219425 1932517.5 550)), ((219405 1932517.5 550, 219405 1932517.5 553, 219405 1932502.5 553, 219405 1932502.5 550, 219405 1932517.5 550)))'), 32644),
                'PROPOSED'
            );
        """), {"id": test_unit_id, "parcel_id": parcel_id, "bldg_id": bldg_id})

        db.execute(text("""
            INSERT INTO source_evidence (
                id, unit_id, source_type, dataset_name, file_uri, accuracy_horizontal_m, accuracy_vertical_m, metadata_json
            ) VALUES (
                :ev_id, :unit_id, :source_type, :dataset_name, :file_uri, :acc_h, :acc_v, :meta_json
            );
        """), {
            "ev_id": ev1_id,
            "unit_id": test_unit_id,
            "source_type": "LIDAR_POINTCLOUD",
            "dataset_name": "prototype_lidar.las",
            "file_uri": "data/simulated/prototype_lidar.las",
            "acc_h": 0.05,
            "acc_v": 0.05,
            "meta_json": json.dumps({"sensor": "RIEGL"})
        })

        db.execute(text("""
            INSERT INTO source_evidence (
                id, unit_id, source_type, dataset_name, file_uri, accuracy_horizontal_m, accuracy_vertical_m, metadata_json
            ) VALUES (
                :ev_id, :unit_id, :source_type, :dataset_name, :file_uri, :acc_h, :acc_v, :meta_json
            );
        """), {
            "ev_id": ev2_id,
            "unit_id": test_unit_id,
            "source_type": "BIM_IFC",
            "dataset_name": "arch_model.ifc",
            "file_uri": "models/arch_model.ifc",
            "acc_h": 0.02,
            "acc_v": 0.01,
            "meta_json": json.dumps({"guid": "1234"})
        })

        db.commit()

        # Test API returns both evidence records
        res = client.get(f"/api/vertical-units/{test_unit_id}/evidence")
        assert res.status_code == 200
        data = res.json()
        assert data["evidence_count"] == 2
        assert len(data["evidence_records"]) == 2
        sources = {r["source_type"] for r in data["evidence_records"]}
        assert sources == {"LIDAR_POINTCLOUD", "BIM_IFC"}
        assert data["overall_assessment_level"] == "HIGH"

    finally:
        db.rollback()
        db.execute(text("DELETE FROM source_evidence WHERE unit_id = :id;"), {"id": test_unit_id})
        db.execute(text("DELETE FROM vertical_units WHERE id = :id;"), {"id": test_unit_id})
        db.commit()
        db.close()


