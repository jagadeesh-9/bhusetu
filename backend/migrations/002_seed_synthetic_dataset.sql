-- ============================================================================
-- SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
-- Migration: 002_seed_synthetic_dataset.sql
-- Description: Minimal synthetic seed dataset and geometry fixtures (EPSG:32644)
-- Scope: Research Prototype Synthetic Demonstration Fixtures
-- Notice: ALL identifiers, spatial boundaries, and review events are strictly synthetic research data.
-- ============================================================================

DO $$
DECLARE
    v_parcel_id UUID;
    v_building_id UUID;
    v_unit1_id UUID;
    v_unit2_id UUID;
    v_unit3_id UUID;
    v_unit4_id UUID;
    v_unit5_id UUID;
    v_unit6_id UUID;
BEGIN
    -- 1. Insert Synthetic Base Parcel (2D Cadastre)
    -- Simulated ULPIN: 27A8B9C3D4E5F6, Location: Synthetic Plot 42, Sector 5, Tech City, Hyderabad (UTM Zone 44N)
    -- Footprint: 30m x 20m = 600 sqm [X: 219400 to 219430, Y: 1932500 to 1932520]
    INSERT INTO parcels (
        id,
        ulpin_2d,
        survey_number,
        district,
        state,
        village_code,
        area_sqm,
        geom_2d
    ) VALUES (
        gen_random_uuid(),
        '27A8B9C3D4E5F6',
        'SYN-PLOT-42/5',
        'Hyderabad-Synthetic',
        'Telangana-Synthetic',
        'SYN-VIL-001',
        600.00,
        ST_SetSRID(ST_GeomFromText('POLYGON((219400 1932500, 219430 1932500, 219430 1932520, 219400 1932520, 219400 1932500))'), 32644)
    )
    ON CONFLICT (ulpin_2d) DO UPDATE 
        SET survey_number = EXCLUDED.survey_number
    RETURNING id INTO v_parcel_id;

    -- 2. Insert Synthetic Building (Tower-A)
    -- Footprint: 20m x 15m = 300 sqm [X: 219405 to 219425, Y: 1932502.5 to 1932517.5]
    INSERT INTO buildings (
        id,
        parcel_id,
        building_code,
        building_name,
        total_floors_above,
        total_floors_below,
        footprint_2d
    ) VALUES (
        gen_random_uuid(),
        v_parcel_id,
        'TOWER-A',
        'Tech Residency Tower A (Synthetic)',
        3,
        1,
        ST_SetSRID(ST_GeomFromText('POLYGON((219405 1932502.5, 219425 1932502.5, 219425 1932517.5, 219405 1932517.5, 219405 1932502.5))'), 32644)
    )
    ON CONFLICT (parcel_id, building_code) DO UPDATE
        SET building_name = EXCLUDED.building_name
    RETURNING id INTO v_building_id;

    -- 3. Insert Vertical Units (6 Canonical Fixtures)

    -- Unit 1: UT01 (Stormwater utility corridor, non-building subsurface, Z: 535-537m MSL, VERIFIED)
    INSERT INTO vertical_units (
        id, parcel_id, building_id, prototype_ulpin_3d, tier_code, floor_code,
        unit_sequence, unit_label, unit_type, z_min, z_max, geom_3d, status
    ) VALUES (
        gen_random_uuid(), v_parcel_id, NULL, '27A8B9C3D4E5F6-3D-UT01-0001', 'UT', 'UT01',
        1, 'Synthetic Stormwater Trunk #1', 'UTILITY_CORRIDOR', 535.00, 537.00,
        ST_SetSRID(ST_GeomFromText('POLYHEDRALSURFACE Z (
            ((219400 1932500 535, 219400 1932502 535, 219430 1932502 535, 219430 1932500 535, 219400 1932500 535)),
            ((219400 1932500 537, 219430 1932500 537, 219430 1932502 537, 219400 1932502 537, 219400 1932500 537)),
            ((219400 1932500 535, 219430 1932500 535, 219430 1932500 537, 219400 1932500 537, 219400 1932500 535)),
            ((219430 1932500 535, 219430 1932502 535, 219430 1932502 537, 219430 1932500 537, 219430 1932500 535)),
            ((219430 1932502 535, 219400 1932502 535, 219400 1932502 537, 219430 1932502 537, 219430 1932502 535)),
            ((219400 1932502 535, 219400 1932500 535, 219400 1932500 537, 219400 1932502 537, 219400 1932502 535))
        )'), 32644),
        'VERIFIED'
    )
    ON CONFLICT (prototype_ulpin_3d) DO UPDATE SET unit_label = EXCLUDED.unit_label
    RETURNING id INTO v_unit1_id;

    -- Unit 2: SB01 (Basement 1 parking bay, Z: 537-540m MSL, VERIFIED)
    INSERT INTO vertical_units (
        id, parcel_id, building_id, prototype_ulpin_3d, tier_code, floor_code,
        unit_sequence, unit_label, unit_type, z_min, z_max, geom_3d, status
    ) VALUES (
        gen_random_uuid(), v_parcel_id, v_building_id, '27A8B9C3D4E5F6-3D-SB01-0002', 'SB', 'B01',
        2, 'Parking Bay B1-01 (Synthetic)', 'PARKING', 537.00, 540.00,
        ST_SetSRID(ST_GeomFromText('POLYHEDRALSURFACE Z (
            ((219405 1932502.5 537, 219405 1932517.5 537, 219425 1932517.5 537, 219425 1932502.5 537, 219405 1932502.5 537)),
            ((219405 1932502.5 540, 219425 1932502.5 540, 219425 1932517.5 540, 219405 1932517.5 540, 219405 1932502.5 540)),
            ((219405 1932502.5 537, 219425 1932502.5 537, 219425 1932502.5 540, 219405 1932502.5 540, 219405 1932502.5 537)),
            ((219425 1932502.5 537, 219425 1932517.5 537, 219425 1932517.5 540, 219425 1932502.5 540, 219425 1932502.5 537)),
            ((219425 1932517.5 537, 219405 1932517.5 537, 219405 1932517.5 540, 219425 1932517.5 540, 219425 1932517.5 537)),
            ((219405 1932517.5 537, 219405 1932502.5 537, 219405 1932502.5 540, 219405 1932517.5 540, 219405 1932517.5 537))
        )'), 32644),
        'VERIFIED'
    )
    ON CONFLICT (prototype_ulpin_3d) DO UPDATE SET unit_label = EXCLUDED.unit_label
    RETURNING id INTO v_unit2_id;

    -- Unit 3: F00 (Ground commercial lobby, Z: 540-543.5m MSL, VERIFIED)
    INSERT INTO vertical_units (
        id, parcel_id, building_id, prototype_ulpin_3d, tier_code, floor_code,
        unit_sequence, unit_label, unit_type, z_min, z_max, geom_3d, status
    ) VALUES (
        gen_random_uuid(), v_parcel_id, v_building_id, '27A8B9C3D4E5F6-3D-F00-0003', 'F', 'F00',
        3, 'Ground Floor Commercial Lobby (Synthetic)', 'COMMERCIAL', 540.00, 543.50,
        ST_SetSRID(ST_GeomFromText('POLYHEDRALSURFACE Z (
            ((219405 1932502.5 540, 219405 1932517.5 540, 219425 1932517.5 540, 219425 1932502.5 540, 219405 1932502.5 540)),
            ((219405 1932502.5 543.5, 219425 1932502.5 543.5, 219425 1932517.5 543.5, 219405 1932517.5 543.5, 219405 1932502.5 543.5)),
            ((219405 1932502.5 540, 219425 1932502.5 540, 219425 1932502.5 543.5, 219405 1932502.5 543.5, 219405 1932502.5 540)),
            ((219425 1932502.5 540, 219425 1932517.5 540, 219425 1932517.5 543.5, 219425 1932502.5 543.5, 219425 1932502.5 540)),
            ((219425 1932517.5 540, 219405 1932517.5 540, 219405 1932517.5 543.5, 219425 1932517.5 543.5, 219425 1932517.5 540)),
            ((219405 1932517.5 540, 219405 1932502.5 540, 219405 1932502.5 543.5, 219405 1932517.5 543.5, 219405 1932517.5 540))
        )'), 32644),
        'VERIFIED'
    )
    ON CONFLICT (prototype_ulpin_3d) DO UPDATE SET unit_label = EXCLUDED.unit_label
    RETURNING id INTO v_unit3_id;

    -- Unit 4: F01 (Floor 1 residential Flat 101, Z: 543.5-546.5m MSL, UNDER_REVIEW)
    INSERT INTO vertical_units (
        id, parcel_id, building_id, prototype_ulpin_3d, tier_code, floor_code,
        unit_sequence, unit_label, unit_type, z_min, z_max, geom_3d, status
    ) VALUES (
        gen_random_uuid(), v_parcel_id, v_building_id, '27A8B9C3D4E5F6-3D-F01-0004', 'F', 'F01',
        4, 'Flat 101 (Synthetic)', 'RESIDENTIAL', 543.50, 546.50,
        ST_SetSRID(ST_GeomFromText('POLYHEDRALSURFACE Z (
            ((219405 1932502.5 543.5, 219405 1932517.5 543.5, 219425 1932517.5 543.5, 219425 1932502.5 543.5, 219405 1932502.5 543.5)),
            ((219405 1932502.5 546.5, 219425 1932502.5 546.5, 219425 1932517.5 546.5, 219405 1932517.5 546.5, 219405 1932502.5 546.5)),
            ((219405 1932502.5 543.5, 219425 1932502.5 543.5, 219425 1932502.5 546.5, 219405 1932502.5 546.5, 219405 1932502.5 543.5)),
            ((219425 1932502.5 543.5, 219425 1932517.5 543.5, 219425 1932517.5 546.5, 219425 1932502.5 546.5, 219425 1932502.5 543.5)),
            ((219425 1932517.5 543.5, 219405 1932517.5 543.5, 219405 1932517.5 546.5, 219425 1932517.5 546.5, 219425 1932517.5 543.5)),
            ((219405 1932517.5 543.5, 219405 1932502.5 543.5, 219405 1932502.5 546.5, 219405 1932517.5 546.5, 219405 1932517.5 543.5))
        )'), 32644),
        'UNDER_REVIEW'
    )
    ON CONFLICT (prototype_ulpin_3d) DO UPDATE SET unit_label = EXCLUDED.unit_label
    RETURNING id INTO v_unit4_id;

    -- Unit 5: F02 (Floor 2 residential Flat 201, Z: 546.5-549.5m MSL, PROPOSED)
    INSERT INTO vertical_units (
        id, parcel_id, building_id, prototype_ulpin_3d, tier_code, floor_code,
        unit_sequence, unit_label, unit_type, z_min, z_max, geom_3d, status
    ) VALUES (
        gen_random_uuid(), v_parcel_id, v_building_id, '27A8B9C3D4E5F6-3D-F02-0005', 'F', 'F02',
        5, 'Flat 201 (Synthetic)', 'RESIDENTIAL', 546.50, 549.50,
        ST_SetSRID(ST_GeomFromText('POLYHEDRALSURFACE Z (
            ((219405 1932502.5 546.5, 219405 1932517.5 546.5, 219425 1932517.5 546.5, 219425 1932502.5 546.5, 219405 1932502.5 546.5)),
            ((219405 1932502.5 549.5, 219425 1932502.5 549.5, 219425 1932517.5 549.5, 219405 1932517.5 549.5, 219405 1932502.5 549.5)),
            ((219405 1932502.5 546.5, 219425 1932502.5 546.5, 219425 1932502.5 549.5, 219405 1932502.5 549.5, 219405 1932502.5 546.5)),
            ((219425 1932502.5 546.5, 219425 1932517.5 546.5, 219425 1932517.5 549.5, 219425 1932502.5 549.5, 219425 1932502.5 546.5)),
            ((219425 1932517.5 546.5, 219405 1932517.5 546.5, 219405 1932517.5 549.5, 219425 1932517.5 549.5, 219425 1932517.5 546.5)),
            ((219405 1932517.5 546.5, 219405 1932502.5 546.5, 219405 1932502.5 549.5, 219405 1932517.5 549.5, 219405 1932517.5 546.5))
        )'), 32644),
        'PROPOSED'
    )
    ON CONFLICT (prototype_ulpin_3d) DO UPDATE SET unit_label = EXCLUDED.unit_label
    RETURNING id INTO v_unit5_id;

    -- Unit 6: F02 (Balcony cantilever overhang test case exceeding parcel East boundary X: 219425 to 219432, REJECTED)
    INSERT INTO vertical_units (
        id, parcel_id, building_id, prototype_ulpin_3d, tier_code, floor_code,
        unit_sequence, unit_label, unit_type, z_min, z_max, geom_3d, status
    ) VALUES (
        gen_random_uuid(), v_parcel_id, v_building_id, '27A8B9C3D4E5F6-3D-F02-0006', 'F', 'F02',
        6, 'Balcony Overhang Conflict (Synthetic Test Case)', 'RESIDENTIAL', 546.50, 549.50,
        ST_SetSRID(ST_GeomFromText('POLYHEDRALSURFACE Z (
            ((219425 1932505 546.5, 219425 1932510 546.5, 219432 1932510 546.5, 219432 1932505 546.5, 219425 1932505 546.5)),
            ((219425 1932505 549.5, 219432 1932505 549.5, 219432 1932510 549.5, 219425 1932510 549.5, 219425 1932505 549.5)),
            ((219425 1932505 546.5, 219432 1932505 546.5, 219432 1932505 549.5, 219425 1932505 549.5, 219425 1932505 546.5)),
            ((219432 1932505 546.5, 219432 1932510 546.5, 219432 1932510 549.5, 219432 1932505 549.5, 219432 1932505 546.5)),
            ((219432 1932510 546.5, 219425 1932510 546.5, 219425 1932510 549.5, 219432 1932510 549.5, 219432 1932510 546.5)),
            ((219425 1932510 546.5, 219425 1932505 546.5, 219425 1932505 549.5, 219425 1932510 549.5, 219425 1932510 546.5))
        )'), 32644),
        'REJECTED'
    )
    ON CONFLICT (prototype_ulpin_3d) DO UPDATE SET unit_label = EXCLUDED.unit_label
    RETURNING id INTO v_unit6_id;

    -- 4. Clean and Refresh Source Evidence Records (Idempotent)
    DELETE FROM source_evidence WHERE unit_id IN (v_unit1_id, v_unit2_id, v_unit3_id, v_unit4_id, v_unit5_id, v_unit6_id);
    INSERT INTO source_evidence (unit_id, source_type, dataset_name, file_uri, accuracy_horizontal_m, accuracy_vertical_m, metadata_json)
    VALUES
        (v_unit1_id, 'MANUAL_DIGITIZED', 'SYN_MUNICIPAL_UTILITY_SURVEY_2026.geojson', 'data/simulated/utilities/syn_stormwater.geojson', 0.100, 0.050, '{"pipeline_diameter_mm": 1200, "material": "RCC"}'::jsonb),
        (v_unit2_id, 'BIM_IFC', 'SYN_TOWER_A_REVIT_2026.ifc', 'data/simulated/bim/tower_a.ifc', 0.020, 0.010, '{"ifc_class": "IfcSpace", "ifc_guid": "2P_s$yFzD1eQ8z9X1vA01"}'::jsonb),
        (v_unit3_id, 'BIM_IFC', 'SYN_TOWER_A_REVIT_2026.ifc', 'data/simulated/bim/tower_a.ifc', 0.020, 0.010, '{"ifc_class": "IfcSpace", "ifc_guid": "3A_s$yFzD1eQ8z9X1vB02"}'::jsonb),
        (v_unit4_id, 'ARCHITECTURAL_PLAN_2D', 'SYN_SANCTIONED_PLAN_FL1.pdf', 'data/simulated/plans/tower_a_fl1.pdf', 0.050, 0.020, '{"plan_drawing_no": "SAN-2026-TWR-A-101"}'::jsonb),
        (v_unit5_id, 'CITYJSON_LOD2', 'SYN_TECH_CITY_LOD2.city.json', 'data/simulated/cityjson/tech_city.json', 0.150, 0.100, '{"lod": 2.0, "cityobject_id": "bldg_tower_a_f02"}'::jsonb),
        (v_unit6_id, 'DRONE_PHOTOGRAMMETRY', 'SYN_DRONE_MESH_2026.obj', 'data/simulated/drone/tower_a_mesh.obj', 0.050, 0.050, '{"flight_altitude_m": 60, "overlap_pct": 80}'::jsonb);

    -- 5. Clean and Refresh Verification Audit Records (Idempotent)
    DELETE FROM verification_audit WHERE unit_id IN (v_unit1_id, v_unit2_id, v_unit3_id, v_unit4_id, v_unit5_id, v_unit6_id);
    INSERT INTO verification_audit (unit_id, action, previous_status, new_status, reviewer_name, reviewer_role, review_notes, integrity_hash)
    VALUES
        (v_unit1_id, 'OFFICIAL_APPROVAL', 'UNDER_REVIEW', 'VERIFIED', 'Synthetic Prototype Reviewer (Revenue Role)', 'REVENUE_OFFICIAL', 'Simulated verification: Subsurface utility corridor cross-checked against synthetic master plan.', 'syn_hash_89a3f7c12d4e56'),
        (v_unit2_id, 'OFFICIAL_APPROVAL', 'UNDER_REVIEW', 'VERIFIED', 'Synthetic Prototype Reviewer (Revenue Role)', 'REVENUE_OFFICIAL', 'Simulated verification: Basement parking unit conforms to synthetic building sanction plan.', 'syn_hash_12b4c5d6e7f890'),
        (v_unit3_id, 'OFFICIAL_APPROVAL', 'UNDER_REVIEW', 'VERIFIED', 'Synthetic Prototype Reviewer (Revenue Role)', 'REVENUE_OFFICIAL', 'Simulated verification: Ground floor commercial lobby boundary approved for prototype testing.', 'syn_hash_45c6d7e8f90123'),
        (v_unit4_id, 'SURVEYOR_REVIEW', 'PROPOSED', 'UNDER_REVIEW', 'Synthetic Prototype Surveyor (Surveyor Role)', 'LICENSED_SURVEYOR', 'Simulated review: Automated topology verified. Assigned for synthetic verification sign-off.', 'syn_hash_78d9e0f1a23456'),
        (v_unit5_id, 'AUTO_INGESTION', 'PROPOSED', 'PROPOSED', 'System Auto-Ingestion Pipeline', 'SYSTEM_VALIDATOR', 'Automated extraction from CityJSON LoD2 dataset. Pending simulated surveyor assignment.', 'syn_hash_90e1f2a3b45678'),
        (v_unit6_id, 'REJECTION', 'UNDER_REVIEW', 'REJECTED', 'Synthetic Prototype Surveyor (Surveyor Role)', 'LICENSED_SURVEYOR', 'Simulated review rejection: Balcony cantilever overhang projects 2m beyond East parcel boundary without registered aerial easement.', 'syn_hash_f1a2b3c4d5e6f7');

END $$;
