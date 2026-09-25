"""
Pydantic v2 schemas for Phase 3.3 3D/2D data ingestion, source standardization, and geometry preparation.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field, field_validator


SUPPORTED_INGESTION_TYPES = {
    "POLYHEDRALSURFACE_WKT",
    "PARCEL_GEOJSON",
    "POINT_CLOUD_LAS",
    "RASTER_DEM",
    "BIM_IFC",
    "CAD_DXF"
}

SOURCE_TYPE_ALIASES = {
    "WKT": "POLYHEDRALSURFACE_WKT",
    "POLYHEDRALSURFACE": "POLYHEDRALSURFACE_WKT",
    "GEOJSON": "PARCEL_GEOJSON",
    "PARCEL": "PARCEL_GEOJSON",
    "LAS": "POINT_CLOUD_LAS",
    "LAZ": "POINT_CLOUD_LAS",
    "LIDAR": "POINT_CLOUD_LAS",
    "DEM": "RASTER_DEM",
    "DSM": "RASTER_DEM",
    "GEOTIFF": "RASTER_DEM",
    "IFC": "BIM_IFC",
    "BIM": "BIM_IFC",
    "DXF": "CAD_DXF",
    "CAD": "CAD_DXF"
}


class SourceManifestItem(BaseModel):
    """
    Normalized metadata manifest describing an ingested spatial data source.
    """
    source_name: str
    source_type: str
    format: str
    original_crs: Optional[str] = None
    normalized_crs: str = "EPSG:32644"
    fingerprint_sha256: str
    processing_status: str
    quality_flags: List[str] = []
    metadata: Optional[Dict[str, Any]] = None
    geometry_summary: Optional[Dict[str, Any]] = None
    disclaimer: str = (
        "Prototype source manifest. Real-world 3D cadastral registration requires verified administrative evidence. "
        "LiDAR does not establish underground geometry. GPR may be used where available and appropriate."
    )
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(from_attributes=True)


class IngestionValidationRequest(BaseModel):
    source_type: str = Field(
        ...,
        description="Ingestion data type: 'POLYHEDRALSURFACE_WKT', 'PARCEL_GEOJSON', 'POINT_CLOUD_LAS', 'RASTER_DEM', 'BIM_IFC', 'CAD_DXF'"
    )
    source_crs: Optional[int] = Field(
        default=None,
        description="Explicit EPSG code of source data (e.g. 32644, 4326). Required for spatial geometries."
    )
    target_crs: int = Field(
        default=32644,
        description="Target canonical analysis CRS (default: 32644 for UTM Zone 44N)"
    )
    filename: Optional[str] = Field(
        default=None,
        description="Original source filename (used for extension inspection and provenance)"
    )
    data_payload: Optional[str] = Field(
        default=None,
        description="Raw WKT text, GeoJSON string, base64 data, or text payload"
    )
    metadata_json: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Supplementary metadata (e.g. point cloud header, sensor info, survey date)"
    )

    model_config = ConfigDict(extra="ignore")

    @field_validator("source_type")
    @classmethod
    def validate_source_type(cls, v: str) -> str:
        st = v.strip().upper()
        if st in SOURCE_TYPE_ALIASES:
            st = SOURCE_TYPE_ALIASES[st]
        if st not in SUPPORTED_INGESTION_TYPES:
            raise ValueError(f"Unsupported source_type '{v}'. Supported types: {sorted(list(SUPPORTED_INGESTION_TYPES))}.")
        return st


class IngestionValidationResponse(BaseModel):
    status: str = Field(
        ...,
        description="Ingestion status: 'VALIDATED', 'RECOGNIZED_DEFERRED', 'REJECTED', 'WARNING'"
    )
    source_type: str
    source_crs: Optional[int] = None
    target_crs: int = 32644
    transformed: bool = False
    feature_count: int = 0
    geometry_valid: bool = False
    geometry_summary: Optional[Dict[str, Any]] = None
    fingerprint_sha256: Optional[str] = None
    quality_flags: List[str] = []
    manifest: Optional[SourceManifestItem] = None
    message: str
    errors: List[str] = []
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(from_attributes=True)


class SourceRegistrationRequest(BaseModel):
    source_type: str = Field(
        ...,
        description="Ingestion source type (e.g. 'POINT_CLOUD_LAS', 'PARCEL_GEOJSON', 'POLYHEDRALSURFACE_WKT', 'BIM_IFC', 'CAD_DXF', 'RASTER_DEM')"
    )
    dataset_name: Optional[str] = Field(
        default=None,
        description="Descriptive dataset name (defaults to filename or generated tag)"
    )
    filename: Optional[str] = Field(
        default=None,
        description="Source file name"
    )
    source_crs: Optional[int] = Field(
        default=None,
        description="Explicit source CRS (e.g. 32644, 4326)"
    )
    target_crs: int = Field(
        default=32644,
        description="Target canonical CRS (default 32644)"
    )
    data_payload: Optional[str] = Field(
        default=None,
        description="Raw payload string (WKT, GeoJSON, or text content)"
    )
    metadata_json: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional survey/sensor metadata"
    )
    parcel_ulpin_2d: Optional[str] = Field(
        default=None,
        description="Target terrestrial parcel ULPIN 2D (e.g. 'MH-PUN-001')"
    )
    building_code: Optional[str] = Field(
        default=None,
        description="Target building code (e.g. 'BLD-TOWER-A')"
    )
    generate_candidates: bool = Field(
        default=False,
        description="Whether to execute candidate unit generation into database (remains strictly PROPOSED)"
    )
    subterranean_evidence_type: Optional[str] = Field(
        default=None,
        description="Subterranean evidence type if creating underground units (e.g. 'ARCHITECTURAL_BIM', 'ENGINEERING_CAD', 'SUBSURFACE_SURVEY', 'GPR_SURVEY')"
    )

    model_config = ConfigDict(extra="ignore")

    @field_validator("source_type")
    @classmethod
    def validate_source_type(cls, v: str) -> str:
        st = v.strip().upper()
        if st in SOURCE_TYPE_ALIASES:
            st = SOURCE_TYPE_ALIASES[st]
        if st not in SUPPORTED_INGESTION_TYPES:
            raise ValueError(f"Unsupported source_type '{v}'. Supported types: {sorted(list(SUPPORTED_INGESTION_TYPES))}.")
        return st


class SourceRegistrationResponse(BaseModel):
    status: str = Field(
        ...,
        description="Registration status: 'SUCCESS', 'DEFERRED', 'REJECTED', 'DUPLICATE_SOURCE'"
    )
    source_id: Optional[str] = None
    source_type: str
    dataset_name: str
    fingerprint_sha256: str
    normalized_crs: str = "EPSG:32644"
    quality_flags: List[str] = []
    processing_status: str
    candidates_generated: int = 0
    candidate_unit_ids: List[str] = []
    message: str
    errors: List[str] = []
    manifest: Optional[SourceManifestItem] = None
    registered_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(from_attributes=True)
