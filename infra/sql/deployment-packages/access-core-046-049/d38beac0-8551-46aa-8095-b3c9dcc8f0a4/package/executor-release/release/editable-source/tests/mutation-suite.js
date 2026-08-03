'use strict';

const fs = require('fs');
const path = require('path');
const { canonicalJson, sha256Bytes, sha256File } = require('../src/hash/canonical');

const { createPathAuthority, validateEnvironmentBindings } = require('../src/path/authority');
const {
  allocateMutationWorkspace, materializeRequiredSources, sealAndCleanMutationWorkspace,
} = require('../src/path/mutation-workspace');

const toolRoot = path.resolve(process.env.ROOT_EXECUTOR_ROOT || path.resolve(__dirname, '..', '..'));
const releaseRoot = path.resolve(process.env.FROZEN_RELEASE_ROOT || path.join(toolRoot, 'editable-source'));
const repoRoot = path.resolve(process.env.TAIRET_REPO_ROOT || 'C:\Importante\Python\tairet-mono-2');
const v1Root = path.resolve(process.env.V1_EXECUTOR_ROOT || 'C:\Users\mateo\AppData\Local\Tairet\statement-aware-atomic-migration-executor-v1-008a2f38');
const finalOutputRoot = path.resolve(process.env.FINAL_OUTPUT_ROOT || path.join(toolRoot, 'final-output'));
const mutationRoot = path.resolve(process.env.MUTATION_WORK_ROOT || path.join(finalOutputRoot, 'mutation-workspaces'));
const postgresRoot = path.resolve(process.env.POSTGRES_WORK_ROOT || path.join(finalOutputRoot, 'postgres-work'));
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || path.join(toolRoot, 'development-evidence', 'mutations'));
const finalRunId = process.env.FINAL_RUN_ID || 'development';
const mutationTestManifestPath = process.env.TEST_MANIFEST || path.join(toolRoot, 'manifests', 'development-test-manifest.json');
const mutationIdentityModelPath = process.env.IDENTITY_MODEL || path.join(toolRoot, 'manifests', 'executor-v2-identity-model.json');
const releaseManifestPath = process.env.RELEASE_MANIFEST || path.join(toolRoot, 'development-evidence', 'development-release-manifest.json');
for (const directory of [finalOutputRoot, mutationRoot, postgresRoot, evidenceDir]) fs.mkdirSync(directory, { recursive: true });
const authority = createPathAuthority({ toolRoot, frozenReleaseRoot: releaseRoot, finalOutputRoot, mutationWorkRoot: mutationRoot, postgresWorkRoot: postgresRoot, repositoryRoot: repoRoot, v1Root });
validateEnvironmentBindings(authority, {
  ...process.env, ROOT_EXECUTOR_ROOT: toolRoot, FROZEN_RELEASE_ROOT: releaseRoot,
  FINAL_OUTPUT_ROOT: finalOutputRoot, MUTATION_WORK_ROOT: mutationRoot, POSTGRES_WORK_ROOT: postgresRoot, TAIRET_REPO_ROOT: repoRoot,
});
const releaseSha256 = JSON.parse(fs.readFileSync(releaseManifestPath, 'utf8')).releaseSha256;
fs.mkdirSync(evidenceDir, { recursive: true });
function expectedFor(bytes) {
  const leading = Buffer.from('begin;\n'); const trailing = Buffer.from('commit;\n');
  const payload = bytes.subarray(leading.length, bytes.length - trailing.length);
  return { size: bytes.length, sha256: sha256Bytes(bytes), payloadSize: payload.length, payloadSha256: sha256Bytes(payload) };
}
function load(root, relative) { const resolved = path.join(root, relative); delete require.cache[require.resolve(resolved)]; return require(resolved); }
function replayGuard(root, beginEvidence = { connectionId: 'mutation', physicalConnectionCount: 1, retryCount: 0, reconnectCount: 0 }) {
  const { StageInvariantGuard, REQUIRED_EVENTS } = load(root, 'executor/invariant-guard.js');
  const guard = new StageInvariantGuard('mutation');
  const evidence = {
    BEGIN: beginEvidence,
    PAYLOAD_SIMPLE_QUERY: { operationKind: 'simple-query' },
    LEDGER_PARAMETERIZED_INSERT: { operationKind: 'extended-parameterized-query' },
    POST_COMMIT_READ_ONLY_VERIFIER: { readOnly: true, connectionId: 'independent' },
  };
  const canonicalEvents = ['BEGIN','TIMEOUTS','PAYLOAD_SIMPLE_QUERY','IN_TRANSACTION_VERIFIER','LEDGER_PARAMETERIZED_INSERT','LEDGER_REREAD','EFFECT_REREAD','COMMIT','MUTATION_CONNECTION_CLOSED','POST_COMMIT_READ_ONLY_VERIFIER','COMPLETE'];
  for (const event of canonicalEvents) guard.record(event, evidence[event] || {});
  return guard.evidence().pass && REQUIRED_EVENTS.length === canonicalEvents.length;
}

const probes = {
  envelopeRemoval(root) {
    const { validateCanonicalBytes } = load(root, 'envelope/validator.js');
    const bytes = Buffer.from('begin;\nSELECT 1;\ncommit;\n');
    try { validateCanonicalBytes(bytes, expectedFor(bytes)); return true; } catch { return false; }
  },
  guardReplay(root) { try { return replayGuard(root); } catch { return false; } },
  verifierEnforcement(root) {
    const Module = require('module');
    const filename = path.join(root, 'verifiers', 'material.js');
    const instance = new Module(filename, module);
    instance.filename = filename;
    instance.paths = Module._nodeModulePaths(path.dirname(filename));
    const originalRequire = instance.require.bind(instance);
    instance.require = (request) => request === '../db/protocol-client' ? { lastRows: () => [] } : originalRequire(request);
    instance._compile(fs.readFileSync(filename, 'utf8'), filename);
    const { compareStage } = instance.exports;
    const contract = { stages: { POST_046: { catalog_fingerprint: 'expected', fulfillment_table: true, delivery_attempt_table: true, marker_column: false, terminal_sha256: '', claim_sha256: 'claim' } } };
    const actual = { catalogFingerprint: 'wrong', fulfillmentTable: true, deliveryAttemptTable: true, markerColumn: false, terminalSha256: '', claimSha256: 'claim' };
    try { compareStage('POST_046', actual, contract); return false; } catch (error) { return error.code === 'STAGE_VERIFICATION_FAILED'; }
  },
  sourceHash(root) {
    const { validateCanonicalBytes } = load(root, 'envelope/validator.js');
    const bytes = Buffer.from('begin;\nSELECT 1;\ncommit;\n'); const expected = expectedFor(bytes); expected.sha256 = '0'.repeat(64);
    try { validateCanonicalBytes(bytes, expected); return false; } catch (error) { return error.code === 'SOURCE_HASH_MISMATCH'; }
  },
  payloadHash(root) {
    const { validateCanonicalBytes } = load(root, 'envelope/validator.js');
    const bytes = Buffer.from('begin;\nSELECT 1;\ncommit;\n'); const expected = expectedFor(bytes); expected.payloadSha256 = '0'.repeat(64);
    try { validateCanonicalBytes(bytes, expected); return false; } catch (error) { return error.code === 'PAYLOAD_HASH_MISMATCH'; }
  },
  versionOrder(root) {
    const { validateManifest, sealManifest } = load(root, 'manifest/validator.js');
    const manifest = JSON.parse(fs.readFileSync(mutationTestManifestPath, 'utf8'));
    const identity = JSON.parse(fs.readFileSync(mutationIdentityModelPath, 'utf8'));
    const body = structuredClone(manifest); delete body.manifestSha256; body.migrations[1].version = '98000000000001';
    const changed = sealManifest(body);
    const expected = { executorReleaseIdentity: manifest.executorReleaseIdentity, parserIdentity: manifest.parserIdentity, inTransactionVerifierIdentity: manifest.verifierIdentities.inTransaction, postCommitVerifierIdentity: manifest.verifierIdentities.postCommit, materialContractIdentity: manifest.verifierIdentities.materialContract, migrations: identity.migrations, stageOrder: ['046','047','048','049'], expectedPredecessorLedgerIdentity: manifest.expectedPredecessorLedgerIdentity };
    try { validateManifest(changed, expected, { forExecution: true }); return false; } catch (error) { return error.code === 'NON_INCREASING_VERSION'; }
  },
  splitState(root) {
    const { classifyRecovery, RECOVERY } = load(root, 'recovery/classifier.js');
    return classifyRecovery({ ledger: 'exact', effects: 'absent', predecessorExact: true }) === RECOVERY.HARD_STOP_SPLIT_STATE;
  },
  retryProhibition(root) {
    const { StageInvariantGuard } = load(root, 'executor/invariant-guard.js');
    const guard = new StageInvariantGuard('mutation');
    try { guard.record('BEGIN', { connectionId: 'mutation', physicalConnectionCount: 1, retryCount: 1, reconnectCount: 0 }); return false; }
    catch (error) { return error.code === 'AUTOMATIC_RETRY_OR_RECONNECT_PROHIBITED'; }
  },
};

const mutations = [
  { id: 'SM-01', surface: 'envelope removal', file: 'envelope/validator.js', from: 'bytes.subarray(LEADING.length, bytes.length - TRAILING.length)', to: 'bytes.subarray(LEADING.length - 1, bytes.length - TRAILING.length)', probe: 'envelopeRemoval', activated: 'validateCanonicalBytes valid canonical envelope' },
  { id: 'SM-02', surface: 'transaction begin', file: 'executor/invariant-guard.js', from: "  'BEGIN',", to: "  'BEGIN_MUTATED',", probe: 'guardReplay', activated: 'StageInvariantGuard canonical executor event replay' },
  { id: 'SM-03', surface: 'verifier invocation', file: 'executor/invariant-guard.js', from: "  'IN_TRANSACTION_VERIFIER',", to: "  'IN_TRANSACTION_VERIFIER_MUTATED',", probe: 'guardReplay', activated: 'StageInvariantGuard canonical executor event replay' },
  { id: 'SM-04', surface: 'verifier result enforcement', file: 'verifiers/material.js', from: '  if (mismatches.length) throw new StageVerificationError(stage, mismatches);', to: '  if (false && mismatches.length) throw new StageVerificationError(stage, mismatches);', probe: 'verifierEnforcement', activated: 'compareStage mismatched material contract' },
  { id: 'SM-05', surface: 'ledger parameterization', file: 'executor/invariant-guard.js', from: "evidence.operationKind !== 'extended-parameterized-query'", to: "evidence.operationKind === 'extended-parameterized-query'", probe: 'guardReplay', activated: 'LEDGER_PARAMETERIZED_INSERT event with actual extended-query evidence' },
  { id: 'SM-06', surface: 'ledger insertion ordering', file: 'executor/invariant-guard.js', from: "  'IN_TRANSACTION_VERIFIER',\n  'LEDGER_PARAMETERIZED_INSERT',", to: "  'LEDGER_PARAMETERIZED_INSERT',\n  'IN_TRANSACTION_VERIFIER',", probe: 'guardReplay', activated: 'canonical verifier-before-ledger sequence' },
  { id: 'SM-07', surface: 'pre-commit effect reread', file: 'executor/invariant-guard.js', from: "  'EFFECT_REREAD',", to: "  'EFFECT_REREAD_MUTATED',", probe: 'guardReplay', activated: 'canonical effect reread event' },
  { id: 'SM-08', surface: 'commit ordering', file: 'executor/invariant-guard.js', from: "  'EFFECT_REREAD',\n  'COMMIT',", to: "  'COMMIT',\n  'EFFECT_REREAD',", probe: 'guardReplay', activated: 'canonical effect-reread-before-commit sequence' },
  { id: 'SM-09', surface: 'post-commit read-only verification', file: 'executor/invariant-guard.js', from: 'evidence.readOnly !== true', to: 'evidence.readOnly === true', probe: 'guardReplay', activated: 'independent read-only post-commit event' },
  { id: 'SM-10', surface: 'source hash check', file: 'envelope/validator.js', from: 'if (sha256Bytes(bytes) !== expected.sha256)', to: 'if (false && sha256Bytes(bytes) !== expected.sha256)', probe: 'sourceHash', activated: 'validateCanonicalBytes wrong canonical hash' },
  { id: 'SM-11', surface: 'payload hash check', file: 'envelope/validator.js', from: 'if (sha256Bytes(payload) !== expected.payloadSha256)', to: 'if (false && sha256Bytes(payload) !== expected.payloadSha256)', probe: 'payloadHash', activated: 'validateCanonicalBytes wrong intermediate payload hash' },
  { id: 'SM-12', surface: 'version order validation', file: 'manifest/validator.js', from: 'if (versions.length && actual.version <= versions[versions.length - 1])', to: 'if (false && versions.length && actual.version <= versions[versions.length - 1])', probe: 'versionOrder', activated: 'validateManifest distinct decreasing test-only version' },
  { id: 'SM-13', surface: 'split-state hard stop', file: 'recovery/classifier.js', from: "if ((ledger === 'exact') !== (effects === 'exact'))", to: "if (false && (ledger === 'exact') !== (effects === 'exact'))", probe: 'splitState', activated: 'classifyRecovery exact-ledger/absent-effects split' },
  { id: 'SM-14', surface: 'automatic retry prohibition', file: 'executor/invariant-guard.js', from: 'evidence.retryCount !== 0 || evidence.reconnectCount !== 0', to: 'evidence.retryCount < 0 || evidence.reconnectCount < 0', probe: 'retryProhibition', activated: 'BEGIN evidence with retryCount=1' },
];

const packagedProductionSrc = path.join(releaseRoot, 'editable-source', 'src');
const productionSrc = fs.existsSync(packagedProductionSrc) ? packagedProductionSrc : path.join(releaseRoot, 'src');
function requiredClosure(file) {
  const required = new Set([file]);
  if (file === 'envelope/validator.js') { required.add('parser/statementScanner.js'); required.add('hash/canonical.js'); }
  if (file === 'manifest/validator.js' || file === 'verifiers/material.js') required.add('hash/canonical.js');
  return [...required];
}

const results = [];
let createdCount = 0;
let cleanedCount = 0;
for (const mutation of mutations) {
  let receipt = null;
  try {
    receipt = allocateMutationWorkspace({ authority, releaseSha256, finalRunId, mutantId: mutation.id });
    createdCount += 1;
    const materialized = materializeRequiredSources(authority, receipt, requiredClosure(mutation.file));
    const caseRoot = materialized.sourceRoot;
    const target = path.join(caseRoot, mutation.file);
    const originalTarget = path.join(productionSrc, mutation.file);
    const productionBefore = sha256File(originalTarget);
    const before = fs.readFileSync(target, 'utf8');
    const occurrences = before.split(mutation.from).length - 1;
    if (occurrences !== 1) throw new Error(`${mutation.id} expected one mutation site, got ${occurrences}`);
    const after = before.replace(mutation.from, mutation.to);
    fs.writeFileSync(target, after, 'utf8');
    const originalPass = probes[mutation.probe](productionSrc);
    const mutantPass = probes[mutation.probe](caseRoot);
    const productionAfter = sha256File(originalTarget);
    const seal = sealAndCleanMutationWorkspace(authority, receipt);
    cleanedCount += 1;
    results.push({
      id: mutation.id,
      surface: mutation.surface,
      productionSourcePath: `editable-source/src/${mutation.file}`,
      productionSourceFunction: mutation.probe,
      productionSourceChanged: productionBefore !== productionAfter,
      beforeSha256: productionBefore,
      afterSha256: sha256Bytes(Buffer.from(after, 'utf8')),
      exactProductionSourceDiff: `--- a/editable-source/src/${mutation.file}\n+++ b/editable-source/src/${mutation.file}\n-${mutation.from}\n+${mutation.to}\n`,
      activatedCodePath: mutation.activated,
      originalPass,
      mutantPass,
      independentPropertyOracle: mutation.probe,
      activated: true,
      killed: originalPass === true && mutantPass === false && productionBefore === productionAfter,
      workspaceReceiptSha256: receipt.receiptSha256,
      workspaceReleaseBinding: receipt.releaseSha256,
      workspaceFinalRunBinding: receipt.finalRunId,
      workspaceMutantBinding: receipt.mutantId,
      workspaceOutsideFrozenRelease: !receipt.workspacePath.toLowerCase().startsWith(`${releaseRoot.toLowerCase()}${path.sep}`),
      copiedFiles: materialized.copiedFiles,
      workspaceSealSha256: seal.sealSha256,
      workspaceCleaned: seal.cleaned,
    });
  } catch (error) {
    let cleanupError = null;
    if (receipt && fs.existsSync(receipt.workspacePath)) {
      try { sealAndCleanMutationWorkspace(authority, receipt); cleanedCount += 1; } catch (cleanupFailure) { cleanupError = cleanupFailure.message; }
    }
    results.push({ id: mutation.id, surface: mutation.surface, activated: false, killed: false, error: `${error.name}: ${error.message}`, code: error.code || null, cleanupError });
  }
}

const residualEntries = fs.readdirSync(mutationRoot);
const result = {
  schema: 'tairet-semantic-mutation-result-v2', mutationCount: results.length,
  appliedCount: results.filter((row) => row.afterSha256).length,
  activatedCount: results.filter((row) => row.activated).length,
  killedCount: results.filter((row) => row.killed).length,
  survivorCount: results.filter((row) => !row.killed).length,
  workspaceCreatedCount: createdCount,
  workspaceCleanedCount: cleanedCount,
  workspaceResidualCount: residualEntries.length,
  releaseSha256,
  authoritySha256: authority.authoritySha256,
  results,
};
fs.writeFileSync(path.join(evidenceDir, 'semantic-mutation-manifest.json'), canonicalJson(result));
process.stdout.write(`${JSON.stringify({ mutationCount: result.mutationCount, appliedCount: result.appliedCount, activatedCount: result.activatedCount, killedCount: result.killedCount, survivorCount: result.survivorCount, workspaceResidualCount: result.workspaceResidualCount })}\n`);
process.exitCode = result.survivorCount || result.workspaceResidualCount || result.workspaceCreatedCount !== result.workspaceCleanedCount ? 1 : 0;