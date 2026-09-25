# Phase 3.6B: Interactive 3D Measurement & Spatial Interrogation Engine

## 1. Overview & Architectural Intent
Phase 3.6B delivers the **Interactive 3D Measurement & Spatial Interrogation Engine** for the SIH26011 3D Cadastral research prototype.

The engine enables human reviewers, licensed surveyors, and technical analysts to perform live spatial interrogation and Euclidean metric distance calculations across multi-tier 3D vertical units directly in the CesiumJS 3D viewport.

> **CRITICAL ARCHITECTURAL INVARIANT**:
> **Interactive 3D measurements are client-side spatial interrogation tools operating on modeled prototype geometries. They do not alter canonical database geometry, create persistent records, or constitute legal surveys or statutory cadastral certifications.**

---

## 2. Supported Measurement Modes & Mathematical Formulas

The measurement subsystem operates strictly in a metric Cartesian coordinate frame referencing the project's canonical analytical CRS (**EPSG:32644 — WGS 84 / UTM Zone 44N**):

### A. 3D Euclidean Distance (`DISTANCE_3D`)
- **Formula**:
  $$D_{3D} = \sqrt{(X_2 - X_1)^2 + (Y_2 - Y_1)^2 + (Z_2 - Z_1)^2}$$
- **Semantics**: Calculates true spatial direct-line distance in 3D space between two picked points.

### B. Horizontal Distance (`DISTANCE_HORIZONTAL`)
- **Formula**:
  $$D_{2D} = \sqrt{(X_2 - X_1)^2 + (Y_2 - Y_1)^2}$$
- **Semantics**: Calculates orthogonal 2D horizontal footprint displacement across the Easting-Northing plane.

### C. Modeled Vertical Differential (`DELTA_Z`)
- **Formula**:
  $$\Delta Z = |Z_2 - Z_1|$$
- **Semantics**: Calculates vertical height displacement between two picked elevations.
- **Claim Boundary**: Labeled explicitly as **Modeled Vertical ΔZ**; does not establish architectural "clear height" or "floor-to-ceiling clearance".

---

## 3. Coordinate System & Transformation Pipeline

1. **Analytical Canonical CRS**: `EPSG:32644` (Easting, Northing in meters).
2. **Visualization Ellipsoidal CRS**: `EPSG:4326` (WGS 84 Longitude, Latitude in degrees).
3. **Cesium Picking to Analytical Transformation**:
   - Screen-space click $(x, y)$ is projected to Cesium 3D scene position using `scene.pickPosition` / `camera.pickEllipsoid`.
   - Resulting Cartesian3 coordinates are converted to WGS 84 Cartographic $(\text{lon}, \text{lat}, \text{height})$.
   - `transformWGS84To32644(lon, lat, height)` computes exact metric Easting and Northing via `proj4`.
   - Distances are computed directly from metric coordinates, ensuring zero distortion from angular degree calculations.

---

## 4. UI Components & Interaction

1. **Measurement Control Panel in Layer Controls**:
   - Mode selectors: `[ Off ]`, `[ 3D Distance ]`, `[ Horizontal ]`, `[ Vertical ΔZ ]`.
   - Real-time Point A and Point B coordinate readouts ($E, N, Z$).
   - Computed metrics display grid ($D_{3D}, D_{2D}, \Delta Z$).
   - `Clear Points` button.
2. **Floating Spatial Interrogation HUD**:
   - Real-time tracking of cursor position over the 3D scene.
   - Dual coordinate readout:
     - **EPSG:32644**: Easting (m), Northing (m), Prototype Elevation (m).
     - **WGS84**: Longitude (°), Latitude (°).
3. **Temporary 3D Visual Guides**:
   - Point A amber beacon marker with elevation tag.
   - Point B cyan beacon marker with elevation tag.
   - Glowing dashed measurement vector connecting Point A and Point B.
   - Midpoint metric distance label.
   - Fully volatile; automatically disappears on mode change, clear, or viewer reset.

---

## 5. Non-Destructive Invariants & Database Integrity

- **Database Mutations**: **0** (No INSERT, UPDATE, DELETE, or schema modifications).
- **Locked Phase Invariants**:
  - Phase 3.0: 3D Topology validation untouched.
  - Phase 3.1: Human review lifecycle and cryptographic audit untouched.
  - Phase 3.2: Vertical unit taxonomy untouched.
  - Phase 3.3: Ingestion, CRS validation, and provenance untouched.
  - Phase 3.4: Solid reconstruction untouched.
  - Phase 3.5: Multi-source evidence fusion untouched.
  - Phase 3.6A: Orthogonal sectional cutaway clipping untouched.

---

## 6. Known Limitations & Claim Safety

1. **Pick Precision**: Measurements reflect picked polygonal facet boundaries or terrain surfaces as rendered on screen.
2. **Subterranean Measurements**: Measuring subterranean units (`SB`, `UT`) inspects modeled CAD/BIM solid boundaries; it does not measure physical underground ground truth.
3. **Claim Safety**:
   - Not an official legal boundary survey.
   - Not a certified cadastral measurement.
   - Not structural clear height certification.
   - Elevation is prototype vertical elevation; not certified MSL or EGM2008 datum.
