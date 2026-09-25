import os
import struct
import numpy as np

def inspect_tiff(path):
    print(f"\n--- Checking TIFF: {os.path.basename(path)} ---")
    size = os.path.getsize(path)
    print(f"File size: {size / 1024:.1f} KB")
    if size < 100:
        print("File is empty or nearly empty.")
        return
    with open(path, 'rb') as f:
        header = f.read(16)
        print("Header bytes:", header[:8])

for f in os.listdir(r"data\real\hyderabad\source\04_ELEVATION"):
    if f.endswith('.tif'):
        inspect_tiff(os.path.join(r"data\real\hyderabad\source\04_ELEVATION", f))
