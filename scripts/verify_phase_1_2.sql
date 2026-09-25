-- ============================================================================
-- SIH26011: Phase 1.2 Database & Geometry Verification Script
-- Scope: Read-Only Verification
-- Note: Uses modern SFCGAL CG_* functions and 2D footprint envelope projection
-- ============================================================================

\echo '========================================='
\echo '1. ROW COUNTS'
\echo '========================================='
SELECT 
    (SELECT count(*) FROM parcels) AS parcel_count,
    (SELECT count(*) FROM buildings) AS building_count,
    (SELECT count(*) FROM vertical_units) AS unit_count,
    (SELECT count(*) FROM source_evidence) AS source_evidence_count,
    (SELECT count(*) FROM verification_audit) AS audit_count;

\echo '========================================='
\echo '2. VERTICAL UNITS & LIFECYCLE SUMMARY'
\echo '========================================='
SELECT 
    prototype_ulpin_3d,
    tier_code,
    floor_code,
    unit_sequence,
    unit_label,
    unit_type,
    z_min,
    z_max,
    status
FROM vertical_units
ORDER BY unit_sequence;

\echo '========================================='
\echo '3. GEOMETRY TYPES & SRID'
\echo '========================================='
SELECT 
    'parcels' AS table_name,
    'geom_2d' AS column_name,
    GeometryType(geom_2d) AS geom_type,
    ST_SRID(geom_2d) AS srid,
    ST_Dimension(geom_2d) AS dimension
FROM parcels
UNION ALL
SELECT 
    'buildings',
    'footprint_2d',
    GeometryType(footprint_2d),
    ST_SRID(footprint_2d),
    ST_Dimension(footprint_2d)
FROM buildings
UNION ALL
SELECT 
    'vertical_units',
    'geom_3d',
    GeometryType(geom_3d),
    ST_SRID(geom_3d),
    ST_Dimension(geom_3d)
FROM vertical_units
LIMIT 3;

\echo '========================================='
\echo '4. 3D GEOMETRY VALIDITY & VOLUMES (CG_* FUNCTIONS)'
\echo '========================================='
-- Modernized to use SFCGAL CG_MakeSolid, CG_IsSolid, CG_Volume
SELECT 
    prototype_ulpin_3d,
    ST_IsClosed(geom_3d) AS is_closed,
    CG_IsSolid(CG_MakeSolid(geom_3d)) AS is_solid,
    ROUND(CG_Volume(CG_MakeSolid(geom_3d))::numeric, 2) AS volume_cbm,
    ST_ZMin(geom_3d) AS z_min_computed,
    ST_ZMax(geom_3d) AS z_max_computed,
    (z_min = ST_ZMin(geom_3d) AND z_max = ST_ZMax(geom_3d)) AS z_bracket_matches
FROM vertical_units
ORDER BY unit_sequence;

\echo '========================================='
\echo '5. 3D VOLUMETRIC COLLISION MATRIX'
\echo '========================================='
SELECT 
    u1.prototype_ulpin_3d AS unit_a,
    u2.prototype_ulpin_3d AS unit_b,
    ST_3DIntersects(u1.geom_3d, u2.geom_3d) AS intersects_3d
FROM vertical_units u1
JOIN vertical_units u2 ON u1.unit_sequence < u2.unit_sequence
ORDER BY u1.unit_sequence, u2.unit_sequence;

\echo '========================================='
\echo '6. 2D PARCEL CONTAINMENT & CONFLICT TEST'
\echo '========================================='
-- Uses ST_Envelope(u.geom_3d) to extract horizontal 2D bounding projection
-- without passing raw 3D PolyhedralSurface directly to GEOS 2D engine
SELECT 
    u.prototype_ulpin_3d,
    u.status,
    ST_Within(ST_Envelope(u.geom_3d), p.geom_2d) AS is_within_parcel_footprint
FROM vertical_units u
JOIN parcels p ON u.parcel_id = p.id
ORDER BY u.unit_sequence;

\echo '========================================='
\echo '7. SOURCE EVIDENCE & PROTOTYPE AUDIT LINKAGES'
\echo '========================================='
SELECT 
    u.prototype_ulpin_3d,
    e.source_type,
    e.dataset_name,
    a.action,
    a.new_status,
    a.reviewer_role,
    a.reviewer_name
FROM vertical_units u
LEFT JOIN source_evidence e ON u.id = e.unit_id
LEFT JOIN verification_audit a ON u.id = a.unit_id
ORDER BY u.unit_sequence;
