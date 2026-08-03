param(
  [string]$ExecutorRoot = 'C:\Users\mateo\AppData\Local\Tairet\statement-aware-atomic-migration-executor-v3-81648269',
  [string]$RepositoryRoot = 'C:\Importante\Python\tairet-mono-2'
)
$ErrorActionPreference = 'Stop'
& (Join-Path $ExecutorRoot 'frozen-release\release\editable-source\tools\run-executor-v3.ps1') -Mode Final -ExecutorRoot $ExecutorRoot -RepositoryRoot $RepositoryRoot -RunId 'final001' -ExecutionAttempt 1
exit $LASTEXITCODE
