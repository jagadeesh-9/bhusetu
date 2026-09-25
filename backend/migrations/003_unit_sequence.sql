-- ============================================================================
-- SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
-- Migration: 003_unit_sequence.sql
-- Description: Concurrency-safe sequence for prototype 3D ULPIN unit_sequence allocation
-- Scope: Research Prototype
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS vertical_unit_seq START WITH 7;

-- Synchronize sequence with current maximum unit_sequence in vertical_units
SELECT setval(
    'vertical_unit_seq',
    GREATEST(COALESCE((SELECT MAX(unit_sequence) FROM vertical_units), 0) + 1, 7),
    false
);
