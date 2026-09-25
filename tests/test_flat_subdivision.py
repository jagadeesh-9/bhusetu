"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Phase 3.10B: Test Suite for Synthetic Flat Subdivision on Floor F01 (APARTMENT-SURYA-OSM).
"""
import os
import pytest
import psycopg
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from backend.app.main import app

load_dotenv()
client = TestClient(app)

PARCEL_ULPIN = "36A1B2C3D4E5F9"
BUILDING_CODE = "APARTMENT-SURYA-OSM"


@pytest.fixture
def db_conn():
    conn_str = os.getenv("DATABASE_URL", "postgresql://postgres:8919223622@localhost:5432/sih26011_dev")
    if conn_str.startswith("postgresql+psycopg://"):
        conn_str = conn_str.replace("postgresql+psycopg://", "postgresql://")
    conn = psycopg.connect(conn_str)
    yield conn
    conn.close()


def test_existing_storey_records_preserved(db_conn):
    """Verifies that all 8 original storey records for APARTMENT-SURYA-OSM are preserved and unmodified."""
    with db_conn.cursor() as cur:
        cur.execute("""
            SELECT floor_code, prototype_ulpin_3d, unit_level, parent_unit_id, z_min, z_max
            FROM vertical_units
            WHERE unit_level = 'STOREY' AND building_id IN (SELECT id FROM buildings WHERE building_code = %s)
            ORDER BY z_min;
        """, (BUILDING_CODE,))
        storeys = cur.fetchall()

    assert len(storeys) == 8, f"Expected 8 storey units, found {len(storeys)}"
    floor_codes = [s[0] for s in storeys]
    assert floor_codes == ["B01", "F00", "F01", "F02", "F03", "F04", "F05", "RF01"]

    # All storeys must have parent_unit_id IS NULL and unit_level = 'STOREY'
    for s in storeys:
        assert s[2] == "STOREY"
        assert s[3] is None


def test_f01_flat_subdivision_hierarchy(db_conn):
    """Verifies that Floor F01 contains exactly 5 child sub-units (Flats 101-104 + Common Core)."""
    with db_conn.cursor() as cur:
        # Get parent F01 ID
        cur.execute("""
            SELECT id FROM vertical_units 
            WHERE floor_code = 'F01' AND unit_level = 'STOREY' 
              AND building_id IN (SELECT id FROM buildings WHERE building_code = %s);
        """, (BUILDING_CODE,))
        f01_id = cur.fetchone()[0]

        # Get child units
        cur.execute("""
            SELECT id, floor_code, prototype_ulpin_3d, unit_level, flat_number, z_min, z_max, unit_label, status
            FROM vertical_units
            WHERE parent_unit_id = %s
            ORDER BY unit_sequence;
        """, (f01_id,))
        sub_units = cur.fetchall()

    assert len(sub_units) == 5, f"Expected 5 child sub-units under F01, found {len(sub_units)}"

    flat_numbers = [u[4] for u in sub_units if u[4] is not None]
    assert sorted(flat_numbers) == ["101", "102", "103", "104"]

    for u in sub_units:
        assert float(u[5]) == 543.50, f"Zmin must be 543.50, got {u[5]}"
        assert float(u[6]) == 546.50, f"Zmax must be 546.50, got {u[6]}"
        assert u[8] == "PROPOSED", f"Status must be PROPOSED, got {u[8]}"
        assert PARCEL_ULPIN in u[2], f"ULPIN must contain parcel ULPIN: {u[2]}"


def test_f01_flat_geometry_and_watertightness(db_conn):
    """Verifies that all 5 sub-units have valid 2D footprints and watertight 3D PolyhedralSurfaceZ solids."""
    with db_conn.cursor() as cur:
        cur.execute("""
            SELECT u.flat_number, u.unit_level,
                   ST_IsClosed(u.geom_3d) AS is_closed,
                   CG_IsSolid(CG_MakeSolid(u.geom_3d)) AS is_solid,
                   CG_Volume(CG_MakeSolid(u.geom_3d)) AS volume_cbm,
                   ST_ZMin(u.geom_3d) AS z_min_geom,
                   ST_ZMax(u.geom_3d) AS z_max_geom
            FROM vertical_units u
            WHERE u.parent_unit_id IN (
                SELECT id FROM vertical_units WHERE floor_code = 'F01' AND unit_level = 'STOREY'
                AND building_id IN (SELECT id FROM buildings WHERE building_code = %s)
            )
            ORDER BY u.unit_sequence;
        """, (BUILDING_CODE,))
        rows = cur.fetchall()

    assert len(rows) == 5
    for r in rows:
        flat_num, unit_lvl, is_closed, is_solid, vol, z_min_g, z_max_g = r
        assert is_closed is True, f"Unit {flat_num or unit_lvl} must be closed"
        assert is_solid is True, f"Unit {flat_num or unit_lvl} must be solid"
        assert vol > 0.0, f"Unit {flat_num or unit_lvl} must have positive volume, got {vol}"
        assert abs(float(z_min_g) - 543.50) < 0.01
        assert abs(float(z_max_g) - 546.50) < 0.01


def test_f01_flat_pairwise_zero_overlap(db_conn):
    """Verifies that sibling sub-units have zero interior overlap (only shared boundary walls)."""
    with db_conn.cursor() as cur:
        cur.execute("""
            SELECT u1.unit_label, u2.unit_label,
                   ROUND(CG_Volume(CG_3DIntersection(
                       CG_MakeSolid(u1.geom_3d),
                       CG_MakeSolid(u2.geom_3d)
                   ))::numeric, 4) AS overlap_vol
            FROM vertical_units u1
            JOIN vertical_units u2 ON u1.parent_unit_id = u2.parent_unit_id AND u1.id < u2.id
            WHERE u1.parent_unit_id IN (
                SELECT id FROM vertical_units WHERE floor_code = 'F01' AND unit_level = 'STOREY'
                AND building_id IN (SELECT id FROM buildings WHERE building_code = %s)
            );
        """, (BUILDING_CODE,))
        pairs = cur.fetchall()

    assert len(pairs) == 10  # 5 units choose 2 = 10 pairs
    for name1, name2, vol in pairs:
        assert float(vol) < 0.001, f"Volumetric overlap between {name1} and {name2}: {vol} cbm"


def test_f01_flat_provenance_and_audit(db_conn):
    """Verifies synthetic evidence and initial audit records for each flat."""
    with db_conn.cursor() as cur:
        cur.execute("""
            SELECT u.unit_label, e.source_type, e.metadata_json, a.action, a.new_status
            FROM vertical_units u
            JOIN source_evidence e ON e.unit_id = u.id
            JOIN verification_audit a ON a.unit_id = u.id
            WHERE u.parent_unit_id IN (
                SELECT id FROM vertical_units WHERE floor_code = 'F01' AND unit_level = 'STOREY'
                AND building_id IN (SELECT id FROM buildings WHERE building_code = %s)
            );
        """, (BUILDING_CODE,))
        records = cur.fetchall()

    assert len(records) == 5
    for label, src_type, meta, action, new_status in records:
        assert src_type == "ARCHITECTURAL_PLAN_2D"
        assert meta.get("is_synthetic") is True
        assert meta.get("prototype_only") is True
        assert action == "AUTO_INGESTION"
        assert new_status == "PROPOSED"


def test_api_storey_default_backward_compatibility():
    """Verifies that GET /api/parcels/{id}/vertical-units returns only storey-level units by default."""
    p_res = client.get("/api/parcels")
    assert p_res.status_code == 200
    osm_parcel = next((p for p in p_res.json() if p["ulpin_2d"] == PARCEL_ULPIN), None)
    assert osm_parcel is not None
    parcel_id = osm_parcel["id"]

    # Default query (include_subunits=False)
    units_res = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    assert units_res.status_code == 200
    units = units_res.json()
    assert len(units) == 8, f"Expected 8 storey units by default, got {len(units)}"
    assert all(u["unit_level"] == "STOREY" for u in units)


def test_api_subunits_retrieval():
    """Verifies that GET /api/vertical-units/{f01_id}/sub-units returns the 5 child flats for F01."""
    p_res = client.get("/api/parcels")
    osm_parcel = next((p for p in p_res.json() if p["ulpin_2d"] == PARCEL_ULPIN), None)
    parcel_id = osm_parcel["id"]

    units_res = client.get(f"/api/parcels/{parcel_id}/vertical-units")
    f01_unit = next((u for u in units_res.json() if u["floor_code"] == "F01"), None)
    assert f01_unit is not None
    f01_id = f01_unit["id"]

    sub_res = client.get(f"/api/vertical-units/{f01_id}/sub-units")
    assert sub_res.status_code == 200
    sub_units = sub_res.json()
    assert len(sub_units) == 5
    flat_numbers = [u["flat_number"] for u in sub_units if u["flat_number"] is not None]
    assert sorted(flat_numbers) == ["101", "102", "103", "104"]
