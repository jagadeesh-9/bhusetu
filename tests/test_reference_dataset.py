"""
Tests for SIH26011 Real Reference Hyderabad Dataset Service and Discovery Endpoint.
Verifies discovery of real buildings near HITECH City (17.447400, 78.376200),
accurate coordinate representation, and elevation enrichment.
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.reference_dataset_service import ReferenceDatasetService


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def ref_service():
    return ReferenceDatasetService()


def test_01_reference_dataset_service_loads_data(ref_service):
    count = ref_service.get_building_count()
    assert count >= 352, f"Expected at least 352 reference buildings, got {count}"


def test_02_hitec_city_discovery_finds_nearby_buildings(ref_service):
    # HITECH City test coordinate
    lat, lon = 17.447400, 78.376200
    candidates = ref_service.search_nearby(lat, lon, radius_m=500.0, limit=10)
    assert len(candidates) >= 5, f"Expected at least 5 candidates within 500m, got {len(candidates)}"
    
    nearest = candidates[0]
    assert nearest["distanceMeters"] < 100.0, f"Expected nearest building < 100m, got {nearest['distanceMeters']}m"
    assert nearest["source"] == "REAL_REFERENCE"
    assert nearest["isReferenceBuilding"] is True

    # Verify presence of known landmark buildings
    names = [c["name"] for c in candidates]
    osm_ids = [c["osmId"] for c in candidates]
    assert any("Nexiilabs" in n or "Deloitte" in n or "89918145" in oid for n, oid in zip(names, osm_ids))


def test_03_footprint_geometry_is_valid_wgs84(ref_service):
    lat, lon = 17.447400, 78.376200
    candidates = ref_service.search_nearby(lat, lon, radius_m=500.0, limit=5)
    for c in candidates:
        coords = c["footprintCoordinates"]
        assert len(coords) >= 3, "Polygon footprint must have at least 3 vertices"
        for pt in coords:
            assert len(pt) == 2, "Coordinate pair must be [lon, lat]"
            # WGS84 bounds for Hyderabad region
            assert 78.0 <= pt[0] <= 79.0, f"Longitude out of bounds: {pt[0]}"
            assert 17.0 <= pt[1] <= 18.0, f"Latitude out of bounds: {pt[1]}"


def test_04_elevation_enriched_building_attributes(ref_service):
    # Check Pamidi Towers (OSM 356020013)
    bldg = ref_service.get_by_osm_id("356020013")
    assert bldg is not None, "Expected Pamidi Towers (OSM 356020013) in reference dataset"
    assert bldg["name"] == "Pamidi Towers"
    assert bldg["levels"] == 6
    assert abs(bldg["groundElevationM"] - 575.23) < 0.5
    assert "Copernicus" in bldg["zSource"]


def test_05_api_reference_candidates_endpoint(client):
    response = client.get(
        "/api/buildings/reference-candidates",
        params={"latitude": 17.447400, "longitude": 78.376200, "radius_m": 500.0, "limit": 5}
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 5
    assert data[0]["source"] == "REAL_REFERENCE"
    assert "footprintCoordinates" in data[0]
    assert "groundElevationM" in data[0]
