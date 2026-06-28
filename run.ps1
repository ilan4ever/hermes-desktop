param(
    [switch]$Build
)

# Hermes Desktop - dev runner
# This script starts the desktop app in development mode.
# IMPORTANT: NEVER kill processes outside this project.
# Only the specific Hermes process launched by THIS script is tracked and cleaned up.

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path $RepoRoot ".hermes-desktop.pid"

Write-Host "=== Hermes Desktop Dev Runner ===" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot" -ForegroundColor Gray

# Stop only the previously tracked Hermes process from THIS script (if any)
if (Test-Path $PidFile) {
    $oldPid = Get-Content $PidFile -Raw -ErrorAction SilentlyContinue
    if ($oldPid) {
        $oldPid = $oldPid.Trim()
        if ($oldPid -match '^\d+$') {
            $oldProc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
            if ($oldProc -and $oldProc.ProcessName -match "Hermes|electron") {
                Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue
                Write-Host "Stopped previous instance (PID $oldPid)" -ForegroundColor Yellow
            }
        }
    }
}

# Also kill the vite renderer from any previous run on our port
$listeningPort = 5199
try {
    $oldPortOwner = Get-NetTCPConnection -LocalPort $listeningPort -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
    if ($oldPortOwner -and $oldPortOwner -gt 0) {
        $proc = Get-Process -Id $oldPortOwner -ErrorAction SilentlyContinue
        if ($proc -and $proc.ProcessName -eq "node") {
            Stop-Process -Id $oldPortOwner -Force -ErrorAction SilentlyContinue
        }
    }
} catch {
    # NetTCPConnection may fail in some environments; skip
}

if ($Build) {
    Write-Host "Building for production..." -ForegroundColor Yellow
    Set-Location $RepoRoot
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Starting production build..." -ForegroundColor Green
    npm run start
    exit
}

Write-Host "Starting Vite renderer (hot-reload)..." -ForegroundColor Green

$rendererJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    npm run dev:renderer 2>&1
} -ArgumentList $RepoRoot

# Wait for the renderer to be ready
$maxWait = 30
$waited = 0
while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 1
    $waited++
    try {
        $req = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$listeningPort/")
        $req.Timeout = 1000
        $resp = $req.GetResponse()
        $resp.Close()
        break
    } catch {
        Write-Host "." -NoNewline -ForegroundColor DarkYellow
    }
}

Write-Host ""

Write-Host "Starting Electron..." -ForegroundColor Green
Write-Host "Hermes Desktop is running. Close the window or press Ctrl+C to stop." -ForegroundColor Cyan

# Record our OWN Electron PID before launching, so on next run we only kill ourselves
Set-Location $RepoRoot
$process = Start-Process -FilePath "npx.cmd" -ArgumentList "electron ." -PassThru -NoNewWindow
$process.Id | Out-File -FilePath $PidFile -Encoding utf8 -Force
Write-Host "Started Hermes Desktop (PID $($process.Id))" -ForegroundColor Green

# Wait for the process to exit
$process.WaitForExit()

# Cleanup: stop the renderer job when Electron exits
Write-Host "Stopping renderer..." -ForegroundColor Yellow
Stop-Job $rendererJob -ErrorAction SilentlyContinue | Out-Null
Remove-Job $rendererJob -ErrorAction SilentlyContinue | Out-Null

# Remove PID file
Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
Write-Host "Done." -ForegroundColor Gray
