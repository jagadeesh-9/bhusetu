"""
3D Topology, Conflict Detection & Spatial Quality-Control API endpoints.
"""
import uuid
from fastapi import APIRouter, Depends, Path, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.services.topology_service import TopologyService
from backend.app.schemas.responses import (
    ParcelTopologyReportResponse,
    UnitTopologyReportResponse
)

router = APIRouter(tags=["3D Topology & Conflict Engine"])


@router.get("/parcels/{parcel_id}/topology", response_model=ParcelTopologyReportResponse)
def get_parcel_topology(
    parcel_id: uuid.UUID = Path(..., description="Unique UUID of the parcel to audit topology"),
    db: Session = Depends(get_db)
):
    """
    Executes a comprehensive 3D topology and quality-control audit across all vertical units on a parcel:
    Evaluates solid validity, pairwise 3D collisions (>0.001 m³), zero-volume boundary contacts,
    vertical continuity/gaps, duplicate spaces, and parcel containment.
    """
    service = TopologyService(db)
    try:
        return service.audit_parcel_topology(parcel_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Topology audit error: {str(e)}"
        )


@router.get("/vertical-units/{unit_id}/topology", response_model=UnitTopologyReportResponse)
def get_unit_topology(
    unit_id: uuid.UUID = Path(..., description="Unique UUID of the vertical unit to inspect 3D spatial quality"),
    db: Session = Depends(get_db)
):
    """
    Executes a focused 3D spatial quality and neighbor relationship audit for a single vertical unit.
    """
    service = TopologyService(db)
    try:
        return service.audit_unit_topology(unit_id)
    except LookupError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unit topology audit error: {str(e)}"
        )
