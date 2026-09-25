# SIH26011: Final System Architecture Specification

## 1. System Mission & Scope
The **SIH26011: 3D ULPIN Generation and Vertical Property Mapping System** is a complete, explainable 3D cadastral spatial intelligence research prototype. It models, segments, reconstructs, validates, assesses, reviews, and visualizes vertical real property strata in complex multi-tier urban environments.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    SIH26011 END-TO-END SYSTEM PIPELINE                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [ RAW MULTI-SOURCE SENSORS ]                                                │
│  (Airborne LiDAR .las, BIM IFC4, Architectural Plans, Total Station Surveys) │
│                                ↓                                             │
│  [ CONTROLLED SOURCE INGESTION (Phase 3.3) ]                                 │
│  (Format Validation, CRS Normalization to EPSG:32644, SHA-256 Provenance)    │
│                                ↓                                             │
│  [ 3D GEOMETRY RECONSTRUCTION (Phase 3.4) ]                                  │
│  (Analytical Footprint Extrusion, PolyhedralSurface 2-Manifold B-Rep Solids) │
│                                ↓                                             │
│  [ PROTOTYPE 3D UNIT ID GENERATION ]                                         │
│  (Deterministic Unique Sequence Allocation, Tier/Floor Code Stacking)        │
│                                ↓                                             │
│  [ 3D TOPOLOGY & SPATIAL QUALITY-CONTROL (Phase 3.0) ]                       │
│  (SFCGAL 3D Closedness, Positive Volume, Vertical Continuity, Containment)   │
│                                ↓                                             │
│  [ MULTI-SOURCE EVIDENCE FUSION (Phase 3.5) ]                                │
│  (Categorical Confidence, Decomposable Dimensions, Discrepancy Inspection)   │
│                                ↓                                             │
│  [ EXPLAINABLE AI ADVISORY CONTEXT (Phase 2.9) ]                             │
│  (Point Density, Compactness, Prominence Heuristics — Non-Authoritative)     │
│                                ↓                                             │
│  [ HUMAN-IN-THE-LOOP REVIEW WORKSPACE (Phase 3.1) ]                          │
│  (Computational Readiness Checklist, Cryptographic Prototype Audit History)  │
│                                ↓                                             │
│  [ INTERACTIVE 3D REVIEW & SPATIAL INTERROGATION (Phase 3.6A-C) ]            │
│  (CesiumJS 3D Viewport, Sectional Cutaway Clipping, 3D Metric Measurement)   │
│                                ↓                                             │
│  [ PROTOTYPE TECHNICAL REVIEW DOSSIER & EXPORT (Phase 3.6D) ]                │
│  (Consolidated 11-Section Review Document, Browser-Native Print/PDF Export)  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack & Component Inventory

### Backend Infrastructure
- **Web Framework**: FastAPI 0.115+ (Python 3.11.9)
- **Database Engine**: PostgreSQL 16.15
- **Spatial Database Extensions**: PostGIS 3.6.2 with SFCGAL 2.2.0 (GEOS 3.14.1, PROJ 8.2.1 3D volumetric geometry engine)
- **ORM & Database Driver**: SQLAlchemy 2.0+ with `psycopg` (v3) binary driver and `GeoAlchemy2`
- **Spatial Processing Libraries**: `shapely` 2.0+, `laspy` 2.5+, `numpy` 1.26+, `pydantic` v2

### Frontend Visualization Infrastructure
- **Core Framework**: React 18 with TypeScript 5.6+
- **Build Tool**: Vite 5.0+
- **3D Geospatial Globe Engine**: CesiumJS 1.120+ (WGS 84 / WebGL rendering pipeline)
- **Coordinate Transformation Engine**: `proj4` (EPSG:4326 $\leftrightarrow$ EPSG:32644)
- **UI Icons & Components**: `lucide-react`
- **Testing Framework**: Vitest 5.0+ with `@testing-library/react`

---

## 3. Core Database Models & Invariants

| Model | Table Name | Persistent Records | Description |
|---|---|---|---|
| `Parcel` | `parcels` | 2 | 2D base land parcels (`27A8B9C3D4E5F6` Tower A & `27A8B9C3D4E5F7` Vertical Mixed A). |
| `Building` | `buildings` | 2 | Structural building footprint envelopes attached to parcels (`TOWER-A` & `MIXED-TOWER-A`). |
| `VerticalUnit` | `vertical_units` | 16 | Modeled 3D PolyhedralSurface vertical strata units (6 in Tower A + 10 in Vertical Mixed A). |
| `SourceEvidence` | `source_evidence` | 16 | Technical source metadata, sensor types, accuracies, and SHA-256 fingerprints. |
| `VerificationAudit`| `verification_audit`| 16 | Cryptographically chained human review state machine transitions. |

---

## 4. Coordinate Reference System (CRS) Architecture

1. **Analytical Canonical CRS (`EPSG:32644` — WGS 84 / UTM Zone 44N)**:
   - All spatial database storage, solid geometry reconstruction, SFCGAL topology validation, volume calculations, and metric measurements operate strictly in metric Cartesian coordinates.
2. **Visualization Ellipsoidal CRS (`EPSG:4326` / WGS 84)**:
   - CesiumJS renders 3D polyhedral surfaces on the WGS 84 ellipsoidal globe.
3. **Interactive Interrogation Coordinate Pipeline**:
   - Screen Space $(x, y) \rightarrow$ Cesium Cartesian3 $\rightarrow$ Cartographic $(\text{lon}, \text{lat}, \text{height}) \xrightarrow{\text{proj4}} \text{EPSG:32644 } (E, N, Z)$.

---

## 5. Research Prototype Claim Boundaries

| Domain | Prototype Technical Reality | Forbidden Claim |
|---|---|---|
| **Identifier** | Prototype 3D Unit ID (e.g., `ULPIN-3D-F01-102`) | Official Government 3D ULPIN / Statutory Cadastral Identifier |
| **Geometry** | Modeled 3D PolyhedralSurface B-Rep Solid | Certified Boundary Survey / Clear Architectural Height |
| **Evidence** | Ingestion metadata, accuracies, SHA-256 fingerprints | Co-persisted raw LiDAR point cloud meshes / Immutable legal title |
| **Evidence Fusion** | Categorical confidence (`HIGH`/`MEDIUM`/`LOW`/`UNKNOWN`) | Statistical ownership probability percentage (e.g., "92% legal certainty") |
| **Topology** | SFCGAL 2-manifold closed solidness & boundary contact | Statutory title guarantee |
| **AI Analysis** | Non-authoritative heuristic proposal context | Automatic legal verification / Ownership decision engine |
| **Governance** | Human-restricted review (`HUMAN_REVIEWER`, `LICENSED_SURVEYOR`) | Automated algorithmic approval |
