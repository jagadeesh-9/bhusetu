"""
Data Ingestion, CRS normalization, source standardization, and geometry preparation endpoints.
"""
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.services.ingestion_service import IngestionService
from backend.app.schemas.ingestion import (
    IngestionValidationRequest,
    IngestionValidationResponse,
    SourceRegistrationRequest,
    SourceRegistrationResponse,
    SourceManifestItem
)

router = APIRouter(prefix="/ingestion", tags=["Data Ingestion & Preparation"])


@router.post("/validate", response_model=IngestionValidationResponse, status_code=status.HTTP_200_OK)
def validate_ingestion_data(
    req: IngestionValidationRequest,
    db: Session = Depends(get_db)
):
    """
    Validates and standardizes incoming spatial evidence across formats (LAS/LAZ, GeoJSON, WKT, BIM/IFC, CAD/DXF, Raster DEM):
    - Normalizes coordinates to canonical EPSG:32644.
    - Evaluates 3D PolyhedralSurface topological closure, 2-manifold solidity, and positive volume.
    - Validates 2D parcel polygons and calculates planar area.
    - Generates SHA-256 source fingerprint used for provenance and reproducibility, along with granular quality flags.
    - Returns normalized source manifest.
    """
    service = IngestionService(db)
    return service.validate_ingestion_data(req)


@router.post("/sources", response_model=SourceRegistrationResponse, status_code=status.HTTP_200_OK)
def register_ingestion_source(
    req: SourceRegistrationRequest,
    db: Session = Depends(get_db)
):
    """
    Registers a spatial evidence source and optionally triggers candidate proposals:
    - Validates source structure, explicit CRS, and content integrity.
    - Creates SHA-256 fingerprint record for provenance and duplicate detection.
    - Enforces Underground Safety (Optical LiDAR alone is forbidden for subterranean units).
    - If candidates are generated, they are created strictly in PROPOSED status.
    """
    service = IngestionService(db)
    return service.register_source_and_candidates(req)


@router.get("/sources/{source_id}", response_model=SourceManifestItem, status_code=status.HTTP_200_OK)
def get_ingestion_source_manifest(
    source_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieves normalized source manifest and quality metadata for a registered evidence UUID.
    """
    service = IngestionService(db)
    manifest = service.get_source_by_id(source_id)
    if not manifest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ingestion source '{source_id}' not found."
        )
    return manifest
