Set-StrictMode -Version Latest

function Get-Sha256Lower([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Write-AtomicReadOnlyJson([string]$Path, [object]$Value) {
  if (Test-Path -LiteralPath $Path) { throw "ATOMIC_JSON_TARGET_PREEXISTING: $Path" }
  $parent = Split-Path -Parent $Path
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  $temporary = Join-Path $parent ('.' + [IO.Path]::GetFileName($Path) + '.' + $PID + '.' + [Guid]::NewGuid().ToString('N').Substring(0,12) + '.tmp')
  $Value | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $temporary -Encoding utf8NoBOM
  Move-Item -LiteralPath $temporary -Destination $Path
  (Get-Item -LiteralPath $Path).IsReadOnly = $true
}

function Invoke-V3Suite {
  param(
    [Parameter(Mandatory)][ValidateSet('STATIC','PARSER','RECOVERY','ATOMICITY','SEMANTIC_MUTATION','CLEANUP')][string]$SuiteId,
    [Parameter(Mandatory)][string]$ExecutorRoot,
    [Parameter(Mandatory)][string]$ReleaseRoot,
    [Parameter(Mandatory)][string]$RepositoryRoot,
    [Parameter(Mandatory)][string]$RunId,
    [Parameter(Mandatory)][int]$ExecutionAttempt,
    [Parameter(Mandatory)][int]$StartSequence,
    [Parameter(Mandatory)][int]$EndSequence,
    [Parameter(Mandatory)][string]$ReleaseIdentity,
    [Parameter(Mandatory)][string]$EnvironmentIdentity,
    [Parameter(Mandatory)][string]$EvidenceRoot,
    [Parameter(Mandatory)][ValidateSet('Development','Final')][string]$Mode,
    [Parameter(Mandatory)][int]$TimeoutSeconds
  )

  $node = (Get-Command node -ErrorAction Stop).Source
  $resultDirectory = Join-Path $ExecutorRoot "suite-results\$RunId"
  $stdoutDirectory = Join-Path $ExecutorRoot "raw-stdout\$RunId"
  $stderrDirectory = Join-Path $ExecutorRoot "raw-stderr\$RunId"
  $wrapperDirectory = Join-Path $ExecutorRoot "final-run\wrapper-evidence\$RunId"
  New-Item -ItemType Directory -Force -Path $resultDirectory,$stdoutDirectory,$stderrDirectory,$wrapperDirectory | Out-Null
  $resultPath = Join-Path $resultDirectory "$SuiteId.result.json"
  $stdoutPath = Join-Path $stdoutDirectory "$SuiteId.stdout.log"
  $stderrPath = Join-Path $stderrDirectory "$SuiteId.stderr.log"
  $wrapperPath = Join-Path $wrapperDirectory "$SuiteId.wrapper.json"
  $resultAbsent = -not (Test-Path -LiteralPath $resultPath)
  $logsAbsent = -not (Test-Path -LiteralPath $stdoutPath) -and -not (Test-Path -LiteralPath $stderrPath)
  if (-not $resultAbsent -or -not $logsAbsent -or (Test-Path -LiteralPath $wrapperPath)) {
    throw "SUITE_CHANNEL_PREEXISTING: $SuiteId"
  }

  $adapter = Join-Path $ReleaseRoot 'editable-source\tests\suite-adapter-v3.js'
  $arguments = @(
    $adapter,
    '--suite-id',$SuiteId,
    '--result-file',$resultPath,
    '--final-run-id',$RunId,
    '--release-id',$ReleaseIdentity,
    '--execution-attempt',[string]$ExecutionAttempt,
    '--start-sequence',[string]$StartSequence,
    '--end-sequence',[string]$EndSequence,
    '--raw-stdout-path',$stdoutPath,
    '--raw-stderr-path',$stderrPath,
    '--evidence-root',$EvidenceRoot,
    '--mode',$Mode
  )

  $wrapperStart = (Get-Date).ToUniversalTime()
  $process = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $RepositoryRoot -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -WindowStyle Hidden -PassThru
  $processId = $process.Id
  $processStart = $process.StartTime.ToUniversalTime()
  $completed = $process.WaitForExit($TimeoutSeconds * 1000)
  $timedOut = -not $completed
  $cancelled = $false
  if ($timedOut) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    $process.WaitForExit()
    $cancelled = $true
  }
  $processExitCode = if ($timedOut) { 124 } else { $process.ExitCode }
  $processEnd = (Get-Date).ToUniversalTime()
  $resultExists = Test-Path -LiteralPath $resultPath -PathType Leaf
  $resultItem = if ($resultExists) { Get-Item -LiteralPath $resultPath } else { $null }
  $protocolValidationExitCode = 1
  if ($resultExists) {
    & $node (Join-Path $ReleaseRoot 'editable-source\tools\validate-suite-result.js') `
      '--result-file' $resultPath '--suite-id' $SuiteId '--final-run-id' $RunId `
      '--release-id' $ReleaseIdentity '--execution-attempt' ([string]$ExecutionAttempt) `
      '--start-sequence' ([string]$StartSequence) '--end-sequence' ([string]$EndSequence) `
      '--process-exit-code' ([string]$processExitCode) *> $null
    $protocolValidationExitCode = $LASTEXITCODE
  }
  foreach ($logPath in @($stdoutPath,$stderrPath)) {
    if (Test-Path -LiteralPath $logPath -PathType Leaf) { (Get-Item -LiteralPath $logPath).IsReadOnly = $true }
  }
  $wrapper = [ordered]@{
    schema = 'EXECUTOR_SUITE_WRAPPER_EVIDENCE_V1'
    suite_id = $SuiteId
    final_run_id = $RunId
    frozen_release_identity = $ReleaseIdentity
    execution_attempt = $ExecutionAttempt
    executable = $node
    argv = @($arguments)
    cwd = $RepositoryRoot
    environment_identity = $EnvironmentIdentity
    process_id = $processId
    wrapper_start_time_utc = $wrapperStart.ToString('o')
    process_start_time_utc = $processStart.ToString('o')
    process_end_time_utc = $processEnd.ToString('o')
    process_exit_code = $processExitCode
    start_sequence = $StartSequence
    end_sequence = $EndSequence
    raw_stdout_path = $stdoutPath
    raw_stdout_sha256 = Get-Sha256Lower $stdoutPath
    raw_stderr_path = $stderrPath
    raw_stderr_sha256 = Get-Sha256Lower $stderrPath
    expected_result_file_path = $resultPath
    result_path_absent_before_start = $resultAbsent
    result_file_exists = $resultExists
    result_file_sha256 = if ($resultExists) { Get-Sha256Lower $resultPath } else { $null }
    result_file_size = if ($resultExists) { $resultItem.Length } else { $null }
    result_file_last_write_time_utc = if ($resultExists) { $resultItem.LastWriteTimeUtc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'") } else { $null }
    result_file_read_only = if ($resultExists) { $resultItem.IsReadOnly } else { $false }
    protocol_validation_exit_code = $protocolValidationExitCode
    timeout_seconds = $TimeoutSeconds
    timed_out = $timedOut
    cancelled = $cancelled
    pass_synthesized = $false
  }
  Write-AtomicReadOnlyJson -Path $wrapperPath -Value $wrapper
  return [pscustomobject]@{ suite_id=$SuiteId; wrapper_path=$wrapperPath; result_path=$resultPath; process_exit_code=$processExitCode; protocol_validation_exit_code=$protocolValidationExitCode }
}
