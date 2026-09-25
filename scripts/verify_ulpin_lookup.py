import urllib.request
import urllib.error
import json

def check(ulpin):
    url = f"http://127.0.0.1:8000/api/parcels/by-ulpin/{ulpin}"
    try:
        res = urllib.request.urlopen(url)
        data = json.loads(res.read().decode())
        print(f"SUCCESS {ulpin} -> HTTP {res.status} | ULPIN: {data.get('ulpin_2d')} | Buildings: {data.get('building_count')} | Units: {data.get('vertical_unit_count')}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:100]
        print(f"EXPECTED ERROR {ulpin} -> HTTP {e.code} | {body}")

if __name__ == "__main__":
    res = urllib.request.urlopen("http://127.0.0.1:8000/api/parcels")
    parcels = json.loads(res.read().decode())
    print("Existing Parcels in Database:")
    for p in parcels:
        print(f" - ULPIN: {p.get('ulpin_2d')} (ID: {p.get('id')})")

    print("\nRunning ULPIN lookups:")
    check("36A1B2C3D4E5F9")
    check("36A1B2C3D4E5F8")
    check("99ZZ99ZZ99ZZ99")
    check("123")
