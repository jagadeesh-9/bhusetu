"""
Tests for Phase 2.1 Synthetic LiDAR Point Cloud Generator.
"""
import os
import json
import numpy as np
import laspy
from scripts.generate_synthetic_lidar import generate_synthetic_lidar


def test_01_generator_creates_valid_las_file(tmp_path):
    """Test that the generator creates a valid, readable ASPRS LAS 1.4 file."""
    las_path = str(tmp_path / "test_tower_a.las")
    meta_path = str(tmp_path / "test_meta.json")

    meta = generate_synthetic_lidar(
        output_las_path=las_path,
        output_meta_path=meta_path,
        seed=42
    )

    assert os.path.exists(las_path)
    assert os.path.getsize(las_path) > 0
    assert os.path.exists(meta_path)

    # Open LAS file with laspy
    with laspy.open(las_path) as reader:
        las = reader.read()
        assert len(las.points) > 0
        assert len(las.points) == meta["point_count"]

        # Check finite coordinates
        assert np.all(np.isfinite(las.x))
        assert np.all(np.isfinite(las.y))
        assert np.all(np.isfinite(las.z))

        # Check classes
        unique_classes = set(np.unique(las.classification))
        assert 2 in unique_classes, "Class 2 (Ground) missing from synthetic point cloud."
        assert 6 in unique_classes, "Class 6 (Building) missing from synthetic point cloud."


def test_02_elevation_and_spatial_bounds_conformity(tmp_path):
    """Test that generated point coordinates conform to synthetic building TOWER-A dimensions."""
    las_path = str(tmp_path / "test_bounds.las")
    meta_path = str(tmp_path / "test_bounds.json")

    meta = generate_synthetic_lidar(
        output_las_path=las_path,
        output_meta_path=meta_path,
        seed=42
    )

    las = laspy.read(las_path)

    # Check Z range covers ground to roof
    assert np.min(las.z) < 540.1
    assert np.max(las.z) > 549.4

    # Building points (Class 6) must fall within building footprint bounds + noise
    bldg_pts = las.points[las.classification == 6]
    assert len(bldg_pts) > 0
    assert np.min(bldg_pts.x) >= 219404.8
    assert np.max(bldg_pts.x) <= 219425.2
    assert np.min(bldg_pts.y) >= 1932502.3
    assert np.max(bldg_pts.y) <= 1932517.7


def test_03_ground_truth_metadata_consistency():
    """Test that ground truth metadata records exact known floor elevations."""
    meta_path = "data/simulated/prototype_lidar_ground_truth.json"
    assert os.path.exists(meta_path), "Ground truth metadata file not found."

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    assert meta["synthetic"] is True
    assert meta["crs"] == 32644
    assert meta["building_id"] == "TOWER-A"
    assert meta["parcel_ulpin_2d"] == "27A8B9C3D4E5F6"
    assert meta["ground_z"] == 540.00
    assert meta["roof_z"] == 549.50
    assert meta["expected_floor_count"] == 3
    assert meta["floor_boundaries"] == [540.00, 543.50, 546.50, 549.50]
    assert len(meta["floor_intervals"]) == 3


def test_04_generator_reproducibility(tmp_path):
    """Test that running the generator twice with the same seed produces identical arrays."""
    las1_path = str(tmp_path / "run1.las")
    las2_path = str(tmp_path / "run2.las")
    meta1_path = str(tmp_path / "run1.json")
    meta2_path = str(tmp_path / "run2.json")

    generate_synthetic_lidar(output_las_path=las1_path, output_meta_path=meta1_path, seed=12345)
    generate_synthetic_lidar(output_las_path=las2_path, output_meta_path=meta2_path, seed=12345)

    las1 = laspy.read(las1_path)
    las2 = laspy.read(las2_path)

    assert np.array_equal(las1.x, las2.x)
    assert np.array_equal(las1.y, las2.y)
    assert np.array_equal(las1.z, las2.z)
    assert np.array_equal(las1.classification, las2.classification)
