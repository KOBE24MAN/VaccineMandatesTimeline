@echo off
setlocal EnableExtensions
cd /d "%~dp0"
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Install Node.js 20.19+ or 22+ and reopen this launcher.
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo [INFO] Frontend only. Open the local URL printed below.
call npm run dev -- --host 127.0.0.1 --port 5174 --open
if errorlevel 1 pause
