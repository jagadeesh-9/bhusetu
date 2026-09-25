# SIH26011 — Final SIH Demonstration Runbook

**Project Title:** 3D ULPIN Generation & Vertical Property Mapping System  
**Category:** Land Governance & 3D Cadastre (Smart India Hackathon)  
**Status:** Code Freeze / Production Ready (Phase 3.9)

---

## 1. Prerequisites

Before launching the demonstration, ensure the following services and environments are in place:

1. **PostgreSQL 16 + PostGIS:**
   - PostgreSQL service running on `localhost:5432`.
   - Target database: `sih26011_dev`.
   - PostGIS extension active (`CREATE EXTENSION IF NOT EXISTS postgis;`).
2. **Python Virtual Environment (`.venv`):**
   - Python 3.11+ virtual environment configured at `.venv/`.
   - Dependencies installed (`fastapi`, `uvicorn`, `sqlalchemy`, `shapely`, `pydantic`, `psycopg`).
3. **Node.js & npm:**
   - Node.js v18+ and npm installed.
   - Frontend dependencies installed in `frontend/node_modules/`.
4. **Project Directory:**
   - Absolute root: `c:\Users\jagad\OneDrive\Desktop\SIH26011-3D-ULPIN`.

---

## 2. Start Backend

Open a terminal at the project root and run:

```powershell
# In project root
.venv\Scripts\Activate.ps1
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

*Verification:*
- Backend Swagger UI available at: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/api/parcels` returns 200 OK with `APARTMENT-SURYA-OSM`.

---

## 3. Start Frontend

Open a second terminal in the `frontend` folder and run:

```powershell
# In frontend directory
cd frontend
npm run dev
```

*(Or from root: `npm --prefix frontend run dev`)*

---

## 4. Open Application

Open a modern Chromium-based browser (Google Chrome or Microsoft Edge) and navigate to:

```text
http://localhost:5173/
```
*(If port 5173 is occupied, Vite will automatically select `http://localhost:5174/` or `http://localhost:5175/` as displayed in the Vite terminal).*

---

## 5. Automated One-Click Launcher (Windows)

Alternatively, run the included batch launcher from the project root:

```cmd
start_demo.bat
```

This will automatically launch the backend API and frontend dev server in separate managed windows without modifying database state or running migrations.

---

## 6. Expected Startup State

Upon page load, verify the judge-ready default state:

| Component | Default State |
| :--- | :--- |
| **Active Dataset** | `APARTMENT-SURYA-OSM` (Surya Heights Residential Apartment, Hyderabad) |
| **Viewport** | Full 3D building visible, grounded at datum elevation ($540.00\,\text{m}$ prototype base) |
| **Floor Selection** | None preselected (`selectedUnitId = null`) |
| **Technical Tools Panel** | Collapsed by default on the right |
| **Elevation Levels Overlay** | OFF by default |
| **Camera** | Front architectural elevation angle ($0^\circ$ heading, $-20^\circ$ pitch) |
| **Attribution** | OpenStreetMap Way `356027047` reference anchor tag visible in header |

---

## 7. 2–3 Minute Demonstration Path (Judge Presentation Script)

Follow this exact chronological script during judge evaluation:

### **00:00 — 00:20 | Geographic Context & Real OSM Anchor**
- **Action:** Point out the map and property header.
- **Talking Points:**
  - *"We are looking at Hyderabad, Telangana, India."*
  - *"Our system links 2D cadastral parcels with real OpenStreetMap spatial footprints (OSM Way 356027047) to establish the horizontal geographic anchor."*

### **00:20 — 00:40 | The 3D Vertical Property Concept**
- **Action:** Direct attention to the 8-level building stack in the left panel.
- **Talking Points:**
  - *"Traditional land registries stop at 2D parcel bounds. Our solution models vertical property rights as true 3D PolyhedralSurface volumes."*
  - *"Surya Heights models 8 discrete vertical strata: Basement Parking (B01), Ground Level (F00), Floors 1 through 5, and the Rooftop (RF01)."*

### **00:40 — 01:00 | 360° Orbital Inspection**
- **Action:** Drag with Left Click to smoothly orbit around the building. Tilt with Right Click/Middle Drag.
- **Talking Points:**
  - *"Evaluators can perform a complete 360° orbital spatial inspection around the building centroid to inspect vertical alignment, cantilevered sections, and building envelope constraints."*

### **01:00 — 01:20 | Individual Unit Inspection (Floor 3)**
- **Action:** Click **F03** in the Building Levels navigator.
- **Talking Points:**
  - *"Selecting Floor 3 isolates the property unit while maintaining contextual building transparency."*
  - *"The Property Inspector displays the unique Prototype 3D ULPIN (`36A1B2C3D4E5F9-F03-U001`), Elevation from Ground (`+12.50 m`), Floor-to-Floor Height (`4.00 m`), Unit Volume (`1,691.80 m³`), and prototype Z-bounds."*

### **01:20 — 01:40 | Subterranean Rights (Basement Parking)**
- **Action:** Click **B01 — Basement Parking**.
- **Talking Points:**
  - *"Subsurface property rights are vital for underground parking and utility easements. Our system renders the subterranean stratum with negative prototype elevation (`-3.50 m`)."*
  - *"The inspector explicitly notes provenance and subterranean limitations to ensure transparent cadastral evidence."*

### **01:40 — 01:50 | Camera Re-Framing**
- **Action:** Click **Frame Building** in the floating toolbar.
- **Talking Points:**
  - *"At any moment, Frame Building cleanly re-centers the perspective to the canonical architectural overview without breaking orbital controls."*

### **01:50 — 02:05 | Architectural Vertical Elevation Levels Overlay**
- **Action:** Open **Technical Tools** (top right) $\rightarrow$ Toggle **Elevation Levels**.
- **Talking Points:**
  - *"Our architectural elevation overlay projects exact vertical datum guide lines and elevation markers (`B01 -3.50m` to `RF01 +21.50m`) along the facade, providing instant visual elevation benchmarking."*

### **02:05 — 02:20 | Volumetric Verification (Wireframe & Cutaway)**
- **Action:** Toggle **Wireframe** on, then toggle **3D Cutaway** briefly to show internal floor slabs, then turn both off.
- **Talking Points:**
  - *"Non-destructive diagnostic tools allow surveyors to inspect internal floor boundaries, slab thickness, and topological intersections in real time."*

### **02:20 — 02:30 | LADM Alignment & Quality Scorecard**
- **Action:** Click **Quality Scorecard**.
- **Talking Points:**
  - *"The system performs automated 3D spatial validation following the ISO 19152 LADM standard—verifying 2-manifold closed solids, zero volumetric overlaps, Euler characteristic $\chi = 2$, and coordinate precision."*

### **02:30 | Clean Final State**
- **Action:** Close the modal and ensure Technical Tools is collapsed.
- **Talking Points:**
  - *"The result is an authoritative, interoperable, and production-ready 3D ULPIN mapping framework for Indian urban cadastre."*

---

## 8. Emergency Recovery Procedures

If an unexpected camera angle or visualization mode is triggered during live presentation, use these instant recovery steps:

1. **Lost Camera or Zoomed Too Far:**
   - Click **Frame Building** in the floating top-center toolbar.
2. **Stuck in 2D Top-Down Mode:**
   - Click **3D Perspective** in the floating toolbar or Technical Tools.
3. **Interior / Clipped View Active:**
   - Open **Technical Tools** $\rightarrow$ Toggle **3D Sectional Cutaway** to **OFF**.
4. **Mouse Tool Locked in Measurement:**
   - In the Measurement floating panel, click **Clear Points** or click **Exit Tool**.
5. **A Single Floor is Isolated/Highlighted:**
   - Click **Deselect / Overview** or click **Frame Building**.

---

## 9. Presentation Claim Safety Guidelines

Maintain strict scientific and cadastral accuracy during judge Q&A:

- **OpenStreetMap Footprint:**
  - *Claim:* Used as a real-world geographic reference anchor for building footprint spatial positioning.
  - *Do NOT claim:* OSM is legally verified cadastral revenue record data.
- **Vertical Cadastral Geometry:**
  - *Claim:* Synthetic, research-prototype 3D cadastral model structured according to standard Indian urban multi-storey development norms.
- **3D ULPIN Identifiers:**
  - *Claim:* Prototype 3D spatial sub-parcel identifier extension conforming to the proposed 3D ULPIN specification.
  - *Do NOT claim:* Official state-issued government title certificate.
- **Vertical Elevation Values:**
  - *Claim:* "Prototype Vertical Elevation Reference relative to ground datum ($540.00\,\text{m}$ base)".
  - *Do NOT claim:* Official surveyed MSL/AMSL datum unless local geodetic tie-in data is cited.
- **Automated Validation:**
  - *Claim:* "LADM-aligned data model (ISO 19152 conceptual profile)" verified via 3D topological solid reconstruction.

---

## 10. Verification Checklist

- [x] Database: PostgreSQL 16 + PostGIS running on `localhost:5432` (`sih26011_dev`)
- [x] Backend: FastAPI running on `http://127.0.0.1:8000` (247 backend tests passing)
- [x] Frontend: React + Vite running on `http://localhost:5173/` (78 frontend tests passing)
- [x] Production Build: `npm run build` succeeds with zero errors
- [x] Canonical Dataset: `APARTMENT-SURYA-OSM` loads 8 vertical units (`B01` through `RF01`)
- [x] All 5 Recovery Actions tested and verified operational
