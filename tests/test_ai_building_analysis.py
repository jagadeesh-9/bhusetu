"""
SIH26011: Evidence-Driven 3D Property Mapping & AI-Assisted Vertical Mapping Test Suite
Validates:
1. AI building feature analysis generates explainable candidate strata hypotheses.
2. Distinguishes OBSERVED metadata from ESTIMATED elevation-derived storeys.
3. Classifies data explicitly: REFERENCE, OBSERVED, ESTIMATED, SYNTHETIC, PROPOSED.
4. Initializes all AI candidate strata strictly in PROPOSED status.
5. Flags optical LiDAR subsurface proposals (underground safety invariant).
6. Building evidence endpoint exposes full provenance chain and validation status.
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.ai_candidate_service import AICandidateService
from backend.app.schemas.requests import AIBuildingAnalysisRequest

client = TestClient(app)


def test_01_ai_building_analysis_with_levels_metadata():
    """Validates that when levels metadata is provided, it is classified as OBSERVED."""
    req = AIBuildingAnalysisRequest(
        candidate_osm_id="356027047",
        ground_elevation_m=540.0,
        elev_max_m=561.5,
        levels_metadata=5,
        standard_floor_height_m=3.0,
        include_basement_hypothesis=True,
        include_rooftop_hypothesis=True
    )
    service = AICandidateService()
    res = service.propose_candidates_from_building_features(req)

    assert res.floor_count_observed == 5
    assert res.floor_count_estimated == 5
    assert res.floor_count_basis == "METADATA_OBSERVED"
    assert res.ground_elevation_m == 540.0
    assert res.roof_elevation_m == 561.5

    # Check classifications
    class_map = {c.feature_name: c for c in res.data_classifications}
    assert class_map["2D Building Footprint"].classification == "REFERENCE"
    assert class_map["Ground Elevation Datum (MSL)"].classification == "REFERENCE"
    assert class_map["Building Storey Count"].classification == "OBSERVED"
    assert class_map["Subterranean Basement Boundary"].classification == "SYNTHETIC"
    assert class_map["Proposed 3D Vertical Property Units"].classification == "PROPOSED"

    # Verify all proposals are PROPOSED
    for p in res.proposals:
        assert p.status == "PROPOSED"
        assert p.confidence in ("HIGH", "MEDIUM", "LOW")
        assert p.confidence_label == "PROTOTYPE_CANDIDATE_CONFIDENCE"
        assert p.geom_wkt is not None
        assert p.geom_wkt.startswith("POLYHEDRALSURFACE Z")


def test_02_ai_building_analysis_estimated_from_elevation():
    """Validates that when levels metadata is absent, floor count is classified as ESTIMATED."""
    req = AIBuildingAnalysisRequest(
        building_name="Tower C Elevation Model",
        footprint_wgs84=[
            [78.376, 17.448],
            [78.378, 17.448],
            [78.378, 17.450],
            [78.376, 17.450],
            [78.376, 17.448]
        ],
        ground_elevation_m=550.0,
        elev_max_m=568.0,  # 18m height delta -> 6 floors at 3.0m
        levels_metadata=None,
        standard_floor_height_m=3.0,
        include_basement_hypothesis=False,
        include_rooftop_hypothesis=True
    )
    service = AICandidateService()
    res = service.propose_candidates_from_building_features(req)

    assert res.floor_count_observed is None
    assert res.floor_count_estimated == 6
    assert res.floor_count_basis == "ELEVATION_ESTIMATED"
    assert res.building_height_m == 18.0

    class_map = {c.feature_name: c for c in res.data_classifications}
    assert class_map["Building Storey Count"].classification == "ESTIMATED"


def test_03_underground_safety_lidar_penalty():
    """Validates that subterranean basement proposals derived from optical LiDAR are flagged and penalized."""
    req = AIBuildingAnalysisRequest(
        candidate_osm_id="way/999111",
        ground_elevation_m=540.0,
        elev_max_m=552.0,
        source_evidence_type="LIDAR_POINTCLOUD",
        include_basement_hypothesis=True
    )
    service = AICandidateService()
    res = service.propose_candidates_from_building_features(req)

    assert res.underground_safety_assessment["is_safe"] is False
    assert "FLAG_REJECT_UNDERGROUND_LIDAR" in res.review_flags
    basement_prop = next(p for p in res.proposals if p.floor_code == "B01")
    assert basement_prop.confidence == "LOW"
    assert any("cannot detect underground" in exp.lower() for exp in basement_prop.explanation)


def test_04_api_endpoint_analyze_building():
    """Validates POST /api/ai/candidates/analyze-building HTTP endpoint."""
    payload = {
        "candidate_osm_id": "356027047",
        "ground_elevation_m": 540.0,
        "elev_max_m": 561.5,
        "levels_metadata": 5,
        "standard_floor_height_m": 3.0,
        "include_basement_hypothesis": True,
        "include_rooftop_hypothesis": True
    }
    response = client.post("/api/ai/candidates/analyze-building", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["target_building_code"] == "BLDG-OSM-356027047"
    assert data["floor_count_observed"] == 5
    assert len(data["proposals"]) >= 5
    assert all(p["status"] == "PROPOSED" for p in data["proposals"])


def test_05_building_evidence_provenance_endpoint():
    """Validates GET /api/buildings/{building_id}/evidence endpoint."""
    # Lookup existing Surya Heights building
    bldgs_res = client.get("/api/buildings/reference-candidates?latitude=17.45&longitude=78.37&limit=5")
    assert bldgs_res.status_code == 200
    candidates = bldgs_res.json()
    assert len(candidates) > 0

    # Get a real registered building from parcels
    parcels_res = client.get("/api/parcels")
    assert parcels_res.status_code == 200
    parcels = parcels_res.json()
    surya_parcel = next((p for p in parcels if p["ulpin_2d"] == "36A1B2C3D4E5F9"), parcels[0])

    bldg_list_res = client.get(f"/api/parcels/{surya_parcel['id']}/buildings")
    assert bldg_list_res.status_code == 200
    buildings = bldg_list_res.json()
    assert len(buildings) > 0
    bldg_id = buildings[0]["id"]

    ev_res = client.get(f"/api/buildings/{bldg_id}/evidence")
    assert ev_res.status_code == 200
    ev_data = ev_res.json()

    assert ev_data["building_id"] == bldg_id
    assert "source_name" in ev_data
    assert "reference_type" in ev_data
    assert "elevation_source" in ev_data
    assert "geometry_status" in ev_data
    assert "validation_status" in ev_data
    assert "verification_status" in ev_data
    assert ev_data["ground_elevation_m"] > 0
    assert ev_data["total_storeys"] >= 0


def test_06_ai_building_analysis_accepts_osm_id_string_as_building_id():
    """Validates that POST /api/ai/candidates/analyze-building accepts string OSM ID in building_id field without 422 error."""
    payload = {
        "building_id": "356020013",
        "building_name": "Pamidi Towers",
        "ground_elevation_m": 575.23,
        "levels_metadata": 6,
        "include_basement_hypothesis": True,
        "include_rooftop_hypothesis": True
    }
    response = client.post("/api/ai/candidates/analyze-building", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["target_building_code"] == "BLDG-OSM-356020013"
    assert data["floor_count_observed"] == 6
    assert data["floor_count_estimated"] == 6
    assert len(data["proposals"]) >= 6
    assert all(p["status"] == "PROPOSED" for p in data["proposals"])

