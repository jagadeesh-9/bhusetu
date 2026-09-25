-- ============================================================================
-- SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
-- Migration: 001_initial_schema.sql
-- Description: Core relational and 3D spatial schema (PostGIS/SFCGAL, EPSG:32644)
-- Scope: Research Prototype Schema
-- ============================================================================

-- 1. Spatial Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_sfcgal;

-- 2. Enumerated Domain Types
DO $$ BEGIN
    CREATE TYPE tier_code_type AS ENUM ('SB', 'UT', 'F', 'AE', 'AR', 'CM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE unit_type_category AS ENUM (
        'RESIDENTIAL',
        'COMMERCIAL',
        'PARKING',
        'UTILITY_CORRIDOR',
        'TRANSIT_CORRIDOR',
        'AIR_RIGHTS',
        'COMMON_CIRCULATION'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lifecycle_status_type AS ENUM (
        'PROPOSED',
        'UNDER_REVIEW',
        'VERIFIED',
        'REJECTED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE source_evidence_type AS ENUM (
        'BIM_IFC',
        'CITYJSON_LOD2',
        'LIDAR_POINTCLOUD',
        'DRONE_PHOTOGRAMMETRY',
        'ARCHITECTURAL_PLAN_2D',
        'CORS_GNSS_SURVEY',
        'MANUAL_DIGITIZED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_action_type AS ENUM (
        'AUTO_INGESTION',
        'TOPOLOGY_CHECK_PASS',
        'TOPOLOGY_CHECK_FAIL',
        'SURVEYOR_REVIEW',
        'OFFICIAL_APPROVAL',
        'REJECTION'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE reviewer_role_type AS ENUM (
        'SYSTEM_VALIDATOR',
        'LICENSED_SURVEYOR',
        'REVENUE_OFFICIAL'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Base Terrestrial Parcels Table
CREATE TABLE IF NOT EXISTS parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ulpin_2d VARCHAR(14) NOT NULL UNIQUE,
    survey_number VARCHAR(64) NOT NULL,
    district VARCHAR(64) NOT NULL,
    state VARCHAR(64) NOT NULL,
    village_code VARCHAR(32),
    area_sqm NUMERIC(12, 2) NOT NULL,
    geom_2d GEOMETRY(Polygon, 32644) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_parcel_area_positive CHECK (area_sqm > 0),
    CONSTRAINT chk_parcel_geom_2d_dim CHECK (ST_Dimension(geom_2d) = 2),
    CONSTRAINT chk_parcel_ulpin_len CHECK (length(ulpin_2d) = 14)
);

-- 4. Buildings Table (Structural Envelopes on Parcel)
CREATE TABLE IF NOT EXISTS buildings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE RESTRICT,
    building_code VARCHAR(32) NOT NULL,
    building_name VARCHAR(128) NOT NULL,
    total_floors_above INT NOT NULL DEFAULT 1,
    total_floors_below INT NOT NULL DEFAULT 0,
    footprint_2d GEOMETRY(Polygon, 32644) NOT NULL,
    envelope_3d GEOMETRY(PolyhedralSurfaceZ, 32644),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unq_building_code_per_parcel UNIQUE (parcel_id, building_code),
    CONSTRAINT chk_floors_non_negative CHECK (total_floors_above >= 0 AND total_floors_below >= 0),
    CONSTRAINT chk_building_footprint_2d_dim CHECK (ST_Dimension(footprint_2d) = 2)
);

-- 5. Vertical Units Table (Canonical 3D Spatial Units)
CREATE TABLE IF NOT EXISTS vertical_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE RESTRICT,
    building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
    prototype_ulpin_3d VARCHAR(64) NOT NULL UNIQUE,
    tier_code tier_code_type NOT NULL,
    floor_code VARCHAR(16) NOT NULL,
    unit_sequence INT NOT NULL,
    unit_label VARCHAR(64) NOT NULL,
    unit_type unit_type_category NOT NULL,
    z_min NUMERIC(10, 2) NOT NULL,
    z_max NUMERIC(10, 2) NOT NULL,
    geom_3d GEOMETRY(PolyhedralSurfaceZ, 32644) NOT NULL,
    status lifecycle_status_type NOT NULL DEFAULT 'PROPOSED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unq_unit_seq_per_parcel_tier UNIQUE (parcel_id, tier_code, unit_sequence),
    CONSTRAINT chk_z_min_lt_z_max CHECK (z_min < z_max),
    CONSTRAINT chk_unit_sequence_range CHECK (unit_sequence BETWEEN 1 AND 9999)
);

-- 6. Source Evidence Table (Lineage & Extraction Provenance)
CREATE TABLE IF NOT EXISTS source_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES vertical_units(id) ON DELETE CASCADE,
    source_type source_evidence_type NOT NULL,
    dataset_name VARCHAR(128) NOT NULL,
    file_uri VARCHAR(256) NOT NULL,
    accuracy_horizontal_m NUMERIC(6, 3),
    accuracy_vertical_m NUMERIC(6, 3),
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Verification Audit Table (Human-in-the-Loop Audit Trail)
CREATE TABLE IF NOT EXISTS verification_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES vertical_units(id) ON DELETE RESTRICT,
    action audit_action_type NOT NULL,
    previous_status lifecycle_status_type NOT NULL,
    new_status lifecycle_status_type NOT NULL,
    reviewer_name VARCHAR(128) NOT NULL,
    reviewer_role reviewer_role_type NOT NULL,
    review_notes TEXT,
    integrity_hash VARCHAR(64),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_system_cannot_verify CHECK (
        NOT (new_status = 'VERIFIED' AND reviewer_role = 'SYSTEM_VALIDATOR')
    )
);

-- 8. Spatial and Performance Indexes
CREATE INDEX IF NOT EXISTS idx_parcels_geom_2d ON parcels USING GIST(geom_2d);
CREATE INDEX IF NOT EXISTS idx_buildings_footprint_2d ON buildings USING GIST(footprint_2d);
CREATE INDEX IF NOT EXISTS idx_vertical_units_geom_3d ON vertical_units USING GIST(geom_3d);

CREATE INDEX IF NOT EXISTS idx_buildings_parcel_id ON buildings(parcel_id);
CREATE INDEX IF NOT EXISTS idx_vertical_units_parcel_tier_seq ON vertical_units(parcel_id, tier_code, unit_sequence);
CREATE INDEX IF NOT EXISTS idx_vertical_units_z_range ON vertical_units(z_min, z_max);
CREATE INDEX IF NOT EXISTS idx_vertical_units_status ON vertical_units(status);
CREATE INDEX IF NOT EXISTS idx_source_evidence_unit_id ON source_evidence(unit_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_unit_id ON verification_audit(unit_id);
