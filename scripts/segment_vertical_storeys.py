"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 2.3: Deterministic Vertical Storey Segmentation Engine

Consumes Phase 2.2 building extraction evidence and point-cloud vertical observations
to segment above-ground structural levels into vertical intervals (F00, F01, F02, etc.).

DISCLAIMER:
Research Prototype only. Does not generate official Government of India
cadastral identifiers, property divisions, or legal title records.
"""
import os
import json
import argparse
import numpy as np
import laspy


def segment_vertical_storeys(
    extraction_json_path: str = "data/processed/tower_a_building_extraction.json",
    las_path: str = "data/simulated/prototype_tower_a.las",
    output_json_path: str = "data/processed/tower_a_vertical_segmentation.json",
    bin_width_m: float = 0.10
) -> dict:
    """
    Deterministically segments building vertical observations into floor intervals.
    """
    if not os.path.exists(extraction_json_path):
        raise FileNotFoundError(f"Phase 2.2 extraction evidence not found at: {extraction_json_path}")
    if not os.path.exists(las_path):
        raise FileNotFoundError(f"Input LAS point cloud not found at: {las_path}")

    # 1. Load Phase 2.2 Building Evidence
    with open(extraction_json_path, "r", encoding="utf-8") as f:
        p22_data = json.load(f)

    building_id = p22_data.get("building_id", "TOWER-A")
    parent_parcel_ulpin = p22_data.get("parent_parcel_ulpin_2d", "27A8B9C3D4E5F6")
    crs = p22_data.get("crs", 32644)
    derived_ground_z = float(p22_data["vertical_extent"]["ground_z_m"])
    derived_roof_z = float(p22_data["vertical_extent"]["roof_z_m"])
    derived_height_m = float(p22_data["vertical_extent"]["building_height_m"])

    # 2. Load LAS Points and Filter to Building Class (Class 6)
    with laspy.open(las_path) as reader:
        las = reader.read()

    classes = np.array(las.classification, dtype=np.uint8)
    z_coords = np.array(las.z, dtype=np.float64)

    bldg_mask = (classes == 6)
    bldg_z = z_coords[bldg_mask]

    if len(bldg_z) == 0:
        raise ValueError("No Class 6 (Building) points found in point cloud.")

    # 3. Build Z-Density Histogram
    hist_min = np.floor(derived_ground_z * 10) / 10.0 - 0.2
    hist_max = np.ceil(derived_roof_z * 10) / 10.0 + 0.2
    bins = np.arange(hist_min, hist_max + bin_width_m, bin_width_m)

    counts, bin_edges = np.histogram(bldg_z, bins=bins)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2.0

    # 4. Deterministic Smoothing (3-bin Moving Average)
    smoothed_counts = np.copy(counts).astype(np.float64)
    for i in range(1, len(counts) - 1):
        smoothed_counts[i] = (counts[i - 1] + 2 * counts[i] + counts[i + 1]) / 4.0

    # 5. Detect Candidate Structural Levels (Floor Slabs / Roof)
    # Floor slabs produce point density peaks > 2.0x mean bin density
    threshold = float(np.mean(smoothed_counts) * 2.0)
    peak_indices = []
    for i in range(1, len(smoothed_counts) - 1):
        if (
            smoothed_counts[i] >= threshold
            and smoothed_counts[i] >= smoothed_counts[i - 1]
            and smoothed_counts[i] >= smoothed_counts[i + 1]
        ):
            peak_indices.append(i)

    # 6. Sort and Structure Detected Levels
    detected_levels = []
    level_elevations = []
    for idx in peak_indices:
        elev = round(float(bin_centers[idx]), 2)
        strength = int(counts[idx])
        level_elevations.append(elev)
        detected_levels.append({
            "elevation_m": elev,
            "source": "LAS_BUILDING_POINTS",
            "detection_method": "Z_DENSITY_PEAK",
            "raw_density_count": strength,
            "smoothed_density_strength": round(float(smoothed_counts[idx]), 1)
        })

    # Sort strictly by elevation
    level_elevations.sort()
    detected_levels.sort(key=lambda x: x["elevation_m"])

    # 7. Construct Vertical Intervals
    vertical_intervals = []
    quality_flags = []

    num_boundaries = len(level_elevations)
    if num_boundaries < 2:
        quality_flags.append("INSUFFICIENT_STRUCTURAL_LEVELS")
        num_intervals = 0
    else:
        num_intervals = num_boundaries - 1
        for i in range(num_intervals):
            z_start = level_elevations[i]
            z_end = level_elevations[i + 1]
            interval_height = round(z_end - z_start, 2)
            floor_code = f"F{i:02d}"

            # Interval metadata
            interval_obj = {
                "sequence": i + 1,
                "floor_code": floor_code,
                "tier_code": "ABOVE_GROUND",
                "z_min": z_start,
                "z_max": z_end,
                "height_m": interval_height,
                "boundary_lower_method": "Z_DENSITY_PEAK",
                "boundary_upper_method": "Z_DENSITY_PEAK"
            }
            vertical_intervals.append(interval_obj)

    # 8. Evaluate Quality Flags
    # Ordering and Positivity
    is_strictly_ordered = all(level_elevations[i] < level_elevations[i + 1] for i in range(len(level_elevations) - 1))
    if is_strictly_ordered:
        quality_flags.append("VALID_ORDERING")
    else:
        quality_flags.append("INVALID_ORDERING")

    all_positive_heights = all(inv["height_m"] > 0 for inv in vertical_intervals)
    if all_positive_heights and len(vertical_intervals) > 0:
        quality_flags.append("POSITIVE_INTERVAL_HEIGHTS")

    # Shared Boundary Continuity
    topologically_continuous = True
    for i in range(len(vertical_intervals) - 1):
        if vertical_intervals[i]["z_max"] != vertical_intervals[i + 1]["z_min"]:
            topologically_continuous = False
            break
    if topologically_continuous and len(vertical_intervals) > 0:
        quality_flags.append("TOPOLOGICALLY_CONTINUOUS")

    # Alignment with Derived Ground and Roof
    if len(level_elevations) >= 2:
        if abs(level_elevations[0] - derived_ground_z) <= 0.15:
            quality_flags.append("GROUND_ALIGNED")
        else:
            quality_flags.append("GROUND_MISALIGNED")

        if abs(level_elevations[-1] - derived_roof_z) <= 0.15:
            quality_flags.append("ROOF_ALIGNED")
        else:
            quality_flags.append("ROOF_MISALIGNED")

    if len(vertical_intervals) == 3:
        quality_flags.append("LEVEL_COUNT_SUPPORTED")

    # 9. Structure Result Output
    result = {
        "synthetic": True,
        "prototype_only": True,
        "source_extraction_evidence": os.path.basename(extraction_json_path),
        "source_las_dataset": os.path.basename(las_path),
        "building_id": building_id,
        "parent_parcel_ulpin_2d": parent_parcel_ulpin,
        "crs": crs,
        "disclaimer": (
            "Research prototype vertical storey segmentation evidence. "
            "Not an official cadastral property division or government title record."
        ),
        "derived_ground_z": round(derived_ground_z, 3),
        "derived_roof_z": round(derived_roof_z, 3),
        "derived_height_m": round(derived_height_m, 3),
        "detected_level_count": num_boundaries,
        "vertical_interval_count": num_intervals,
        "bin_width_m": bin_width_m,
        "detected_levels": detected_levels,
        "vertical_intervals": vertical_intervals,
        "quality_flags": quality_flags
    }

    # 10. Persist Output JSON if specified
    if output_json_path:
        os.makedirs(os.path.dirname(output_json_path), exist_ok=True)
        with open(output_json_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)

    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Segment building LiDAR vertical observations into storey intervals.")
    parser.add_argument("--extraction", default="data/processed/tower_a_building_extraction.json", help="Path to Phase 2.2 extraction JSON")
    parser.add_argument("--las", default="data/simulated/prototype_tower_a.las", help="Path to input LAS file")
    parser.add_argument("--output", default="data/processed/tower_a_vertical_segmentation.json", help="Path to output segmentation JSON")
    args = parser.parse_args()

    res = segment_vertical_storeys(
        extraction_json_path=args.extraction,
        las_path=args.las,
        output_json_path=args.output
    )

    print("==========================================================")
    print("Vertical Storey Segmentation Complete")
    print("==========================================================")
    print(f"Building: {res['building_id']} on Parcel: {res['parent_parcel_ulpin_2d']}")
    print(f"Detected Structural Boundaries: {res['detected_level_count']}")
    for lvl in res["detected_levels"]:
        print(f"  Level Z = {lvl['elevation_m']:.2f} m (Density: {lvl['raw_density_count']} pts)")
    print(f"Generated Vertical Intervals: {res['vertical_interval_count']}")
    for inv in res["vertical_intervals"]:
        print(f"  {inv['floor_code']}: [{inv['z_min']:.2f} m -> {inv['z_max']:.2f} m], Height = {inv['height_m']:.2f} m")
    print(f"Quality Flags: {res['quality_flags']}")
    print(f"Output saved to: {args.output}")
