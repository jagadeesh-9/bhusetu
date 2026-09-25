# Phase 3.6A: Interactive 3D Sectional Cutaway & Orthogonal Clipping Engine

## 1. Overview & Architectural Intent
Phase 3.6A delivers the **Interactive 3D Sectional Cutaway & Orthogonal Clipping Engine** for the SIH26011 3D Cadastral research prototype. 

The engine enables human reviewers, licensed surveyors, and revenue officials to dynamically section through multi-tier 3D building strata and visualize internal vertical units (`CM01`, `UT01`, `B01`, `F00`, `F01`, `F02`, `AE01`, `AR01`) in their true 3D spatial relationships.

> **CRITICAL ARCHITECTURAL INVARIANT**:
> **Clipping planes are a client-side visualization feature and do not alter canonical database geometry.**

---

## 2. Orthogonal Clipping Semantics & Coordinate Frames

The cutaway engine operates on 3 orthogonal logical axes referenced to the local parcel/building coordinate frame in EPSG:32644 (WGS 84 / UTM Zone 44N) and projected to WGS 84 ellipsoidal coordinates for CesiumJS rendering:

### A. Z-Axis (Horizontal Elevation / Floor Stratification Cut)
- **Cut Plane Normal**: Horizontal ($+Z$ up).
- **Semantics**: Clips vertical unit solids whose lower bound ($z_{min}$) lies above the active elevation threshold ($Z_{cut}$).
- **Inspection Goal**: Allows reviewers to peel away upper residential or commercial floors to inspect intermediate shared circulation (`CM01`), ground-floor retail (`F00`), and subterranean parking/utility tiers (`B01`, `UT01`).
- **Safety Boundary**: This is a floor-stratum sectioning tool; it does not compute or certify structural "clear height".

### B. X-Axis (East-West Sectional Cut)
- **Cut Plane Normal**: East-West axis in EPSG:32644 ($+X$ East).
- **Semantics**: Clips unit solids located east of the cut plane ($x > X_{center} + X_{offset}$).
- **Inspection Goal**: Exposes East-West vertical architectural slices, revealing adjacent unit partitions and vertical stacking profiles.

### C. Y-Axis (North-South Sectional Cut)
- **Cut Plane Normal**: North-South axis in EPSG:32644 ($+Y$ North).
- **Semantics**: Clips unit solids located north of the cut plane ($y > Y_{center} + Y_{offset}$).
- **Inspection Goal**: Exposes North-South cross-sections through building cores and lateral stairwells/elevators.

---

## 3. UI Controls & User Workflow

The 3D Review controls are integrated into the primary **Layer Controls** toolbar in a compact, intuitive panel:

1. **Cutaway Master Switch (`[ OFF | ON ]`)**:
   - **Default**: `OFF`.
   - When `OFF`, the 3D scene renders unmodified canonical geometries without clipping overhead.
   - When `ON`, orthogonal plane controls become active.

2. **Orthogonal Plane Controls**:
   - **X Plane (E-W Cut)**: Enable checkbox + East-West offset slider ($-25\text{m}$ to $+25\text{m}$).
   - **Y Plane (N-S Cut)**: Enable checkbox + North-South offset slider ($-25\text{m}$ to $+25\text{m}$).
   - **Z Plane (Elevation Cut)**: Enable checkbox + Elevation slider ($-10\text{m}$ to $+30\text{m}$).

3. **Reset Cutaway (`Reset Cutaway Planes`)**:
   - Immediately restores all plane sliders to default offsets and disables all active clipping planes.

4. **Integration with Existing Tools**:
   - Seamlessly co-operates with **Isolated Unit Mode**, **Underground Translucency Mode**, **Vertical Slice Mode (Phase 3.2)**, and **Lifecycle Status Filtering**.

---

## 4. Subterranean & Underground Disclaimer

> **IMPORTANT DISCLAIMER**:
> Visualization of modeled subterranean units (`SB`, `UT`) through sectional cutaway displays stored polyhedral solid boundaries only.
> **This does NOT establish underground geometry from LiDAR.**
> In accordance with Phase 3.5 sensor physics rules, LiDAR signals do not penetrate opaque ground surfaces; subterranean unit geometries derive strictly from terrestrial as-built BIM/architectural plans or GPR provenance.

---

## 5. Non-Destructive Invariants & Claim Safety

1. **Zero Database Mutations**: No `INSERT`, `UPDATE`, `DELETE`, or schema migrations are created or executed.
2. **Locked Phase Preservation**:
   - Phase 3.0: 3D Topology validation remains canonical and untouched.
   - Phase 3.1: 4-state lifecycle (`PROPOSED`, `UNDER_REVIEW`, `VERIFIED`, `REJECTED`) and cryptographic SHA-256 audit chaining remain unchanged.
   - Phase 3.2: Vertical unit taxonomy (`SB`, `UT`, `CM`, `F`, `AE`, `AR`) preserved.
   - Phase 3.3: Ingestion, CRS validation, and provenance records preserved.
   - Phase 3.4: Analytical 3D solid reconstruction untouched.
   - Phase 3.5: Multi-source evidence fusion scoring untouched.
3. **Claim Safety**:
   - Sectional cutaways expose only modeled `vertical_units.geom_3d` solids.
   - Does NOT imply inspection of interior wall partitions, MEP conduits, rebar/reinforcement, or unmodeled interior rooms.
