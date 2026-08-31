[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot "dev-workflow.psm1") -Force

$failures = 0
function Report-Result {
  param([string]$Status, [string]$Name, [string]$Message)
  Write-DevCheck $Status $Name $Message
  if ($Status -eq "FAIL") { $script:failures++ }
}

try {
  $projectRoot = Get-DevProjectRoot -ScriptRoot $PSScriptRoot
  Set-Location -LiteralPath $projectRoot
  $paths = Get-DevStatePaths -ProjectRoot $projectRoot
  Report-Result PASS "Project" "Verified Personal Finance App root."

  $nodePath = Get-DevCommand -Names @("node.exe", "node")
  if ($nodePath) {
    $nodeVersion = (& $nodePath --version).Trim().TrimStart("v")
    if ([version]$nodeVersion -ge [version]"20.9.0") { Report-Result PASS "Node" "Version $nodeVersion is supported." }
    else { Report-Result FAIL "Node" "Version $nodeVersion is unsupported; install Node.js 20.9 or newer." }
  } else { Report-Result FAIL "Node" "Node.js is not available on PATH." }

  $pnpmPath = Get-DevCommand -Names @("pnpm.cmd", "pnpm")
  if ($pnpmPath) {
    $pnpmVersion = (& $pnpmPath --version).Trim()
    if ([version]$pnpmVersion -ge [version]"11.0.0") { Report-Result PASS "pnpm" "Version $pnpmVersion is supported." }
    else { Report-Result FAIL "pnpm" "Version $pnpmVersion is unsupported; install pnpm 11 or newer." }
  } else { Report-Result FAIL "pnpm" "pnpm is not available on PATH." }

  $dockerPath = Get-DevCommand -Names @("docker.exe", "docker")
  $dockerReady = $false
  if ($dockerPath) {
    $dockerResult = Invoke-DevNativeCommand -FilePath $dockerPath -Arguments @("info")
    if ($dockerResult.ExitCode -eq 0) {
      $dockerReady = $true
      Report-Result PASS "Docker" "Docker engine is available."
    } else { Report-Result FAIL "Docker" "Docker is installed but its engine is unavailable." }
  } else { Report-Result FAIL "Docker" "Docker is not installed or not available on PATH." }

  if ($dockerReady) {
    $containerResult = Invoke-DevNativeCommand -FilePath $dockerPath -Arguments @("compose", "ps", "-q", "postgres")
    $containerId = $containerResult.Output | Select-Object -First 1
    if ($containerId) {
      $inspectResult = Invoke-DevNativeCommand -FilePath $dockerPath -Arguments @("inspect", "--format", '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}', $containerId)
      $containerState = ($inspectResult.Output | Select-Object -First 1).Trim()
      if ($containerState -eq "running|healthy") { Report-Result PASS "PostgreSQL container" "Running and healthy." }
      elseif ($containerState -match '^running\|') { Report-Result WARN "PostgreSQL container" "Running but not yet healthy." }
      else { Report-Result WARN "PostgreSQL container" "Container exists but is not running." }
    } else { Report-Result WARN "PostgreSQL container" "Container has not been created yet; dev:start will create it." }
  } else { Report-Result WARN "PostgreSQL container" "Not checked because Docker is unavailable." }

  if (Test-DevTcpPort -HostName "127.0.0.1" -Port 5432) { Report-Result PASS "Port 5432" "Accepting TCP connections." }
  else { Report-Result WARN "Port 5432" "Not accepting TCP connections." }

  $port3000Pid = Get-DevListeningProcessId -Port 3000
  if ($port3000Pid) {
    $projectNext = Get-DevNextProcessRoot -ProcessId $port3000Pid -ProjectRoot $projectRoot
    if ($projectNext) { Report-Result PASS "Port 3000" "Owned by this project's Next.js development server." }
    else { Report-Result WARN "Port 3000" "Occupied by another process; the workflow will not stop it." }
  } else { Report-Result WARN "Port 3000" "Available; the development server is not running." }

  $envPath = Join-Path $projectRoot ".env"
  $environment = @{}
  if (Test-Path -LiteralPath $envPath -PathType Leaf) {
    $environment = Read-DevEnvFile -Path $envPath
    if ($environment.ContainsKey("DATABASE_URL") -and -not [string]::IsNullOrWhiteSpace($environment["DATABASE_URL"])) {
      Report-Result PASS "DATABASE_URL" "Present. Its value and password were not displayed."
    } else { Report-Result FAIL "DATABASE_URL" "Missing from .env." }
    $coreIssues = @(Test-DevCoreConfiguration -Environment $environment)
    if ($coreIssues.Count -eq 0) { Report-Result PASS "Core environment" "Required configuration is valid; secret values were not displayed." }
    else { Report-Result FAIL "Core environment" ($coreIssues -join "; ") }
  } else {
    Report-Result FAIL "Environment" ".env is missing. Copy .env.example and configure it locally."
  }

  if ($environment.ContainsKey("IMPORT_FILE_ENCRYPTION_KEY")) {
    if (Test-DevImportEncryptionKey -Key ([string]$environment["IMPORT_FILE_ENCRYPTION_KEY"]) -Environment $environment) {
      Report-Result PASS "Import storage" "The explicit dedicated encryption configuration is valid; its value was not displayed."
    } else {
      Report-Result FAIL "Import storage" "IMPORT_FILE_ENCRYPTION_KEY is invalid or conflicts with another key."
    }
  } elseif (Test-Path -LiteralPath $paths.ImportEncryptionKey -PathType Leaf) {
    $localImportKey = [IO.File]::ReadAllText($paths.ImportEncryptionKey).Trim()
    if (Test-DevImportEncryptionKey -Key $localImportKey -Environment $environment) {
      Report-Result PASS "Import storage" "An ignored development-only encryption key is ready; its value was not displayed."
    } else {
      Report-Result FAIL "Import storage" "The ignored development-only import key is invalid or conflicts with another key."
    }
  } else {
    Report-Result WARN "Import storage" "No import key exists yet; pnpm dev:start will generate an ignored development-only key without editing .env."
  }

  if ($pnpmPath -and (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules\prisma\build\index.js"))) {
    $schemaResult = Invoke-DevNativeCommand -FilePath $pnpmPath -Arguments @("exec", "prisma", "validate")
    if ($schemaResult.ExitCode -eq 0) { Report-Result PASS "Prisma schema" "Schema is valid." }
    else { Report-Result FAIL "Prisma schema" "Validation failed. Run pnpm exec prisma validate for local details." }

    if ($dockerReady -and (Test-DevTcpPort -HostName "127.0.0.1" -Port 5432)) {
      $migrationResult = Invoke-DevNativeCommand -FilePath $pnpmPath -Arguments @("exec", "prisma", "migrate", "status")
      if ($migrationResult.ExitCode -eq 0) { Report-Result PASS "Migrations" "Database schema is up to date." }
      else { Report-Result WARN "Migrations" "Migration status needs attention; run pnpm exec prisma migrate status." }

      $ownerResult = Invoke-DevNativeCommand -FilePath $pnpmPath -Arguments @("exec", "tsx", "scripts/check-owner.ts")
      if ($ownerResult.ExitCode -eq 0 -and ($ownerResult.Output -join "") -match 'OWNER_PRESENT') { Report-Result PASS "Owner" "An owner exists; no owner data was displayed." }
      elseif ($ownerResult.ExitCode -eq 2) { Report-Result WARN "Owner" "No owner exists; create one manually with pnpm owner:create." }
      else { Report-Result FAIL "Owner" "Owner-account check failed without exposing owner data." }
    } else {
      Report-Result WARN "Migrations" "Not checked because PostgreSQL is unavailable."
      Report-Result WARN "Owner" "Not checked because PostgreSQL is unavailable."
    }
  } else {
    Report-Result FAIL "Dependencies" "Project dependencies are missing. Run pnpm install once."
  }

  if ($environment.Count -gt 0) {
    $plaidIssues = @(Test-DevPlaidConfiguration -Environment $environment)
    if ($plaidIssues.Count -eq 0) { Report-Result PASS "Plaid Sandbox" "Required Sandbox variables and encryption-key shape are valid." }
    else { Report-Result WARN "Plaid Sandbox" ($plaidIssues -join "; ") }
  }

  $ngrokPath = Get-DevCommand -Names @("ngrok.exe", "ngrok")
  $ngrokProcess = Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($ngrokProcess) {
    try {
      $tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 2
      if ($tunnels.tunnels | Where-Object { $_.public_url -match '^https://' }) { Report-Result PASS "ngrok" "Running with an HTTPS forwarding tunnel." }
      else { Report-Result WARN "ngrok" "Running without a detectable HTTPS tunnel." }
    } catch { Report-Result WARN "ngrok" "Process is running but its local status API is unavailable." }
  } elseif ($ngrokPath) { Report-Result WARN "ngrok" "Installed but not running; normal startup does not require it." }
  else { Report-Result WARN "ngrok" "Not installed or not on PATH; only Plaid startup requires it." }

  $gitPath = Get-DevCommand -Names @("git.exe", "git")
  $gitResult = if ($gitPath) { Invoke-DevNativeCommand -FilePath $gitPath -Arguments @("check-ignore", "--quiet", "--", ".env") } else { $null }
  if ($gitResult -and $gitResult.ExitCode -eq 0) { Report-Result PASS ".env Git hygiene" ".env is ignored by Git." }
  else { Report-Result FAIL ".env Git hygiene" ".env is not ignored by Git." }

  Write-Host ""
  if ($failures -gt 0) {
    Write-DevCheck FAIL "Doctor summary" "$failures required check(s) failed."
    exit 1
  }
  Write-DevCheck PASS "Doctor summary" "Required checks passed; warnings identify optional or stopped services."
} catch {
  Write-DevCheck FAIL "Doctor" $_.Exception.Message
  exit 1
}
