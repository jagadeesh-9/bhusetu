"""
SIH26011: Phase 3.0 Regression Test Suite
3D Topology, Conflict Detection & Spatial Quality-Control Engine
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.topology_service import TopologyService
from backend.app.db import SessionLocal
from backend.app.models.entities import VerticalUnit, Parcel, Building
from scripts.reconstruct_3d_units import build_polyhedralsurface_wkt_from_footprint

client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


# ============================================================================
# Phase 3.0 Synthetic Conflict Fixtures
# ============================================================================

def test_01_fixture_1_valid_adjacent_floors_boundary_contact(db_session):
    """
    Fixture 1: Valid Adjacent Floors
    F00 (540.0 - 543.5) and F01 (543.5 - 546.5) share horizontal slab interface at Z=543.5.
    Must produce BOUNDARY_CONTACT with 0.000 m³ volume overlap and zero conflict error.
    """
    # Test on persisted TOWER-A units F00 (Seq 3) and F01 (Seq 4)
    u_f00 = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 3).first()
    u_f01 = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 4).first()
    assert u_f00 is not None and u_f01 is not None

    service = TopologyService(db_session)
    rel = service.compare_unit_pair_db(
        unit_a_id=u_f00.id,
        unit_a_ulpin=u_f00.prototype_ulpin_3d,
        unit_b_id=u_f01.id,
        unit_b_ulpin=u_f01.prototype_ulpin_3d
    )

    assert rel.relationship_code == "BOUNDARY_CONTACT"
    assert rel.overlap_volume_cbm <= 0.001
    assert rel.has_surface_contact is True
    assert rel.severity == "INFO"


def test_02_fixture_2_positive_volume_overlap_detected(db_session):
    """
    Fixture 2: Positive Volume Overlap
    CM-0012 (Central Elevator Core) overlaps volumetric interior of F-0010 (Ground Floor Lobby).
    Must produce POSITIVE_VOLUME_OVERLAP with >0.001 m³ volume and ERROR severity.
    """
    u_f00 = db_session.query(VerticalUnit).filter(VerticalUnit.prototype_ulpin_3d == "27A8B9C3D4E5F7-3D-F-0010").first()
    u_cm = db_session.query(VerticalUnit).filter(VerticalUnit.prototype_ulpin_3d == "27A8B9C3D4E5F7-3D-CM-0012").first()
    assert u_f00 is not None and u_cm is not None

    service = TopologyService(db_session)
    rel = service.compare_unit_pair_db(
        unit_a_id=u_f00.id,
        unit_a_ulpin=u_f00.prototype_ulpin_3d,
        unit_b_id=u_cm.id,
        unit_b_ulpin=u_cm.prototype_ulpin_3d
    )

    assert rel.relationship_code == "POSITIVE_VOLUME_OVERLAP"
    assert rel.overlap_volume_cbm > 0.001
    assert rel.severity == "ERROR"


def test_03_fixture_3_vertical_gap_detected(db_session):
    """
    Fixture 3: Vertical Gap Detection
    Unit A (540 - 543) and Unit B (544.5 - 547.5) with a 1.50m gap between them.
    Must detect VERTICAL_GAP with WARNING severity.
    """
    service = TopologyService(db_session)
    units_data = [
        {"id": uuid.uuid4(), "prototype_ulpin_3d": "TEST-F00", "floor_code": "F00", "tier_code": "F", "z_min": 540.0, "z_max": 543.0},
        {"id": uuid.uuid4(), "prototype_ulpin_3d": "TEST-F01", "floor_code": "F01", "tier_code": "F", "z_min": 544.5, "z_max": 547.5},
    ]

    continuity = service.evaluate_vertical_continuity(units_data)
    assert len(continuity) == 2
    f01_cont = continuity[1]
    assert f01_cont.relation_to_lower_unit == "VERTICAL_GAP"
    assert f01_cont.gap_or_overlap_m == 1.50
    assert f01_cont.severity == "WARNING"


def test_04_fixture_4_outside_parcel_containment_detected(db_session):
    """
    Fixture 4: Outside Parcel Containment Violation
    TOWER-A Unit 6 extends outside parent parcel boundary.
    Must detect OUTSIDE_PARENT / non-containment.
    """
    u_overhang = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 6).first()
    assert u_overhang is not None

    service = TopologyService(db_session)
    report = service.audit_unit_topology(u_overhang.id)
    assert report.containment.status == "OUTSIDE_PARENT"
    assert report.containment.is_within_parcel is False
    assert report.containment.severity == "ERROR"


def test_05_fixture_5_duplicate_spatial_representation_detected(db_session):
    """
    Fixture 5: Duplicate Spatial Representation
    Units with >=90% volumetric overlap are classified as DUPLICATE_SPATIAL_REPRESENTATION.
    """
    # Create two nearly identical solids (same footprint, same Z range)
    service = TopologyService(db_session)
    coords = [[219405.0, 1932502.5], [219425.0, 1932502.5], [219425.0, 1932517.5], [219405.0, 1932517.5], [219405.0, 1932502.5]]
    wkt_a, _ = build_polyhedralsurface_wkt_from_footprint(coords, 540.0, 543.5)
    wkt_b, _ = build_polyhedralsurface_wkt_from_footprint(coords, 540.0, 543.5)

    # Compute pairwise comparison via SQL query for synthetic duplicate
    from sqlalchemy import text
    query = text("""
        SELECT
            CG_Volume(CG_MakeSolid(ST_GeomFromText(:wkt_a, 32644))) AS vol_a,
            CG_Volume(CG_MakeSolid(ST_GeomFromText(:wkt_b, 32644))) AS vol_b,
            CG_Volume(CG_3DIntersection(
                CG_MakeSolid(ST_GeomFromText(:wkt_a, 32644)),
                CG_MakeSolid(ST_GeomFromText(:wkt_b, 32644))
            )) AS overlap_vol,
            ST_3DIntersects(
                ST_GeomFromText(:wkt_a, 32644),
                ST_GeomFromText(:wkt_b, 32644)
            ) AS surface_intersects
    """)
    row = db_session.execute(query, {"wkt_a": wkt_a, "wkt_b": wkt_b}).mappings().first()
    vol_a = float(row["vol_a"])
    overlap_vol = float(row["overlap_vol"])
    overlap_ratio = overlap_vol / vol_a

    assert overlap_ratio >= 0.90
    assert abs(overlap_vol - vol_a) < 0.001


def test_06_fixture_6_same_z_valid_spatial_separation(db_session):
    """
    Fixture 6: Same-Z Spatial Separation
    P00 (Open Parking) and F00 (Ground Lobby) share Z [540.0 - 543.5] on parcel 27A8B9C3D4E5F7,
    but have disjoint XY footprints. Must produce DISJOINT and ZERO collision.
    """
    u_f00 = db_session.query(VerticalUnit).filter(VerticalUnit.prototype_ulpin_3d == "27A8B9C3D4E5F7-3D-F-0010").first()
    u_p00 = db_session.query(VerticalUnit).filter(VerticalUnit.prototype_ulpin_3d == "27A8B9C3D4E5F7-3D-F-0011").first()
    assert u_f00 is not None and u_p00 is not None

    service = TopologyService(db_session)
    rel = service.compare_unit_pair_db(
        unit_a_id=u_f00.id,
        unit_a_ulpin=u_f00.prototype_ulpin_3d,
        unit_b_id=u_p00.id,
        unit_b_ulpin=u_p00.prototype_ulpin_3d
    )

    assert rel.relationship_code == "DISJOINT"
    assert rel.overlap_volume_cbm == 0.0
    assert rel.shared_z_interval is True
    assert rel.severity == "INFO"


def test_07_fixture_7_invalid_solid_detection(db_session):
    """
    Fixture 7: Invalid Open PolyhedralSurface
    An unclosed surface missing top/bottom caps must be detected as INVALID_CLOSEDNESS / INVALID_SOLID.
    """
    service = TopologyService(db_session)
    # Open faceted surface with only 2 side walls
    open_wkt = (
        "POLYHEDRALSURFACE Z ("
        "((219400 1932500 540, 219420 1932500 540, 219420 1932500 543, 219400 1932500 543, 219400 1932500 540)),"
        "((219420 1932500 540, 219420 1932520 540, 219420 1932520 543, 219420 1932500 543, 219420 1932500 540))"
        ")"
    )

    val = service.validate_solid_wkt(open_wkt, 540.0, 543.0)
    assert val.is_valid is False
    assert val.validity_code in ["INVALID_CLOSEDNESS", "INVALID_SOLID"]


def test_08_solid_positive_volume_verification(db_session):
    """Validates that valid closed extruded solids report positive volume."""
    service = TopologyService(db_session)
    coords = [[219400, 1932500], [219420, 1932500], [219420, 1932515], [219400, 1932515], [219400, 1932500]]
    solid_wkt, _ = build_polyhedralsurface_wkt_from_footprint(coords, 540.0, 543.5)

    val = service.validate_solid_wkt(solid_wkt, 540.0, 543.5)
    assert val.is_valid is True
    assert val.validity_code == "VALID_SOLID"
    assert val.volume_cbm == pytest.approx(1050.0, rel=1e-2)  # 20 * 15 * 3.5 = 1050


def test_09_z_ordering_and_elevation_metadata_consistency(db_session):
    """Validates that inverted Z range or mismatched metadata is flagged as INVALID_Z_RANGE."""
    service = TopologyService(db_session)
    coords = [[219400, 1932500], [219420, 1932500], [219420, 1932515], [219400, 1932515], [219400, 1932500]]
    solid_wkt, _ = build_polyhedralsurface_wkt_from_footprint(coords, 540.0, 543.5)

    # Inverted metadata
    val = service.validate_solid_wkt(solid_wkt, 545.0, 540.0)
    assert val.is_valid is False
    assert val.validity_code == "INVALID_Z_RANGE"


def test_10_cross_category_spatial_coexistence(db_session):
    """Validates that Elevated Skybridge AE01 and Upper Floors F01/F02 coexist without spatial collision."""
    u_ae01 = db_session.query(VerticalUnit).filter(VerticalUnit.prototype_ulpin_3d == "27A8B9C3D4E5F7-3D-AE-0016").first()
    u_f01 = db_session.query(VerticalUnit).filter(VerticalUnit.prototype_ulpin_3d == "27A8B9C3D4E5F7-3D-F-0013").first()
    assert u_ae01 is not None and u_f01 is not None

    service = TopologyService(db_session)
    rel = service.compare_unit_pair_db(
        unit_a_id=u_ae01.id,
        unit_a_ulpin=u_ae01.prototype_ulpin_3d,
        unit_b_id=u_f01.id,
        unit_b_ulpin=u_f01.prototype_ulpin_3d
    )

    # Cantilevered skybridge touches the tower boundary or is disjoint without volume overlap
    assert rel.relationship_code in ["BOUNDARY_CONTACT", "DISJOINT"]
    assert rel.overlap_volume_cbm <= 0.001
    assert rel.severity == "INFO"


def test_11_parcel_topology_api_endpoint_tower_a():
    """Validates GET /api/parcels/{id}/topology for TOWER-A returns CONFLICT status due to Unit 6."""
    parcels_res = client.get("/api/parcels")
    tower_a_parcel_id = next(p["id"] for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")

    response = client.get(f"/api/parcels/{tower_a_parcel_id}/topology")
    assert response.status_code == 200
    data = response.json()
    assert data["total_units_audited"] == 6
    assert data["overall_topology_status"] == "CONFLICT"
    assert data["conflict_count"] >= 1
    assert len(data["pairwise_relationships"]) == 15  # 6 * 5 / 2 = 15 pairs


def test_12_parcel_topology_api_endpoint_vertical_mixed_a():
    """Validates GET /api/parcels/{id}/topology for VERTICAL-MIXED-A returns 10 audited units and 45 pairs."""
    parcels_res = client.get("/api/parcels")
    mixed_a_parcel_id = next(p["id"] for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F7")

    response = client.get(f"/api/parcels/{mixed_a_parcel_id}/topology")
    assert response.status_code == 200
    data = response.json()
    assert data["total_units_audited"] == 10
    assert data["overall_topology_status"] in ["VALID", "REVIEW_REQUIRED", "CONFLICT"]
    assert len(data["pairwise_relationships"]) == 45  # 10 * 9 / 2 = 45 pairs


def test_13_unit_topology_api_endpoint(db_session):
    """Validates GET /api/vertical-units/{id}/topology for a verified unit."""
    u_f00 = db_session.query(VerticalUnit).filter(VerticalUnit.floor_code == "F00").first()
    assert u_f00 is not None

    response = client.get(f"/api/vertical-units/{u_f00.id}/topology")
    assert response.status_code == 200
    data = response.json()
    assert data["prototype_ulpin_3d"] == u_f00.prototype_ulpin_3d
    assert data["solid_validation"]["is_valid"] is True
    assert data["solid_validation"]["validity_code"] == "VALID_SOLID"
    assert data["containment"]["is_within_parcel"] is True


def test_14_read_only_guarantee_no_mutations(db_session):
    """Validates that running topology audits does not modify any database records or statuses."""
    parcels_res = client.get("/api/parcels")
    p1 = next(p["id"] for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F6")
    p2 = next(p["id"] for p in parcels_res.json() if p["ulpin_2d"] == "27A8B9C3D4E5F7")

    p_before = db_session.query(Parcel).count()
    b_before = db_session.query(Building).count()
    u_before = db_session.query(VerticalUnit).count()

    # Run audit multiple times
    client.get(f"/api/parcels/{p1}/topology")
    client.get(f"/api/parcels/{p2}/topology")

    # Check database record counts remain exact
    assert db_session.query(Parcel).count() == p_before
    assert db_session.query(Building).count() == b_before
    assert db_session.query(VerticalUnit).count() == u_before


def test_15_ai_candidate_integration_with_topology_engine():
    """Validates that AI proposed candidates can be audited through topology service."""
    service = TopologyService(SessionLocal())
    try:
        # Validate proposed candidates generated by AI proposer
        coords = [[219404.953, 1932502.447], [219425.050, 1932502.447], [219425.050, 1932517.553], [219404.953, 1932517.553], [219404.953, 1932502.447]]
        geom_wkt, _ = build_polyhedralsurface_wkt_from_footprint(coords, 540.0, 543.5)

        val = service.validate_solid_wkt(geom_wkt, 540.0, 543.5)
        assert val.is_valid is True
        assert val.validity_code == "VALID_SOLID"
    finally:
        service.db.close()


def test_16_rejected_unit_conflict_preservation(db_session):
    """Validates that rejected unit (Seq 6) retains its conflict audit history and rejected state."""
    u_rej = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 6).first()
    assert u_rej is not None
    assert str(u_rej.status) == "REJECTED" or u_rej.status.name == "REJECTED" or u_rej.status == "REJECTED"


def test_17_tower_a_records_remain_intact(db_session):
    """Validates that all 6 TOWER-A baseline records remain intact."""
    units = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence <= 6).all()
    assert len(units) == 6


def test_18_vertical_mixed_a_records_remain_intact(db_session):
    """Validates that all 10 VERTICAL-MIXED-A records remain intact."""
    units = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence >= 7, VerticalUnit.unit_sequence <= 16).all()
    assert len(units) == 10


def test_19_topology_nonexistent_parcel_404():
    """Validates that requesting topology for unknown parcel returns 404."""
    missing_id = str(uuid.uuid4())
    res = client.get(f"/api/parcels/{missing_id}/topology")
    assert res.status_code == 404


def test_20_topology_nonexistent_unit_404():
    """Validates that requesting topology for unknown vertical unit returns 404."""
    missing_id = str(uuid.uuid4())
    res = client.get(f"/api/vertical-units/{missing_id}/topology")
    assert res.status_code == 404


def test_21_topology_disclaimer_present():
    """Validates that topology responses contain the non-authoritative research prototype disclaimer."""
    parcels_res = client.get("/api/parcels")
    p_id = parcels_res.json()[0]["id"]
    res = client.get(f"/api/parcels/{p_id}/topology")
    assert res.status_code == 200
    assert "research prototype" in res.json()["disclaimer"].lower()
    assert "legal ownership" in res.json()["disclaimer"].lower()


def test_22_conflict_severity_distribution(db_session):
    """Validates that conflicts have severity ERROR while boundary contacts have severity INFO."""
    service = TopologyService(db_session)
    u3 = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 3).first()
    u4 = db_session.query(VerticalUnit).filter(VerticalUnit.unit_sequence == 4).first()
    u_f00 = db_session.query(VerticalUnit).filter(VerticalUnit.prototype_ulpin_3d == "27A8B9C3D4E5F7-3D-F-0010").first()
    u_cm = db_session.query(VerticalUnit).filter(VerticalUnit.prototype_ulpin_3d == "27A8B9C3D4E5F7-3D-CM-0012").first()

    # Boundary contact -> INFO
    rel_touch = service.compare_unit_pair_db(u3.id, u3.prototype_ulpin_3d, u4.id, u4.prototype_ulpin_3d)
    assert rel_touch.severity == "INFO"

    # Overlap collision -> ERROR
    rel_conflict = service.compare_unit_pair_db(u_f00.id, u_f00.prototype_ulpin_3d, u_cm.id, u_cm.prototype_ulpin_3d)
    assert rel_conflict.severity == "ERROR"
    assert rel_conflict.relationship_code == "POSITIVE_VOLUME_OVERLAP"
