"""
SIH26011 Phase 2.8: Seed Persistent VERTICAL-MIXED-A Synthetic Demonstration Dataset.

Inserts:
1. Synthetic Base Parcel '27A8B9C3D4E5F7' (SYN-PLOT-43/6, 800.00 sqm, EPSG:32644)
2. Synthetic Building 'MIXED-TOWER-A' (Tech Vertical Mixed-Use Complex A)
3. 10 Comprehensive 3D Vertical Units demonstrating all required property categories:
   - UT01: Subsurface Utility Conduit [Z 532.0 - 534.0] (UT + UTILITY_CORRIDOR)
   - B02: Underground Parking Facility [Z 534.0 - 537.0] (SB + PARKING)
   - B01: Basement Commercial & Storage [Z 537.0 - 540.0] (SB + COMMERCIAL)
   - F00: Ground Floor Commercial Lobby [Z 540.0 - 543.5] (F + COMMERCIAL)
   - P00: Ground Open Parking Bay [Z 540.0 - 543.5, non-overlapping side quadrant] (F + PARKING)
   - CM01: Common Circulation Core & Lift Shaft [Z 540.0 - 549.5, central circulation core] (CM + COMMON_CIRCULATION)
   - F01: Upper Residential Storey Floor 1 [Z 543.5 - 546.5] (F + RESIDENTIAL)
   - F02: Upper Residential Storey Floor 2 [Z 546.5 - 549.5] (F + RESIDENTIAL)
   - RF01: Rooftop Solar Array & Terrace [Z 549.5 - 552.0, recessed roof core] (AR + COMMON_CIRCULATION)
   - AE01: Elevated Skybridge / Air-Rights Corridor [Z 546.5 - 549.5, cantilevered skybridge] (AE + AIR_RIGHTS)
4. Associated Source Evidence records (BIM, Utility Survey CAD, LiDAR, Photogrammetry) marked as SYNTHETIC.
5. Associated Verification Audit records initialized strictly in PROPOSED status with SYSTEM_VALIDATOR.

DISCLAIMER:
All records are strictly synthetic research prototype data.
Does not represent official Government of India ULPINs or legal land titles.
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

PARCEL_ULPIN = "27A8B9C3D4E5F7"
BUILDING_CODE = "MIXED-TOWER-A"

def seed_vertical_mixed_a():
    conn_str = os.getenv("DATABASE_URL", "postgresql://postgres:8919223622@localhost:5432/sih26011_dev")
    if conn_str.startswith("postgresql+psycopg://"):
        conn_str = conn_str.replace("postgresql+psycopg://", "postgresql://")
    
    conn = psycopg.connect(conn_str)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            print("--- Seeding VERTICAL-MIXED-A Synthetic Demonstration Dataset ---")

            # Check if parcel already exists
            cur.execute("SELECT id FROM parcels WHERE ulpin_2d = %s;", (PARCEL_ULPIN,))
            p_row = cur.fetchone()
            if p_row:
                parcel_id = p_row[0]
                print(f"Parcel {PARCEL_ULPIN} already exists (ID: {parcel_id}). Cleaning previous child records...")
                # Delete previous child units for idempotent re-seeding
                cur.execute("DELETE FROM verification_audit WHERE unit_id IN (SELECT id FROM vertical_units WHERE parcel_id = %s);", (parcel_id,))
                cur.execute("DELETE FROM source_evidence WHERE unit_id IN (SELECT id FROM vertical_units WHERE parcel_id = %s);", (parcel_id,))
                cur.execute("DELETE FROM vertical_units WHERE parcel_id = %s;", (parcel_id,))
                cur.execute("DELETE FROM buildings WHERE parcel_id = %s;", (parcel_id,))
                # Reset sequence to 7 for consistent clean re-seeding
                cur.execute("SELECT setval('vertical_unit_seq', 7, false);")
            else:
                parcel_id = uuid.uuid4()
                # Parcel footprint: 40m x 25m [X: 219440 to 219480, Y: 1932500 to 1932525]
                parcel_wkt = "POLYGON((219440 1932500, 219480 1932500, 219480 1932525, 219440 1932525, 219440 1932500))"
                cur.execute("""
                    INSERT INTO parcels (
                        id, ulpin_2d, survey_number, district, state, village_code, area_sqm, geom_2d
                    ) VALUES (
                        %s, %s, 'SYN-PLOT-43/6', 'Hyderabad-Synthetic', 'Telangana-Synthetic', 'SYN-VIL-001',
                        800.00, ST_SetSRID(ST_GeomFromText(%s), 32644)
                    );
                """, (parcel_id, PARCEL_ULPIN, parcel_wkt))
                print(f"Created Parcel: {PARCEL_ULPIN} (ID: {parcel_id})")

            # Create Building MIXED-TOWER-A
            # Main Building Footprint: 20m x 15m [X: 219445 to 219465, Y: 1932505 to 1932520]
            building_id = uuid.uuid4()
            bldg_footprint_wkt = "POLYGON((219445 1932505, 219465 1932505, 219465 1932520, 219445 1932520, 219445 1932505))"
            cur.execute("""
                INSERT INTO buildings (
                    id, parcel_id, building_code, building_name, total_floors_above, total_floors_below, footprint_2d
                ) VALUES (
                    %s, %s, %s, 'Tech Vertical Mixed-Use Complex A (Synthetic)', 4, 2,
                    ST_SetSRID(ST_GeomFromText(%s), 32644)
                );
            """, (building_id, parcel_id, BUILDING_CODE, bldg_footprint_wkt))
            print(f"Created Building: {BUILDING_CODE} (ID: {building_id})")

            # Footprint Coordinate rings (EPSG:32644)
            main_fp = [
                [219445.0, 1932505.0],
                [219465.0, 1932505.0],
                [219465.0, 1932520.0],
                [219445.0, 1932520.0],
                [219445.0, 1932505.0]
            ]
            
            # Ground Open Parking side quadrant (X: 219466.0 to 219478.0, Y: 1932505.0 to 1932520.0)
            open_parking_fp = [
                [219466.0, 1932505.0],
                [219478.0, 1932505.0],
                [219478.0, 1932520.0],
                [219466.0, 1932520.0],
                [219466.0, 1932505.0]
            ]

            # Subsurface utility trench (X: 219441.0 to 219444.0, Y: 1932505.0 to 1932520.0)
            utility_fp = [
                [219441.0, 1932505.0],
                [219444.0, 1932505.0],
                [219444.0, 1932520.0],
                [219441.0, 1932520.0],
                [219441.0, 1932505.0]
            ]

            # Rooftop recessed structure (X: 219449.0 to 219461.0, Y: 1932507.5 to 1932517.5)
            rooftop_fp = [
                [219449.0, 1932507.5],
                [219461.0, 1932507.5],
                [219461.0, 1932517.5],
                [219449.0, 1932517.5],
                [219449.0, 1932507.5]
            ]

            # Elevated Skybridge corridor (X: 219465.0 to 219476.0, Y: 1932510.0 to 1932515.0)
            skybridge_fp = [
                [219465.0, 1932510.0],
                [219476.0, 1932510.0],
                [219476.0, 1932515.0],
                [219465.0, 1932515.0],
                [219465.0, 1932510.0]
            ]

            # Dedicated Common Circulation Core (X: 219445.0 to 219449.0, Y: 1932510.0 to 1932515.0)
            # Distinct internal circulation shaft zone
            circulation_fp = [
                [219445.0, 1932510.0],
                [219449.0, 1932510.0],
                [219449.0, 1932515.0],
                [219445.0, 1932515.0],
                [219445.0, 1932510.0]
            ]

            unit_definitions = [
                {
                    "tier_code": "UT",
                    "floor_code": "UT01",
                    "unit_type": "UTILITY_CORRIDOR",
                    "unit_label": "Subsurface Utility Conduit & Pipeline Trench",
                    "z_min": 532.00,
                    "z_max": 534.00,
                    "footprint": utility_fp,
                    "source_type": "ARCHITECTURAL_PLAN_2D",
                    "dataset_name": "Municipal Subsurface Utility Survey CAD (Synthetic)",
                    "file_uri": "cad/municipal_utility_dwg_2026.dwg",
                    "acc_h": 0.05,
                    "acc_v": 0.05,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Subsurface municipal pipe and power utility conduit."
                    }
                },
                {
                    "tier_code": "SB",
                    "floor_code": "B02",
                    "unit_type": "PARKING",
                    "unit_label": "Underground Parking Facility (Level -2)",
                    "z_min": 534.00,
                    "z_max": 537.00,
                    "footprint": main_fp,
                    "source_type": "BIM_IFC",
                    "dataset_name": "Substructure Structural BIM IFC4 (Synthetic)",
                    "file_uri": "bim/mixed_tower_a_substructure_lod300.ifc",
                    "acc_h": 0.02,
                    "acc_v": 0.02,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Subterranean multi-level basement parking."
                    }
                },
                {
                    "tier_code": "SB",
                    "floor_code": "B01",
                    "unit_type": "COMMERCIAL",
                    "unit_label": "Basement Commercial & Storage Strata (Level -1)",
                    "z_min": 537.00,
                    "z_max": 540.00,
                    "footprint": main_fp,
                    "source_type": "BIM_IFC",
                    "dataset_name": "Substructure Structural BIM IFC4 (Synthetic)",
                    "file_uri": "bim/mixed_tower_a_substructure_lod300.ifc",
                    "acc_h": 0.02,
                    "acc_v": 0.02,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Subterranean commercial storage and server room strata."
                    }
                },
                {
                    "tier_code": "F",
                    "floor_code": "F00",
                    "unit_type": "COMMERCIAL",
                    "unit_label": "Ground Floor Commercial Lobby & Retail Strata",
                    "z_min": 540.00,
                    "z_max": 543.50,
                    "footprint": main_fp,
                    "source_type": "LIDAR_POINTCLOUD",
                    "dataset_name": "Airborne LiDAR Structural Scan Flight 02 (Synthetic)",
                    "file_uri": "lidar/pointclouds/mixed_tower_a_flight02.las",
                    "acc_h": 0.04,
                    "acc_v": 0.03,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Ground floor commercial atrium and reception lobby."
                    }
                },
                {
                    "tier_code": "F",
                    "floor_code": "P00",
                    "unit_type": "PARKING",
                    "unit_label": "Ground Open Parking & EV Charging Bay",
                    "z_min": 540.00,
                    "z_max": 543.50,
                    "footprint": open_parking_fp,
                    "source_type": "ARCHITECTURAL_PLAN_2D",
                    "dataset_name": "Approved Surface Site Plan & Parking Layout (Synthetic)",
                    "file_uri": "cad/approved_site_plan_2026.dwg",
                    "acc_h": 0.05,
                    "acc_v": 0.05,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Ground surface open parking bay with EV charging stations."
                    }
                },
                {
                    "tier_code": "CM",
                    "floor_code": "CM01",
                    "unit_type": "COMMON_CIRCULATION",
                    "unit_label": "Common Circulation Core & Lift Shaft",
                    "z_min": 540.00,
                    "z_max": 549.50,
                    "footprint": circulation_fp,
                    "source_type": "BIM_IFC",
                    "dataset_name": "Architectural Circulation BIM Model (Synthetic)",
                    "file_uri": "bim/mixed_tower_a_circulation_lod300.ifc",
                    "acc_h": 0.02,
                    "acc_v": 0.02,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Dedicated central lift shaft and fire stair core."
                    }
                },
                {
                    "tier_code": "F",
                    "floor_code": "F01",
                    "unit_type": "RESIDENTIAL",
                    "unit_label": "Upper Residential Storey (Floor 1)",
                    "z_min": 543.50,
                    "z_max": 546.50,
                    "footprint": main_fp,
                    "source_type": "LIDAR_POINTCLOUD",
                    "dataset_name": "Airborne LiDAR Structural Scan Flight 02 (Synthetic)",
                    "file_uri": "lidar/pointclouds/mixed_tower_a_flight02.las",
                    "acc_h": 0.04,
                    "acc_v": 0.03,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "First floor multi-dwelling residential units."
                    }
                },
                {
                    "tier_code": "F",
                    "floor_code": "F02",
                    "unit_type": "RESIDENTIAL",
                    "unit_label": "Upper Residential Storey (Floor 2)",
                    "z_min": 546.50,
                    "z_max": 549.50,
                    "footprint": main_fp,
                    "source_type": "LIDAR_POINTCLOUD",
                    "dataset_name": "Airborne LiDAR Structural Scan Flight 02 (Synthetic)",
                    "file_uri": "lidar/pointclouds/mixed_tower_a_flight02.las",
                    "acc_h": 0.04,
                    "acc_v": 0.03,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Second floor multi-dwelling residential units."
                    }
                },
                {
                    "tier_code": "AR",
                    "floor_code": "RF01",
                    "unit_type": "COMMON_CIRCULATION",
                    "unit_label": "Rooftop Common Solar Array & Terrace Space",
                    "z_min": 549.50,
                    "z_max": 552.00,
                    "footprint": rooftop_fp,
                    "source_type": "DRONE_PHOTOGRAMMETRY",
                    "dataset_name": "UAV High-Resolution Roof Photogrammetry (Synthetic)",
                    "file_uri": "photogrammetry/mixed_tower_a_roof_mesh.obj",
                    "acc_h": 0.05,
                    "acc_v": 0.05,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Rooftop community garden, solar installation, and maintenance zone."
                    }
                },
                {
                    "tier_code": "AE",
                    "floor_code": "AE01",
                    "unit_type": "AIR_RIGHTS",
                    "unit_label": "Elevated Skybridge / Air-Rights Corridor",
                    "z_min": 546.50,
                    "z_max": 549.50,
                    "footprint": skybridge_fp,
                    "source_type": "BIM_IFC",
                    "dataset_name": "Structural Skybridge BIM Model (Synthetic)",
                    "file_uri": "bim/mixed_tower_a_skybridge_lod300.ifc",
                    "acc_h": 0.02,
                    "acc_v": 0.02,
                    "meta": {
                        "is_synthetic": True,
                        "prototype_only": True,
                        "description": "Elevated pedestrian skybridge connecting to adjacent structural node."
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
                    seq_val, u_def["unit_label"], u_def["unit_type"], u_def["z_min"], u_def["z_max"],
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
                    f"Automated ingestion of {u_def['floor_code']} candidate strata. Initialized as PROPOSED.",
                    f"syn_hash_auto_{proto_ulpin}"
                ))

                print(f"  Inserted Unit {u_def['floor_code']} (Seq {seq_val}): {proto_ulpin} | Status: PROPOSED")

            conn.commit()
            print("--- Successfully Persisted VERTICAL-MIXED-A Scenario ---")

    except Exception as e:
        conn.rollback()
        print(f"Error seeding VERTICAL-MIXED-A: {e}")
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    seed_vertical_mixed_a()
