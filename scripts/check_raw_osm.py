import sqlite3
import math
import struct
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

# Target
target_e = 221304.93
target_n = 1930964.00

# Search OSM_Hyderabad_Buildings.gpkg
p_raw = r"data\real\hyderabad\source\01_RAW_DATA\OSM_Hyderabad_Buildings.gpkg"
conn = sqlite3.connect(p_raw)
cur = conn.cursor()

# Get column info
cur.execute("PRAGMA table_info(osm_buildings)")
cols = [c[1] for c in cur.fetchall()]
geom_idx = cols.index('geom')

print("Searching OSM_Hyderabad_Buildings.gpkg (19066 buildings) for closest to target...")
cur.execute("SELECT * FROM osm_buildings")

closest = []
for r in cur.fetchall():
    blob = r[geom_idx]
    g = parse_gpkg_geom(blob)
    if g:
        c = g.centroid
        dist = math.sqrt((c.x - target_e)**2 + (c.y - target_n)**2)
        if dist < 1000: # within 1km
            closest.append((dist, r[cols.index('osm_id')], r[cols.index('name')], c.x, c.y, g.geom_type))

closest.sort(key=lambda x: x[0])
print(f"Found {len(closest)} buildings within 1km in OSM_Hyderabad_Buildings.gpkg!")
for d, osm_id, name, cx, cy, gtype in closest[:10]:
    print(f"  Dist: {d:.1f}m | OSM: {osm_id} | Name: {name} | Geom: {gtype} | UTM: ({cx:.1f}, {cy:.1f})")

conn.close()
