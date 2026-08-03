'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { canonicalHash, canonicalJson, sha256File } = require('../src/hash/canonical');
const { createPathAuthority, validateEnvironmentBindings } = require('../src/path/authority');

const executorRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(process.env.TAIRET_REPO_ROOT || 'C:\\Importante\\Python\\tairet-mono-2');
const v1Root = path.resolve(process.env.V1_EXECUTOR_ROOT || 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\statement-aware-atomic-migration-executor-v1-008a2f38');
const v2Root = path.resolve(process.env.V2_EXECUTOR_ROOT || 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\statement-aware-atomic-migration-executor-v2-b4aad405');
const frozenReleaseRoot = path.join(executorRoot, 'frozen-release', 'release');
const finalOutputRoot = path.join(executorRoot, 'final-run', 'output');
const mutationWorkRoot = path.join(finalOutputRoot, 'mutation-workspaces');
const postgresWorkRoot = path.join(finalOutputRoot, 'postgres-work');
const finalEvidenceRoot = path.join(executorRoot, 'final-evidence');
const finalRunId = 'final001';

for (const directory of [finalOutputRoot, mutationWorkRoot, postgresWorkRoot, finalEvidenceRoot]) fs.mkdirSync(directory, { recursive: true });
if (fs.readdirSync(mutationWorkRoot).length !== 0 || fs.readdirSync(postgresWorkRoot).length !== 0) throw new Error('PREFLIGHT_WORK_ROOT_NOT_EMPTY');
if (fs.existsSync(frozenReleaseRoot)) throw new Error('PREFLIGHT_MUST_RUN_BEFORE_FREEZE');
if (path.resolve(process.cwd()).toLowerCase() !== repoRoot.toLowerCase()) throw new Error('FINAL_CWD_MISMATCH');
const authority = createPathAuthority({ toolRoot: executorRoot, frozenReleaseRoot, finalOutputRoot, mutationWorkRoot, postgresWorkRoot, repositoryRoot: repoRoot, v1Root }, { allowMissingRelease: true });
const exactEnvironment = {
  ROOT_EXECUTOR_ROOT: executorRoot,
  FROZEN_RELEASE_ROOT: frozenReleaseRoot,
  FINAL_OUTPUT_ROOT: finalOutputRoot,
  MUTATION_WORK_ROOT: mutationWorkRoot,
  POSTGRES_WORK_ROOT: postgresWorkRoot,
  TAIRET_REPO_ROOT: repoRoot,
  V1_EXECUTOR_ROOT: v1Root,
  V2_EXECUTOR_ROOT: v2Root,
  RELEASE_MANIFEST: path.join(frozenReleaseRoot, 'frozen-release-manifest.json'),
  TEST_MANIFEST: path.join(frozenReleaseRoot, 'manifests', 'test-manifest.json'),
  PRODUCTION_TEMPLATE: path.join(frozenReleaseRoot, 'manifests', 'production-manifest-template.json'),
  IDENTITY_MODEL: path.join(frozenReleaseRoot, 'manifests', 'executor-v3-identity-model.json'),
  FINAL_EVIDENCE_ROOT: finalEvidenceRoot,
  FINAL_RUN_ID: finalRunId,
  FINAL_EXECUTION_ATTEMPT: '1',
  FROZEN_RELEASE_READ_ONLY_REQUIRED: '1',
};
validateEnvironmentBindings(authority, exactEnvironment);
function command(executable, args) { return childProcess.execFileSync(executable, args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true }).trim(); }
const pwshExecutable = path.resolve(command('where.exe', ['pwsh']).split(/\r?\n/).filter(Boolean)[0]);
const postgresImageId = command('docker', ['image', 'inspect', '--format', '{{.Id}}', 'public.ecr.aws/supabase/postgres:17.6.1.143']);
const nodeImageId = command('docker', ['image', 'inspect', '--format', '{{.Id}}', 'mcr.microsoft.com/devcontainers/javascript-node:22']);
if (postgresImageId !== 'sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453') throw new Error('POSTGRES_IMAGE_IDENTITY_MISMATCH');
if (nodeImageId !== 'sha256:25a1f18c8f075b597b309c6fc7c09657353fd353b6bf912b48158b2af72b2b9c') throw new Error('NODE_IMAGE_IDENTITY_MISMATCH');
const sentinel = path.join(finalOutputRoot, '.final-environment-preflight-sentinel');
fs.writeFileSync(sentinel, 'FINAL_ENVIRONMENT_CONTRACT_SENTINEL\n', { encoding: 'utf8', flag: 'wx' });
const sentinelSha256 = sha256File(sentinel); fs.rmSync(sentinel);
const wrapperScript = path.join(frozenReleaseRoot, 'editable-source', 'tools', 'run-final-suite.ps1');
const body = {
  schema: 'tairet-final-environment-contract-v3', FINAL_ENVIRONMENT_CONTRACT: 'PASS', preFreeze: true,
  exactIntendedFinal: {
    executable: pwshExecutable,
    argv: ['-NoProfile', '-File', wrapperScript, '-ExecutorRoot', executorRoot, '-RepositoryRoot', repoRoot],
    cwd: repoRoot, environment: exactEnvironment, frozenReleasePath: frozenReleaseRoot,
    outputRoot: finalOutputRoot, mutationRoot: mutationWorkRoot, postgresRoot: postgresWorkRoot,
    suiteOrder: ['STATIC','PARSER','RECOVERY','ATOMICITY','SEMANTIC_MUTATION','CLEANUP'],
    resultPaths: Object.fromEntries(['STATIC','PARSER','RECOVERY','ATOMICITY','SEMANTIC_MUTATION','CLEANUP'].map((suite) => [suite, path.join(executorRoot, 'suite-results', finalRunId, `${suite}.result.json`)])),
  },
  permissions: { finalOutputSentinelCreatedAndRemoved: true, finalOutputSentinelSha256: sentinelSha256, frozenReleaseModified: false, frozenReleaseExistsBeforeFreeze: false },
  localDependencies: { nodeExecutable: process.execPath, nodeVersion: process.version, pwshExecutable, postgresImageId, nodeImageId, pullPolicy: 'never', externalNetworkPermitted: false },
  authoritySha256: authority.authoritySha256, productionContact: 0,
};
const result = { ...body, contractSha256: canonicalHash(body) };
fs.writeFileSync(path.join(executorRoot, 'manifests', 'final-environment-contract.json'), canonicalJson(result));
fs.mkdirSync(path.join(executorRoot, 'development-evidence', 'final-environment'), { recursive: true });
fs.writeFileSync(path.join(executorRoot, 'development-evidence', 'final-environment', 'final-environment-contract-result.json'), canonicalJson(result));
process.stdout.write(`${JSON.stringify({ status: result.FINAL_ENVIRONMENT_CONTRACT, contractSha256: result.contractSha256, authoritySha256: result.authoritySha256, productionContact: 0 })}\n`);
