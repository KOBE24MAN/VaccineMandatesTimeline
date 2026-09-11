@echo off
setlocal EnableExtensions
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop-local-demo.ps1"
set "stopResult=%errorlevel%"
if /I not "%~1"=="/quiet" pause
exit /b %stopResult%
