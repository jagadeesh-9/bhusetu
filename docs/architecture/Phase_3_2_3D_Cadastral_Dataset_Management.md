# Phase 3.2: 3D Cadastral Dataset Management & Spatial Navigation Engine

## 1. System Overview & Objectives
Phase 3.2 implements the parcel-level 3D spatial hierarchy and navigation layer for the SIH26011 research prototype. It establishes a multi-scale dataset management architecture connecting 2D cadastral parcels, building envelopes, and multi-tier 3D PolyhedralSurface vertical units.

The system incorporates:
1. **Hierarchical 3D Dataset Aggregation**: Navigation across 2D Parent Parcel $\rightarrow$ Building $\rightarrow$ 3D Vertical Property Units $\rightarrow$ Evidence & Topology Quality.
2. **Transparent Quality Scorecard**: Metric-level evaluation of geometry closedness, solid status, positive volumetric modeling, Z-extent validity, and parent parcel boundary containment with explicit prototype UI classification thresholds.
3. **12-Point Dataset Consistency Audit Matrix**: Automated integrity audits evaluating SRID conformance (`EPSG:32644`), Z ordering consistency within vertical stacks, non-overlapping strata, metadata consistency, and orphan entity detection.
4. **Spatial Navigation & Non-Destructive Slicing**: Dynamic multi-attribute search, lifecycle state filtering, and visualization-only client-side vertical slicing for subterranean and upper-strata inspection.

---

## 2. Structural Spatial Hierarchy

```
+-------------------------------------------------------------------------+
|                         2D PARENT PARCEL                                |
|  - ULPIN 2D (e.g., 27A8B9C3D4E5F6)                                      |
|  - Survey Number, District, State, Area (m²), CRS (EPSG:32644)          |
+-------------------------------------------------------------------------+
                                    |
                                    v (1:N)
+-------------------------------------------------------------------------+
|                        BUILDING ENVELOPE                                |
|  - Building Code (e.g., TOWER-A, MIXED-TOWER-A)                         |
|  - Footprint Polygon (2D) & 3D Extruded Bounds                          |
|  - Total Floors Above / Below Ground                                    |
+-------------------------------------------------------------------------+
                                    |
                                    v (1:N)
+-------------------------------------------------------------------------+
|                      3D VERTICAL STRATA UNITS                           |
|  - Prototype 3D Unit ID (e.g., 27A8B9C3D4E5F6-F-F01-0004)               |
|  - Tier & Floor Codes (UT, SB, F, AR, AE, CM)                           |
|  - Z-Min, Z-Max, Height (m), Individual Modeled Volume (m³)             |
|  - PolyhedralSurface Solid Geometry (PostGIS + SFCGAL)                  |
+-------------------------------------------------------------------------+
            |                                           |
            v (1:N)                                     v (1:N)
+------------------------+                  +-----------------------------+
|    SOURCE EVIDENCE     |                  |     VERIFICATION AUDIT      |
|  - LiDAR, BIM/IFC, CAD |                  |  - State Transitions        |
|  - Horizontal/Vertical |                  |  - Surveyor / Reviewer Role |
|    Accuracy Metrics    |                  |  - Append-oriented Audit    |
|                        |                  |    History (SHA-256 hash)   |
+------------------------+                  +-----------------------------+
```

---

## 3. Dataset Overview & Quality Engine (`DatasetService`)

### 3.1 Aggregated Metrics (`DatasetStatistics`)
- **Total Modeled Volume**: Computed as the **sum of individual modeled solid volumes** across all valid 3D PolyhedralSurface bodies within the parcel. Note: In multi-tier scenarios containing shared circulation cores (e.g., `CM01` in `VERTICAL-MIXED-A`), the sum transparently includes both individual strata and common circulation space, while the dedicated 3D topology engine identifies and classifies the spatial intersection.
- **Elevation Span**: Minimum bottom elevation to maximum top elevation with total vertical delta ($Z_{span} = Z_{max} - Z_{min}$).
- **Stratified Distribution**: Subterranean units count ($Z < \text{ground datum}$) vs. Above-ground units count ($Z \ge \text{ground datum}$), referenced against `DEFAULT_SYNTHETIC_GROUND_DATUM_Z = 540.0` (synthetic ground datum reference).
- **Taxonomy & Lifecycle Distributions**: Real-time breakdown of units across all 6 taxonomy strata and 4 lifecycle states (`VERIFIED`, `UNDER_REVIEW`, `PROPOSED`, `REJECTED`).

### 3.2 12-Point Consistency Audit Matrix
1. `ORPHAN_UNITS_CHECK`: Ensures zero vertical units exist without an associated parent parcel.
2. `BUILDING_LINKAGE_CHECK`: Audits parent building associations for all units.
3. `SRID_CONSISTENCY_CHECK`: Verifies all parcel and unit geometries are registered in canonical analytical CRS `EPSG:32644`.
4. `INVALID_Z_RANGE_CHECK`: Asserts $Z_{max} > Z_{min}$ strictly for every unit.
5. `NEGATIVE_VOLUME_CHECK`: Asserts calculated solid volume $V > 0$ strictly.
6. `UNCLOSED_SOLID_CHECK`: Validates 2-manifold closedness and watertightness.
7. `DUPLICATE_ID_CHECK`: Asserts uniqueness of prototype 3D identifiers.
8. `VERTICAL_ORDER_CHECK`: Verifies Z ordering consistency within relevant vertical stacks (noting that `unit_sequence` is an atomic identifier allocation sequence, not physical elevation).
9. `TAXONOMY_TIER_CHECK`: Validates canonical tier codes (`SB`, `UT`, `F`, `AE`, `AR`, `CM`).
10. `EVIDENCE_PRESENCE_CHECK`: Ensures units link to supporting provenance records.
11. `LIFECYCLE_STATUS_CHECK`: Verifies state machine conformance (`PROPOSED`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`).
12. `PARENT_PARCEL_CONTAINMENT_CHECK`: Audits 2D horizontal boundary containment against the parent parcel cadastral limits.

### 3.3 Scorecard Classification
The scorecard thresholds (`OPTIMAL` $\ge 95\%$, `ATTENTION` $80\%-94\%$, `CRITICAL` $< 80\%$) are defined as **Prototype UI classification thresholds** for demonstrative visualization in this research prototype. They do not represent official statutory or cadastral certification standards.

---

## 4. Spatial Neighbors & Topology Semantics
Endpoint `GET /api/vertical-units/{unit_id}/neighbors` adheres strictly to Phase 3.0 topological definitions:
- `DISJOINT` $\rightarrow$ `INFO`: Completely separated spatial bodies.
- `BOUNDARY_CONTACT` $\rightarrow$ `INFO`: Valid adjacent floors/storeys sharing horizontal contact surfaces with zero interior volume overlap.
- `POSITIVE_VOLUME_OVERLAP` $\rightarrow$ `ERROR`: Volumetric collision where two distinct units occupy the same 3D spatial region.
- `DUPLICATE_SPATIAL_REPRESENTATION` $\rightarrow$ `ERROR`: Identical spatial solids representing different entities.

---

## 5. API Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/parcels/{id}/3d-overview` | Returns complete parcel metadata, child buildings, units, dynamic statistics (sum of modeled solid volumes), quality scorecard, and 12-point consistency audit. |
| `GET` | `/api/parcels/{id}/vertical-units` | Returns filtered vertical units supporting `tier`, `status`, `floor`, and `search` query parameters. |
| `GET` | `/api/vertical-units/{id}/neighbors` | Computes immediate vertical and lateral neighbors (ABOVE, BELOW, ADJACENT, OVERLAPPING) with distance/gap metrics. |

---

## 6. UI Components & Visual Navigation

- **`ParcelOverviewModal.tsx`**: Multi-tab analytical dashboard presenting Dataset Statistics, Quality Scorecard with pass-rate progress bars, 12-Point Consistency Audit Matrix, and Building Registry.
- **`VerticalExplorer.tsx`**: Interactive vertical property stack with real-time multi-attribute search, lifecycle filter chips, taxonomy tier filter chips, elevation deltas, and Scorecard launcher.
- **`LayerControls.tsx`**: Layer visibility toggles extended with lifecycle status checkboxes (`Verified`, `Review`, `Proposed`, `Rejected`) and Visualization-only Vertical Slice Mode ($Z_{min} \rightarrow Z_{max}$ elevation sliders).
- **`CesiumViewer.tsx`**: WebGL/CesiumJS rendering honoring slice bounds via client-side entity filtering, wireframe facets, subterranean translucency, and lifecycle status filtering.

---

## 7. Research Prototype Governance Disclaimer
The prototype 3D identifiers (e.g. `27A8B9C3D4E5F6-F-F01-0004`) generated and managed in this system are research demonstration representations developed for SIH26011. They do not constitute official statutory 3D ULPIN numbers or legal land title deeds issued by the Ministry of Rural Development / Department of Land Resources (DoLR), Government of India.

---

## 8. Research Prototype Scope & Subterranean Evidence Notes
1. **Synthetic Datasets**: Synthetic research datasets using `EPSG:32644`.
2. **Subterranean Evidence**: Optical airborne LiDAR does not directly establish underground geometry. Real-world subterranean registration may require appropriate subsurface survey, engineering, BIM/CAD, DEM, or other suitable evidence. GPR may be used where available and appropriate.

