"""
SIH26011 Phase 2: Schemas for AI-Assisted Building Image -> 3D Reconstruction.
Defines input payloads, multi-view image specifications, derived property models with
strict provenance classifications, and output 3D geometry proposals.

DISCLAIMER:
Research Prototype Only.
All image-derived geometry and metrics represent algorithmic estimates and PROPOSED cadastre.
Does not confer statutory land title, legal ownership, or official survey certification.
"""
import uuid
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field

ProvenanceClassification = Literal["OBSERVED", "ESTIMATED", "REFERENCE", "SYNTHETIC", "PROPOSED"]
ImageViewType = Literal["FRONT", "SIDE", "TOP", "PERSPECTIVE", "UNSPECIFIED"]


class BuildingImageViewItem(BaseModel):
    """Represents a single building photograph / perspective view."""
    image_base64: Optional[str] = Field(None, description="Base64 data URI or raw base64 string")
    image_url: Optional[str] = Field(None, description="Accessible URL or local filepath to building image")
    view_type: ImageViewType = Field("UNSPECIFIED", description="Camera perspective: FRONT, SIDE, TOP, PERSPECTIVE, or UNSPECIFIED")
    filename: Optional[str] = Field(None, description="Original filename")
    focal_length_hint_mm: Optional[float] = Field(None, ge=10.0, le=300.0, description="Optional camera focal length hint if known")
    notes: Optional[str] = Field(None, description="Surveyor or user observation notes")


class BuildingImageReconstructionRequest(BaseModel):
    """Input payload for AI building image reconstruction."""
    images: List[BuildingImageViewItem] = Field(..., min_length=1, description="One or more building images")
    parcel_id: Optional[uuid.UUID] = Field(None, description="Optional parent parcel UUID to anchor coordinates and ground datum")
    reference_building_id: Optional[uuid.UUID] = Field(None, description="Optional reference building UUID to correlate with existing footprint")
    ground_z_override: Optional[float] = Field(None, description="Optional override for ground elevation datum (meters)")
    target_latitude: Optional[float] = Field(None, ge=-90.0, le=90.0, description="Optional target centroid latitude (WGS84)")
    target_longitude: Optional[float] = Field(None, ge=-180.0, le=180.0, description="Optional target centroid longitude (WGS84)")
    building_name_hint: Optional[str] = Field(None, description="Optional building name hint")
    floor_height_prior_m: Optional[float] = Field(3.0, ge=2.0, le=5.0, description="Prior expectation for floor height in meters (default 3.0m)")
    has_basement_hint: Optional[bool] = Field(True, description="Whether multi-storey structure likely has basement")
    notes: Optional[str] = Field(None, description="Operational notes")


class DerivedPropertyItem(BaseModel):
    """Represents a single derived property with transparent explainability and provenance."""
    property_name: str = Field(..., description="Name of geometric or architectural property")
    value: Any = Field(..., description="Derived numerical or string value")
    unit: Optional[str] = Field(None, description="Physical unit (e.g. m, m2, m3, count)")
    provenance: ProvenanceClassification = Field(..., description="Explicit classification: OBSERVED, ESTIMATED, REFERENCE, SYNTHETIC, or PROPOSED")
    source_description: str = Field(..., description="Method or source of derivation")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Explainable confidence score based on evidence completeness (0.0 to 1.0)")
    notes: Optional[str] = Field(None, description="Heuristic or validation notes")


class ReconstructedGeometry3D(BaseModel):
    """Volumetric 3D geometry representation for the proposed building envelope."""
    srid: int = Field(32644, description="Spatial Reference System ID (UTM Zone 44N)")
    geometry_type: str = Field("PolyhedralSurface", description="Z-enabled PolyhedralSurface prototype geometry type")
    wkt_3d: str = Field(..., description="WKT PolyhedralSurface Z solid representation")
    footprint_wkt: str = Field(..., description="2D footprint Polygon WKT")
    footprint_geojson: Dict[str, Any] = Field(..., description="GeoJSON polygon representation of the footprint")
    footprint_wgs84: List[List[float]] = Field(..., description="WGS84 closed coordinate ring [[lon, lat], ...]")
    is_watertight: bool = Field(True, description="Whether geometry represents a closed 2-manifold solid")


class MultiViewConsistencyRecord(BaseModel):
    """Structured multi-view evidence and geometric correspondence record."""
    footprint_width_m: float = Field(..., gt=0.0, description="Reconciled footprint width in meters")
    footprint_depth_m: float = Field(..., gt=0.0, description="Reconciled footprint depth/length in meters")
    building_height_m: float = Field(..., gt=0.0, description="Reconciled building height in meters")
    floor_count: int = Field(..., ge=1, description="Reconciled above-ground storey count")
    roof_type: str = Field("FLAT", description="Estimated roof profile: FLAT, FLAT_TERRACE_WITH_CORE, PITCHED, or COMPLEX")
    balcony_projection_m: Optional[float] = Field(None, description="Estimated balcony/facade projection in meters")
    rooftop_core_detected: bool = Field(False, description="Whether a secondary rooftop utility / staircase core was detected")
    evidence_views: List[str] = Field(default_factory=list, description="List of photographic views providing evidence")
    consistency_status: Literal["CONSISTENT", "REVIEW_REQUIRED"] = Field("CONSISTENT", description="Cross-view consistency determination")
    conflicts: List[str] = Field(default_factory=list, description="Explicit list of conflicting cross-view measurements")
    correspondence_checks: Dict[str, str] = Field(
        default_factory=lambda: {
            "footprint": "MATCH",
            "height": "MATCH",
            "floor_count": "MATCH",
            "major_offsets": "MATCH"
        },
        description="Dimensional correspondence status between evidence and generated 3D model"
    )


class CanonicalReconstructionContract(BaseModel):
    """Canonical single source of truth for 3D building reconstruction geometry."""
    reconstruction_id: uuid.UUID = Field(..., description="Unique UUID for this reconstruction run")
    footprint_width_m: float = Field(..., gt=0.0, description="Canonical footprint width in meters")
    footprint_depth_m: float = Field(..., gt=0.0, description="Canonical footprint depth/length in meters")
    building_height_m: float = Field(..., gt=0.0, description="Canonical above-ground building height in meters")
    above_ground_floors: int = Field(..., ge=1, description="Canonical above-ground floor count")
    basement_floors: int = Field(0, ge=0, description="Canonical basement levels count")
    floor_height_m: float = Field(3.0, gt=1.5, lt=6.0, description="Canonical floor height in meters")
    roof_height_m: float = Field(0.0, ge=0.0, description="Elevated roof/parapet structure height in meters")
    ground_z: float = Field(540.0, description="Canonical reference ground elevation Z in meters")
    geometry_status: str = Field("PROPOSED", description="Proposed cadastral geometry status")
    source_views: List[str] = Field(default_factory=list, description="List of observed photographic source views")


class BuildingImageReconstructionResponse(BaseModel):
    """Structured result of AI-assisted / explainable spatial estimation image reconstruction."""
    reconstruction_id: uuid.UUID = Field(..., description="Unique tracking UUID for this reconstruction run")
    status: str = Field("PROPOSED", description="Lifecycle status. Strictly PROPOSED until authorized human review.")
    timestamp: str = Field(..., description="ISO 8601 generation timestamp")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Overall explainable spatial estimation confidence score (0.0 to 1.0)")
    
    # Detected & estimated characteristics
    building_detected: bool = Field(True, description="Whether a valid building structure was identified")
    detected_class: str = Field("RESIDENTIAL_MULTI_STOREY", description="Detected architectural typology")
    views_analyzed: List[str] = Field(..., description="List of view perspectives evaluated")
    is_single_view: bool = Field(False, description="True if only a single image view was provided")
    
    # Core Estimated Dimensions
    estimated_width_m: float = Field(..., gt=0.0, description="Estimated building width (cross-section) in meters")
    estimated_length_m: float = Field(..., gt=0.0, description="Estimated building length (depth) in meters")
    estimated_height_m: float = Field(..., gt=0.0, description="Estimated height above ground in meters")
    estimated_floors_above: int = Field(..., ge=1, description="Estimated above-ground storey count")
    estimated_floors_below: int = Field(1, ge=0, description="Estimated basement level count")
    
    # Vertical Elevation Datums
    ground_z_m: Optional[float] = Field(None, description="DEM-derived prototype ground elevation reference (meters)")
    roof_z_m: Optional[float] = Field(None, description="Proposed roof elevation datum Z (meters)")
    
    # Volumetric Metrics
    footprint_area_sqm: float = Field(..., gt=0.0, description="Estimated 2D footprint area in square meters")
    envelope_volume_cbm: float = Field(..., gt=0.0, description="Volumetric solid volume in cubic meters")
    
    # Transparent Provenance
    derived_properties: List[DerivedPropertyItem] = Field(..., description="Itemized provenance breakdown for all metrics")
    
    # 3D Proposed Geometry
    geometry_3d: ReconstructedGeometry3D = Field(..., description="PolyhedralSurface Z 3D solid geometry proposal")
    
    # Canonical Reconstruction Contract
    canonical_reconstruction: Optional[CanonicalReconstructionContract] = Field(None, description="Canonical single source of truth for building generation")

    # Multi-View Consistency & Correspondence Record
    consistency_record: Optional[MultiViewConsistencyRecord] = Field(None, description="Structured cross-view geometric correspondence and consistency record")
    
    # Pipeline Feed Payload for existing BuildingGenerationService
    pipeline_feed_payload: Dict[str, Any] = Field(..., description="Payload ready for POST /api/buildings/generate-3d-prototype")
    
    # Quality, Warnings & Disclaimers
    warnings: List[str] = Field(default_factory=list, description="Operational warnings (e.g. scale uncertainty)")
    limitations: List[str] = Field(default_factory=list, description="Explicit technical limitations")
    human_verification_required: bool = Field(True, description="Strictly True. Human surveyor signoff is mandatory.")
    disclaimer: str = Field(
        "RESEARCH PROTOTYPE. Derived geometry is algorithmic and PROPOSED. "
        "Ordinary photographs do not provide authoritative cadastral boundaries, legal title, "
        "or survey-grade elevation. Official field verification is mandatory.",
        description="Statutory research prototype disclaimer"
    )
