import urllib.request
import json

def verify():
    # 1. Generate building for Moosapet
    footprint = [
        [78.4321, 17.4682],
        [78.4323, 17.4682],
        [78.4323, 17.4684],
        [78.4321, 17.4684],
        [78.4321, 17.4682]
    ]

    payload = {
        "candidate_osm_id": "way/88776655",
        "footprint_wgs84": footprint,
        "building_name": "Moosapet Live Verification Building",
        "total_floors_above": 3,
        "total_floors_below": 1,
        "ground_elevation_m": 540.0,
        "floor_height_m": 3.0,
        "include_rooftop": True,
        "subdivide_residential_floors": True,
        "is_synthetic_prototype": True
    }

    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/buildings/generate-3d-prototype",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )

    res = urllib.request.urlopen(req)
    data = json.loads(res.read().decode("utf-8"))
    print("Generation Status Code:", res.status)
    print("Generated Building Code:", data.get("building_code"))
    print("Dedicated Parcel ID:", data.get("parcel_id"))
    print("Dedicated Parcel ULPIN:", data.get("parcel_ulpin_2d"))
    print("Total units generated:", data.get("total_units_generated"))

    parcel_id = data.get("parcel_id")
    units_req = urllib.request.urlopen(f"http://127.0.0.1:8000/api/parcels/{parcel_id}/vertical-units")
    units = json.loads(units_req.read().decode("utf-8"))
    print(f"Verified {len(units)} vertical storeys under dedicated parcel {parcel_id}")

    # Check canonical Surya Heights
    parcels_req = urllib.request.urlopen("http://127.0.0.1:8000/api/parcels")
    all_parcels = json.loads(parcels_req.read().decode("utf-8"))
    surya_p = [p for p in all_parcels if p["ulpin_2d"] == "36A1B2C3D4E5F9"][0]
    
    surya_req = urllib.request.urlopen(f"http://127.0.0.1:8000/api/parcels/{surya_p['id']}/vertical-units")
    surya_units = json.loads(surya_req.read().decode("utf-8"))
    print(f"Verified canonical Surya Heights remains intact with {len(surya_units)} storeys")

    f01 = [u for u in surya_units if u["floor_code"] == "F01"][0]
    f01_id = f01["id"]
    sub_req = urllib.request.urlopen(f"http://127.0.0.1:8000/api/vertical-units/{f01_id}/sub-units")
    f01_subunits = json.loads(sub_req.read().decode("utf-8"))
    print(f"Verified F01 sub-units ({len(f01_subunits)} flats/core):")
    for s in f01_subunits:
        print("  -", s["prototype_ulpin_3d"], s["unit_label"])

if __name__ == "__main__":
    verify()
