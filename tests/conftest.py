"""
SIH26011 Test Configuration & Session Fixtures
Ensures test isolation and database integrity across test runs.
"""
import pytest
from sqlalchemy import text
from backend.app.db import SessionLocal


def _reset_db_state():
    from scripts.seed_canonical_indian_apartment import seed_canonical_indian_apartment
    from scripts.seed_osm_anchored_apartment import seed_osm_anchored_apartment
    from scripts.seed_f01_flats import seed_f01_flats
    seed_canonical_indian_apartment()
    seed_osm_anchored_apartment()
    seed_f01_flats()
    db = SessionLocal()
    try:
        # Clean up ephemeral test parcels and dynamic candidates
        db.execute(text("""
            DELETE FROM verification_audit WHERE unit_id IN (
                SELECT vu.id FROM vertical_units vu
                JOIN parcels p ON vu.parcel_id = p.id
                WHERE p.ulpin_2d LIKE 'PARCEL-OSM-%' OR p.ulpin_2d LIKE 'TEST-%' OR p.ulpin_2d LIKE 'SY-PROP-%' OR p.village_code = 'VIL-HYD-OSM'
            );
            DELETE FROM source_evidence WHERE unit_id IN (
                SELECT vu.id FROM vertical_units vu
                JOIN parcels p ON vu.parcel_id = p.id
                WHERE p.ulpin_2d LIKE 'PARCEL-OSM-%' OR p.ulpin_2d LIKE 'TEST-%' OR p.ulpin_2d LIKE 'SY-PROP-%' OR p.village_code = 'VIL-HYD-OSM'
            );
            DELETE FROM vertical_units WHERE parcel_id IN (
                SELECT id FROM parcels WHERE ulpin_2d LIKE 'PARCEL-OSM-%' OR ulpin_2d LIKE 'TEST-%' OR ulpin_2d LIKE 'SY-PROP-%' OR village_code = 'VIL-HYD-OSM'
            );
            DELETE FROM buildings WHERE parcel_id IN (
                SELECT id FROM parcels WHERE ulpin_2d LIKE 'PARCEL-OSM-%' OR ulpin_2d LIKE 'TEST-%' OR ulpin_2d LIKE 'SY-PROP-%' OR village_code = 'VIL-HYD-OSM'
            ) OR building_code LIKE 'BLDG-OSM-%' OR building_code LIKE 'TEST-%' OR building_code LIKE 'BLDG-PROP-%';
            DELETE FROM parcels WHERE ulpin_2d LIKE 'PARCEL-OSM-%' OR ulpin_2d LIKE 'TEST-%' OR ulpin_2d LIKE 'SY-PROP-%' OR village_code = 'VIL-HYD-OSM';
        """))
        db.execute(text("UPDATE vertical_units SET status = 'VERIFIED' WHERE unit_sequence = 1"))
        db.execute(text("UPDATE vertical_units SET status = 'VERIFIED' WHERE unit_sequence = 2"))
        db.execute(text("UPDATE vertical_units SET status = 'VERIFIED' WHERE unit_sequence = 3"))
        db.execute(text("UPDATE vertical_units SET status = 'UNDER_REVIEW' WHERE unit_sequence = 4"))
        db.execute(text("UPDATE vertical_units SET status = 'PROPOSED' WHERE unit_sequence = 5"))
        db.execute(text("UPDATE vertical_units SET status = 'REJECTED' WHERE unit_sequence = 6"))
        db.execute(text("UPDATE vertical_units SET status = 'PROPOSED' WHERE unit_sequence >= 7"))

        # Reset vertical_unit_seq to the current MAX so future inserts stay within
        # the chk_unit_sequence_range constraint (BETWEEN 1 AND 9999).
        db.execute(text(
            "SELECT setval('vertical_unit_seq', COALESCE((SELECT MAX(unit_sequence) FROM vertical_units), 16))"
        ))

        db.commit()
        db.execute(text("""
            INSERT INTO source_evidence (id, unit_id, source_type, dataset_name, file_uri, accuracy_horizontal_m, accuracy_vertical_m, metadata_json)
            SELECT gen_random_uuid(), vu.id, 'MANUAL_DIGITIZED', 'Baseline Cadastral Plan', 'https://cadastre.gov.in/baseline.pdf', 0.05, 0.02, '{"source": "baseline"}'::jsonb
            FROM vertical_units vu
            LEFT JOIN source_evidence se ON vu.id = se.unit_id
            WHERE se.id IS NULL
        """))
        db.execute(text("""
            INSERT INTO verification_audit (id, unit_id, action, previous_status, new_status, reviewer_name, reviewer_role, review_notes, integrity_hash)
            SELECT gen_random_uuid(), vu.id, 'AUTO_INGESTION', vu.status, vu.status, 
                CASE WHEN vu.status = 'VERIFIED' THEN 'Govt Cadastral Surveyor' ELSE 'System Ingestion' END,
                CASE WHEN vu.status = 'VERIFIED' THEN 'LICENSED_SURVEYOR'::reviewer_role_type ELSE 'SYSTEM_VALIDATOR'::reviewer_role_type END,
                'Baseline initialization', 'hash_' || vu.prototype_ulpin_3d
            FROM vertical_units vu
            LEFT JOIN verification_audit va ON vu.id = va.unit_id
            WHERE va.id IS NULL
        """))
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


@pytest.fixture(scope="module", autouse=True)
def setup_and_teardown_module():
    _reset_db_state()
    yield
    _reset_db_state()

