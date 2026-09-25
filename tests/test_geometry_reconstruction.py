"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 3.4 Real-World 3D Geometry Processing & Reconstruction Test Suite.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models.entities import VerticalUnit, SourceEvidence

client = TestClient(app)

# Irregular L-shaped 2D polygon in EPSG:32644 (Ground Podium)
PODIUM_L_SHAPED_FOOTPRINT = [
    [219400.0, 1932500.0],
    [219430.0, 1932500.0],
    [219430.0, 1932515.0],
    [219415.0, 1932515.0],
    [219415.0, 1932530.0],
    [219400.0, 1932530.0],
    [219400.0, 1932500.0]
]

# Setback upper tower footprint (smaller rectangular core)
TOWER_SETBACK_FOOTPRINT = [
    [219405.0, 1932502.5],
    [219425.0, 1932502.5],
    [219425.0, 1932517.5],
    [219405.0, 1932517.5],
    [219405.0, 1932502.5]
]

# Cantilevered upper floor footprint extending outward
CANTILEVER_FLOOR_FOOTPRINT = [
    [219403.0, 1932500.0],
    [219427.0, 1932500.0],
    [219427.0, 1932520.0],
    [219403.0, 1932520.0],
    [219403.0, 1932500.0]
]


def test_01_pointcloud_extraction_success():
    """Verify point cloud loading, ground estimation, and storey interval extraction."""
    payload = {
        "las_file_path": "data/simulated/prototype_tower_a.las",
        "source_crs": 32644,
        "target_crs": 32644,
        "footprint_method": "CONCAVE_HULL",
        "concave_ratio": 0.5,
        "filter_noise_outliers": True
    }
    res = client.post("/api/geometry/extract-pointcloud", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["total_points"] > 0
    assert data["ground_points"] > 0
    assert data["building_points"] > 0
    assert data["ground_elevation_m"] > 530.0
    assert data["roof_elevation_m"] > data["ground_elevation_m"]
    assert data["above_ground_height_m"] > 0.0
    assert data["detected_storeys"] >= 3
    assert len(data["storey_intervals"]) >= 3
    assert "VALID_POINTCLOUD_EXTRACTION" in data["quality_flags"]
    assert "NO_UNDERGROUND_LIDAR_EVIDENCE" in data["quality_flags"]


def test_02_pointcloud_missing_crs_rejected():
    """Verify point cloud extraction strictly rejects requests lacking explicit CRS."""
    payload = {
        "las_file_path": "data/simulated/prototype_tower_a.las",
        "source_crs": None
    }
    res = client.post("/api/geometry/extract-pointcloud", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "REJECTED"
    assert "MISSING_CRS" in data["quality_flags"]
    assert "Missing source CRS" in data["message"]


def test_03_pointcloud_convex_hull_footprint():
    """Verify convex hull extraction produces valid polygon geometry."""
    payload = {
        "las_file_path": "data/simulated/prototype_tower_a.las",
        "source_crs": 32644,
        "target_crs": 32644,
        "footprint_method": "CONVEX_HULL"
    }
    res = client.post("/api/geometry/extract-pointcloud", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["footprint_area_sqm"] > 0.0
    assert "POLYGON" in data["footprint_wkt"]


def test_04_pointcloud_bounding_box_footprint():
    """Verify axis-aligned bounding box extraction method."""
    payload = {
        "las_file_path": "data/simulated/prototype_tower_a.las",
        "source_crs": 32644,
        "target_crs": 32644,
        "footprint_method": "BOUNDING_BOX"
    }
    res = client.post("/api/geometry/extract-pointcloud", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["footprint_area_sqm"] > 0.0


def test_05_reconstruct_multilevel_with_varying_footprints():
    """Verify reconstruction of a multi-level building with differing floor footprints (podium + setback tower)."""
    payload = {
        "parcel_ulpin_2d": "27A8B9C3D4E5F6",
        "building_code": "TOWER-VAR",
        "dataset_name": "PODIUM_TOWER_SURVEY_P34",
        "levels": [
            {
                "floor_code": "F00",
                "tier_code": "F",
                "z_min": 540.0,
                "z_max": 543.5,
                "footprint_coords": PODIUM_L_SHAPED_FOOTPRINT,
                "unit_label": "Ground Commercial Podium",
                "unit_type": "COMMERCIAL"
            },
            {
                "floor_code": "F01",
                "tier_code": "F",
                "z_min": 543.5,
                "z_max": 546.5,
                "footprint_coords": TOWER_SETBACK_FOOTPRINT,
                "unit_label": "Setback Tower Office Level 1",
                "unit_type": "OFFICE"
            },
            {
                "floor_code": "F02",
                "tier_code": "F",
                "z_min": 546.5,
                "z_max": 549.5,
                "footprint_coords": CANTILEVER_FLOOR_FOOTPRINT,
                "unit_label": "Cantilevered Balcony Level 2",
                "unit_type": "RESIDENTIAL"
            }
        ],
        "integrate_candidates": False
    }
    res = client.post("/api/geometry/reconstruct-multilevel", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["total_levels_reconstructed"] == 3
    assert data["total_volume_cbm"] > 0.0
    assert len(data["reconstructed_units"]) == 3

    # Check Level 0 (Irregular L-Shaped Podium)
    lvl0 = data["reconstructed_units"][0]
    assert lvl0["floor_code"] == "F00"
    assert lvl0["is_solid_2manifold"] is True
    assert lvl0["is_watertight"] is True
    assert lvl0["volume_cbm"] > 1000.0  # L-shaped 675 sqm * 3.5m = 2362.5 cbm
    assert "VALID_3D_SOLID" in lvl0["quality_flags"]
    assert "IRREGULAR_LEVEL_FOOTPRINT" in lvl0["quality_flags"]

    # Check Level 1 (Setback Tower)
    lvl1 = data["reconstructed_units"][1]
    assert lvl1["floor_code"] == "F01"
    assert lvl1["is_solid_2manifold"] is True
    assert lvl1["volume_cbm"] > 0.0

    # Check Level 2 (Cantilever Floor)
    lvl2 = data["reconstructed_units"][2]
    assert lvl2["floor_code"] == "F02"
    assert lvl2["is_solid_2manifold"] is True
    assert lvl2["volume_cbm"] > 0.0


def test_06_validate_solid_endpoint_sfcgal():
    """Verify direct POST /api/geometry/validate-solid endpoint evaluates SFCGAL 2-manifold validity."""
    # Extrude L-shaped polygon to WKT
    from backend.app.services.geometry_reconstruction_service import GeometryReconstructionService
    db = SessionLocal()
    try:
        service = GeometryReconstructionService(db)
        wkt, _ = service.reconstruct_polyhedralsurface_solid(PODIUM_L_SHAPED_FOOTPRINT, 540.0, 543.0)
    finally:
        db.close()

    res = client.post("/api/geometry/validate-solid", json={"wkt": wkt, "parcel_ulpin_2d": "27A8B9C3D4E5F6"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["validation"]["is_solid"] is True
    assert data["validation"]["is_closed"] is True
    assert data["validation"]["volume_cbm"] > 0.0
    assert data["validation"]["z_min"] == 540.0
    assert data["validation"]["z_max"] == 543.0


def test_07_validate_solid_empty_payload_400():
    """Verify that empty payloads return 400 Bad Request."""
    res = client.post("/api/geometry/validate-solid", json={})
    assert res.status_code == 400


def test_08_validate_solid_invalid_wkt_422():
    """Verify that unparseable or self-intersecting WKT returns 422 Unprocessable Entity."""
    res = client.post("/api/geometry/validate-solid", json={"wkt": "POLYHEDRALSURFACE Z (((0 0 0, 1 1 1)))"})
    assert res.status_code == 422


def test_09_multilevel_candidate_integration_lifecycle_proposed():
    """Verify that candidate units integrated through multi-level reconstruction enter as PROPOSED."""
    payload = {
        "parcel_ulpin_2d": "27A8B9C3D4E5F6",
        "building_code": "TOWER-A",
        "dataset_name": "MULTI_LEVEL_P34_PROPOSED_TEST",
        "levels": [
            {
                "floor_code": "F88",
                "tier_code": "F",
                "z_min": 560.0,
                "z_max": 563.0,
                "footprint_coords": TOWER_SETBACK_FOOTPRINT,
                "unit_label": "High-Rise Penthouse F88",
                "unit_type": "RESIDENTIAL"
            }
        ],
        "integrate_candidates": True
    }
    res = client.post("/api/geometry/reconstruct-multilevel", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "SUCCESS"
    assert data["candidates_integrated"] == 1
    assert len(data["candidate_unit_ids"]) == 1
    unit_id = data["candidate_unit_ids"][0]

    # Verify unit status is PROPOSED and teardown
    db: Session = SessionLocal()
    try:
        unit = db.query(VerticalUnit).filter(VerticalUnit.id == unit_id).first()
        assert unit is not None
        assert unit.status == "PROPOSED"
    finally:
        db.execute(text("DELETE FROM verification_audit WHERE unit_id = :uid"), {"uid": unit_id})
        db.execute(text("DELETE FROM source_evidence WHERE unit_id = :uid"), {"uid": unit_id})
        db.execute(text("DELETE FROM vertical_units WHERE id = :uid"), {"uid": unit_id})
        db.commit()
        db.close()


def test_10_reconstruction_inverted_z_rejected():
    """Verify that inverted elevation bounds (z_max <= z_min) are strictly rejected by Pydantic validation."""
    payload = {
        "parcel_ulpin_2d": "27A8B9C3D4E5F6",
        "building_code": "TOWER-A",
        "levels": [
            {
                "floor_code": "F01",
                "z_min": 550.0,
                "z_max": 545.0,  # Inverted
                "footprint_coords": TOWER_SETBACK_FOOTPRINT
            }
        ]
    }
    res = client.post("/api/geometry/reconstruct-multilevel", json=payload)
    assert res.status_code == 422


def test_11_concave_hull_tightness_variation():
    """Verify point cloud extraction with varying concave hull ratio parameters."""
    for ratio in [0.2, 0.5, 0.8]:
        payload = {
            "las_file_path": "data/simulated/prototype_tower_a.las",
            "source_crs": 32644,
            "target_crs": 32644,
            "footprint_method": "CONCAVE_HULL",
            "concave_ratio": ratio
        }
        res = client.post("/api/geometry/extract-pointcloud", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "SUCCESS"
        assert data["footprint_area_sqm"] > 0.0


def test_12_non_watertight_wkt_evaluation():
    """Verify that an open / non-closed PolyhedralSurface reports is_closed=False."""
    # Open box missing top face
    open_wkt = """POLYHEDRALSURFACE Z (
        ((219400 1932500 540, 219410 1932500 540, 219410 1932510 540, 219400 1932510 540, 219400 1932500 540)),
        ((219400 1932500 540, 219410 1932500 540, 219410 1932500 543, 219400 1932500 543, 219400 1932500 540)),
        ((219410 1932500 540, 219410 1932510 540, 219410 1932510 543, 219410 1932500 543, 219410 1932500 540)),
        ((219410 1932510 540, 219400 1932510 540, 219400 1932510 543, 219410 1932510 543, 219410 1932510 540)),
        ((219400 1932510 540, 219400 1932500 540, 219400 1932500 543, 219400 1932510 543, 219400 1932510 540))
    )"""
    res = client.post("/api/geometry/validate-solid", json={"wkt": open_wkt})
    assert res.status_code == 200
    data = res.json()
    assert data["validation"]["is_closed"] is False


def test_13_parcel_containment_out_of_bounds():
    """Verify that geometry extending far outside parcel boundary reports is_within_parcel=False."""
    # Footprint 10km away from parcel MH-PUN-001 / 27A8B9C3D4E5F6
    far_footprint = [
        [300000.0, 2000000.0],
        [300020.0, 2000000.0],
        [300020.0, 2000020.0],
        [300000.0, 2000020.0],
        [300000.0, 2000000.0]
    ]
    payload = {
        "parcel_ulpin_2d": "27A8B9C3D4E5F6",
        "building_code": "TOWER-FAR",
        "levels": [
            {
                "floor_code": "F00",
                "z_min": 540.0,
                "z_max": 543.0,
                "footprint_coords": far_footprint
            }
        ]
    }
    res = client.post("/api/geometry/reconstruct-multilevel", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["reconstructed_units"][0]["is_within_parcel"] is False
    assert "OUTSIDE_PARCEL_BOUNDARY" in data["reconstructed_units"][0]["quality_flags"]


def test_14_multilevel_volume_conservation():
    """Verify multi-level volume calculation matches sum of individual level volumes."""
    payload = {
        "parcel_ulpin_2d": "27A8B9C3D4E5F6",
        "building_code": "TOWER-VOL",
        "levels": [
            {
                "floor_code": "F00",
                "z_min": 540.0,
                "z_max": 543.0,  # 3m * 300sqm = 900 cbm
                "footprint_coords": TOWER_SETBACK_FOOTPRINT
            },
            {
                "floor_code": "F01",
                "z_min": 543.0,
                "z_max": 546.0,  # 3m * 300sqm = 900 cbm
                "footprint_coords": TOWER_SETBACK_FOOTPRINT
            }
        ]
    }
    res = client.post("/api/geometry/reconstruct-multilevel", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert round(data["total_volume_cbm"], 1) == 1800.0
    assert data["reconstructed_units"][0]["volume_cbm"] == 900.0
    assert data["reconstructed_units"][1]["volume_cbm"] == 900.0


def test_15_optical_lidar_cannot_infer_underground_rule():
    """Verify point cloud extraction attaches NO_UNDERGROUND_LIDAR_EVIDENCE quality flag."""
    payload = {
        "las_file_path": "data/simulated/prototype_tower_a.las",
        "source_crs": 32644,
        "target_crs": 32644
    }
    res = client.post("/api/geometry/extract-pointcloud", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "NO_UNDERGROUND_LIDAR_EVIDENCE" in data["quality_flags"]

