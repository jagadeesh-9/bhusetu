@echo off
title SIH26011 - 3D ULPIN Demo Launcher
cls
echo ===============================================================================
echo   SIH26011: 3D ULPIN Generation ^& Vertical Property Mapping System
echo   Official Demonstration Launcher
echo ===============================================================================
echo.

set PROJECT_ROOT=%~dp0
cd /d "%PROJECT_ROOT%"

:: Check Python Virtual Environment
if not exist "%PROJECT_ROOT%.venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment not found in .venv\
    echo Please create the virtual environment before launching the demo:
    echo   python -m venv .venv
    echo   .venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

:: Check Frontend Node Modules
if not exist "%PROJECT_ROOT%frontend\node_modules" (
    echo [ERROR] Frontend node_modules not found in frontend\
    echo Please install dependencies before launching:
    echo   cd frontend ^&^& npm install
    pause
    exit /b 1
)

echo [1/3] Checking PostgreSQL service...
echo Note: PostgreSQL must be running with PostGIS enabled on localhost:5432.
echo.

echo [2/3] Launching FastAPI Backend on http://127.0.0.1:8000...
start "SIH26011 - Backend API (127.0.0.1:8000)" cmd /k "cd /d "%PROJECT_ROOT%" && .venv\Scripts\activate.bat && uvicorn backend.app.main:app --host 127.0.0.1 --port 8000"

echo [3/3] Launching React/Vite Frontend...
start "SIH26011 - Frontend UI (Vite)" cmd /k "cd /d "%PROJECT_ROOT%frontend" && npm run dev"

echo.
echo ===============================================================================
echo   SERVICES LAUNCHED SUCCESSFULLY
echo ===============================================================================
echo   Backend API:   http://127.0.0.1:8000/docs
echo   Frontend Web:  http://localhost:5173/ (or active Vite port)
echo.
echo   Demo Dataset:  APARTMENT-SURYA-OSM (Surya Heights, Hyderabad)
echo   Demo Runbook:  See SIH_DEMO_RUN.md for the step-by-step judge script.
echo ===============================================================================
echo.
pause
