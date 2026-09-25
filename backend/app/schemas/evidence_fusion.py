"""
Pydantic schemas for Phase 3.5: Multi-Source Evidence Fusion & Confidence Assessment.
Defines decomposable confidence dimensions, source capabilities, agreement comparisons,
and conflict detection items.
"""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict


# Authoritative Categorical Dimension Levels
EvidenceDimensionLevel = Literal["HIGH", "MEDIUM", "LOW", "UNKNOWN"]
SourcePresenceLevel = Literal["NONE", "LIMITED", "ADEQUATE", "MULTI_SOURCE"]
AgreementStatus = Literal["AGREEMENT", "MINOR_DISCREPANCY", "CONFLICT", "NOT_COMPARABLE"]
ConflictSeverity = Literal["ERROR", "WARNING", "INFO"]
ConflictCode = Literal[
    "HEIGHT_CONFLICT",
    "FOOTPRINT_CONFLICT",
    "Z_RANGE_CONFLICT",
    "CRS_UNCERTAIN",
    "PROVENANCE_INCOMPLETE",
    "UNDERGROUND_EVIDENCE_MISSING",
    "TOPOLOGY_CONFLICT",
    "UNSUPPORTED_SOURCE_CLAIM"
]


class SourceCapabilityProfile(BaseModel):
    """Defines what analytical claims a specific spatial evidence source can support."""
    source_type: str
    sensor_category: str
    supports_geometry: bool
    supports_height: bool
    supports_vertical_extent: bool
    supports_crs: bool
    supports_underground: bool
    supports_provenance: bool
    notes: str


class EvaluatedSourceRecord(BaseModel):
    """Evaluated evidence source record with provenance and capability ratings."""
    id: uuid.UUID
    source_type: str
    dataset_name: str
    file_uri: str
    accuracy_horizontal_m: Optional[float] = None
    accuracy_vertical_m: Optional[float] = None
    sensor_category: str
    crs: str = "EPSG:32644"
    sha256_hash: Optional[str] = None
    provenance_quality: EvidenceDimensionLevel
    supported_claims: List[str]
    unsupported_claims: List[str]
    is_synthetic: bool = True
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgreementComparisonItem(BaseModel):
    """Pairwise measurement comparison between two compatible spatial sources."""
    measurement_name: str
    source_a_type: str
    source_a_val: float
    source_b_type: str
    source_b_val: float
    difference: float
    tolerance: float
    unit_of_measure: str = "m"
    status: AgreementStatus
    notes: str


class ConflictNoticeItem(BaseModel):
    """Structured conflict or warning requiring human reviewer attention."""
    code: ConflictCode
    severity: ConflictSeverity
    affected_attribute: str
    source_a: str
    source_b: Optional[str] = None
    measured_values: Optional[Dict[str, Any]] = None
    configured_tolerance: Optional[str] = None
    recommendation: str


class EvidenceDimensionBreakdown(BaseModel):
    """Decomposable, transparent evidence assessment dimensions."""
    source_presence: SourcePresenceLevel = Field(..., description="Coverage: NONE, LIMITED (1), ADEQUATE (2), MULTI_SOURCE (3+)")
    source_presence_reason: str

    provenance_quality: EvidenceDimensionLevel = Field(..., description="Quality of lineage, explicit CRS, SHA-256 fingerprint, and accuracy metrics")
    provenance_quality_reason: str

    geometry_support: EvidenceDimensionLevel = Field(..., description="Extent to which sources support footprint, solid volume, and boundary")
    geometry_support_reason: str

    vertical_support: EvidenceDimensionLevel = Field(..., description="Extent to which sources support height and elevation bounds")
    vertical_support_reason: str

    source_agreement: EvidenceDimensionLevel = Field(..., description="Pairwise agreement between compatible spatial measurements")
    source_agreement_reason: str

    evidence_completeness: EvidenceDimensionLevel = Field(..., description="Whether required evidence attributes are present without omissions")
    evidence_completeness_reason: str

    underground_safety: EvidenceDimensionLevel = Field(..., description="Assessment of subsurface evidence validity (rejects optical LiDAR for underground)")
    underground_safety_reason: str


class UnitEvidenceFusionResponse(BaseModel):
    """Comprehensive, explainable multi-source evidence fusion dossier for a 3D unit."""
    unit_id: uuid.UUID
    prototype_ulpin_3d: str
    status: str
    floor_code: str
    tier_code: str
    is_underground: bool
    overall_confidence: EvidenceDimensionLevel = Field(..., description="Explainable confidence classification: HIGH, MEDIUM, LOW, UNKNOWN")
    overall_confidence_label: str
    assessment_method: Literal["RULE_BASED_EXPLAINABLE_EVIDENCE_FUSION"] = "RULE_BASED_EXPLAINABLE_EVIDENCE_FUSION"
    dimensions: EvidenceDimensionBreakdown
    sources: List[EvaluatedSourceRecord]
    comparisons: List[AgreementComparisonItem]
    conflicts: List[ConflictNoticeItem]
    reviewer_attention: List[str]
    topology_summary: Optional[Dict[str, Any]] = None
    underground_warnings: List[str]
    disclaimer: str = (
        "Prototype evidence assessment and explainable multi-source fusion. "
        "Evidence confidence indicates the strength and consistency of available prototype evidence. "
        "It does not indicate legal ownership, statutory cadastral certification, or official validity. "
        "Human verification in the Review Workspace is strictly required."
    )
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)
