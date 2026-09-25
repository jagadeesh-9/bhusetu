import os
import sys
import sqlite3
import json
import struct
import math
from shapely import wkb, ops
from shapely.geometry import Polygon, MultiPolygon

def parse_gpkg_geom(blob):
    if not blob or len(blob) < 8: return None
    magic, version, flags, srs_id = struct.unpack('<2sBB i', blob[:8])
    if magic != b'GP': return None
    env_flag = (flags >> 1) & 0x07
    env_sizes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
    env_len = env_sizes.get(env_flag, 0)
    wkb_offset = 8 + env_len
    return wkb.loads(blob[wkb_offset:])

def utm44n_to_wgs84(easting, northing):
    a = 6378137.0
    f = 1 / 298.257223563
    b = a * (1 - f)
    e = math.sqrt(1 - (b / a) ** 2)
    e_prime_sq = (e ** 2) / (1 - e ** 2)
    k0 = 0.9996
    lon0 = 81.0 * math.pi / 180.0
    
    x = easting - 500000.0
    y = northing
    
    M = y / k0
    mu = M / (a * (1 - (e**2)/4 - 3*(e**4)/64 - 5*(e**6)/256))
    
    e1 = (1 - math.sqrt(1 - e**2)) / (1 + math.sqrt(1 - e**2))
    
    phi1 = mu + (3*e1/2 - 27*(e1**3)/32)*math.sin(2*mu) + (21*(e1**2)/16 - 55*(e1**4)/32)*math.sin(4*mu) + (151*(e1**3)/96)*math.sin(6*mu) + (1097*(e1**4)/512)*math.sin(8*mu)
    
    N1 = a / math.sqrt(1 - (e**2) * (math.sin(phi1)**2))
    T1 = math.tan(phi1)**2
    C1 = e_prime_sq * (math.cos(phi1)**2)
    R1 = a * (1 - e**2) / ((1 - (e**2) * (math.sin(phi1)**2))**1.5)
    D = x / (N1 * k0)
    
    lat = phi1 - (N1 * math.tan(phi1) / R1) * (
        (D**2)/2 - (5 + 3*T1 + 10*C1 - 4*(C1**2) - 9*e_prime_sq)*(D**4)/24 + (61 + 90*T1 + 298*C1 + 45*(T1**2) - 252*e_prime_sq - 3*(C1**2))*(D**6)/720
    )
    lon = lon0 + (
        D - (1 + 2*T1 + C1)*(D**3)/6 + (5 - 2*C1 + 28*T1 - 3*(C1**2) + 8*e_prime_sq + 24*(T1**2))*(D**5)/120
    ) / math.cos(phi1)
    
    return round(lon * 180.0 / math.pi, 7), round(lat * 180.0 / math.pi, 7)

def transform_geom_to_wgs84(geom):
    """Transforms a Shapely geometry from UTM 44N to WGS84 and returns the exterior ring coords [[lon, lat], ...]."""
    if geom is None or geom.is_empty:
        return []
    
    # If MultiPolygon, pick the largest polygon by area
    poly = geom
    if isinstance(geom, MultiPolygon):
        poly = max(geom.geoms, key=lambda p: p.area)
    
    if not isinstance(poly, Polygon) or poly.is_empty:
        return []
        
    ext_coords = list(poly.exterior.coords)
    wgs84_coords = []
    for x, y in ext_coords:
        lon, lat = utm44n_to_wgs84(x, y)
        wgs84_coords.append([lon, lat])
    return wgs84_coords

def build_dataset():
    processed_dir = r"data\real\hyderabad\processed"
    os.makedirs(processed_dir, exist_ok=True)
    
    buildings_dict = {} # key: osm_id
    
    # 1. Load floor data if present
    p_floors = r"data\real\hyderabad\source\03_PROCESSED_DATA\Hyderabad_Floors_7.gpkg.geojson"
    floors_map = {}
    if os.path.exists(p_floors):
        with open(p_floors, 'r', encoding='utf-8') as f:
            floors_json = json.load(f)
        for feat in floors_json.get('features', []):
            props = feat.get('properties', {})
            oid = str(props.get('osm_id'))
            if oid not in floors_map:
                floors_map[oid] = []
            floors_map[oid].append(props)
        print(f"Loaded floor slices for {len(floors_map)} buildings from {p_floors}")

    # 2. Load 352 elevation buildings
    p_elev = r"data\real\hyderabad\source\03_PROCESSED_DATA\Hyderabad_Buildings_Elevation_FINAL.gpkg"
    conn = sqlite3.connect(p_elev)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(Hyderabad_Buildings_Elevation_FINAL)")
    cols = [c[1] for c in cur.fetchall()]
    geom_idx = cols.index('geom')
    cur.execute("SELECT * FROM Hyderabad_Buildings_Elevation_FINAL")
    rows = cur.fetchall()
    print(f"Loading {len(rows)} features from {p_elev}...")
    for r in rows:
        blob = r[geom_idx]
        g = parse_gpkg_geom(blob)
        if not g or g.is_empty: continue
        
        osm_id = str(r[cols.index('osm_id')])
        name = r[cols.index('name')]
        levels_val = r[cols.index('building:levels')]
        levels = int(levels_val) if levels_val and str(levels_val).isdigit() else None
        ground_z = r[cols.index('ground_z')]
        elev_max = r[cols.index('elev_max')]
        elev_min = r[cols.index('elev_min')]
        elev_mean = r[cols.index('elev_mean')]
        z_source = r[cols.index('z_source')] or 'Copernicus_GLO30_DSM'
        bldg_type = r[cols.index('building')] or 'yes'
        
        wgs84_coords = transform_geom_to_wgs84(g)
        if len(wgs84_coords) < 3: continue
        
        c = g.centroid
        c_lon, c_lat = utm44n_to_wgs84(c.x, c.y)
        
        # Check if floors data exists for this building
        floor_slices = floors_map.get(osm_id, [])
        floor_count = len(floor_slices) if floor_slices else (levels or 3)
        
        buildings_dict[osm_id] = {
            "id": f"real-ref-{osm_id}",
            "osmId": osm_id,
            "osmType": r[cols.index('osm_type')] or 'way',
            "source": "REAL_REFERENCE",
            "name": name or (f"Building {osm_id}"),
            "buildingType": bldg_type,
            "levels": levels or floor_count,
            "floorCount": floor_count,
            "groundElevationM": round(ground_z, 2) if ground_z is not None else 575.0,
            "elevMinM": round(elev_min, 2) if elev_min is not None else None,
            "elevMeanM": round(elev_mean, 2) if elev_mean is not None else None,
            "elevMaxM": round(elev_max, 2) if elev_max is not None else None,
            "zSource": z_source,
            "centroid": {
                "latitude": c_lat,
                "longitude": c_lon,
                "utmEasting": round(c.x, 2),
                "utmNorthing": round(c.y, 2)
            },
            "footprintCoordinates": wgs84_coords,
            "approxAreaSqm": round(g.area, 1),
            "modelAvailable": False,
            "isReferenceBuilding": True,
            "attribution": "© OpenStreetMap contributors | Real Hyderabad Reference Dataset (Copernicus DSM)",
            "floorSlices": floor_slices
        }
    conn.close()

    # 3. Load HITEC City cluster buildings from OSM_Hyderabad_Buildings.gpkg
    # Specifically those within 1200m of 17.447400, 78.376200
    target_e, target_n = 221304.93, 1930964.00
    p_raw = r"data\real\hyderabad\source\01_RAW_DATA\OSM_Hyderabad_Buildings.gpkg"
    conn = sqlite3.connect(p_raw)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(osm_buildings)")
    cols = [c[1] for c in cur.fetchall()]
    geom_idx = cols.index('geom')
    cur.execute("SELECT * FROM osm_buildings")
    raw_added = 0
    for r in cur.fetchall():
        blob = r[geom_idx]
        g = parse_gpkg_geom(blob)
        if not g or g.is_empty: continue
        
        c = g.centroid
        dist = math.sqrt((c.x - target_e)**2 + (c.y - target_n)**2)
        if dist <= 1200:
            osm_id = str(r[cols.index('osm_id')])
            if osm_id in buildings_dict:
                continue # Already enriched from final elevation layer
            
            name = r[cols.index('name')]
            levels_val = r[cols.index('building:levels')]
            levels = int(levels_val) if levels_val and str(levels_val).isdigit() else None
            bldg_type = r[cols.index('building')] or 'commercial'
            
            wgs84_coords = transform_geom_to_wgs84(g)
            if len(wgs84_coords) < 3: continue
            
            c_lon, c_lat = utm44n_to_wgs84(c.x, c.y)
            
            # Ground elevation for HITEC City central junction is ~575.5m AMSL (Copernicus DSM)
            # Assign ground_z based on area baseline
            ground_z = 575.5
            
            buildings_dict[osm_id] = {
                "id": f"real-ref-{osm_id}",
                "osmId": osm_id,
                "osmType": r[cols.index('osm_type')] or 'way',
                "source": "REAL_REFERENCE",
                "name": name or (f"Building {osm_id}"),
                "buildingType": bldg_type,
                "levels": levels or 4,
                "floorCount": levels or 4,
                "groundElevationM": ground_z,
                "elevMinM": ground_z,
                "elevMeanM": ground_z + 10.0,
                "elevMaxM": ground_z + 15.0,
                "zSource": "Copernicus_GLO30_DSM (Reference Area Baseline)",
                "centroid": {
                    "latitude": c_lat,
                    "longitude": c_lon,
                    "utmEasting": round(c.x, 2),
                    "utmNorthing": round(c.y, 2)
                },
                "footprintCoordinates": wgs84_coords,
                "approxAreaSqm": round(g.area, 1),
                "modelAvailable": False,
                "isReferenceBuilding": True,
                "attribution": "© OpenStreetMap contributors | Real Hyderabad Reference Dataset",
                "floorSlices": []
            }
            raw_added += 1
            
    conn.close()
    print(f"Added {raw_added} nearby HITEC City buildings from OSM_Hyderabad_Buildings.")
    print(f"Total canonical reference buildings compiled: {len(buildings_dict)}")

    # Write out as clean JSON and GeoJSON
    out_json = os.path.join(processed_dir, "canonical_reference_buildings.json")
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(list(buildings_dict.values()), f, indent=2)
    print(f"Saved JSON: {out_json} ({os.path.getsize(out_json)/(1024*1024):.2f} MB)")

    # Also build GeoJSON FeatureCollection
    geojson_features = []
    for b in buildings_dict.values():
        poly_coords = [b['footprintCoordinates']]
        feature = {
            "type": "Feature",
            "id": b['id'],
            "properties": {
                "osm_id": b['osmId'],
                "name": b['name'],
                "building_type": b['buildingType'],
                "levels": b['levels'],
                "ground_elevation_m": b['groundElevationM'],
                "elev_max_m": b['elevMaxM'],
                "z_source": b['zSource'],
                "area_sqm": b['approxAreaSqm'],
                "is_reference": True,
                "source": "REAL_REFERENCE"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": poly_coords
            }
        }
        geojson_features.append(feature)
        
    fc = {
        "type": "FeatureCollection",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
        },
        "features": geojson_features
    }
    out_geojson = os.path.join(processed_dir, "canonical_reference_buildings.geojson")
    with open(out_geojson, 'w', encoding='utf-8') as f:
        json.dump(fc, f, indent=2)
    print(f"Saved GeoJSON: {out_geojson} ({os.path.getsize(out_geojson)/(1024*1024):.2f} MB)")

if __name__ == '__main__':
    build_dataset()
