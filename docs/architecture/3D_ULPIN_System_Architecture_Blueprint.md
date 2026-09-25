# SIH26011 — 3D ULPIN Prototype System Architecture Blueprint

> **CRITICAL LEGAL NOTICE — RESEARCH PROTOTYPE**  
> This specification and associated materials represent an academic and engineering **RESEARCH PROTOTYPE** for Smart India Hackathon (Problem Statement SIH26011).  
> The official **ULPIN (Unique Land Parcel Identification Number / Bhu-Aadhaar)** administered by the Department of Land Resources (DoLR), Ministry of Rural Development, Government of India, is strictly a **2D, 14-digit alphanumeric parcel identifier**.  
> **No official "3D ULPIN" standard or specification currently exists in India.**  
> This system neither replaces, modifies, nor officially extends the real ULPIN system. All government registry linkages (DILRMP, Bhu-Naksha, NGDRS) are conducted against an internal, simulated cadastral dataset owned and controlled by this project.

---

## 1. Executive Summary & Problem Framing

Modern urban agglomerations in India exhibit intense verticalization: high-rise multi-family residential towers, multi-tier underground basement parking, subterranean metro rail corridors, utility pipeline trunks, and elevated expressways.

While the existing **14-digit 2D ULPIN (Bhu-Aadhaar)** identifies the surface terrestrial plot with high mathematical precision, it treats the vertical column from center-of-earth to zenith as a single legal entity. Consequently:
- High-rise apartments lack spatial demarcation in revenue records, relying on textual municipal property tax records and paper deeds.
- Overlapping underground utilities (water, sewage, gas, telecom) cause severe infrastructure clash disputes.
- Volumetric easements for underground transit (Metro tunnels) and aerial rights (flyovers, high-tension lines) lack unified cadastral visualization.

This project delivers a **non-intrusive 3D stratification prototype** that sits on top of the real 2D ULPIN, preserving 2D cadastral integrity while enabling 3D volumetric rights, restrictions, and responsibilities (RRRs) to be registered, validated, and rendered.

---

## 2. 3D Indexing Logic & Scheme Justification

### 2.1 Comparative Analysis

| Indexing Scheme | Core Paradigm | Indian Cadastral & Legal Fit | Spatial Computation Fit | Evaluation & Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **A. Sequential V-ID Suffix**<br>`[14-digit ULPIN]-[Stratum-Code]` | Extends the parent 2D ULPIN with an alphanumeric vertical and unit qualifier. | **Highest.** Directly mirrors Indian land registration conventions (Survey Number $\to$ Sub-division $\to$ Flat No.). Easily adopted in stamp duty registries and court orders. | Low intrinsic geometry; spatial bounds must be looked up in PostGIS 3D spatial database. | **RECOMMENDED FOR PUBLIC & LEGAL IDENTIFICATION.** Intuitive, zero learning curve for registrars, clean backward compatibility. |
| **B. Extended H3 Hexagonal Grid (H3 + Z)** | Projects Uber H3 2D hexagons into the vertical dimension as hexagonal prisms. | **Very Poor.** Real-world building walls, flat partitions, and parcel boundaries are orthogonal and irregular polygons. Hexagonal prisms slice across unit boundaries, producing severe geometric aliasing. | Very high for multi-resolution city-level aggregation, spatial clustering, and heatmaps. | **REJECT AS CADASTRAL ID.** Retained only as an internal spatial cache / statistical aggregation index. |
| **C. Voxel-Based Discretization (3D Grid / Octree)** | Subdivides 3D space into discrete cubic voxels ($1\text{m}^3$ or $0.5\text{m}^3$) encoded via 3D Morton/Z-order curves. | **Poor.** Complex binary hashes are incomprehensible to citizens, bank lenders, and registrars. Slices architectural walls into stepped voxel staircases. | Efficient for Constructive Solid Geometry (CSG) collision tests, but storage-intensive ($O(n^3)$). | **REJECT AS LEGAL IDENTIFIER.** Boundary Representation (B-Rep) polyhedra are preferred for cadastral boundary integrity. |

### 2.2 Recommended Dual-Layer Architecture

We adopt a **Dual-Layer Indexing Strategy**:
1. **Administrative & Legal Layer**: **Semantic Hierarchical Suffix** anchored to the parent 2D ULPIN.
2. **Computational & Spatial Layer**: **Boundary Representation (B-Rep) Polyhedral Solid in PostGIS 3D (`POLYHEDRALSURFACE Z`)** indexed via **3D R-Tree (`GIST`)** and streamed via **OGC 3D Tiles (B3DM / glTF)**.

---

## 3. Prototype 3D ULPIN Identifier Scheme Specification

### 3.1 Grammar & Structure

```
<PROTOTYPE-3D-ULPIN> ::= <2D-ULPIN> "-" <STRATUM-TYPE> <VERTICAL-TIER> "-" <UNIT-ID>

Regex:
^[0-9A-Z]{14}-(SB|UT|RF|CF|MF|AE|AR|CM)[B|F]?[0-9]{2}-[0-9A-Z]{1,6}$
```

### 3.2 Field Definitions

| Segment | Characters | Description | Examples |
| :--- | :--- | :--- | :--- |
| `2D-ULPIN` | 14 | Base terrestrial cadastral parcel ULPIN (DoLR format) | `27A8B9C3D4E5F6` |
| `Separator` | 1 | Standard hyphen (`-`) | `-` |
| `STRATUM-TYPE` | 2 | Primary functional classification of stratum | `SB` (Subsurface Basement)<br>`UT` (Utility Corridor)<br>`RF` (Residential Floor)<br>`CF` (Commercial Floor)<br>`MF` (Mixed-Use Floor)<br>`AE` (Aerial / Transit Corridor)<br>`AR` (Air Rights / Rooftop)<br>`CM` (Common Area / Circulation) |
| `VERTICAL-TIER` | 2–3 | Elevation bracket or floor level | `B01` (Basement 1)<br>`F04` (Floor 4)<br>`01` (General level 1) |
| `Separator` | 1 | Standard hyphen (`-`) | `-` |
| `UNIT-ID` | 1–6 | Specific flat, suite, stall, or corridor segment | `U402` (Apartment 402)<br>`P114` (Parking Stall 114)<br>`WTR01` (Water Main 01) |

---

## 4. 3D Spatial Data Model (ISO 19152 LADM Aligned)

The database schema aligns with the **Land Administration Domain Model (ISO 19152:2012 / LADM Edition II 3D Cadastres)**:

```sql
-- Extension Setup
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_sfcgal; -- For true 3D volumetric operations

-- 1. Base Terrestrial Parcel (Simulated 2D Cadastre)
CREATE TABLE base_parcel_2d (
    ulpin_2d VARCHAR(14) PRIMARY KEY,
    state_code VARCHAR(2) NOT NULL,
    district_name VARCHAR(64) NOT NULL,
    village_code VARCHAR(16) NOT NULL,
    survey_number VARCHAR(32) NOT NULL,
    area_sqm NUMERIC(12, 2) NOT NULL,
    geom_2d GEOMETRY(POLYGON, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_base_parcel_geom ON base_parcel_2d USING GIST(geom_2d);

-- 2. Vertical Stratum Layer
CREATE TABLE parcel_stratum_3d (
    stratum_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ulpin_2d VARCHAR(14) NOT NULL REFERENCES base_parcel_2d(ulpin_2d) ON DELETE RESTRICT,
    stratum_class VARCHAR(2) NOT NULL CHECK (stratum_class IN ('SB','UT','RF','CF','MF','AE','AR','CM')),
    z_min_msl NUMERIC(8, 2) NOT NULL, -- Height in meters relative to Mean Sea Level (EGM2008)
    z_max_msl NUMERIC(8, 2) NOT NULL,
    CHECK (z_min_msl < z_max_msl)
);
CREATE INDEX idx_stratum_ulpin ON parcel_stratum_3d(ulpin_2d);

-- 3. 3D Spatial Unit (Individual Property / Utility Volume)
CREATE TABLE spatial_unit_3d (
    prototype_ulpin_3d VARCHAR(32) PRIMARY KEY,
    stratum_id UUID NOT NULL REFERENCES parcel_stratum_3d(stratum_id) ON DELETE RESTRICT,
    ulpin_2d VARCHAR(14) NOT NULL REFERENCES base_parcel_2d(ulpin_2d),
    unit_number VARCHAR(16) NOT NULL,
    rera_carpet_area_sqm NUMERIC(10, 2),
    super_builtup_area_sqm NUMERIC(10, 2),
    undivided_land_share_pct NUMERIC(6, 4), -- Sum per parcel must not exceed 100%
    geom_3d GEOMETRY(POLYHEDRALSURFACEZ, 4979) NOT NULL, -- EPSG:4979 (WGS84 3D)
    bbox_3d BOX3D,
    verification_status VARCHAR(20) NOT NULL DEFAULT 'PROPOSED' 
        CHECK (verification_status IN ('PROPOSED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_spatial_unit_3d_geom ON spatial_unit_3d USING GIST(geom_3d);

-- 4. Rights, Restrictions, and Responsibilities (RRR)
CREATE TABLE rrr_rights_3d (
    rrr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prototype_ulpin_3d VARCHAR(32) NOT NULL REFERENCES spatial_unit_3d(prototype_ulpin_3d),
    right_type VARCHAR(32) NOT NULL CHECK (right_type IN ('FREEHOLD', 'LEASEHOLD', 'EASEMENT_SUBTERRANEAN', 'EASEMENT_AERIAL', 'MORTGAGE')),
    holder_name VARCHAR(128) NOT NULL,
    holder_pan_or_aadhaar_hash VARCHAR(64),
    registration_deed_no VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'VERIFIED', 'DISPUTED'))
);

-- 5. Cryptographic Tamper-Evident Audit Ledger
CREATE TABLE cadastre_audit_ledger (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prototype_ulpin_3d VARCHAR(32) NOT NULL,
    action VARCHAR(32) NOT NULL,
    performed_by_role VARCHAR(32) NOT NULL,
    officer_id VARCHAR(64) NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    state_sha256 VARCHAR(64) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. State Machine & Verification Workflow

To guarantee compliance with **Hard Constraint #3**, the transition of spatial and title data follows a strict state machine:

```
[ Ingest / Slicing ]
         │
         ▼
    ┌──────────┐
    │ PROPOSED │ (Read-only, watermarked as UNVERIFIED PROTOTYPE)
    └────┬─────┘
         │ Automated Spatial Checks Pass (0 Collisions, Within Footprint)
         ▼
  ┌──────────────┐
  │ UNDER_REVIEW │ (Assigned to licensed Cadastral Surveyor / Municipal Officer)
  └──┬────────┬──┘
     │        │ Surveyor rejects / Encroachment found
     │        ▼
     │   ┌──────────┐
     │   │ REJECTED │ (Preserved in audit trail; hidden from active registry)
     │   └──────────┘
     │ Authenticated Digital Sign-off (Surveyor + Registrar)
     ▼
┌──────────┐
│ VERIFIED │ (Officially stamped in prototype registry; activates RRR rights)
└──────────┘
```

---

## 6. Spatial Validation Engine Rules

The validation service executes prior to advancing any unit to `UNDER_REVIEW`:

1. **Footprint Containment**:
   $$\text{ST\_Within}(\text{ST\_Force2D}(\text{geom\_3d}), \text{base\_parcel\_2d.geom\_2d}) = \text{TRUE}$$
   *(If false, the record is flagged as `ENCROACHMENT_OVERHANG` requiring proof of registered aerial easement).*
2. **Volumetric Disjointness (Zero Phantom Volume)**:
   $$\forall U_i \neq U_j, \quad \text{ST\_3DIntersects}(U_i.\text{geom\_3d}, U_j.\text{geom\_3d}) = \text{FALSE}$$
3. **Solid Watertightness**:
   $$\text{ST\_IsClosed}(geom\_3d) = \text{TRUE} \quad \wedge \quad \text{ST\_IsSolid}(geom\_3d) = \text{TRUE}$$
4. **Undivided Share of Land (USL) Conservation**:
   $$\sum_{k=1}^{n} \text{undivided\_land\_share\_pct}_k \le 100.0000\%$$

---

## 7. Data Ingestion & Processing Pipeline

1. **BIM / IFC Pipeline**:
   - Parse `IfcSpace`, `IfcBuildingElementProxy`, `IfcSlab` via `IfcOpenShell`.
   - Extract internal boundary polyhedra (RERA Carpet Area) and external envelope polyhedra.
   - Transform coordinates from local project base point (PBP) to global EPSG:4979 (WGS84 3D).
2. **CityJSON / CityGML LoD2 Pipeline**:
   - Parse semantic building objects (`BuildingUnit`, `BuildingInstallation`).
   - Extract horizontal floor slices and vertical extrusion profiles.
3. **2D Anchor Reconciliation**:
   - Perform ray-casting from 3D unit centroid down to terrestrial plane ($Z = 0$).
   - Execute point-in-polygon query against `base_parcel_2d` to automatically associate the correct parent `ulpin_2d`.
4. **Tile Streaming Compilation**:
   - Export verified units to **OGC 3D Tiles 1.1** (Batched 3D Model / B3DM or glTF / GLB formats) using `py3dtiles` for hardware-accelerated web streaming.

---

## 8. Technical Architecture & Component Stack

- **Viewer / WebGIS**: Vite + React + CesiumJS (3D globe, elevation terrain, clipping planes, volumetric inspection).
- **Backend API**: Python 3.11 + FastAPI + GeoAlchemy2 + Pydantic v2.
- **Database**: PostgreSQL 16 + PostGIS 3.4 (with SFCGAL 3D extension).
- **Spatial Processing**: `ifcopenshell`, `cjio`, `shapely`, `trimesh`, `pyproj`.
- **Packaging & Delivery**: Containerized via Docker Compose (`web`, `api`, `db`, `tileserver`).

---

## 9. Scoping Questions for Implementation Phase

1. **Vertical Datum Source**: Will sample data provide heights as ellipsoidal GPS elevations, or as elevations above local ground level / Mean Sea Level?
2. **LoD Target**: Will test fixtures focus on LoD2 exterior boundary envelopes or LoD3 interior multi-room units?
3. **Sample Dataset Scope**: Do you prefer synthetic fixtures for a specific Indian metropolitan scenario (e.g., a high-rise tower in Mumbai/Bengaluru with 2 basements and an adjacent elevated metro corridor)?
