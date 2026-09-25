# SIH26011: Live Demonstration Runbook & Operator Guide

## 1. System Overview & Objective
This runbook provides step-by-step instructions for conducting an end-to-end live demonstration of the **SIH26011: 3D ULPIN Generation and Vertical Property Mapping System** research prototype.

> **DEMO PRINCIPLE**:
> Every visual assertion made during the presentation is backed by real, deterministic backend calculations, PostGIS/SFCGAL solid geometry, source evidence provenance, and human governance audit records.

---

## 2. Pre-Demo Environment Verification

### Prerequisites
- **PostgreSQL 16.15 + PostGIS 3.6.2 / SFCGAL 2.2.0 (GEOS 3.14.1, PROJ 8.2.1)** running on `localhost:5432`.
- **Python 3.11+** virtual environment at `.venv/`.
- **Node.js 18+** / **npm** for the React frontend.

### Service Startup Procedure
Open two terminal windows:

#### Terminal 1 — Backend API Server
```powershell
cd C:\Users\jagad\OneDrive\Desktop\SIH26011-3D-ULPIN
.venv\Scripts\activate
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Verify: Navigate to `http://127.0.0.1:8000/docs` to see Swagger UI.*

#### Terminal 2 — Frontend Application
```powershell
cd C:\Users\jagad\OneDrive\Desktop\SIH26011-3D-ULPIN\frontend
npm run dev
```
*Verify: Navigate to `http://localhost:5173`.*

---

## 3. Canonical 12-Step Live Demonstration Walkthrough

### Scenario A: Primary Demonstration — `TOWER-A` (Multi-Storey High-Rise)

#### Step 1: Cadastral Parcel Discovery & Context
1. In the header dropdown, select **Parcel 1 (`27A8B9C3D4E5F6`)**.
2. **Observe**:
   - The CesiumJS 3D viewport centers on the parcel boundary (yellow polygon).
   - Building footprint envelope (Tower A) appears in context.
   - Status bar confirms `CONNECTED` with FastAPI backend.

#### Step 2: Parcel-Wide Dataset Management & Quality Scorecard
1. In the left **Layer Controls**, click **"3D Dataset Overview & Quality Scorecard"**.
2. **Demonstrate to Evaluators**:
   - Total Units Audited: 6 vertical units in Tower A (Part of the 16 canonical units).
   - 12-Point Consistency Audit (SRID check, coordinate monotonicity, zero volume overlap).
   - Dataset Quality Scorecard: `OPTIMAL` status.

#### Step 3: Vertical Property Stack Exploration
1. In the right **Vertical Explorer**, examine the 3D property hierarchy (6 units):
   - Utility Strata (`UT01-0001` Subsurface Utility Unit)
   - Basement Level (`SB01-0002` Basement Parking)
   - Ground Level (`F00-0003` Ground Commercial Unit)
   - Upper Floors (`F01-0004`, `F02-0005`, `F02-0006` Residential Units)
2. Click unit `F01-0004`:
   - **Observe**: The Cesium 3D camera highlights the unit with cyan selection bounding box.

#### Step 4: True 3D Solid Geometry & Coordinate Interrogation
1. Inspect the **Property Inspector** panel:
   - Prototype 3D Unit ID: `ULPIN-3D-F01-102`
   - $Z_{\min} = 3.50\text{ m}$, $Z_{\max} = 7.00\text{ m}$
   - Modeled Vertical Height $= 3.50\text{ m}$
   - Modeled Volume $= 910.76\text{ m}^3$
   - CRS: `EPSG:32644` (WGS 84 / UTM Zone 44N)

#### Step 5: Interactive Sectional Cutaway (Phase 3.6A)
1. In the left panel, enable **Interactive 3D Sectional Cutaway**.
2. Toggle **Z-Elevation Plane**: Drag the slider down through the building.
3. **Demonstrate**: Real-time orthogonal clipping reveals interior floor slabs, boundary contact surfaces, and vertical shafts.
4. Click **Reset Cutaway Planes**.

#### Step 6: Interactive 3D Measurement & HUD (Phase 3.6B)
1. Enable **Interactive 3D Measurement Engine**.
2. Select **3D Distance Mode**:
   - Click two corner vertices of the modeled polyhedral unit.
   - Observe real-time dashed measurement guide and metric readout.
3. Select **Vertical ΔZ Mode**:
   - Click floor level and ceiling level to interrogate vertical displacement.
   - Observe live HUD in bottom-left tracking Easting, Northing, and Elevation.
4. Click **Clear Points** and disable measurement.

#### Step 7: Multi-Source Evidence Review (Phase 3.6C)
1. In the Property Inspector, scroll to **Pillar 2: Supporting Source Evidence Records**:
   - Aerial LiDAR point cloud (`prototype_tower_a.las`) with $\pm 0.05\text{ m}$ horizontal/vertical accuracy.
   - Architectural BIM model (`tower_a_asbuilt.ifc`) with $\pm 0.02\text{ m}$ accuracy.
   - Explicit badge: `Geometry: UNAVAILABLE` with note: *"Source geometry unavailable — metadata/provenance only."*
   - SHA-256 fingerprint: *"SHA-256 source fingerprint used for provenance and reproducibility."*

#### Step 8: Multi-Source Evidence Fusion & Discrepancies (Phase 3.5 & 3.6C)
1. Review **Pillar 3: Multi-Source Evidence Fusion**:
   - Categorical Confidence: `MEDIUM` (Cross-source height variance).
   - Decomposable Dimensions: Geometry Support (`HIGH`), Provenance Quality (`HIGH`), Vertical Support (`MEDIUM`).
   - Cross-Source Comparisons: Storey Height comparison ($0.12\text{ m}$ difference against $0.10\text{ m}$ tolerance).
   - Conflict Card: `Z_RANGE_CONFLICT` with notice:
     *"Discrepancy detected; exact spatial location is not available from stored evidence geometry."*

#### Step 9: 3D Topology Quality-Control (Phase 3.0)
1. Review **Pillar 4: 3D Topology QC**:
   - SFCGAL PolyhedralSurface 2-manifold closedness: `VALID_SOLID`.
   - Positive interior volume: Verified ($910.76\text{ m}^3$).
   - Boundary contact interface: `CONTIGUOUS` with zero positive-volume overlap collision.

#### Step 10: Explainable AI Advisory Intelligence (Phase 2.9)
1. Review the **AI Candidate Analysis** section:
   - Highlight notice: *"AI-assisted non-authoritative advisory context."*
   - Explainable heuristics: Point cloud density, aspect ratio, compactness, and elevation profile.

#### Step 11: Human-in-the-Loop Review Workspace (Phase 3.1)
1. Click **"Open 3D Review & Decision Workspace"**.
2. Inspect the **Readiness Checklist**:
   - Watertightness: Passed.
   - Volume: Passed.
   - Parcel Containment: Passed.
   - Collision Free: Passed.
3. Demonstrate Decision State Machine:
   - Reviewer role: `LICENSED_SURVEYOR`.
   - Action: `START_REVIEW` or `VERIFY` with mandatory review notes.
   - Highlight that `SYSTEM_VALIDATOR` cannot verify.

#### Step 12: Prototype Technical Review Dossier & Export (Phase 3.6D)
1. In the Property Inspector, click **"📄 View Technical Review Dossier"**.
2. **Examine the 11 Sections**:
   - Header with Research Prototype Notice.
   - Summary Scorecard.
   - Geometry, Taxonomy, Lifecycle, Evidence, Fusion, Discrepancies, Topology QC, AI Context, Audit History, and Standardized Limitations.
3. Click **"🖨️ Print / Save as PDF"**:
   - Show browser print preview rendering an A4-optimized, clean, high-contrast black-and-white technical dossier with all interactive elements hidden.

---

### Scenario B: Secondary Demonstration — `VERTICAL-MIXED-A` (Heterogeneous Multi-Tier Strata)
1. In the header dropdown, switch to **Parcel 2 (`27A8B9C3D4E5F7`)**.
2. **Observe**: 10 heterogeneous vertical property units spanning all cadastral strata:
   - Subterranean Utilities (`UT01`)
   - Basements (`B02`, `B01`)
   - Ground Level (`F00`, `P00` Parking)
   - Common Circulation Shaft (`CM01`)
   - Upper Residential Floors (`F01`, `F02`)
   - Rooftop Air-Rights Strata (`RF01` Air-Rights / Tier AR)
   - Elevated Pedestrian Link (`AE01` Elevated / Tier AE)
3. Inspect Subterranean Basements (`B01`, `B02`):
   - Note sensor capability disclaimer: *"LiDAR evidence available to this prototype does not by itself establish underground geometry."*
   - Note subsurface engineering evidence requirement (BIM / architectural survey).
4. Inspect Rooftop Air-Rights Strata (`RF01`):
   - Demonstrates vertical co-existence of air-rights and common utility shafts without volumetric collision.

---

## 4. Operator Troubleshooting & Failure Recovery

| Issue | Symptom | Remediation |
|---|---|---|
| Backend Offline | Red `DISCONNECTED` badge in header | Check Terminal 1. Restart: `uvicorn backend.app.main:app --port 8000` |
| Database Error | `psycopg.OperationalError` | Ensure PostgreSQL service is running (`net start postgresql-x64-16`) |
| Cesium Canvas Blank | Globe does not appear | Verify internet connection for Cesium Ion terrain, or check WebGL hardware acceleration in Chrome settings |
| Unit Not Selecting | Click does not highlight unit | Click directly on the unit in the **Vertical Explorer** hierarchy |
| Print Dialog Clipped | Print preview has margin cutoffs | In print dialog, select Destination: **Save as PDF**, Paper size: **A4**, Margins: **Default** |
