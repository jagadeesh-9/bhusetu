"""
API router for Phase 2.5 Multi-Source 3D Candidate Unit Integration.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.services.candidate_integration_service import CandidateIntegrationService
from backend.app.schemas.candidate_integration import (
    CandidateIntegrationRequest,
    CandidateIntegrationResponse
)

router = APIRouter(prefix="/candidates", tags=["Candidate Units"])


@router.post("/integrate", response_model=CandidateIntegrationResponse, status_code=status.HTTP_200_OK)
def integrate_candidate_units(
    req: CandidateIntegrationRequest,
    db: Session = Depends(get_db)
):
    """
    Integrates analytical 3D candidate units (LiDAR, BIM, CAD, GNSS) into the database:
    - Validates 3D solid geometry (closure, solidness, volume, parcel containment)
    - Performs idempotent deduplication against existing units
    - Creates new units in PROPOSED status with atomic sequence numbers
    - Attaches lineage to source_evidence and logs AUTO_INGESTION audit entry
    """
    service = CandidateIntegrationService(db)
    return service.integrate_candidates(req)
