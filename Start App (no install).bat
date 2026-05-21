@echo off
cd /d "%~dp0"
echo ============================================================
echo  Vaccine Mandates Timeline - Startup
echo ============================================================
echo.

:: ── Kill stale processes ──────────────────────────────────────
echo Clearing stale processes on ports 8000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 "') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 "') do taskkill /F /PID %%a 2>nul

:: ── Backend setup ─────────────────────────────────────────────
if not exist ".venv\Scripts\uvicorn.exe" (
  echo Setting up Python virtual environment...
  python -m venv .venv
  .venv\Scripts\pip install -q -r requirements.txt
  echo Backend dependencies installed.
)

echo Starting backend...
start "Backend" .venv\Scripts\uvicorn main:app --reload --port 8000

:: ── Frontend setup ────────────────────────────────────────────
if not exist "frontend_client\node_modules" (
  echo Installing frontend dependencies...
  cd frontend_client
  npm install --silent
  cd ..
  echo Frontend dependencies installed.
)

echo Starting frontend...
start "Frontend" cmd /c "cd frontend_client && npm run dev"

:: ── Open app ──────────────────────────────────────────────────
echo Opening prototype...
start HomePage2.4_client.html

echo.
echo   Prototype: HomePage2.4_client.html (opened in browser)
echo   Backend:   http://localhost:8000
echo   Frontend:  http://localhost:5173
echo.
echo Close this window to stop the servers.
pause
taskkill /FI "WINDOWTITLE eq Backend*" /F 2>nul
taskkill /FI "WINDOWTITLE eq Frontend*" /F 2>nul
