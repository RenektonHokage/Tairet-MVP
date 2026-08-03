'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { canonicalJson, canonicalHash, sha256File } = require('../src/hash/canonical');
const { MIGRATIONS, PREDECESSOR, computeIdentityModel } = require('../src/identity/model');
const { sealManifest } = require('../src/manifest/validator');
const { validateCanonicalFile } = require('../src/envelope/validator');

const executorRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(process.env.TAIRET_REPO_ROOT || 'C:\\Importante\\Python\\tairet-mono-2');
const v1Root = path.resolve(process.env.V1_EXECUTOR_ROOT || 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\statement-aware-atomic-migration-executor-v1-008a2f38');
const v2Root = path.resolve(process.env.V2_EXECUTOR_ROOT || 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\statement-aware-atomic-migration-executor-v2-b4aad405');

function writeJson(target, value) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, canonicalJson(value), 'utf8'); }
function command(executable, args) { return childProcess.execFileSync(executable, args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true }).trim(); }
function listFiles(root, relativeBase = root) {
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`REPARSE_OR_SYMLINK_REJECTED: ${full}`);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) rows.push({ path: path.relative(relativeBase, full).split(path.sep).join('/'), size: fs.statSync(full).size, sha256: sha256File(full) });
      else throw new Error(`UNSUPPORTED_ENTRY: ${full}`);
    }
  }
  visit(root); return rows;
}
function baseline(root, schema) { const files = listFiles(root); return { schema, root, fileCount: files.length, totalBytes: files.reduce((sum, row) => sum + row.size, 0), inventorySha256: canonicalHash(files), files }; }

if (command('git', ['-C', repoRoot, 'branch', '--show-current']) !== 'main') throw new Error('REPOSITORY_BRANCH_MISMATCH');
if (command('git', ['-C', repoRoot, 'rev-parse', 'HEAD']) !== '715ad1cea644e45d688dca785de09c83e1956413') throw new Error('REPOSITORY_HEAD_MISMATCH');
if (command('git', ['-C', repoRoot, 'diff', '--name-only']) || command('git', ['-C', repoRoot, 'diff', '--cached', '--name-only'])) throw new Error('REPOSITORY_TRACKED_DIFF_PRESENT');

const postgresImageId = command('docker', ['image', 'inspect', '--format', '{{.Id}}', 'public.ecr.aws/supabase/postgres:17.6.1.143']);
const nodeImageId = command('docker', ['image', 'inspect', '--format', '{{.Id}}', 'mcr.microsoft.com/devcontainers/javascript-node:22']);
const dependencyInventory = {
  schema: 'tairet-local-executor-dependency-inventory-v3', node: process.version, nodeExecutable: process.execPath,
  pwsh: command('pwsh', ['--version']), databaseClient: { implementation: 'built-in node:net plus byte-exact vendored pg-protocol', pgProtocolVersion: JSON.parse(fs.readFileSync(path.join(executorRoot, 'vendor', 'pg-protocol', 'package.json'), 'utf8')).version, pgProtocolPackageSha256: sha256File(path.join(executorRoot, 'vendor', 'pg-protocol', 'package.json')), physicalConnectionInvariant: 1, simpleQueryPayload: true, parameterizedLedgerInsertion: true, automaticRetry: false, automaticReconnect: false },
  dockerImages: {
    postgres: { reference: 'public.ecr.aws/supabase/postgres:17.6.1.143', expectedImageId: 'sha256:80d7b27c3e8d77cfa7226eee9508671796da214781ff15a35b3670d7ad5ee453', observedImageId: postgresImageId, pullPolicy: 'never' },
    node: { reference: 'mcr.microsoft.com/devcontainers/javascript-node:22', expectedImageId: 'sha256:25a1f18c8f075b597b309c6fc7c09657353fd353b6bf912b48158b2af72b2b9c', observedImageId: nodeImageId, pullPolicy: 'never' },
  },
  externalNetworkPermitted: false, installPerformed: false, productionContact: 0,
};
if (postgresImageId !== dependencyInventory.dockerImages.postgres.expectedImageId || nodeImageId !== dependencyInventory.dockerImages.node.expectedImageId) throw new Error('LOCAL_IMAGE_IDENTITY_MISMATCH');
writeJson(path.join(executorRoot, 'manifests', 'local-executor-dependency-inventory.json'), dependencyInventory);

const runtimeIdentity = { node: process.version, platform: `${process.platform}-${process.arch}`, pgProtocolVersion: dependencyInventory.databaseClient.pgProtocolVersion, postgresTarget: '17.6', postgresImageId, nodeClientImageId: nodeImageId };
const entries = [
  ...listFiles(path.join(executorRoot, 'editable-source'), executorRoot),
  ...listFiles(path.join(executorRoot, 'vendor'), executorRoot),
  ...listFiles(path.join(executorRoot, 'fixtures'), executorRoot),
  ...listFiles(path.join(executorRoot, 'postgres-fixtures'), executorRoot),
].sort((a, b) => a.path.localeCompare(b.path));
const releaseBody = { schema: 'tairet-statement-aware-atomic-executor-release-v2', executorVersion: '3.0.0-development', runtimeIdentity, entries };
const releaseManifest = { ...releaseBody, releaseSha256: canonicalHash(releaseBody), classification: 'V3_DEVELOPMENT_UNFROZEN', productionContact: 0 };
writeJson(path.join(executorRoot, 'development-evidence', 'development-release-manifest.json'), releaseManifest);

const verifierIdentities = {
  inTransaction: sha256File(path.join(executorRoot, 'editable-source', 'src', 'verifiers', 'in-transaction.js')),
  postCommit: sha256File(path.join(executorRoot, 'editable-source', 'src', 'verifiers', 'post-commit.js')),
  materialContract: sha256File(path.join(executorRoot, 'fixtures', 'integration', 'independent-stage-contract.json')),
};
const parserIdentity = sha256File(path.join(executorRoot, 'editable-source', 'src', 'parser', 'statementScanner.js'));
const identityModel = computeIdentityModel(repoRoot, { version: '3.0.0-development', releaseSha256: releaseManifest.releaseSha256, parserIdentity, verifierIdentities, runtimeIdentity });
writeJson(path.join(executorRoot, 'manifests', 'executor-v3-identity-model.json'), identityModel);
const migrationRows = identityModel.migrations.map((identity, index) => {
  const migration = MIGRATIONS[index]; const validated = validateCanonicalFile(path.join(repoRoot, 'infra', 'sql', 'migrations', migration.filename), migration);
  return { logicalNumber: migration.logicalNumber, filename: identity.canonicalSourceIdentity.filename, ledgerName: migration.ledgerName, version: migration.testVersion, canonicalSize: identity.canonicalSourceIdentity.size, canonicalSha256: identity.canonicalSourceIdentity.sha256, payloadSize: identity.intermediatePayloadIdentity.size, payloadSha256: identity.intermediatePayloadIdentity.sha256, statementCount: identity.intermediatePayloadIdentity.statementCount, orderedStatementIdentities: identity.intermediatePayloadIdentity.orderedStatementIdentities, orderedStatements: validated.parsed.statements.map((row) => row.statement.toString('utf8')) };
});
const common = {
  manifestFormat: 'TAIRET_STATEMENT_AWARE_ATOMIC_MIGRATION_MANIFEST', manifestVersion: 1,
  target: { projectIdentity: 'LOCAL_DISPOSABLE_POSTGRESQL_17_6_ONLY', databaseIdentity: 'NON_DEPLOYABLE_DISPOSABLE_DATABASE' },
  expectedPredecessorLedgerIdentity: PREDECESSOR, executorReleaseIdentity: releaseManifest.releaseSha256, parserIdentity, verifierIdentities,
  stageOrder: MIGRATIONS.map((row) => row.logicalNumber), recoveryPolicy: { reconcileLedgerOnlyEnabled: false, ordinaryRepairEnabled: false, retryEnabled: false, ambiguousCommitRequiresIndependentRead: true },
  timeoutLockPolicy: { statementTimeoutMs: 120000, lockTimeoutMs: 5000, idleInTransactionTimeoutMs: 180000 },
};
writeJson(path.join(executorRoot, 'manifests', 'development-test-manifest.json'), sealManifest({ ...common, classification: 'NON_DEPLOYABLE_TEST_ONLY', executable: true, packagingEventIdentity: 'NON_DEPLOYABLE_TEST_ONLY_DETERMINISTIC_V3', migrations: migrationRows }));
writeJson(path.join(executorRoot, 'manifests', 'production-manifest-template.json'), sealManifest({ ...common, classification: 'PRODUCTION_TEMPLATE_UNASSIGNED', executable: false, packagingEventIdentity: 'UNASSIGNED', executorReleaseIdentity: 'UNASSIGNED', migrations: migrationRows.map((row) => ({ ...row, version: 'UNASSIGNED', orderedStatements: [] })) }));
writeJson(path.join(executorRoot, 'manifests', 'authorized-input-integrity.json'), { schema: 'tairet-authorized-input-integrity-v3', repository: { path: repoRoot, branch: 'main', head: '715ad1cea644e45d688dca785de09c83e1956413', trackedDiff: [], stagedDiff: [] }, canonicalMigrations: identityModel.migrations.map((row) => row.canonicalSourceIdentity), intermediatePayloads: identityModel.migrations.map((row) => row.intermediatePayloadIdentity), productionContact: 0 });
writeJson(path.join(executorRoot, 'manifests', 'v1-tree-baseline.json'), baseline(v1Root, 'tairet-v1-immutable-tree-baseline-v3'));
writeJson(path.join(executorRoot, 'manifests', 'v2-tree-baseline.json'), baseline(v2Root, 'tairet-v2-immutable-tree-baseline-v3'));
writeJson(path.join(executorRoot, 'manifests', 'v2-provenance.json'), { schema: 'tairet-v2-provenance-v3', root: v2Root, frozenReleaseIdentity: '2b4668c5f1671114a856589298e0102b238841f53890b92ca5dde666eb7a17c8', artifactHashManifestIdentity: '0f3e00a85b03c44472e49cf4ae2031a6b2a1dc1be28170e1914a6f09bc250120', modified: false, rerun: false });
writeJson(path.join(executorRoot, 'manifests', 'final-suite-contract.json'), { schema: 'tairet-final-suite-contract-v3', requiredSuiteIds: ['STATIC','PARSER','RECOVERY','ATOMICITY','SEMANTIC_MUTATION','CLEANUP'], expectedCounts: { static: 77, parser: 36, recovery: 10, atomicity: 25, semanticMutations: 14 }, orchestrationAcceptanceCount: 23, finalExecutionCount: 1, finalRerunCount: 0, realDeploymentVersionCountAssigned: 0, productionContact: 0 });
fs.copyFileSync(path.join(executorRoot, 'development-evidence', 'v2-final-orchestration-forensics.json'), path.join(executorRoot, 'manifests', 'v2-final-orchestration-forensics.json'));
process.stdout.write(`${JSON.stringify({ executorRoot, releaseSha256: releaseManifest.releaseSha256, releaseEntryCount: entries.length, v1FileCount: readJsonCount('v1-tree-baseline.json'), v2FileCount: readJsonCount('v2-tree-baseline.json'), productionContact: 0 })}\n`);

function readJsonCount(name) { return JSON.parse(fs.readFileSync(path.join(executorRoot, 'manifests', name), 'utf8')).fileCount; }
