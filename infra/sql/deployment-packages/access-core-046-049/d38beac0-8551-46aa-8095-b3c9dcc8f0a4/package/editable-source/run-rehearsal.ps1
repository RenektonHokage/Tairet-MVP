param(
  [Parameter(Mandatory = $true)][string]$PackageRoot,
  [Parameter(Mandatory = $true)][string]$ExecutionRoot,
  [ValidateSet('Development','Final')][string]$Mode = 'Development',
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9]{3,12}$')][string]$RunId,
  [string]$RepositoryRoot = 'C:\Importante\Python\tairet-mono-2'
)

$ErrorActionPreference = 'Stop'
$expectedPackageRoot = 'C:\Users\mateo\AppData\Local\Tairet\access-core-046-049-deployment-package-v2-fac55618'
$expectedPackageId = 'd38beac0-8551-46aa-8095-b3c9dcc8f0a4'
$resolvedPackageRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
$resolvedExecutionRoot = (Resolve-Path -LiteralPath $ExecutionRoot).Path
if (-not $resolvedPackageRoot.Equals($expectedPackageRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'PACKAGE_ROOT_MISMATCH' }
if ($Mode -eq 'Development' -and -not $resolvedExecutionRoot.Equals($resolvedPackageRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'DEVELOPMENT_EXECUTION_ROOT_MISMATCH' }
$expectedFrozenRoot = Join-Path $resolvedPackageRoot 'frozen-package\package'
if ($Mode -eq 'Final' -and -not $resolvedExecutionRoot.Equals($expectedFrozenRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw 'FINAL_EXECUTION_ROOT_NOT_FROZEN_PACKAGE' }
$bootstrap = Get-Content -Raw -LiteralPath (Join-Path $resolvedExecutionRoot 'manifests\draft-bootstrap.json') | ConvertFrom-Json
$packageId = [string]$bootstrap.package_id
if ($packageId -ne $expectedPackageId) { throw 'PACKAGE_ID_MISMATCH' }

$labelPackage = "tairet.access.package.v2.id=$packageId"
$labelRun = "tairet.access.package.v2.run=$RunId"
$networkName = "acv2_fac55618_net_$RunId"
$postgresName = "acv2_fac55618_pg_$RunId"
$clientName = "acv2_fac55618_client_$RunId"
$postgresImage = 'public.ecr.aws/supabase/postgres:17.6.1.143'
$postgresImageId = 'sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453'
$clientImage = 'mcr.microsoft.com/devcontainers/javascript-node:22'
$clientImageId = 'sha256:25a1f18c8f075b597b309c6fc7c09657353fd353b6bf912b48158b2af72b2b9c'

if ($Mode -eq 'Final') {
  $evidenceDir = Join-Path $resolvedPackageRoot 'final-rehearsal-evidence\run'
  $inventoryDir = Join-Path $resolvedPackageRoot 'docker-inventories\final'
  $processDir = Join-Path $resolvedPackageRoot 'process-inventories\final'
  $markerPath = Join-Path $resolvedPackageRoot 'final-rehearsal-evidence\final-execution-authority.json'
  if (Test-Path -LiteralPath $markerPath) { throw 'FINAL_REHEARSAL_RERUN_PROHIBITED' }
  if (Test-Path -LiteralPath $evidenceDir) { throw 'FINAL_REHEARSAL_EVIDENCE_ALREADY_EXISTS' }
  $freezeManifestPath = Join-Path $resolvedPackageRoot 'frozen-package\frozen-package-manifest-v2.json'
  if (-not (Test-Path -LiteralPath $freezeManifestPath)) { throw 'FROZEN_PACKAGE_MANIFEST_MISSING' }
  $freezeManifest = Get-Content -Raw -LiteralPath $freezeManifestPath | ConvertFrom-Json
  [ordered]@{
    schema = 'ACCESS_CORE_FINAL_REHEARSAL_SINGLE_EXECUTION_AUTHORITY_V2'
    package_id = $packageId
    frozen_package_sha256 = [string]$freezeManifest.frozen_access_core_046_049_deployment_package_v2_sha256
    execution_utc = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
    run_id = $RunId
    final_rehearsal_execution_count = 1
    final_rehearsal_rerun_count = 0
    write_count = 1
    production_contact = 0
  } | ConvertTo-Json -Depth 6 -Compress | Set-Content -LiteralPath $markerPath -Encoding utf8NoBOM -NoNewline
} else {
  $evidenceDir = Join-Path $resolvedPackageRoot "development-evidence\runs\$RunId"
  $inventoryDir = Join-Path $resolvedPackageRoot "docker-inventories\development\$RunId"
  $processDir = Join-Path $resolvedPackageRoot "process-inventories\development\$RunId"
  if (Test-Path -LiteralPath $evidenceDir) { throw 'DEVELOPMENT_REHEARSAL_EVIDENCE_ALREADY_EXISTS' }
}
New-Item -ItemType Directory -Force -Path $evidenceDir,$inventoryDir,$processDir | Out-Null

function Get-ScopedProcesses {
  $needle = [regex]::Escape($packageId)
  return @(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and [string]$_.CommandLine -match $needle } | Sort-Object ProcessId | ForEach-Object {
    [ordered]@{ process_id = [int]$_.ProcessId; parent_process_id = [int]$_.ParentProcessId; name = [string]$_.Name; creation_date = [string]$_.CreationDate }
  })
}
function Get-RepositoryState {
  $migrationRoot = Join-Path $RepositoryRoot 'infra\sql\migrations'
  $hashes = @()
  foreach ($name in @('046_access_core_recoverable_fulfillment.sql','047_access_email_preclaim_terminal_failure.sql','048_access_email_preclaim_terminal_after_ambiguous.sql','049_access_email_delivery_claim_correlation.sql')) {
    $file = Join-Path $migrationRoot $name
    $hashes += [ordered]@{ name = $name; size = (Get-Item -LiteralPath $file).Length; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $file).Hash.ToLowerInvariant() }
  }
  $head = (& git -C $RepositoryRoot rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'REPOSITORY_HEAD_READ_FAILED' }
  $branch = (& git -C $RepositoryRoot branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0) { throw 'REPOSITORY_BRANCH_READ_FAILED' }
  $status = @(& git -C $RepositoryRoot status --porcelain=v1 --untracked-files=all)
  if ($LASTEXITCODE -ne 0) { throw 'REPOSITORY_STATUS_READ_FAILED' }
  $staging = @(& git -C $RepositoryRoot diff --cached --name-status)
  if ($LASTEXITCODE -ne 0) { throw 'REPOSITORY_STAGING_READ_FAILED' }
  return [ordered]@{ head = $head; branch = $branch; status = $status; staging = $staging; migrations = $hashes }
}
function Get-DockerInventory([string]$phase) {
  $directory = Join-Path $inventoryDir $phase
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  $containers = @(& docker ps -a --filter "label=tairet.access.package.v2.id=$packageId" --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Networks}}')
  $networks = @(& docker network ls --filter "label=tairet.access.package.v2.id=$packageId" --format '{{.ID}}|{{.Name}}|{{.Driver}}|{{.Scope}}')
  $volumes = @(& docker volume ls --filter "label=tairet.access.package.v2.id=$packageId" --format '{{.Name}}|{{.Driver}}')
  $inventory = [ordered]@{ schema = 'ACCESS_CORE_PACKAGE_V2_DOCKER_INVENTORY'; phase = $phase; captured_utc = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ'); package_id = $packageId; containers = $containers; networks = $networks; volumes = $volumes; container_count = $containers.Count; network_count = $networks.Count; volume_count = $volumes.Count }
  $inventory | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $directory 'inventory.json') -Encoding utf8NoBOM
  return $inventory
}
function Assert-OwnedContainer([string]$name) {
  $actualPackage = (& docker inspect --format '{{ index .Config.Labels "tairet.access.package.v2.id" }}' $name 2>$null).Trim()
  $actualRun = (& docker inspect --format '{{ index .Config.Labels "tairet.access.package.v2.run" }}' $name 2>$null).Trim()
  if ($LASTEXITCODE -ne 0 -or $actualPackage -ne $packageId -or $actualRun -ne $RunId) { throw "REFUSING_TO_REMOVE_UNOWNED_CONTAINER $name" }
}
function Assert-OwnedNetwork([string]$name) {
  $actualPackage = (& docker network inspect --format '{{ index .Labels "tairet.access.package.v2.id" }}' $name 2>$null).Trim()
  $actualRun = (& docker network inspect --format '{{ index .Labels "tairet.access.package.v2.run" }}' $name 2>$null).Trim()
  if ($LASTEXITCODE -ne 0 -or $actualPackage -ne $packageId -or $actualRun -ne $RunId) { throw "REFUSING_TO_REMOVE_UNOWNED_NETWORK $name" }
}

$repositoryBefore = Get-RepositoryState
$processBefore = Get-ScopedProcesses
$processBefore | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $processDir 'processes-before.json') -Encoding utf8NoBOM
$dockerBefore = Get-DockerInventory 'pre'
$result = [ordered]@{
  schema = 'ACCESS_CORE_PACKAGE_V2_DOCKER_ORCHESTRATION_RESULT'
  package_id = $packageId
  mode = $Mode
  run_id = $RunId
  execution_root = $resolvedExecutionRoot
  network_internal = $false
  published_port_count = -1
  package_mount_read_only = $true
  postgres_image = $postgresImage
  postgres_image_id = ''
  client_image = $clientImage
  client_image_id = ''
  postgres_version = ''
  postgres_material_pid = 0
  suite_exit_code = -1
  suite_result_sha256 = ''
  scenario_count = -1
  pass_count = -1
  fail_count = -1
  runtime_stage_verifier_pass_count = -1
  open_postgres_session_count = -1
  production_contact = 0
  external_network_contact = 0
  pull_performed = 0
  repository_write_count = -1
  migration_file_change_count = -1
  surviving_process_count = -1
  cleanup = [ordered]@{ removed_containers = @(); removed_networks = @(); errors = @(); residual_container_count = -1; residual_network_count = -1; residual_volume_count = -1; residual_resource_count = -1 }
  error = $null
}

try {
  $result.postgres_image_id = (& docker image inspect --format '{{.Id}}' $postgresImage).Trim()
  if ($LASTEXITCODE -ne 0 -or $result.postgres_image_id -ne $postgresImageId) { throw 'POSTGRES_IMAGE_IDENTITY_MISMATCH_OR_MISSING' }
  $result.client_image_id = (& docker image inspect --format '{{.Id}}' $clientImage).Trim()
  if ($LASTEXITCODE -ne 0 -or $result.client_image_id -ne $clientImageId) { throw 'CLIENT_IMAGE_IDENTITY_MISMATCH_OR_MISSING' }
  & docker network create --internal --label $labelPackage --label $labelRun $networkName | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'INTERNAL_NETWORK_CREATE_FAILED' }
  $networkInspect = & docker network inspect $networkName | ConvertFrom-Json
  $result.network_internal = [bool]$networkInspect[0].Internal
  if (-not $result.network_internal) { throw 'NETWORK_NOT_INTERNAL' }

  $packageMount = "type=bind,source=$resolvedExecutionRoot,target=/package,readonly"
  $postgresArgs = @(
    'run','-d','--pull=never','--name',$postgresName,'--network',$networkName,'--network-alias','pg','--restart','no',
    '--cpus','2','--memory','3g','--pids-limit','512','--tmpfs','/var/lib/postgresql/data:rw,nosuid,size=2147483648',
    '--label',$labelPackage,'--label',$labelRun,'--mount',$packageMount,
    '-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_PASSWORD=NON_DEPLOYABLE_LOCAL_ONLY','-e','POSTGRES_USER=supabase_admin','-e','POSTGRES_DB=postgres',
    $postgresImage
  )
  & docker @postgresArgs | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'POSTGRES_CONTAINER_START_FAILED' }
  $postgresInspect = & docker inspect $postgresName | ConvertFrom-Json
  $result.postgres_material_pid = [int]$postgresInspect[0].State.Pid
  $portBindings = $postgresInspect[0].HostConfig.PortBindings
  $result.published_port_count = if ($null -eq $portBindings) { 0 } else { @($portBindings.PSObject.Properties).Count }
  if ($result.published_port_count -ne 0) { throw 'POSTGRES_PORT_PUBLISHED' }

  $stableStart = ''
  $stableCount = 0
  for ($index = 0; $index -lt 150; $index += 1) {
    $observed = & docker exec $postgresName psql -X -q -A -t -U supabase_admin -d postgres -c 'select pg_postmaster_start_time()::text;' 2>$null
    if ($LASTEXITCODE -eq 0 -and $observed.Trim()) {
      if ($observed.Trim() -eq $stableStart) { $stableCount += 1 } else { $stableStart = $observed.Trim(); $stableCount = 1 }
    } else { $stableStart = ''; $stableCount = 0 }
    if ($stableCount -ge 12) { break }
    Start-Sleep -Milliseconds 500
  }
  if ($stableCount -lt 12) { throw 'POSTGRES_STABILITY_TIMEOUT' }
  $result.postgres_version = (& docker exec $postgresName psql -X -q -A -t -U supabase_admin -d postgres -c 'show server_version;').Trim()
  if ($result.postgres_version -notlike '17.6*') { throw "POSTGRES_VERSION_MISMATCH $($result.postgres_version)" }

  & docker exec $postgresName createdb -U supabase_admin template_access_core_v2
  if ($LASTEXITCODE -ne 0) { throw 'TEMPLATE_DATABASE_CREATE_FAILED' }
  $orderPath = Join-Path $resolvedExecutionRoot 'development-rehearsal\fixtures\approved-predecessor\apply-order.txt'
  $fixtureOrder = @(Get-Content -LiteralPath $orderPath | Where-Object { $_.Trim() })
  if ($fixtureOrder.Count -ne 5) { throw 'PREDECESSOR_APPLY_ORDER_COUNT_MISMATCH' }
  foreach ($fixture in $fixtureOrder) {
    if ($fixture -notmatch '^[0-9a-z_]+\.sql$') { throw "UNSAFE_FIXTURE_NAME $fixture" }
    & docker exec $postgresName psql -X -U supabase_admin -d template_access_core_v2 -v ON_ERROR_STOP=1 -f "/package/development-rehearsal/fixtures/approved-predecessor/$fixture" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "PREDECESSOR_FIXTURE_FAILED $fixture" }
  }
  & docker exec $postgresName psql -X -U supabase_admin -d template_access_core_v2 -v ON_ERROR_STOP=1 -f '/package/development-rehearsal/fixtures/ledger-fixture.sql' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'LEDGER_FIXTURE_FAILED' }
  & docker exec $postgresName psql -X -U supabase_admin -d template_access_core_v2 -v ON_ERROR_STOP=1 -c 'ALTER DATABASE template_access_core_v2 IS_TEMPLATE true;' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'TEMPLATE_DATABASE_FREEZE_FAILED' }

  $evidenceMount = "type=bind,source=$evidenceDir,target=/evidence"
  $clientArgs = @(
    'run','--pull=never','--read-only','--tmpfs','/tmp:rw,nosuid,size=67108864','--name',$clientName,'--network',$networkName,
    '--cpus','2','--memory','2g','--pids-limit','256','--label',$labelPackage,'--label',$labelRun,
    '--mount',$packageMount,'--mount',$evidenceMount,
    '-e','EXECUTION_ROOT=/package','-e','EVIDENCE_DIR=/evidence','-e','TEMPLATE_DATABASE=template_access_core_v2',
    '-e',"PASS_ID=$RunId",'-e',"REHEARSAL_MODE=$Mode",'-e','PGHOST=pg','-e','PGPORT=5432','-e','PGUSER=supabase_admin','-e','PGPASSWORD=NON_DEPLOYABLE_LOCAL_ONLY',
    $clientImage,'node','/package/editable-source/rehearsal-suite.js'
  )
  $stdoutPath = Join-Path $evidenceDir 'suite.stdout.txt'
  $stderrPath = Join-Path $evidenceDir 'suite.stderr.txt'
  & docker @clientArgs 1> $stdoutPath 2> $stderrPath
  $result.suite_exit_code = $LASTEXITCODE
  $resultName = if ($Mode -eq 'Development') { 'development-rehearsal-result-v2.json' } else { 'final-rehearsal-result-v2.json' }
  $identityField = if ($Mode -eq 'Development') { 'package_v2_development_rehearsal_result_sha256' } else { 'package_v2_final_rehearsal_result_sha256' }
  $suiteResultPath = Join-Path $evidenceDir $resultName
  if (Test-Path -LiteralPath $suiteResultPath) {
    $suiteResult = Get-Content -Raw -LiteralPath $suiteResultPath | ConvertFrom-Json
    $result.suite_result_sha256 = [string]$suiteResult.$identityField
    $result.scenario_count = [int]$suiteResult.scenario_count
    $result.pass_count = [int]$suiteResult.pass_count
    $result.fail_count = [int]$suiteResult.fail_count
    $result.runtime_stage_verifier_pass_count = [int]$suiteResult.runtime_stage_verifier_pass_count
    $result.open_postgres_session_count = [int]$suiteResult.open_postgres_session_count
  }
  if ($result.suite_exit_code -ne 0) { throw "REHEARSAL_SUITE_FAILED $($result.suite_exit_code)" }
}
catch {
  $result.error = [ordered]@{ message = $_.Exception.Message; type = $_.Exception.GetType().FullName; script_stack = $_.ScriptStackTrace }
}
finally {
  $existingClient = @(& docker ps -a --filter "name=^/$clientName$" --format '{{.Names}}')
  if ($existingClient -contains $clientName) {
    try { Assert-OwnedContainer $clientName; & docker rm -f $clientName | Out-Null; $result.cleanup.removed_containers += $clientName } catch { $result.cleanup.errors += $_.Exception.Message }
  }
  $existingPostgres = @(& docker ps -a --filter "name=^/$postgresName$" --format '{{.Names}}')
  if ($existingPostgres -contains $postgresName) {
    try { Assert-OwnedContainer $postgresName; & docker rm -f $postgresName | Out-Null; $result.cleanup.removed_containers += $postgresName } catch { $result.cleanup.errors += $_.Exception.Message }
  }
  $existingNetwork = @(& docker network ls --filter "name=^$networkName$" --format '{{.Name}}')
  if ($existingNetwork -contains $networkName) {
    try { Assert-OwnedNetwork $networkName; & docker network rm $networkName | Out-Null; $result.cleanup.removed_networks += $networkName } catch { $result.cleanup.errors += $_.Exception.Message }
  }
  $result.cleanup.residual_container_count = @(& docker ps -a --filter "label=tairet.access.package.v2.run=$RunId" --format '{{.ID}}').Count
  $result.cleanup.residual_network_count = @(& docker network ls --filter "label=tairet.access.package.v2.run=$RunId" --format '{{.ID}}').Count
  $result.cleanup.residual_volume_count = @(& docker volume ls --filter "label=tairet.access.package.v2.run=$RunId" --format '{{.Name}}').Count
  $result.cleanup.residual_resource_count = $result.cleanup.residual_container_count + $result.cleanup.residual_network_count + $result.cleanup.residual_volume_count
  $repositoryAfter = Get-RepositoryState
  $result.repository_write_count = if (($repositoryBefore | ConvertTo-Json -Depth 8 -Compress) -ceq ($repositoryAfter | ConvertTo-Json -Depth 8 -Compress)) { 0 } else { 1 }
  $result.migration_file_change_count = 0
  foreach ($afterMigration in $repositoryAfter.migrations) {
    $beforeMigration = @($repositoryBefore.migrations | Where-Object { $_.name -eq $afterMigration.name })
    if ($beforeMigration.Count -ne 1 -or $beforeMigration[0].size -ne $afterMigration.size -or $beforeMigration[0].sha256 -ne $afterMigration.sha256) { $result.migration_file_change_count += 1 }
  }
  $processAfter = Get-ScopedProcesses
  $processAfter | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $processDir 'processes-after.json') -Encoding utf8NoBOM
  $result.surviving_process_count = $processAfter.Count
  $dockerAfter = Get-DockerInventory 'post'
  [ordered]@{ schema = 'ACCESS_CORE_PACKAGE_V2_DOCKER_INVENTORY_COMPARISON'; before = $dockerBefore; after = $dockerAfter; run_residual_resource_count = $result.cleanup.residual_resource_count } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $inventoryDir 'comparison.json') -Encoding utf8NoBOM
  [ordered]@{ schema = 'ACCESS_CORE_PACKAGE_V2_REPOSITORY_READ_ONLY_EVIDENCE'; before = $repositoryBefore; after = $repositoryAfter; repository_write_count = $result.repository_write_count; migration_file_change_count = $result.migration_file_change_count } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $processDir 'repository-evidence.json') -Encoding utf8NoBOM
  $result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $evidenceDir 'orchestration-result.json') -Encoding utf8NoBOM
}

if ($null -ne $result.error) { throw $result.error.message }
$expectedScenarioCount = if ($Mode -eq 'Development') { 19 } else { 12 }
if ($result.scenario_count -ne $expectedScenarioCount -or $result.pass_count -ne $expectedScenarioCount -or $result.fail_count -ne 0 -or $result.runtime_stage_verifier_pass_count -lt 1) { throw 'REHEARSAL_RESULT_NOT_GREEN' }
if ($result.open_postgres_session_count -ne 0) { throw 'OPEN_POSTGRES_SESSIONS_REMAIN' }
if ($result.cleanup.errors.Count -ne 0 -or $result.cleanup.residual_resource_count -ne 0) { throw 'DOCKER_CLEANUP_NOT_EXACT' }
if ($result.surviving_process_count -ne 0) { throw 'PACKAGE_PROCESS_CLEANUP_NOT_EXACT' }
if ($result.repository_write_count -ne 0 -or $result.migration_file_change_count -ne 0) { throw 'REPOSITORY_STATE_CHANGED' }
if ($result.production_contact -ne 0 -or $result.external_network_contact -ne 0 -or $result.pull_performed -ne 0) { throw 'ISOLATION_CONTRACT_VIOLATED' }
