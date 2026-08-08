Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Protect-SensitiveText {
  param([AllowNull()][string]$Text)

  if ($null -eq $Text) { return "" }
  $protected = $Text
  $protected = [regex]::Replace($protected, '(?i)(postgres(?:ql)?://[^:\s/]+:)[^@\s/]+(@)', '$1***$2')
  $protected = [regex]::Replace(
    $protected,
    '(?im)^\s*(AUTH_SECRET|OWNER_PASSWORD|PLAID_SECRET|PLAID_TOKEN_ENCRYPTION_KEY|TOKEN_ENCRYPTION_KEY|[^=]*(?:ACCESS_TOKEN|SESSION_COOKIE)[^=]*)\s*=.*$',
    '$1=***'
  )
  $protected = [regex]::Replace($protected, '(?i)\b(access-(?:sandbox|development|production)-)[A-Za-z0-9_-]+', '$1***')
  $protected = [regex]::Replace($protected, '(?i)\b(public-sandbox-)[A-Za-z0-9_-]+', '$1***')
  return $protected
}

function Write-DevCheck {
  param(
    [ValidateSet("PASS", "WARN", "FAIL")][string]$Status,
    [string]$Name,
    [string]$Message
  )

  $color = switch ($Status) {
    "PASS" { "Green" }
    "WARN" { "Yellow" }
    default { "Red" }
  }
  Write-Host ("[{0}] {1}: {2}" -f $Status, $Name, (Protect-SensitiveText $Message)) -ForegroundColor $color
}

function Get-DevProjectRoot {
  param([Parameter(Mandatory = $true)][string]$ScriptRoot)

  $root = [IO.Path]::GetFullPath((Join-Path $ScriptRoot ".."))
  $packagePath = Join-Path $root "package.json"
  if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
    throw "Project root verification failed: package.json was not found."
  }
  $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
  if ($package.name -ne "personal-finance-dashboard") {
    throw "Project root verification failed: unexpected package name."
  }
  return $root.TrimEnd([IO.Path]::DirectorySeparatorChar)
}

function Get-DevStatePaths {
  param([Parameter(Mandatory = $true)][string]$ProjectRoot)

  $directory = Join-Path $ProjectRoot ".dev-runtime"
  return [pscustomobject]@{
    Directory = $directory
    State = Join-Path $directory "state.json"
    NextStdout = Join-Path $directory "next.stdout.log"
    NextStderr = Join-Path $directory "next.stderr.log"
    NgrokStdout = Join-Path $directory "ngrok.stdout.log"
    NgrokStderr = Join-Path $directory "ngrok.stderr.log"
  }
}

function Read-DevEnvFile {
  param([Parameter(Mandatory = $true)][string]$Path)

  $values = @{}
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $values }
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $separator = $trimmed.IndexOf("=")
    if ($separator -lt 1) { continue }
    $name = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()
    if ($value.Length -ge 2) {
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
          ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }
    $values[$name] = $value
  }
  return $values
}

function Test-DevCoreConfiguration {
  param([Parameter(Mandatory = $true)][hashtable]$Environment)

  $issues = New-Object System.Collections.Generic.List[string]
  foreach ($name in @("DATABASE_URL", "APP_URL", "AUTH_SECRET", "TOKEN_ENCRYPTION_KEY")) {
    if (-not $Environment.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($Environment[$name])) {
      $issues.Add("$name is missing")
    }
  }
  if ($Environment.ContainsKey("DATABASE_URL") -and $Environment["DATABASE_URL"] -notmatch '^postgresql://') {
    $issues.Add("DATABASE_URL must use postgresql://")
  }
  if ($Environment.ContainsKey("APP_URL")) {
    $uri = $null
    if (-not [Uri]::TryCreate($Environment["APP_URL"], [UriKind]::Absolute, [ref]$uri)) {
      $issues.Add("APP_URL must be an absolute URL")
    }
  }
  if ($Environment.ContainsKey("AUTH_SECRET") -and $Environment["AUTH_SECRET"].Length -lt 32) {
    $issues.Add("AUTH_SECRET must contain at least 32 characters")
  }
  if ($Environment.ContainsKey("TOKEN_ENCRYPTION_KEY") -and $Environment["TOKEN_ENCRYPTION_KEY"] -notmatch '^[a-fA-F0-9]{64}$') {
    $issues.Add("TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters")
  }
  return @($issues)
}

function Test-DevPlaidConfiguration {
  param([Parameter(Mandatory = $true)][hashtable]$Environment)

  $issues = New-Object System.Collections.Generic.List[string]
  foreach ($name in @("PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV", "PLAID_WEBHOOK_URL", "PLAID_TOKEN_ENCRYPTION_KEY")) {
    if (-not $Environment.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($Environment[$name])) {
      $issues.Add("$name is missing")
    }
  }
  if ($Environment.ContainsKey("PLAID_ENV") -and $Environment["PLAID_ENV"] -ne "sandbox") {
    $issues.Add("PLAID_ENV must equal sandbox")
  }
  if ($Environment.ContainsKey("PLAID_TOKEN_ENCRYPTION_KEY") -and $Environment["PLAID_TOKEN_ENCRYPTION_KEY"] -notmatch '^[a-fA-F0-9]{64}$') {
    $issues.Add("PLAID_TOKEN_ENCRYPTION_KEY must be 64 hexadecimal characters")
  }
  if ($Environment.ContainsKey("PLAID_WEBHOOK_URL")) {
    $uri = $null
    if (-not [Uri]::TryCreate($Environment["PLAID_WEBHOOK_URL"], [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne "https") {
      $issues.Add("PLAID_WEBHOOK_URL must be an absolute HTTPS URL")
    }
  }
  return @($issues)
}

function Get-DevCommand {
  param([Parameter(Mandatory = $true)][string[]]$Names)
  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $command) { return $command.Source }
  }
  return $null
}

function Invoke-DevNativeCommand {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$Arguments = @()
  )

  $previousPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $output = @(& $FilePath @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousPreference
  }
  return [pscustomobject]@{
    ExitCode = $exitCode
    Output = @($output | ForEach-Object { Protect-SensitiveText ([string]$_) })
  }
}

function Get-DevProcessSnapshot {
  param([Parameter(Mandatory = $true)][int]$ProcessId)
  try {
    return Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f $ProcessId) -ErrorAction Stop
  } catch {
    return $null
  }
}

function Test-DevProjectNextProcess {
  param(
    [Parameter(Mandatory = $true)]$ProcessInfo,
    [Parameter(Mandatory = $true)][string]$ProjectRoot
  )

  if ($null -eq $ProcessInfo -or [string]::IsNullOrWhiteSpace($ProcessInfo.CommandLine)) { return $false }
  if ($ProcessInfo.Name -notmatch '^node(?:\.exe)?$') { return $false }
  $commandLine = $ProcessInfo.CommandLine.Replace('/', '\')
  $normalizedRoot = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\').Replace('/', '\')
  if ($commandLine.IndexOf($normalizedRoot, [StringComparison]::OrdinalIgnoreCase) -lt 0) { return $false }
  return $commandLine -match '(?i)\\next\\dist\\bin\\next(?:\.js)?["'']?\s+dev(?:\s|$)' -or
    $commandLine -match '(?i)\\next\\dist\\server\\lib\\start-server\.js'
}

function Get-DevNextProcessRoot {
  param(
    [Parameter(Mandatory = $true)][int]$ProcessId,
    [Parameter(Mandatory = $true)][string]$ProjectRoot
  )

  $currentId = $ProcessId
  $candidate = $null
  for ($depth = 0; $depth -lt 8 -and $currentId -gt 0; $depth++) {
    $info = Get-DevProcessSnapshot -ProcessId $currentId
    if ($null -eq $info) { break }
    if (Test-DevProjectNextProcess -ProcessInfo $info -ProjectRoot $ProjectRoot) { $candidate = $info }
    $currentId = [int]$info.ParentProcessId
  }
  return $candidate
}

function Get-DevListeningProcessId {
  param([Parameter(Mandatory = $true)][int]$Port)
  try {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -First 1
    if ($null -ne $listener) { return [int]$listener.OwningProcess }
  } catch {
    return $null
  }
  return $null
}

function Test-DevTcpPort {
  param(
    [Parameter(Mandatory = $true)][string]$HostName,
    [Parameter(Mandatory = $true)][int]$Port,
    [int]$TimeoutMilliseconds = 1000
  )
  $client = New-Object Net.Sockets.TcpClient
  try {
    $result = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $result.AsyncWaitHandle.WaitOne($TimeoutMilliseconds)) { return $false }
    $client.EndConnect($result)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Save-DevState {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)]$State
  )
  $directory = Split-Path -Parent $Path
  if (-not (Test-Path -LiteralPath $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }
  $State | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-DevState {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  try { return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json } catch { return $null }
}

function Remove-DevRuntimeArtifacts {
  param(
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string]$Directory
  )
  $root = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
  $target = [IO.Path]::GetFullPath($Directory).TrimEnd([IO.Path]::DirectorySeparatorChar)
  if ($target -ne (Join-Path $root ".dev-runtime")) { throw "Refusing to clean an unexpected runtime directory." }
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
}

Export-ModuleMember -Function @(
  "Protect-SensitiveText", "Write-DevCheck", "Get-DevProjectRoot", "Get-DevStatePaths",
  "Read-DevEnvFile", "Test-DevCoreConfiguration", "Test-DevPlaidConfiguration",
  "Get-DevCommand", "Invoke-DevNativeCommand", "Get-DevProcessSnapshot", "Test-DevProjectNextProcess",
  "Get-DevNextProcessRoot", "Get-DevListeningProcessId", "Test-DevTcpPort",
  "Save-DevState", "Read-DevState", "Remove-DevRuntimeArtifacts"
)
