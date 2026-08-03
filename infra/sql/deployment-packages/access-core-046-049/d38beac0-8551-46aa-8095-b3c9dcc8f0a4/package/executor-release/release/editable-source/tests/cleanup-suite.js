'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { canonicalJson, sha256Bytes, sha256File } = require('../src/hash/canonical');
const { verifyFrozenRelease } = require('../src/identity/release');
const { MIGRATIONS } = require('../src/identity/model');

const toolRoot = path.resolve(process.env.ROOT_EXECUTOR_ROOT || path.resolve(__dirname, '..', '..'));
const releaseRoot = path.resolve(process.env.FROZEN_RELEASE_ROOT || path.join(toolRoot, 'editable-source'));
const releaseManifestPath = process.env.RELEASE_MANIFEST || path.join(toolRoot, 'development-evidence', 'development-release-manifest.json');
const releaseVerificationRoot = process.env.FINAL_RUN_ID ? releaseRoot : toolRoot;
const repoRoot = path.resolve(process.env.TAIRET_REPO_ROOT || 'C:\\Importante\\Python\\tairet-mono-2');
const v1Root = path.resolve(process.env.V1_EXECUTOR_ROOT || 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\statement-aware-atomic-migration-executor-v1-008a2f38');
const finalOutputRoot = path.resolve(process.env.FINAL_OUTPUT_ROOT || path.join(toolRoot, 'final-output'));
const mutationWorkRoot = path.resolve(process.env.MUTATION_WORK_ROOT || path.join(finalOutputRoot, 'mutation-workspaces'));
const postgresWorkRoot = path.resolve(process.env.POSTGRES_WORK_ROOT || path.join(finalOutputRoot, 'postgres-work'));
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || path.join(toolRoot, 'development-evidence', 'cleanup'));
const preInventoryPath = process.env.DOCKER_PRE_INVENTORY;
const postInventoryPath = process.env.DOCKER_POST_INVENTORY;
fs.mkdirSync(evidenceDir, { recursive: true });

function command(executable, args, options = {}) {
  return childProcess.execFileSync(executable, args, { encoding: 'utf8', windowsHide: true, ...options }).trim();
}
function lines(value) { return value ? value.split(/\r?\n/).filter(Boolean) : []; }
function listFiles(root) {
  const result = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) result.push({ path: path.relative(root, full).split(path.sep).join('/'), size: fs.statSync(full).size, sha256: sha256File(full) });
      else throw new Error(`UNSUPPORTED_V1_ENTRY: ${full}`);
    }
  }
  visit(root);
  return result;
}
function hashPayload(file) {
  const bytes = fs.readFileSync(file);
  return { size: bytes.length - 15, sha256: sha256Bytes(bytes.subarray(7, bytes.length - 8)) };
}

const rows = [];
function test(id, description, fn) {
  try { const evidence = fn(); rows.push({ id, description, pass: true, evidence }); }
  catch (error) { rows.push({ id, description, pass: false, error: `${error.name}: ${error.message}`, code: error.code || null }); }
}

let v1ChangeCount = -1;
let repositoryWriteCount = -1;
let migrationFileChangeCount = -1;
let residualDockerResourceCount = -1;
let survivingProcessCount = -1;

test('C001', 'V1 immutable tree is byte-exact', () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(toolRoot, 'manifests', 'v1-tree-baseline.json'), 'utf8'));
  const actual = listFiles(v1Root);
  const expectedMap = new Map(baseline.files.map((row) => [row.path, row]));
  const actualMap = new Map(actual.map((row) => [row.path, row]));
  const changed = [];
  for (const key of new Set([...expectedMap.keys(), ...actualMap.keys()])) {
    const expected = expectedMap.get(key); const observed = actualMap.get(key);
    if (!expected || !observed || expected.size !== observed.size || expected.sha256 !== observed.sha256) changed.push(key);
  }
  v1ChangeCount = changed.length;
  assert.equal(v1ChangeCount, 0);
  return { baselineFileCount: baseline.fileCount, actualFileCount: actual.length, changeCount: v1ChangeCount };
});

test('C002', 'repository branch, HEAD, and tracked worktree are unchanged', () => {
  assert.equal(command('git', ['-C', repoRoot, 'branch', '--show-current']), 'main');
  assert.equal(command('git', ['-C', repoRoot, 'rev-parse', 'HEAD']), '715ad1cea644e45d688dca785de09c83e1956413');
  const tracked = lines(command('git', ['-C', repoRoot, 'diff', '--name-only']));
  const staged = lines(command('git', ['-C', repoRoot, 'diff', '--cached', '--name-only']));
  repositoryWriteCount = [...tracked, ...staged].length;
  assert.equal(repositoryWriteCount, 0);
  return { tracked, staged, repositoryWriteCount };
});

test('C003', 'migrations 046-049 and intermediate payloads are byte-exact', () => {
  const changed = [];
  const rows = MIGRATIONS.map((migration) => {
    const file = path.join(repoRoot, 'infra', 'sql', 'migrations', migration.filename);
    const source = { size: fs.statSync(file).size, sha256: sha256File(file) };
    const payload = hashPayload(file);
    if (source.size !== migration.size || source.sha256 !== migration.sha256 || payload.size !== migration.payloadSize || payload.sha256 !== migration.payloadSha256) changed.push(migration.logicalNumber);
    return { logicalNumber: migration.logicalNumber, source, payload };
  });
  migrationFileChangeCount = changed.length;
  assert.equal(migrationFileChangeCount, 0);
  return rows;
});

test('C004', 'release entries and identity remain byte-exact', () => {
  const manifest = JSON.parse(fs.readFileSync(releaseManifestPath, 'utf8'));
  return verifyFrozenRelease(releaseVerificationRoot, manifest);
});

test('C005', 'generated frozen artifacts remain byte-exact', () => {
  if (!process.env.FINAL_RUN_ID) return { development: true };
  const manifest = JSON.parse(fs.readFileSync(releaseManifestPath, 'utf8'));
  const mismatches = [];
  for (const binding of Object.values(manifest.generatedArtifactBindings || {})) {
    const file = path.join(releaseRoot, ...binding.path.split('/'));
    if (!fs.existsSync(file) || sha256File(file) !== binding.sha256) mismatches.push(binding.path);
  }
  assert.deepEqual(mismatches, []);
  return { verifiedBindingCount: Object.keys(manifest.generatedArtifactBindings || {}).length };
});

test('C006', 'frozen release files are read-only', () => {
  if (process.env.FROZEN_RELEASE_READ_ONLY_REQUIRED !== '1') return { development: true };
  const script = "$bad=@(Get-ChildItem -File -Recurse -Force -LiteralPath $env:TAIRET_READONLY_ROOT | Where-Object { -not ($_.Attributes -band [IO.FileAttributes]::ReadOnly) }); $bad.Count";
  const count = Number(command('pwsh', ['-NoProfile', '-Command', script], { env: { ...process.env, TAIRET_READONLY_ROOT: releaseRoot } }));
  assert.equal(count, 0);
  return { nonReadOnlyFileCount: count };
});

test('C007', 'mutation workspaces are fully cleaned', () => {
  const residual = fs.readdirSync(mutationWorkRoot);
  assert.deepEqual(residual, []);
  return { residualCount: residual.length };
});

test('C008', 'PostgreSQL work root is fully cleaned', () => {
  const residual = fs.readdirSync(postgresWorkRoot);
  assert.deepEqual(residual, []);
  return { residualCount: residual.length };
});

test('C009', 'owned Docker resources are absent', () => {
  const containers = lines(command('docker', ['ps', '-a', '--filter', 'label=tairet.atomic.executor.v2.pass', '--format', '{{.ID}}']));
  const networks = lines(command('docker', ['network', 'ls', '--filter', 'label=tairet.atomic.executor.v2.pass', '--format', '{{.ID}}']));
  const volumes = lines(command('docker', ['volume', 'ls', '--filter', 'label=tairet.atomic.executor.v2.pass', '--format', '{{.Name}}']));
  residualDockerResourceCount = containers.length + networks.length + volumes.length;
  assert.equal(residualDockerResourceCount, 0);
  return { containerCount: containers.length, networkCount: networks.length, volumeCount: volumes.length };
});

test('C010', 'Docker pre/post inventories are preserved', () => {
  assert(preInventoryPath && fs.existsSync(preInventoryPath));
  assert(postInventoryPath && fs.existsSync(postInventoryPath));
  const pre = JSON.parse(fs.readFileSync(preInventoryPath, 'utf8'));
  const post = JSON.parse(fs.readFileSync(postInventoryPath, 'utf8'));
  assert.equal(pre.ownedV2ContainerCount + pre.ownedV2NetworkCount + pre.ownedV2VolumeCount, 0);
  assert.equal(post.ownedV2ContainerCount + post.ownedV2NetworkCount + post.ownedV2VolumeCount, 0);
  return { preSha256: sha256File(preInventoryPath), postSha256: sha256File(postInventoryPath) };
});

test('C011', 'executor processes do not survive suite children', () => {
  const postProcessPath = postInventoryPath.replace('docker-inventories', 'process-inventories');
  const post = JSON.parse(fs.readFileSync(postProcessPath, 'utf8'));
  survivingProcessCount = post.survivingExecutorProcessCount;
  assert.equal(survivingProcessCount, 0);
  return { survivingProcessCount };
});

test('C012', 'database and Docker harness cleanup evidence is exact', () => {
  const base = process.env.FINAL_RUN_ID ? path.join(toolRoot, 'final-evidence') : path.join(toolRoot, 'development-evidence');
  const atomic = JSON.parse(fs.readFileSync(path.join(base, 'integration', 'atomicity-test-manifest.json'), 'utf8'));
  const docker = JSON.parse(fs.readFileSync(path.join(base, 'docker', `docker-suite-${process.env.FINAL_RUN_ID ? 'final' : 'development'}.json`), 'utf8'));
  assert.equal(atomic.createdDatabaseResidualCount, 0);
  assert.equal(docker.cleanup.residual_resource_count, 0);
  return { databaseResidualCount: atomic.createdDatabaseResidualCount, dockerResidualCount: docker.cleanup.residual_resource_count };
});

const result = {
  schema: 'tairet-cleanup-result-v2', testCount: rows.length, passCount: rows.filter((row) => row.pass).length,
  failCount: rows.filter((row) => !row.pass).length, v1ChangeCount, repositoryWriteCount, migrationFileChangeCount,
  residualDockerResourceCount, survivingProcessCount,
  mutationWorkspaceResidualCount: fs.existsSync(mutationWorkRoot) ? fs.readdirSync(mutationWorkRoot).length : -1,
  postgresWorkResidualCount: fs.existsSync(postgresWorkRoot) ? fs.readdirSync(postgresWorkRoot).length : -1,
  productionContact: 0, rows,
};
fs.writeFileSync(path.join(evidenceDir, 'cleanup-result.json'), canonicalJson(result));
process.stdout.write(`${JSON.stringify({ testCount: result.testCount, passCount: result.passCount, failCount: result.failCount, v1ChangeCount, repositoryWriteCount, migrationFileChangeCount, residualDockerResourceCount, survivingProcessCount })}\n`);
process.exitCode = result.failCount ? 1 : 0;
