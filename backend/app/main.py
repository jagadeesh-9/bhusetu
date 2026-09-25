"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
FastAPI Main Application Entry Point
"""
import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.config import settings
from backend.app.routers import (
    health_router,
    parcels_router,
    buildings_router,
    vertical_units_router,
    ingestion_router,
    candidates_router,
    ai_candidates_router,
    topology_router,
    geometry_router,
    ai_reconstruction_router,
    drone_survey_router
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sih26011_backend")

app = FastAPI(
    title="SIH26011 — 3D ULPIN & Vertical Property Mapping API",
    description=(
        "Research prototype backend REST API exposing 3D cadastral land parcels, "
        "structural building footprints, 3D PolyhedralSurface vertical strata (EPSG:32644), "
        "and data ingestion validation."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Sanitizes unhandled exceptions to prevent database credentials from leaking."""
    logger.error(f"Unhandled server error on {request.url.path}: {repr(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred while processing the spatial query."}
    )


# Include API Routers under /api
app.include_router(health_router, prefix="/api")
app.include_router(parcels_router, prefix="/api")
app.include_router(buildings_router, prefix="/api")
app.include_router(vertical_units_router, prefix="/api")
app.include_router(ingestion_router, prefix="/api")
app.include_router(candidates_router, prefix="/api")
app.include_router(ai_candidates_router, prefix="/api")
app.include_router(topology_router, prefix="/api")
app.include_router(geometry_router, prefix="/api")
app.include_router(ai_reconstruction_router, prefix="/api")
app.include_router(drone_survey_router, prefix="/api")



@app.get("/")
def root():
    return {
        "system": "SIH26011 3D ULPIN Research Prototype",
        "status": "online",
        "docs_url": "/docs",
        "health_url": "/api/health"
    }
