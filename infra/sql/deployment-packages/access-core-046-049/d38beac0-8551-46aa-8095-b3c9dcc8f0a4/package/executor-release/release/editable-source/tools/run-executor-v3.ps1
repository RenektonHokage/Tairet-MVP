param(
  [Parameter(Mandatory)][ValidateSet('Development','Final')][string]$Mode,
  [Parameter(Mandatory)][string]$ExecutorRoot,
  [Parameter(Mandatory)][string]$RepositoryRoot,
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9][a-z0-9-]{2,31}$')][string]$RunId,
  [int]$ExecutionAttempt = 1
)

$ErrorActionPreference = 'Stop'
$codeRoot = if ($Mode -eq 'Final') { Join-Path $ExecutorRoot 'frozen-release\release' } else { $ExecutorRoot }
$sourceRoot = Join-Path $codeRoot 'editable-source'
. (Join-Path $sourceRoot 'tools\suite-wrapper-v3.ps1')
$releaseManifestPath = if ($Mode -eq 'Final') { Join-Path $codeRoot 'frozen-release-manifest.json' } else { Join-Path $ExecutorRoot 'development-evidence\development-release-manifest.json' }
$releaseIdentity = (Get-Content -Raw -LiteralPath $releaseManifestPath | ConvertFrom-Json).releaseSha256
$environmentContractPath = if ($Mode -eq 'Final') { Join-Path $codeRoot 'manifests\final-environment-contract.json' } else { Join-Path $ExecutorRoot 'manifests\final-environment-contract.json' }
$environmentIdentity = (Get-Content -Raw -LiteralPath $environmentContractPath | ConvertFrom-Json).contractSha256
$runEvidenceRoot = if ($Mode -eq 'Final') { Join-Path $ExecutorRoot 'final-evidence' } else { Join-Path $ExecutorRoot "development-evidence\runs\$RunId" }
$coreEvidenceRoot = Join-Path $runEvidenceRoot 'core'
$finalOutputRoot = Join-Path $ExecutorRoot 'final-run\output'
$mutationRoot = Join-Path $finalOutputRoot 'mutation-workspaces'
$postgresRoot = Join-Path $finalOutputRoot 'postgres-work'
New-Item -ItemType Directory -Force -Path $runEvidenceRoot,$coreEvidenceRoot,$finalOutputRoot,$mutationRoot,$postgresRoot | Out-Null

$env:ROOT_EXECUTOR_ROOT = $ExecutorRoot
$env:FROZEN_RELEASE_ROOT = if ($Mode -eq 'Final') { $codeRoot } else { Join-Path $ExecutorRoot 'editable-source' }
$env:FINAL_OUTPUT_ROOT = $finalOutputRoot
$env:MUTATION_WORK_ROOT = $mutationRoot
$env:POSTGRES_WORK_ROOT = $postgresRoot
$env:TAIRET_REPO_ROOT = $RepositoryRoot
$env:V1_EXECUTOR_ROOT = 'C:\Users\mateo\AppData\Local\Tairet\statement-aware-atomic-migration-executor-v1-008a2f38'
$env:V2_EXECUTOR_ROOT = 'C:\Users\mateo\AppData\Local\Tairet\statement-aware-atomic-migration-executor-v2-b4aad405'
$env:RELEASE_MANIFEST = $releaseManifestPath
$env:TEST_MANIFEST = if ($Mode -eq 'Final') { Join-Path $codeRoot 'manifests\test-manifest.json' } else { Join-Path $ExecutorRoot 'manifests\development-test-manifest.json' }
$env:PRODUCTION_TEMPLATE = if ($Mode -eq 'Final') { Join-Path $codeRoot 'manifests\production-manifest-template.json' } else { Join-Path $ExecutorRoot 'manifests\production-manifest-template.json' }
$env:IDENTITY_MODEL = if ($Mode -eq 'Final') { Join-Path $codeRoot 'manifests\executor-v3-identity-model.json' } else { Join-Path $ExecutorRoot 'manifests\executor-v3-identity-model.json' }
$env:FINAL_EVIDENCE_ROOT = $runEvidenceRoot
$env:FINAL_RUN_ID = $RunId
$env:FINAL_EXECUTION_ATTEMPT = [string]$ExecutionAttempt
$env:FROZEN_RELEASE_READ_ONLY_REQUIRED = if ($Mode -eq 'Final') { '1' } else { '0' }

$globalGatePath = Join-Path $runEvidenceRoot 'global-gate-result.json'
if (Test-Path -LiteralPath $globalGatePath) { throw 'GLOBAL_GATE_RESULT_PREEXISTING' }
& node (Join-Path $sourceRoot 'tests\global-gate-suite-v3.js') `
  '--executor-root' $ExecutorRoot '--release-root' $codeRoot '--repository-root' $RepositoryRoot `
  '--release-id' $releaseIdentity '--mode' $Mode '--output' $globalGatePath
if ($LASTEXITCODE -ne 0) { throw 'V3_GLOBAL_GATE_FAILED_BEFORE_EXECUTION_MARKER' }

$markerPath = if ($Mode -eq 'Final') { Join-Path $ExecutorRoot 'final-run\final-execution-started.json' } else { Join-Path $runEvidenceRoot 'development-execution-started.json' }
if (Test-Path -LiteralPath $markerPath) { throw 'FROZEN_EXECUTION_RERUN_PROHIBITED' }
Write-AtomicReadOnlyJson -Path $markerPath -Value ([ordered]@{
  schema='tairet-executor-v3-execution-marker'; mode=$Mode; execution_count=1; rerun_count=0;
  final_run_id=$RunId; frozen_release_identity=$releaseIdentity; execution_attempt=$ExecutionAttempt
})

function New-V3WrapperFailureRecord([string]$SuiteId,[int]$StartSequence,[int]$EndSequence,[string]$Message) {
  $wrapperDirectory = Join-Path $ExecutorRoot "final-run\wrapper-evidence\$RunId"
  New-Item -ItemType Directory -Force -Path $wrapperDirectory | Out-Null
  $wrapperPath = Join-Path $wrapperDirectory "$SuiteId.wrapper-failure.json"
  $resultPath = Join-Path $ExecutorRoot "suite-results\$RunId\$SuiteId.result.json"
  $stdoutPath = Join-Path $ExecutorRoot "raw-stdout\$RunId\$SuiteId.stdout.log"
  $stderrPath = Join-Path $ExecutorRoot "raw-stderr\$RunId\$SuiteId.stderr.log"
  $resultExists = Test-Path -LiteralPath $resultPath -PathType Leaf
  $resultItem = if ($resultExists) { Get-Item -LiteralPath $resultPath } else { $null }
  $now = (Get-Date).ToUniversalTime().ToString('o')
  Write-AtomicReadOnlyJson -Path $wrapperPath -Value ([ordered]@{
    schema='EXECUTOR_SUITE_WRAPPER_EVIDENCE_V1'; suite_id=$SuiteId; final_run_id=$RunId;
    frozen_release_identity=$releaseIdentity; execution_attempt=$ExecutionAttempt;
    executable=(Get-Command node -ErrorAction SilentlyContinue).Source; argv=@(); cwd=$RepositoryRoot;
    environment_identity=$environmentIdentity; process_id=0; wrapper_start_time_utc=$now;
    process_start_time_utc=$now; process_end_time_utc=$now; process_exit_code=125;
    start_sequence=$StartSequence; end_sequence=$EndSequence;
    raw_stdout_path=$stdoutPath; raw_stdout_sha256=Get-Sha256Lower $stdoutPath;
    raw_stderr_path=$stderrPath; raw_stderr_sha256=Get-Sha256Lower $stderrPath;
    expected_result_file_path=$resultPath; result_path_absent_before_start=(-not $resultExists);
    result_file_exists=$resultExists; result_file_sha256=if($resultExists){Get-Sha256Lower $resultPath}else{$null};
    result_file_size=if($resultExists){$resultItem.Length}else{$null};
    result_file_last_write_time_utc=if($resultExists){$resultItem.LastWriteTimeUtc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")}else{$null};
    result_file_read_only=if($resultExists){$resultItem.IsReadOnly}else{$false};
    protocol_validation_exit_code=1; timeout_seconds=0; timed_out=$false; cancelled=$false;
    pass_synthesized=$false; wrapper_failure_classification='UNRESOLVED'; wrapper_error=$Message
  })
  return [pscustomobject]@{suite_id=$SuiteId;wrapper_path=$wrapperPath;result_path=$resultPath;process_exit_code=125;protocol_validation_exit_code=1;wrapper_error=$Message}
}

$phasePrefix = if ($Mode -eq 'Final') { 'final' } else { "development-$RunId" }
& (Join-Path $sourceRoot 'tools\capture-runtime-inventory-v3.ps1') -ExecutorRoot $ExecutorRoot -Phase "$phasePrefix-pre" | Out-Null
$env:DOCKER_PRE_INVENTORY = Join-Path $ExecutorRoot "docker-inventories\$phasePrefix-pre.json"
$runs = @()
$suitePlan = @(
  [ordered]@{id='STATIC';start=100;end=101;timeout=600},
  [ordered]@{id='PARSER';start=200;end=201;timeout=120},
  [ordered]@{id='RECOVERY';start=300;end=301;timeout=120},
  [ordered]@{id='ATOMICITY';start=400;end=401;timeout=1800},
  [ordered]@{id='SEMANTIC_MUTATION';start=500;end=501;timeout=900}
)
foreach ($suite in $suitePlan) {
  try {
    $runs += Invoke-V3Suite -SuiteId $suite.id -ExecutorRoot $ExecutorRoot -ReleaseRoot $codeRoot -RepositoryRoot $RepositoryRoot `
      -RunId $RunId -ExecutionAttempt $ExecutionAttempt -StartSequence $suite.start -EndSequence $suite.end `
      -ReleaseIdentity $releaseIdentity -EnvironmentIdentity $environmentIdentity -EvidenceRoot $coreEvidenceRoot -Mode $Mode -TimeoutSeconds $suite.timeout
  } catch {
    $runs += New-V3WrapperFailureRecord -SuiteId $suite.id -StartSequence $suite.start -EndSequence $suite.end -Message $_.Exception.Message
  }
}
& (Join-Path $sourceRoot 'tools\capture-runtime-inventory-v3.ps1') -ExecutorRoot $ExecutorRoot -Phase "$phasePrefix-post" | Out-Null
$env:DOCKER_POST_INVENTORY = Join-Path $ExecutorRoot "docker-inventories\$phasePrefix-post.json"
try {
  $runs += Invoke-V3Suite -SuiteId 'CLEANUP' -ExecutorRoot $ExecutorRoot -ReleaseRoot $codeRoot -RepositoryRoot $RepositoryRoot `
    -RunId $RunId -ExecutionAttempt $ExecutionAttempt -StartSequence 600 -EndSequence 601 `
    -ReleaseIdentity $releaseIdentity -EnvironmentIdentity $environmentIdentity -EvidenceRoot $coreEvidenceRoot -Mode $Mode -TimeoutSeconds 600
} catch {
  $runs += New-V3WrapperFailureRecord -SuiteId 'CLEANUP' -StartSequence 600 -EndSequence 601 -Message $_.Exception.Message
}

$wrapperPaths = @($runs | ForEach-Object { $_.wrapper_path })
if (@($wrapperPaths | Where-Object { -not $_ }).Count -ne 0) { throw 'SUITE_WRAPPER_EVIDENCE_MISSING' }
$wrapperManifestPath = Join-Path $ExecutorRoot "final-run\wrapper-evidence\$RunId\manifest.json"
Write-AtomicReadOnlyJson -Path $wrapperManifestPath -Value ([ordered]@{
  schema='EXECUTOR_SUITE_WRAPPER_EVIDENCE_MANIFEST_V1'; final_run_id=$RunId; frozen_release_identity=$releaseIdentity;
  execution_attempt=$ExecutionAttempt; wrapper_evidence_paths=$wrapperPaths;
  wrapper_evidence_hashes=@($wrapperPaths | ForEach-Object { (Get-FileHash -Algorithm SHA256 -LiteralPath $_).Hash.ToLowerInvariant() })
})

if ($Mode -eq 'Development') {
  $acceptancePath = Join-Path $runEvidenceRoot 'orchestration-acceptance-result.json'
  & node (Join-Path $sourceRoot 'tests\orchestration-acceptance-suite.js') `
    '--temporary-root' (Join-Path $ExecutorRoot "temporary\orchestration-acceptance-$RunId") `
    '--evidence-file' $acceptancePath '--release-id' $releaseIdentity
  if ($LASTEXITCODE -ne 0) { throw 'ORCHESTRATION_ACCEPTANCE_FAILED' }
  Copy-Item -LiteralPath $acceptancePath -Destination (Join-Path $ExecutorRoot 'development-evidence\orchestration-acceptance-result.json') -Force
  Copy-Item -LiteralPath $acceptancePath -Destination (Join-Path $ExecutorRoot 'manifests\development-orchestration-acceptance-result.json') -Force
}

$resultPaths = @($runs | ForEach-Object { $_.result_path })
$orchestrationPath = Join-Path $runEvidenceRoot 'orchestration-result.json'
& node (Join-Path $sourceRoot 'tools\finalize-evidence.js') `
  '--static-result' $resultPaths[0] '--parser-result' $resultPaths[1] '--recovery-result' $resultPaths[2] `
  '--atomicity-result' $resultPaths[3] '--semantic-mutation-result' $resultPaths[4] '--cleanup-result' $resultPaths[5] `
  '--wrapper-evidence-manifest' $wrapperManifestPath '--output' $orchestrationPath `
  '--executor-root' $ExecutorRoot '--release-root' $codeRoot '--repository-root' $RepositoryRoot `
  '--run-id' $RunId '--release-id' $releaseIdentity '--execution-attempt' ([string]$ExecutionAttempt) `
  '--mode' $Mode '--global-gate-result' $globalGatePath
$finalizerExitCode = $LASTEXITCODE

if ($Mode -eq 'Development' -and $finalizerExitCode -eq 0) {
  $acceptedPath = Join-Path $ExecutorRoot 'development-evidence\accepted-development-run.json'
  [ordered]@{
    schema='tairet-executor-v3-accepted-development-run'; run_id=$RunId; release_identity=$releaseIdentity;
    result_paths=$resultPaths; result_hashes=@($resultPaths | ForEach-Object { (Get-FileHash -Algorithm SHA256 -LiteralPath $_).Hash.ToLowerInvariant() });
    wrapper_manifest_path=$wrapperManifestPath; wrapper_manifest_sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $wrapperManifestPath).Hash.ToLowerInvariant();
    orchestration_result_path=$orchestrationPath; orchestration_result_sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $orchestrationPath).Hash.ToLowerInvariant();
    execution_count=1; rerun_count=0; production_contact=0
  } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $acceptedPath -Encoding utf8NoBOM
}
if ($finalizerExitCode -ne 0) { exit $finalizerExitCode }
exit 0
