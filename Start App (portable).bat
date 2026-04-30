@echo off
cd /d "%~dp0"
echo ============================================================
echo  Vaccine Mandates Timeline - Startup (Portable Mode)
echo ============================================================
echo.

:: ── Download portable Python if needed ───────────────────────
if not exist ".python\python.exe" (
  echo [1/2] Downloading portable Python, please wait...
  powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.3/python-3.12.3-embed-amd64.zip' -OutFile '.python.zip'"
  powershell -NoProfile -Command "Expand-Archive -Path '.python.zip' -DestinationPath '.python' -Force"
  del .python.zip
  :: Uncomment 'import site' so pip and installed packages are visible
  powershell -NoProfile -Command "(Get-Content '.python\python312._pth') -replace '#import site','import site' | Set-Content '.python\python312._pth'"
  :: Bootstrap pip
  echo       Setting up pip...
  powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile '.python\get-pip.py'"
  .python\python.exe .python\get-pip.py --quiet
  del .python\get-pip.py
  echo       Python ready.
) else (
  echo [1/2] Portable Python found.
)

:: ── Download portable Node.js if needed ──────────────────────
if not exist ".node\node.exe" (
  echo [2/2] Downloading portable Node.js, please wait...
  powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.13.1/node-v20.13.1-win-x64.zip' -OutFile '.node.zip'"
  powershell -NoProfile -Command "Expand-Archive -Path '.node.zip' -DestinationPath '.node_tmp' -Force; Move-Item '.node_tmp\node-v20.13.1-win-x64' '.node'; Remove-Item '.node_tmp' -Recurse"
  del .node.zip
  echo       Node.js ready.
) else (
  echo [2/2] Portable Node.js found.
)

:: ── Add local runtimes to PATH for this session ──────────────
set "PATH=%~dp0.python;%~dp0.python\Scripts;%~dp0.node;%PATH%"

echo.

:: ── Kill stale processes ──────────────────────────────────────
echo Clearing stale processes on ports 8000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 "') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 "') do taskkill /F /PID %%a 2>nul

:: ── Backend: install deps if needed ──────────────────────────
if not exist ".python\Scripts\uvicorn.exe" (
  echo Installing backend dependencies...
  python -m pip install -q -r requirements.txt
  echo Backend dependencies installed.
)

echo Starting backend...
start "Backend" python -m uvicorn main:app --reload --port 8000

:: ── Frontend: install deps if needed ─────────────────────────
if not exist "frontend_client\node_modules" (
  echo Installing frontend dependencies...
  cd frontend_client
  npm install --silent
  cd ..
  echo Frontend dependencies installed.
)

echo Starting frontend...
start "Frontend" cmd /c "cd /d "%~dp0frontend_client" && npm run dev"

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
