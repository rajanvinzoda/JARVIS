@echo off
setlocal enabledelayedexpansion
title J.A.R.V.I.S. OS — Local Windows AI Assistant
color 0b
cls

echo ======================================================================
echo             J.A.R.V.I.S. OS — LOCAL WINDOWS AI ASSISTANT
echo                     Master Architectural Launcher
echo ======================================================================
echo.

:: 1 & 2. Check Python and Python version
echo [1/8] Verifying Python runtime...
python --version >nul 2>&1
if errorlevel 1 (
    echo [FATAL ERROR] Python is not installed or not found in system PATH.
    echo Please install Python 3.10 or higher from https://python.org
    echo Be sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo [OK] Python detected: %PY_VER%

:: 3 & 4. Virtual environment creation & activation
echo [2/8] Checking Python virtual environment (venv)...
if not exist "venv\Scripts\activate.bat" (
    echo [*] Creating virtual environment 'venv'...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)
echo [OK] Activating virtual environment...
call venv\Scripts\activate.bat

:: 5. Install dependencies
echo [3/8] Checking dependencies from requirements.txt...
pip install -r requirements.txt --quiet --disable-pip-version-check
if errorlevel 1 (
    echo [WARNING] Some dependencies failed to install cleanly. Continuing...
) else (
    echo [OK] Dependencies verified.
)

:: 6 & 7. Verify .env and API configuration
echo [4/8] Verifying environment configuration (.env)...
if not exist ".env" (
    if exist ".env.example" (
        echo [*] Initializing .env from .env.example...
        copy .env.example .env >nul
    ) else (
        echo BLUESMINDS_API_KEY=> .env
        echo BLUESMINDS_MODEL=meta/llama-3.2-11b-vision-instruct>> .env
        echo JARVIS_HOST=127.0.0.1>> .env
        echo JARVIS_PORT=5000>> .env
    )
    echo [NOTE] Please ensure your BLUESMINDS_API_KEY is configured inside .env.
) else (
    echo [OK] .env configuration present.
)

:: 8. Verify data directories & database
echo [5/8] Verifying storage and SQLite database...
if not exist "data" mkdir data
if not exist "data\sandbox" mkdir data\sandbox
if not exist "data\sandbox\Desktop" mkdir data\sandbox\Desktop
if not exist "data\sandbox\Documents" mkdir data\sandbox\Documents
if not exist "data\sandbox\Downloads" mkdir data\sandbox\Downloads
python -c "from backend.memory import init_db; init_db(); print('[OK] SQLite database verified at data/jarvis.db')" 2>nul

:: 9, 10, 11. Start Flask and launch browser
echo [6/8] Initializing J.A.R.V.I.S. Kernel on http://127.0.0.1:5000...
echo.
echo ======================================================================
echo    J.A.R.V.I.S. is starting. Opening your browser to http://127.0.0.1:5000
echo    Press Ctrl+C in this window to stop the server.
echo ======================================================================
echo.

start "" "http://127.0.0.1:5000"

python backend/server.py

if errorlevel 1 (
    echo.
    echo [ERROR] J.A.R.V.I.S. backend terminated with an error.
    pause
)
