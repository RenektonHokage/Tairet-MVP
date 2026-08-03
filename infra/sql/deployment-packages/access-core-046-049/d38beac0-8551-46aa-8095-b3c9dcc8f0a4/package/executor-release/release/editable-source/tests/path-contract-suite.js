'use strict';

const assert = require('assert/strict');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { canonicalHash, canonicalJson } = require('../src/hash/canonical');
const {
  PathAuthorityError, createPathAuthority, assertMutationPath, validateEnvironmentBindings,
} = require('../src/path/authority');
const {
  MutationWorkspaceError, allocateMutationWorkspace, validateMutationWorkspaceReceipt,
  sealAndCleanMutationWorkspace, receiptBody,
} = require('../src/path/mutation-workspace');

const toolRoot = path.resolve(process.env.ROOT_EXECUTOR_ROOT || path.resolve(__dirname, '..', '..'));
const releaseRoot = path.resolve(process.env.FROZEN_RELEASE_ROOT || path.join(toolRoot, 'editable-source'));
const finalOutputRoot = path.resolve(process.env.FINAL_OUTPUT_ROOT || path.join(toolRoot, 'final-output'));
const mutationWorkRoot = path.resolve(process.env.MUTATION_WORK_ROOT || path.join(finalOutputRoot, 'mutation-workspaces'));
const postgresWorkRoot = path.resolve(process.env.POSTGRES_WORK_ROOT || path.join(finalOutputRoot, 'postgres-work'));
const repositoryRoot = path.resolve(process.env.TAIRET_REPO_ROOT || 'C:\\Importante\\Python\\tairet-mono-2');
const v1Root = path.resolve(process.env.V1_EXECUTOR_ROOT || 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\statement-aware-atomic-migration-executor-v1-008a2f38');
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || path.join(toolRoot, 'development-evidence', 'path-contract'));
const releaseManifestPath = process.env.RELEASE_MANIFEST || path.join(toolRoot, 'development-evidence', 'development-release-manifest.json');

for (const directory of [finalOutputRoot, mutationWorkRoot, postgresWorkRoot, evidenceDir]) fs.mkdirSync(directory, { recursive: true });
const authority = createPathAuthority({ toolRoot, frozenReleaseRoot: releaseRoot, finalOutputRoot, mutationWorkRoot, postgresWorkRoot, repositoryRoot, v1Root });
const releaseSha256 = JSON.parse(fs.readFileSync(releaseManifestPath, 'utf8')).releaseSha256;
const rows = [];

function test(id, polarity, description, fn) {
  try { fn(); rows.push({ id, polarity, description, pass: true }); }
  catch (error) { rows.push({ id, polarity, description, pass: false, error: `${error.name}: ${error.message}`, code: error.code || null }); }
}

function expectRejected(fn) {
  assert.throws(fn, (error) => error instanceof PathAuthorityError || error instanceof MutationWorkspaceError);
}

function allocate(mutantId) {
  return allocateMutationWorkspace({ authority, releaseSha256, finalRunId: process.env.FINAL_RUN_ID || 'pathcontract', mutantId });
}

function clean(receipt) {
  if (receipt && fs.existsSync(receipt.workspacePath)) sealAndCleanMutationWorkspace(authority, receipt);
}

function isReadOnlyFile(target) {
  const script = "if ((Get-Item -LiteralPath $env:TAIRET_READONLY_PROBE).Attributes -band [IO.FileAttributes]::ReadOnly) { 'true' } else { 'false' }";
  return childProcess.execFileSync('pwsh', ['-NoProfile', '-Command', script], { encoding: 'utf8', windowsHide: true, env: { ...process.env, TAIRET_READONLY_PROBE: target } }).trim() === 'true';
}

test('P001', 'POSITIVE', 'valid allocated external workspace', () => {
  const receipt = allocate('P001');
  try {
    assert.equal(validateMutationWorkspaceReceipt(authority, receipt, { releaseSha256, finalRunId: receipt.finalRunId, mutantId: 'P001' }), receipt.workspacePath);
    fs.writeFileSync(path.join(receipt.workspacePath, 'sentinel.txt'), 'writable');
  } finally { clean(receipt); }
});

test('P002', 'POSITIVE', 'nested mutant workspace', () => {
  const receipt = allocate('P002');
  try {
    const nested = path.join(receipt.workspacePath, 'source', 'nested');
    fs.mkdirSync(nested, { recursive: true });
    assert.equal(assertMutationPath(authority, nested), fs.realpathSync.native(nested));
  } finally { clean(receipt); }
});

test('P003', 'POSITIVE', 'Windows case-normalized valid path', () => {
  const receipt = allocate('P003');
  try {
    const alternateCase = process.platform === 'win32' ? receipt.workspacePath.toUpperCase() : receipt.workspacePath;
    assert.equal(assertMutationPath(authority, alternateCase).toLowerCase(), receipt.workspacePath.toLowerCase());
  } finally { clean(receipt); }
});

test('P004', 'POSITIVE', 'writable workspace while release is read-only', () => {
  if (process.env.FROZEN_RELEASE_READ_ONLY_REQUIRED === '1') {
    const receipt = allocate('P004');
    try {
      const releaseProbe = path.join(releaseRoot, 'editable-source', 'package.json');
      assert(fs.existsSync(releaseProbe));
      assert.equal(isReadOnlyFile(releaseProbe), true);
      fs.writeFileSync(path.join(receipt.workspacePath, 'writable-sentinel.txt'), 'pass');
    } finally { clean(receipt); }
    return;
  }
  const fixtureRoot = path.join(toolRoot, 'temporary', 'path-contract-read-only-fixture');
  const fixtureRelease = path.join(fixtureRoot, 'release');
  const fixtureOutput = path.join(fixtureRoot, 'output');
  const fixtureMutation = path.join(fixtureOutput, 'mutations');
  const fixturePostgres = path.join(fixtureOutput, 'postgres');
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  for (const directory of [fixtureRelease, fixtureMutation, fixturePostgres]) fs.mkdirSync(directory, { recursive: true });
  const readOnlyProbe = path.join(fixtureRelease, 'sealed.txt');
  fs.writeFileSync(readOnlyProbe, 'sealed');
  childProcess.execFileSync('attrib.exe', ['+R', readOnlyProbe], { windowsHide: true });
  assert.equal(isReadOnlyFile(readOnlyProbe), true);
  const fixtureAuthority = createPathAuthority({ toolRoot, frozenReleaseRoot: fixtureRelease, finalOutputRoot: fixtureOutput, mutationWorkRoot: fixtureMutation, postgresWorkRoot: fixturePostgres, repositoryRoot, v1Root });
  const receipt = allocateMutationWorkspace({ authority: fixtureAuthority, releaseSha256: 'a'.repeat(64), finalRunId: 'readonly', mutantId: 'P004' });
  try { fs.writeFileSync(path.join(receipt.workspacePath, 'writable.txt'), 'pass'); }
  finally {
    if (fs.existsSync(receipt.workspacePath)) sealAndCleanMutationWorkspace(fixtureAuthority, receipt);
    childProcess.execFileSync('attrib.exe', ['-R', readOnlyProbe], { windowsHide: true });
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('N001', 'NEGATIVE', 'path inside frozen release', () => expectRejected(() => assertMutationPath(authority, path.join(releaseRoot, 'editable-source'), { mustExist: false })));
test('N002', 'NEGATIVE', 'repository path', () => expectRejected(() => assertMutationPath(authority, repositoryRoot)));
test('N003', 'NEGATIVE', 'V1 path', () => expectRejected(() => assertMutationPath(authority, v1Root)));
test('N004', 'NEGATIVE', 'C:\\tmp', () => expectRejected(() => assertMutationPath(authority, 'C:\\tmp', { mustExist: false })));
test('N005', 'NEGATIVE', 'dot-dot escape', () => expectRejected(() => assertMutationPath(authority, path.join(mutationWorkRoot, '..', '..', 'temporary'), { mustExist: false })));
test('N006', 'NEGATIVE', 'drive-relative path', () => expectRejected(() => assertMutationPath(authority, 'C:drive-relative')));

test('N007', 'NEGATIVE', 'sibling-prefix confusion', () => {
  const sibling = `${finalOutputRoot}-sibling`;
  fs.mkdirSync(sibling, { recursive: true });
  try { expectRejected(() => assertMutationPath(authority, sibling)); }
  finally { fs.rmSync(sibling, { recursive: true, force: true }); }
});

test('N008', 'NEGATIVE', 'UNC path', () => expectRejected(() => assertMutationPath(authority, '\\\\server\\share\\mutant', { mustExist: false })));

test('N009', 'NEGATIVE', 'junction/reparse escape', () => {
  const target = path.join(toolRoot, 'temporary', 'path-contract-junction-target');
  const junction = path.join(mutationWorkRoot, 'path-contract-junction');
  fs.mkdirSync(target, { recursive: true });
  fs.rmSync(junction, { recursive: true, force: true });
  fs.symlinkSync(target, junction, process.platform === 'win32' ? 'junction' : 'dir');
  try { expectRejected(() => assertMutationPath(authority, path.join(junction, 'child'), { mustExist: false })); }
  finally {
    fs.rmSync(junction, { recursive: true, force: true });
    fs.rmSync(target, { recursive: true, force: true });
  }
});

test('N010', 'NEGATIVE', 'environment override', () => {
  const env = { ...process.env, ROOT_EXECUTOR_ROOT: toolRoot, FROZEN_RELEASE_ROOT: releaseRoot, FINAL_OUTPUT_ROOT: finalOutputRoot, MUTATION_WORK_ROOT: repositoryRoot, POSTGRES_WORK_ROOT: postgresWorkRoot, TAIRET_REPO_ROOT: repositoryRoot };
  expectRejected(() => validateEnvironmentBindings(authority, env));
});

test('N011', 'NEGATIVE', 'stale root receipt/binding', () => {
  const receipt = allocate('N011');
  try {
    const stale = { ...receipt, authoritySha256: '0'.repeat(64) };
    stale.receiptSha256 = canonicalHash(receiptBody(stale));
    expectRejected(() => validateMutationWorkspaceReceipt(authority, stale, { releaseSha256, finalRunId: receipt.finalRunId, mutantId: 'N011' }));
  } finally { clean(receipt); }
});

test('N012', 'NEGATIVE', 'workspace reuse by another mutant', () => {
  const receipt = allocate('N012');
  try { expectRejected(() => validateMutationWorkspaceReceipt(authority, receipt, { releaseSha256, finalRunId: receipt.finalRunId, mutantId: 'OTHER_MUTANT' })); }
  finally { clean(receipt); }
});

const residualEntries = fs.readdirSync(mutationWorkRoot);
const result = {
  schema: 'tairet-path-contract-result-v2', testCount: rows.length, passCount: rows.filter((row) => row.pass).length,
  failCount: rows.filter((row) => !row.pass).length, positiveCount: rows.filter((row) => row.polarity === 'POSITIVE').length,
  negativeCount: rows.filter((row) => row.polarity === 'NEGATIVE').length, authoritySha256: authority.authoritySha256,
  mutationWorkspaceResidualCount: residualEntries.length, rows,
};
fs.writeFileSync(path.join(evidenceDir, 'path-contract-result.json'), canonicalJson(result));
process.stdout.write(`${JSON.stringify({ testCount: result.testCount, passCount: result.passCount, failCount: result.failCount, residual: result.mutationWorkspaceResidualCount })}\n`);
process.exitCode = result.failCount || result.mutationWorkspaceResidualCount ? 1 : 0;
