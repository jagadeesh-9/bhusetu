@echo off
title 3D-ULPIN - Server Launcher
cls

echo ===============================================================================
echo   3D-ULPIN: Geospatial Intelligence ^& Vertical Cadastral Mapping
echo   Automated Server Launcher (Backend + Frontend)
echo ===============================================================================
echo.

set "PROJECT_ROOT=%~dp0"
if "%PROJECT_ROOT:~-1%"=="\" set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

cd /d "%PROJECT_ROOT%"

:: 1. Verify Python Virtual Environment
if not exist "%PROJECT_ROOT%\.venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment not found in .venv\
    echo Please set up your Python environment first:
    echo   py -3.11 -m venv .venv
    echo   .venv\Scripts\pip install -r requirements.txt
    echo.
    pause
    exit /b 1
)

:: 2. Verify Frontend Dependencies
if not exist "%PROJECT_ROOT%\frontend\node_modules" (
    echo [WARNING] Frontend node_modules not found. Installing dependencies...
    cd /d "%PROJECT_ROOT%\frontend"
    call npm install
    cd /d "%PROJECT_ROOT%"
)

:: 3. Launch Backend Server in a new window
echo [1/2] Launching FastAPI Backend on http://127.0.0.1:8000 ...
start "3D-ULPIN Backend (FastAPI)" /d "%PROJECT_ROOT%" cmd /k ".venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

:: 4. Launch Frontend Dev Server in a new window
echo [2/2] Launching React/Vite Frontend on http://localhost:5173 ...
start "3D-ULPIN Frontend (Vite)" /d "%PROJECT_ROOT%\frontend" cmd /k "npm run dev"

echo.
echo ===============================================================================
echo   SERVERS LAUNCHED SUCCESSFULLY!
echo ===============================================================================
echo   Frontend UI:     http://localhost:5173
echo   Backend API:     http://127.0.0.1:8000
echo   API Swagger:     http://127.0.0.1:8000/docs
echo ===============================================================================
echo.
echo Opening browser in 3 seconds...
timeout /t 3 /nobreak >nul 2>&1
start http://localhost:5173

echo.
echo Both servers are running in their own terminal windows.
echo To stop them, simply close those two command windows or press Ctrl+C inside them.
echo.
pause
