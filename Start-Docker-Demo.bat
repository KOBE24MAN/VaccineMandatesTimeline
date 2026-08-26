@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "DOCKER_COMMAND=docker"
where docker >nul 2>&1
if errorlevel 1 set "DOCKER_COMMAND=%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe"

if not exist "%DOCKER_COMMAND%" (
    where "%DOCKER_COMMAND%" >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Docker was not found.
        pause
        exit /b 1
    )
)

"%DOCKER_COMMAND%" info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop is not running or is not ready.
    echo [INFO] Use Start-Local-Demo.bat for the non-Docker demo.
    pause
    exit /b 1
)

echo [INFO] Building and starting the Docker demo.
"%DOCKER_COMMAND%" compose -f docker-compose.demo.yml up --build -d
if errorlevel 1 (
    echo [ERROR] The demo container could not be started.
    pause
    exit /b 1
)

echo [INFO] Waiting for the readiness check.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$deadline=(Get-Date).AddMinutes(3); do { try { $response=Invoke-RestMethod -Uri 'http://localhost:8000/health/ready' -TimeoutSec 3; if ($response.status -eq 'ok') { exit 0 } } catch {}; Start-Sleep -Seconds 2 } while ((Get-Date) -lt $deadline); exit 1"
if errorlevel 1 (
    echo [ERROR] The demo did not become ready within three minutes.
    "%DOCKER_COMMAND%" compose -f docker-compose.demo.yml logs --tail 80 demo
    pause
    exit /b 1
)

echo [OK] The demo is ready at http://localhost:8000/
start "" "http://localhost:8000/"
exit /b 0
