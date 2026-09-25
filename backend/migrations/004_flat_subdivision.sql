-- ============================================================================
-- SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
-- Migration: 004_flat_subdivision.sql
-- Description: Schema extension supporting hierarchical 3D spatial units (Flats/Apartments)
-- Scope: Research Prototype
-- ============================================================================

-- 1. Add hierarchical columns to vertical_units
ALTER TABLE vertical_units
    ADD COLUMN IF NOT EXISTS parent_unit_id UUID REFERENCES vertical_units(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS unit_level VARCHAR(32) NOT NULL DEFAULT 'STOREY',
    ADD COLUMN IF NOT EXISTS flat_number VARCHAR(16);

-- Ensure column length is at least VARCHAR(32)
ALTER TABLE vertical_units
    ALTER COLUMN unit_level TYPE VARCHAR(32);

-- 2. Check Constraint on unit_level
DO $$ BEGIN
    ALTER TABLE vertical_units
        ADD CONSTRAINT chk_unit_level_valid
        CHECK (unit_level IN ('STOREY', 'FLAT', 'COMMON_CIRCULATION', 'COMMON_ELEMENT'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Ensure existing records have unit_level = 'STOREY'
UPDATE vertical_units
SET unit_level = 'STOREY'
WHERE unit_level IS NULL;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_vertical_units_parent_unit_id ON vertical_units(parent_unit_id);
CREATE INDEX IF NOT EXISTS idx_vertical_units_unit_level ON vertical_units(unit_level);
CREATE INDEX IF NOT EXISTS idx_vertical_units_flat_number ON vertical_units(flat_number);
