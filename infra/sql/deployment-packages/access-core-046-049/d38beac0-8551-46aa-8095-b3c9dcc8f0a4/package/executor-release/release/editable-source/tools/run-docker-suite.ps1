param(
  [ValidateSet('Development','Final')][string]$Mode = 'Development',
  [string]$ExecutorRoot = 'C:\Users\mateo\AppData\Local\Tairet\statement-aware-atomic-migration-executor-v2-b4aad405',
  [string]$RepositoryRoot = 'C:\Importante\Python\tairet-mono-2',
  [string]$PassId = 'dev001'
)

$ErrorActionPreference = 'Stop'
if ($PassId -notmatch '^[a-z0-9]{3,12}$') { throw 'PassId must be 3-12 lowercase alphanumeric characters' }
$label = "tairet.atomic.executor.v2.pass=$PassId"
$network = "tairet_v2_net_$PassId"
$postgres = "tairet_v2_pg_$PassId"
$client = "tairet_v2_client_$PassId"
$postgresImage = 'public.ecr.aws/supabase/postgres:17.6.1.143'
$clientImage = 'mcr.microsoft.com/devcontainers/javascript-node:22'
$dockerEvidenceDir = Join-Path $ExecutorRoot $(if ($Mode -eq 'Final') { 'final-evidence\docker' } else { 'development-evidence\docker' })
$suiteEvidenceDir = Join-Path $ExecutorRoot $(if ($Mode -eq 'Final') { 'final-evidence\integration' } else { 'development-evidence\integration' })
New-Item -ItemType Directory -Force -Path $dockerEvidenceDir,$suiteEvidenceDir | Out-Null

function Assert-OwnedContainer([string]$name) {
  $actual = docker inspect --format '{{ index .Config.Labels "tairet.atomic.executor.v2.pass" }}' $name 2>$null
  if ($LASTEXITCODE -ne 0 -or $actual -ne $PassId) { throw "refusing to remove unowned container $name" }
}

$result = [ordered]@{
  schema = 'tairet-docker-suite-orchestration-v2'
  mode = $Mode
  pass_id = $PassId
  network_internal = $true
  executor_mount_read_only = $true
  postgres_image = $postgresImage
  postgres_image_id = ''
  client_image = $clientImage
  client_image_id = ''
  postgres_version = ''
  external_network_contact = 0
  pull_performed = 0
  cleanup = [ordered]@{ removed_containers = @(); removed_networks = @(); errors = @(); residual_container_count = -1; residual_network_count = -1; residual_volume_count = -1; residual_resource_count = -1 }
  suite_exit_code = -1
}

try {
  $result.postgres_image_id = docker image inspect --format '{{.Id}}' $postgresImage
  if ($LASTEXITCODE -ne 0 -or $result.postgres_image_id -ne 'sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453') { throw 'required PostgreSQL image identity mismatch' }
  $result.client_image_id = docker image inspect --format '{{.Id}}' $clientImage
  if ($LASTEXITCODE -ne 0 -or $result.client_image_id -ne 'sha256:25a1f18c8f075b597b309c6fc7c09657353fd353b6bf912b48158b2af72b2b9c') { throw 'required Node client image identity mismatch' }
  docker network create --internal --label $label $network | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'failed to create internal network' }
  $pgMount = "type=bind,source=$ExecutorRoot,target=/executor,readonly"
  docker run -d --pull=never --name $postgres --network $network --network-alias pg --restart no --cpus 2 --memory 3g --pids-limit 512 --tmpfs /var/lib/postgresql/data:rw,nosuid,size=2147483648 --label $label --mount $pgMount -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_PASSWORD=NON_DEPLOYABLE_LOCAL_ONLY -e POSTGRES_USER=supabase_admin -e POSTGRES_DB=postgres $postgresImage | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'failed to start PostgreSQL container' }
  $stableStart = ''
  $stableCount = 0
  for ($i = 0; $i -lt 150; $i += 1) {
    $observed = docker exec $postgres psql -X -q -A -t -U supabase_admin -d postgres -c 'select pg_postmaster_start_time()::text;' 2>$null
    if ($LASTEXITCODE -eq 0 -and $observed.Trim()) {
      if ($observed.Trim() -eq $stableStart) { $stableCount += 1 } else { $stableStart = $observed.Trim(); $stableCount = 1 }
    } else { $stableStart = ''; $stableCount = 0 }
    if ($stableCount -ge 12) { break }
    Start-Sleep -Milliseconds 500
  }
  if ($stableCount -lt 12) { throw 'PostgreSQL postmaster stability timeout' }
  $result.postgres_version = (docker exec $postgres psql -U supabase_admin -d postgres -Atqc 'show server_version;').Trim()
  if ($result.postgres_version -notlike '17.6*') { throw "unexpected PostgreSQL version $($result.postgres_version)" }
  docker exec $postgres createdb -U supabase_admin template_executor_v2
  if ($LASTEXITCODE -ne 0) { throw 'failed to create template database' }
  foreach ($file in @('000_bootstrap.sql','five_source_relations.sql','037_material_checkout_routine.sql','045_exact_checkin_routines.sql','999_finalize.sql')) {
    docker exec $postgres psql -X -U supabase_admin -d template_executor_v2 -v ON_ERROR_STOP=1 -f "/executor/fixtures/approved-predecessor/$file" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "approved predecessor fixture failed: $file" }
  }
  docker exec $postgres psql -X -U supabase_admin -d template_executor_v2 -v ON_ERROR_STOP=1 -f '/executor/fixtures/integration/ledger-fixture.sql' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'ledger fixture failed' }
  docker exec $postgres psql -X -U supabase_admin -d template_executor_v2 -v ON_ERROR_STOP=1 -c 'ALTER DATABASE template_executor_v2 IS_TEMPLATE true;' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'failed to mark template database' }

  if ($Mode -eq 'Final') {
    $script = '/executor/frozen-release/release/editable-source/tests/integration-suite.js'
    $releaseRoot = '/executor/frozen-release/release'
    $releaseManifest = '/executor/frozen-release/release/frozen-release-manifest.json'
    $testManifest = '/executor/frozen-release/release/manifests/test-manifest.json'
    $contract = '/executor/frozen-release/release/fixtures/integration/independent-stage-contract.json'
  } else {
    $script = '/executor/editable-source/tests/integration-suite.js'
    $releaseRoot = '/executor'
    $releaseManifest = '/executor/development-evidence/development-release-manifest.json'
    $testManifest = '/executor/manifests/development-test-manifest.json'
    $contract = '/executor/fixtures/integration/independent-stage-contract.json'
  }
  $executorMount = "type=bind,source=$ExecutorRoot,target=/executor,readonly"
  $repoMount = "type=bind,source=$RepositoryRoot,target=/repo,readonly"
  $evidenceMount = "type=bind,source=$suiteEvidenceDir,target=/evidence"
  docker run --pull=never --read-only --tmpfs /tmp:rw,nosuid,size=67108864 --name $client --network $network --cpus 2 --memory 2g --pids-limit 256 --label $label --mount $executorMount --mount $repoMount --mount $evidenceMount `
    -e EXECUTOR_ROOT=$releaseRoot -e TAIRET_REPO_ROOT=/repo -e EVIDENCE_DIR=/evidence `
    -e RELEASE_MANIFEST=$releaseManifest -e TEST_MANIFEST=$testManifest -e STAGE_CONTRACT=$contract `
    -e TEMPLATE_DATABASE=template_executor_v2 -e PASS_ID=$PassId -e PGHOST=pg -e PGPORT=5432 -e PGUSER=supabase_admin -e PGPASSWORD=NON_DEPLOYABLE_LOCAL_ONLY `
    $clientImage node $script
  $result.suite_exit_code = $LASTEXITCODE
  if ($result.suite_exit_code -ne 0) { throw "integration suite failed with exit $($result.suite_exit_code)" }
}
finally {
  $existingClient = docker ps -a --filter "name=^/$client$" --format '{{.Names}}'
  if ($existingClient -eq $client) {
    try { Assert-OwnedContainer $client; docker rm -f $client | Out-Null; $result.cleanup.removed_containers += $client } catch { $result.cleanup.errors += $_.Exception.Message }
  }
  $existingPostgres = docker ps -a --filter "name=^/$postgres$" --format '{{.Names}}'
  if ($existingPostgres -eq $postgres) {
    try { Assert-OwnedContainer $postgres; docker rm -f $postgres | Out-Null; $result.cleanup.removed_containers += $postgres } catch { $result.cleanup.errors += $_.Exception.Message }
  }
  $existingNetwork = docker network ls --filter "name=^$network$" --format '{{.Name}}'
  if ($existingNetwork -eq $network) {
    try {
      $networkLabel = docker network inspect --format '{{ index .Labels "tairet.atomic.executor.v2.pass" }}' $network
      if ($networkLabel -ne $PassId) { throw "refusing to remove unowned network $network" }
      docker network rm $network | Out-Null
      $result.cleanup.removed_networks += $network
    } catch { $result.cleanup.errors += $_.Exception.Message }
  }
  $result.cleanup.residual_container_count = @(docker ps -a --filter "label=$label" --format '{{.ID}}').Count
  $result.cleanup.residual_network_count = @(docker network ls --filter "label=$label" --format '{{.ID}}').Count
  $result.cleanup.residual_volume_count = @(docker volume ls --filter "label=$label" --format '{{.Name}}').Count
  $result.cleanup.residual_resource_count = $result.cleanup.residual_container_count + $result.cleanup.residual_network_count + $result.cleanup.residual_volume_count
  $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $dockerEvidenceDir "docker-suite-$($Mode.ToLowerInvariant()).json") -Encoding utf8NoBOM
}

if ($result.cleanup.errors.Count -or $result.cleanup.residual_resource_count -ne 0) { throw 'Docker cleanup was not exact' }
