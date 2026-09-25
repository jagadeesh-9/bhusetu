"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 2.2: Deterministic Synthetic LiDAR Building Extraction Engine

Consumes an ASPRS LAS point cloud (e.g. data/simulated/prototype_tower_a.las),
separates ground and building returns, and extracts:
- Horizontal 2D building footprint candidate (in EPSG:32644)
- Vertical extent (ground Z, roof Z, above-ground height)
- Vertical structural density evidence (candidate slab levels for Phase 2.3)

DISCLAIMER:
Research Prototype only. Does not generate official Government of India
cadastral records or legal boundaries.
"""
import os
import json
import argparse
import numpy as np
import laspy


def extract_building_from_lidar(
    las_path: str = "data/simulated/prototype_tower_a.las",
    output_json_path: str = "data/processed/tower_a_building_extraction.json",
    building_id: str = "TOWER-A",
    parent_parcel_ulpin: str = "27A8B9C3D4E5F6"
) -> dict:
    """
    Deterministically processes a LAS point cloud to extract above-ground building footprint,
    elevation bounds, and structural vertical density profile.
    """
    if not os.path.exists(las_path):
        raise FileNotFoundError(f"Input LAS file not found at: {las_path}")

    # 1. Load LAS Point Cloud using laspy
    with laspy.open(las_path) as reader:
        las = reader.read()

    total_points = len(las.points)
    if total_points == 0:
        raise ValueError(f"Input LAS file is empty: {las_path}")

    # Extract coordinates and classifications
    x_coords = np.array(las.x, dtype=np.float64)
    y_coords = np.array(las.y, dtype=np.float64)
    z_coords = np.array(las.z, dtype=np.float64)
    classes = np.array(las.classification, dtype=np.uint8)

    # 2. Classification Filtering (ASPRS Standard: Class 2 = Ground, Class 6 = Building)
    ground_mask = (classes == 2)
    bldg_mask = (classes == 6)

    num_ground = int(np.sum(ground_mask))
    num_bldg = int(np.sum(bldg_mask))
    num_other = int(total_points - num_ground - num_bldg)

    if num_ground == 0:
        raise ValueError("No Class 2 (Ground) points found in point cloud.")
    if num_bldg == 0:
        raise ValueError("No Class 6 (Building) points found in point cloud.")

    # 3. Ground Elevation Estimation from Ground Returns (Class 2)
    ground_z_vals = z_coords[ground_mask]
    ground_z_median = float(np.median(ground_z_vals))
    ground_z_min = float(np.min(ground_z_vals))
    ground_z_max = float(np.max(ground_z_vals))

    # 4. Building Candidate Spatial Extraction from Building Returns (Class 6)
    bldg_x = x_coords[bldg_mask]
    bldg_y = y_coords[bldg_mask]
    bldg_z = z_coords[bldg_mask]

    min_x = float(np.min(bldg_x))
    max_x = float(np.max(bldg_x))
    min_y = float(np.min(bldg_y))
    max_y = float(np.max(bldg_y))
    roof_z = float(np.max(bldg_z))
    bldg_z_min = float(np.min(bldg_z))

    width_x = max_x - min_x
    length_y = max_y - min_y
    footprint_area = width_x * length_y
    above_ground_height = roof_z - ground_z_median

    # 2D Bounding Polygon Coordinates in EPSG:32644 (Closed ring)
    footprint_polygon = [
        [round(min_x, 3), round(min_y, 3)],
        [round(max_x, 3), round(min_y, 3)],
        [round(max_x, 3), round(max_y, 3)],
        [round(min_x, 3), round(max_y, 3)],
        [round(min_x, 3), round(min_y, 3)]
    ]

    # 5. Vertical Point Density Profiling (Candidate Structural Slab Elevations for Phase 2.3)
    bin_width = 0.10  # 10 cm vertical binning
    hist_z_min = np.floor(ground_z_median * 10) / 10.0 - 0.2
    hist_z_max = np.ceil(roof_z * 10) / 10.0 + 0.2
    bins = np.arange(hist_z_min, hist_z_max + bin_width, bin_width)

    counts, bin_edges = np.histogram(bldg_z, bins=bins)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2.0

    # Identify prominent vertical density peaks (where horizontal floor slabs/roof concentrate points)
    # Floor slabs produce point counts > 2.5x the mean vertical bin density
    prominent_threshold = float(np.mean(counts) * 2.5)
    slab_peak_indices = []
    for i in range(1, len(counts) - 1):
        if counts[i] >= prominent_threshold and counts[i] >= counts[i - 1] and counts[i] >= counts[i + 1]:
            slab_peak_indices.append(i)

    candidate_levels = [round(float(bin_centers[idx]), 2) for idx in slab_peak_indices]
    density_peaks = [
        {
            "elevation_m": round(float(bin_centers[idx]), 2),
            "point_density_count": int(counts[idx])
        }
        for idx in slab_peak_indices
    ]

    # 6. Structured Machine-Readable Extraction Result
    result = {
        "synthetic": True,
        "source_dataset": os.path.basename(las_path),
        "dataset_type": "ASPRS_LAS_1.4",
        "building_id": building_id,
        "parent_parcel_ulpin_2d": parent_parcel_ulpin,
        "crs": 32644,
        "disclaimer": (
            "Research prototype synthetic LiDAR building extraction evidence. "
            "Not an official cadastral boundary or government record."
        ),
        "point_counts": {
            "total": total_points,
            "ground_class_2": num_ground,
            "building_class_6": num_bldg,
            "other_class": num_other
        },
        "building_candidate": {
            "geometry_type": "Polygon",
            "coordinates_epsg32644": footprint_polygon,
            "bounds": {
                "min_x": round(min_x, 3),
                "max_x": round(max_x, 3),
                "min_y": round(min_y, 3),
                "max_y": round(max_y, 3)
            },
            "dimensions_m": {
                "width_x": round(width_x, 3),
                "length_y": round(length_y, 3),
                "estimated_footprint_area_sqm": round(footprint_area, 2)
            }
        },
        "vertical_extent": {
            "ground_z_m": round(ground_z_median, 3),
            "roof_z_m": round(roof_z, 3),
            "building_height_m": round(above_ground_height, 3),
            "ground_sample_stats": {
                "min_z": round(ground_z_min, 3),
                "max_z": round(ground_z_max, 3),
                "median_z": round(ground_z_median, 3)
            }
        },
        "vertical_evidence": {
            "bin_width_m": bin_width,
            "candidate_levels": candidate_levels,
            "density_peaks": density_peaks
        }
    }

    # 7. Persist Result to JSON if requested
    if output_json_path:
        os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)

    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Extract building footprint and vertical extent from LAS point cloud.")
    parser.add_argument("--las", default="data/simulated/prototype_tower_a.las", help="Path to input LAS file")
    parser.add_argument("--output", default="data/processed/tower_a_building_extraction.json", help="Path to output JSON")
    args = parser.parse_args()

    res = extract_building_from_lidar(las_path=args.las, output_json_path=args.output)
    print("==========================================================")
    print("Point Cloud Building Extraction Complete")
    print("==========================================================")
    print(f"Source: {res['source_dataset']}")
    print(f"Points Processed: Total={res['point_counts']['total']}, Ground={res['point_counts']['ground_class_2']}, Building={res['point_counts']['building_class_6']}")
    print(f"Derived Footprint Bounds: X=[{res['building_candidate']['bounds']['min_x']}, {res['building_candidate']['bounds']['max_x']}], Y=[{res['building_candidate']['bounds']['min_y']}, {res['building_candidate']['bounds']['max_y']}]")
    print(f"Derived Area: {res['building_candidate']['dimensions_m']['estimated_footprint_area_sqm']} m^2")
    print(f"Derived Vertical Extent: Ground={res['vertical_extent']['ground_z_m']} m, Roof={res['vertical_extent']['roof_z_m']} m, Height={res['vertical_extent']['building_height_m']} m")
    print(f"Candidate Structural Levels: {res['vertical_evidence']['candidate_levels']}")
    print(f"Output saved to: {args.output}")
