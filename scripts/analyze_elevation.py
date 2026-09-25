import sqlite3
import math

conn = sqlite3.connect(r"data\real\hyderabad\source\03_PROCESSED_DATA\Hyderabad_Buildings_Elevation_FINAL.gpkg")
cur = conn.cursor()
cur.execute("PRAGMA table_info(Hyderabad_Buildings_Elevation_FINAL)")
cols = [c[1] for c in cur.fetchall()]

cur.execute("SELECT name, `building:levels`, ground_z, elev_mean, elev_max, z_source, count(*) FROM Hyderabad_Buildings_Elevation_FINAL GROUP BY (name IS NOT NULL)")
print("Building name summary:", cur.fetchall())

cur.execute("SELECT min(ground_z), avg(ground_z), max(ground_z), min(elev_max), avg(elev_max), max(elev_max) FROM Hyderabad_Buildings_Elevation_FINAL WHERE ground_z IS NOT NULL")
print("Elevation stats (m):", cur.fetchone())

cur.execute("SELECT name, `building:levels`, ground_z, elev_max, osm_id FROM Hyderabad_Buildings_Elevation_FINAL WHERE name IS NOT NULL")
named = cur.fetchall()
print(f"\nNamed buildings ({len(named)}):")
for n in named:
    gz = f"{n[2]:.2f}m" if n[2] is not None else "None"
    emax = f"{n[3]:.2f}m" if n[3] is not None else "None"
    print(f"  Name: '{n[0]}' | Levels: {n[1]} | Ground_Z: {gz} | Elev_Max: {emax} | OSM: {n[4]}")

conn.close()
