"""
SIH26011 Phase 2: AI-Assisted Building Image -> 3D Reconstruction Router.
Provides REST API endpoint for multi-view / single-view photographic building reconstruction.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.schemas.ai_image_reconstruction import (
    BuildingImageReconstructionRequest,
    BuildingImageReconstructionResponse
)
from backend.app.services.image_reconstruction_service import ImageReconstructionService

router = APIRouter(prefix="/ai/building", tags=["AI Building Reconstruction"])


@router.post(
    "/reconstruct",
    response_model=BuildingImageReconstructionResponse,
    status_code=status.HTTP_200_OK,
    summary="AI-assisted / explainable spatial estimation 3D building reconstruction"
)
def reconstruct_building_from_image(
    req: BuildingImageReconstructionRequest,
    db: Session = Depends(get_db)
):
    """
    Executes AI-assisted / explainable spatial estimation 3D building reconstruction from uploaded building imagery.
    
    Accepts:
    - One or multiple building views (Front, Side, Top, Perspective)
    - Optional parent parcel ID or geodetic coordinate anchors
    - Optional prior parameters (floor height, basement expectation)
    
    Returns:
    - Estimated physical dimensions, height, and storey counts
    - Watertight Z-enabled PolyhedralSurface prototype geometry (B-Rep-like volumetric prototype)
    - Transparent provenance categorization (OBSERVED, ESTIMATED, REFERENCE, PROPOSED)
    - Direct pipeline integration payload for building generation and vertical strata decomposition
    - Lifecycle status strictly PROPOSED, requiring authorized human verification
    """
    service = ImageReconstructionService(db)
    try:
        return service.reconstruct_building_from_images(req)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Building image reconstruction error: {str(e)}"
        )
