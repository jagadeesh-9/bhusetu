"""
Tests for Phase 2.3: Deterministic Vertical Storey Segmentation Engine.
"""
import os
import json
import pytest
import numpy as np
import laspy
from scripts.segment_vertical_storeys import segment_vertical_storeys


@pytest.fixture
def extraction_evidence_path():
    path = "data/processed/tower_a_building_extraction.json"
    assert os.path.exists(path), f"Phase 2.2 extraction evidence not found at {path}"
    return path


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


def test_01_phase_2_2_extraction_evidence_loads(extraction_evidence_path):
    """Test 1: Phase 2.2 extraction evidence loads successfully and has valid vertical extent."""
    with open(extraction_evidence_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert data["building_id"] == "TOWER-A"
    assert "vertical_extent" in data
    assert data["vertical_extent"]["ground_z_m"] == 540.0
    assert data["vertical_extent"]["roof_z_m"] > 549.4


def test_02_las_building_points_loaded(las_file_path):
    """Test 2: LAS building class points can be loaded and contain valid Z coordinates."""
    las = laspy.read(las_file_path)
    bldg_pts = las.points[las.classification == 6]
    assert len(bldg_pts) > 0
    assert np.all(np.isfinite(bldg_pts.z))


def test_03_segmentation_generates_valid_output(extraction_evidence_path, las_file_path, tmp_path):
    """Test 3: Storey segmentation generates valid JSON result with required schema keys."""
    out_json = str(tmp_path / "segmented_tower_a.json")
    res = segment_vertical_storeys(
        extraction_json_path=extraction_evidence_path,
        las_path=las_file_path,
        output_json_path=out_json
    )

    assert os.path.exists(out_json)
    assert res["synthetic"] is True
    assert res["prototype_only"] is True
    assert res["building_id"] == "TOWER-A"
    assert res["parent_parcel_ulpin_2d"] == "27A8B9C3D4E5F6"
    assert "disclaimer" in res
    assert "detected_levels" in res
    assert "vertical_intervals" in res
    assert "quality_flags" in res


def test_04_candidate_structural_levels_detected_and_sorted(extraction_evidence_path, las_file_path, tmp_path):
    """Test 4: Candidate structural levels are detected and strictly sorted."""
    out_json = str(tmp_path / "test_levels.json")
    res = segment_vertical_storeys(
        extraction_json_path=extraction_evidence_path,
        las_path=las_file_path,
        output_json_path=out_json
    )

    levels = res["detected_levels"]
    assert len(levels) >= 4, "Must detect at least 4 structural slab/roof levels."

    elevations = [lvl["elevation_m"] for lvl in levels]
    # Check strictly increasing order
    for i in range(len(elevations) - 1):
        assert elevations[i] < elevations[i + 1], f"Elevations not strictly increasing at index {i}"


def test_05_ground_level_detected_near_540m(extraction_evidence_path, las_file_path, ground_truth_meta, tmp_path):
    """Test 5: Lowest detected structural level is close to 540.0 m MSL."""
    out_json = str(tmp_path / "test_ground.json")
    res = segment_vertical_storeys(
        extraction_json_path=extraction_evidence_path,
        las_path=las_file_path,
        output_json_path=out_json
    )

    lowest_level = res["detected_levels"][0]["elevation_m"]
    gt_ground = ground_truth_meta["ground_z"]
    assert abs(lowest_level - gt_ground) <= 0.15, f"Ground level {lowest_level} deviates from {gt_ground}"


def test_06_intermediate_levels_detected(extraction_evidence_path, las_file_path, ground_truth_meta, tmp_path):
    """Test 6: Intermediate structural floor slab levels detected near 543.5 m and 546.5 m MSL."""
    out_json = str(tmp_path / "test_inter.json")
    res = segment_vertical_storeys(
        extraction_json_path=extraction_evidence_path,
        las_path=las_file_path,
        output_json_path=out_json
    )

    elevations = [lvl["elevation_m"] for lvl in res["detected_levels"]]
    # Ground truth floor boundaries: 540.0, 543.5, 546.5, 549.5
    assert any(abs(e - 543.50) <= 0.15 for e in elevations), "F00/F01 slab level near 543.5 m missing."
    assert any(abs(e - 546.50) <= 0.15 for e in elevations), "F01/F02 slab level near 546.5 m missing."


def test_07_roof_level_detected_near_549_5m(extraction_evidence_path, las_file_path, ground_truth_meta, tmp_path):
    """Test 7: Highest detected structural level is close to 549.5 m MSL."""
    out_json = str(tmp_path / "test_roof.json")
    res = segment_vertical_storeys(
        extraction_json_path=extraction_evidence_path,
        las_path=las_file_path,
        output_json_path=out_json
    )

    highest_level = res["detected_levels"][-1]["elevation_m"]
    gt_roof = ground_truth_meta["roof_z"]
    assert abs(highest_level - gt_roof) <= 0.15, f"Roof level {highest_level} deviates from {gt_roof}"


def test_08_vertical_interval_count_and_sequence(extraction_evidence_path, las_file_path, tmp_path):
    """Test 8: 4 detected boundaries produce exactly 3 vertical intervals (F00, F01, F02)."""
    out_json = str(tmp_path / "test_intervals.json")
    res = segment_vertical_storeys(
        extraction_json_path=extraction_evidence_path,
        las_path=las_file_path,
        output_json_path=out_json
    )

    intervals = res["vertical_intervals"]
    assert len(intervals) == 3
    assert intervals[0]["floor_code"] == "F00"
    assert intervals[1]["floor_code"] == "F01"
    assert intervals[2]["floor_code"] == "F02"
    assert [inv["sequence"] for inv in intervals] == [1, 2, 3]


def test_09_interval_positive_heights_and_topological_continuity(extraction_evidence_path, las_file_path, tmp_path):
    """Test 9: Every interval has strictly positive height and adjacent intervals share boundaries."""
    out_json = str(tmp_path / "test_continuity.json")
    res = segment_vertical_storeys(
        extraction_json_path=extraction_evidence_path,
        las_path=las_file_path,
        output_json_path=out_json
    )

    intervals = res["vertical_intervals"]
    for inv in intervals:
        assert inv["height_m"] > 0
        assert inv["z_max"] > inv["z_min"]
        assert round(inv["z_max"] - inv["z_min"], 2) == inv["height_m"]

    # Shared boundary check
    assert intervals[0]["z_max"] == intervals[1]["z_min"]
    assert intervals[1]["z_max"] == intervals[2]["z_min"]


def test_10_measured_interval_heights_conformity(extraction_evidence_path, las_file_path, ground_truth_meta, tmp_path):
    """Test 10: Measured interval heights match synthetic building architectural floors (approx 3.5m, 3.0m, 3.0m)."""
    out_json = str(tmp_path / "test_heights.json")
    res = segment_vertical_storeys(
        extraction_json_path=extraction_evidence_path,
        las_path=las_file_path,
        output_json_path=out_json
    )

    intervals = res["vertical_intervals"]
    # F00: 540.05 to 543.45 (Height ~ 3.40m, GT nominal 3.50m)
    assert abs(intervals[0]["height_m"] - 3.50) <= 0.20
    # F01: 543.45 to 546.45 (Height ~ 3.00m, GT nominal 3.00m)
    assert abs(intervals[1]["height_m"] - 3.00) <= 0.20
    # F02: 546.45 to 549.45 (Height ~ 3.00m, GT nominal 3.00m)
    assert abs(intervals[2]["height_m"] - 3.00) <= 0.20


def test_11_quality_flags_present_and_valid(extraction_evidence_path, las_file_path, tmp_path):
    """Test 11: Expected deterministic quality flags are generated."""
    out_json = str(tmp_path / "test_flags.json")
    res = segment_vertical_storeys(
        extraction_json_path=extraction_evidence_path,
        las_path=las_file_path,
        output_json_path=out_json
    )

    flags = set(res["quality_flags"])
    assert "VALID_ORDERING" in flags
    assert "POSITIVE_INTERVAL_HEIGHTS" in flags
    assert "TOPOLOGICALLY_CONTINUOUS" in flags
    assert "GROUND_ALIGNED" in flags
    assert "ROOF_ALIGNED" in flags
    assert "LEVEL_COUNT_SUPPORTED" in flags


def test_12_error_on_missing_input_files(tmp_path):
    """Test 12: Proper error handling for missing input files."""
    missing_evidence = str(tmp_path / "missing_evidence.json")
    missing_las = str(tmp_path / "missing.las")

    with pytest.raises(FileNotFoundError):
        segment_vertical_storeys(extraction_json_path=missing_evidence, las_path=missing_las)
