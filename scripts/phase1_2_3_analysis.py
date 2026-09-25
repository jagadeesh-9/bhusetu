import os
import sys
import sqlite3
import json
import struct
import math
from shapely import wkb, ops
import shapely.geometry as sgeom

# Check PostGIS
postgis_available = False
try:
    import psycopg
    # Check connection string from backend settings or default
    db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5432/sih26011_dev")
    conn = psycopg.connect(db_url)
    cur = conn.cursor()
    cur.execute("SELECT PostGIS_Version()")
    v = cur.fetchone()[0]
    print(f"[PostGIS] Available! Version: {v}")
    postgis_available = True
    conn.close()
except Exception as e:
    print(f"[PostGIS] Not connected: {e}")

# If we don't have pyproj installed, we can do UTM 44N <-> WGS84 either via PostGIS or standard formula
# WGS84 parameters:
# a = 6378137.0, f = 1/298.257223563
# UTM Zone 44N: central meridian = 81.0, scale factor k0 = 0.9996, false easting = 500000, false northing = 0
def utm44n_to_wgs84(easting, northing):
    """Accurate conversion from UTM Zone 44N (EPSG:32644) to WGS84 (lon, lat) (EPSG:4326)"""
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
    
    return lon * 180.0 / math.pi, lat * 180.0 / math.pi

def wgs84_to_utm44n(lon_deg, lat_deg):
    """Accurate conversion from WGS84 (lon, lat) to UTM Zone 44N (easting, northing)"""
    a = 6378137.0
    f = 1 / 298.257223563
    b = a * (1 - f)
    e = math.sqrt(1 - (b / a) ** 2)
    e_prime_sq = (e ** 2) / (1 - e ** 2)
    k0 = 0.9996
    lon0 = 81.0 * math.pi / 180.0
    
    phi = lat_deg * math.pi / 180.0
    lam = lon_deg * math.pi / 180.0
    
    N = a / math.sqrt(1 - (e**2) * (math.sin(phi)**2))
    T = math.tan(phi)**2
    C = e_prime_sq * (math.cos(phi)**2)
    A = (lam - lon0) * math.cos(phi)
    
    M = a * (
        (1 - (e**2)/4 - 3*(e**4)/64 - 5*(e**6)/256)*phi
        - (3*(e**2)/8 + 3*(e**4)/32 + 45*(e**6)/1024)*math.sin(2*phi)
        + (15*(e**4)/256 + 45*(e**6)/1024)*math.sin(4*phi)
        - (35*(e**6)/3072)*math.sin(6*phi)
    )
    
    easting = k0 * N * (
        A + (1 - T + C)*(A**3)/6 + (5 - 18*T + T**2 + 72*C - 58*e_prime_sq)*(A**5)/120
    ) + 500000.0
    
    northing = k0 * (
        M + N * math.tan(phi) * (
            (A**2)/2 + (5 - T + 9*C + 4*(C**2))*(A**4)/24 + (61 - 58*T + T**2 + 600*C - 330*e_prime_sq)*(A**6)/720
        )
    )
    return easting, northing

# Test conversion accuracy with PostGIS if available
if postgis_available:
    conn = psycopg.connect("postgresql://postgres:postgres@127.0.0.1:5432/sih26011_dev")
    cur = conn.cursor()
    cur.execute("SELECT ST_X(p), ST_Y(p) FROM (SELECT ST_Transform(ST_SetSRID(ST_MakePoint(78.376200, 17.447400), 4326), 32644) as p) sub")
    pg_utm = cur.fetchone()
    my_utm = wgs84_to_utm44n(78.376200, 17.447400)
    print(f"Target coords (78.376200, 17.447400):")
    print(f"  PostGIS UTM44N: Easting={pg_utm[0]:.3f}, Northing={pg_utm[1]:.3f}")
    print(f"  Python  UTM44N: Easting={my_utm[0]:.3f}, Northing={my_utm[1]:.3f}")
    print(f"  Difference: dE={abs(pg_utm[0]-my_utm[0]):.4f}m, dN={abs(pg_utm[1]-my_utm[1]):.4f}m")
    
    rev_lon, rev_lat = utm44n_to_wgs84(pg_utm[0], pg_utm[1])
    print(f"  Reverse WGS84: Lon={rev_lon:.7f}, Lat={rev_lat:.7f}")
    conn.close()

def parse_gpkg_geom(blob):
    if not blob or len(blob) < 8: return None
    magic, version, flags, srs_id = struct.unpack('<2sBB i', blob[:8])
    if magic != b'GP': return None
    env_flag = (flags >> 1) & 0x07
    env_sizes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
    env_len = env_sizes.get(env_flag, 0)
    wkb_offset = 8 + env_len
    return wkb.loads(blob[wkb_offset:])

# Analyze Hyderabad_Buildings_Elevation_FINAL.gpkg
print("\n" + "="*60)
print("ANALYZING: Hyderabad_Buildings_Elevation_FINAL.gpkg")
p_elev = r"data\real\hyderabad\source\03_PROCESSED_DATA\Hyderabad_Buildings_Elevation_FINAL.gpkg"
conn = sqlite3.connect(p_elev)
cur = conn.cursor()
cur.execute("SELECT count(*) FROM Hyderabad_Buildings_Elevation_FINAL")
count = cur.fetchone()[0]
cur.execute("PRAGMA table_info(Hyderabad_Buildings_Elevation_FINAL)")
cols = [c[1] for c in cur.fetchall()]
print(f"Total features: {count}")
print(f"Columns: {cols}")

# Target coordinates:
target_lon = 78.376200
target_lat = 17.447400
target_e, target_n = wgs84_to_utm44n(target_lon, target_lat)
print(f"\nHITEC City Target: Lon={target_lon}, Lat={target_lat} => UTM44N: E={target_e:.2f}, N={target_n:.2f}")

cur.execute("SELECT * FROM Hyderabad_Buildings_Elevation_FINAL")
rows = cur.fetchall()
geom_idx = cols.index('geom')

buildings = []
for r in rows:
    b_dict = {cols[i]: r[i] for i in range(len(cols))}
    blob = r[geom_idx]
    g = parse_gpkg_geom(blob)
    if g:
        centroid = g.centroid
        dist_utm = math.sqrt((centroid.x - target_e)**2 + (centroid.y - target_n)**2)
        c_lon, c_lat = utm44n_to_wgs84(centroid.x, centroid.y)
        b_dict['dist_to_target_m'] = dist_utm
        b_dict['geom_type'] = g.geom_type
        b_dict['bounds_utm'] = g.bounds
        b_dict['centroid_wgs84'] = (c_lon, c_lat)
        buildings.append((dist_utm, b_dict))

buildings.sort(key=lambda x: x[0])
print(f"\nTop 10 Nearest Buildings to Target ({target_lat}, {target_lon}):")
for d, b in buildings[:10]:
    name = b.get('name') or b.get('addr:housename') or f"Building OSM {b.get('osm_id')}"
    levels = b.get('building:levels')
    gz = b.get('ground_z')
    emax = b.get('elev_max')
    c_lon, c_lat = b['centroid_wgs84']
    print(f"  Dist: {d:.1f}m | Name: '{name}' | OSM: {b.get('osm_id')} | Levels: {levels} | Ground_Z: {gz}m | Elev_Max: {emax}m | WGS84: ({c_lat:.6f}, {c_lon:.6f})")

conn.close()

# Also analyze Hyderabad_Floors_7.gpkg.geojson
print("\n" + "="*60)
print("ANALYZING: Hyderabad_Floors_7.gpkg.geojson")
p_floors = r"data\real\hyderabad\source\03_PROCESSED_DATA\Hyderabad_Floors_7.gpkg.geojson"
with open(p_floors, 'r', encoding='utf-8') as f:
    floors_data = json.load(f)
feats = floors_data.get('features', [])
print(f"Total floor features: {len(feats)}")
bld_osm_ids = set()
for f in feats:
    p = f.get('properties', {})
    bld_osm_ids.add((p.get('osm_id'), p.get('name'), p.get('floor_count'), p.get('ground_z')))
print(f"Distinct buildings with explicit floor geometry ({len(bld_osm_ids)}):")
for b in bld_osm_ids:
    print(f"  OSM ID: {b[0]} | Name: '{b[1]}' | Floors: {b[2]} | Ground_Z: {b[3]}")

# Also analyze OSM_Hyderabad_Buildings.gpkg and Hyderabad_HITEC_City_500m.gpkg
for p in [r"data\real\hyderabad\source\01_RAW_DATA\OSM_Hyderabad_Buildings.gpkg", 
          r"data\real\hyderabad\source\03_PROCESSED_DATA\Hyderabad_HITEC_City_500m.gpkg"]:
    print("\n" + "="*60)
    print(f"ANALYZING: {p}")
    conn = sqlite3.connect(p)
    cur = conn.cursor()
    cur.execute("SELECT table_name, data_type, srs_id FROM gpkg_contents")
    contents = cur.fetchall()
    print("Contents:", contents)
    for tname, dtype, srs_id in contents:
        if dtype == 'features':
            cur.execute(f"SELECT count(*) FROM \"{tname}\"")
            print(f"Table '{tname}' count: {cur.fetchone()[0]}")
            cur.execute(f"SELECT min_x, min_y, max_x, max_y FROM gpkg_contents WHERE table_name='{tname}'")
            bbox = cur.fetchone()
            print(f"BBOX: {bbox}")
            if bbox and bbox[0] is not None:
                min_lon, min_lat = utm44n_to_wgs84(bbox[0], bbox[1])
                max_lon, max_lat = utm44n_to_wgs84(bbox[2], bbox[3])
                print(f"BBOX WGS84: Lon: [{min_lon:.6f}, {max_lon:.6f}], Lat: [{min_lat:.6f}, {max_lat:.6f}]")
    conn.close()

