# Phase 3.6D: Prototype Technical Review Dossier & Export

## 1. Overview & Architectural Intent
Phase 3.6D delivers the **Prototype Technical Review Dossier & Export Subsystem** for the SIH26011 3D Cadastral research prototype.

The subsystem consolidates all technical information generated across the locked cadastral pipeline into a structured, explainable, read-only document that can be reviewed interactively or exported via browser printing / "Save as PDF":
- **Identity & Lifecycle**: Prototype 3D Unit ID, parent 2D parcel, building envelope, current lifecycle state, and human governance restrictions.
- **Modeled 3D Geometry**: Analytical PolyhedralSurface geometry, coordinate reference system (`EPSG:32644`), $Z_{\min}$, $Z_{\max}$, Modeled Vertical Height ($Z_{\max} - Z_{\min}$), and volume ($m^3$).
- **Cadastral Taxonomy**: Strata category, unit class, tier code, and floor code.
- **Source Evidence Metadata**: Linked dataset names, URIs, sensor categories, horizontal/vertical accuracies, and explicit `Geometry: UNAVAILABLE` metadata notices.
- **Multi-Source Evidence Fusion**: Categorical confidence (`HIGH`/`MEDIUM`/`LOW`/`UNKNOWN`), decomposable evidence dimensions, and cross-source comparisons.
- **Discrepancy Inspection**: Structured conflict codes and recommendations with explicit spatial non-localization disclaimers.
- **3D Topology QC**: SFCGAL 2-manifold solid validity, vertical continuity, and horizontal parcel footprint containment.
- **Explainable AI Context**: Advisory candidate proposal heuristics and explanations (non-authoritative).
- **Prototype Audit History**: Chronological audit trail of human review actions and decisions.
- **System Limitations**: Explicit disclosure of all research prototype boundaries.

> **CRITICAL ARCHITECTURAL REALITY & CLAIM BOUNDARIES**:
> 1. **Not a Title Certificate**: The dossier is a technical research prototype document. It does NOT constitute a statutory title certificate, ownership deed, official 3D ULPIN, or government cadastral certification.
> 2. **Metadata-Only Evidence**: The `source_evidence` table stores metadata, accuracies, filenames, and SHA-256 fingerprints, but **does not store persistent 3D point cloud or BIM meshes**. The dossier explicitly represents source geometry as unavailable and does NOT invent fake geometry overlays or screenshots.
> 3. **Read-Only Invariant**: Generating or exporting a dossier never mutates database records, lifecycle states, or evidence data.
> 4. **Human Governance Invariant**: Verification remains strictly reserved for authorized human roles (`HUMAN_REVIEWER`, `LICENSED_SURVEYOR`, `REVENUE_OFFICIAL`). Automated algorithms and `SYSTEM_VALIDATOR` are prohibited from verifying units.

---

## 2. Dossier Information Model & Sections

```
┌──────────────────────────────────────────────────────────────────────────┐
│                   PROTOTYPE TECHNICAL REVIEW DOSSIER                     │
├──────────────────────────────────────────────────────────────────────────┤
│ 1. Cadastral Land Parcel & Building Context                              │
│ 2. Modeled 3D Solid Geometry & Spatial Extent                            │
│ 3. Cadastral Vertical Strata Taxonomy                                    │
│ 4. Lifecycle Governance & Review Readiness                               │
│ 5. Supporting Source Evidence & Lineage (Metadata/Provenance Only)       │
│ 6. Multi-Source Evidence Fusion & Confidence Breakdown                   │
│ 7. Discrepancy & Conflict Inspection (Spatial Non-Localization Notice)   │
│ 8. 3D Topology & Spatial Quality-Control (SFCGAL Engine)                 │
│ 9. Explainable AI Candidate Intelligence (Advisory Context)              │
│ 10. Prototype Audit History & Review Decisions                           │
│ 11. Research Prototype Boundaries & Disclaimers                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Print & PDF Export Architecture

To avoid introducing bloated and unstable third-party PDF compilation dependencies into the repository, Phase 3.6D utilizes **Browser-Native High-Fidelity Print Compilation**:
- Clean `@media print` stylesheet embedded in `App.css`.
- Standard A4 page geometry with `page-break-inside: avoid` on all technical sections.
- Automatic removal of interactive web elements (Cesium canvas, navigation header, action buttons, modals).
- Grayscale-safe high-contrast typography and structured border tables.
- Print trigger via `window.print()` enabling instantaneous PDF generation through system print dialogs.

---

## 4. Verification & Regression Metrics

- **Backend Test Suite**: 231 passed (214 locked + 17 Phase 3.6D tests).
- **Frontend Test Suite**: 68 passed (58 locked + 10 Phase 3.6D tests).
- **Production Build**: Clean Vite & TypeScript build (929ms).
- **Database Invariant Counts**: Exactly 2 parcels, 2 buildings, 16 vertical units, 16 source evidence records, 16 verification audits.
- **Database Mutations**: **0**.
