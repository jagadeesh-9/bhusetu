"""
Health check and database diagnostics endpoint.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.services.spatial_service import SpatialService
from backend.app.schemas.responses import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
def get_health(db: Session = Depends(get_db)):
    """Returns database and PostGIS/SFCGAL health status without exposing credentials."""
    service = SpatialService(db)
    return service.get_health()
