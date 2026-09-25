"""
SIH26011 Phase 5: Drone Survey / Survey Data Router.
Provides REST API endpoint for drone survey evidence ingestion, quality check auditing,
and seamless handoff payload generation for AI Image -> 3D reconstruction.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.schemas.drone_survey import (
    DroneSurveyAnalysisRequest,
    DroneSurveyAnalysisResponse
)
from backend.app.services.drone_survey_service import DroneSurveyService

router = APIRouter(prefix="/survey/drone", tags=["Drone Survey"])


@router.post(
    "/analyze",
    response_model=DroneSurveyAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze drone survey imagery and prepare 3D cadastral handoff"
)
def analyze_drone_survey(
    req: DroneSurveyAnalysisRequest,
    db: Session = Depends(get_db)
):
    """
    Analyzes uploaded drone survey photographs and mission metadata:
    - Verifies image integrity and multi-view availability
    - Runs an 8-point evidence and quality checklist
    - Correlates with parent parcel and Copernicus DEM ground datum
    - Formulates transparent data provenance attribution
    - Constructs downstream handoff payload for POST /api/ai/building/reconstruct
    """
    service = DroneSurveyService(db)
    return service.analyze_drone_survey(req)
