param(
  [Parameter(Mandatory)][string]$ExecutorRoot,
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9-]{3,32}$')][string]$Phase
)

$ErrorActionPreference = 'Stop'
function Parse-Rows([string[]]$Lines, [string[]]$Fields) {
  $rows = @()
  foreach ($line in @($Lines | Where-Object { $_ })) {
    $parts = $line -split '\|', $Fields.Count
    $row = [ordered]@{}
    for ($index = 0; $index -lt $Fields.Count; $index += 1) { $row[$Fields[$index]] = if ($index -lt $parts.Count) { $parts[$index] } else { '' } }
    $rows += [pscustomobject]$row
  }
  return $rows
}

$containers = Parse-Rows @(docker ps -a --no-trunc --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}') @('id','name','image','status')
if ($LASTEXITCODE -ne 0) { throw 'DOCKER_CONTAINER_INVENTORY_FAILED' }
$networks = Parse-Rows @(docker network ls --no-trunc --format '{{.ID}}|{{.Name}}|{{.Driver}}|{{.Scope}}') @('id','name','driver','scope')
if ($LASTEXITCODE -ne 0) { throw 'DOCKER_NETWORK_INVENTORY_FAILED' }
$volumes = Parse-Rows @(docker volume ls --format '{{.Name}}|{{.Driver}}') @('name','driver')
if ($LASTEXITCODE -ne 0) { throw 'DOCKER_VOLUME_INVENTORY_FAILED' }
$ownedContainers = @(docker ps -a --filter 'label=tairet.atomic.executor.v2.pass' --format '{{.ID}}' | Where-Object { $_ })
$ownedNetworks = @(docker network ls --filter 'label=tairet.atomic.executor.v2.pass' --format '{{.ID}}' | Where-Object { $_ })
$ownedVolumes = @(docker volume ls --filter 'label=tairet.atomic.executor.v2.pass' --format '{{.Name}}' | Where-Object { $_ })
$dockerResult = [ordered]@{
  schema = 'tairet-docker-runtime-inventory-v3'
  phase = $Phase
  containers = @($containers | Sort-Object id)
  networks = @($networks | Sort-Object id)
  volumes = @($volumes | Sort-Object name)
  executorOwnedContainerCount = $ownedContainers.Count
  executorOwnedNetworkCount = $ownedNetworks.Count
  executorOwnedVolumeCount = $ownedVolumes.Count
  ownedV2ContainerCount = $ownedContainers.Count
  ownedV2NetworkCount = $ownedNetworks.Count
  ownedV2VolumeCount = $ownedVolumes.Count
  executorOwnedResourceCount = $ownedContainers.Count + $ownedNetworks.Count + $ownedVolumes.Count
}
$dockerPath = Join-Path $ExecutorRoot "docker-inventories\$Phase.json"
$dockerResult | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $dockerPath -Encoding utf8NoBOM

$processes = @(Get-CimInstance Win32_Process | Where-Object {
  $_.ProcessId -ne $PID -and $_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine.Contains($ExecutorRoot, [StringComparison]::OrdinalIgnoreCase)
} | Select-Object ProcessId,Name)
$processResult = [ordered]@{ schema='tairet-process-runtime-inventory-v3'; phase=$Phase; survivingExecutorProcessCount=$processes.Count; processes=$processes }
$processPath = Join-Path $ExecutorRoot "process-inventories\$Phase.json"
$processResult | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $processPath -Encoding utf8NoBOM
[pscustomobject]@{ dockerInventory=$dockerPath; processInventory=$processPath; ownedResourceCount=$dockerResult.executorOwnedResourceCount; survivingProcessCount=$processes.Count } | ConvertTo-Json -Compress
