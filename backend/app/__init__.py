"""
SIH26011: 3D ULPIN Generation & Vertical Property Mapping System
Backend Application Package
"""
__version__ = "0.1.0"

import os
import sys

# On Windows, ensure PostgreSQL bin directory is discovered for libpq ctypes fallback
if sys.platform == "win32":
    for ver in ("16", "17", "15", "14"):
        pg_bin = rf"C:\Program Files\PostgreSQL\{ver}\bin"
        if os.path.isdir(pg_bin):
            if pg_bin not in os.environ.get("PATH", ""):
                os.environ["PATH"] = pg_bin + os.pathsep + os.environ.get("PATH", "")
            try:
                os.add_dll_directory(pg_bin)
            except (AttributeError, OSError):
                pass
            break
    if "PSYCOPG_IMPL" not in os.environ:
        os.environ["PSYCOPG_IMPL"] = "python"
