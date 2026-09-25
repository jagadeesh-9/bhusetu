# Phase 3.0 Architecture: 3D Topology, Conflict Detection & Spatial Quality-Control Engine

## Executive Summary

Phase 3.0 introduces a dedicated, read-only 3D computational geometry quality-control engine built natively on **PostgreSQL / PostGIS / SFCGAL** for the SIH26011 3D ULPIN prototype. The engine executes automated topological audits on 3D polyhedral cadastral units, identifying positive-volume spatial collisions, zero-volume boundary contacts, vertical continuity gaps/overlaps, Z-ordering inconsistencies, duplicate spatial representations, and parent parcel boundary containment.

The engine functions strictly as an **advisory quality-control mechanism** and makes no mutations to the database or statutory lifecycle state.

---

## Architectural Principles & Non-Goals

1. **Quality-Control vs. Legal Title**: The topology engine audits geometric consistency. It is not an ISO 19107 certified validator, nor does it confer legal land title validity or statutory government authorization.
2. **Boundary Contact Guarantee**: Two horizontal slabs or vertical facades sharing a boundary interface without interior penetration ($\text{Overlap Volume} \le 0.001\text{ m}^3$) are classified as `BOUNDARY_CONTACT` with `INFO` severity and are **never** treated as conflicts.
3. **Read-Only Operation**: Topology inspections execute analytical PostGIS/SFCGAL queries (`CG_Volume`, `CG_MakeSolid`, `CG_3DIntersection`, `ST_3DIntersects`, `ST_CoveredBy`) without performing database writes or status transitions.
4. **Preservation of Baseline State**: TOWER-A (Sequences 1–6) and VERTICAL-MIXED-A (Sequences 7–16) remain completely intact in the PostgreSQL repository.

---

## 3D Spatial Relationship Classifications

| Code | Severity | PostGIS / SFCGAL Geometry Criteria | Cadastral Semantic |
| :--- | :--- | :--- | :--- |
| `DISJOINT` | `INFO` | `ST_3DIntersects(A, B) = FALSE`, Overlap = $0.0\text{ m}^3$ | Completely separate spatial strata. |
| `BOUNDARY_CONTACT` | `INFO` | `ST_3DIntersects(A, B) = TRUE`, Overlap $\le 0.001\text{ m}^3$ | Valid adjoining floor/wall interface (horizontal slab or vertical party wall). |
| `POSITIVE_VOLUME_OVERLAP` | `ERROR` | `CG_Volume(CG_3DIntersection(A, B)) > 0.001\text{ m}^3`, Ratio $< 0.90$ | Volumetric interior penetration / spatial collision between competing units. |
| `DUPLICATE_SPATIAL_REPRESENTATION` | `ERROR` | Overlap Ratio $\ge 0.90$ ($\ge 90\%$ volumetric identity) | Duplicate or conflicting multiple representations of the same physical volume. |

---

## Vertical Continuity Classifications

| Code | Severity | Elevation Criteria | Description |
| :--- | :--- | :--- | :--- |
| `GROUND_BASE` | `INFO` | $Z_{\min} \le Z_{\text{datum}} + 0.10\text{m}$ | Base terrestrial level anchoring the vertical stack. |
| `CONTIGUOUS` | `INFO` | $\|Z_{\min, n} - Z_{\max, n-1}\| \le 0.02\text{m}$ | Direct vertical stacking across adjoining storeys. |
| `VERTICAL_GAP` | `WARNING` | $Z_{\min, n} - Z_{\max, n-1} > 0.02\text{m}$ | Unaccounted vertical gap / interstitial void between storeys. |
| `VERTICAL_OVERLAP` | `WARNING` | $Z_{\min, n} < Z_{\max, n-1}$ | Vertical interval overlap (requires checking horizontal XY footprint separation). |
| `SUBTERRANEAN_INTERFACE` | `INFO` | $Z_{\max} \le Z_{\text{datum}}$ | Subsurface basement or utility corridor below ground datum. |

---

## Solid Watertightness & Geometry Validation

Using SFCGAL's B-Rep reconstruction, every unit's `POLYHEDRALSURFACE Z` is validated against:
1. `CG_IsClosed(ST_SetSRID(ST_GeomFromText(wkt), 32644))` $\rightarrow$ watertight closed 2-manifold boundary.
2. `CG_Volume(CG_MakeSolid(ST_SetSRID(ST_GeomFromText(wkt), 32644)))` $\rightarrow$ strictly positive volume ($> 0.0001\text{ m}^3$).
3. Metadata vs. Geometry Elevation Consistency $\rightarrow$ geometric $Z_{\min}, Z_{\max}$ matches cadastral attribute bounds within $0.05\text{m}$.

---

## 2D Footprint Parcel Containment

In this prototype, parcel containment is evaluated as a 2D footprint projection boundary test:
- `ST_CoveredBy(ST_Force2D(geom_3d), parcel.geom_2d)`
- Units whose horizontal footprint lies within the parent parcel polygon are reported as `CONTAINED` (`INFO`).
- Units protruding or cantilevering beyond parcel property lines are reported as `OUTSIDE_PARENT` (`ERROR`).

---

## Ground Datum & Synthetic Modeling Notes

1. **Ground Elevation Reference**: The base datum $Z = 540.0\text{m}$ is a synthetic prototype reference value corresponding to the local terrestrial surface elevation of the benchmark parcel in Telangana (`EPSG:32644`), rather than a surveyed geodetic benchmark.
2. **Elevator Core Modeling**: In the synthetic `VERTICAL-MIXED-A` dataset, full-plate floor slabs were modeled without subtracting the lift shaft core (`CM-0012`). The topology engine accurately detects this as a genuine 3D volumetric interior collision ($70.0\text{ m}^3$ on F00, $60.0\text{ m}^3$ on F01/F02).

---

## API Endpoints

1. **Parcel Topology Audit**:
   - `GET /api/parcels/{parcel_id}/topology`
   - Returns parcel-wide topology status (`VALID`, `REVIEW_REQUIRED`, `CONFLICT`), all $\frac{N(N-1)}{2}$ pairwise relationships, vertical continuity trace, solid validations, and containment findings.

2. **Vertical Unit Topology Audit**:
   - `GET /api/vertical-units/{unit_id}/topology`
   - Returns single unit solid validation, parcel containment status, vertical continuity relation to adjacent storeys, and pairwise neighbor relationships.

---

## Synthetic Conflict Benchmark Suite (7 Fixtures)

1. **Fixture 1 (Valid Adjacent Floors)**: TOWER-A F00 (540.0–543.5) and F01 (543.5–546.5) $\rightarrow$ `BOUNDARY_CONTACT`, $0.000\text{ m}^3$, `INFO`.
2. **Fixture 2 (Positive Volume Overlap)**: VERTICAL-MIXED-A CM-0012 (Elevator Core) vs F-0010 (Ground Lobby) $\rightarrow$ `POSITIVE_VOLUME_OVERLAP`, $70.000\text{ m}^3$, `ERROR`.
3. **Fixture 3 (Vertical Gap)**: 1.50m interstitial void between F00 and F01 $\rightarrow$ `VERTICAL_GAP`, $\Delta = 1.50\text{m}$, `WARNING`.
4. **Fixture 4 (Outside Parcel Boundary)**: TOWER-A Balcony Overhang Unit 6 $\rightarrow$ `OUTSIDE_PARENT`, `ERROR`.
5. **Fixture 5 (Duplicate Spatial Representation)**: Overlapping candidates with 95% volumetric identity $\rightarrow$ `DUPLICATE_SPATIAL_REPRESENTATION`, `ERROR`.
6. **Fixture 6 (Same-Z Valid Separation)**: Ground Lobby F00 and Open Parking P00 sharing $Z = [540.0, 543.5]$ with disjoint XY footprints $\rightarrow$ `DISJOINT`, $0.000\text{ m}^3$, `shared_z_interval = TRUE`, `INFO`.
7. **Fixture 7 (Invalid Open Solid)**: Unclosed 2-faceted PolyhedralSurface missing caps $\rightarrow$ `INVALID_CLOSEDNESS` / `INVALID_SOLID`.

---

## Prototype Legal & Technical Disclaimer

> [!IMPORTANT]
> This topology engine provides computational spatial quality-control findings for the SIH26011 research prototype. It does not establish legal ownership, title validity, statutory cadastral certification, or government approval. Human review remains mandatory.

