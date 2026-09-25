"""
SIH26011 Phase 3.7C: Seed Persistent Canonical Indian Apartment (Surya Heights) Synthetic Demonstration Dataset.

Inserts:
1. Synthetic Base Parcel '36A1B2C3D4E5F8' (SY-142/2 (Synthetic Demo Parcel), 1200.00 sqm, EPSG:32644)
2. Synthetic Building 'APARTMENT-SURYA' (Surya Heights Residential Apartment (Synthetic), 6 above, 1 below)
3. 8 Canonical 3D Vertical Units demonstrating standard Indian urban apartment strata:
   - B01: Basement Parking Level [Z 536.50 - 540.00] (SB + PARKING)
   - F00: Ground Floor Stilt & Lobby [Z 540.00 - 543.50] (F + COMMON_CIRCULATION)
   - F01: Floor 1 Residential Strata [Z 543.50 - 546.50] (F + RESIDENTIAL)
   - F02: Floor 2 Residential Strata [Z 546.50 - 549.50] (F + RESIDENTIAL)
   - F03: Floor 3 Residential Strata [Z 549.50 - 552.50] (F + RESIDENTIAL)
   - F04: Floor 4 Residential Strata [Z 552.50 - 555.50] (F + RESIDENTIAL)
   - F05: Floor 5 Residential Strata [Z 555.50 - 558.50] (F + RESIDENTIAL)
   - RF01: Rooftop Common Terrace & Solar [Z 558.50 - 561.50] (AR + COMMON_CIRCULATION)
4. Associated Source Evidence records (BIM, Architectural CAD, LiDAR, Drone Photogrammetry) marked as SYNTHETIC.
5. Associated Verification Audit records initialized strictly in PROPOSED status with SYSTEM_VALIDATOR.

DISCLAIMER:
All records are strictly synthetic research prototype data.
Does not represent official Government of India ULPINs, statutory cadastral boundaries, or legal land titles.
"""
import os
import sys
import json
import uuid
from typing import List, Dict, Any
import psycopg
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath("."))
from scripts.reconstruct_3d_units import build_polyhedralsurface_wkt_from_footprint

load_dotenv()

PARCEL_ULPIN = "36A1B2C3D4E5F8"
BUILDING_CODE = "APARTMENT-SURYA"

def seed_canonical_indian_apartment():
    conn_str = os.getenv("DATABASE_URL", "postgresql://postgres:8919223622@localhost:5432/sih26011_dev")
    if conn_str.startswith("postgresql+psycopg://"):
        conn_str = conn_str.replace("postgresql+psycopg://", "postgresql://")
    
    conn = psycopg.connect(conn_str)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            print("--- Seeding Canonical Indian Apartment (Surya Heights) Demonstration Dataset ---")

            # Check if parcel already exists
            cur.execute("SELECT id FROM parcels WHERE ulpin_2d = %s;", (PARCEL_ULPIN,))
            p_row = cur.fetchone()
            if p_row:
                parcel_id = p_row[0]
                print(f"Parcel {PARCEL_ULPIN} already exists (ID: {parcel_id}). Cleaning previous child records for idempotent re-seeding...")
                cur.execute("DELETE FROM verification_audit WHERE unit_id IN (SELECT id FROM vertical_units WHERE parcel_id = %s);", (parcel_id,))
                cur.execute("DELETE FROM source_evidence WHERE unit_id IN (SELECT id FROM vertical_units WHERE parcel_id = %s);", (parcel_id,))
                cur.execute("DELETE FROM vertical_units WHERE parcel_id = %s;", (parcel_id,))
                cur.execute("DELETE FROM buildings WHERE parcel_id = %s;", (parcel_id,))
            else:
                parcel_id = uuid.uuid4()
                # Parcel footprint: 40m x 30m [X: 219430 to 219470, Y: 1932490 to 1932520] (1200.00 sqm)
                parcel_wkt = "POLYGON((219430 1932490, 219470 1932490, 219470 1932520, 219430 1932520, 219430 1932490))"
                cur.execute("""
                    INSERT INTO parcels (
                        id, ulpin_2d, survey_number, district, state, village_code, area_sqm, geom_2d
                    ) VALUES (
                        %s, %s, 'SY-142/2 (Synthetic Demo Parcel)', 'Hyderabad', 'Telangana', 'VIL-HYD-042',
                        1200.00, ST_SetSRID(ST_GeomFromText(%s), 32644)
                    );
                """, (parcel_id, PARCEL_ULPIN, parcel_wkt))
                print(f"Created Parcel: {PARCEL_ULPIN} (ID: {parcel_id})")

            # Create Building APARTMENT-SURYA
            # Building Footprint: 24m x 16m [X: 219438 to 219462, Y: 1932497 to 1932513] (384.00 sqm)
            building_id = uuid.uuid4()
            bldg_footprint_wkt = "POLYGON((219438 1932497, 219462 1932497, 219462 1932513, 219438 1932513, 219438 1932497))"
            cur.execute("""
                INSERT INTO buildings (
                    id, parcel_id, building_code, building_name, total_floors_above, total_floors_below, footprint_2d
                ) VALUES (
                    %s, %s, %s, 'Surya Heights Residential Apartment (Synthetic)', 6, 1,
                    ST_SetSRID(ST_GeomFromText(%s), 32644)
                );
            """, (building_id, parcel_id, BUILDING_CODE, bldg_footprint_wkt))
            print(f"Created Building: {BUILDING_CODE} (ID: {building_id})")

            # Footprint Coordinate rings (EPSG:32644, 24m x 16m)
            main_fp = [
                [219438.0, 1932497.0],
                [219462.0, 1932497.0],
                [219462.0, 1932513.0],
                [219438.0, 1932513.0],
                [219438.0, 1932497.0]
            ]

            unit_definitions = [
                {
                    "tier_code": "SB",
                    "floor_code": "B01",
                    "unit_type": "PARKING",
                    "unit_label": "Basement Parking Level",
                    "z_min": 536.50,
                    "z_max": 540.00,
                    "footprint": main_fp,
                    "source_type": "BIM_IFC",
                    "dataset_name": "Surya_Heights_Structural_Basement_LOD300.ifc (Synthetic)",
                    "file_uri": "bim/surya_heights_substructure_lod300.ifc",
                    "acc_h": 0.02,
                    "acc_v": 0.02,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Subterranean vehicle parking and mechanical storage.",
                        "safety_statement": "LiDAR point clouds cannot establish underground geometry. Basement parking geometry in this research prototype is synthetic architectural/BIM-style demonstration geometry."
                    }
                },
                {
                    "tier_code": "F",
                    "floor_code": "F00",
                    "unit_type": "COMMON_CIRCULATION",
                    "unit_label": "Ground Floor Stilt & Lobby",
                    "z_min": 540.00,
                    "z_max": 543.50,
                    "footprint": main_fp,
                    "source_type": "ARCHITECTURAL_PLAN_2D",
                    "dataset_name": "Surya_Heights_Ground_Stilt_Plan.dwg (Synthetic)",
                    "file_uri": "cad/surya_heights_ground_plan_2026.dwg",
                    "acc_h": 0.05,
                    "acc_v": 0.05,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Ground floor stilt parking bay, entrance lobby and society office."
                    }
                },
                {
                    "tier_code": "F",
                    "floor_code": "F01",
                    "unit_type": "RESIDENTIAL",
                    "unit_label": "Floor 1 Residential Strata (Flats 101-104)",
                    "z_min": 543.50,
                    "z_max": 546.50,
                    "footprint": main_fp,
                    "source_type": "LIDAR_POINTCLOUD",
                    "dataset_name": "Surya_Heights_Airborne_Scan_Flight01.las (Synthetic)",
                    "file_uri": "lidar/surya_heights_flight01.las",
                    "acc_h": 0.04,
                    "acc_v": 0.03,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "First floor multi-dwelling residential strata."
                    }
                },
                {
                    "tier_code": "F",
                    "floor_code": "F02",
                    "unit_type": "RESIDENTIAL",
                    "unit_label": "Floor 2 Residential Strata (Flats 201-204)",
                    "z_min": 546.50,
                    "z_max": 549.50,
                    "footprint": main_fp,
                    "source_type": "LIDAR_POINTCLOUD",
                    "dataset_name": "Surya_Heights_Airborne_Scan_Flight01.las (Synthetic)",
                    "file_uri": "lidar/surya_heights_flight01.las",
                    "acc_h": 0.04,
                    "acc_v": 0.03,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Second floor multi-dwelling residential strata."
                    }
                },
                {
                    "tier_code": "F",
                    "floor_code": "F03",
                    "unit_type": "RESIDENTIAL",
                    "unit_label": "Floor 3 Residential Strata (Flats 301-304)",
                    "z_min": 549.50,
                    "z_max": 552.50,
                    "footprint": main_fp,
                    "source_type": "LIDAR_POINTCLOUD",
                    "dataset_name": "Surya_Heights_Airborne_Scan_Flight01.las (Synthetic)",
                    "file_uri": "lidar/surya_heights_flight01.las",
                    "acc_h": 0.04,
                    "acc_v": 0.03,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Third floor multi-dwelling residential strata."
                    }
                },
                {
                    "tier_code": "F",
                    "floor_code": "F04",
                    "unit_type": "RESIDENTIAL",
                    "unit_label": "Floor 4 Residential Strata (Flats 401-404)",
                    "z_min": 552.50,
                    "z_max": 555.50,
                    "footprint": main_fp,
                    "source_type": "LIDAR_POINTCLOUD",
                    "dataset_name": "Surya_Heights_Airborne_Scan_Flight01.las (Synthetic)",
                    "file_uri": "lidar/surya_heights_flight01.las",
                    "acc_h": 0.04,
                    "acc_v": 0.03,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Fourth floor multi-dwelling residential strata."
                    }
                },
                {
                    "tier_code": "F",
                    "floor_code": "F05",
                    "unit_type": "RESIDENTIAL",
                    "unit_label": "Floor 5 Residential Strata (Flats 501-504)",
                    "z_min": 555.50,
                    "z_max": 558.50,
                    "footprint": main_fp,
                    "source_type": "LIDAR_POINTCLOUD",
                    "dataset_name": "Surya_Heights_Airborne_Scan_Flight01.las (Synthetic)",
                    "file_uri": "lidar/surya_heights_flight01.las",
                    "acc_h": 0.04,
                    "acc_v": 0.03,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Fifth floor multi-dwelling residential strata."
                    }
                },
                {
                    "tier_code": "AR",
                    "floor_code": "RF01",
                    "unit_type": "COMMON_CIRCULATION",
                    "unit_label": "Rooftop Common Terrace & Solar",
                    "z_min": 558.50,
                    "z_max": 561.50,
                    "footprint": main_fp,
                    "source_type": "DRONE_PHOTOGRAMMETRY",
                    "dataset_name": "Surya_Heights_Roof_UAV_Mesh.obj (Synthetic)",
                    "file_uri": "photogrammetry/surya_heights_roof_mesh.obj",
                    "acc_h": 0.05,
                    "acc_v": 0.05,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Rooftop community terrace, solar panel grid, and lift machine room."
                    }
                }
            ]

            for u_def in unit_definitions:
                # Concurrency-safe sequence allocation
                cur.execute("SELECT nextval('vertical_unit_seq');")
                seq_val = cur.fetchone()[0]
                
                tier = u_def["tier_code"]
                proto_ulpin = f"{PARCEL_ULPIN}-3D-{tier}-{seq_val:04d}"
                unit_id = uuid.uuid4()

                # Build watertight 3D PolyhedralSurface WKT
                wkt, _ = build_polyhedralsurface_wkt_from_footprint(
                    u_def["footprint"],
                    u_def["z_min"],
                    u_def["z_max"]
                )

                unit_seq = (seq_val - 1) % 9999 + 1
                # Insert vertical unit strictly as PROPOSED
                cur.execute("""
                    INSERT INTO vertical_units (
                        id, parcel_id, building_id, prototype_ulpin_3d, tier_code, floor_code,
                        unit_sequence, unit_label, unit_type, z_min, z_max, geom_3d, status
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, ST_SetSRID(ST_GeomFromText(%s), 32644), 'PROPOSED'
                    );
                """, (
                    unit_id, parcel_id, building_id, proto_ulpin, tier, u_def["floor_code"],
                    unit_seq, u_def["unit_label"], u_def["unit_type"], u_def["z_min"], u_def["z_max"],
                    wkt
                ))

                # Attach source evidence
                evidence_id = uuid.uuid4()
                cur.execute("""
                    INSERT INTO source_evidence (
                        id, unit_id, source_type, dataset_name, file_uri,
                        accuracy_horizontal_m, accuracy_vertical_m, metadata_json
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s, %s, %s
                    );
                """, (
                    evidence_id, unit_id, u_def["source_type"], u_def["dataset_name"], u_def["file_uri"],
                    u_def["acc_h"], u_def["acc_v"], json.dumps(u_def["meta"])
                ))

                # Attach initial AUTO_INGESTION verification audit
                audit_id = uuid.uuid4()
                cur.execute("""
                    INSERT INTO verification_audit (
                        id, unit_id, action, previous_status, new_status,
                        reviewer_name, reviewer_role, review_notes, integrity_hash
                    ) VALUES (
                        %s, %s, 'AUTO_INGESTION', 'PROPOSED', 'PROPOSED',
                        'Multi-Tier Decomposition Engine (Synthetic)', 'SYSTEM_VALIDATOR',
                        %s, %s
                    );
                """, (
                    audit_id, unit_id,
                    f"Automated ingestion of {u_def['floor_code']} canonical strata. Initialized as PROPOSED.",
                    f"syn_hash_auto_{proto_ulpin}"
                ))

                print(f"  Inserted Unit {u_def['floor_code']} (Seq {seq_val}): {proto_ulpin} | Status: PROPOSED")

            conn.commit()
            print("--- Successfully Persisted Canonical Indian Apartment (Surya Heights) Scenario ---")

    except Exception as e:
        conn.rollback()
        print(f"Error seeding Canonical Indian Apartment: {e}")
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    seed_canonical_indian_apartment()
