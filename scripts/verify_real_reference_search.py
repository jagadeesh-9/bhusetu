import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models.entities import Parcel, Building, VerticalUnit

client = TestClient(app)

print("=== 1. TEST CASE 1: 36116079893D2B (Nexiilabs) ===")
res1 = client.get("/api/parcels/by-ulpin/36116079893D2B")
print("Status:", res1.status_code)
d1 = res1.json()
print("Parcel:", d1["ulpin_2d"], "Survey:", d1["survey_number"], "Bldgs:", d1["building_count"], "Units:", d1["vertical_unit_count"])
assert res1.status_code == 200
assert d1["ulpin_2d"] == "36116079893D2B"

bldgs1 = client.get(f"/api/parcels/{d1['id']}/buildings").json()
print("Building Name:", bldgs1[0]["building_name"], "Code:", bldgs1[0]["building_code"])
units1 = client.get(f"/api/parcels/{d1['id']}/vertical-units").json()
print("Unit count:", len(units1), "Ground Z (F00):", next((u["z_min"] for u in units1 if u["floor_code"] == "F00"), None))

print("\n=== 2. TEST CASE 2: 3689918045B388 (Deloitte) ===")
res2 = client.get("/api/parcels/by-ulpin/3689918045B388")
print("Status:", res2.status_code)
d2 = res2.json()
print("Parcel:", d2["ulpin_2d"], "Survey:", d2["survey_number"], "Bldgs:", d2["building_count"], "Units:", d2["vertical_unit_count"])
assert res2.status_code == 200
assert d2["ulpin_2d"] == "3689918045B388"

bldgs2 = client.get(f"/api/parcels/{d2['id']}/buildings").json()
print("Building Name:", bldgs2[0]["building_name"], "Code:", bldgs2[0]["building_code"])
units2 = client.get(f"/api/parcels/{d2['id']}/vertical-units").json()
print("Unit count:", len(units2), "Ground Z (F00):", next((u["z_min"] for u in units2 if u["floor_code"] == "F00"), None))

print("\n=== 3. TEST CASE 3: 36A1B2C3D4E5F9 (Surya Heights) ===")
res3 = client.get("/api/parcels/by-ulpin/36A1B2C3D4E5F9")
print("Status:", res3.status_code)
d3 = res3.json()
print("Parcel:", d3["ulpin_2d"], "Survey:", d3["survey_number"], "Bldgs:", d3["building_count"], "Units:", d3["vertical_unit_count"])
assert res3.status_code == 200
assert d3["ulpin_2d"] == "36A1B2C3D4E5F9"

print("\n=== 4. TEST CASE 4: 99ZZ99ZZ99ZZ99 (Unknown ULPIN) ===")
res4 = client.get("/api/parcels/by-ulpin/99ZZ99ZZ99ZZ99")
print("Status:", res4.status_code, "Detail:", res4.json())
assert res4.status_code == 404
assert "not found in the reference registry" in res4.json()["detail"].lower()

print("\n=== 5. TEST CASE 5: 123 (Invalid Format) ===")
res5 = client.get("/api/parcels/by-ulpin/123")
print("Status:", res5.status_code, "Detail:", res5.json())
assert res5.status_code == 422

print("\n=== 6. DUPLICATE PREVENTION: Repeated search for 36116079893D2B ===")
db = SessionLocal()
bldg_count_before = db.query(Building).filter(Building.building_code == "BLDG-OSM-116079893").count()
parcel_count_before = db.query(Parcel).filter(Parcel.ulpin_2d == "36116079893D2B").count()
unit_count_before = db.query(VerticalUnit).filter(VerticalUnit.prototype_ulpin_3d.like("36116079893D2B%")).count()

res_repeat = client.get("/api/parcels/by-ulpin/36116079893D2B")
assert res_repeat.status_code == 200
assert res_repeat.json()["id"] == d1["id"]

bldg_count_after = db.query(Building).filter(Building.building_code == "BLDG-OSM-116079893").count()
parcel_count_after = db.query(Parcel).filter(Parcel.ulpin_2d == "36116079893D2B").count()
unit_count_after = db.query(VerticalUnit).filter(VerticalUnit.prototype_ulpin_3d.like("36116079893D2B%")).count()
db.close()

print(f"Parcels before/after: {parcel_count_before} / {parcel_count_after}")
print(f"Buildings before/after: {bldg_count_after} / {bldg_count_after}")
print(f"Units before/after: {unit_count_before} / {unit_count_after}")
assert parcel_count_before == parcel_count_after == 1
assert bldg_count_before == bldg_count_after == 1
assert unit_count_before == unit_count_after

print("\nALL VERIFICATION CHECKS PASSED PERFECTLY!")
