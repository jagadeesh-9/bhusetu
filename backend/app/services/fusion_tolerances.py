"""
Centralized comparison tolerances and capabilities matrix for Phase 3.5 Evidence Fusion.
All thresholds are documented with units, purpose, and rationale.
"""
from typing import Dict, Any

# ==============================================================================
# AUTHORITATIVE TOLERANCE CONSTANTS FOR PROTOTYPE EVIDENCE COMPARISON
# ==============================================================================

# 1. Height / Vertical Elevation Difference Tolerances (Meters)
# Purpose: Compare measured unit height (z_max - z_min) against source height or cross-source height measurements.
# Rationale: Standard TLS/ALS and architectural plans in urban cadastres typically align within 0.15m.
HEIGHT_AGREEMENT_TOLERANCE_M = 0.15  # Difference <= 0.15m -> AGREEMENT
HEIGHT_DISCREPANCY_TOLERANCE_M = 0.30  # 0.15m < Difference <= 0.30m -> MINOR_DISCREPANCY; > 0.30m -> CONFLICT

# 2. Elevation Z Bound Tolerance (Meters)
# Purpose: Check absolute Z elevation consistency between source metadata and geometry bounding box.
ELEVATION_Z_ALIGNMENT_TOLERANCE_M = 0.15

# 3. Footprint Area Ratio Tolerances (Unitless Ratio)
# Purpose: Compare horizontal 2D footprint area reported across different sources (e.g. BIM vs LiDAR footprint).
# Rationale: Ratio of 0.90 to 1.10 (+/-10%) indicates consistent horizontal boundary envelope.
FOOTPRINT_AREA_RATIO_AGREEMENT_MIN = 0.90
FOOTPRINT_AREA_RATIO_AGREEMENT_MAX = 1.10
FOOTPRINT_AREA_RATIO_CONFLICT_MIN = 0.80  # Ratio < 0.80 or > 1.20 -> FOOTPRINT_CONFLICT
FOOTPRINT_AREA_RATIO_CONFLICT_MAX = 1.20

# 4. Horizontal Coordinate Position Tolerance (Meters)
# Purpose: Verify centroid or boundary displacement between survey control and extracted geometry.
HORIZONTAL_POSITION_TOLERANCE_M = 0.20

# 5. Volumetric Overlap Threshold (Cubic Meters)
# Purpose: Distinguish zero-volume boundary slab contact from true volumetric collision.
VOLUMETRIC_OVERLAP_TOLERANCE_CBM = 0.001


# ==============================================================================
# SOURCE-SPECIFIC CAPABILITY MATRIX
# ==============================================================================
SOURCE_CAPABILITIES: Dict[str, Dict[str, Any]] = {
    "LIDAR_POINTCLOUD": {
        "sensor_category": "AIRBORNE_LIDAR_POINTCLOUD",
        "supports_geometry": True,
        "supports_height": True,
        "supports_vertical_extent": True,
        "supports_crs": True,
        "supports_underground": False,  # CRITICAL: Optical airborne LiDAR cannot penetrate underground
        "supports_provenance": True,
        "notes": "May support above-ground height and vertical stratification when point density and scene characteristics are adequate. Zero subterranean capability."
    },
    "BIM_IFC": {
        "sensor_category": "BUILDING_INFORMATION_MODEL",
        "supports_geometry": True,
        "supports_height": True,
        "supports_vertical_extent": True,
        "supports_crs": True,
        "supports_underground": True,  # Supported when structural subterranean levels are represented
        "supports_provenance": True,
        "notes": "May support designed building geometry, vertical units, and underground geometry when subterranean elements are explicitly represented in the model."
    },
    "CITYJSON_LOD2": {
        "sensor_category": "CITYJSON_LOD2_URBAN_MODEL",
        "supports_geometry": True,
        "supports_height": True,
        "supports_vertical_extent": True,
        "supports_crs": True,
        "supports_underground": False,
        "supports_provenance": True,
        "notes": "May support exterior building envelope and roof geometry when represented in LoD2 boundary features."
    },
    "DRONE_PHOTOGRAMMETRY": {
        "sensor_category": "DRONE_AERIAL_PHOTOGRAMMETRY",
        "supports_geometry": True,
        "supports_height": True,
        "supports_vertical_extent": True,
        "supports_crs": True,
        "supports_underground": False,
        "supports_provenance": True,
        "notes": "May support above-ground exterior geometry when scene coverage, overlap, and reconstruction quality are adequate."
    },
    "ARCHITECTURAL_PLAN_2D": {
        "sensor_category": "ARCHITECTURAL_DRAWING_2D",
        "supports_geometry": True,
        "supports_height": True,  # Supported when floor elevation schedules are represented
        "supports_vertical_extent": True,
        "supports_crs": True,
        "supports_underground": True,  # Supported when basement levels are represented
        "supports_provenance": True,
        "notes": "May support floor/layout evidence and basement boundaries when those levels are explicitly represented in the plan."
    },
    "CORS_GNSS_SURVEY": {
        "sensor_category": "HIGH_PRECISION_GNSS_SURVEY",
        "supports_geometry": True,
        "supports_height": True,
        "supports_vertical_extent": True,
        "supports_crs": True,
        "supports_underground": False,  # GNSS signals cannot reach subterranean basements directly
        "supports_provenance": True,
        "notes": "May support geodetic control and surface elevation points when survey benchmarks are documented."
    },
    "MANUAL_DIGITIZED": {
        "sensor_category": "MUNICIPAL_INFRASTRUCTURE_SURVEY",
        "supports_geometry": True,
        "supports_height": False,
        "supports_vertical_extent": False,
        "supports_crs": True,
        "supports_underground": True,  # Municipal utility records
        "supports_provenance": False,
        "notes": "May provide manually digitized geometry; reliability depends on provenance and independent corroboration."
    }
}

