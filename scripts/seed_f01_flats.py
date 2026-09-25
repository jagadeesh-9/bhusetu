"""
SIH26011 Phase 3.10B: Seed Synthetic Flat Subdivision for Floor F01 of APARTMENT-SURYA-OSM.

Creates 5 child units under Floor F01:
- Flat 101 (NW Quadrant, Residential)
- Flat 102 (NE Quadrant, Residential)
- Flat 103 (SE Quadrant, Residential)
- Flat 104 (SW Quadrant, Residential)
- Common Circulation (Central Core & Corridor)

Preserves the parent F01 and all other existing storey units.
"""
import os
import sys
import json
import uuid
import psycopg
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath("."))
from scripts.reconstruct_3d_units import build_polyhedralsurface_wkt_from_footprint

load_dotenv()

PARCEL_ULPIN = "36A1B2C3D4E5F9"
BUILDING_CODE = "APARTMENT-SURYA-OSM"

# OSM Footprint corner anchors
P_SW = (219986.82, 1933088.62)
P_NW = (219985.71, 1933104.81)
P_NE = (220009.01, 1933106.37)
P_SE = (220010.12, 1933090.19)

def get_pt(u, v):
    x = (1 - u) * (1 - v) * P_SW[0] + (1 - u) * v * P_NW[0] + u * v * P_NE[0] + u * (1 - v) * P_SE[0]
    y = (1 - u) * (1 - v) * P_SW[1] + (1 - u) * v * P_NW[1] + u * v * P_NE[1] + u * (1 - v) * P_SE[1]
    return [round(x, 4), round(y, 4)]

def seed_f01_flats():
    conn_str = os.getenv("DATABASE_URL", "postgresql://postgres:8919223622@localhost:5432/sih26011_dev")
    if conn_str.startswith("postgresql+psycopg://"):
        conn_str = conn_str.replace("postgresql+psycopg://", "postgresql://")

    conn = psycopg.connect(conn_str)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            print("--- Seeding Synthetic Flat Subdivision on Floor F01 (APARTMENT-SURYA-OSM) ---")

            # 1. Retrieve Parent F01 Unit ID, Parcel ID, and Building ID
            cur.execute("""
                SELECT u.id, u.parcel_id, u.building_id, u.z_min, u.z_max
                FROM vertical_units u
                JOIN buildings b ON u.building_id = b.id
                WHERE b.building_code = %s AND u.floor_code = 'F01' AND u.unit_level = 'STOREY';
            """, (BUILDING_CODE,))
            f01_row = cur.fetchone()
            if not f01_row:
                raise ValueError(f"Parent Floor F01 not found for building {BUILDING_CODE}")

            f01_id, parcel_id, building_id, z_min, z_max = f01_row
            z_min = float(z_min)
            z_max = float(z_max)
            print(f"Parent F01 Unit ID: {f01_id} (Z: [{z_min}, {z_max}])")

            # 2. Idempotent cleanup for sub-units under F01 only
            cur.execute("SELECT id FROM vertical_units WHERE parent_unit_id = %s;", (f01_id,))
            existing_sub_ids = [r[0] for r in cur.fetchall()]
            if existing_sub_ids:
                print(f"Found {len(existing_sub_ids)} existing sub-units for F01. Cleaning for clean re-seed...")
                cur.execute("DELETE FROM verification_audit WHERE unit_id = ANY(%s);", (existing_sub_ids,))
                cur.execute("DELETE FROM source_evidence WHERE unit_id = ANY(%s);", (existing_sub_ids,))
                cur.execute("DELETE FROM vertical_units WHERE id = ANY(%s);", (existing_sub_ids,))

            # 3. Define 2D subdivisions
            f101_fp = [
                get_pt(0.0, 0.55),
                get_pt(0.0, 1.0),
                get_pt(0.45, 1.0),
                get_pt(0.45, 0.55),
                get_pt(0.0, 0.55)
            ]
            f102_fp = [
                get_pt(0.55, 0.55),
                get_pt(0.55, 1.0),
                get_pt(1.0, 1.0),
                get_pt(1.0, 0.55),
                get_pt(0.55, 0.55)
            ]
            f103_fp = [
                get_pt(0.55, 0.0),
                get_pt(0.55, 0.45),
                get_pt(1.0, 0.45),
                get_pt(1.0, 0.0),
                get_pt(0.55, 0.0)
            ]
            f104_fp = [
                get_pt(0.0, 0.0),
                get_pt(0.0, 0.45),
                get_pt(0.45, 0.45),
                get_pt(0.45, 0.0),
                get_pt(0.0, 0.0)
            ]
            common_fp = [
                get_pt(0.0, 0.45),
                get_pt(0.0, 0.55),
                get_pt(0.45, 0.55),
                get_pt(0.45, 1.0),
                get_pt(0.55, 1.0),
                get_pt(0.55, 0.55),
                get_pt(1.0, 0.55),
                get_pt(1.0, 0.45),
                get_pt(0.55, 0.45),
                get_pt(0.55, 0.0),
                get_pt(0.45, 0.0),
                get_pt(0.45, 0.45),
                get_pt(0.0, 0.45)
            ]

            flat_defs = [
                {
                    "flat_number": "101",
                    "unit_level": "FLAT",
                    "unit_type": "RESIDENTIAL",
                    "unit_label": "Flat 101 (2BHK North-West Unit)",
                    "code_suffix": "U101",
                    "footprint": f101_fp,
                    "desc": "North-West corner 2BHK residential flat on Floor 1."
                },
                {
                    "flat_number": "102",
                    "unit_level": "FLAT",
                    "unit_type": "RESIDENTIAL",
                    "unit_label": "Flat 102 (2BHK North-East Unit)",
                    "code_suffix": "U102",
                    "footprint": f102_fp,
                    "desc": "North-East corner 2BHK residential flat on Floor 1."
                },
                {
                    "flat_number": "103",
                    "unit_level": "FLAT",
                    "unit_type": "RESIDENTIAL",
                    "unit_label": "Flat 103 (2BHK South-East Unit)",
                    "code_suffix": "U103",
                    "footprint": f103_fp,
                    "desc": "South-East corner 2BHK residential flat on Floor 1."
                },
                {
                    "flat_number": "104",
                    "unit_level": "FLAT",
                    "unit_type": "RESIDENTIAL",
                    "unit_label": "Flat 104 (2BHK South-West Unit)",
                    "code_suffix": "U104",
                    "footprint": f104_fp,
                    "desc": "South-West corner 2BHK residential flat on Floor 1."
                },
                {
                    "flat_number": None,
                    "unit_level": "COMMON_CIRCULATION",
                    "unit_type": "COMMON_CIRCULATION",
                    "unit_label": "Floor 1 Common Corridor & Lobby",
                    "code_suffix": "CORE",
                    "footprint": common_fp,
                    "desc": "Central common corridor, elevator lobby, and stairwell access."
                },
            ]

            created_flats = []

            for f_def in flat_defs:
                # Concurrency-safe sequence allocation
                cur.execute("SELECT nextval('vertical_unit_seq');")
                seq_val = cur.fetchone()[0]

                proto_ulpin = f"{PARCEL_ULPIN}-3D-F-{seq_val:04d}-{f_def['code_suffix']}"
                unit_id = uuid.uuid4()

                # Build watertight 3D PolyhedralSurface WKT
                wkt, _ = build_polyhedralsurface_wkt_from_footprint(
                    f_def["footprint"],
                    z_min,
                    z_max
                )

                unit_seq = (seq_val - 1) % 9999 + 1
                # Insert vertical unit as PROPOSED
                cur.execute("""
                    INSERT INTO vertical_units (
                        id, parcel_id, building_id, parent_unit_id, prototype_ulpin_3d,
                        tier_code, floor_code, unit_sequence, unit_level, flat_number,
                        unit_label, unit_type, z_min, z_max, geom_3d, status
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        'F', 'F01', %s, %s, %s,
                        %s, %s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 32644), 'PROPOSED'
                    );
                """, (
                    unit_id, parcel_id, building_id, f01_id, proto_ulpin,
                    unit_seq, f_def["unit_level"], f_def["flat_number"],
                    f_def["unit_label"], f_def["unit_type"], z_min, z_max,
                    wkt
                ))

                # Attach source evidence
                evidence_id = uuid.uuid4()
                evidence_meta = {
                    "source": "Synthetic Architectural Plan Subdivision",
                    "is_synthetic": True,
                    "prototype_only": True,
                    "parent_floor": "F01",
                    "flat_number": f_def["flat_number"],
                    "description": f_def["desc"],
                    "safety_statement": "Synthetic research demonstration geometry. Does not represent official Government of India ULPIN or legal cadastral boundary."
                }
                cur.execute("""
                    INSERT INTO source_evidence (
                        id, unit_id, source_type, dataset_name, file_uri,
                        accuracy_horizontal_m, accuracy_vertical_m, metadata_json
                    ) VALUES (
                        %s, %s, 'ARCHITECTURAL_PLAN_2D',
                        'Surya_Heights_F01_Synthetic_FloorPlan.dwg (Demo)',
                        'cad/surya_heights_f01_synthetic_plan_2026.dwg',
                        0.05, 0.05, %s
                    );
                """, (
                    evidence_id, unit_id, json.dumps(evidence_meta)
                ))

                # Attach verification audit
                audit_id = uuid.uuid4()
                cur.execute("""
                    INSERT INTO verification_audit (
                        id, unit_id, action, previous_status, new_status,
                        reviewer_name, reviewer_role, review_notes, integrity_hash
                    ) VALUES (
                        %s, %s, 'AUTO_INGESTION', 'PROPOSED', 'PROPOSED',
                        'Subdivision Geometry Engine (Synthetic)', 'SYSTEM_VALIDATOR',
                        %s, %s
                    );
                """, (
                    audit_id, unit_id,
                    f"Automated ingestion of synthetic {f_def['unit_label']}. Initialized as PROPOSED.",
                    f"syn_hash_flat_{proto_ulpin}"
                ))

                created_flats.append({
                    "id": str(unit_id),
                    "flat_number": f_def["flat_number"],
                    "label": f_def["unit_label"],
                    "ulpin": proto_ulpin,
                    "seq": seq_val,
                    "level": f_def["unit_level"]
                })
                print(f"  Created Unit: {f_def['unit_label']} | ULPIN: {proto_ulpin} (ID: {unit_id})")

            conn.commit()
            print("--- Successfully Persisted F01 Synthetic Flat Subdivision ---")
            return created_flats

    except Exception as e:
        conn.rollback()
        print(f"Error seeding F01 flats: {e}")
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    seed_f01_flats()
