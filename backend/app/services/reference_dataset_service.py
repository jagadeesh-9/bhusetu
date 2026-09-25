"""
SIH26011: Real Reference Hyderabad Dataset Service.
Loads and indexes real Hyderabad reference geospatial buildings (including 352 Copernicus DSM
elevation-enriched buildings and landmark HITEC City buildings) to power deterministic, high-speed
local building discovery and 3D cadastral reconstruction.
"""
import os
import json
import math
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

logger = logging.getLogger("sih26011_backend")

# Path to the compiled canonical reference dataset
DATASET_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "real", "hyderabad", "processed", "canonical_reference_buildings.json")
)


def compute_ulpin_for_osm_id(osm_id: str) -> str:
    """
    Canonical, single-source-of-truth ULPIN derivation from an OSM way/relation ID.
    Algorithm must exactly match _resolve_target_building in BuildingGenerationService.
    State prefix: '36' (Telangana). 12 alphanumeric chars from OSM ID, padded with MD5 if shorter.
    """
    import hashlib as _hashlib
    clean = osm_id.replace("way/", "").replace("relation/", "").replace("/", "-")
    clean_alnum = "".join(c for c in clean if c.isalnum()).upper()
    if len(clean_alnum) >= 12:
        return f"36{clean_alnum[:12]}"
    hash_pad = _hashlib.md5(clean.encode()).hexdigest().upper()
    return (f"36{clean_alnum}{hash_pad}")[:14]


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates haversine distance in meters between two lat/lon coordinates."""
    R = 6371000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2) + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * (math.sin(dlon / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


class ReferenceDatasetService:
    _instance = None
    _buildings: List[Dict[str, Any]] = []
    _osm_map: Dict[str, Dict[str, Any]] = {}
    _ulpin_map: Dict[str, Dict[str, Any]] = {}
    _is_loaded: bool = False

    def __init__(self):
        self._ensure_loaded()

    @classmethod
    def _ensure_loaded(cls):
        if cls._is_loaded and cls._buildings:
            return

        if not os.path.exists(DATASET_PATH):
            logger.warning(f"[ReferenceDatasetService] Canonical reference dataset not found at: {DATASET_PATH}")
            cls._buildings = []
            cls._osm_map = {}
            cls._is_loaded = True
            return

        try:
            with open(DATASET_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            cls._buildings = data if isinstance(data, list) else []
            cls._osm_map = {str(b.get("osmId")): b for b in cls._buildings if b.get("osmId")}
            # Build ULPIN reverse-lookup index using the canonical derivation algorithm
            cls._ulpin_map = {
                compute_ulpin_for_osm_id(str(b.get("osmId", ""))): b
                for b in cls._buildings if b.get("osmId")
            }
            cls._is_loaded = True
            logger.info(f"[ReferenceDatasetService] Loaded {len(cls._buildings)} real Hyderabad reference buildings from {DATASET_PATH}")
        except Exception as e:
            logger.error(f"[ReferenceDatasetService] Failed to load reference dataset: {e}")
            cls._buildings = []
            cls._osm_map = {}
            cls._ulpin_map = {}
            cls._is_loaded = True

    def get_building_count(self) -> int:
        return len(self._buildings)

    def get_by_osm_id(self, osm_id: str) -> Optional[Dict[str, Any]]:
        clean_id = str(osm_id).replace("way/", "").replace("relation/", "").replace("node/", "")
        return self._osm_map.get(clean_id)

    def get_by_ulpin(self, ulpin: str) -> Optional[Dict[str, Any]]:
        """
        Reverse-lookup: given a 14-character project ULPIN, return the matching
        reference building record (or None if this ULPIN is not in the dataset).
        """
        return self._ulpin_map.get(ulpin.strip().upper())

    def search_nearby(
        self,
        latitude: float,
        longitude: float,
        radius_m: float = 1000.0,
        limit: int = 10,
        db: Optional[Session] = None
    ) -> List[Dict[str, Any]]:
        """
        Discovers real reference buildings near the given coordinates within radius_m.
        Results are sorted by distance ascending.
        If a database session is provided, marks modelAvailable=True if 3D prototype already exists.
        """
        if not self._buildings:
            return []

        results = []
        for b in self._buildings:
            c = b.get("centroid", {})
            c_lat = c.get("latitude")
            c_lon = c.get("longitude")
            if c_lat is None or c_lon is None:
                continue

            dist = haversine_distance_m(latitude, longitude, c_lat, c_lon)
            if dist <= radius_m:
                results.append((dist, b))

        results.sort(key=lambda x: x[0])
        top_matches = results[:limit]

        candidates = []
        for dist, b in top_matches:
            osm_id = str(b.get("osmId", ""))
            clean_alnum = "".join(c for c in osm_id if c.isalnum()).upper()
            bldg_code = f"BLDG-OSM-{clean_alnum}"
            
            model_available = False
            parcel_id = None

            # Check if building already generated in local database
            if db:
                try:
                    from backend.app.models.entities import Building
                    existing = db.query(Building).filter(Building.building_code == bldg_code).first()
                    if existing:
                        model_available = True
                        parcel_id = str(existing.parcel_id)
                except Exception as e:
                    logger.debug(f"[ReferenceDatasetService] DB lookup error: {e}")

            candidate = {
                "id": b.get("id", f"real-ref-{osm_id}"),
                "osmId": osm_id,
                "osmType": b.get("osmType", "way"),
                "source": "REAL_REFERENCE",
                "name": b.get("name") or f"Building {osm_id}",
                "buildingType": b.get("buildingType", "commercial"),
                "levels": b.get("levels"),
                "floorCount": b.get("floorCount"),
                "groundElevationM": b.get("groundElevationM"),
                "elevMinM": b.get("elevMinM"),
                "elevMeanM": b.get("elevMeanM"),
                "elevMaxM": b.get("elevMaxM"),
                "zSource": b.get("zSource", "Copernicus_GLO30_DSM"),
                "centroid": {
                    "latitude": b["centroid"]["latitude"],
                    "longitude": b["centroid"]["longitude"]
                },
                "footprintCoordinates": b.get("footprintCoordinates", []),
                "approxAreaSqm": b.get("approxAreaSqm", 0),
                "distanceMeters": round(dist, 1),
                "modelAvailable": model_available,
                "buildingCode": bldg_code if model_available else None,
                "parcelId": parcel_id,
                "isDirectMatch": dist <= 50.0,
                "proximityTier": "EXACT_OR_VERY_NEAR" if dist <= 50.0 else "NEARBY",
                "isReferenceBuilding": True,
                "attribution": b.get("attribution", "© OpenStreetMap contributors | Real Hyderabad Reference Dataset"),
                "tags": {
                    "source": "REAL_REFERENCE",
                    "ground_z": str(b.get("groundElevationM", "")),
                    "z_source": str(b.get("zSource", "")),
                    "levels": str(b.get("levels", ""))
                }
            }
            candidates.append(candidate)

        return candidates
