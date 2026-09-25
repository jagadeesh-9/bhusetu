"""
SIH26011 Phase 3.12A: Buildings and 3D Prototype Generation Endpoints.
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Path, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.models.entities import Building
from backend.app.schemas.responses import BuildingResponse, VerticalUnitResponse, BuildingEvidenceResponse
from backend.app.schemas.building_generation import (
    BuildingPrototypeGenerationRequest,
    BuildingPrototypeGenerationResponse
)
from backend.app.services.building_generation_service import BuildingGenerationService
from backend.app.services.spatial_service import SpatialService
from backend.app.services.reference_dataset_service import ReferenceDatasetService

router = APIRouter(prefix="/buildings", tags=["Buildings & 3D Generation"])


@router.get("", response_model=List[BuildingResponse])
def get_all_buildings(
    db: Session = Depends(get_db)
):
    """Retrieves all registered buildings across all parcels."""
    spatial_service = SpatialService(db)
    return spatial_service.get_all_buildings()


@router.get("/reference-candidates")
def get_reference_building_candidates(
    latitude: float,
    longitude: float,
    radius_m: float = 1000.0,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    Discovers real reference Hyderabad buildings near the specified coordinates.
    Prioritizes real reference footprints and Copernicus DSM elevations from local dataset.
    """
    service = ReferenceDatasetService()
    return service.search_nearby(
        latitude=latitude,
        longitude=longitude,
        radius_m=radius_m,
        limit=limit,
        db=db
    )


@router.get("/{building_id}", response_model=BuildingResponse)
def get_building(
    building_id: uuid.UUID = Path(..., description="Unique UUID of the building"),
    db: Session = Depends(get_db)
):
    """Retrieves structural building details, 2D footprint, and 3D envelope."""
    bldg = db.query(Building).filter(Building.id == building_id).first()
    if not bldg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Building not found: {building_id}")
    
    spatial_service = SpatialService(db)
    return spatial_service.get_building_by_id(building_id)


@router.get("/{building_id}/evidence", response_model=BuildingEvidenceResponse)
def get_building_evidence(
    building_id: uuid.UUID = Path(..., description="Unique UUID of the building"),
    db: Session = Depends(get_db)
):
    """Retrieves consolidated building-level evidence, provenance, and validation lifecycle."""
    spatial_service = SpatialService(db)
    return spatial_service.get_building_evidence(building_id)



@router.post("/generate-3d-prototype", response_model=BuildingPrototypeGenerationResponse, status_code=status.HTTP_201_CREATED)
def generate_building_3d_prototype(
    req: BuildingPrototypeGenerationRequest,
    db: Session = Depends(get_db)
):
    """
    Phase 3.12A: Automated Building-Level 3D ULPIN Generation Pipeline.
    Transforms a reference building footprint into:
    - Watertight 3D Building Envelope solid
    - Multi-tier vertical storey decomposition (B01, F00, F01...F0n, RF01)
    - Flat subdivisions (Flats 101-104 + Common Core)
    - Concurrency-safe Prototype 3D ULPIN generation ({PARCEL}-3D-{TIER}-{SEQ})
    - PostGIS/SFCGAL 3D topology validation
    - Initial PROPOSED lifecycle state & synthetic provenance lineage
    """
    if not req.is_synthetic_prototype:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Controlled research prototype pipeline requires is_synthetic_prototype=True."
        )

    service = BuildingGenerationService(db)
    return service.generate_building_3d_cadastre(req)


@router.post("/{building_id}/generate-3d-prototype", response_model=BuildingPrototypeGenerationResponse, status_code=status.HTTP_201_CREATED)
def generate_building_3d_prototype_by_id(
    building_id: uuid.UUID = Path(..., description="Unique UUID of the registered building"),
    req: Optional[BuildingPrototypeGenerationRequest] = None,
    db: Session = Depends(get_db)
):
    """Convenience endpoint to trigger prototype generation directly for a known building ID."""
    if req is None:
        req = BuildingPrototypeGenerationRequest(building_id=building_id, is_synthetic_prototype=True)
    else:
        req.building_id = building_id

    if not req.is_synthetic_prototype:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Controlled research prototype pipeline requires is_synthetic_prototype=True."
        )

    service = BuildingGenerationService(db)
    return service.generate_building_3d_cadastre(req)
