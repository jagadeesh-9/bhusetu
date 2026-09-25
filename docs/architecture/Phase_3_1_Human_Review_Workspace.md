# Phase 3.1: Human-in-the-Loop 3D Property Review & Decision Workspace Architecture

## Executive Summary
Phase 3.1 delivers the **Human-in-the-Loop 3D Property Review and Decision Workspace** for the SIH26011 3D ULPIN research prototype. In 3D cadastral modeling, automated computational algorithms (LiDAR building extraction, vertical storey segmentation, SFCGAL 3D solid reconstruction, explainable AI candidate proposals, and 3D topology conflict detection) serve strictly as **candidate proposers and computational quality-control auditors**.

This architecture establishes a unified multi-dimensional review dossier (`GET /api/vertical-units/{id}/review`), an automated review readiness checklist, structured rejection tracking, role-based transition controls, non-destructive candidate resubmission, and an interactive high-density review modal in the frontend application.

---

## 1. System Architecture & Flow

```
+-----------------------------------------------------------------------------------+
|                        COMPUTATIONAL CANDIDATE PROPOSERS                          |
|  - LiDAR Building Extractor (2.2)       - Deterministic Storey Segmenter (2.3)    |
|  - 3D PolyhedralSurface Builder (2.4)   - Explainable AI Candidate Proposer (2.9) |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v  [Candidate Status: PROPOSED]
+-----------------------------------------------------------------------------------+
|                         AUTOMATED 3D AUDITING ENGINES                             |
|  - SFCGAL Solid Geometry Engine (Watertightness, 3D Volume, Valid Solids)         |
|  - 3D Topology & Spatial Collision Engine (3.0) (Volumetric Collision Analytics)  |
|  - 2D Parcel Containment & Vertical Continuity Audit                              |
|  - Multi-Source Evidence & Provenance Intelligence (2.7)                          |
|  - Subsurface Supporting Evidence Assessor (BIM / CAD / Engineering Plans)        |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v  [Aggregated Dossier Engine]
+-----------------------------------------------------------------------------------+
|                    HUMAN REVIEW & DECISION WORKSPACE (Phase 3.1)                  |
|  - Unified Dossier Endpoint: GET /api/vertical-units/{id}/review                  |
|  - Algorithmic Readiness Checklist (Auto-calculated: READY / ATTENTION_REQUIRED)  |
|  - Authoritative Human Decision Gate: POST /api/vertical-units/{id}/transition    |
+-----------------------------------------+-----------------------------------------+
                                          |
             +----------------------------+----------------------------+
             |                                                         |
             v [VERIFY]                                                v [REJECT]
+--------------------------+                             +--------------------------+
| Status: VERIFIED         |                             | Status: REJECTED         |
| - Verified by: Human     |                             | - Structured Code Logged |
| - Prototype 3D Unit ID   |                             | - Prototype Audit History|
+--------------------------+                             | - Non-destructive Retry  |
                                                         +--------------------------+
```

---

## 2. Core Components & Endpoints

### 2.1 Unified Review Dossier Endpoint
**Endpoint:** `GET /api/vertical-units/{unit_id}/review`  
**Service:** `ReviewService.get_review_case(unit_id: str)`

Aggregates in a single high-performance payload:
1. **Vertical Property Core Metadata:** Prototype 3D Unit ID, Unit Type, Building ID, Floor Code, Elevation Range ($Z_{base} - Z_{top}$), Height.
2. **3D Solid Geometry Audit:** PostGIS/SFCGAL `ST_3DVolume`, `ST_IsSolid`, `ST_IsClosed`, `ST_IsValid`, Vertex count, and Facet count.
3. **3D Topology & Spatial Conflicts:** Real-time spatial collision evaluation (Intersection Volume, Overlap Ratio, Conflict Description) against adjacent vertical units. Boundary contact interfaces are classified as `INFO` and are not conflicts.
4. **2D Footprint & Spatial Containment:** Boundary polygon containment status and vertical alignment against building/parcel footprints.
5. **Multi-Source Evidence Intelligence:** Linked sensor provenance (LiDAR, BIM/IFC, Architectural Blueprints, GPR), confidence scores, and acquisition dates.
6. **Subsurface Supporting Evidence Assessment:** Evaluates availability of suitable supporting documentation (BIM, CAD, architectural plans, subsurface survey evidence) for underground units.
7. **Explainable AI Proposal Context (Advisory):** Heuristic feature scores, spatial confidence, rule provenance, and non-authoritative AI rationale.
8. **Algorithmic Review Readiness Checklist:** Computational validation checks with an overall summary (`READY_FOR_HUMAN_REVIEW` vs `REVIEW_REQUIRES_ATTENTION` vs `BLOCKED_INVALID_GEOMETRY`).
9. **Chronological Audit History:** Append-oriented prototype lifecycle history tracing transitions, actor roles, rejection codes, and reviewer remarks.

### 2.2 Lifecycle State Machine & Role Enforcement

```
[PROPOSED]  ------(Authorized Human: START_REVIEW)------>  [UNDER_REVIEW]
                                                                  |
                                                                  |---(Authorized Human: VERIFY)----> [VERIFIED]
                                                                  |
                                                                  +---(Authorized Human: REJECT)----> [REJECTED]
```

- **Authorized Verification Roles:**
  - `HUMAN_REVIEWER`
  - `LICENSED_SURVEYOR`
  - `REVENUE_OFFICIAL`
- **Blocked from Verification:**
  - `SYSTEM_VALIDATOR`, AI agents, or automated scripts attempting `new_status == "VERIFIED"` receive `422 Unprocessable Entity`.
  - Machine algorithms can submit candidates, compute topology, and log diagnostic audits, but cannot independently grant verification.
- **Direct Transitions Forbidden:**
  - Direct `PROPOSED -> VERIFIED` and `PROPOSED -> REJECTED` transitions are blocked (HTTP 400). Units must enter `UNDER_REVIEW` before verification or rejection.

### 2.3 Structured Rejection Reason Codes
When transitioning to `REJECTED`, the reviewer must supply one of the standardized rejection codes:
- `GEOMETRY_INVALID`: SFCGAL geometry is non-solid, non-closed, or contains self-intersecting facets.
- `SPATIAL_CONFLICT`: 3D volumetric collision with an existing unit or parcel boundary encroachment.
- `INSUFFICIENT_EVIDENCE`: Missing supporting sensor scans or unverified building documentation.
- `INCORRECT_VERTICAL_BOUNDARY`: $Z_{base}$ / $Z_{top}$ values mismatch floor plans or structural elevations.
- `INCORRECT_UNIT_TYPE`: Mismatched property taxonomy classification.
- `OTHER`: Exceptional or administrative issues detailed in the review notes.

### 2.4 Non-Destructive Candidate Resubmission
Rejected candidate records are preserved in PostgreSQL to maintain audit history and provenance. Resubmitting an updated unit creates a new candidate proposal without overwriting or destroying previous decision records.

---

## 3. Frontend Review & Decision Workspace

### 3.1 Component Hierarchy
- `PropertyInspector.tsx`: Provides a "Open 3D Review & Decision Workspace" CTA on any inspected vertical unit.
- `ReviewWorkspace.tsx`: A tabbed modal dialog presenting:
  1. **Tab 1: Readiness Checklist:** Visual status cards for algorithmic checks and overall readiness banner.
  2. **Tab 2: 3D Topology & Spatial Conflicts:** Real-time spatial collision breakdown (intersection volume, overlap percentage, conflict severity).
  3. **Tab 3: Evidence & AI Intelligence:** Sensor provenance cards, subsurface evidence status, and explainable AI proposal rationale with advisory notices.
  4. **Tab 4: Audit History:** Chronological timeline showing actor roles, timestamped transitions, rejection codes, and reviewer notes.
  5. **Authoritative Human Decision Gate:** Interactive controls for role selection, action triggering (`START_REVIEW`, `VERIFY`, `REJECT`), structured rejection code dropdown, and review notes entry.

---

## 4. Verification & Test Coverage
- **Backend Tests:** 149 passing tests across the entire suite (`pytest`), including dedicated Phase 3.1 unit & integration tests (`test_human_review_workspace.py`).
- **Frontend Tests:** 18 passing tests (`vitest run`), validating readiness checks, role security, lifecycle state machine, and rejection code bindings.
- **Frontend Production Build:** `npm run build` compiles cleanly with zero TypeScript errors.
- **Database Consistency:** Canonical CRS `EPSG:32644` preserved; 16 permanent vertical units (TOWER-A and VERTICAL-MIXED-A) intact with zero data loss.
