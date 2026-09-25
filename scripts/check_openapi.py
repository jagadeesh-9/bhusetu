import urllib.request
import json

with urllib.request.urlopen("http://127.0.0.1:8000/openapi.json") as response:
    spec = json.loads(response.read().decode('utf-8'))

bldg_paths = [p for p in spec.get("paths", {}).keys() if "building" in p]
print("Building routes in running uvicorn:")
for p in bldg_paths:
    print(" ", p)
