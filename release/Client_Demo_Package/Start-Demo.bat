@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if not exist "demo-url.txt" (
    echo [ERROR] demo-url.txt is missing from this package.
    pause
    exit /b 1
)

set /p "DEMO_URL=" < "demo-url.txt"
if not defined DEMO_URL (
    echo [ERROR] demo-url.txt is empty.
    pause
    exit /b 1
)

echo "%DEMO_URL%" | findstr /C:"REPLACE-WITH-AZURE-URL" >nul
if not errorlevel 1 (
    echo [ERROR] The Azure demo URL has not been configured yet.
    pause
    exit /b 1
)

echo [INFO] Checking the remote demo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$base='%DEMO_URL%'.TrimEnd('/'); try { $response=Invoke-RestMethod -Uri ($base + '/health/ready') -TimeoutSec 15; if ($response.status -eq 'ok') { exit 0 } } catch {}; exit 1"
if errorlevel 1 (
    echo [ERROR] The demo is unavailable. Check your internet connection or contact the project team.
    pause
    exit /b 1
)

echo [OK] The demo is available. Opening the browser.
start "" "%DEMO_URL%"
exit /b 0
