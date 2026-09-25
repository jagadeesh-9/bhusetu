"""
SIH26011 Phase 3.12A: Tests for Building-Level 3D ULPIN Generation Pipeline.
Verifies building envelope reconstruction, vertical decomposition, individual flat subdivision,
concurrency-safe Prototype 3D ULPIN generation, SFCGAL watertight geometry validation,
topology checking, provenance, and lifecycle state management.
"""
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models.entities import Building, Parcel, VerticalUnit
from backend.app.schemas.building_generation import BuildingPrototypeGenerationRequest
from backend.app.services.building_generation_service import BuildingGenerationService

client = TestClient(app)


def test_01_building_prototype_generation_from_candidate_footprint():
    """
    Test generating a complete 3D Cadastral Prototype from an OSM Candidate Footprint.
    """
    db = SessionLocal()
    try:
        service = BuildingGenerationService(db)
        
        # 2D Bounding Footprint in Hyderabad (WGS84)
        footprint_wgs84 = [
            [78.4321, 17.4682],
            [78.4323, 17.4682],
            [78.4323, 17.4684],
            [78.4321, 17.4684],
            [78.4321, 17.4682]
        ]

        req = BuildingPrototypeGenerationRequest(
            candidate_osm_id="way/982341201",
            footprint_wgs84=footprint_wgs84,
            building_name="Moosapet Residency Prototype",
            total_floors_above=3,
            total_floors_below=1,
            ground_elevation_m=540.0,
            floor_height_m=3.0,
            basement_depth_m=3.5,
            include_rooftop=True,
            subdivide_residential_floors=True,
            is_synthetic_prototype=True
        )

        resp = service.generate_building_3d_cadastre(req)

        assert resp.status == "SUCCESS"
        assert resp.building_code.startswith("BLDG-OSM-")
        assert resp.footprint_area_sqm > 0
        assert resp.envelope_volume_cum > 0
        assert resp.total_storeys_generated == 5  # B01, F00, F01, F02, RF01
        assert resp.total_flats_generated == 8    # 4 flats on F01, 4 flats on F02
        assert resp.total_common_units_generated == 2 # 1 core on F01, 1 core on F02
        assert resp.total_units_generated == 15
        assert resp.topology_valid is True
        assert resp.overlap_count == 0
        assert resp.lifecycle_state == "PROPOSED"
    finally:
        db.close()


def test_02_concurrency_safe_prototype_ulpin_format():
    """
    Verifies that all generated 3D spatial units receive unique, correctly formatted Prototype 3D ULPINs.
    """
    db = SessionLocal()
    try:
        service = BuildingGenerationService(db)
        
        footprint_wgs84 = [
            [78.4330, 17.4690],
            [78.4332, 17.4690],
            [78.4332, 17.4692],
            [78.4330, 17.4692],
            [78.4330, 17.4690]
        ]

        req = BuildingPrototypeGenerationRequest(
            candidate_osm_id="way/982341202",
            footprint_wgs84=footprint_wgs84,
            building_name="Anjaneya Enclave Prototype",
            total_floors_above=2,
            total_floors_below=0,
            include_rooftop=False,
            subdivide_residential_floors=True,
            is_synthetic_prototype=True
        )

        resp = service.generate_building_3d_cadastre(req)
        
        ulpins = [u.prototype_ulpin_3d for u in resp.generated_units]
        # Check uniqueness
        assert len(ulpins) == len(set(ulpins))

        # Verify storey ULPIN format: {PARCEL}-3D-{TIER}-{SEQ}
        storey_units = [u for u in resp.generated_units if u.unit_level == "STOREY"]
        for s in storey_units:
            parts = s.prototype_ulpin_3d.split("-")
            assert len(parts) >= 4
            assert parts[1] == "3D"
            assert parts[2] in ("F", "SB", "AR")

        # Verify flat ULPIN format: {PARCEL}-3D-F-{SEQ}-U{FLAT} or -CORE
        flat_units = [u for u in resp.generated_units if u.unit_level == "FLAT"]
        for f in flat_units:
            assert f.prototype_ulpin_3d.endswith(f"-U{f.flat_number}")
    finally:
        db.close()


def test_03_watertight_3d_geometry_and_sfcgal_volume():
    """
    Verifies that all generated units possess watertight PolyhedralSurface Z solids with positive volume.
    """
    db = SessionLocal()
    try:
        service = BuildingGenerationService(db)
        
        footprint_wgs84 = [
            [78.4340, 17.4670],
            [78.4342, 17.4670],
            [78.4342, 17.4672],
            [78.4340, 17.4672],
            [78.4340, 17.4670]
        ]

        req = BuildingPrototypeGenerationRequest(
            candidate_osm_id="way/982341299",
            footprint_wgs84=footprint_wgs84,
            building_name="Solidness Test Building",
            total_floors_above=2,
            total_floors_below=1,
            is_synthetic_prototype=True
        )
        resp = service.generate_building_3d_cadastre(req)
        assert resp.status == "SUCCESS"

        units_data = db.execute(
            text("""
                SELECT prototype_ulpin_3d, unit_level, z_min, z_max,
                       ST_3DArea(geom_3d) as area_3d,
                       ST_Volume(ST_MakeSolid(geom_3d)) as volume,
                       ST_GeometryType(geom_3d) as geom_type
                FROM vertical_units
                WHERE building_id = :bldg_id
            """),
            {"bldg_id": str(resp.building_id)}
        ).fetchall()

        assert len(units_data) > 0
        for row in units_data:
            assert row.area_3d > 0.0
            assert row.volume > 0.0
            assert row.z_min < row.z_max
            assert "POLYHEDRALSURFACE" in row.geom_type.upper()
    finally:
        db.close()


def test_04_provenance_and_lifecycle_state_is_proposed():
    """
    Verifies that every generated unit has source evidence with is_synthetic=True and begins in PROPOSED state.
    """
    db = SessionLocal()
    try:
        bldg = db.query(Building).filter(Building.building_code.like("BLDG-OSM-%")).first()
        assert bldg is not None

        units_with_evidence = db.execute(
            text("""
                SELECT u.id, u.status, e.source_type, e.metadata_json
                FROM vertical_units u
                JOIN source_evidence e ON u.id = e.unit_id
                WHERE u.building_id = :bldg_id
            """),
            {"bldg_id": str(bldg.id)}
        ).fetchall()

        assert len(units_with_evidence) > 0
        for row in units_with_evidence:
            assert row.status == "PROPOSED"
            assert row.metadata_json.get("is_synthetic") is True
            assert row.metadata_json.get("prototype_only") is True
    finally:
        db.close()


def test_05_preservation_of_existing_surya_heights_demo():
    """
    Verifies that existing APARTMENT-SURYA-OSM and its 8 storeys + F01 flats remain completely intact.
    """
    db = SessionLocal()
    try:
        surya_bldg = db.query(Building).filter(Building.building_code == "APARTMENT-SURYA-OSM").first()
        assert surya_bldg is not None

        surya_units = db.execute(
            text("SELECT COUNT(*) FROM vertical_units WHERE building_id = :id"),
            {"id": str(surya_bldg.id)}
        ).scalar()

        # 8 Storeys + 5 F01 Sub-units = 13 units
        assert surya_units == 13
    finally:
        db.close()


def test_06_rest_api_generate_3d_prototype_endpoint():
    """
    Tests POST /api/buildings/generate-3d-prototype REST endpoint.
    """
    payload = {
        "candidate_osm_id": "way/982341203",
        "footprint_wgs84": [
            [78.4350, 17.4650],
            [78.4352, 17.4650],
            [78.4352, 17.4652],
            [78.4350, 17.4652],
            [78.4350, 17.4650]
        ],
        "building_name": "API Test Tower Prototype",
        "total_floors_above": 3,
        "total_floors_below": 1,
        "ground_elevation_m": 540.0,
        "floor_height_m": 3.0,
        "include_rooftop": True,
        "subdivide_residential_floors": True,
        "is_synthetic_prototype": True
    }

    response = client.post("/api/buildings/generate-3d-prototype", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["total_units_generated"] == 15
    assert data["topology_valid"] is True
    assert data["lifecycle_state"] == "PROPOSED"
    assert "Synthetic Research Prototype" in data["disclaimer"]


def test_07_rest_api_rejects_non_prototype_requests():
    """
    Ensures that requests without is_synthetic_prototype=True are rejected with 400 Bad Request.
    """
    payload = {
        "candidate_osm_id": "way/982341204",
        "footprint_wgs84": [
            [78.4350, 17.4650],
            [78.4352, 17.4650],
            [78.4352, 17.4652],
            [78.4350, 17.4652],
            [78.4350, 17.4650]
        ],
        "is_synthetic_prototype": False
    }

    response = client.post("/api/buildings/generate-3d-prototype", json=payload)
    assert response.status_code == 400
    assert "is_synthetic_prototype=True" in response.json()["detail"]


def test_08_canonical_surya_heights_is_locked_from_regeneration():
    """
    Verifies that attempting to regenerate canonical APARTMENT-SURYA-OSM is rejected.
    """
    db = SessionLocal()
    try:
        surya_bldg = db.query(Building).filter(Building.building_code == "APARTMENT-SURYA-OSM").first()
        assert surya_bldg is not None

        service = BuildingGenerationService(db)
        req = BuildingPrototypeGenerationRequest(
            building_id=surya_bldg.id,
            building_code="APARTMENT-SURYA-OSM",
            is_synthetic_prototype=True
        )

        with pytest.raises(Exception) as exc_info:
            service.generate_building_3d_cadastre(req)
        
        assert "locked and cannot be regenerated" in str(exc_info.value)
    finally:
        db.close()


def test_09_generate_by_building_id_endpoint():
    """
    Tests POST /api/buildings/{building_id}/generate-3d-prototype endpoint.
    """
    db = SessionLocal()
    try:
        bldg = db.query(Building).filter(Building.building_code.like("BLDG-OSM-%")).first()
        assert bldg is not None

        response = client.post(
            f"/api/buildings/{bldg.id}/generate-3d-prototype",
            json={"is_synthetic_prototype": True, "total_floors_above": 2}
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "SUCCESS"
        assert data["building_id"] == str(bldg.id)
    finally:
        db.close()

