import os
import sys
import sqlite3
import json
import struct
import math
from shapely import wkb

def parse_gpkg_geom(blob):
    if not blob or len(blob) < 8:
        return None
    # GPKG geometry binary header:
    # byte 0-1: magic 'GP'
    # byte 2: version
    # byte 3: flags (envelope indicator in bits 1-3)
    # byte 4-7: srs_id
    magic, version, flags, srs_id = struct.unpack('<2sBB i', blob[:8])
    if magic != b'GP':
        return None
    env_flag = (flags >> 1) & 0x07
    env_sizes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
    env_len = env_sizes.get(env_flag, 0)
    wkb_offset = 8 + env_len
    return wkb.loads(blob[wkb_offset:])

def inspect_geojson(path):
    print(f"\n==========================================")
    print(f"FILE: {os.path.basename(path)}")
    print(f"PATH: {path}")
    size_mb = os.path.getsize(path) / (1024*1024)
    print(f"SIZE: {size_mb:.2f} MB")
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    features = data.get('features', [])
    crs = data.get('crs', {})
    print(f"TYPE: GeoJSON")
    print(f"CRS: {crs}")
    print(f"FEATURE COUNT: {len(features)}")
    if features:
        first = features[0]
        geom_type = first.get('geometry', {}).get('type')
        props = first.get('properties', {})
        print(f"GEOMETRY TYPE: {geom_type}")
        print(f"PROPERTIES/FIELDS ({len(props)}): {list(props.keys())}")
        print(f"SAMPLE PROPS: {json.dumps(props, indent=2)}")
        
        # Calculate bbox
        xs, ys = [], []
        for feat in features:
            g = feat.get('geometry')
            if not g: continue
            coords = g.get('coordinates', [])
            def extract_coords(c):
                if isinstance(c, (list, tuple)) and len(c) >= 2 and isinstance(c[0], (int, float)):
                    xs.append(c[0])
                    ys.append(c[1])
                elif isinstance(c, (list, tuple)):
                    for item in c:
                        extract_coords(item)
            extract_coords(coords)
        if xs and ys:
            print(f"BOUNDING BOX: [{min(xs):.6f}, {min(ys):.6f}] to [{max(xs):.6f}, {max(ys):.6f}]")

def inspect_gpkg(path):
    print(f"\n==========================================")
    print(f"FILE: {os.path.basename(path)}")
    print(f"PATH: {path}")
    size_mb = os.path.getsize(path) / (1024*1024)
    print(f"SIZE: {size_mb:.2f} MB")
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    cur.execute("SELECT table_name, data_type, identifier, description, srs_id FROM gpkg_contents")
    contents = cur.fetchall()
    print("GPKG CONTENTS:")
    for c in contents:
        print(f"  Table: {c[0]} | Type: {c[1]} | SRS ID: {c[4]}")
    
    # Get SRS info
    try:
        cur.execute("SELECT srs_name, srs_id, organization, organization_coordsys_id, definition FROM gpkg_spatial_ref_sys")
        srs_rows = cur.fetchall()
        print("SPATIAL REF SYS:")
        for s in srs_rows:
            print(f"  SRS: {s[0]} (ID: {s[1]}, Org: {s[2]}:{s[3]})")
    except Exception as e:
        print(f"  SRS query error: {e}")

    for table_name, data_type, identifier, desc, srs_id in contents:
        if data_type == 'features':
            cur.execute(f"PRAGMA table_info({table_name})")
            cols = cur.fetchall()
            col_names = [c[1] for c in cols]
            cur.execute(f"SELECT count(*) FROM {table_name}")
            cnt = cur.fetchone()[0]
            print(f"\nFEATURE TABLE: {table_name}")
            print(f"FEATURE COUNT: {cnt}")
            print(f"COLUMNS ({len(col_names)}): {col_names}")
            
            # Find geom col
            cur.execute("SELECT column_name, geometry_type_name, srs_id FROM gpkg_geometry_columns WHERE table_name=?", (table_name,))
            geom_info = cur.fetchone()
            geom_col = geom_info[0] if geom_info else 'geom'
            geom_type = geom_info[1] if geom_info else 'UNKNOWN'
            print(f"GEOMETRY COLUMN: {geom_col} (Type: {geom_type}, SRS: {geom_info[2] if geom_info else srs_id})")

            # Sample row
            cur.execute(f"SELECT * FROM {table_name} LIMIT 3")
            rows = cur.fetchall()
            for idx, r in enumerate(rows):
                row_dict = {}
                for i, col in enumerate(col_names):
                    if col == geom_col:
                        blob = r[i]
                        geom = parse_gpkg_geom(blob)
                        row_dict[col] = f"<{geom.geom_type if geom else 'None'} bounds={geom.bounds if geom else 'None'}>"
                    else:
                        row_dict[col] = r[i]
                print(f"SAMPLE ROW {idx+1}: {row_dict}")

            # Bounding box across table
            cur.execute(f"SELECT min_x, min_y, max_x, max_y FROM gpkg_contents WHERE table_name=?", (table_name,))
            bbox = cur.fetchone()
            print(f"GPKG METADATA BBOX: {bbox}")
    conn.close()

if __name__ == '__main__':
    data_dir = r"data\real\hyderabad\source"
    for root, dirs, files in os.walk(data_dir):
        for f in files:
            p = os.path.join(root, f)
            ext = os.path.splitext(f)[1].lower()
            if ext == '.gpkg':
                inspect_gpkg(p)
            elif ext == '.geojson':
                inspect_geojson(p)
            elif ext == '.tif':
                print(f"\n==========================================")
                print(f"RASTER FILE: {f}")
                print(f"PATH: {p}")
                print(f"SIZE: {os.path.getsize(p)/(1024*1024):.2f} MB")
