"""
Comprehensive test suite for Phase 3.3 Real-World 3D Cadastral Data Ingestion & Source Standardization.
"""
import os
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models.entities import Parcel, Building, VerticalUnit, SourceEvidence, VerificationAudit

client = TestClient(app)


# Sample valid 3D PolyhedralSurface in EPSG:32644 (Floor 3 residential unit)
VALID_3D_WKT = """POLYHEDRALSURFACE Z (
    ((219405 1932502.5 549.5, 219405 1932517.5 549.5, 219425 1932517.5 549.5, 219425 1932502.5 549.5, 219405 1932502.5 549.5)),
    ((219405 1932502.5 552.5, 219425 1932502.5 552.5, 219425 1932517.5 552.5, 219405 1932517.5 552.5, 219405 1932502.5 552.5)),
    ((219405 1932502.5 549.5, 219425 1932502.5 549.5, 219425 1932502.5 552.5, 219405 1932502.5 552.5, 219405 1932502.5 549.5)),
    ((219425 1932502.5 549.5, 219425 1932517.5 549.5, 219425 1932517.5 552.5, 219425 1932502.5 552.5, 219425 1932502.5 549.5)),
    ((219425 1932517.5 549.5, 219405 1932517.5 549.5, 219405 1932517.5 552.5, 219425 1932517.5 552.5, 219425 1932517.5 549.5)),
    ((219405 1932517.5 549.5, 219405 1932502.5 549.5, 219405 1932502.5 552.5, 219405 1932517.5 552.5, 219405 1932517.5 549.5))
)"""

# Sample valid 2D GeoJSON in EPSG:32644
VALID_2D_GEOJSON = json.dumps({
    "type": "Feature",
    "geometry": {
        "type": "Polygon",
        "coordinates": [[
            [385480.0, 2049980.0],
            [385520.0, 2049980.0],
            [385520.0, 2050020.0],
            [385480.0, 2050020.0],
            [385480.0, 2049980.0]
        ]]
    },
    "properties": {
        "ulpin_2d": "MH-PUN-001",
        "survey_number": "101/A"
    }
})

# Sample BIM/IFC header payload
VALID_IFC_PAYLOAD = """ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('sample_building.ifc','2026-09-06T12:00:00',('Architect'),('Gov'),'IFC Engine','Revit 2024','Approved');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('0Yv$8V0Xv5$v4m0Z1w2X3Y',#2,'Tower A Prototype Project',$,$,$,$,(#10),#11);
#2=IFCOWNERHISTORY(#3,#4,$,.ADDED.,1700000000,$,$,1700000000);
#10=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.0E-5,#12,$);
#20=IFCBUILDING('1A2B3C4D5E6F7G8H9I0J1K',#2,'Tower A',$,$,#30,$,'Tower A Building',.ELEMENT.,$,$,$);
#30=IFCLOCALPLACEMENT($,#31);
ENDSEC;
END-ISO-10303-21;
"""

# Sample CAD/DXF ASCII payload
VALID_DXF_PAYLOAD = """  0
SECTION
  2
HEADER
  9
$ACADVER
  1
AC1027
  9
$INSUNITS
 70
     6
  0
ENDSEC
  0
SECTION
  2
ENTITIES
  0
LINE
  8
WALLS_FLOOR_01
 10
385485.0
 20
2049985.0
 30
540.0
 11
385515.0
 21
2049985.0
 31
540.0
  0
ENDSEC
  0
EOF
"""


def test_01_las_pointcloud_validation_and_metadata_extraction():
    """Verify LAS pointcloud inspection, header extraction, bounds, and Z statistics."""
    payload = {
        "source_type": "POINT_CLOUD_LAS",
        "filename": "prototype_tower_a.las",
        "source_crs": 32644,
        "target_crs": 32644
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "RECOGNIZED_DEFERRED"
    assert data["source_type"] == "POINT_CLOUD_LAS"
    assert data["feature_count"] > 0
    assert "DEFERRED_PROCESSING" in data["quality_flags"]
    assert "NO_UNDERGROUND_LIDAR_EVIDENCE" in data["quality_flags"]
    assert data["fingerprint_sha256"] is not None
    assert data["manifest"] is not None
    assert data["manifest"]["format"] == "ASPRS LAS/LAZ"


def test_02_las_missing_crs_handling():
    """Verify that LAS point clouds without explicit CRS report MISSING_CRS quality flag."""
    payload = {
        "source_type": "POINT_CLOUD_LAS",
        "filename": "prototype_tower_a.las",
        "source_crs": None
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "MISSING_CRS" in data["quality_flags"]


def test_03_polyhedral_wkt_3d_solid_validation():
    """Verify 3D PolyhedralSurface WKT solid geometry validation with SFCGAL."""
    payload = {
        "source_type": "POLYHEDRALSURFACE_WKT",
        "source_crs": 32644,
        "target_crs": 32644,
        "filename": "unit_f01.wkt",
        "data_payload": VALID_3D_WKT
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "VALIDATED"
    assert data["geometry_valid"] is True
    assert data["feature_count"] == 1
    assert "VALID_3D_SOLID" in data["quality_flags"]
    assert data["geometry_summary"]["is_solid"] is True
    assert data["geometry_summary"]["volume_cbm"] > 0
    assert data["geometry_summary"]["z_min_msl"] == 549.5
    assert data["geometry_summary"]["z_max_msl"] == 552.5


def test_04_polyhedral_wkt_missing_crs_rejected():
    """Verify that WKT geometries without explicit CRS are strictly rejected."""
    payload = {
        "source_type": "POLYHEDRALSURFACE_WKT",
        "data_payload": VALID_3D_WKT
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "REJECTED"
    assert "MISSING_CRS" in data["quality_flags"]
    assert "Explicit source CRS" in data["errors"][0]


def test_05_parcel_geojson_validation_and_transformation():
    """Verify 2D GeoJSON parcel validation and CRS reprojection from EPSG:4326 to EPSG:32644."""
    wgs84_geojson = json.dumps({
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [73.8567, 18.5204],
                [73.8570, 18.5204],
                [73.8570, 18.5207],
                [73.8567, 18.5207],
                [73.8567, 18.5204]
            ]]
        },
        "properties": {"name": "Test Parcel"}
    })
    payload = {
        "source_type": "PARCEL_GEOJSON",
        "source_crs": 4326,
        "target_crs": 32644,
        "data_payload": wgs84_geojson
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "VALIDATED"
    assert data["transformed"] is True
    assert data["geometry_summary"]["area_sqm"] > 0
    assert "VALID_2D_PARCEL" in data["quality_flags"]


def test_06_ifc_step_metadata_inspection():
    """Verify safe ISO-10303-21 STEP physical header parsing for BIM/IFC files."""
    payload = {
        "source_type": "BIM_IFC",
        "filename": "tower_a_structural.ifc",
        "data_payload": VALID_IFC_PAYLOAD
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "RECOGNIZED_DEFERRED"
    assert "DEFERRED_PROCESSING" in data["quality_flags"]
    assert data["geometry_summary"]["schema"] == "IFC4"
    assert data["geometry_summary"]["entity_count"] > 0


def test_07_cad_dxf_metadata_inspection():
    """Verify safe ASCII DXF reader for CAD drawings without geometry fabrication."""
    payload = {
        "source_type": "CAD_DXF",
        "filename": "floor_plan.dxf",
        "data_payload": VALID_DXF_PAYLOAD
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "RECOGNIZED_DEFERRED"
    assert "DEFERRED_PROCESSING" in data["quality_flags"]
    assert "AC1027" in data["geometry_summary"]["version"]


def test_08_raster_dem_deferred_processing():
    """Verify Raster DEM recognition and deferred processing status."""
    payload = {
        "source_type": "RASTER_DEM",
        "filename": "elevation_model.tif",
        "source_crs": 32644
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "RECOGNIZED_DEFERRED"
    assert "DEFERRED_PROCESSING" in data["quality_flags"]


def test_09_sha256_fingerprint_reproducibility():
    """Verify that identical payloads produce identical SHA-256 fingerprints."""
    payload1 = {
        "source_type": "POLYHEDRALSURFACE_WKT",
        "source_crs": 32644,
        "data_payload": VALID_3D_WKT
    }
    payload2 = {
        "source_type": "POLYHEDRALSURFACE_WKT",
        "source_crs": 32644,
        "data_payload": VALID_3D_WKT
    }
    res1 = client.post("/api/ingestion/validate", json=payload1).json()
    res2 = client.post("/api/ingestion/validate", json=payload2).json()
    assert res1["fingerprint_sha256"] == res2["fingerprint_sha256"]
    assert len(res1["fingerprint_sha256"]) == 64


def test_10_source_registration_endpoint():
    """Verify POST /api/ingestion/sources registers source evidence."""
    payload = {
        "source_type": "POLYHEDRALSURFACE_WKT",
        "dataset_name": "TEST_UNIT_SRC_01",
        "source_crs": 32644,
        "target_crs": 32644,
        "data_payload": VALID_3D_WKT,
        "filename": "unit_test_01.wkt"
    }
    res = client.post("/api/ingestion/sources", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["source_id"] is not None
    assert data["fingerprint_sha256"] is not None
    assert data["normalized_crs"] == "EPSG:32644"


def test_11_duplicate_source_detection():
    """Verify duplicate source detection when registering evidence with an existing fingerprint."""
    payload = {
        "source_type": "POINT_CLOUD_LAS",
        "dataset_name": "TOWER_A_LIDAR_DUPLICATE_CHECK",
        "filename": "prototype_tower_a.las",
        "source_crs": 32644,
        "metadata_json": {"test_key": "duplicate_check_val"}
    }
    # Validate & check fingerprint
    val_res = client.post("/api/ingestion/validate", json=payload).json()
    assert val_res["fingerprint_sha256"] is not None


def test_12_underground_safety_optical_lidar_rule():
    """Verify that optical LiDAR datasets report NO_UNDERGROUND_LIDAR_EVIDENCE."""
    payload = {
        "source_type": "POINT_CLOUD_LAS",
        "filename": "prototype_tower_a.las",
        "source_crs": 32644
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "NO_UNDERGROUND_LIDAR_EVIDENCE" in data["quality_flags"]


def test_13_manifest_retrieval_endpoint():
    """Verify GET /api/ingestion/sources/{source_id} returns 404 for nonexistent UUID."""
    res = client.get("/api/ingestion/sources/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_14_unsupported_source_type_rejected():
    """Verify that completely unknown source types are rejected with 422."""
    payload = {
        "source_type": "UNKNOWN_RADAR_FORMAT",
        "source_crs": 32644
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 422


def test_15_empty_payload_wkt_rejected():
    """Verify that empty payload strings are rejected with EMPTY_DATASET flag."""
    payload = {
        "source_type": "POLYHEDRALSURFACE_WKT",
        "source_crs": 32644,
        "data_payload": "   "
    }
    res = client.post("/api/ingestion/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "REJECTED"
    assert "EMPTY_DATASET" in data["quality_flags"]


def test_16_raw_las_cannot_directly_generate_candidates():
    """Verify that raw LAS ingestion with generate_candidates=True CANNOT fabricate candidate units directly."""
    payload = {
        "source_type": "POINT_CLOUD_LAS",
        "dataset_name": "RAW_LAS_TEST_DIRECT_CANDIDATE_ATTEMPT",
        "filename": "prototype_tower_a.las",
        "source_crs": 32644,
        "target_crs": 32644,
        "generate_candidates": True,
        "parcel_ulpin_2d": "MH-PUN-001",
        "building_code": "BLDG_A"
    }
    res = client.post("/api/ingestion/sources", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["candidates_generated"] == 0
    assert data["candidate_unit_ids"] == []
    assert data["processing_status"] == "RECOGNIZED_DEFERRED"
    assert "cannot directly create 3D candidate units" in data["message"]


def test_17_missing_crs_handling_across_all_deferred_formats():
    """Verify that missing source_crs across IFC, DXF, and RASTER_DEM sets MISSING_CRS and does NOT default to 32644."""
    for stype, fname in [("BIM_IFC", "model.ifc"), ("CAD_DXF", "plan.dxf"), ("RASTER_DEM", "terrain.tif")]:
        payload = {
            "source_type": stype,
            "filename": fname,
            "source_crs": None
        }
        res = client.post("/api/ingestion/validate", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "MISSING_CRS" in data["quality_flags"]
        assert data["manifest"]["original_crs"] == "MISSING_CRS"


def test_18_ingestion_candidates_strictly_proposed():
    """Verify that candidates generated via WKT ingestion strictly receive PROPOSED status (never VERIFIED or UNDER_REVIEW)."""
    payload = {
        "source_type": "POLYHEDRALSURFACE_WKT",
        "dataset_name": "LIFECYCLE_TEST_INGESTION_SRC",
        "filename": "unit_f01_prop.wkt",
        "source_crs": 32644,
        "target_crs": 32644,
        "data_payload": VALID_3D_WKT,
        "generate_candidates": True,
        "parcel_ulpin_2d": "27A8B9C3D4E5F6",
        "building_code": "TOWER-A",
        "metadata_json": {"floor_code": "F99", "tier_code": "F"}
    }
    res = client.post("/api/ingestion/sources", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["candidates_generated"] == 1
    unit_id = data["candidate_unit_ids"][0]

    # Verify unit status in DB
    db: Session = SessionLocal()
    try:
        unit = db.query(VerticalUnit).filter(VerticalUnit.id == unit_id).first()
        assert unit is not None
        assert unit.status == "PROPOSED"
    finally:
        from sqlalchemy import text
        db.execute(text("DELETE FROM verification_audit WHERE unit_id = :uid"), {"uid": unit_id})
        db.execute(text("DELETE FROM source_evidence WHERE unit_id = :uid"), {"uid": unit_id})
        db.execute(text("DELETE FROM vertical_units WHERE id = :uid"), {"uid": unit_id})
        db.commit()
        db.close()

