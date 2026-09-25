"""
Vertical Units lookup, generation, 3D spatial validation, and lifecycle transition endpoints.
"""
import uuid
from typing import List
from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.services.spatial_service import SpatialService
from backend.app.services.ai_candidate_service import AICandidateService
from backend.app.schemas.responses import (
    VerticalUnitResponse,
    ValidationResponse,
    UnitEvidenceProvenanceResponse,
    AICandidateAnalysisResponse,
    UnitReviewCaseResponse,
    UnitNeighborItem
)
from backend.app.schemas.evidence_fusion import UnitEvidenceFusionResponse
from backend.app.schemas.dossier import PrototypeTechnicalReviewDossier
from backend.app.schemas.requests import VerticalUnitCreateRequest, VerticalUnitTransitionRequest


router = APIRouter(prefix="/vertical-units", tags=["Vertical Units"])


@router.post("", response_model=VerticalUnitResponse, status_code=status.HTTP_201_CREATED)
def create_vertical_unit(
    req: VerticalUnitCreateRequest,
    db: Session = Depends(get_db)
):
    """
    Generates a new prototype 3D ULPIN and persists the 3D vertical unit in initial PROPOSED state.
    Allocates an atomic, concurrency-safe unit sequence.
    """
    service = SpatialService(db)
    return service.create_vertical_unit(req)


@router.get("/{unit_id}", response_model=VerticalUnitResponse)
def get_vertical_unit(
    unit_id: uuid.UUID = Path(..., description="Unique UUID of the vertical unit"),
    db: Session = Depends(get_db)
):
    """Retrieves full 3D canonical geometry, provenance, and audit trail for a single vertical unit."""
    service = SpatialService(db)
    return service.get_vertical_unit(unit_id)


@router.get("/{unit_id}/sub-units", response_model=List[VerticalUnitResponse])
def get_vertical_sub_units(
    unit_id: uuid.UUID = Path(..., description="Unique UUID of the parent vertical unit"),
    db: Session = Depends(get_db)
):
    """Retrieves all child sub-units (individual flats/circulation) under the specified parent floor."""
    service = SpatialService(db)
    return service.get_sub_units_for_unit(unit_id)


@router.get("/{unit_id}/validation", response_model=ValidationResponse)
def validate_vertical_unit(
    unit_id: uuid.UUID = Path(..., description="Unique UUID of the vertical unit to validate"),
    db: Session = Depends(get_db)
):
    """
    Executes 3D spatial validation checks on the vertical unit:
    evaluates solid closure, positive volume, Z-elevation consistency, parent parcel
    containment, and detects true volumetric overlap vs shared boundary surfaces.
    """
    service = SpatialService(db)
    return service.validate_vertical_unit(unit_id)


@router.get("/{unit_id}/evidence", response_model=UnitEvidenceProvenanceResponse)
def get_vertical_unit_evidence(
    unit_id: uuid.UUID = Path(..., description="Unique UUID of the vertical unit to inspect evidence and provenance"),
    db: Session = Depends(get_db)
):
    """
    Retrieves multi-source evidence intelligence, spatial accuracy metrics, dataset provenance,
    and step-by-step reconstruction lineage for the vertical unit.
    """
    service = SpatialService(db)
    return service.get_unit_evidence_provenance(unit_id)


@router.get("/{unit_id}/ai-analysis", response_model=AICandidateAnalysisResponse)
def get_vertical_unit_ai_analysis(
    unit_id: uuid.UUID = Path(..., description="Unique UUID of the vertical unit to inspect explainable AI feature intelligence"),
    db: Session = Depends(get_db)
):
    """
    Retrieves explainable AI feature representations, candidate hypotheses, prototype confidence,
    and rationale for the vertical unit.
    """
    service = AICandidateService(db)
    try:
        return service.analyze_vertical_unit(unit_id)
    except LookupError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{unit_id}/review", response_model=UnitReviewCaseResponse)
def get_vertical_unit_review_case(
    unit_id: uuid.UUID = Path(..., description="Unique UUID of the vertical unit to review"),
    db: Session = Depends(get_db)
):
    """
    Retrieves a unified 3D property review dossier aggregating geometry, topology QC,
    evidence provenance, AI candidate features, review readiness, and audit history.
    """
    from backend.app.services.review_service import ReviewService
    from fastapi import HTTPException
    service = ReviewService(db)
    try:
        return service.get_review_case(unit_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/{unit_id}/transition", response_model=VerticalUnitResponse)
def transition_vertical_unit(
    unit_id: uuid.UUID = Path(..., description="Unique UUID of the vertical unit to transition"),
    req: VerticalUnitTransitionRequest = ...,
    db: Session = Depends(get_db)
):
    """
    Executes an audited state machine transition for a vertical unit:
    Enforces human-in-the-loop verification constraint (SYSTEM_VALIDATOR cannot verify).
    """
    service = SpatialService(db)
    return service.transition_vertical_unit(unit_id, req)


@router.get("/{unit_id}/neighbors", response_model=List[UnitNeighborItem])
def get_vertical_unit_neighbors(
    unit_id: uuid.UUID = Path(..., description="Unique UUID of the vertical unit to inspect adjoining/intersecting neighbors"),
    db: Session = Depends(get_db)
):
    """
    Phase 3.2: Retrieves all adjoining or intersecting peer vertical units with
    relationship type, volumetric overlap, and contact interface semantics.
    """
    from backend.app.services.dataset_service import DatasetService
    from fastapi import HTTPException
    service = DatasetService(db)
    try:
        return service.get_unit_neighbors(unit_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{unit_id}/evidence-fusion", response_model=UnitEvidenceFusionResponse)
def get_vertical_unit_evidence_fusion(
    unit_id: uuid.UUID = Path(..., description="Unique UUID of the vertical unit to evaluate multi-source evidence fusion"),
    db: Session = Depends(get_db)
):
    """
    Phase 3.5: Evaluates multi-source evidence records, cross-source measurement agreements,
    geometric/provenance conflicts, subterranean safety, and returns decomposable, explainable
    confidence dimensions.
    """
    from backend.app.services.evidence_fusion_service import EvidenceFusionService
    from fastapi import HTTPException
    service = EvidenceFusionService(db)
    try:
        return service.fuse_unit_evidence(unit_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{unit_id}/dossier", response_model=PrototypeTechnicalReviewDossier)
def get_vertical_unit_dossier(
    unit_id: uuid.UUID = Path(..., description="Unique UUID of the vertical unit to generate technical review dossier"),
    db: Session = Depends(get_db)
):
    """
    Phase 3.6D: Consolidates and returns an explainable, read-only Technical Review Dossier
    for the selected 3D vertical unit, aggregating identity, modeled geometry, taxonomy,
    lifecycle, source evidence metadata, fusion findings, topology QC, AI advisory context,
    prototype audit history, and research limitations.
    """
    from backend.app.services.dossier_service import DossierService
    from fastapi import HTTPException
    service = DossierService(db)
    try:
        return service.generate_dossier(unit_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

