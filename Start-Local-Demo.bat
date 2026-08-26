@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo [INFO] Starting the local demo without Docker.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start_local_demo.ps1"
if errorlevel 1 (
    echo [ERROR] The local demo could not be started.
    pause
    exit /b 1
)
exit /b 0
