import json
import math

with open(r"data\real\hyderabad\processed\canonical_reference_buildings.json", "r", encoding="utf-8") as f:
    buildings = json.load(f)

print(f"Total compiled buildings: {len(buildings)}")

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))

target_lat, target_lon = 17.447400, 78.376200

results = []
for b in buildings:
    c = b['centroid']
    dist = haversine(target_lat, target_lon, c['latitude'], c['longitude'])
    if dist <= 500:
        results.append((dist, b))

results.sort(key=lambda x: x[0])
print(f"\nBuildings within 500m of ({target_lat}, {target_lon}): {len(results)}")
for d, b in results[:10]:
    print(f"  Dist: {d:.1f}m | OSM: {b['osmId']} | Name: '{b['name']}' | Levels: {b['levels']} | Ground_Z: {b['groundElevationM']}m | Footprint vertices: {len(b['footprintCoordinates'])}")
