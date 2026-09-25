"""
SIH26011 Phase 5: Schemas for Drone Survey / Survey Data Input Workspace.
Defines input payloads, survey metadata, quality/evidence checklists,
survey-derived products, and downstream handoff specifications with strict provenance.

DISCLAIMER:
Research Prototype Only.
Drone survey imagery provides above-ground visual/surface evidence.
Does not confer statutory land title, legal ownership, or official survey certification.
Underground geometry is not inferred directly from aerial imagery.
"""
import uuid
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field

from backend.app.schemas.ai_image_reconstruction import (
    ProvenanceClassification,
    ImageViewType,
    BuildingImageViewItem,
    BuildingImageReconstructionRequest
)

QualityCheckStatus = Literal["AVAILABLE", "MISSING", "ESTIMATED", "NOT_PROVIDED"]


class DroneSurveyImageItem(BaseModel):
    """Represents a single drone photograph or oblique aerial perspective."""
    image_base64: Optional[str] = Field(None, description="Base64 data URI or raw base64 string")
    image_url: Optional[str] = Field(None, description="URL or local path to drone survey photograph")
    filename: Optional[str] = Field(None, description="Original filename (e.g. DJI_0042.JPG)")
    file_size_bytes: Optional[int] = Field(None, description="Image file size in bytes")
    mime_type: Optional[str] = Field("image/jpeg", description="MIME type")
    view_type: ImageViewType = Field("UNSPECIFIED", description="Identified perspective: FRONT, SIDE, TOP, PERSPECTIVE, or UNSPECIFIED")
    flight_altitude_m: Optional[float] = Field(None, ge=10.0, le=500.0, description="Estimated flight altitude AGL (meters)")
    camera_model: Optional[str] = Field(None, description="Camera or sensor model")
    has_geotag: bool = Field(False, description="Whether EXIF geotag coordinates are present")
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0, description="WGS84 latitude")
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0, description="WGS84 longitude")
    relative_altitude_m: Optional[float] = Field(None, description="Relative GPS altitude (meters)")
    notes: Optional[str] = Field(None, description="Flight observation notes")


class DroneSurveyMetadata(BaseModel):
    """Survey mission and sensor operational metadata."""
    survey_id: Optional[str] = Field(None, description="Mission or survey identifier (e.g. SRV-2026-HYD-04)")
    capture_date: Optional[str] = Field(None, description="Capture date (ISO 8601 YYYY-MM-DD)")
    operator_agency: Optional[str] = Field(None, description="Surveying agency or operator")
    camera_source: Optional[str] = Field(None, description="UAV platform / optical sensor")
    approx_area_sqm: Optional[float] = Field(None, ge=10.0, description="Approximate flight bounding area (sq meters)")
    crs: str = Field("EPSG:32644", description="Canonical analytical spatial reference (UTM Zone 44N)")
    ground_control_available: bool = Field(False, description="Whether Ground Control Points (GCPs) were surveyed")
    gcp_count: Optional[int] = Field(0, description="Number of surveyed DGPS/RTK ground control points")
    has_point_cloud: bool = Field(False, description="Whether an associated LiDAR or photogrammetric point cloud is supplied")
    point_cloud_ref: Optional[str] = Field(None, description="Point cloud file or dataset reference")
    notes: Optional[str] = Field(None, description="Mission notes")


class SurveyQualityCheckItem(BaseModel):
    """Represents a discrete quality check or evidence verification finding."""
    check_name: str = Field(..., description="Name of survey quality checkpoint")
    category: str = Field(..., description="Category: SENSOR, GEODETIC, GEOMETRIC, COMPLETENESS")
    status: QualityCheckStatus = Field(..., description="Status: AVAILABLE, MISSING, ESTIMATED, NOT_PROVIDED")
    details: str = Field(..., description="Technical assessment and explainable rationale")
    provenance: ProvenanceClassification = Field(..., description="OBSERVED, REFERENCE, ESTIMATED, SYNTHETIC, or PROPOSED")


class SurveyDerivedProductItem(BaseModel):
    """Represents an intermediate or conceptual survey-derived spatial product."""
    product_name: str = Field(..., description="Name of derived product (e.g. Orthomosaic Footprint Evidence)")
    product_type: str = Field(..., description="Type: ORTHOMOSAIC, FOOTPRINT_EVIDENCE, SURFACE_PROFILE, DEM_DATUM, COVERAGE")
    status: str = Field("AVAILABLE", description="Availability status")
    resolution_or_spec: Optional[str] = Field(None, description="Ground sampling distance or resolution")
    provenance: ProvenanceClassification = Field(..., description="Classification: OBSERVED, REFERENCE, ESTIMATED, or PROPOSED")
    notes: str = Field(..., description="Usage and legal notice")


class DroneSurveyAnalysisRequest(BaseModel):
    """Input payload for drone survey analysis."""
    images: List[DroneSurveyImageItem] = Field(..., min_length=1, description="One or more drone survey images")
    metadata: Optional[DroneSurveyMetadata] = Field(default_factory=DroneSurveyMetadata, description="Survey mission metadata")
    parcel_id: Optional[uuid.UUID] = Field(None, description="Optional parent parcel UUID to correlate")
    reference_building_id: Optional[uuid.UUID] = Field(None, description="Optional reference building UUID")
    target_latitude: Optional[float] = Field(None, description="Centroid latitude")
    target_longitude: Optional[float] = Field(None, description="Centroid longitude")
    estimated_building_height_prior_m: Optional[float] = Field(15.0, description="Prior height estimate")


class DroneSurveyAnalysisResponse(BaseModel):
    """Output payload for drone survey analysis and downstream AI handoff."""
    survey_id: str = Field(..., description="Survey identifier")
    image_count: int = Field(..., ge=1, description="Total images evaluated")
    is_demo_survey: bool = Field(False, description="Whether this dataset is prepared demonstration survey data")
    survey_coverage_metadata: Dict[str, Any] = Field(..., description="Aggregated coverage and sensor metadata")
    available_evidence: List[str] = Field(default_factory=list, description="List of available evidence artifacts")
    missing_evidence: List[str] = Field(default_factory=list, description="List of missing evidence components")
    quality_checks: List[SurveyQualityCheckItem] = Field(..., description="8-point survey quality checklist")
    derived_products: List[SurveyDerivedProductItem] = Field(..., description="Survey-derived evidence products")
    provenance_matrix: List[Dict[str, Any]] = Field(..., description="Source-to-product provenance mappings")
    warnings: List[str] = Field(default_factory=list, description="Advisory survey warnings")
    underground_limitation_notice: str = Field(
        "Drone imagery provides above-ground visual/surface evidence. Underground geometry requires survey, CAD/BIM, utility, or engineering evidence and is not inferred directly from aerial imagery.",
        description="Statutory disclaimer on subsurface limitations"
    )
    point_cloud_support_notice: str = Field(
        "Point-cloud processing input supported by the architecture; prepared dataset required for full demonstration.",
        description="Architectural notice regarding point cloud inputs"
    )
    cadastral_legal_notice: str = Field(
        "Ordinary drone photographs and aerial reconstructions are not survey-grade cadastral evidence and do not determine legal ownership.",
        description="Legal cadastral limitation notice"
    )
    handoff_payload: BuildingImageReconstructionRequest = Field(
        ...,
        description="Directly formatted downstream handoff payload for POST /api/ai/building/reconstruct"
    )
