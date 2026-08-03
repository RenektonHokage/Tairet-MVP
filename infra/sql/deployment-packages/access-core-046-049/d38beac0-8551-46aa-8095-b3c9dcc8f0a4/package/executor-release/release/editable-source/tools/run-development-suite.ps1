param(
  [string]$ExecutorRoot = 'C:\Users\mateo\AppData\Local\Tairet\statement-aware-atomic-migration-executor-v3-81648269',
  [string]$RepositoryRoot = 'C:\Importante\Python\tairet-mono-2',
  [ValidatePattern('^dev[0-9]{3}$')][string]$RunId = 'dev001'
)
$ErrorActionPreference = 'Stop'
& (Join-Path $ExecutorRoot 'editable-source\tools\run-executor-v3.ps1') -Mode Development -ExecutorRoot $ExecutorRoot -RepositoryRoot $RepositoryRoot -RunId $RunId -ExecutionAttempt 1
exit $LASTEXITCODE
