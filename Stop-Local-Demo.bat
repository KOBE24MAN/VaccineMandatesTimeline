@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo [INFO] Stopping the local demo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop_local_demo.ps1"
if errorlevel 1 (
    echo [ERROR] The local demo could not be stopped.
    pause
    exit /b 1
)
exit /b 0
