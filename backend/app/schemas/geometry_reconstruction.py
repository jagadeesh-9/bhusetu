"""
Pydantic schemas for Phase 3.4 Real-World 3D Geometry Processing & Reconstruction.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class LevelFootprintSpec(BaseModel):
    floor_code: str = Field(..., description="Floor identifier, e.g. 'F00', 'F01', 'F02', 'B01'")
    tier_code: str = Field(default="F", description="Vertical tier code (F, SB, UT, AE, AR, CM)")
    z_min: float = Field(..., description="Bottom elevation boundary in meters")
    z_max: float = Field(..., description="Top elevation boundary in meters")
    footprint_coords: List[List[float]] = Field(..., description="Closed 2D polygon ring [[x0, y0], [x1, y1], ..., [x0, y0]] in EPSG:32644")
    unit_label: Optional[str] = Field(default=None, description="Descriptive label for level")
    unit_type: str = Field(default="RESIDENTIAL", description="Unit property category")

    @field_validator("z_max")
    @classmethod
    def validate_z_range(cls, v: float, info) -> float:
        z_min = info.data.get("z_min")
        if z_min is not None and v <= z_min:
            raise ValueError(f"Inverted vertical elevation range: z_max ({v}) must exceed z_min ({z_min}).")
        return v


class PointcloudExtractionRequest(BaseModel):
    las_file_path: Optional[str] = Field(default=None, description="Path or URI to source LAS/LAZ file")
    source_crs: Optional[int] = Field(default=32644, description="Coordinate Reference System EPSG code (Required)")
    target_crs: int = Field(default=32644, description="Target analytical CRS (EPSG:32644)")
    footprint_method: str = Field(default="CONCAVE_HULL", description="Footprint extraction method: 'CONCAVE_HULL', 'CONVEX_HULL', 'BOUNDING_BOX'")
    concave_ratio: float = Field(default=0.4, ge=0.0, le=1.0, description="Concave hull tightness ratio (0.0 to 1.0)")
    bin_width_m: float = Field(default=0.10, ge=0.05, le=1.0, description="Vertical density histogram bin width in meters")
    filter_noise_outliers: bool = Field(default=True, description="Enable statistical outlier rejection on elevation and spatial bounds")

    model_config = ConfigDict(extra="ignore")


class PointcloudExtractionResponse(BaseModel):
    status: str = Field(..., description="Extraction result status: SUCCESS, RECOGNIZED_DEFERRED, REJECTED")
    source_crs: Optional[int]
    target_crs: int
    total_points: int
    ground_points: int
    building_points: int
    ground_elevation_m: float
    roof_elevation_m: float
    above_ground_height_m: float
    footprint_wkt: str
    footprint_area_sqm: float
    is_irregular_footprint: bool
    detected_storeys: int
    storey_intervals: List[Dict[str, Any]]
    quality_flags: List[str]
    message: str


class MultiLevelReconstructionRequest(BaseModel):
    parcel_ulpin_2d: str = Field(..., description="Parent 2D Parcel ULPIN")
    building_code: str = Field(default="TOWER-A", description="Building code on parcel")
    dataset_name: str = Field(default="LIDAR_RECONSTRUCTION_P34", description="Source evidence dataset label")
    levels: List[LevelFootprintSpec] = Field(..., description="List of per-level footprint and elevation specifications")
    integrate_candidates: bool = Field(default=False, description="Whether to route generated units into CandidateIntegrationService")

    model_config = ConfigDict(extra="ignore")


class ReconstructedUnitItem(BaseModel):
    floor_code: str
    tier_code: str
    z_min: float
    z_max: float
    volume_cbm: float
    footprint_area_sqm: float
    geom_wkt: str
    is_solid_2manifold: bool
    is_watertight: bool
    is_within_parcel: bool
    quality_flags: List[str]


class MultiLevelReconstructionResponse(BaseModel):
    status: str
    parcel_ulpin_2d: str
    building_code: str
    total_levels_reconstructed: int
    total_volume_cbm: float
    reconstructed_units: List[ReconstructedUnitItem]
    candidates_integrated: int
    candidate_unit_ids: List[str]
    quality_flags: List[str]
    message: str
