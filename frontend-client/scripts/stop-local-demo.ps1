$ErrorActionPreference = 'Stop'

try {
    $frontendRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
    $viteScript = Join-Path $frontendRoot 'node_modules\vite\bin\vite.js'
    # npm may launch via node_modules\.bin\..\vite; normalize each path argument.
    function Test-FrontendCommand([string]$commandLine) {
        if (-not $commandLine) { return $false }
        foreach ($token in [regex]::Matches($commandLine, '"([^"]*)"|([^\s"]+)')) {
            $argument = if ($token.Groups[1].Success) { $token.Groups[1].Value } else { $token.Groups[2].Value }
            try {
                if (-not [System.IO.Path]::IsPathRooted($argument)) { continue }
                $normalized = [System.IO.Path]::GetFullPath($argument)
            } catch { continue }
            if ([string]::Equals($normalized, $viteScript, [System.StringComparison]::OrdinalIgnoreCase)) {
                return $true
            }
        }
        return $false
    }
    $processes = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
        Where-Object { Test-FrontendCommand $_.CommandLine })

    if ($processes.Count -eq 0) {
        Write-Host '[INFO] This frontend is already stopped.'
        exit 0
    }

    foreach ($process in $processes) {
        # Recheck identity immediately before stopping to avoid acting on a reused PID.
        $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.ProcessId)"
        if (-not $current) { continue }
        if ($current.CreationDate -ne $process.CreationDate -or
            $current.Name -ne 'node.exe' -or
            -not (Test-FrontendCommand $current.CommandLine)) {
            throw "Process $($process.ProcessId) changed; it was not stopped."
        }
        Stop-Process -Id $current.ProcessId -Force -ErrorAction Stop
        Write-Host "[OK] Stopped this frontend (PID $($current.ProcessId))."
    }
    Write-Host '[INFO] You can close the frontend browser tab and its startup window.'
    exit 0
} catch {
    Write-Host "[ERROR] Could not stop the frontend: $($_.Exception.Message)"
    exit 1
}
