from backend.app.routers.health import router as health_router
from backend.app.routers.parcels import router as parcels_router
from backend.app.routers.buildings import router as buildings_router
from backend.app.routers.vertical_units import router as vertical_units_router
from backend.app.routers.ingestion import router as ingestion_router
from backend.app.routers.candidates import router as candidates_router
from backend.app.routers.ai_candidates import router as ai_candidates_router
from backend.app.routers.topology import router as topology_router
from backend.app.routers.geometry import router as geometry_router
from backend.app.routers.ai_reconstruction import router as ai_reconstruction_router
from backend.app.routers.drone_survey import router as drone_survey_router

__all__ = [
    "health_router",
    "parcels_router",
    "buildings_router",
    "vertical_units_router",
    "ingestion_router",
    "candidates_router",
    "ai_candidates_router",
    "topology_router",
    "geometry_router",
    "ai_reconstruction_router",
    "drone_survey_router"
]

