'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { canonicalHash, canonicalJson, sha256Bytes, sha256File } = require('../src/hash/canonical');
const { verifyFrozenRelease } = require('../src/identity/release');
const { MIGRATIONS } = require('../src/identity/model');
const { createPathAuthority, validateEnvironmentBindings } = require('../src/path/authority');

const toolRoot = path.resolve(process.env.ROOT_EXECUTOR_ROOT);
const releaseRoot = path.resolve(process.env.FROZEN_RELEASE_ROOT);
const finalOutputRoot = path.resolve(process.env.FINAL_OUTPUT_ROOT);
const mutationWorkRoot = path.resolve(process.env.MUTATION_WORK_ROOT);
const postgresWorkRoot = path.resolve(process.env.POSTGRES_WORK_ROOT);
const repoRoot = path.resolve(process.env.TAIRET_REPO_ROOT);
const v1Root = path.resolve(process.env.V1_EXECUTOR_ROOT);
const evidenceDir = path.resolve(process.env.FINAL_EVIDENCE_ROOT || path.join(toolRoot, 'final-evidence'));
fs.mkdirSync(evidenceDir, { recursive: true });

function command(executable, args) { return childProcess.execFileSync(executable, args, { encoding: 'utf8', windowsHide: true }).trim(); }
function lines(value) { return value ? value.split(/\r?\n/).filter(Boolean) : []; }
function payload(file) { const bytes = fs.readFileSync(file); return { size: bytes.length - 15, sha256: sha256Bytes(bytes.subarray(7, bytes.length - 8)) }; }
function listV1(root) {
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) rows.push({ path: path.relative(root, full).split(path.sep).join('/'), size: fs.statSync(full).size, sha256: sha256File(full) });
      else throw new Error(`UNSUPPORTED_V1_ENTRY: ${full}`);
    }
  }
  visit(root); return rows;
}

const rows = [];
function gate(id, fn) {
  try { rows.push({ id, pass: true, evidence: fn() }); }
  catch (error) { rows.push({ id, pass: false, error: `${error.name}: ${error.message}`, code: error.code || null }); }
}

gate('G001_AUTHORIZED_INPUT_IDENTITY', () => {
  assert.equal(command('git', ['-C', repoRoot, 'branch', '--show-current']), 'main');
  assert.equal(command('git', ['-C', repoRoot, 'rev-parse', 'HEAD']), '715ad1cea644e45d688dca785de09c83e1956413');
  assert.deepEqual(lines(command('git', ['-C', repoRoot, 'diff', '--name-only'])), []);
  assert.deepEqual(lines(command('git', ['-C', repoRoot, 'diff', '--cached', '--name-only'])), []);
  return { branch: 'main', head: '715ad1cea644e45d688dca785de09c83e1956413' };
});

gate('G002_CANONICAL_AND_INTERMEDIATE_MIGRATION_IDENTITY', () => MIGRATIONS.map((migration) => {
  const file = path.join(repoRoot, 'infra', 'sql', 'migrations', migration.filename);
  const actual = { size: fs.statSync(file).size, sha256: sha256File(file), payload: payload(file) };
  assert.deepEqual(actual, { size: migration.size, sha256: migration.sha256, payload: { size: migration.payloadSize, sha256: migration.payloadSha256 } });
  return { logicalNumber: migration.logicalNumber, ...actual };
}));

gate('G003_FROZEN_RELEASE_IDENTITY', () => {
  const manifest = JSON.parse(fs.readFileSync(process.env.RELEASE_MANIFEST, 'utf8'));
  const verified = verifyFrozenRelease(releaseRoot, manifest);
  const freezeRecord = JSON.parse(fs.readFileSync(path.join(toolRoot, 'frozen-release', 'freeze-record.json'), 'utf8'));
  assert.equal(freezeRecord.releaseSha256, manifest.releaseSha256);
  assert.equal(freezeRecord.releaseManifestSha256, sha256File(process.env.RELEASE_MANIFEST));
  return verified;
});

gate('G004_LOCAL_RUNTIME_DEPENDENCY_IDENTITY', () => {
  const inventory = JSON.parse(fs.readFileSync(path.join(releaseRoot, 'manifests', 'local-executor-dependency-inventory.json'), 'utf8'));
  const postgresImageId = command('docker', ['image', 'inspect', '--format', '{{.Id}}', inventory.dockerImages.postgres.reference]);
  const nodeImageId = command('docker', ['image', 'inspect', '--format', '{{.Id}}', inventory.dockerImages.node.reference]);
  assert.equal(postgresImageId, inventory.dockerImages.postgres.expectedImageId);
  assert.equal(nodeImageId, inventory.dockerImages.node.expectedImageId);
  assert.equal(process.version, inventory.node);
  return { node: process.version, postgresImageId, nodeImageId };
});

gate('G005_EXACT_FINAL_ENVIRONMENT_BINDING', () => {
  const authority = createPathAuthority({ toolRoot, frozenReleaseRoot: releaseRoot, finalOutputRoot, mutationWorkRoot, postgresWorkRoot, repositoryRoot: repoRoot, v1Root });
  const checked = validateEnvironmentBindings(authority, process.env);
  const contract = JSON.parse(fs.readFileSync(path.join(releaseRoot, 'manifests', 'final-environment-contract.json'), 'utf8'));
  const body = structuredClone(contract); delete body.contractSha256;
  assert.equal(contract.contractSha256, canonicalHash(body));
  assert.equal(contract.FINAL_ENVIRONMENT_CONTRACT, 'PASS');
  assert.equal(path.resolve(process.cwd()).toLowerCase(), repoRoot.toLowerCase());
  assert.equal(path.resolve(process.execPath).toLowerCase(), path.resolve(contract.localDependencies.nodeExecutable).toLowerCase());
  const observedPwsh = command('where.exe', ['pwsh']).split(/\r?\n/).filter(Boolean)[0];
  assert.equal(path.resolve(observedPwsh).toLowerCase(), path.resolve(contract.exactIntendedFinal.executable).toLowerCase());
  const expectedWrapper = path.join(releaseRoot, 'editable-source', 'tools', 'run-final-suite.ps1');
  assert.deepEqual(contract.exactIntendedFinal.argv, ['-NoProfile', '-File', expectedWrapper, '-ExecutorRoot', toolRoot, '-RepositoryRoot', repoRoot]);
  assert(fs.existsSync(expectedWrapper));
  for (const [key, value] of Object.entries(contract.exactIntendedFinal.environment)) assert.equal(path.resolve(process.env[key] || '').toLowerCase(), path.resolve(value).toLowerCase(), key);
  assert.equal(fs.readdirSync(mutationWorkRoot).length, 0);
  assert.equal(fs.readdirSync(postgresWorkRoot).length, 0);
  return { ...checked, authoritySha256: authority.authoritySha256, contractSha256: contract.contractSha256 };
});

gate('G006_V1_IMMUTABLE_IDENTITY', () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(toolRoot, 'manifests', 'v1-tree-baseline.json'), 'utf8'));
  const actual = listV1(v1Root);
  assert.equal(actual.length, baseline.files.length);
  assert.deepEqual(actual, baseline.files);
  return { fileCount: actual.length, inventorySha256: canonicalHash(actual) };
});

const result = {
  schema: 'tairet-global-gate-result-v2', gateCount: rows.length, passCount: rows.filter((row) => row.pass).length,
  failCount: rows.filter((row) => !row.pass).length, productionContact: 0, rows,
};
fs.writeFileSync(path.join(evidenceDir, 'global-gate-result.json'), canonicalJson(result));
process.stdout.write(`${JSON.stringify({ gateCount: result.gateCount, passCount: result.passCount, failCount: result.failCount })}\n`);
process.exitCode = result.failCount ? 1 : 0;
