"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 2.1: Deterministic Synthetic LiDAR Point Cloud Generator

Generates a reproducible ASPRS LAS point cloud representing synthetic structural building TOWER-A
on 2D base parcel 27A8B9C3D4E5F6 in EPSG:32644 with known floor slab boundaries.
"""
import os
import json
import numpy as np
import laspy


def generate_synthetic_lidar(
    output_las_path: str = "data/simulated/prototype_tower_a.las",
    output_meta_path: str = "data/simulated/prototype_lidar_ground_truth.json",
    seed: int = 42
) -> dict:
    """
    Generates a deterministic synthetic LiDAR point cloud for TOWER-A with:
    - Ground surface (Z = 540.0m MSL, Class 2)
    - Building facades, floor slabs, and roof (Z = 540.0m to 549.5m MSL, Class 6)
    - Synthetic Gaussian noise (sigma = 0.02m)
    - Companion ground truth metadata JSON
    """
    rng = np.random.default_rng(seed=seed)

    # 1. Spatial Geometry Constants (Derived from Phase 1.2 Synthetic Seed Dataset)
    # Base Parcel bounds: X: [219400, 219430], Y: [1932500, 1932520]
    # Building TOWER-A bounds: X: [219405, 219425], Y: [1932502.5, 1932517.5]
    bldg_min_x, bldg_max_x = 219405.0, 219425.0
    bldg_min_y, bldg_max_y = 1932502.5, 1932517.5
    ground_z = 540.00
    roof_z = 549.50
    floor_elevations = [540.00, 543.50, 546.50, 549.50]

    ground_min_x, ground_max_x = 219395.0, 219435.0
    ground_min_y, ground_max_y = 1932495.0, 1932525.0

    points_list = []
    classes_list = []
    intensity_list = []

    # 2. Generate Ground Surface Points (Class 2 = Ground)
    # Grid sampling with 1.0m spacing + random jitter
    gx = np.arange(ground_min_x, ground_max_x + 0.5, 0.8)
    gy = np.arange(ground_min_y, ground_max_y + 0.5, 0.8)
    gx_grid, gy_grid = np.meshgrid(gx, gy)
    gx_flat = gx_grid.flatten()
    gy_flat = gy_grid.flatten()
    gz_flat = np.full_like(gx_flat, ground_z)

    # Filter out footprint interior to simulate sensor occlusion/ground footprint
    outside_bldg = (
        (gx_flat < bldg_min_x) | (gx_flat > bldg_max_x) |
        (gy_flat < bldg_min_y) | (gy_flat > bldg_max_y)
    )
    gx_pts = gx_flat[outside_bldg]
    gy_pts = gy_flat[outside_bldg]
    gz_pts = gz_flat[outside_bldg]

    # Add minor terrain roughness noise
    gz_pts += rng.normal(0.0, 0.02, size=len(gz_pts))
    gx_pts += rng.normal(0.0, 0.02, size=len(gx_pts))
    gy_pts += rng.normal(0.0, 0.02, size=len(gy_pts))

    points_list.append(np.column_stack([gx_pts, gy_pts, gz_pts]))
    classes_list.append(np.full(len(gx_pts), 2, dtype=np.uint8))  # Class 2 = Ground
    intensity_list.append(rng.integers(50, 120, size=len(gx_pts), dtype=np.uint16))

    # 3. Generate Building Facades / Walls (Class 6 = Building)
    # 4 vertical walls sampled at 0.25m horizontal and 0.25m vertical intervals
    z_wall_steps = np.arange(ground_z, roof_z + 0.1, 0.25)
    
    # South & North Walls (Along X axis, Y fixed)
    x_wall_steps = np.arange(bldg_min_x, bldg_max_x + 0.1, 0.25)
    for y_coord in [bldg_min_y, bldg_max_y]:
        xw_mesh, zw_mesh = np.meshgrid(x_wall_steps, z_wall_steps)
        xw_flat = xw_mesh.flatten() + rng.normal(0.0, 0.015, size=xw_mesh.size)
        yw_flat = np.full(xw_mesh.size, y_coord) + rng.normal(0.0, 0.015, size=xw_mesh.size)
        zw_flat = zw_mesh.flatten() + rng.normal(0.0, 0.015, size=xw_mesh.size)
        points_list.append(np.column_stack([xw_flat, yw_flat, zw_flat]))
        classes_list.append(np.full(xw_mesh.size, 6, dtype=np.uint8))
        intensity_list.append(rng.integers(150, 220, size=xw_mesh.size, dtype=np.uint16))

    # West & East Walls (Along Y axis, X fixed)
    y_wall_steps = np.arange(bldg_min_y, bldg_max_y + 0.1, 0.25)
    for x_coord in [bldg_min_x, bldg_max_x]:
        yw_mesh, zw_mesh = np.meshgrid(y_wall_steps, z_wall_steps)
        yw_flat = yw_mesh.flatten() + rng.normal(0.0, 0.015, size=yw_mesh.size)
        xw_flat = np.full(yw_mesh.size, x_coord) + rng.normal(0.0, 0.015, size=yw_mesh.size)
        zw_flat = zw_mesh.flatten() + rng.normal(0.0, 0.015, size=yw_mesh.size)
        points_list.append(np.column_stack([xw_flat, yw_flat, zw_flat]))
        classes_list.append(np.full(yw_mesh.size, 6, dtype=np.uint8))
        intensity_list.append(rng.integers(150, 220, size=yw_mesh.size, dtype=np.uint16))

    # 4. Generate Floor Slabs (Class 6 = Building)
    # Discrete horizontal slabs at floor transition elevations
    xs = np.arange(bldg_min_x + 0.5, bldg_max_x - 0.4, 0.4)
    ys = np.arange(bldg_min_y + 0.5, bldg_max_y - 0.4, 0.4)
    xs_mesh, ys_mesh = np.meshgrid(xs, ys)

    for floor_z in floor_elevations:
        xs_flat = xs_mesh.flatten() + rng.normal(0.0, 0.015, size=xs_mesh.size)
        ys_flat = ys_mesh.flatten() + rng.normal(0.0, 0.015, size=ys_mesh.size)
        zs_flat = np.full(xs_mesh.size, floor_z) + rng.normal(0.0, 0.015, size=xs_mesh.size)
        points_list.append(np.column_stack([xs_flat, ys_flat, zs_flat]))
        classes_list.append(np.full(xs_mesh.size, 6, dtype=np.uint8))
        intensity_list.append(rng.integers(180, 250, size=xs_mesh.size, dtype=np.uint16))

    # 5. Concatenate all point arrays
    all_points = np.vstack(points_list)
    all_classes = np.concatenate(classes_list)
    all_intensities = np.concatenate(intensity_list)

    num_points = len(all_points)

    # 6. Build LAS File with laspy (LAS version 1.4, Point Format 1)
    os.makedirs(os.path.dirname(output_las_path), exist_ok=True)
    header = laspy.LasHeader(point_format=1, version="1.4")
    header.offsets = [219400.0, 1932500.0, 530.0]
    header.scales = [0.001, 0.001, 0.001]

    las = laspy.LasData(header)
    las.x = all_points[:, 0]
    las.y = all_points[:, 1]
    las.z = all_points[:, 2]
    las.classification = all_classes
    las.intensity = all_intensities

    las.write(output_las_path)

    # 7. Create Companion Ground Truth Metadata JSON
    ground_truth = {
        "dataset_name": os.path.basename(output_las_path),
        "synthetic": True,
        "crs": 32644,
        "random_seed": seed,
        "point_count": int(num_points),
        "building_id": "TOWER-A",
        "parcel_ulpin_2d": "27A8B9C3D4E5F6",
        "spatial_extent": {
            "min_x": float(np.min(all_points[:, 0])),
            "max_x": float(np.max(all_points[:, 0])),
            "min_y": float(np.min(all_points[:, 1])),
            "max_y": float(np.max(all_points[:, 1])),
            "min_z": float(np.min(all_points[:, 2])),
            "max_z": float(np.max(all_points[:, 2]))
        },
        "building_footprint_bounds": {
            "min_x": bldg_min_x,
            "max_x": bldg_max_x,
            "min_y": bldg_min_y,
            "max_y": bldg_max_y,
            "area_sqm": 300.00
        },
        "ground_z": ground_z,
        "roof_z": roof_z,
        "building_height_above_ground_m": round(roof_z - ground_z, 2),
        "expected_floor_count": 3,
        "floor_boundaries": floor_elevations,
        "floor_intervals": [
            {"floor_code": "F00", "z_min": 540.00, "z_max": 543.50, "delta_z": 3.50},
            {"floor_code": "F01", "z_min": 543.50, "z_max": 546.50, "delta_z": 3.00},
            {"floor_code": "F02", "z_min": 546.50, "z_max": 549.50, "delta_z": 3.00}
        ],
        "classifications": {
            "2_ground_count": int(np.sum(all_classes == 2)),
            "6_building_count": int(np.sum(all_classes == 6))
        },
        "synthetic_perturbation": {
            "type": "Gaussian",
            "sigma_m": 0.02
        }
    }

    with open(output_meta_path, "w", encoding="utf-8") as f:
        json.dump(ground_truth, f, indent=2)

    return ground_truth


if __name__ == "__main__":
    meta = generate_synthetic_lidar()
    print("==========================================================")
    print("Synthetic LiDAR Point Cloud Generation Complete")
    print("==========================================================")
    print(f"File: {meta['dataset_name']}")
    print(f"Points Generated: {meta['point_count']}")
    print(f"X Bounds: [{meta['spatial_extent']['min_x']:.2f}, {meta['spatial_extent']['max_x']:.2f}]")
    print(f"Y Bounds: [{meta['spatial_extent']['min_y']:.2f}, {meta['spatial_extent']['max_y']:.2f}]")
    print(f"Z Bounds: [{meta['spatial_extent']['min_z']:.2f}, {meta['spatial_extent']['max_z']:.2f}] MSL")
    print(f"Ground Points (Class 2): {meta['classifications']['2_ground_count']}")
    print(f"Building Points (Class 6): {meta['classifications']['6_building_count']}")
    print(f"Floor Boundaries: {meta['floor_boundaries']}")
