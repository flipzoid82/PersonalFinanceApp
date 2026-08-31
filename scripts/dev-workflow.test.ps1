$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot "dev-workflow.psm1") -Force

$failures = 0
function Assert-DevTest {
  param([bool]$Condition, [string]$Name)
  if ($Condition) { Write-Host "[PASS] $Name" -ForegroundColor Green }
  else { Write-Host "[FAIL] $Name" -ForegroundColor Red; $script:failures++ }
}

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$projectProcess = [pscustomobject]@{
  Name = "node.exe"
  CommandLine = '"C:\Program Files\nodejs\node.exe" "' + $projectRoot + '\node_modules\next\dist\bin\next" dev'
}
$unrelatedProcess = [pscustomobject]@{
  Name = "node.exe"
  CommandLine = '"C:\Program Files\nodejs\node.exe" "C:\Other App\server.js"'
}
$projectNonNext = [pscustomobject]@{
  Name = "node.exe"
  CommandLine = '"C:\Program Files\nodejs\node.exe" "' + $projectRoot + '\scripts\worker.js"'
}

Assert-DevTest (Test-DevProjectNextProcess -ProcessInfo $projectProcess -ProjectRoot $projectRoot) "Identifies this project's Next.js dev server"
Assert-DevTest (-not (Test-DevProjectNextProcess -ProcessInfo $unrelatedProcess -ProjectRoot $projectRoot)) "Rejects unrelated Node process"
Assert-DevTest (-not (Test-DevProjectNextProcess -ProcessInfo $projectNonNext -ProjectRoot $projectRoot)) "Rejects non-Next project process"

Assert-DevTest ((Get-DevDockerStartupMode -DockerInstalled $true -EngineAvailable $true -DesktopCliSupported $true -DockerDesktopPath "C:\Docker Desktop.exe") -eq "AlreadyRunning") "Docker installed and running needs no launch"
Assert-DevTest ((Get-DevDockerStartupMode -DockerInstalled $true -EngineAvailable $false -DesktopCliSupported $true -DockerDesktopPath "C:\Docker Desktop.exe") -eq "DesktopCli") "Docker stopped prefers supported Docker Desktop CLI startup"
Assert-DevTest ((Get-DevDockerStartupMode -DockerInstalled $true -EngineAvailable $false -DesktopCliSupported $false -DockerDesktopPath "C:\Docker Desktop.exe") -eq "LaunchDesktop") "Docker stopped falls back to its executable when CLI startup is unavailable"
Assert-DevTest ((Get-DevDockerStartupMode -DockerInstalled $true -EngineAvailable $false -DesktopCliSupported $false -DockerDesktopPath $null) -eq "DesktopNotFound") "Docker executable fallback missing has an actionable mode"
Assert-DevTest ((Get-DevDockerStartupMode -DockerInstalled $false -EngineAvailable $false -DesktopCliSupported $false -DockerDesktopPath $null) -eq "NotInstalled") "Docker not installed is distinguished from a stopped engine"
Assert-DevTest ((Get-DevDockerCliStartOutcome -DesktopCliSupported $true -ExitCode 0) -eq "Requested") "Accepts successful Docker Desktop CLI start request"
Assert-DevTest ((Get-DevDockerCliStartOutcome -DesktopCliSupported $true -ExitCode 1) -eq "Failed") "Reports supported Docker Desktop CLI start command failure"
Assert-DevTest ((Get-DevDockerCliStartOutcome -DesktopCliSupported $false -ExitCode 1) -eq "Unsupported") "Distinguishes unavailable Docker Desktop CLI startup for fallback"

$dockerAttempts = 0
$dockerLaunchWait = Wait-DevCondition -TimeoutSeconds 1 -PollMilliseconds 0 -Condition {
  $script:dockerAttempts++
  $script:dockerAttempts -ge 2
}
Assert-DevTest ($dockerLaunchWait.Succeeded -and $dockerLaunchWait.Attempts -eq 2) "Docker auto-launch wait succeeds when the engine becomes ready"
$dockerTimeoutWait = Wait-DevCondition -TimeoutSeconds 0 -PollMilliseconds 0 -Condition { $false }
Assert-DevTest (-not $dockerTimeoutWait.Succeeded) "Docker auto-launch wait reports timeout"

Assert-DevTest ((Get-DevNgrokStartupMode -NgrokInstalled $true -NgrokRunning $true) -eq "Reuse") "Reuses an already running ngrok process"
Assert-DevTest ((Get-DevNgrokStartupMode -NgrokInstalled $true -NgrokRunning $false) -eq "Launch") "Starts ngrok when installed but stopped"
Assert-DevTest ((Get-DevNgrokStartupMode -NgrokInstalled $false -NgrokRunning $false) -eq "NotInstalled") "Reports ngrok as unavailable without auto-installing"

$ownedStart = [DateTime]::UtcNow.AddMinutes(-1)
$ownedProcess = [pscustomobject]@{ Id = 4321; ProcessName = "ngrok"; StartTime = $ownedStart }
Assert-DevTest (Test-DevSavedProcessOwnership -Process $ownedProcess -ExpectedProcessId 4321 -ExpectedProcessName "ngrok" -ExpectedStartTimeUtc $ownedStart.ToString("o")) "Accepts matching ngrok PID and start time ownership proof"
Assert-DevTest (-not (Test-DevSavedProcessOwnership -Process $ownedProcess -ExpectedProcessId 4322 -ExpectedProcessName "ngrok" -ExpectedStartTimeUtc $ownedStart.ToString("o"))) "Rejects unrelated process PID"
Assert-DevTest (-not (Test-DevSavedProcessOwnership -Process $ownedProcess -ExpectedProcessId 4321 -ExpectedProcessName "ngrok" -ExpectedStartTimeUtc $ownedStart.AddMinutes(-5).ToString("o"))) "Rejects reused PID with a different start time"

$sensitive = @"
DATABASE_URL=postgresql://finance:db-password@localhost:5432/app
PLAID_SECRET=plaid-secret-value
PLAID_TOKEN_ENCRYPTION_KEY=$("a" * 64)
access-sandbox-token-value
public-sandbox-token-value
"@
$redacted = Protect-SensitiveText $sensitive
Assert-DevTest (-not $redacted.Contains("db-password")) "Redacts connection-string password"
Assert-DevTest (-not $redacted.Contains("plaid-secret-value")) "Redacts named secrets"
Assert-DevTest (-not $redacted.Contains("token-value")) "Redacts Plaid token shapes"
$importSecretLine = Protect-SensitiveText ("IMPORT_FILE_ENCRYPTION_KEY=" + ("f" * 64))
Assert-DevTest (-not $importSecretLine.Contains(("f" * 64))) "Redacts the generated import-encryption key"

$validCore = @{
  DATABASE_URL = "postgresql://finance:password@localhost:5432/app"
  APP_URL = "http://localhost:3000"
  AUTH_SECRET = "a" * 32
  TOKEN_ENCRYPTION_KEY = "b" * 64
}
Assert-DevTest (@(Test-DevCoreConfiguration -Environment $validCore).Count -eq 0) "Accepts valid core configuration"
$invalidCore = @{}
$invalidCoreIssues = @(Test-DevCoreConfiguration -Environment $invalidCore)
Assert-DevTest ($invalidCoreIssues -contains "DATABASE_URL is missing") "Reports missing configuration by name only"

$validImportEnvironment = @{ TOKEN_ENCRYPTION_KEY = "b" * 64 }
Assert-DevTest (Test-DevImportEncryptionKey -Key ("d" * 64) -Environment $validImportEnvironment) "Accepts a dedicated import-encryption key"
Assert-DevTest (-not (Test-DevImportEncryptionKey -Key ("b" * 64) -Environment $validImportEnvironment)) "Rejects import-key reuse"
Assert-DevTest (-not (Test-DevImportEncryptionKey -Key "short" -Environment $validImportEnvironment)) "Rejects an invalid import-key shape"

$validPlaid = @{
  PLAID_CLIENT_ID = "present"
  PLAID_SECRET = "present"
  PLAID_ENV = "sandbox"
  PLAID_WEBHOOK_URL = "https://example.test/api/plaid/webhook"
  PLAID_TOKEN_ENCRYPTION_KEY = "c" * 64
}
Assert-DevTest (@(Test-DevPlaidConfiguration -Environment $validPlaid).Count -eq 0) "Accepts valid Plaid Sandbox shape"
$invalidPlaid = $validPlaid.Clone()
$invalidPlaid.PLAID_ENV = "production"
$invalidPlaid.PLAID_TOKEN_ENCRYPTION_KEY = "invalid"
$plaidIssues = @(Test-DevPlaidConfiguration -Environment $invalidPlaid)
Assert-DevTest ($plaidIssues -contains "PLAID_ENV must equal sandbox") "Rejects non-Sandbox Plaid mode"
Assert-DevTest ($plaidIssues -contains "PLAID_TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters") "Rejects invalid Plaid key shape without printing it"

$temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ("personal-finance-dev-test-" + [Guid]::NewGuid().ToString("N"))
$runtimeDirectory = Join-Path $temporaryRoot ".dev-runtime"
try {
  New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
  $importKeyPath = Join-Path $runtimeDirectory "import-file-encryption.key"
  $generatedImport = Initialize-DevImportEncryptionKey -Environment $validImportEnvironment -KeyPath $importKeyPath
  $reusedImport = Initialize-DevImportEncryptionKey -Environment $validImportEnvironment -KeyPath $importKeyPath
  Assert-DevTest ($generatedImport.Created -and $generatedImport.Source -eq "LocalDevelopment") "Generates an ignored development-only import key"
  Assert-DevTest (-not $reusedImport.Created -and $reusedImport.Key -eq $generatedImport.Key) "Reuses the same local import key across startup"
  Assert-DevTest ((Get-Content -LiteralPath $importKeyPath -Raw).Trim() -eq $generatedImport.Key) "Persists only the generated local key material"
  $explicitImportEnvironment = $validImportEnvironment.Clone()
  $explicitImportEnvironment["IMPORT_FILE_ENCRYPTION_KEY"] = "e" * 64
  $explicitImport = Initialize-DevImportEncryptionKey -Environment $explicitImportEnvironment -KeyPath $importKeyPath
  Assert-DevTest ($explicitImport.Source -eq "Environment" -and $explicitImport.Key -eq ("e" * 64)) "Prefers explicit valid import configuration without rewriting it"
  $statePath = Join-Path $runtimeDirectory "state.json"
  $logPath = Join-Path $runtimeDirectory "next.stdout.log"
  Set-Content -LiteralPath $logPath -Value "temporary"
  $importsPath = Join-Path $runtimeDirectory "imports"
  New-Item -ItemType Directory -Path $importsPath -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $importsPath "retained.enc") -Value "synthetic-encrypted-bytes"
  Save-DevState -Path $statePath -State ([ordered]@{ Version = 1; NextPid = 1234 })
  $saved = Read-DevState -Path $statePath
  Assert-DevTest ($saved.Version -eq 1 -and $saved.NextPid -eq 1234) "Round-trips workflow state"
  Remove-DevRuntimeArtifacts -ProjectRoot $temporaryRoot -Directory $runtimeDirectory
  Assert-DevTest (-not (Test-Path -LiteralPath $statePath) -and -not (Test-Path -LiteralPath $logPath)) "Cleans scoped runtime state and logs"
  Assert-DevTest ((Test-Path -LiteralPath $importKeyPath) -and (Test-Path -LiteralPath (Join-Path $importsPath "retained.enc"))) "Preserves the local import key and retained encrypted sources"
} finally {
  if (Test-Path -LiteralPath $temporaryRoot) { Remove-Item -LiteralPath $temporaryRoot -Recurse -Force }
}

$stopScript = Get-Content -LiteralPath (Join-Path $PSScriptRoot "stop-dev.ps1") -Raw
Assert-DevTest ($stopScript -notmatch '(?i)Stop-(?:Process|Service).*Docker') "Stop workflow never stops Docker Desktop"
Assert-DevTest ($stopScript -match 'Test-DevSavedProcessOwnership') "Stop workflow requires ownership proof before stopping ngrok"
$workflowSource = (Get-Content -LiteralPath (Join-Path $PSScriptRoot "start-dev.ps1") -Raw) + (Get-Content -LiteralPath (Join-Path $PSScriptRoot "dev-workflow.psm1") -Raw)
Assert-DevTest ($workflowSource -notmatch '(?i)settings-store\.json|settings\.json|Set-Content[^\r\n]*Docker|Win32_(?:Window|Desktop)') "Docker startup does not mutate settings or automate its UI"
Assert-DevTest ($workflowSource -match 'Initialize-DevImportEncryptionKey' -and $workflowSource -match 'SetEnvironmentVariable\("IMPORT_FILE_ENCRYPTION_KEY"') "Startup passes import encryption only through the server process environment"

if ($failures -gt 0) { throw "$failures developer-workflow test(s) failed." }
Write-Host "[PASS] Developer workflow helper tests completed." -ForegroundColor Green
