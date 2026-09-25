"""
Parcels and related structural entities endpoints.
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Path, Query, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.services.spatial_service import SpatialService
from backend.app.services.dataset_service import DatasetService
from backend.app.schemas.responses import (
    ParcelResponse,
    BuildingResponse,
    VerticalUnitResponse,
    VerticalStructureResponse,
    Parcel3DOverviewResponse
)

router = APIRouter(prefix="/parcels", tags=["Parcels"])


@router.get("", response_model=List[ParcelResponse])
def list_parcels(db: Session = Depends(get_db)):
    """Retrieves all parent land parcels with 2D geometries and child entity counts."""
    service = SpatialService(db)
    return service.get_parcels()


@router.get("/by-ulpin/{ulpin}", response_model=ParcelResponse)
def get_parcel_by_ulpin(
    ulpin: str = Path(..., description="14-character 2D ULPIN string"),
    db: Session = Depends(get_db)
):
    """Retrieves parcel details and 2D footprint by 14-character ULPIN."""
    service = SpatialService(db)
    return service.get_parcel_by_ulpin(ulpin)


@router.get("/{parcel_id}", response_model=ParcelResponse)
def get_parcel(
    parcel_id: uuid.UUID = Path(..., description="Unique UUID of the parcel"),
    db: Session = Depends(get_db)
):
    """Retrieves detailed information and 2D footprint for a single parcel."""
    service = SpatialService(db)
    return service.get_parcel(parcel_id)


@router.get("/{parcel_id}/buildings", response_model=List[BuildingResponse])
def get_parcel_buildings(
    parcel_id: uuid.UUID = Path(..., description="Unique UUID of the parcel"),
    db: Session = Depends(get_db)
):
    """Retrieves all buildings situated on the specified parcel."""
    service = SpatialService(db)
    return service.get_buildings_for_parcel(parcel_id)


@router.get("/{parcel_id}/vertical-units", response_model=List[VerticalUnitResponse])
def get_parcel_vertical_units(
    parcel_id: uuid.UUID = Path(..., description="Unique UUID of the parcel"),
    tier: Optional[str] = Query(None, description="Filter by tier code (e.g., F, SB, UT, AR, AE, CM)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by lifecycle status (PROPOSED, UNDER_REVIEW, VERIFIED, REJECTED)"),
    floor: Optional[str] = Query(None, description="Filter by floor code (e.g., F00, F01, B01)"),
    search: Optional[str] = Query(None, description="Search term for unit ID, label, floor, or classification"),
    unit_level: Optional[str] = Query(None, description="Filter by unit level (e.g., STOREY, FLAT)"),
    include_subunits: bool = Query(False, description="Include flat-level sub-units in parcel listing"),
    db: Session = Depends(get_db)
):
    """
    Retrieves all 3D vertical units, Z-brackets, and evidence associated with the parcel.
    Supports multi-attribute spatial and attribute filtering (tier, status, floor, search, unit_level).
    """
    dataset_service = DatasetService(db)
    try:
        return dataset_service.filter_parcel_units(
            parcel_id=parcel_id,
            tier=tier,
            status=status_filter,
            floor=floor,
            search=search,
            unit_level=unit_level,
            include_subunits=include_subunits
        )
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{parcel_id}/vertical-structure", response_model=VerticalStructureResponse)
def get_parcel_vertical_structure(
    parcel_id: uuid.UUID = Path(..., description="Unique UUID of the parcel"),
    db: Session = Depends(get_db)
):
    """Retrieves multi-tier vertical property decomposition grouped by taxonomy category."""
    service = SpatialService(db)
    return service.get_parcel_vertical_structure(parcel_id)


@router.get("/{parcel_id}/3d-overview", response_model=Parcel3DOverviewResponse)
def get_parcel_3d_overview(
    parcel_id: uuid.UUID = Path(..., description="Unique UUID of the parcel to overview"),
    db: Session = Depends(get_db)
):
    """
    Phase 3.2: Aggregates a complete 3D Cadastral Dataset Overview for a parcel:
    Child buildings, vertical units, dataset statistics, transparent quality scorecard,
    and 12-point dataset consistency audit.
    """
    service = DatasetService(db)
    try:
        return service.get_parcel_3d_overview(parcel_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
