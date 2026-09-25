# SIH26011 — 3D ULPIN Generation & Vertical Property Mapping System

> **LEGAL & REGULATORY NOTICE — RESEARCH PROTOTYPE**  
> This project is a **research prototype** developed for Smart India Hackathon (SIH26011). The proposed 3D vertical identifier is **not an official Government of India ULPIN specification** and does not replace or modify the existing 2D ULPIN system.

---

## Project Purpose

This repository explores the technical feasibility of layering a volumetric, 3D vertical stratification model onto India's existing **14-digit 2D ULPIN (Bhu-Aadhaar)** land parcel identifier. It provides an engineering prototype capable of mapping multi-storey residential units, subterranean basement parking, underground utility corridors, and elevated transit infrastructure.

---

## Key Operating Constraints & Principles

1. **Research Prototype Designation**:
   All vertical identifiers (e.g., `{2D_ULPIN}-3D-{TIER}-{SEQ}`) are research prototypes for academic and hackathon demonstration purposes. They carry no official legal standing and are not recognized by the Department of Land Resources (DoLR) or DILRMP.
2. **No Live Government API Integration**:
   This system does not connect to, write to, or integrate with live production government databases, including DILRMP, Bhu-Naksha, NGDRS, or state revenue portals. No public write APIs exist for these platforms.
3. **Simulated Cadastral Dataset**:
   All 2D base parcels, spatial boundaries, ownership titles, and vertical strata are instantiated from an internal simulated dataset owned and controlled by this project (`data/simulated/`).
4. **Human-in-the-Loop Legal Determination**:
   Automated processes and AI-assisted segmentation pipelines only produce objects in a `PROPOSED` state. Legal and cadastral validity is strictly governed by a human verification workflow:
   $$\text{PROPOSED} \longrightarrow \text{UNDER\_REVIEW} \longrightarrow \text{VERIFIED}$$
   No automated or AI process is permitted to create a `VERIFIED` record.

---

## Technical Architecture Overview

* **Analysis Coordinate System**: Metric Cartesian Projected System (UTM Zone 44N — `EPSG:32644`).
* **Vertical Datum**: Orthometric Height ($H$) in meters relative to Mean Sea Level (MSL / EGM2008).
* **3D Geometry Model**: Two-Tier Hybrid Architecture — Canonical Boundary Representation (B-Rep) Polyhedral Solids (`POLYHEDRALSURFACE Z` conforming to ISO 19107) backed by 3D Bounding Box (`BOX3D`) analytical proxies.
* **Visualization Stack**: React + Vite + CesiumJS using OGC 3D Tiles 1.1 streaming.
* **Database & Processing**: PostgreSQL 16 + PostGIS 3D, Python 3.11 spatial engine.

For complete architectural specifications, see [ADR-001: Core System Architecture](docs/decisions/ADR-001-core-architecture.md) and the [3D ULPIN Architecture Blueprint](docs/architecture/3D_ULPIN_System_Architecture_Blueprint.md).
