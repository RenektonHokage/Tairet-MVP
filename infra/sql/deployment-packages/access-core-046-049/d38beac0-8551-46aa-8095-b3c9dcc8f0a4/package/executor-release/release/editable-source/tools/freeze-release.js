'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { canonicalJson, canonicalHash, sha256File } = require('../src/hash/canonical');
const { MIGRATIONS, PREDECESSOR, computeIdentityModel } = require('../src/identity/model');
const { validateCanonicalFile } = require('../src/envelope/validator');
const { sealManifest } = require('../src/manifest/validator');
const { verifyRelease } = require('../src/result/finalizer');

const executorRoot = path.resolve(__dirname, '..', '..');
const repoRoot = path.resolve(process.env.TAIRET_REPO_ROOT || 'C:\\Importante\\Python\\tairet-mono-2');
const releaseRoot = path.join(executorRoot, 'frozen-release', 'release');
if (fs.existsSync(releaseRoot)) throw new Error('FROZEN_RELEASE_ALREADY_EXISTS');
if (fs.existsSync(path.join(executorRoot, 'final-run', 'final-execution-started.json'))) throw new Error('FINAL_EXECUTION_ALREADY_EXISTS');

function read(target) { return JSON.parse(fs.readFileSync(target, 'utf8')); }
function write(target, value) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, canonicalJson(value), { encoding: 'utf8', flag: 'wx' }); }
function command(executable, args) { return childProcess.execFileSync(executable, args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true }).trim(); }
function listFiles(root, relativeBase = root) {
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`REPARSE_OR_SYMLINK_REJECTED: ${full}`);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) rows.push({ path: path.relative(relativeBase, full).split(path.sep).join('/'), size: fs.statSync(full).size, sha256: sha256File(full) });
      else throw new Error(`UNSUPPORTED_RELEASE_ENTRY: ${full}`);
    }
  }
  visit(root); return rows;
}
function copyManifest(name, destinationName = name) { const source = path.join(executorRoot, 'manifests', name); if (!fs.existsSync(source)) throw new Error(`MISSING_V3_MANIFEST: ${name}`); fs.copyFileSync(source, path.join(releaseRoot, 'manifests', destinationName), fs.constants.COPYFILE_EXCL); }

if (command('git', ['-C', repoRoot, 'branch', '--show-current']) !== 'main' || command('git', ['-C', repoRoot, 'rev-parse', 'HEAD']) !== '715ad1cea644e45d688dca785de09c83e1956413') throw new Error('REPOSITORY_IDENTITY_MISMATCH');
if (command('git', ['-C', repoRoot, 'diff', '--name-only']) || command('git', ['-C', repoRoot, 'diff', '--cached', '--name-only'])) throw new Error('REPOSITORY_TRACKED_DIFF_PRESENT');
const accepted = read(path.join(executorRoot, 'development-evidence', 'accepted-development-run.json'));
if (accepted.execution_count !== 1 || accepted.rerun_count !== 0 || accepted.production_contact !== 0) throw new Error('DEVELOPMENT_RUN_NOT_ACCEPTED');
if (!accepted.result_paths.every((target, index) => fs.existsSync(target) && sha256File(target) === accepted.result_hashes[index])) throw new Error('DEVELOPMENT_RESULT_BINDING_MISMATCH');
const developmentOrchestration = read(accepted.orchestration_result_path);
if (developmentOrchestration.ready !== true || developmentOrchestration.final_orchestration_result !== 'PASS') throw new Error('DEVELOPMENT_ORCHESTRATION_FAILED');
const acceptance = read(path.join(executorRoot, 'development-evidence', 'orchestration-acceptance-result.json'));
if (acceptance.test_count !== 23 || acceptance.pass_count !== 23 || acceptance.fail_count !== 0) throw new Error('ORCHESTRATION_ACCEPTANCE_FAILED');
const environment = read(path.join(executorRoot, 'manifests', 'final-environment-contract.json'));
if (environment.FINAL_ENVIRONMENT_CONTRACT !== 'PASS') throw new Error('FINAL_ENVIRONMENT_CONTRACT_FAILED');

fs.mkdirSync(releaseRoot, { recursive: false });
for (const relative of ['editable-source','vendor','fixtures','postgres-fixtures']) fs.cpSync(path.join(executorRoot, relative), path.join(releaseRoot, relative), { recursive: true, errorOnExist: true });
const entries = [
  ...listFiles(path.join(releaseRoot, 'editable-source'), releaseRoot), ...listFiles(path.join(releaseRoot, 'vendor'), releaseRoot),
  ...listFiles(path.join(releaseRoot, 'fixtures'), releaseRoot), ...listFiles(path.join(releaseRoot, 'postgres-fixtures'), releaseRoot),
].sort((a, b) => a.path.localeCompare(b.path));
const dependencies = read(path.join(executorRoot, 'manifests', 'local-executor-dependency-inventory.json'));
if (dependencies.dockerImages.postgres.observedImageId !== dependencies.dockerImages.postgres.expectedImageId || dependencies.dockerImages.node.observedImageId !== dependencies.dockerImages.node.expectedImageId) throw new Error('LOCAL_DEPENDENCY_IDENTITY_MISMATCH');
const runtimeIdentity = { node: process.version, platform: `${process.platform}-${process.arch}`, pgProtocolVersion: dependencies.databaseClient.pgProtocolVersion, postgresTarget: '17.6', postgresImageId: dependencies.dockerImages.postgres.expectedImageId, nodeClientImageId: dependencies.dockerImages.node.expectedImageId };
const releaseBody = { schema: 'tairet-statement-aware-atomic-executor-release-v2', executorVersion: '3.0.0', runtimeIdentity, entries };
const releaseSha256 = canonicalHash(releaseBody);
const entryHash = (relative) => { const row = entries.find((entry) => entry.path === relative); if (!row) throw new Error(`MISSING_RELEASE_ENTRY: ${relative}`); return row.sha256; };
const verifierIdentities = { inTransaction: entryHash('editable-source/src/verifiers/in-transaction.js'), postCommit: entryHash('editable-source/src/verifiers/post-commit.js'), materialContract: entryHash('fixtures/integration/independent-stage-contract.json') };
const parserIdentity = entryHash('editable-source/src/parser/statementScanner.js');
const identityModel = computeIdentityModel(repoRoot, { version: '3.0.0', releaseSha256, parserIdentity, verifierIdentities, runtimeIdentity });
const migrationRows = identityModel.migrations.map((identity, index) => {
  const migration = MIGRATIONS[index]; const validated = validateCanonicalFile(path.join(repoRoot, 'infra', 'sql', 'migrations', migration.filename), migration);
  return { logicalNumber: migration.logicalNumber, filename: identity.canonicalSourceIdentity.filename, ledgerName: migration.ledgerName, version: migration.testVersion, canonicalSize: identity.canonicalSourceIdentity.size, canonicalSha256: identity.canonicalSourceIdentity.sha256, payloadSize: identity.intermediatePayloadIdentity.size, payloadSha256: identity.intermediatePayloadIdentity.sha256, statementCount: identity.intermediatePayloadIdentity.statementCount, orderedStatementIdentities: identity.intermediatePayloadIdentity.orderedStatementIdentities, orderedStatements: validated.parsed.statements.map((row) => row.statement.toString('utf8')) };
});
const common = {
  manifestFormat: 'TAIRET_STATEMENT_AWARE_ATOMIC_MIGRATION_MANIFEST', manifestVersion: 1,
  target: { projectIdentity: 'LOCAL_DISPOSABLE_POSTGRESQL_17_6_ONLY', databaseIdentity: 'NON_DEPLOYABLE_DISPOSABLE_DATABASE' },
  expectedPredecessorLedgerIdentity: PREDECESSOR, executorReleaseIdentity: releaseSha256, parserIdentity, verifierIdentities,
  stageOrder: MIGRATIONS.map((row) => row.logicalNumber), recoveryPolicy: { reconcileLedgerOnlyEnabled: false, ordinaryRepairEnabled: false, retryEnabled: false, ambiguousCommitRequiresIndependentRead: true },
  timeoutLockPolicy: { statementTimeoutMs: 120000, lockTimeoutMs: 5000, idleInTransactionTimeoutMs: 180000 },
};
fs.mkdirSync(path.join(releaseRoot, 'manifests'), { recursive: false });
write(path.join(releaseRoot, 'manifests', 'test-manifest.json'), sealManifest({ ...common, classification: 'NON_DEPLOYABLE_TEST_ONLY', executable: true, packagingEventIdentity: 'NON_DEPLOYABLE_TEST_ONLY_FROZEN_V3', migrations: migrationRows }));
write(path.join(releaseRoot, 'manifests', 'production-manifest-template.json'), sealManifest({ ...common, classification: 'PRODUCTION_TEMPLATE_UNASSIGNED', executable: false, packagingEventIdentity: 'UNASSIGNED', executorReleaseIdentity: 'UNASSIGNED', migrations: migrationRows.map((row) => ({ ...row, version: 'UNASSIGNED', orderedStatements: [] })) }));
write(path.join(releaseRoot, 'manifests', 'executor-v3-identity-model.json'), identityModel);
const manifestNames = [
  'authorized-input-integrity.json','final-environment-contract.json','final-suite-contract.json','path-authority-spec.json','path-contract-test-matrix.json',
  'reuse-and-change-manifest.json','suite-result-protocol.json','result-channel-implementation.json','suite-wrapper-evidence-spec.json',
  'finalizer-implementation.json','orchestration-acceptance-matrix.json','suite-isolation-spec.json','v1-tree-baseline.json','v2-tree-baseline.json',
  'v2-provenance.json','v2-final-orchestration-forensics.json','local-executor-dependency-inventory.json','protocol-validation-result.json',
];
for (const name of manifestNames) copyManifest(name);
fs.copyFileSync(path.join(executorRoot, 'development-evidence', 'orchestration-acceptance-result.json'), path.join(releaseRoot, 'manifests', 'development-orchestration-acceptance-result.json'), fs.constants.COPYFILE_EXCL);
const generatedNames = ['test-manifest.json','production-manifest-template.json','executor-v3-identity-model.json',...manifestNames,'development-orchestration-acceptance-result.json'];
const generatedArtifactBindings = Object.fromEntries(generatedNames.map((name) => [name.replace(/\.json$/, ''), { path: `manifests/${name}`, sha256: sha256File(path.join(releaseRoot, 'manifests', name)) }]));
const frozenManifest = {
  ...releaseBody, releaseSha256, classification: 'FROZEN_NON_DEPLOYABLE_LOCAL_EXECUTOR_V3_RELEASE', immutableByHash: true, immutableByReadOnlyAttribute: true,
  developmentGateBindings: { acceptedDevelopmentRunSha256: sha256File(path.join(executorRoot, 'development-evidence', 'accepted-development-run.json')), orchestrationAcceptanceSha256: sha256File(path.join(executorRoot, 'development-evidence', 'orchestration-acceptance-result.json')), finalEnvironmentSha256: sha256File(path.join(executorRoot, 'manifests', 'final-environment-contract.json')), protocolValidationSha256: sha256File(path.join(executorRoot, 'manifests', 'protocol-validation-result.json')) },
  generatedArtifactBindings, testOnlyVersions: [PREDECESSOR.version, ...MIGRATIONS.map((row) => row.testVersion)], realDeploymentVersionCountAssigned: 0, productionManifestCreated: false, productionContact: 0,
};
write(path.join(releaseRoot, 'frozen-release-manifest.json'), frozenManifest);
verifyRelease(releaseRoot, frozenManifest);
const allFiles = listFiles(releaseRoot).map((row) => path.join(releaseRoot, ...row.path.split('/')));
for (const target of allFiles) { fs.chmodSync(target, 0o444); childProcess.execFileSync('attrib.exe', ['+R', target], { windowsHide: true }); }
childProcess.execFileSync('attrib.exe', ['+R', releaseRoot], { windowsHide: true });
const nonReadOnlyCount = Number(childProcess.execFileSync('pwsh', ['-NoProfile', '-Command', "$bad=@(Get-ChildItem -File -Recurse -Force -LiteralPath $env:TAIRET_READONLY_ROOT | Where-Object { -not ($_.Attributes -band [IO.FileAttributes]::ReadOnly) }); $bad.Count"], { encoding: 'utf8', windowsHide: true, env: { ...process.env, TAIRET_READONLY_ROOT: releaseRoot } }).trim());
if (nonReadOnlyCount !== 0) throw new Error(`READ_ONLY_SEAL_FAILED_${nonReadOnlyCount}`);
write(path.join(executorRoot, 'frozen-release', 'freeze-record.json'), { schema: 'tairet-freeze-record-v3', releaseRoot, releaseSha256, releaseManifestSha256: sha256File(path.join(releaseRoot, 'frozen-release-manifest.json')), entryCount: entries.length, generatedArtifactBindingCount: Object.keys(generatedArtifactBindings).length, readOnlyFileCount: allFiles.length, nonReadOnlyFileCount: nonReadOnlyCount, finalExecutionCount: 0, productionContact: 0 });
process.stdout.write(`${JSON.stringify({ releaseRoot, releaseSha256, entryCount: entries.length, readOnlyFileCount: allFiles.length, testOnlyVersionCount: frozenManifest.testOnlyVersions.length, productionContact: 0 })}\n`);
