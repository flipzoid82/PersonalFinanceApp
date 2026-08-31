[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
Import-Module (Join-Path $PSScriptRoot "dev-workflow.psm1") -Force

function Stop-VerifiedNextTree {
  param(
    [int]$RootPid,
    [string]$ExpectedStartTimeUtc,
    [string]$ProjectRoot
  )

  $rootInfo = Get-DevProcessSnapshot -ProcessId $RootPid
  if ($null -eq $rootInfo) { return $false }
  if (-not (Test-DevProjectNextProcess -ProcessInfo $rootInfo -ProjectRoot $ProjectRoot)) {
    throw "Refusing to stop PID $RootPid because it is not the Personal Finance App Next.js server."
  }
  $rootProcess = Get-Process -Id $RootPid -ErrorAction SilentlyContinue
  if ($ExpectedStartTimeUtc -and $rootProcess) {
    $actual = $rootProcess.StartTime.ToUniversalTime()
    $expected = [DateTime]::Parse($ExpectedStartTimeUtc).ToUniversalTime()
    if ([Math]::Abs(($actual - $expected).TotalSeconds) -gt 1) {
      throw "Refusing to stop PID $RootPid because its start time does not match the saved state."
    }
  }

  $all = @(Get-CimInstance Win32_Process -ErrorAction Stop)
  $ordered = New-Object System.Collections.Generic.List[int]
  $queue = New-Object System.Collections.Generic.Queue[int]
  $queue.Enqueue($RootPid)
  while ($queue.Count -gt 0) {
    $current = $queue.Dequeue()
    $ordered.Add($current)
    foreach ($child in $all | Where-Object { [int]$_.ParentProcessId -eq $current }) {
      if ($child.Name -match '^node(?:\.exe)?$') { $queue.Enqueue([int]$child.ProcessId) }
    }
  }
  $ids = @($ordered)
  [array]::Reverse($ids)
  foreach ($processId in $ids) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -eq "node") { Stop-Process -Id $processId -Force }
  }
  return $true
}

try {
  $projectRoot = Get-DevProjectRoot -ScriptRoot $PSScriptRoot
  Set-Location -LiteralPath $projectRoot
  $paths = Get-DevStatePaths -ProjectRoot $projectRoot
  $state = Read-DevState -Path $paths.State
  $stoppedNext = $false

  if ($state -and $state.ProjectRoot -eq $projectRoot -and $state.NextPid) {
    $stoppedNext = Stop-VerifiedNextTree -RootPid ([int]$state.NextPid) -ExpectedStartTimeUtc ([string]$state.NextStartTimeUtc) -ProjectRoot $projectRoot
  }

  if (-not $stoppedNext) {
    $listenerPid = Get-DevListeningProcessId -Port 3000
    if ($listenerPid) {
      $rootInfo = Get-DevNextProcessRoot -ProcessId $listenerPid -ProjectRoot $projectRoot
      if ($rootInfo) {
        $stoppedNext = Stop-VerifiedNextTree -RootPid ([int]$rootInfo.ProcessId) -ExpectedStartTimeUtc "" -ProjectRoot $projectRoot
      } else {
        Write-DevCheck WARN "Next.js" "Port 3000 is owned by another process; it was not stopped."
      }
    }
  }

  if ($stoppedNext) { Write-DevCheck PASS "Next.js" "Stopped only the verified Personal Finance App process tree." }
  else { Write-DevCheck WARN "Next.js" "No running Personal Finance App server was found." }

  if ($state -and $state.NgrokStartedByWorkflow -eq $true -and $state.NgrokPid) {
    $ngrok = Get-Process -Id ([int]$state.NgrokPid) -ErrorAction SilentlyContinue
    if (Test-DevSavedProcessOwnership -Process $ngrok -ExpectedProcessId ([int]$state.NgrokPid) -ExpectedProcessName "ngrok" -ExpectedStartTimeUtc ([string]$state.NgrokStartTimeUtc)) {
      Stop-Process -Id $ngrok.Id -Force
      Write-DevCheck PASS "ngrok" "Stopped the ngrok process started by this workflow."
    } elseif ($ngrok) {
      Write-DevCheck WARN "ngrok" "Saved PID ownership could not be proven; ngrok was not stopped."
    }
  } elseif (Get-Process -Name "ngrok" -ErrorAction SilentlyContinue) {
    Write-DevCheck WARN "ngrok" "An externally started ngrok process is running and was left untouched."
  }

  try {
    Remove-DevRuntimeArtifacts -ProjectRoot $projectRoot -Directory $paths.Directory
    Write-DevCheck PASS "Cleanup" "Removed workflow PID, state, and temporary log files while preserving the local import key and retained encrypted sources."
  } catch {
    Remove-Item -LiteralPath $paths.State, $paths.NextStdout, $paths.NextStderr -Force -ErrorAction SilentlyContinue
    Write-DevCheck WARN "Cleanup" "An ignored runtime log is still in use by an external process. State and available logs were removed; stop that process and rerun pnpm dev:stop to remove the remainder."
  }
  Write-DevCheck PASS "PostgreSQL" "Left PostgreSQL running by design."
  Write-DevCheck PASS "Docker" "Left Docker Desktop and its engine running by design."
} catch {
  Write-DevCheck FAIL "Stop" $_.Exception.Message
  exit 1
}
