@echo off
cd /d "%~dp0"
echo ============================================================
echo  Vaccine Mandates Timeline - Startup
echo ============================================================
echo.

:: ── Check and install Python ─────────────────────────────────
where python >nul 2>&1
if errorlevel 1 (
  echo [1/2] Python not found. Downloading installer...
  powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.3/python-3.12.3-amd64.exe' -OutFile '%TEMP%\python_installer.exe'"
  echo       Installing Python silently, please wait...
  "%TEMP%\python_installer.exe" /quiet InstallAllUsers=0 PrependPath=1 Include_launcher=1
  del "%TEMP%\python_installer.exe"
  :: Refresh PATH in this session so python is available immediately
  for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('PATH','User')"`) do set "PATH=%%i;%PATH%"
  echo       Python installed.
) else (
  echo [1/2] Python found.
)

:: ── Check and install Node.js ─────────────────────────────────
where node >nul 2>&1
if errorlevel 1 (
  echo [2/2] Node.js not found. Downloading installer...
  powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.13.1/node-v20.13.1-x64.msi' -OutFile '%TEMP%\node_installer.msi'"
  echo       Installing Node.js silently, please wait...
  msiexec /i "%TEMP%\node_installer.msi" /quiet /norestart
  del "%TEMP%\node_installer.msi"
  :: Refresh PATH in this session
  for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('PATH','Machine')"`) do set "PATH=%%i;%PATH%"
  echo       Node.js installed.
) else (
  echo [2/2] Node.js found.
)

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
