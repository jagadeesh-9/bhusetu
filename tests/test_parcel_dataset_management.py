"""
SIH26011: Phase 3.2 Test Suite
3D Cadastral Dataset Management & Spatial Navigation Tests
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models.entities import Parcel, Building, VerticalUnit
from backend.app.services.dataset_service import DatasetService

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


def test_01_parcel_3d_overview_endpoint_tower_a(db_session):
    """Validates that GET /api/parcels/{id}/3d-overview returns complete dataset hierarchy for TOWER-A."""
    p = db_session.query(Parcel).filter(Parcel.ulpin_2d == "27A8B9C3D4E5F6").first()
    assert p is not None

    res = client.get(f"/api/parcels/{p.id}/3d-overview")
    assert res.status_code == 200
    data = res.json()

    # Parcel metadata
    assert data["parcel_id"] == str(p.id)
    assert data["parcel_ulpin_2d"] == "27A8B9C3D4E5F6"
    assert data["crs"] == "EPSG:32644"
    assert data["area_sqm"] > 0

    # Buildings & Units
    assert len(data["buildings"]) == 1
    assert data["buildings"][0]["building_code"] == "TOWER-A"
    assert len(data["units"]) == 6

    # Statistics
    stats = data["statistics"]
    assert stats["total_units"] == 6
    assert stats["total_buildings"] == 1
    assert stats["status_counts"]["VERIFIED"] == 3
    assert stats["status_counts"]["UNDER_REVIEW"] == 1
    assert stats["status_counts"]["PROPOSED"] == 1
    assert stats["status_counts"]["REJECTED"] == 1
    assert stats["total_modeled_volume_cbm"] > 0

    # Quality Scorecard & Consistency
    scorecard = data["quality_scorecard"]
    assert scorecard["geometry_total"] == 6
    assert len(scorecard["scorecard_items"]) >= 4

    findings = data["consistency_findings"]
    assert len(findings) == 12
    check_ids = [f["check_id"] for f in findings]
    assert "ORPHAN_UNITS_CHECK" in check_ids
    assert "INVALID_Z_RANGE_CHECK" in check_ids
    assert "DUPLICATE_ID_CHECK" in check_ids
    assert "SRID_CONSISTENCY_CHECK" in check_ids


def test_02_parcel_3d_overview_endpoint_vertical_mixed_a(db_session):
    """Validates that GET /api/parcels/{id}/3d-overview returns complete dataset hierarchy for VERTICAL-MIXED-A."""
    p = db_session.query(Parcel).filter(Parcel.ulpin_2d == "27A8B9C3D4E5F7").first()
    assert p is not None

    res = client.get(f"/api/parcels/{p.id}/3d-overview")
    assert res.status_code == 200
    data = res.json()

    assert data["parcel_ulpin_2d"] == "27A8B9C3D4E5F7"
    assert len(data["buildings"]) == 1
    assert data["buildings"][0]["building_code"] == "MIXED-TOWER-A"
    assert len(data["units"]) == 10

    stats = data["statistics"]
    assert stats["total_units"] == 10
    assert stats["taxonomy_counts"]["UNDERGROUND"] == 3
    assert stats["taxonomy_counts"]["GROUND"] == 2
    assert stats["taxonomy_counts"]["UPPER_FLOORS"] == 2
    assert stats["taxonomy_counts"]["ROOFTOP_ELEVATED"] == 2
    assert stats["taxonomy_counts"]["COMMON"] == 1


def test_03_dataset_statistics_aggregation_accuracy(db_session):
    """Validates accurate calculation of volume and taxonomy counts."""
    service = DatasetService(db_session)
    p = db_session.query(Parcel).first()
    overview = service.get_parcel_3d_overview(p.id)

    # Total volume equals sum of individual unit volumes
    sum_unit_vols = sum(u.volume_cbm for u in overview.units)
    assert abs(overview.statistics.total_modeled_volume_cbm - sum_unit_vols) < 0.1

    # Total units equals sum of status counts
    assert sum(overview.statistics.status_counts.values()) == overview.statistics.total_units


def test_04_quality_scorecard_evaluation(db_session):
    """Validates the transparent counts on the 3D dataset quality scorecard."""
    service = DatasetService(db_session)
    p = db_session.query(Parcel).filter(Parcel.ulpin_2d == "27A8B9C3D4E5F6").first()
    overview = service.get_parcel_3d_overview(p.id)

    sc = overview.quality_scorecard
    assert sc.geometry_valid_solids == 6
    assert sc.geometry_total == 6
    assert sc.evidence_supported_units == 6
    assert sc.overall_quality in ["HEALTHY", "ATTENTION_REQUIRED", "CRITICAL_ISSUES"]


def test_05_12_point_consistency_audit_structure(db_session):
    """Validates that all 12 dataset consistency audit checks return structured items."""
    service = DatasetService(db_session)
    p = db_session.query(Parcel).first()
    overview = service.get_parcel_3d_overview(p.id)

    assert len(overview.consistency_findings) == 12
    for finding in overview.consistency_findings:
        assert finding.check_id is not None
        assert finding.check_name is not None
        assert finding.status in ["PASS", "WARNING", "ERROR"]
        assert len(finding.details) > 0


def test_06_srid_consistency_audit(db_session):
    """Validates that all active parcel geometries have SRID 32644."""
    service = DatasetService(db_session)
    p = db_session.query(Parcel).first()
    overview = service.get_parcel_3d_overview(p.id)

    srid_finding = next(f for f in overview.consistency_findings if f.check_id == "SRID_CONSISTENCY_CHECK")
    assert srid_finding.status == "PASS"
    assert len(srid_finding.affected_unit_ids) == 0


def test_07_invalid_z_range_audit(db_session):
    """Validates that all canonical units have Z_max > Z_min."""
    service = DatasetService(db_session)
    p = db_session.query(Parcel).first()
    overview = service.get_parcel_3d_overview(p.id)

    z_finding = next(f for f in overview.consistency_findings if f.check_id == "INVALID_Z_RANGE_CHECK")
    assert z_finding.status == "PASS"


def test_08_duplicate_ulpin_audit(db_session):
    """Validates that prototype 3D Unit IDs are unique within the parcel."""
    service = DatasetService(db_session)
    p = db_session.query(Parcel).first()
    overview = service.get_parcel_3d_overview(p.id)

    dup_finding = next(f for f in overview.consistency_findings if f.check_id == "DUPLICATE_ID_CHECK")
    assert dup_finding.status == "PASS"


def test_09_vertical_units_filtering_by_tier(db_session):
    """Validates GET /api/parcels/{id}/vertical-units?tier=SB."""
    p_mixed = db_session.query(Parcel).filter(Parcel.ulpin_2d == "27A8B9C3D4E5F7").first()
    assert p_mixed is not None

    res = client.get(f"/api/parcels/{p_mixed.id}/vertical-units?tier=SB")
    assert res.status_code == 200
    units = res.json()
    assert len(units) == 2
    for u in units:
        assert u["tier_code"] == "SB"


def test_10_vertical_units_filtering_by_status(db_session):
    """Validates GET /api/parcels/{id}/vertical-units?status=VERIFIED."""
    p = db_session.query(Parcel).filter(Parcel.ulpin_2d == "27A8B9C3D4E5F6").first()
    assert p is not None

    res = client.get(f"/api/parcels/{p.id}/vertical-units?status=VERIFIED")
    assert res.status_code == 200
    units = res.json()
    assert len(units) == 3
    for u in units:
        assert u["status"] == "VERIFIED"


def test_11_vertical_units_filtering_by_floor(db_session):
    """Validates GET /api/parcels/{id}/vertical-units?floor=F01."""
    p = db_session.query(Parcel).filter(Parcel.ulpin_2d == "27A8B9C3D4E5F6").first()
    assert p is not None

    res = client.get(f"/api/parcels/{p.id}/vertical-units?floor=F01")
    assert res.status_code == 200
    units = res.json()
    assert len(units) == 1
    assert units[0]["floor_code"] == "F01"


def test_12_vertical_units_search_query(db_session):
    """Validates GET /api/parcels/{id}/vertical-units?search=commercial."""
    p = db_session.query(Parcel).filter(Parcel.ulpin_2d == "27A8B9C3D4E5F6").first()
    assert p is not None

    res = client.get(f"/api/parcels/{p.id}/vertical-units?search=commercial")
    assert res.status_code == 200
    units = res.json()
    assert len(units) >= 1
    for u in units:
        assert "commercial" in u["unit_type"].lower() or "commercial" in u["unit_label"].lower()


def test_13_unit_neighbors_endpoint(db_session):
    """Validates GET /api/vertical-units/{id}/neighbors returns adjoining/intersecting units."""
    u = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 1).first() # F02
    assert u is not None

    res = client.get(f"/api/vertical-units/{u.id}/neighbors")
    assert res.status_code == 200
    neighbors = res.json()
    assert isinstance(neighbors, list)
    assert len(neighbors) >= 1

    first_n = neighbors[0]
    assert "neighbor_id" in first_n
    assert "neighbor_ulpin_3d" in first_n
    assert "relationship_code" in first_n
    assert first_n["relationship_code"] in ["BOUNDARY_CONTACT", "POSITIVE_VOLUME_OVERLAP", "DISJOINT", "DUPLICATE_SPATIAL_REPRESENTATION"]


def test_14_overview_404_on_nonexistent_parcel():
    """Validates that requesting 3D overview for unknown parcel returns 404."""
    unknown_id = str(uuid.uuid4())
    res = client.get(f"/api/parcels/{unknown_id}/3d-overview")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_15_unit_neighbors_404_on_nonexistent_unit():
    """Validates that requesting neighbors for unknown unit returns 404."""
    unknown_id = str(uuid.uuid4())
    res = client.get(f"/api/vertical-units/{unknown_id}/neighbors")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()
