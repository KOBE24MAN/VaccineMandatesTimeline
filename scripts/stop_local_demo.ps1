$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimePath = Join-Path $projectRoot "runtime"
$pidPath = Join-Path $runtimePath "demo-server.pid"

if (-not (Test-Path -LiteralPath $pidPath -PathType Leaf)) {
    Write-Output "[INFO] No local demo process is recorded."
    exit 0
}

$serverPid = Get-Content -LiteralPath $pidPath -ErrorAction SilentlyContinue
if ($serverPid -notmatch "^[0-9]+$") {
    Remove-Item -LiteralPath $pidPath -Force
    Write-Output "[WARNING] Removed an invalid demo process record."
    exit 0
}

$serverProcess = Get-Process -Id ([int]$serverPid) -ErrorAction SilentlyContinue
if ($null -ne $serverProcess) {
    Stop-Process -Id $serverProcess.Id -Force
    $serverProcess.WaitForExit()
    Write-Output "[OK] The local demo was stopped."
}
else {
    Write-Output "[INFO] The recorded demo process was not running."
}
Remove-Item -LiteralPath $pidPath -Force
