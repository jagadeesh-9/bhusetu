"""
Pydantic v2 schemas for API responses.
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class GeometryPayload(BaseModel):
    srid: int = 32644
    geometry_type: str
    geojson: Dict[str, Any] = Field(description="Structured 3D/2D GeoJSON preserving all Z coordinates")
    ewkt: Optional[str] = Field(default=None, description="Exact PostGIS EWKT representation")

    model_config = ConfigDict(from_attributes=True)


class HealthResponse(BaseModel):
    status: str = "healthy"
    database_connected: bool
    postgis_version: Optional[str] = None
    sfcgal_version: Optional[str] = None
    canonical_crs: str = "EPSG:32644"
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SourceEvidenceResponse(BaseModel):
    id: uuid.UUID
    source_type: str
    dataset_name: str
    file_uri: str
    accuracy_horizontal_m: Optional[float] = None
    accuracy_vertical_m: Optional[float] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VerificationAuditResponse(BaseModel):
    id: uuid.UUID
    action: str
    previous_status: str
    new_status: str
    reviewer_name: str
    reviewer_role: str
    review_notes: Optional[str] = None
    integrity_hash: Optional[str] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class ParcelResponse(BaseModel):
    id: uuid.UUID
    ulpin_2d: str
    survey_number: str
    district: str
    state: str
    village_code: Optional[str] = None
    area_sqm: float
    geom_2d: GeometryPayload
    building_count: int = 0
    vertical_unit_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BuildingResponse(BaseModel):
    id: uuid.UUID
    parcel_id: uuid.UUID
    building_code: str
    building_name: str
    total_floors_above: int
    total_floors_below: int
    footprint_2d: GeometryPayload
    envelope_3d: Optional[GeometryPayload] = None
    unit_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VerticalTaxonomyClassification(BaseModel):
    category: str = Field(description="Taxonomy category: UNDERGROUND, GROUND, UPPER_FLOORS, ROOFTOP_ELEVATED, COMMON, OTHER")
    category_label: str = Field(description="User-friendly category display name")
    unit_class: str = Field(description="Prototype unit classification e.g. BASEMENT, UNDERGROUND_PARKING, UNDERGROUND_UTILITY, GROUND_FLOOR, OPEN_PARKING, UPPER_FLOOR, ROOFTOP, ELEVATED, COMMON_CIRCULATION")
    unit_class_label: str = Field(description="User-friendly unit class display name")


class VerticalUnitResponse(BaseModel):
    id: uuid.UUID
    parcel_id: uuid.UUID
    building_id: Optional[uuid.UUID] = None
    parent_unit_id: Optional[uuid.UUID] = None
    prototype_ulpin_3d: str
    tier_code: str
    floor_code: str
    unit_sequence: int
    unit_level: str = "STOREY"
    flat_number: Optional[str] = None
    unit_label: str
    unit_type: str
    z_min: float
    z_max: float
    status: str
    geom_3d: GeometryPayload
    taxonomy: Optional[VerticalTaxonomyClassification] = None
    source_evidence: List[SourceEvidenceResponse] = []
    verification_audit: List[VerificationAuditResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VerticalCategoryGroup(BaseModel):
    category_code: str
    category_label: str
    unit_count: int
    z_min: float
    z_max: float
    units: List[VerticalUnitResponse]


class VerticalStructureResponse(BaseModel):
    parcel_id: uuid.UUID
    parcel_ulpin_2d: str
    total_units: int
    categories: List[VerticalCategoryGroup]
    prototype_note: str = (
        "Research prototype 3D property decomposition model. "
        "Heterogeneous vertical strata are represented as distinct 3D candidate units. "
        "Does not determine legal ownership, leasehold title, or statutory property rights."
    )
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)


class CheckItem(BaseModel):
    check: str
    passed: bool
    message: str


class ConflictItem(BaseModel):
    conflicting_unit_id: uuid.UUID
    conflicting_prototype_ulpin_3d: str
    overlap_volume_cbm: float
    description: str


class ValidationResponse(BaseModel):
    unit_id: uuid.UUID
    prototype_ulpin_3d: str
    valid: bool
    checks: List[CheckItem]
    conflicts: List[ConflictItem] = []
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)


class ProvenanceStep(BaseModel):
    step_number: int
    stage: str
    name: str
    status: str
    details: str
    timestamp: Optional[datetime] = None


class EvidenceDetailItem(BaseModel):
    id: uuid.UUID
    source_type: str
    dataset_name: str
    file_uri: str
    accuracy_horizontal_m: Optional[float] = None
    accuracy_vertical_m: Optional[float] = None
    sensor_category: str
    is_synthetic: bool = True
    assessment_level: str
    assessment_rationale: str
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UnitEvidenceProvenanceResponse(BaseModel):
    unit_id: uuid.UUID
    prototype_ulpin_3d: str
    floor_code: str
    tier_code: str
    status: str
    overall_assessment_level: str
    overall_assessment_label: str
    is_synthetic_prototype: bool = True
    is_underground: bool
    underground_provenance_note: Optional[str] = None
    evidence_count: int
    evidence_records: List[EvidenceDetailItem]
    provenance_pipeline: List[ProvenanceStep]
    disclaimer: str = (
        "Prototype evidence assessment and provenance intelligence. "
        "Analytical evidence supports 3D candidate geometry and reconstruction; "
        "it does not constitute legal land title or ownership certification."
    )
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)


class AICandidateFeatureVector(BaseModel):
    footprint_area_sqm: float
    footprint_perimeter_m: float
    footprint_compactness: float
    aspect_ratio: float
    centroid_x: float
    centroid_y: float
    z_min: float
    z_max: float
    height_interval_m: float
    relative_height_ratio: float
    point_count: int
    point_density_pts_m3: float
    z_mean: float
    z_std: float
    z_p25: float
    z_p50: float
    z_p75: float
    z_p90: float
    peak_prominence_ratio: float
    source_evidence_type: str
    is_synthetic: bool = True

    model_config = ConfigDict(from_attributes=True)


class AICandidateProposal(BaseModel):
    candidate_id: str
    candidate_type: str
    tier_code: str
    floor_code: str
    suggested_label: str
    suggested_unit_type: str
    z_min: float
    z_max: float
    confidence: str = Field(default="HIGH", description="Categorical confidence: HIGH, MEDIUM, LOW")
    confidence_score: float = Field(default=0.85, description="Normalized heuristic prototype score 0.0 - 1.0")
    confidence_label: str = "PROTOTYPE_CANDIDATE_CONFIDENCE"
    explanation: List[str]
    review_flags: List[str] = []
    features: AICandidateFeatureVector
    geom_wkt: Optional[str] = None
    status: str = "PROPOSED"


class AICandidateAnalysisResponse(BaseModel):
    unit_id: uuid.UUID
    prototype_ulpin_3d: str
    tier_code: str
    floor_code: str
    candidate_type: str
    status: str
    confidence: str
    confidence_score: float
    confidence_label: str = "PROTOTYPE_CANDIDATE_CONFIDENCE"
    explanation: List[str]
    review_flags: List[str]
    features: AICandidateFeatureVector
    underground_safety: Dict[str, Any]
    disclaimer: str = (
        "This AI analysis is a research prototype candidate intelligence assessment only. "
        "It does not perform legal ownership determination, cadastral certification, or official ULPIN assignment. "
        "Human verification by an authorized surveyor or revenue official is mandatory."
    )
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)


class AIProposeCandidatesResponse(BaseModel):
    dataset_name: str
    parent_parcel_ulpin: str
    total_candidates_proposed: int
    method: str = "STATISTICAL_FEATURE_RANKING_HYBRID"
    model_version: str = "2.9.0-prototype"
    is_synthetic: bool = True
    proposals: List[AICandidateProposal]
    disclaimer: str = (
        "AI Candidate proposals are algorithmic hypotheses derived from spatial evidence. "
        "All candidates are initialized in PROPOSED status and require PostGIS/SFCGAL geometric validation "
        "and statutory human verification before acceptance."
    )
    proposed_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Phase 3.0: 3D Topology, Conflict Detection & Spatial Quality-Control Schemas
# ============================================================================

class TopologySolidValidation(BaseModel):
    unit_id: Optional[uuid.UUID] = None
    prototype_ulpin_3d: Optional[str] = None
    is_closed: bool
    is_solid: bool
    volume_cbm: float
    z_min_geom: float
    z_max_geom: float
    z_min_meta: float
    z_max_meta: float
    validity_code: str = Field(
        description="Validity code: VALID_SOLID, INVALID_CLOSEDNESS, INVALID_SOLID, NON_POSITIVE_VOLUME, INVALID_Z_RANGE"
    )
    is_valid: bool
    details: str

    model_config = ConfigDict(from_attributes=True)


class TopologyPairwiseRelationship(BaseModel):
    unit_a_id: uuid.UUID
    unit_a_ulpin: str
    unit_b_id: uuid.UUID
    unit_b_ulpin: str
    relationship_code: str = Field(
        description="Relationship: DISJOINT, BOUNDARY_CONTACT, POSITIVE_VOLUME_OVERLAP, DUPLICATE_SPATIAL_REPRESENTATION"
    )
    overlap_volume_cbm: float
    has_surface_contact: bool
    shared_z_interval: bool
    severity: str = Field(description="Severity: INFO, WARNING, ERROR")
    description: str

    model_config = ConfigDict(from_attributes=True)


class TopologyVerticalContinuityItem(BaseModel):
    unit_id: uuid.UUID
    prototype_ulpin_3d: str
    floor_code: str
    z_min: float
    z_max: float
    relation_to_lower_unit: str = Field(
        description="Vertical relation: GROUND_BASE, CONTIGUOUS, VERTICAL_GAP, VERTICAL_OVERLAP, OUT_OF_ORDER, SUBTERRANEAN_INTERFACE"
    )
    gap_or_overlap_m: float
    severity: str = Field(description="Severity: INFO, WARNING, ERROR")
    details: str

    model_config = ConfigDict(from_attributes=True)


class TopologyContainmentFinding(BaseModel):
    unit_id: uuid.UUID
    prototype_ulpin_3d: str
    is_within_parcel: bool
    is_within_building: Optional[bool] = None
    status: str = Field(description="Status: CONTAINED, OUTSIDE_PARENT, PARTIAL_OUTSIDE_PARENT")
    severity: str = Field(description="Severity: INFO, ERROR")
    message: str

    model_config = ConfigDict(from_attributes=True)


class UnitTopologyReportResponse(BaseModel):
    unit_id: uuid.UUID
    prototype_ulpin_3d: str
    parcel_id: uuid.UUID
    building_id: Optional[uuid.UUID] = None
    overall_quality_status: str = Field(
        description="Overall status: VALID, REVIEW_REQUIRED, CONFLICT"
    )
    solid_validation: TopologySolidValidation
    containment: TopologyContainmentFinding
    vertical_continuity: TopologyVerticalContinuityItem
    peer_relationships: List[TopologyPairwiseRelationship]
    conflict_count: int
    warning_count: int
    disclaimer: str = (
        "Topology results represent spatial quality-control findings in this research prototype. "
        "They do not constitute legal ownership, title, statutory cadastral certification, or government approval."
    )
    audited_at: datetime = Field(default_factory=datetime.utcnow)


class ParcelTopologyReportResponse(BaseModel):
    parcel_id: uuid.UUID
    parcel_ulpin: str
    total_units_audited: int
    overall_topology_status: str = Field(
        description="Overall status: VALID, REVIEW_REQUIRED, CONFLICT"
    )
    valid_unit_count: int
    conflict_count: int
    warning_count: int
    pairwise_relationships: List[TopologyPairwiseRelationship]
    containment_findings: List[TopologyContainmentFinding]
    vertical_continuity_analysis: List[TopologyVerticalContinuityItem]
    solid_validations: List[TopologySolidValidation]
    disclaimer: str = (
        "Topology results represent spatial quality-control findings in this research prototype. "
        "They do not constitute legal ownership, title, statutory cadastral certification, or government approval."
    )
    audited_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Phase 3.1: Human-in-the-Loop Review Workspace Schemas
# ============================================================================

class AuditHistoryItem(BaseModel):
    id: uuid.UUID
    action: str
    previous_status: Optional[str] = None
    new_status: str
    actor_role: str
    reviewer_name: Optional[str] = None
    review_notes: Optional[str] = None
    integrity_hash: Optional[str] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class ReviewReadinessItem(BaseModel):
    code: str
    label: str
    passed: bool
    severity: str = Field(description="Severity: INFO, WARNING, ERROR")
    message: str


class ReviewReadinessSummary(BaseModel):
    overall_readiness: str = Field(
        description="Readiness: READY_FOR_HUMAN_REVIEW, REVIEW_REQUIRES_ATTENTION, BLOCKED_INVALID_GEOMETRY"
    )
    passed_count: int
    warning_count: int
    error_count: int
    items: List[ReviewReadinessItem]


class UnitReviewCaseResponse(BaseModel):
    unit_id: uuid.UUID
    prototype_ulpin_3d: str
    parcel_id: uuid.UUID
    parcel_ulpin_2d: str
    building_id: Optional[uuid.UUID] = None
    building_name: Optional[str] = None
    tier_code: str
    floor_code: str
    unit_label: Optional[str] = None
    unit_type: str
    status: str
    z_min: float
    z_max: float
    height_m: float
    volume_cbm: float
    ewkt_3d: Optional[str] = None

    # Quality & Intelligence Modules
    topology: UnitTopologyReportResponse
    evidence: UnitEvidenceProvenanceResponse
    ai_analysis: Optional[AICandidateAnalysisResponse] = None
    readiness: ReviewReadinessSummary
    audit_history: List[AuditHistoryItem]
    available_actions: List[str]

    disclaimer: str = (
        "Research Prototype Review Workspace. This system provides computational spatial quality-control, "
        "evidence aggregation, and AI-assisted candidate proposals to assist authorized human review. "
        "It does not establish legal ownership, title validity, statutory cadastral certification, or government approval."
    )
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Phase 3.2 3D Cadastral Dataset Management & Spatial Navigation Schemas
# ============================================================================

class ParcelBuildingSummary(BaseModel):
    id: uuid.UUID
    building_code: str
    building_name: str
    total_floors_above: int
    total_floors_below: int
    footprint_area_sqm: float
    height_m: float
    unit_count: int


class ParcelUnitOverviewItem(BaseModel):
    id: uuid.UUID
    prototype_ulpin_3d: str
    building_id: Optional[uuid.UUID] = None
    building_code: Optional[str] = None
    floor_code: str
    tier_code: str
    unit_label: str
    unit_type: str
    z_min: float
    z_max: float
    height_m: float
    volume_cbm: float
    status: str
    is_solid_valid: bool
    evidence_count: int
    conflict_count: int


class DatasetStatistics(BaseModel):
    total_units: int
    total_buildings: int
    status_counts: Dict[str, int]
    taxonomy_counts: Dict[str, int]
    total_modeled_volume_cbm: float
    total_evidence_records: int


class DatasetQualityScorecardItem(BaseModel):
    category: str
    metric_name: str
    count: int
    total: int
    severity: str = Field(description="Severity: INFO, WARNING, ERROR")
    details: str


class DatasetQualityScorecard(BaseModel):
    overall_quality: str = Field(description="HEALTHY, ATTENTION_REQUIRED, CRITICAL_ISSUES")
    geometry_valid_solids: int
    geometry_total: int
    topology_conflict_free_units: int
    topology_total_units: int
    evidence_supported_units: int
    evidence_total_units: int
    vertical_continuity_valid_stacks: int
    vertical_continuity_total_stacks: int
    scorecard_items: List[DatasetQualityScorecardItem]


class DatasetConsistencyFinding(BaseModel):
    check_id: str
    check_name: str
    status: str = Field(description="PASS, WARNING, ERROR")
    details: str
    affected_unit_ids: List[uuid.UUID] = Field(default_factory=list)


class Parcel3DOverviewResponse(BaseModel):
    parcel_id: uuid.UUID
    parcel_ulpin_2d: str
    survey_number: str
    district: str
    state: str
    village_code: Optional[str] = None
    area_sqm: float
    crs: str = "EPSG:32644"
    geom_2d_wkt: Optional[str] = None
    buildings: List[ParcelBuildingSummary]
    units: List[ParcelUnitOverviewItem]
    statistics: DatasetStatistics
    quality_scorecard: DatasetQualityScorecard
    consistency_findings: List[DatasetConsistencyFinding]
    disclaimer: str = (
        "SIH26011 Research Prototype 3D Cadastral Dataset Overview. "
        "This dataset management and spatial navigation view provides analytical geometric quality-control, "
        "evidence provenance, and spatial relationship modeling. It does not establish legal ownership, "
        "statutory subdivision, or official government title."
    )
    generated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(from_attributes=True)


class UnitNeighborItem(BaseModel):
    neighbor_id: uuid.UUID
    neighbor_ulpin_3d: str
    floor_code: str
    tier_code: str
    relationship_code: str = Field(description="DISJOINT, BOUNDARY_CONTACT, POSITIVE_VOLUME_OVERLAP, DUPLICATE_SPATIAL_REPRESENTATION")
    overlap_volume_cbm: float
    shared_z_interval: bool
    has_surface_contact: bool
    severity: str = Field(description="INFO, WARNING, ERROR")
    description: str


class DataClassificationItem(BaseModel):
    feature_name: str
    classification: str = Field(description="REFERENCE, OBSERVED, ESTIMATED, SYNTHETIC, PROPOSED, VERIFIED")
    source_description: str
    is_authoritative: bool = False


class AIBuildingAnalysisResponse(BaseModel):
    target_building_code: str
    building_name: str
    parent_parcel_ulpin: str
    footprint_source: str
    elevation_source: str
    footprint_area_sqm: float
    ground_elevation_m: float
    roof_elevation_m: float
    building_height_m: float
    floor_count_observed: Optional[int] = None
    floor_count_estimated: int
    floor_count_basis: str
    method: str = "EXPLAINABLE_SPATIAL_FEATURE_ESTIMATOR_HYBRID"
    model_version: str = "2.9.1-explainable-prototype"
    data_classifications: List[DataClassificationItem]
    proposals: List[AICandidateProposal]
    underground_safety_assessment: Dict[str, Any]
    review_flags: List[str]
    disclaimer: str = (
        "AI-assisted candidate proposals are algorithmic hypotheses derived from spatial evidence. "
        "All candidate strata are initialized strictly in PROPOSED status and are NOT authoritative or legally binding. "
        "SFCGAL geometric validation and statutory verification by an authorized human surveyor are mandatory."
    )
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)


class BuildingEvidenceResponse(BaseModel):
    building_id: uuid.UUID
    building_code: str
    building_name: str
    parcel_id: uuid.UUID
    parcel_ulpin_2d: str
    source_name: str
    reference_type: str
    source_id: str
    source_dataset: str
    elevation_source: str
    geometry_status: str
    model_status: str
    validation_status: str
    verification_status: str
    footprint_area_sqm: float
    ground_elevation_m: float
    roof_elevation_m: float
    total_height_m: float
    total_storeys: int
    total_units: int
    evidence_items: List[EvidenceDetailItem] = []
    underground_evidence_note: Optional[str] = None
    disclaimer: str = "Research prototype evidence and provenance records."
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)





