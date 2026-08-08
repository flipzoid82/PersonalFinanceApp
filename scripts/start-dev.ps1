[CmdletBinding()]
param(
  [switch]$Plaid,
  [switch]$Restart,
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot "dev-workflow.psm1") -Force

function Invoke-RequiredCommand {
  param([string]$FilePath, [string[]]$Arguments, [string]$Description)
  $result = Invoke-DevNativeCommand -FilePath $FilePath -Arguments $Arguments
  if ($result.ExitCode -ne 0) { throw "$Description failed with exit code $($result.ExitCode)."
  }
}

function Wait-ForPostgres {
  param([string]$DockerPath, [int]$Seconds = 60)
  $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
  do {
    $result = Invoke-DevNativeCommand -FilePath $DockerPath -Arguments @("compose", "exec", "-T", "postgres", "pg_isready", "-U", "finance", "-d", "personal_finance")
    if ($result.ExitCode -eq 0) { return $true }
    Start-Sleep -Milliseconds 750
  } while ([DateTime]::UtcNow -lt $deadline)
  return $false
}

function Wait-ForApp {
  param([int]$Seconds = 60)
  $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri "http://localhost:3000/login" -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return $true }
    } catch { }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)
  return $false
}

function Get-NgrokTunnel {
  try {
    $result = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2
    return $result.tunnels | Where-Object { $_.public_url -match '^https://' } | Select-Object -First 1
  } catch {
    return $null
  }
}

try {
  $projectRoot = Get-DevProjectRoot -ScriptRoot $PSScriptRoot
  Set-Location -LiteralPath $projectRoot
  $paths = Get-DevStatePaths -ProjectRoot $projectRoot
  $previousState = Read-DevState -Path $paths.State
  Write-DevCheck PASS "Project" "Verified Personal Finance App root."

  $nodePath = Get-DevCommand -Names @("node.exe", "node")
  $pnpmPath = Get-DevCommand -Names @("pnpm.cmd", "pnpm")
  if (-not $nodePath) { throw "Node.js is unavailable. Install a supported Node.js version (20.9 or newer)." }
  if (-not $pnpmPath) { throw "pnpm is unavailable. Install the package-manager version declared in package.json." }
  $nodeVersionText = (& $nodePath --version).Trim().TrimStart("v")
  $pnpmVersionText = (& $pnpmPath --version).Trim()
  if ([version]$nodeVersionText -lt [version]"20.9.0") { throw "Node.js $nodeVersionText is unsupported; install Node.js 20.9 or newer." }
  if ([version]$pnpmVersionText -lt [version]"11.0.0") { throw "pnpm $pnpmVersionText is unsupported; install pnpm 11 or newer." }
  Write-DevCheck PASS "Toolchain" "Node $nodeVersionText and pnpm $pnpmVersionText are available."

  $dockerPath = Get-DevCommand -Names @("docker.exe", "docker")
  if (-not $dockerPath) { throw "Docker is unavailable. Install Docker Desktop and start it before retrying." }
  $dockerInfo = Invoke-DevNativeCommand -FilePath $dockerPath -Arguments @("info")
  if ($dockerInfo.ExitCode -ne 0) { throw "Docker is installed but the Docker engine is not available. Start Docker Desktop and retry." }
  Write-DevCheck PASS "Docker" "Docker engine is available."

  $envPath = Join-Path $projectRoot ".env"
  if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
    throw ".env is missing. Copy .env.example to .env and configure it locally; do not commit it."
  }
  $environment = Read-DevEnvFile -Path $envPath
  $coreIssues = @(Test-DevCoreConfiguration -Environment $environment)
  if ($coreIssues.Count -gt 0) { throw ("Invalid .env configuration: " + ($coreIssues -join "; ")) }
  Write-DevCheck PASS "Environment" "Required core configuration is present and valid. Secret values were not displayed."

  if ($Plaid) {
    $plaidIssues = @(Test-DevPlaidConfiguration -Environment $environment)
    if ($plaidIssues.Count -gt 0) { throw ("Plaid Sandbox configuration is invalid: " + ($plaidIssues -join "; ")) }
    $ngrokPath = Get-DevCommand -Names @("ngrok.exe", "ngrok")
    $existingNgrokProcess = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $existingNgrokProcess -and -not $ngrokPath) {
      throw "ngrok is not installed or not on PATH. Install ngrok, authenticate it manually, and retry pnpm dev:start:plaid."
    }
    Write-DevCheck PASS "Plaid configuration" "Sandbox configuration and encryption-key shape are valid."
  }

  Invoke-RequiredCommand -FilePath $dockerPath -Arguments @("compose", "up", "-d", "postgres") -Description "Starting PostgreSQL"
  if (-not (Wait-ForPostgres -DockerPath $dockerPath)) { throw "PostgreSQL did not become healthy within 60 seconds. Run pnpm dev:doctor for details." }
  Write-DevCheck PASS "PostgreSQL" "Container is running and accepting connections."

  $nextCli = Join-Path $projectRoot "node_modules\next\dist\bin\next"
  $prismaCli = Join-Path $projectRoot "node_modules\prisma\build\index.js"
  if (-not (Test-Path -LiteralPath $nextCli) -or -not (Test-Path -LiteralPath $prismaCli)) {
    throw "Dependencies are missing. Run pnpm install once, then retry; startup does not reinstall dependencies automatically."
  }

  $nextPid = $null
  $nextStarted = $false
  $listenerPid = Get-DevListeningProcessId -Port 3000
  if ($listenerPid) {
    $existingNext = Get-DevNextProcessRoot -ProcessId $listenerPid -ProjectRoot $projectRoot
    if ($null -eq $existingNext) { throw "Port 3000 is occupied by another process. Stop that process manually or choose a different port; no process was killed." }
    if ($Restart) {
      & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "stop-dev.ps1")
      if ($LASTEXITCODE -ne 0) { throw "The existing project server could not be stopped safely." }
      $listenerPid = $null
    } else {
      $nextPid = [int]$existingNext.ProcessId
      if ($previousState -and [int]$previousState.NextPid -eq $nextPid) {
        $nextStarted = [bool]$previousState.NextStartedByWorkflow
      }
      Write-DevCheck PASS "Next.js" "Reusing the existing Personal Finance App development server. Use pnpm dev:start -Restart for a clean restart."
      Write-DevCheck WARN "Prisma" "Skipped client generation and migration deployment while the server is running. Use -Restart to run full preparation safely."
    }
  }

  if (-not $listenerPid) {
    Invoke-RequiredCommand -FilePath $pnpmPath -Arguments @("exec", "prisma", "generate") -Description "Prisma client generation"
    Invoke-RequiredCommand -FilePath $pnpmPath -Arguments @("exec", "prisma", "migrate", "deploy") -Description "Safe migration deployment"
    Write-DevCheck PASS "Prisma" "Client generated and pending forward migrations applied."
  }

  $ownerResult = Invoke-DevNativeCommand -FilePath $pnpmPath -Arguments @("exec", "tsx", "scripts/check-owner.ts")
  if ($ownerResult.ExitCode -eq 2) { throw "No owner account exists. Run pnpm owner:create manually with an owner email and password." }
  if ($ownerResult.ExitCode -ne 0 -or ($ownerResult.Output -join "") -notmatch 'OWNER_PRESENT') { throw "Owner-account verification failed. Run pnpm dev:doctor for details." }
  Write-DevCheck PASS "Owner" "An owner account exists. No owner data was displayed."

  if (-not $listenerPid) {
    if (-not (Test-Path -LiteralPath $paths.Directory)) { New-Item -ItemType Directory -Path $paths.Directory -Force | Out-Null }
    Remove-Item -LiteralPath $paths.NextStdout, $paths.NextStderr -Force -ErrorAction SilentlyContinue
    $quotedNextCli = '"' + $nextCli + '"'
    $nextProcess = Start-Process -FilePath $nodePath -ArgumentList @($quotedNextCli, "dev") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $paths.NextStdout -RedirectStandardError $paths.NextStderr -PassThru
    $nextPid = $nextProcess.Id
    $nextStarted = $true
    if (-not (Wait-ForApp)) {
      $safeTail = ""
      if (Test-Path -LiteralPath $paths.NextStderr) { $safeTail = (Get-Content -LiteralPath $paths.NextStderr -Tail 10) -join " " }
      throw ("Next.js did not respond within 60 seconds. " + (Protect-SensitiveText $safeTail))
    }
    Write-DevCheck PASS "Next.js" "Development server started and /login is responding."
  } elseif (-not (Wait-ForApp -Seconds 10)) {
    throw "The identified project server owns port 3000 but /login did not respond. Retry with pnpm dev:start -Restart."
  }

  $nextProcessForState = Get-Process -Id $nextPid -ErrorAction SilentlyContinue
  $preservedNgrok = $null
  if ($previousState -and $previousState.NgrokStartedByWorkflow -eq $true -and $previousState.NgrokPid) {
    $candidateNgrok = Get-Process -Id ([int]$previousState.NgrokPid) -ErrorAction SilentlyContinue
    if ($candidateNgrok -and $candidateNgrok.ProcessName -eq "ngrok") {
      $expectedNgrokStart = [DateTime]::Parse([string]$previousState.NgrokStartTimeUtc).ToUniversalTime()
      if ([Math]::Abs(($candidateNgrok.StartTime.ToUniversalTime() - $expectedNgrokStart).TotalSeconds) -le 1) {
        $preservedNgrok = $candidateNgrok
      }
    }
  }
  $state = [ordered]@{
    Version = 1
    ProjectRoot = $projectRoot
    NextPid = $nextPid
    NextStartedByWorkflow = $nextStarted
    NextStartTimeUtc = if ($nextProcessForState) { $nextProcessForState.StartTime.ToUniversalTime().ToString("o") } else { $null }
    NgrokPid = if ($preservedNgrok) { $preservedNgrok.Id } else { $null }
    NgrokStartedByWorkflow = [bool]$preservedNgrok
    NgrokStartTimeUtc = if ($preservedNgrok) { $preservedNgrok.StartTime.ToUniversalTime().ToString("o") } else { $null }
  }
  Save-DevState -Path $paths.State -State $state

  if ($Plaid) {
    $ngrokProcess = $existingNgrokProcess
    if (-not $ngrokProcess) {
      Remove-Item -LiteralPath $paths.NgrokStdout, $paths.NgrokStderr -Force -ErrorAction SilentlyContinue
      $ngrokProcess = Start-Process -FilePath $ngrokPath -ArgumentList @("http", "3000", "--log=stdout", "--log-format=json") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $paths.NgrokStdout -RedirectStandardError $paths.NgrokStderr -PassThru
      $state.NgrokStartedByWorkflow = $true
    } elseif (-not $preservedNgrok -or $preservedNgrok.Id -ne $ngrokProcess.Id) {
      $state.NgrokStartedByWorkflow = $false
    }
    $state.NgrokPid = $ngrokProcess.Id
    $state.NgrokStartTimeUtc = $ngrokProcess.StartTime.ToUniversalTime().ToString("o")
    Save-DevState -Path $paths.State -State $state
    $tunnel = $null
    for ($attempt = 0; $attempt -lt 20 -and -not $tunnel; $attempt++) { Start-Sleep -Milliseconds 500; $tunnel = Get-NgrokTunnel }
    if (-not $tunnel) { throw "ngrok is running but no HTTPS forwarding URL was found at the local ngrok API." }
    $tunnelHost = ([Uri]$tunnel.public_url).Host
    $webhookHost = ([Uri]$environment["PLAID_WEBHOOK_URL"]).Host
    if ($tunnelHost -eq $webhookHost) {
      Write-DevCheck PASS "Plaid tunnel" "HTTPS tunnel host matches PLAID_WEBHOOK_URL."
    } else {
      Write-DevCheck WARN "Plaid tunnel" "Tunnel host does not match PLAID_WEBHOOK_URL. Update .env manually and restart; the workflow did not modify it."
    }
  }

  Save-DevState -Path $paths.State -State $state
  if (-not $NoBrowser) { Start-Process "http://localhost:3000/login" | Out-Null }

  Write-Host ""
  Write-DevCheck PASS "Startup" "Personal Finance App is ready at http://localhost:3000/login."
  Write-DevCheck PASS "Login" "Owner credentials remain manual and were not read or entered."
  if (-not $Plaid) { Write-DevCheck PASS "Mode" "Normal mode is running without requiring ngrok." }
} catch {
  Write-DevCheck FAIL "Startup" $_.Exception.Message
  exit 1
}
