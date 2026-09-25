"""
Pydantic schemas for Phase 2.5 Multi-Source 3D Candidate Unit Integration.
"""
import uuid
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field, field_validator


ALLOWED_CANDIDATE_SOURCES = {
    "LIDAR_POINTCLOUD",
    "BIM_IFC",
    "CITYJSON_LOD2",
    "DRONE_PHOTOGRAMMETRY",
    "ARCHITECTURAL_PLAN_2D",
    "CORS_GNSS_SURVEY",
    "MANUAL_DIGITIZED",
    "POLYHEDRALSURFACE_WKT"
}

ALLOWED_TIER_CODES = {"SB", "UT", "F", "AE", "AR", "CM"}


class CandidateUnitPayload(BaseModel):
    candidate_key: Optional[str] = Field(default=None, description="Deterministic candidate identifier (e.g. 'TOWER-A_F00_LIDAR_P24')")
    floor_code: str = Field(..., description="Floor or level identifier, e.g. 'F00', 'F01', 'B01', 'UT01'")
    tier_code: str = Field(default="F", description="Vertical tier code: SB (Basement), UT (Utility), F (Floor), AE (Aerial), AR (Air Rights), CM (Common)")
    unit_label: Optional[str] = Field(default=None, description="Descriptive label for candidate unit")
    unit_type: str = Field(default="RESIDENTIAL", description="Unit classification category")
    z_min: float = Field(..., description="Lower vertical elevation boundary in meters MSL (EPSG:32644)")
    z_max: float = Field(..., description="Upper vertical elevation boundary in meters MSL (EPSG:32644)")
    geom_wkt: str = Field(..., description="3D PolyhedralSurface WKT geometry (EPSG:32644)")
    analytical_metadata: Optional[Dict[str, Any]] = Field(default=None, description="Analytical metrics, volume, and extraction statistics")

    model_config = ConfigDict(extra="ignore")

    @field_validator("tier_code")
    @classmethod
    def validate_tier(cls, v: str) -> str:
        code = v.strip().upper()
        # Handle descriptive aliases
        if code in ("ABOVE_GROUND", "FLOOR", "TERRESTRIAL"):
            return "F"
        if code in ("BASEMENT", "SUBTERRANEAN", "UNDERGROUND"):
            return "SB"
        if code in ("UTILITY", "UNDERGROUND_UTILITY"):
            return "UT"
        if code not in ALLOWED_TIER_CODES:
            raise ValueError(f"Unsupported tier_code '{v}'. Allowed: {sorted(list(ALLOWED_TIER_CODES))}")
        return code


    @field_validator("z_max")
    @classmethod
    def validate_z_order(cls, v: float, info) -> float:
        z_min = info.data.get("z_min")
        if z_min is not None and v <= z_min:
            raise ValueError(f"Inverted Z range error: z_max ({v}) must be greater than z_min ({z_min}).")
        return v


class CandidateIntegrationRequest(BaseModel):
    parcel_ulpin_2d: str = Field(..., description="14-character 2D ULPIN of the parent land parcel")
    building_code: Optional[str] = Field(default="TOWER-A", description="Building code on the parcel")
    source_type: str = Field(..., description="Evidence source type (e.g. 'LIDAR_POINTCLOUD', 'BIM_IFC', 'ARCHITECTURAL_PLAN_2D')")
    dataset_name: str = Field(..., description="Name of source dataset file or model")
    file_uri: str = Field(..., description="URI or path to source evidence file")
    accuracy_horizontal_m: Optional[float] = Field(default=0.05, description="Estimated horizontal accuracy in meters")
    accuracy_vertical_m: Optional[float] = Field(default=0.05, description="Estimated vertical accuracy in meters")
    candidates: List[CandidateUnitPayload] = Field(..., description="List of candidate 3D units to integrate")

    model_config = ConfigDict(extra="ignore")

    @field_validator("source_type")
    @classmethod
    def validate_source(cls, v: str) -> str:
        st = v.strip().upper()
        if st not in ALLOWED_CANDIDATE_SOURCES:
            raise ValueError(f"Unsupported source_type '{v}'. Allowed: {sorted(list(ALLOWED_CANDIDATE_SOURCES))}")
        return st


class IntegratedCandidateUnitItem(BaseModel):
    unit_id: uuid.UUID
    prototype_ulpin_3d: str
    floor_code: str
    tier_code: str
    unit_sequence: int
    status: str
    is_newly_created: bool
    z_min: float
    z_max: float
    volume_cbm: Optional[float] = None
    validation_status: str
    message: str

    model_config = ConfigDict(from_attributes=True)


class CandidateIntegrationResponse(BaseModel):
    status: str = "COMPLETED"
    synthetic: bool = True
    prototype_only: bool = True
    parcel_ulpin_2d: str
    building_code: Optional[str] = None
    source_type: str
    dataset_name: str
    total_candidates_processed: int
    newly_created_count: int
    idempotent_existing_count: int
    integrated_units: List[IntegratedCandidateUnitItem]
    disclaimer: str = (
        "Research prototype multi-source 3D candidate unit integration. "
        "All newly integrated units initialize in PROPOSED status and require human surveyor review."
    )

    model_config = ConfigDict(from_attributes=True)
