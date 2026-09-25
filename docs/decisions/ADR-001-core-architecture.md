# ADR-001: Core System Architecture & 3D Cadastral Foundations

* **Status**: Approved
* **Context Date**: 2026-09-04
* **Scope**: SIH26011 Research Prototype — 3D ULPIN Generation & Vertical Property Mapping System

---

## 1. Context & Problem Statement

Urban India is characterized by multi-tier vertical property stratification: multi-storey residential and commercial apartments, multi-level underground basement parking, subterranean utility corridors (water, gas, sewage, electricity, fiber), and elevated transit networks (flyovers and metro rail viaducts).

The official **ULPIN (Unique Land Parcel Identification Number / Bhu-Aadhaar)**, administered by the Department of Land Resources (DoLR), Ministry of Rural Development, Government of India, is an established **2D, 14-character alphanumeric parcel identifier**.

Currently, no official government specification or standard exists for a "3D ULPIN" in India. This project designs, evaluates, and demonstrates an engineering **research prototype** that layers 3D vertical stratification on top of the real 2D ULPIN without replacing, altering, or claiming official government status for any vertical extension.

---

## 2. Core Architecture Decisions

### Decision 1: Dual-CRS Architecture
* **Decision**: Implement a decoupled Dual-CRS pipeline separating analytical spatial computation from client-side WebGL rendering.
* **Analysis & Storage CRS**: Metric Projected Cartesian System.
* **Visualization CRS**: Global Ellipsoidal Coordinate System (WGS84 3D / ECEF).
* **Rationale**: Euclidean 3D spatial operations (e.g., polyhedral volume calculation, collision detection via SFCGAL) are mathematically invalid when executed on angular degree axes (lat/long).

### Decision 2: Target Analysis CRS (EPSG:32644 — UTM Zone 44N)
* **Decision**: Standardize the synthetic demonstration dataset on **EPSG:32644 (WGS 84 / UTM Zone 44N)**.
* **Units**: Cartesian meters $(X, Y)$ with easting and northing.
* **Explicit Disclaimer**: The selection of EPSG:32644 is a specific **synthetic dataset design decision** suitable for central/southern Indian test scenarios. It is **NOT** an official national cadastral projection standard.

### Decision 3: Vertical Reference Datum (Orthometric Height above MSL)
* **Decision**: All vertical elevations ($Z$) in the analysis and database layers represent **Orthometric Height ($H$) in meters relative to Mean Sea Level (MSL)** based on the EGM2008 / Survey of India geoid datum.
* **Rationale**: Architectural floor plans, basement excavation depths, and municipal building sanctions in India are indexed to Mean Sea Level, not the GPS ellipsoid.

### Decision 4: Canonical 3D Geometry (Boundary Representation / Polyhedral Solids)
* **Decision**: Store and validate all legal property volumes and infrastructure easements as **Closed 2-Manifold Boundary Representation (B-Rep) Polyhedral Solids** (`POLYHEDRALSURFACE Z` conforming to ISO 19107).
* **Rationale**: Property law requires unambiguous, planar legal boundary walls and slabs. Voxel grids introduce stair-step quantization errors, while 2.5D extrusions fail to model cantilevers, overhangs, and sloped corridors.

### Decision 5: Performance & Indexing Proxy (3D Bounding Box + Elevation Bracket)
* **Decision**: Maintain a generated **3D Bounding Box (`BOX3D`) and $[Z_{min}, Z_{max}]$ interval** for every spatial unit.
* **Rationale**: Provides $O(1)$ fast-path rejection filtering for spatial containment and collision queries before executing computationally intensive polyhedral boolean tests in SFCGAL.

### Decision 6: CesiumJS Visualization Pipeline (ECEF & Geoid Separation)
* **Decision**: Stream geometries to CesiumJS as **OGC 3D Tiles 1.1 (glTF / B3DM)**, dynamically converting coordinates from UTM metric coordinates to WGS84 3D (`EPSG:4979`) and Earth-Centered, Earth-Fixed (`EPSG:4978`).
* **Geoid Separation**: Apply the local geoid undulation offset ($h = H + N$) during tile compilation to ensure models anchor accurately to Cesium's terrain ellipsoid.

### Decision 7: Research-Prototype Vertical Identifier Syntax
* **Decision**: Adopt the stable stratum-zoned identifier syntax:
  ```
  {2D_ULPIN}-3D-{TIER_CODE}-{UNIT_SEQUENCE}
  ```
  *Example*: `27A8B9C3D4E5F6-3D-F04-0007`
* **Demarcation**: The `-3D-` token explicitly brands the string as a **research-prototype vertical identifier**.
* **Integrity**: The original 14-digit base 2D ULPIN remains completely unchanged.

### Decision 8: Stable Spatial-Unit Sequence
* **Decision**: The `{UNIT_SEQUENCE}` component is a parcel-scoped, immutable numerical sequence index (`0001` .. `9999`).
* **Rationale**: Cadastral identity must be permanent (invariance principle). Architectural names (e.g., `Flat 402`), commercial brandings, and tenant uses are stored strictly as relational attributes and do not dictate spatial primary identity.

### Decision 9: Database State Machine (PROPOSED → UNDER_REVIEW → VERIFIED)
* **Decision**: Implement a database-enforced lifecycle state machine:
  * `PROPOSED`: Default state for all automated/AI-generated 3D spatial units. Read-only and watermarked.
  * `UNDER_REVIEW`: Activated once automated topological validation (0 collisions, footprint containment) passes. Assigned to a licensed human surveyor.
  * `VERIFIED`: Granted solely via authenticated human official sign-off with digital signature.
  * `REJECTED`: Assigned to non-compliant or disputed units.
* **Governance Rule**: No AI pipeline or batch script can directly promote a record to `VERIFIED`.

### Decision 10: Simulated Cadastral Dataset & No Government API Integration
* **Decision**: All cadastral interactions are linked strictly to a synthetic, self-contained demonstration dataset owned and controlled by this project.
* **Scope**: 1 terrestrial base parcel, 2 basement parking tiers, 1 ground commercial floor, 8 residential floors, 1 subsurface utility/transport corridor, and 1 elevated transport corridor.
* **Integrity Constraint**: No live connection or write operation is made to DILRMP, Bhu-Naksha, NGDRS, or any state land registry.

---

## 3. Clear Demarcation of System Boundaries

| Category | Real Government Domain | This Research Prototype Project |
| :--- | :--- | :--- |
| **Land Parcel Identifier** | Official 14-digit 2D ULPIN (Bhu-Aadhaar) | Inherits the 14-digit ULPIN unmodified as the root of the prototype identifier. |
| **Vertical Identification** | No official 3D standard exists. | Prototype extension: `{ULPIN}-3D-{TIER}-{SEQ}`. |
| **Cadastral Records** | State Revenue Departments / DILRMP. | Simulated local GeoJSON/PostGIS dataset (`data/simulated/`). |
| **Registration & Title** | Sub-Registrar Offices (NGDRS). | Simulation of Rights, Restrictions & Responsibilities (RRRs). |
| **Legal Verification** | Statutory Revenue Officers / Registrars. | Human-in-the-loop state machine with role-based sign-off. |
