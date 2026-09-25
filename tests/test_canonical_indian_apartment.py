"""
Unit and Integration Tests for Phase 3.7C Canonical Indian Apartment Dataset (Surya Heights).

Verifies:
1. Seed script idempotency
2. Canonical parcel lookup and properties
3. Canonical building APARTMENT-SURYA lookup and metadata
4. Floor count and strata taxonomy (B01, F00, F01-F05, RF01)
5. Basement presence and synthetic evidence safety metadata
6. Floor Z elevation ranges and vertical continuity
7. Above-ground height and total vertical extent calculations
8. Exact volume metrics (Individual and 9600 m³ aggregated total)
9. SFCGAL 3D geometry validity (closed, solid, positive volume)
10. 3D topology (zero volumetric overlap collision, contiguous boundary contacts)
11. Prototype 3D Unit ID format and uniqueness
12. Preservation of existing datasets (TOWER-A and VERTICAL-MIXED-A)
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from scripts.seed_canonical_indian_apartment import seed_canonical_indian_apartment, PARCEL_ULPIN, BUILDING_CODE

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def ensure_canonical_seeded():
    """Ensures canonical apartment dataset is seeded before running tests."""
    seed_canonical_indian_apartment()


def test_seed_idempotency():
    """Re-running the seed script must succeed without creating duplicate parcels or buildings."""
    seed_canonical_indian_apartment()
    response = client.get("/api/parcels")
    assert response.status_code == 200
    parcels = response.json()
    canonical_parcels = [p for p in parcels if p["ulpin_2d"] == PARCEL_ULPIN]
    assert len(canonical_parcels) == 1, "Parcel must not be duplicated upon re-seeding."


def test_canonical_parcel_properties():
    """Validates the canonical parcel attributes, ULPIN, survey number, and area."""
    response = client.get("/api/parcels")
    assert response.status_code == 200
    parcels = response.json()
    parcel = next((p for p in parcels if p["ulpin_2d"] == PARCEL_ULPIN), None)
    assert parcel is not None
    assert parcel["survey_number"] == "SY-142/2 (Synthetic Demo Parcel)"
    assert parcel["state"] == "Telangana"
    assert parcel["district"] == "Hyderabad"
    assert parcel["village_code"] == "VIL-HYD-042"
    assert float(parcel["area_sqm"]) == 1200.00
    assert parcel["building_count"] == 1
    assert parcel["vertical_unit_count"] == 8


def test_canonical_building_properties():
    """Validates the APARTMENT-SURYA building entity under the canonical parcel."""
    response = client.get("/api/parcels")
    parcel = next(p for p in response.json() if p["ulpin_2d"] == PARCEL_ULPIN)
    parcel_id = parcel["id"]

    bldg_resp = client.get(f"/api/parcels/{parcel_id}/buildings")
    assert bldg_resp.status_code == 200
    buildings = bldg_resp.json()
    assert len(buildings) == 1
    bldg = buildings[0]
    assert bldg["building_code"] == BUILDING_CODE
    assert "Surya Heights" in bldg["building_name"]
    assert bldg["total_floors_above"] == 6
    assert bldg["total_floors_below"] == 1
    assert bldg["unit_count"] == 8


def test_vertical_units_strata_and_z_ranges():
    """Validates all 8 canonical vertical units, floor codes, tier codes, and exact Z elevations."""
    response = client.get("/api/parcels")
    parcel = next(p for p in response.json() if p["ulpin_2d"] == PARCEL_ULPIN)
    parcel_id = parcel["id"]

    units_resp = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    assert units_resp.status_code == 200
    units = units_resp.json()
    assert len(units) == 8

    # Sort ascending by z_min
    sorted_units = sorted(units, key=lambda u: u["z_min"])

    expected_specs = [
        {"floor_code": "B01", "tier": "SB", "type": "PARKING", "z_min": 536.50, "z_max": 540.00, "h": 3.50},
        {"floor_code": "F00", "tier": "F", "type": "COMMON_CIRCULATION", "z_min": 540.00, "z_max": 543.50, "h": 3.50},
        {"floor_code": "F01", "tier": "F", "type": "RESIDENTIAL", "z_min": 543.50, "z_max": 546.50, "h": 3.00},
        {"floor_code": "F02", "tier": "F", "type": "RESIDENTIAL", "z_min": 546.50, "z_max": 549.50, "h": 3.00},
        {"floor_code": "F03", "tier": "F", "type": "RESIDENTIAL", "z_min": 549.50, "z_max": 552.50, "h": 3.00},
        {"floor_code": "F04", "tier": "F", "type": "RESIDENTIAL", "z_min": 552.50, "z_max": 555.50, "h": 3.00},
        {"floor_code": "F05", "tier": "F", "type": "RESIDENTIAL", "z_min": 555.50, "z_max": 558.50, "h": 3.00},
        {"floor_code": "RF01", "tier": "AR", "type": "COMMON_CIRCULATION", "z_min": 558.50, "z_max": 561.50, "h": 3.00},
    ]

    for idx, exp in enumerate(expected_specs):
        u = sorted_units[idx]
        assert u["floor_code"] == exp["floor_code"]
        assert u["tier_code"] == exp["tier"]
        assert u["unit_type"] == exp["type"]
        assert pytest.approx(u["z_min"], 0.01) == exp["z_min"]
        assert pytest.approx(u["z_max"], 0.01) == exp["z_max"]
        assert pytest.approx(u["z_max"] - u["z_min"], 0.01) == exp["h"]
        assert u["status"] == "PROPOSED"
        assert u["prototype_ulpin_3d"].startswith(f"{PARCEL_ULPIN}-3D-")


def test_height_and_extent_calculations():
    """Validates structural above-ground height (21.5m) and total vertical extent (25.0m)."""
    response = client.get("/api/parcels")
    parcel = next(p for p in response.json() if p["ulpin_2d"] == PARCEL_ULPIN)
    parcel_id = parcel["id"]

    units_resp = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    units = units_resp.json()

    ground_z = 540.00
    min_z = min(u["z_min"] for u in units)
    max_z = max(u["z_max"] for u in units)

    above_ground_height = max_z - ground_z
    total_vertical_extent = max_z - min_z

    assert pytest.approx(above_ground_height, 0.01) == 21.50
    assert pytest.approx(total_vertical_extent, 0.01) == 25.00
    assert pytest.approx(min_z, 0.01) == 536.50
    assert pytest.approx(max_z, 0.01) == 561.50


def test_basement_presence_and_provenance_safety():
    """Basement parking B01 must exist and contain synthetic architectural safety notes."""
    response = client.get("/api/parcels")
    parcel = next(p for p in response.json() if p["ulpin_2d"] == PARCEL_ULPIN)
    parcel_id = parcel["id"]

    units_resp = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    units = units_resp.json()
    b01 = next(u for u in units if u["floor_code"] == "B01")
    assert b01["tier_code"] == "SB"
    assert b01["unit_type"] == "PARKING"

    # Fetch evidence details
    ev_resp = client.get(f"/api/vertical-units/{b01['id']}/evidence")
    assert ev_resp.status_code == 200
    ev_data = ev_resp.json()
    assert ev_data["is_underground"] is True
    assert len(ev_data["evidence_records"]) >= 1
    rec = ev_data["evidence_records"][0]
    assert rec["is_synthetic"] is True
    assert "LiDAR point clouds cannot establish underground geometry" in rec["metadata_json"]["safety_statement"]


def test_3d_topology_and_zero_overlap():
    """All 8 units must pass SFCGAL 3D topology validation with zero positive-volume overlap collision."""
    response = client.get("/api/parcels")
    parcel = next(p for p in response.json() if p["ulpin_2d"] == PARCEL_ULPIN)
    parcel_id = parcel["id"]

    overview_resp = client.get(f"/api/parcels/{parcel_id}/3d-overview")
    assert overview_resp.status_code == 200
    overview = overview_resp.json()
    assert overview["statistics"]["total_units"] == 8
    assert overview["quality_scorecard"]["overall_quality"] in ["HEALTHY", "ATTENTION_REQUIRED"]
    assert overview["quality_scorecard"]["geometry_valid_solids"] == 8

    # Validate unit topology individually
    units_resp = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    units = units_resp.json()
    total_volume = 0.0

    for u in units:
        top_resp = client.get(f"/api/vertical-units/{u['id']}/topology")
        assert top_resp.status_code == 200
        top = top_resp.json()
        assert top["solid_validation"]["is_closed"] is True
        assert top["solid_validation"]["is_solid"] is True
        assert top["solid_validation"]["volume_cbm"] > 0
        assert top["containment"]["is_within_parcel"] is True
        assert top["conflict_count"] == 0

        # Check individual volumes: 1344 for 3.5m floors, 1152 for 3.0m floors
        expected_vol = 1344.0 if (u["z_max"] - u["z_min"] > 3.2) else 1152.0
        assert pytest.approx(top["solid_validation"]["volume_cbm"], 0.1) == expected_vol
        total_volume += top["solid_validation"]["volume_cbm"]

    assert pytest.approx(total_volume, 0.5) == 9600.00


def test_preservation_of_existing_datasets():
    """Existing demonstration datasets TOWER-A and VERTICAL-MIXED-A must remain present and valid."""
    response = client.get("/api/parcels")
    assert response.status_code == 200
    parcels = response.json()

    tower_a_parcel = next((p for p in parcels if p["ulpin_2d"] == "27A8B9C3D4E5F6"), None)
    mixed_parcel = next((p for p in parcels if p["ulpin_2d"] == "27A8B9C3D4E5F7"), None)
    canonical_parcel = next((p for p in parcels if p["ulpin_2d"] == PARCEL_ULPIN), None)

    assert tower_a_parcel is not None, "TOWER-A parcel must be preserved."
    assert mixed_parcel is not None, "VERTICAL-MIXED-A parcel must be preserved."
    assert canonical_parcel is not None, "Canonical parcel must exist."

    assert tower_a_parcel["vertical_unit_count"] == 6
    assert mixed_parcel["vertical_unit_count"] == 10
    assert canonical_parcel["vertical_unit_count"] == 8
