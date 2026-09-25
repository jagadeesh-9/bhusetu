# Check if we can read raster or compute raster bounds
# In Copernicus DSM: N17 E078 means lat 17 to 18, lon 78 to 79.
# 1 degree x 1 degree tile.
# 1 arc-second is 3600 x 3600 pixels.
import os

path = r"data\real\hyderabad\source\04_ELEVATION\Copernicus_DSM_COG_10_N17_00_E078_00_DEM.tif"
size = os.path.getsize(path)
print("File size:", size)
