# Phase 3.6C: Evidence-Aware 3D Review Visualization & Discrepancy Inspection

## 1. Overview & Architectural Intent
Phase 3.6C delivers the **Interactive Evidence-Aware 3D Review Visualization & Discrepancy Inspection Subsystem** for the SIH26011 3D Cadastral research prototype.

The objective is to unify the 4 pillars of the cadastral evaluation pipeline into a single, cohesive, reviewer-oriented user experience:
1. **Pillar 1: Modeled 3D Solid Geometry** — Analytical PolyhedralSurface geometry, canonical $Z_{\min} \dots Z_{\max}$, volume, surface area, and classification.
2. **Pillar 2: Source Evidence Records** — Authoritative ingestion metadata, source sensor types, horizontal/vertical accuracies, dataset filenames, and pipeline provenance steps.
3. **Pillar 3: Multi-Source Evidence Fusion & Discrepancies** — Categorical overall confidence (`HIGH` / `MEDIUM` / `LOW` / `UNKNOWN`), decomposable evidence dimensions, cross-source comparison metrics, and structured conflict notices.
4. **Pillar 4: 3D Topology & Spatial Quality-Control** — SFCGAL 3-manifold solid validity, positive-volume overlap checks, vertical continuity, and parcel boundary containment.

> **CRITICAL ARCHITECTURAL REALITY & CLAIM BOUNDARY**:
> **The `source_evidence` database table stores metadata/provenance JSON records (accuracies, source types, filenames, SHA-256 fingerprints) and DOES NOT store persistent spatial geometry columns. This phase strictly forbids fabricating source geometry (e.g., synthetic LiDAR footprints, synthetic BIM meshes, or artificial discrepancy highlight volumes). All source evidence records are explicitly labeled with `"Source geometry unavailable — metadata/provenance only"` badges.**

---

## 2. The 4-Pillar 3D Review Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   3D REVIEW STATUS SCORECARD (Pillar 1-4)                │
├──────────────────────────────────────────────────────────────────────────┤
│ Modeled Geometry  :  ✓ Available (PolyhedralSurface 3D Solid)            │
│ Source Evidence   :  ⚠ Metadata/Provenance Only (No Geometry Columns)    │
│ Evidence Fusion   :  ● MEDIUM Technical Corroboration                    │
│ 3D Topology QC    :  ✓ Valid 2-Manifold Solid (SFCGAL Passed)            │
│ Review Lifecycle  :  UNDER_REVIEW (Informational Display Only)           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Pillar 1: Modeled 3D Solid Geometry
- Displays unit label, tier, floor code, taxonomy class, volume ($m^3$), vertical bounding interval ($Z_{\min} \dots Z_{\max}$), and coordinate reference system (`EPSG:32644`).
- Renders full analytical polyhedral surfaces in the CesiumJS 3D viewport with interactive sectional cutaway (Phase 3.6A) and live metric measurement (Phase 3.6B).

### Pillar 2: Source Evidence (Metadata & Provenance Only)
- For each associated evidence record:
  - Source Type: `LIDAR_POINTCLOUD`, `BIM_IFC`, `ARCHITECTURAL_PLAN`, `TOTAL_STATION`, `GPR`, etc.
  - Dataset Name & File URI.
  - Accuracy: Horizontal accuracy ($\pm X.XX\text{ m}$), Vertical accuracy ($\pm Y.YY\text{ m}$).
  - Evidence Quality / Assessment: `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`.
  - Geometry State: Explicit badge `Geometry: UNAVAILABLE` and disclaimer text: `"Source geometry unavailable — metadata/provenance only"`.
  - Sensor Capability Disclaimers:
    - LiDAR: *"LiDAR evidence available to this prototype does not by itself establish underground geometry."*
    - Subterranean units: *"Suitable engineering/survey evidence should be independently reviewed for subterranean structures."*

### Pillar 3: Multi-Source Evidence Fusion & Discrepancies
- **Categorical Confidence**: Displayed as `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN` without fabricating statistical percentages or probabilities.
- **Decomposable Dimensions**:
  - Source Presence (`MULTI_SOURCE`, `ADEQUATE`, `LIMITED`, `NONE`)
  - Geometry Support (`HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`)
  - Vertical Support (`HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`)
  - Provenance Quality (`HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`)
  - Source Agreement (`HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`)
  - Evidence Completeness (`HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`)
  - Subterranean Safety (`HIGH`, `MEDIUM`, `LOW`, `UNKNOWN`)
- **Discrepancy & Conflict Inspection**:
  - Possible findings: `HEIGHT_CONFLICT`, `FOOTPRINT_CONFLICT`, `Z_RANGE_CONFLICT`, `CRS_UNCERTAIN`, `PROVENANCE_INCOMPLETE`, `UNDERGROUND_EVIDENCE_MISSING`, `TOPOLOGY_CONFLICT`, `MINOR_DISCREPANCY`, `NOT_COMPARABLE`.
  - For each conflict: Code, Severity (`ERROR`, `WARNING`, `INFO`), Affected Attribute, Recommendation, and **Explicit Spatial Reality Notice**:
    *"Discrepancy detected; exact spatial location is not available from stored evidence geometry."*

### Pillar 4: 3D Topology & Spatial Quality-Control
- Validates 2-manifold closed solidness, positive volume, vertical continuity against adjacent tier units, and parcel polygon containment via SFCGAL.

---

## 3. Integration with Prior Sub-Phases

1. **Interactive Sectional Cutaway (Phase 3.6A)**:
   - When inspecting evidence and discrepancies, reviewers can engage $X$, $Y$, and $Z$ cutaway clipping planes to slice through modeled polyhedral boundaries without disrupting evidence review cards.
2. **Interactive 3D Measurement (Phase 3.6B)**:
   - Reviewers can activate 3D Euclidean, Horizontal, or Vertical $\Delta Z$ distance interrogations on the modeled solid geometry while consulting the evidence panel.
   - Spatial Interrogation HUD remains active and responsive.

---

## 4. Claim Safety & Invariants

- **No Fabricated Evidence Geometry**: No artificial polygons, footprints, or meshes are generated from metadata.
- **No Invented Spatial Locations for Conflicts**: Conflicts remain non-localized text/structured cards with explicit disclaimers.
- **Categorical Confidence Only**: Never displays statistical percentage assertions (e.g., "92% confident").
- **Preserved Database Invariants**: 0 database mutations (2 parcels, 2 buildings, 16 vertical units, 16 source evidence records, 16 verification audits).
- **Preserved Lifecycle Invariants**: Inspecting evidence is strictly read-only and does not transition lifecycle states.
