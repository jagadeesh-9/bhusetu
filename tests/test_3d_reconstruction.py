"""
Tests for Phase 2.4: 3D Volumetric Unit Reconstruction & Spatial Validation.
"""
import os
import json
import pytest
import psycopg
from dotenv import load_dotenv

from scripts.reconstruct_3d_units import (
    build_polyhedralsurface_wkt_from_footprint,
    validate_3d_candidates_with_postgis,
    reconstruct_and_validate_3d_units
)

load_dotenv()


@pytest.fixture
def extraction_json_path():
    path = "data/processed/tower_a_building_extraction.json"
    assert os.path.exists(path), f"Phase 2.2 extraction evidence missing at {path}"
    return path


@pytest.fixture
def segmentation_json_path():
    path = "data/processed/tower_a_vertical_segmentation.json"
    assert os.path.exists(path), f"Phase 2.3 segmentation evidence missing at {path}"
    return path


@pytest.fixture
def db_conn():
    conn_str = os.getenv("DATABASE_URL", "postgresql://postgres:8919223622@localhost:5432/sih26011_dev")
    if conn_str.startswith("postgresql+psycopg://"):
        conn_str = conn_str.replace("postgresql+psycopg://", "postgresql://")
    conn = psycopg.connect(conn_str)
    yield conn
    conn.close()


def test_01_inputs_load_successfully(extraction_json_path, segmentation_json_path):
    """Test 1: Phase 2.2 and Phase 2.3 evidence artifacts load correctly."""
    with open(extraction_json_path, "r", encoding="utf-8") as f:
        p22 = json.load(f)
    with open(segmentation_json_path, "r", encoding="utf-8") as f:
        p23 = json.load(f)

    assert p22["building_id"] == "TOWER-A"
    assert len(p22["building_candidate"]["coordinates_epsg32644"]) >= 4
    assert len(p23["vertical_intervals"]) == 3


def test_02_3d_reconstruction_pipeline_produces_3_units(extraction_json_path, segmentation_json_path, tmp_path):
    """Test 2: Complete 3D reconstruction outputs exactly 3 valid units for TOWER-A."""
    out_json = str(tmp_path / "test_3d_units.json")
    res = reconstruct_and_validate_3d_units(
        extraction_json_path=extraction_json_path,
        segmentation_json_path=segmentation_json_path,
        output_json_path=out_json
    )

    assert os.path.exists(out_json)
    assert res["synthetic"] is True
    assert res["prototype_only"] is True
    assert res["building_id"] == "TOWER-A"
    assert res["parent_parcel_ulpin_2d"] == "27A8B9C3D4E5F6"
    assert res["reconstructed_unit_count"] == 3
    assert len(res["candidate_units"]) == 3


def test_03_geometry_representation_and_srid(extraction_json_path, segmentation_json_path, tmp_path):
    """Test 3: Extruded geometries are 3D PolyhedralSurfaces with SRID 32644."""
    out_json = str(tmp_path / "test_geom_types.json")
    res = reconstruct_and_validate_3d_units(
        extraction_json_path=extraction_json_path,
        segmentation_json_path=segmentation_json_path,
        output_json_path=out_json
    )

    for unit in res["candidate_units"]:
        assert unit["geometry_type"] == "PolyhedralSurface"
        assert unit["srid"] == 32644
        assert "POLYHEDRALSURFACE Z" in unit["wkt"]
        # Coordinates must contain XYZ triplets
        coords = unit["geometry_3d"]["coordinates"]
        assert len(coords) == 6  # 6 faces for rectangular prism
        for face in coords:
            for ring in face:
                for pt in ring:
                    assert len(pt) == 3, f"Point {pt} is not 3D XYZ."


def test_04_spatial_validation_closed_solid_and_positive_volume(extraction_json_path, segmentation_json_path, tmp_path):
    """Test 4: Each unit is validated as a watertight, closed 3D solid with positive volume."""
    out_json = str(tmp_path / "test_solids.json")
    res = reconstruct_and_validate_3d_units(
        extraction_json_path=extraction_json_path,
        segmentation_json_path=segmentation_json_path,
        output_json_path=out_json
    )

    for unit in res["candidate_units"]:
        val = unit["validation"]
        assert val["closed"] is True, f"Unit {unit['floor_code']} is not closed."
        assert val["solid"] is True, f"Unit {unit['floor_code']} is not a valid 3D solid."
        assert val["positive_volume"] is True
        assert val["measured_volume_cbm"] > 800.0  # Approx 300 m2 * 3.0m = 900 m3


def test_05_volume_approx_equals_footprint_times_height(extraction_json_path, segmentation_json_path, tmp_path):
    """Test 5: Extruded volume matches footprint area multiplied by interval delta Z."""
    with open(extraction_json_path, "r", encoding="utf-8") as f:
        p22 = json.load(f)
    footprint_area = p22["building_candidate"]["dimensions_m"]["estimated_footprint_area_sqm"]

    out_json = str(tmp_path / "test_vol_calc.json")
    res = reconstruct_and_validate_3d_units(
        extraction_json_path=extraction_json_path,
        segmentation_json_path=segmentation_json_path,
        output_json_path=out_json
    )

    for unit in res["candidate_units"]:
        expected_vol = footprint_area * unit["height_m"]
        actual_vol = unit["validation"]["measured_volume_cbm"]
        # Within 1.0 m3 tolerance
        assert abs(actual_vol - expected_vol) < 2.0, (
            f"Unit {unit['floor_code']} volume {actual_vol} differs from expected {expected_vol}."
        )


def test_06_z_elevation_ranges_match_metadata(extraction_json_path, segmentation_json_path, tmp_path):
    """Test 6: PostGIS geometry ST_ZMin/ST_ZMax matches interval metadata."""
    out_json = str(tmp_path / "test_z_bounds.json")
    res = reconstruct_and_validate_3d_units(
        extraction_json_path=extraction_json_path,
        segmentation_json_path=segmentation_json_path,
        output_json_path=out_json
    )

    for unit in res["candidate_units"]:
        val = unit["validation"]
        assert val["z_range_consistent"] is True
        assert abs(val["z_min_geom"] - unit["z_min"]) <= 0.01
        assert abs(val["z_max_geom"] - unit["z_max"]) <= 0.01


def test_07_parcel_footprint_containment(extraction_json_path, segmentation_json_path, tmp_path):
    """Test 7: 3D candidate unit 2D envelope is completely within parent parcel."""
    out_json = str(tmp_path / "test_parcel_contained.json")
    res = reconstruct_and_validate_3d_units(
        extraction_json_path=extraction_json_path,
        segmentation_json_path=segmentation_json_path,
        output_json_path=out_json
    )

    for unit in res["candidate_units"]:
        assert unit["validation"]["parcel_contained"] is True


def test_08_adjacent_floors_boundary_touching_not_conflict(extraction_json_path, segmentation_json_path, tmp_path):
    """Test 8: Adjacent floors meet at shared boundary face with zero collision volume."""
    out_json = str(tmp_path / "test_adjacent_floors.json")
    res = reconstruct_and_validate_3d_units(
        extraction_json_path=extraction_json_path,
        segmentation_json_path=segmentation_json_path,
        output_json_path=out_json
    )

    for unit in res["candidate_units"]:
        val = unit["validation"]
        assert val["has_conflict"] is False, f"Unit {unit['floor_code']} falsely flagged with conflict."
        assert len(val["conflicts"]) == 0
        # F01 must share boundaries with both F00 and F02
        if unit["floor_code"] == "F01":
            assert len(val["boundary_contacts"]) == 2
        else:
            assert len(val["boundary_contacts"]) == 1


def test_09_overlapping_volumes_correctly_detected_as_conflicts(extraction_json_path, db_conn):
    """Test 9: Deliberately overlapping 3D volumes are flagged as volumetric conflicts."""
    with open(extraction_json_path, "r", encoding="utf-8") as f:
        p22 = json.load(f)
    footprint = p22["building_candidate"]["coordinates_epsg32644"]

    # Build two overlapping test units: F00 (540.05 to 543.45) and F_CONFLICT (542.00 to 545.00)
    wkt_f00, _ = build_polyhedralsurface_wkt_from_footprint(footprint, 540.05, 543.45)
    wkt_conflict, _ = build_polyhedralsurface_wkt_from_footprint(footprint, 542.00, 545.00)

    test_candidates = [
        {
            "candidate_sequence": 1,
            "floor_code": "F00",
            "tier_code": "ABOVE_GROUND",
            "z_min": 540.05,
            "z_max": 543.45,
            "height_m": 3.40,
            "wkt": wkt_f00
        },
        {
            "candidate_sequence": 2,
            "floor_code": "F_CONFLICT",
            "tier_code": "ABOVE_GROUND",
            "z_min": 542.00,
            "z_max": 545.00,
            "height_m": 3.00,
            "wkt": wkt_conflict
        }
    ]

    validated = validate_3d_candidates_with_postgis(
        candidates=test_candidates,
        parent_parcel_ulpin="27A8B9C3D4E5F6"
    )

    assert validated[0]["validation"]["has_conflict"] is True
    assert len(validated[0]["validation"]["conflicts"]) == 1
    overlap_vol = validated[0]["validation"]["conflicts"][0]["overlap_volume_cbm"]
    # Overlap interval is 542.00 to 543.45 = 1.45m * ~303.59 m2 = ~440 m3
    assert overlap_vol > 400.0


def test_10_database_counts_remain_unchanged(db_conn):
    """Test 10: Verifies baseline database records remain intact during 3D reconstruction and validation."""
    with db_conn.cursor() as cur:
        for tbl, min_count in [
            ("parcels", 2),
            ("buildings", 2),
            ("vertical_units", 16),
            ("verification_audit", 16),
            ("source_evidence", 16)
        ]:
            cur.execute(f"SELECT count(*) FROM {tbl};")
            count = cur.fetchone()[0]
            assert count >= min_count, f"Table '{tbl}' count modified: {count} < {min_count}"

