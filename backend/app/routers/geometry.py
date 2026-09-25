"""
FastAPI Router for Phase 3.4 Real-World 3D Geometry Processing & Reconstruction.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.schemas.geometry_reconstruction import (
    PointcloudExtractionRequest,
    PointcloudExtractionResponse,
    MultiLevelReconstructionRequest,
    MultiLevelReconstructionResponse
)
from backend.app.services.geometry_reconstruction_service import GeometryReconstructionService

router = APIRouter(prefix="/geometry", tags=["3D Geometry Processing & Reconstruction"])


@router.post(
    "/extract-pointcloud",
    response_model=PointcloudExtractionResponse,
    summary="Extracts building footprint, elevation, and storeys from point cloud",
    description=(
        "Processes an ASPRS LAS/LAZ point cloud with statistical noise filtering, "
        "concave/convex hull footprint estimation, and vertical point density profiling."
    )
)
def extract_pointcloud(
    req: PointcloudExtractionRequest,
    db: Session = Depends(get_db)
):
    service = GeometryReconstructionService(db)
    return service.extract_pointcloud_geometry(req)


@router.post(
    "/reconstruct-multilevel",
    response_model=MultiLevelReconstructionResponse,
    summary="Reconstructs multi-level 3D PolyhedralSurface solids with varying footprints",
    description=(
        "Extrudes per-level 2D polygon footprints into watertight 3D PolyhedralSurface Z solids, "
        "validates them using PostGIS / SFCGAL, and optionally routes candidates in PROPOSED status."
    )
)
def reconstruct_multilevel(
    req: MultiLevelReconstructionRequest,
    db: Session = Depends(get_db)
):
    service = GeometryReconstructionService(db)
    return service.reconstruct_multilevel_building(req)


@router.post(
    "/validate-solid",
    summary="Validates 3D PolyhedralSurface WKT geometry with PostGIS and SFCGAL",
    description="Evaluates watertightness (ST_IsClosed), 2-manifold solid validity (CG_IsSolid), volume, and parcel containment."
)
def validate_solid(
    payload: dict,
    db: Session = Depends(get_db)
):
    wkt = payload.get("wkt")
    parcel_ulpin = payload.get("parcel_ulpin_2d")
    if not wkt:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload must include 'wkt' string."
        )
    service = GeometryReconstructionService(db)
    try:
        res = service.validate_solid_with_postgis_sfcgal(wkt, parcel_ulpin)
        return {"status": "SUCCESS", "validation": res}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Geometry validation failed: {str(e)}"
        )
