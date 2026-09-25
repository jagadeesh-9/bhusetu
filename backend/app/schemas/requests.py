"""
Pydantic v2 schemas for API mutation requests (unit generation and lifecycle transitions).
"""
import uuid
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


ALLOWED_TIER_CODES = {"SB", "UT", "F", "AE", "AR", "CM"}
ALLOWED_UNIT_TYPES = {
    "RESIDENTIAL",
    "COMMERCIAL",
    "PARKING",
    "UTILITY_CORRIDOR",
    "TRANSIT_CORRIDOR",
    "AIR_RIGHTS",
    "COMMON_CIRCULATION"
}
ALLOWED_TRANSITION_STATUSES = {"UNDER_REVIEW", "VERIFIED", "REJECTED"}
ALLOWED_ACTOR_ROLES = {"SYSTEM_VALIDATOR", "HUMAN_REVIEWER", "LICENSED_SURVEYOR", "REVENUE_OFFICIAL"}


class VerticalUnitCreateRequest(BaseModel):
    parcel_id: uuid.UUID = Field(..., description="UUID of the parent terrestrial parcel (2D cadastre)")
    building_id: Optional[uuid.UUID] = Field(default=None, description="Optional UUID of the structural building on the parcel")
    tier_code: str = Field(..., description="Vertical tier code: SB (Basement), UT (Utility), F (Floor), AE (Aerial), AR (Air Rights), CM (Common)")
    floor_code: str = Field(..., description="Floor or level identifier, e.g. 'F03', 'B01', 'UT01'")
    unit_label: str = Field(..., description="Descriptive label for the unit, e.g. 'Flat 301 (Synthetic)'")
    unit_type: str = Field(default="RESIDENTIAL", description="Spatial unit classification")
    z_min: float = Field(..., description="Lower vertical elevation boundary in meters MSL (EPSG:32644)")
    z_max: float = Field(..., description="Upper vertical elevation boundary in meters MSL (EPSG:32644)")
    geom_wkt: str = Field(..., description="3D PolyhedralSurface geometry in WKT/EWKT format (EPSG:32644)")

    model_config = ConfigDict(extra="ignore")

    @field_validator("tier_code")
    @classmethod
    def validate_tier_code(cls, v: str) -> str:
        code = v.strip().upper()
        if code not in ALLOWED_TIER_CODES:
            raise ValueError(f"Unsupported tier_code '{v}'. Must be one of {sorted(list(ALLOWED_TIER_CODES))}.")
        return code

    @field_validator("unit_type")
    @classmethod
    def validate_unit_type(cls, v: str) -> str:
        ut = v.strip().upper()
        if ut not in ALLOWED_UNIT_TYPES:
            raise ValueError(f"Unsupported unit_type '{v}'. Must be one of {sorted(list(ALLOWED_UNIT_TYPES))}.")
        return ut

    @field_validator("z_max")
    @classmethod
    def validate_z_order(cls, v: float, info) -> float:
        z_min = info.data.get("z_min")
        if z_min is not None and v <= z_min:
            raise ValueError(f"Inverted Z range error: z_max ({v}) must be strictly greater than z_min ({z_min}).")
        return v


ALLOWED_REJECTION_REASONS = {
    "GEOMETRY_INVALID",
    "SPATIAL_CONFLICT",
    "INSUFFICIENT_EVIDENCE",
    "INCORRECT_VERTICAL_BOUNDARY",
    "INCORRECT_UNIT_TYPE",
    "OTHER"
}


class VerticalUnitTransitionRequest(BaseModel):
    new_status: str = Field(..., description="Target lifecycle status: 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'")
    actor_role: str = Field(..., description="Role executing the transition: 'SYSTEM_VALIDATOR', 'HUMAN_REVIEWER', 'LICENSED_SURVEYOR', 'REVENUE_OFFICIAL'")
    reviewer_name: Optional[str] = Field(default="Prototype Reviewer", description="Name of the actor or simulated official")
    action: Optional[str] = Field(default=None, description="Audit action category (auto-assigned if omitted)")
    rejection_reason_code: Optional[str] = Field(default=None, description="Structured rejection reason code: GEOMETRY_INVALID, SPATIAL_CONFLICT, INSUFFICIENT_EVIDENCE, INCORRECT_VERTICAL_BOUNDARY, INCORRECT_UNIT_TYPE, OTHER")
    review_notes: Optional[str] = Field(default=None, description="Optional review observations or reasons")
    integrity_hash: Optional[str] = Field(default=None, description="Optional cryptographic verification or simulated audit hash")

    model_config = ConfigDict(extra="ignore")

    @field_validator("new_status")
    @classmethod
    def validate_new_status(cls, v: str) -> str:
        s = v.strip().upper()
        if s not in ALLOWED_TRANSITION_STATUSES:
            raise ValueError(f"Unsupported target status '{v}'. Allowed transition targets: {sorted(list(ALLOWED_TRANSITION_STATUSES))}.")
        return s

    @field_validator("actor_role")
    @classmethod
    def validate_actor_role(cls, v: str) -> str:
        r = v.strip().upper()
        if r not in ALLOWED_ACTOR_ROLES:
            raise ValueError(f"Unsupported actor_role '{v}'. Allowed roles: {sorted(list(ALLOWED_ACTOR_ROLES))}.")
        return r

    @field_validator("rejection_reason_code")
    @classmethod
    def validate_rejection_reason_code(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            code = v.strip().upper()
            if code not in ALLOWED_REJECTION_REASONS:
                raise ValueError(
                    f"Unsupported rejection_reason_code '{v}'. Allowed codes: {sorted(list(ALLOWED_REJECTION_REASONS))}."
                )
            return code
        return None


class AIProposeCandidatesRequest(BaseModel):
    parcel_id: Optional[uuid.UUID] = Field(default=None, description="Optional UUID of the parent terrestrial parcel")
    parcel_ulpin: Optional[str] = Field(default="27A8B9C3D4E5F6", description="2D ULPIN of the parent parcel")
    building_id: Optional[str] = Field(default="TOWER-A", description="Building code or identifier")
    extraction_json_path: Optional[str] = Field(
        default="data/processed/tower_a_building_extraction.json",
        description="Path to Phase 2.2 building extraction output JSON"
    )
    las_path: Optional[str] = Field(
        default="data/simulated/prototype_tower_a.las",
        description="Path to LiDAR LAS point cloud file"
    )
    source_evidence_type: str = Field(
        default="LIDAR_POINTCLOUD",
        description="Source evidence type: 'LIDAR_POINTCLOUD', 'BIM_IFC', 'ARCHITECTURAL_PLAN_2D', etc."
    )
    confidence_threshold: float = Field(
        default=0.50,
        description="Minimum candidate proposal score threshold (0.0 to 1.0)"
    )

    model_config = ConfigDict(extra="ignore")


class AIBuildingAnalysisRequest(BaseModel):
    building_id: Optional[str] = Field(default=None, description="Existing building UUID or identifier if registered")
    candidate_osm_id: Optional[str] = Field(default=None, description="OSM way or relation ID for reference candidate")
    building_name: Optional[str] = Field(default=None, description="Optional descriptive building name")
    footprint_wgs84: Optional[list] = Field(default=None, description="2D Footprint coordinates in WGS84 [[lon, lat], ...]")
    ground_elevation_m: Optional[float] = Field(default=None, description="Copernicus DSM ground elevation in meters MSL")
    elev_max_m: Optional[float] = Field(default=None, description="Copernicus DSM maximum roof elevation in meters MSL")
    levels_metadata: Optional[int] = Field(default=None, description="Explicit observed floor count metadata from source (e.g. building:levels)")
    source_evidence_type: str = Field(default="REFERENCE_FOOTPRINT_ELEVATION", description="Source evidence category: REFERENCE_FOOTPRINT_ELEVATION, LIDAR_POINTCLOUD, BIM_IFC, ARCHITECTURAL_PLAN_2D")
    standard_floor_height_m: float = Field(default=3.0, description="Standard architectural storey height prior (m)")
    include_basement_hypothesis: bool = Field(default=True, description="Whether to include subterranean basement hypothesis")
    include_rooftop_hypothesis: bool = Field(default=True, description="Whether to include rooftop structure hypothesis")
    confidence_threshold: float = Field(default=0.40, description="Minimum confidence threshold for proposing strata")

    model_config = ConfigDict(extra="ignore")


