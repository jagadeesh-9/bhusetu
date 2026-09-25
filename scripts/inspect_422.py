import urllib.request
import json

url = "http://127.0.0.1:8000/api/buildings/reference-candidates?latitude=17.447400&longitude=78.376200&radius_m=500"
try:
    with urllib.request.urlopen(url) as response:
        print("Success:", response.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Body:", e.read().decode('utf-8'))
