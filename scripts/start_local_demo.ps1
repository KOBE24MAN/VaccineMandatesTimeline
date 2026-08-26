param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectRoot ".venv\Scripts\python.exe"
$databasePath = Join-Path $projectRoot "data\release\mandates.db"
$staticPath = Join-Path $projectRoot "frontend_client\dist"
$runtimePath = Join-Path $projectRoot "runtime"
$pidPath = Join-Path $runtimePath "demo-server.pid"
$outputLogPath = Join-Path $runtimePath "demo-server.out.log"
$errorLogPath = Join-Path $runtimePath "demo-server.err.log"
$healthUrl = "http://127.0.0.1:8000/health/ready"
$demoUrl = "http://localhost:8000/"

function Test-DemoReady {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
        return $response.status -eq "ok"
    }
    catch {
        return $false
    }
}

if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) {
    throw "Local Python environment was not found at .venv\Scripts\python.exe."
}
if (-not (Test-Path -LiteralPath $databasePath -PathType Leaf)) {
    throw "Release database was not found at data\release\mandates.db."
}
if (-not (Test-Path -LiteralPath (Join-Path $staticPath "index.html") -PathType Leaf)) {
    throw "Built frontend was not found at frontend_client\dist\index.html."
}

New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null

if (Test-DemoReady) {
    Write-Output "[OK] The demo is already running at $demoUrl"
    if (-not $NoBrowser) {
        Start-Process $demoUrl
    }
    exit 0
}

if (Test-Path -LiteralPath $pidPath -PathType Leaf) {
    $existingPid = Get-Content -LiteralPath $pidPath -ErrorAction SilentlyContinue
    if ($existingPid -match "^[0-9]+$") {
        $existingProcess = Get-Process -Id ([int]$existingPid) -ErrorAction SilentlyContinue
        if ($null -ne $existingProcess) {
            Stop-Process -Id $existingProcess.Id -Force
            $existingProcess.WaitForExit()
        }
    }
    Remove-Item -LiteralPath $pidPath -Force
}

$databaseUriPath = $databasePath.Replace("\", "/")
$env:APP_ENV = "production"
$env:LOG_LEVEL = "INFO"
$env:ALLOWED_ORIGINS = "http://localhost:8000,http://127.0.0.1:8000"
$env:DATABASE_URL = "sqlite:///file:/${databaseUriPath}?mode=ro&uri=true"
$env:STATIC_DIR = $staticPath

$arguments = @(
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8000"
)

Write-Output "[INFO] Starting the local demo without Docker."
$process = Start-Process `
    -FilePath $pythonPath `
    -ArgumentList $arguments `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $outputLogPath `
    -RedirectStandardError $errorLogPath `
    -WindowStyle Hidden `
    -PassThru
Set-Content -LiteralPath $pidPath -Value $process.Id -Encoding Ascii

$deadline = (Get-Date).AddSeconds(45)
do {
    Start-Sleep -Milliseconds 500
    if ($process.HasExited) {
        break
    }
    if (Test-DemoReady) {
        Write-Output "[OK] The demo is ready at $demoUrl"
        if (-not $NoBrowser) {
            Start-Process $demoUrl
        }
        exit 0
    }
} while ((Get-Date) -lt $deadline)

if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
}
Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
Write-Output "[ERROR] The local demo did not become ready."
if (Test-Path -LiteralPath $errorLogPath -PathType Leaf) {
    Get-Content -LiteralPath $errorLogPath -Tail 40
}
exit 1
