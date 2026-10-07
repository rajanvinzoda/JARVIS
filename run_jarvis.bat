@echo off
title J.A.R.V.I.S. OS - Local Neural Kernel
color 0b
cls
echo ========================================================
echo       J.A.R.V.I.S. OS - Local Windows AI Assistant
echo ========================================================
echo.
echo [1/3] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

echo [2/3] Checking dependencies...
if not exist venv (
    echo Creating virtual environment (venv)...
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt --quiet

echo [3/3] Launching J.A.R.V.I.S. Kernel on http://127.0.0.1:5000...
echo.
python backend/server.py
pause
