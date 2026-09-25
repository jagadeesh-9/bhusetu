import sqlite3
import math
import struct
import json
from shapely import wkb

def parse_gpkg_geom(blob):
    if not blob or len(blob) < 8: return None
    magic, version, flags, srs_id = struct.unpack('<2sBB i', blob[:8])
    if magic != b'GP': return None
    env_flag = (flags >> 1) & 0x07
    env_sizes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
    env_len = env_sizes.get(env_flag, 0)
    wkb_offset = 8 + env_len
    return wkb.loads(blob[wkb_offset:])

def wgs84_to_utm44n(lon_deg, lat_deg):
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
    
    return lon * 180.0 / math.pi, lat * 180.0 / math.pi

target_lat = 17.447400
target_lon = 78.376200
target_e, target_n = wgs84_to_utm44n(target_lon, target_lat)

print(f"TARGET COORDINATES: Lat={target_lat}, Lon={target_lon} | UTM 44N: E={target_e:.2f}, N={target_n:.2f}")

# 1. Check OSM_Hyderabad_Buildings.gpkg
print("\n--- 1. Nearest in 01_RAW_DATA/OSM_Hyderabad_Buildings.gpkg ---")
conn = sqlite3.connect(r"data\real\hyderabad\source\01_RAW_DATA\OSM_Hyderabad_Buildings.gpkg")
cur = conn.cursor()
cur.execute("PRAGMA table_info(osm_buildings)")
cols = [c[1] for c in cur.fetchall()]
geom_idx = cols.index('geom')
cur.execute("SELECT * FROM osm_buildings")
b_raw = []
for r in cur.fetchall():
    blob = r[geom_idx]
    g = parse_gpkg_geom(blob)
    if g:
        c = g.centroid
        dist = math.sqrt((c.x - target_e)**2 + (c.y - target_n)**2)
        if dist < 500:
            b_raw.append((dist, r[cols.index('osm_id')], r[cols.index('name')], g.geom_type, r[cols.index('building:levels')], c.x, c.y))
b_raw.sort(key=lambda x: x[0])
for b in b_raw[:5]:
    c_lon, c_lat = utm44n_to_wgs84(b[5], b[6])
    print(f"Distance: {b[0]:.2f} m | Name: {b[2]} | OSM ID: {b[1]} | Geom: {b[3]} | Levels: {b[4]} | WGS84: ({c_lat:.6f}, {c_lon:.6f})")
conn.close()

# 2. Check 03_PROCESSED_DATA/Hyderabad_Buildings_Elevation_FINAL.gpkg
print("\n--- 2. Nearest in 03_PROCESSED_DATA/Hyderabad_Buildings_Elevation_FINAL.gpkg ---")
conn = sqlite3.connect(r"data\real\hyderabad\source\03_PROCESSED_DATA\Hyderabad_Buildings_Elevation_FINAL.gpkg")
cur = conn.cursor()
cur.execute("PRAGMA table_info(Hyderabad_Buildings_Elevation_FINAL)")
cols = [c[1] for c in cur.fetchall()]
geom_idx = cols.index('geom')
cur.execute("SELECT * FROM Hyderabad_Buildings_Elevation_FINAL")
b_elev = []
for r in cur.fetchall():
    blob = r[geom_idx]
    g = parse_gpkg_geom(blob)
    if g:
        c = g.centroid
        dist = math.sqrt((c.x - target_e)**2 + (c.y - target_n)**2)
        b_elev.append((
            dist,
            r[cols.index('name')],
            r[cols.index('osm_id')],
            g.geom_type,
            r[cols.index('building:levels')],
            r[cols.index('ground_z')],
            r[cols.index('elev_max')],
            c.x, c.y
        ))
b_elev.sort(key=lambda x: x[0])
for b in b_elev[:5]:
    c_lon, c_lat = utm44n_to_wgs84(b[7], b[8])
    print(f"Distance: {b[0]:.2f} m | Name: {b[1]} | OSM ID: {b[2]} | Geom: {b[3]} | Levels: {b[4]} | Ground_Z: {b[5]} | Elev_Max: {b[6]} | WGS84: ({c_lat:.6f}, {c_lon:.6f})")
conn.close()
