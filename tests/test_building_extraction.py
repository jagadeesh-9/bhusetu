"""
Tests for Phase 2.2: Synthetic LiDAR Building Extraction Engine.
"""
import os
import json
import pytest
import numpy as np
import laspy
from scripts.extract_building_from_lidar import extract_building_from_lidar


@pytest.fixture
def las_file_path():
    path = "data/simulated/prototype_tower_a.las"
    assert os.path.exists(path), f"Required LAS test fixture not found at {path}"
    return path


@pytest.fixture
def ground_truth_meta():
    meta_path = "data/simulated/prototype_lidar_ground_truth.json"
    assert os.path.exists(meta_path), f"Required ground truth metadata not found at {meta_path}"
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_01_las_file_loads_and_has_valid_header(las_file_path):
    """Test 1: LAS file can be read and parsed via laspy."""
    with laspy.open(las_file_path) as reader:
        las = reader.read()
        assert len(las.points) > 0
        assert las.header.version in ("1.4", "1.2")
        assert len(las.x) == len(las.points)
        assert len(las.y) == len(las.points)
        assert len(las.z) == len(las.points)


def test_02_classification_classes_present(las_file_path):
    """Test 2: Expected ASPRS classes (Class 2 Ground, Class 6 Building) are present."""
    las = laspy.read(las_file_path)
    classes = np.unique(las.classification)
    assert 2 in classes, "Ground returns (Class 2) must be present in point cloud."
    assert 6 in classes, "Building returns (Class 6) must be present in point cloud."


def test_03_ground_building_separation(las_file_path, ground_truth_meta):
    """Test 3: Point separation by classification partitions point count accurately."""
    las = laspy.read(las_file_path)
    ground_count = int(np.sum(las.classification == 2))
    bldg_count = int(np.sum(las.classification == 6))

    assert ground_count == ground_truth_meta["classifications"]["2_ground_count"]
    assert bldg_count == ground_truth_meta["classifications"]["6_building_count"]
    assert ground_count + bldg_count == len(las.points)


def test_04_building_candidate_derived_from_observations(las_file_path, tmp_path):
    """Test 4: Candidate footprint is derived from point coordinates, not hardcoded."""
    output_json = str(tmp_path / "extracted_candidate.json")
    res = extract_building_from_lidar(las_path=las_file_path, output_json_path=output_json)

    assert "building_candidate" in res
    candidate = res["building_candidate"]
    assert candidate["geometry_type"] == "Polygon"
    coords = candidate["coordinates_epsg32644"]
    assert len(coords) == 5, "Footprint must be a 5-point closed polygon ring."
    assert coords[0] == coords[-1], "Polygon ring must be closed (first == last vertex)."


def test_05_extracted_xy_bounds_within_tolerance(las_file_path, ground_truth_meta, tmp_path):
    """Test 5: Extracted XY bounds match synthetic TOWER-A bounds within perturbation tolerance."""
    output_json = str(tmp_path / "extracted_bounds.json")
    res = extract_building_from_lidar(las_path=las_file_path, output_json_path=output_json)

    gt_bounds = ground_truth_meta["building_footprint_bounds"]
    ext_bounds = res["building_candidate"]["bounds"]

    tolerance_m = 0.10  # 10 cm tolerance for 0.02m Gaussian noise
    assert abs(ext_bounds["min_x"] - gt_bounds["min_x"]) < tolerance_m
    assert abs(ext_bounds["max_x"] - gt_bounds["max_x"]) < tolerance_m
    assert abs(ext_bounds["min_y"] - gt_bounds["min_y"]) < tolerance_m
    assert abs(ext_bounds["max_y"] - gt_bounds["max_y"]) < tolerance_m

    # Footprint area check (Nominal 300 m2)
    area = res["building_candidate"]["dimensions_m"]["estimated_footprint_area_sqm"]
    assert abs(area - gt_bounds["area_sqm"]) < 10.0


def test_06_extracted_ground_elevation(las_file_path, ground_truth_meta, tmp_path):
    """Test 6: Extracted ground elevation from Class 2 points is close to 540.0 m."""
    output_json = str(tmp_path / "extracted_ground.json")
    res = extract_building_from_lidar(las_path=las_file_path, output_json_path=output_json)

    ground_z = res["vertical_extent"]["ground_z_m"]
    assert abs(ground_z - ground_truth_meta["ground_z"]) < 0.05


def test_07_extracted_roof_elevation(las_file_path, ground_truth_meta, tmp_path):
    """Test 7: Extracted roof elevation from Class 6 points is close to 549.5 m."""
    output_json = str(tmp_path / "extracted_roof.json")
    res = extract_building_from_lidar(las_path=las_file_path, output_json_path=output_json)

    roof_z = res["vertical_extent"]["roof_z_m"]
    assert abs(roof_z - ground_truth_meta["roof_z"]) < 0.10


def test_08_extracted_building_height(las_file_path, ground_truth_meta, tmp_path):
    """Test 8: Extracted above-ground building height is close to 9.5 m."""
    output_json = str(tmp_path / "extracted_height.json")
    res = extract_building_from_lidar(las_path=las_file_path, output_json_path=output_json)

    height = res["vertical_extent"]["building_height_m"]
    assert abs(height - ground_truth_meta["building_height_above_ground_m"]) < 0.10


def test_09_vertical_evidence_and_json_schema(las_file_path, tmp_path):
    """Test 9: Output JSON contains required schema fields and candidate levels for Phase 2.3."""
    output_json = str(tmp_path / "extracted_schema.json")
    res = extract_building_from_lidar(las_path=las_file_path, output_json_path=output_json)

    assert os.path.exists(output_json)
    with open(output_json, "r", encoding="utf-8") as f:
        saved_data = json.load(f)

    assert saved_data["synthetic"] is True
    assert saved_data["crs"] == 32644
    assert saved_data["building_id"] == "TOWER-A"
    assert saved_data["parent_parcel_ulpin_2d"] == "27A8B9C3D4E5F6"
    assert "disclaimer" in saved_data

    # Check candidate levels
    candidate_levels = saved_data["vertical_evidence"]["candidate_levels"]
    assert len(candidate_levels) >= 4
    # Check that levels correspond to the 4 known floor slabs (approx 540.0, 543.5, 546.5, 549.5)
    expected_slabs = [540.0, 543.5, 546.5, 549.5]
    for slab_z in expected_slabs:
        assert any(abs(lvl - slab_z) <= 0.15 for lvl in candidate_levels), (
            f"Candidate level near {slab_z} m not detected in vertical evidence."
        )


def test_10_missing_file_raises_error(tmp_path):
    """Test 10: Robust error handling when input LAS file does not exist."""
    non_existent = str(tmp_path / "missing.las")
    with pytest.raises(FileNotFoundError):
        extract_building_from_lidar(las_path=non_existent)
