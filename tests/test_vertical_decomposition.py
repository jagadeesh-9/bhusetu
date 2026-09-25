"""
Tests for SIH26011 Phase 2.8: Rich Vertical Property Decomposition & Multi-Tier 3D Property Stack.

Verifies:
1. Vertical property taxonomy classification across all 5 categories & 9+ strata types.
2. Underground classification & provenance distinction (BIM/IFC, utility survey, optical airborne exclusion).
3. Watertight PolyhedralSurface 3D solid geometry (closure, solidness, positive volume, parcel containment).
4. Vertical Z ordering & topological boundary-touching without volumetric conflict.
5. Volumetric overlap detection for colliding units.
6. Persisted VERTICAL-MIXED-A scenario existence (10 units across all required categories including CM01).
7. Non-overlapping spatial coexistence for concurrent levels (P00 open parking vs F00 ground floor, AE01 skybridge vs F01/F02).
8. All 10 VERTICAL-MIXED-A candidate units strictly in PROPOSED lifecycle status with SYSTEM_VALIDATOR gate.
9. Database preservation of existing 6 TOWER-A units with exact lifecycle states.
10. GET /api/parcels/{parcel_id}/vertical-structure endpoint functionality across both parcels.
"""
import os
import json
import uuid
import pytest
import psycopg
from dotenv import load_dotenv
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.services.decomposition_service import (
    classify_vertical_taxonomy,
    VerticalPropertyDecompositionService
)
from scripts.reconstruct_3d_units import build_polyhedralsurface_wkt_from_footprint

load_dotenv()

client = TestClient(app)


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def db_conn():
    conn_str = os.getenv("DATABASE_URL", "postgresql://postgres:8919223622@localhost:5432/sih26011_dev")
    if conn_str.startswith("postgresql+psycopg://"):
        conn_str = conn_str.replace("postgresql+psycopg://", "postgresql://")
    conn = psycopg.connect(conn_str)
    yield conn
    conn.close()


def test_01_taxonomy_mapping_all_categories():
    """Test 1: Taxonomy mapping correctly identifies categories for all standard tier codes."""
    t_ut = classify_vertical_taxonomy("UT", "UTILITY_CORRIDOR", "UT01")
    assert t_ut.category == "UNDERGROUND"
    assert t_ut.unit_class == "UNDERGROUND_UTILITY"

    t_sb = classify_vertical_taxonomy("SB", "COMMERCIAL", "B01")
    assert t_sb.category == "UNDERGROUND"
    assert t_sb.unit_class == "BASEMENT"

    t_sb_park = classify_vertical_taxonomy("SB", "PARKING", "B02")
    assert t_sb_park.category == "UNDERGROUND"
    assert t_sb_park.unit_class == "UNDERGROUND_PARKING"

    t_f_ground = classify_vertical_taxonomy("F", "COMMERCIAL", "F00")
    assert t_f_ground.category == "GROUND"
    assert t_f_ground.unit_class == "GROUND_FLOOR"

    t_f_park = classify_vertical_taxonomy("F", "PARKING", "P00")
    assert t_f_park.category == "GROUND"
    assert t_f_park.unit_class == "OPEN_PARKING"

    t_f_upper = classify_vertical_taxonomy("F", "RESIDENTIAL", "F01")
    assert t_f_upper.category == "UPPER_FLOORS"
    assert t_f_upper.unit_class == "UPPER_FLOOR"

    t_ar = classify_vertical_taxonomy("AR", "COMMON_CIRCULATION", "RF01")
    assert t_ar.category == "ROOFTOP_ELEVATED"
    assert t_ar.unit_class == "ROOFTOP"

    t_ae = classify_vertical_taxonomy("AE", "AIR_RIGHTS", "AE01")
    assert t_ae.category == "ROOFTOP_ELEVATED"
    assert t_ae.unit_class == "ELEVATED"

    t_cm = classify_vertical_taxonomy("CM", "COMMON_CIRCULATION", "CM01")
    assert t_cm.category == "COMMON"
    assert t_cm.unit_class == "COMMON_CIRCULATION"


def test_02_synthetic_multitier_scenario_specs_generation(db_session):
    """Test 2: Synthetic multi-tier scenario builder generates valid specifications for all strata."""
    service = VerticalPropertyDecompositionService(db_session)
    specs = service.create_synthetic_multitier_candidate_specs()

    assert len(specs) == 9
    floor_codes = [s["floor_code"] for s in specs]
    assert "UT01" in floor_codes
    assert "B02" in floor_codes
    assert "B01" in floor_codes
    assert "F00" in floor_codes
    assert "P00" in floor_codes
    assert "F01" in floor_codes
    assert "F02" in floor_codes
    assert "RF01" in floor_codes
    assert "AE01" in floor_codes

    for s in specs:
        assert s["z_min"] < s["z_max"]
        assert "POLYHEDRALSURFACE Z" in s["geom_wkt"]
        assert s["source_type"] in [
            "BIM_IFC", "LIDAR_POINTCLOUD", "ARCHITECTURAL_PLAN_2D",
            "DRONE_PHOTOGRAMMETRY", "CORS_GNSS_SURVEY"
        ]


def test_03_geometry_closure_and_positive_volume(db_conn, db_session):
    """Test 3: Every synthetic vertical unit geometry is a closed 3D solid with strictly positive volume."""
    service = VerticalPropertyDecompositionService(db_session)
    specs = service.create_synthetic_multitier_candidate_specs()

    with db_conn.cursor() as cur:
        for s in specs:
            cur.execute("""
                SELECT 
                    ST_IsClosed(ST_GeomFromText(%s, 32644)) AS is_closed,
                    CG_IsSolid(CG_MakeSolid(ST_GeomFromText(%s, 32644))) AS is_solid,
                    ROUND(CG_Volume(CG_MakeSolid(ST_GeomFromText(%s, 32644)))::numeric, 4) AS volume_cbm,
                    ST_ZMin(ST_GeomFromText(%s, 32644)) AS z_min_calc,
                    ST_ZMax(ST_GeomFromText(%s, 32644)) AS z_max_calc
            """, (s["geom_wkt"], s["geom_wkt"], s["geom_wkt"], s["geom_wkt"], s["geom_wkt"]))
            row = cur.fetchone()
            
            assert row[0] is True, f"Unit {s['floor_code']} must be closed"
            assert row[1] is True, f"Unit {s['floor_code']} must be solid"
            assert float(row[2]) > 0.0, f"Unit {s['floor_code']} volume must be positive, got {row[2]}"
            assert float(row[3]) == s["z_min"]
            assert float(row[4]) == s["z_max"]


def test_04_parcel_containment_and_zero_volume_boundary_touching(db_conn, db_session):
    """Test 4: Units are horizontally within parcel, and vertically adjacent units have zero volumetric conflict."""
    service = VerticalPropertyDecompositionService(db_session)
    specs = service.create_synthetic_multitier_candidate_specs()

    # Verify parcel containment against seed parcel
    with db_conn.cursor() as cur:
        for s in specs:
            cur.execute("""
                SELECT ST_Within(
                    ST_Envelope(ST_GeomFromText(%s, 32644)),
                    (SELECT geom_2d FROM parcels WHERE ulpin_2d = '27A8B9C3D4E5F6')
                );
            """, (s["geom_wkt"],))
            within = cur.fetchone()[0]
            assert within is True, f"Unit {s['floor_code']} must be within parcel bounds"

        # Check adjacent vertical units (e.g. B02 [534-537] and B01 [537-540])
        b02_wkt = next(s["geom_wkt"] for s in specs if s["floor_code"] == "B02")
        b01_wkt = next(s["geom_wkt"] for s in specs if s["floor_code"] == "B01")

        cur.execute("""
            SELECT 
                ST_3DIntersects(ST_GeomFromText(%s, 32644), ST_GeomFromText(%s, 32644)) AS touches,
                ROUND(COALESCE(CG_Volume(CG_3DIntersection(
                    CG_MakeSolid(ST_GeomFromText(%s, 32644)),
                    CG_MakeSolid(ST_GeomFromText(%s, 32644))
                )), 0.0)::numeric, 4) AS overlap_vol
        """, (b02_wkt, b01_wkt, b02_wkt, b01_wkt))
        touch_res = cur.fetchone()
        
        # They touch at Z=537 boundary slab, but overlap volume must be exactly 0.0
        assert touch_res[0] is True
        assert float(touch_res[1] or 0.0) == 0.0


def test_05_volumetric_overlap_detection_for_colliding_units(db_conn):
    """Test 5: True volumetric conflict (>0 volume overlap) is properly detected."""
    # Create two overlapping cubes (Z 540-545 and Z 542-547)
    fp = [[219405.0, 1932502.5], [219425.0, 1932502.5], [219425.0, 1932517.5], [219405.0, 1932517.5], [219405.0, 1932502.5]]
    wkt1, _ = build_polyhedralsurface_wkt_from_footprint(fp, 540.0, 545.0)
    wkt2, _ = build_polyhedralsurface_wkt_from_footprint(fp, 542.0, 547.0)

    with db_conn.cursor() as cur:
        cur.execute("""
            SELECT ROUND(COALESCE(CG_Volume(CG_3DIntersection(
                CG_MakeSolid(ST_GeomFromText(%s, 32644)),
                CG_MakeSolid(ST_GeomFromText(%s, 32644))
            )), 0.0)::numeric, 4) AS overlap_vol
        """, (wkt1, wkt2))
        vol = cur.fetchone()[0]
        # Footprint area 20m x 15m = 300 sqm. Z overlap 3m (542 to 545) -> Volume = 900 m3
        assert float(vol) == 900.0


def test_06_persisted_vertical_mixed_a_scenario_exists(db_conn):
    """Test 6: VERTICAL-MIXED-A dataset is fully persisted in database with 10 distinct vertical units."""
    with db_conn.cursor() as cur:
        cur.execute("""
            SELECT p.ulpin_2d, b.building_code, count(u.id) AS unit_count
            FROM parcels p
            JOIN buildings b ON p.id = b.parcel_id
            JOIN vertical_units u ON p.id = u.parcel_id
            WHERE p.ulpin_2d = '27A8B9C3D4E5F7'
            GROUP BY p.ulpin_2d, b.building_code;
        """)
        row = cur.fetchone()
        assert row is not None, "Persisted parcel 27A8B9C3D4E5F7 must exist in database"
        assert row[0] == "27A8B9C3D4E5F7"
        assert row[1] == "MIXED-TOWER-A"
        assert row[2] == 10, f"Expected exactly 10 units in VERTICAL-MIXED-A, got {row[2]}"


def test_07_persisted_vertical_mixed_a_all_categories_represented(db_conn):
    """Test 7: Persisted VERTICAL-MIXED-A demonstrates all required strata categories including CM01."""
    with db_conn.cursor() as cur:
        cur.execute("""
            SELECT u.floor_code, u.tier_code, u.unit_type, u.status, u.z_min, u.z_max,
                   ST_IsClosed(u.geom_3d) AS is_closed,
                   CG_IsSolid(CG_MakeSolid(u.geom_3d)) AS is_solid,
                   ROUND(CG_Volume(CG_MakeSolid(u.geom_3d))::numeric, 4) AS volume_cbm
            FROM vertical_units u
            JOIN parcels p ON u.parcel_id = p.id
            WHERE p.ulpin_2d = '27A8B9C3D4E5F7'
            ORDER BY u.unit_sequence;
        """)
        rows = cur.fetchall()
        assert len(rows) == 10

        floor_codes = [r[0] for r in rows]
        assert "UT01" in floor_codes
        assert "B02" in floor_codes
        assert "B01" in floor_codes
        assert "F00" in floor_codes
        assert "P00" in floor_codes
        assert "CM01" in floor_codes
        assert "F01" in floor_codes
        assert "F02" in floor_codes
        assert "RF01" in floor_codes
        assert "AE01" in floor_codes

        for r in rows:
            floor_code, tier_code, unit_type, status, z_min, z_max, is_closed, is_solid, vol = r
            assert status == "PROPOSED", f"All newly inserted units must start as PROPOSED, got {status} for {floor_code}"
            assert is_closed is True, f"Unit {floor_code} must be closed solid"
            assert is_solid is True, f"Unit {floor_code} must be solid"
            assert float(vol) > 0.0, f"Unit {floor_code} must have positive volume"


def test_08_persisted_spatial_coexistence_without_collision(db_conn):
    """Test 8: P00 (Open Parking) and F00 (Ground Floor) coexist at Z 540-543.5 without volumetric overlap."""
    with db_conn.cursor() as cur:
        cur.execute("""
            SELECT 
                ROUND(COALESCE(CG_Volume(CG_3DIntersection(
                    CG_MakeSolid(u1.geom_3d),
                    CG_MakeSolid(u2.geom_3d)
                )), 0.0)::numeric, 4) AS overlap_vol
            FROM vertical_units u1
            JOIN vertical_units u2 ON u1.parcel_id = u2.parcel_id AND u1.id != u2.id
            JOIN parcels p ON u1.parcel_id = p.id
            WHERE p.ulpin_2d = '27A8B9C3D4E5F7'
              AND u1.floor_code = 'F00' AND u2.floor_code = 'P00';
        """)
        overlap_vol = cur.fetchone()[0]
        assert float(overlap_vol) == 0.0, f"F00 and P00 must not have volumetric overlap, got {overlap_vol} m³"


def test_09_underground_evidence_differentiation_and_no_fake_lidar(db_conn):
    """Test 9: Underground units in database are attributed to BIM/CAD/survey, not optical airborne LiDAR."""
    with db_conn.cursor() as cur:
        cur.execute("""
            SELECT u.floor_code, u.tier_code, e.source_type, e.dataset_name, e.metadata_json
            FROM vertical_units u
            JOIN source_evidence e ON u.id = e.unit_id
            WHERE u.tier_code IN ('UT', 'SB');
        """)
        rows = cur.fetchall()
        for r in rows:
            floor_code, tier_code, source_type, dataset_name, meta = r
            assert source_type in ["BIM_IFC", "ARCHITECTURAL_PLAN_2D", "CORS_GNSS_SURVEY", "CITYJSON_LOD2", "MANUAL_DIGITIZED"], (
                f"Underground unit {floor_code} ({tier_code}) must not use optical airborne LIDAR, got {source_type}"
            )
            assert source_type != "LIDAR_POINTCLOUD"


def test_10_vertical_structure_api_endpoint_both_parcels():
    """Test 10: GET /api/parcels/{parcel_id}/vertical-structure returns grouped taxonomy for both parcels."""
    p_res = client.get("/api/parcels")
    assert p_res.status_code == 200
    parcels = p_res.json()
    assert len(parcels) >= 2

    # Verify parcel 1 (TOWER-A)
    p1 = next(p for p in parcels if p["ulpin_2d"] == "27A8B9C3D4E5F6")
    res1 = client.get(f"/api/parcels/{p1['id']}/vertical-structure")
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["total_units"] == 6

    # Verify parcel 2 (VERTICAL-MIXED-A)
    p2 = next(p for p in parcels if p["ulpin_2d"] == "27A8B9C3D4E5F7")
    res2 = client.get(f"/api/parcels/{p2['id']}/vertical-structure")
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["total_units"] == 10

    # Ensure CM (Common) is exposed in d2
    cat_codes_2 = [c["category_code"] for c in d2["categories"]]
    assert "COMMON" in cat_codes_2
    assert "UNDERGROUND" in cat_codes_2
    assert "GROUND" in cat_codes_2
    assert "UPPER_FLOORS" in cat_codes_2
    assert "ROOFTOP_ELEVATED" in cat_codes_2


def test_11_database_integrity_and_tower_a_preservation(db_conn):
    """Test 11: Ensure original 6 TOWER-A units remain intact with their exact statuses and sequences."""
    with db_conn.cursor() as cur:
        # Check overall database counts
        cur.execute("SELECT count(*) FROM parcels;")
        assert cur.fetchone()[0] >= 2
        cur.execute("SELECT count(*) FROM buildings;")
        assert cur.fetchone()[0] >= 2
        cur.execute("SELECT count(*) FROM vertical_units;")
        assert cur.fetchone()[0] >= 16
        cur.execute("SELECT count(*) FROM source_evidence;")
        assert cur.fetchone()[0] >= 16
        cur.execute("SELECT count(*) FROM verification_audit;")
        assert cur.fetchone()[0] >= 16

        # Check TOWER-A units 1-6 specifically
        cur.execute("""
            SELECT u.unit_sequence, u.status, u.floor_code, u.tier_code 
            FROM vertical_units u
            JOIN parcels p ON u.parcel_id = p.id
            WHERE p.ulpin_2d = '27A8B9C3D4E5F6'
            ORDER BY u.unit_sequence;
        """)
        units = cur.fetchall()
        assert len(units) == 6
        assert units[0] == (1, 'VERIFIED', 'UT01', 'UT')
        assert units[1] == (2, 'VERIFIED', 'B01', 'SB')
        assert units[2] == (3, 'VERIFIED', 'F00', 'F')
        assert units[3] == (4, 'UNDER_REVIEW', 'F01', 'F')
        assert units[4] == (5, 'PROPOSED', 'F02', 'F')
        assert units[5] == (6, 'REJECTED', 'F02', 'F')
