import json

with open(r"data\real\hyderabad\processed\canonical_reference_buildings.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for b in data:
    if b["osmId"] in ["116079893", "89918045", "356020013"]:
        print(f"OSM {b['osmId']} ({b['name']}):")
        print("Centroid:", b["centroid"])
        print("Coords:", json.dumps(b["footprintCoordinates"]))
        print("Levels:", b["levels"], "Ground_Z:", b["groundElevationM"])
