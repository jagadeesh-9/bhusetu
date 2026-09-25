# Backend Architecture Specification — Phase 1.3 Foundation

> **RESEARCH PROTOTYPE SPECIFICATION**  
> System: SIH26011 — 3D ULPIN Generation and Vertical Property Mapping System  
> Status: Active / Approved  
> Target Database: PostgreSQL 16 + PostGIS 3.6.2 (SFCGAL 2.2.0)  
> Analysis CRS: EPSG:32644 (UTM Zone 44N)  

---

## 1. Overview & Architectural Hierarchy

The SIH26011 backend is a lightweight, high-performance REST API designed to expose the 3D cadastral database entities to client consumers (WebGIS viewer, verification dashboard, analytical tools).

```text
┌────────────────────────────────────────────────────────┐
│             Client Layer (React / CesiumJS)            │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / JSON (3D GeoJSON & EWKT)
                            ▼
┌────────────────────────────────────────────────────────┐
│             FastAPI Router & Endpoints Layer           │
│   (/api/health, /api/parcels, /api/vertical-units)     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                     Service Layer                      │
│ (Query orchestration, geometry formatting, validation) │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│           Repository & Database Access Layer           │
│         (SQLAlchemy 2.0 + GeoAlchemy2 + Pydantic)      │
└───────────────────────────┬────────────────────────────┘
                            │ Parameterized SQL over psycopg
                            ▼
┌────────────────────────────────────────────────────────┐
│           Canonical Spatial Store (PostgreSQL 16)      │
│          PostGIS 3.6.2 + SFCGAL 2.2.0 (EPSG:32644)     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Technology Selection & Rationale

* **Runtime:** Python 3.11 (native virtual environment at `.venv`).
* **Web Framework:** **FastAPI** — high-performance asynchronous REST framework with automatic OpenAPI documentation and strict Pydantic v2 validation.
* **ORM & Database Driver:** **SQLAlchemy 2.0** with **GeoAlchemy2** over **psycopg 3** — provides robust parameterized spatial query execution, type safety, and connection pooling.
* **Spatial Handling:** **PostGIS Core + SFCGAL functions** via `ST_AsGeoJSON`, `ST_AsEWKT`, `ST_Envelope`, `CG_Volume`, preserving 3D coordinates $(X, Y, Z)$ and metric accuracy in `EPSG:32644`.
* **Configuration:** **Pydantic Settings** loading environment variables from `.env` with secure defaults and zero hard-coded credentials.

---

## 3. 3D Geometry Transport Strategy

### Challenge:
Standard 2D GeoJSON (`RFC 7946`) does not define a native `PolyhedralSurface` geometry type, though it supports 3D positions `[x, y, z]`.

### Dual-Representation Strategy:
To avoid losing 3D volumetric precision or flattening $(X, Y, Z)$ into 2D $(X, Y)$, all spatial endpoints return:
1. **`geojson` (Structured 3D GeoJSON):** PostGIS `ST_AsGeoJSON(geom_3d)` output preserving all 3D vertices $[X, Y, Z]$ across polygonal facets formatted as a 3D `MultiPolygon` / `GeometryCollection`.
2. **`ewkt` (Exact Well-Known Text):** PostGIS `ST_AsEWKT(geom_3d)` preserving the explicit `SRID=32644;POLYHEDRALSURFACE Z (...)` representation for analytical and validation consumers.
3. **`srid`:** Explicit integer `32644` indicating metric UTM coordinates.
4. **`z_min` & `z_max`:** Numeric orthometric elevation bounds relative to Mean Sea Level (MSL).

---

## 4. Security & Safety Principles

1. **Zero Secret Leaks:** Database passwords and sensitive connection parameters are strictly managed via environment variables (`DATABASE_URL`).
2. **Parameterized Queries:** All relational and spatial queries are parameterized through SQLAlchemy / GeoAlchemy2 to prevent SQL injection.
3. **Sanitized Error Responses:** Database connection failures or internal exceptions return generic JSON error codes (`500 Internal Server Error`) without leaking stack traces or connection strings.
4. **Read-Only Scope in Phase 1.3:** Only idempotent HTTP `GET` endpoints are exposed. Mutation and verification endpoints are introduced in subsequent governed phases.
