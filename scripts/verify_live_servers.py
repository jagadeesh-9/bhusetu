import urllib.request
import urllib.error
import json

def check_frontend():
    for port in [5173, 5174]:
        try:
            with urllib.request.urlopen(f"http://localhost:{port}") as res:
                if res.status == 200:
                    print(f"Frontend is RUNNING on http://localhost:{port}")
                    return f"http://localhost:{port}"
        except Exception:
            pass
    print("Frontend is NOT responding on 5173 or 5174")
    return None

def check_backend_health():
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/api/health") as res:
            data = json.loads(res.read().decode('utf-8'))
            print("Backend Health:", res.status, data)
            return res.status == 200 and data.get("database_connected") is True
    except Exception as e:
        print("Backend health check failed:", e)
        return False

def check_ulpin(ulpin, expected_status):
    url = f"http://127.0.0.1:8000/api/parcels/by-ulpin/{ulpin}"
    try:
        with urllib.request.urlopen(url) as res:
            data = json.loads(res.read().decode('utf-8'))
            print(f"ULPIN {ulpin}: Status {res.status} -> {data.get('survey_number', 'OK')}")
            return res.status == expected_status
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            err = json.loads(body)
            detail = err.get("detail", body)
        except Exception:
            detail = body
        print(f"ULPIN {ulpin}: Status {e.code} -> {detail}")
        return e.code == expected_status
    except Exception as e:
        print(f"ULPIN {ulpin}: Exception -> {e}")
        return False

print("=== 1. Checking Frontend ===")
fe_url = check_frontend()

print("\n=== 2. Checking Backend & PostGIS Health ===")
be_healthy = check_backend_health()

print("\n=== 3. Running ULPIN Checks ===")
c1 = check_ulpin("36A1B2C3D4E5F9", 200)
c2 = check_ulpin("36116079893D2B", 200)
c3 = check_ulpin("3689918045B388", 200)
c4 = check_ulpin("99ZZ99ZZ99ZZ99", 404)
c5 = check_ulpin("123", 422)

print("\n=== SUMMARY ===")
print("Frontend URL:", fe_url)
print("Backend Healthy:", be_healthy)
print("All 5 ULPIN checks passed:", all([c1, c2, c3, c4, c5]))

