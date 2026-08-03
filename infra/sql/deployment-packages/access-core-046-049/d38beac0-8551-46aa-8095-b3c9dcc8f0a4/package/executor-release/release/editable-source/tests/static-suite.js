'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { canonicalJson, canonicalHash, sha256Bytes } = require('../src/hash/canonical');
const { scanStatements, SqlLexicalError } = require('../src/parser/statementScanner');
const { LEADING, TRAILING, validateCanonicalBytes, validateCanonicalFile, EnvelopeValidationError } = require('../src/envelope/validator');
const { MIGRATIONS, computeIdentityModel, PREDECESSOR } = require('../src/identity/model');
const { validateManifest, ManifestValidationError, sealManifest } = require('../src/manifest/validator');
const { classifyRecovery, RECOVERY } = require('../src/recovery/classifier');
const { verifyFrozenRelease } = require('../src/identity/release');

const executorRoot = process.env.EXECUTOR_ROOT || path.resolve(__dirname, '..', '..');
const repoRoot = process.env.TAIRET_REPO_ROOT || 'C:\\Importante\\Python\\tairet-mono-2';
const evidenceDir = process.env.EVIDENCE_DIR || path.join(executorRoot, 'development-evidence', 'static');
fs.mkdirSync(evidenceDir, { recursive: true });
const releaseManifest = JSON.parse(fs.readFileSync(process.env.RELEASE_MANIFEST || path.join(executorRoot, 'development-evidence', 'development-release-manifest.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(process.env.TEST_MANIFEST || path.join(executorRoot, 'manifests', 'development-test-manifest.json'), 'utf8'));
const productionTemplate = JSON.parse(fs.readFileSync(process.env.PRODUCTION_TEMPLATE || path.join(executorRoot, 'manifests', 'production-manifest-template.json'), 'utf8'));

const tests = [];
function test(id, surface, fn) { tests.push({ id, surface, fn }); }
function expectCode(fn, ErrorType, code) { assert.throws(fn, (error) => error instanceof ErrorType && error.code === code); }

const parserFixtures = JSON.parse(fs.readFileSync(path.join(executorRoot, 'fixtures', 'parser-adversarial', 'cases.json'), 'utf8'));
const positives = parserFixtures.positive.map((row) => [row.id, row.sql]);
for (const [id, sql] of positives) test(id, 'parser-positive', () => { const input = Buffer.from(sql); const result = scanStatements(input); assert(result.reconstructed.equals(input)); assert.equal(result.transactionControls.length, 0); });
const negatives = parserFixtures.negative.map((row) => [row.id, row.sql, row.code]);
for (const [id, sql, code] of negatives) test(id, 'parser-negative', () => expectCode(() => scanStatements(Buffer.from(sql)), SqlLexicalError, code));
const controls = parserFixtures.transactionControls;
controls.forEach((sql, index) => test(`T${String(index + 1).padStart(3, '0')}`, 'transaction-control', () => assert.equal(scanStatements(Buffer.from(sql)).transactionControls.length, 1)));

for (const migration of MIGRATIONS) test(`C${migration.logicalNumber}`, 'canonical-reconstruction', () => {
  const source = path.join(repoRoot, 'infra', 'sql', 'migrations', migration.filename);
  const result = validateCanonicalFile(source, migration);
  assert(result.parsed.reconstructed.equals(result.payload));
  assert.equal(sha256Bytes(result.payload), migration.payloadSha256);
});

function syntheticExpected(bytes) {
  const payload = bytes.subarray(LEADING.length, bytes.length - TRAILING.length);
  return { size: bytes.length, sha256: sha256Bytes(bytes), payloadSize: payload.length, payloadSha256: sha256Bytes(payload) };
}
test('E001', 'envelope', () => { const b = Buffer.from('BEGIN;\nSELECT 1;\ncommit;\n'); expectCode(() => validateCanonicalBytes(b, syntheticExpected(b)), EnvelopeValidationError, 'LEADING_ENVELOPE_MISMATCH'); });
test('E002', 'envelope', () => { const b = Buffer.from('begin;\nSELECT 1;\nCOMMIT;\n'); expectCode(() => validateCanonicalBytes(b, syntheticExpected(b)), EnvelopeValidationError, 'TRAILING_ENVELOPE_MISMATCH'); });
test('E003', 'envelope', () => { const b = Buffer.from('begin;\n/*x*/ BEGIN; SELECT 1;\ncommit;\n'); expectCode(() => validateCanonicalBytes(b, syntheticExpected(b)), EnvelopeValidationError, 'UNSAFE_TOP_LEVEL_TRANSACTION_CONTROL'); });
test('E004', 'envelope', () => { const b = Buffer.from('begin;\nSELECT 1; ROLLBACK;\ncommit;\n'); expectCode(() => validateCanonicalBytes(b, syntheticExpected(b)), EnvelopeValidationError, 'UNSAFE_TOP_LEVEL_TRANSACTION_CONTROL'); });
test('E005', 'envelope', () => { const b = Buffer.from('begin;\nSELECT 1; COMMIT;\ncommit;\n'); expectCode(() => validateCanonicalBytes(b, syntheticExpected(b)), EnvelopeValidationError, 'UNSAFE_TOP_LEVEL_TRANSACTION_CONTROL'); });
test('E006', 'envelope', () => { const b = Buffer.from('begin;\nSELECT 1;\ncommit;\n'); const e = syntheticExpected(b); e.sha256 = '0'.repeat(64); expectCode(() => validateCanonicalBytes(b, e), EnvelopeValidationError, 'SOURCE_HASH_MISMATCH'); });
test('E007', 'envelope', () => { const b = Buffer.from('begin;\nSELECT 1;\ncommit;\n'); const e = syntheticExpected(b); e.payloadSha256 = '0'.repeat(64); expectCode(() => validateCanonicalBytes(b, e), EnvelopeValidationError, 'PAYLOAD_HASH_MISMATCH'); });

const identityModel = computeIdentityModel(repoRoot, { releaseSha256: releaseManifest.releaseSha256 });
const expected = { executorReleaseIdentity: releaseManifest.releaseSha256, parserIdentity: manifest.parserIdentity, inTransactionVerifierIdentity: manifest.verifierIdentities.inTransaction, postCommitVerifierIdentity: manifest.verifierIdentities.postCommit, materialContractIdentity: manifest.verifierIdentities.materialContract, migrations: identityModel.migrations, stageOrder: MIGRATIONS.map((row) => row.logicalNumber), expectedPredecessorLedgerIdentity: PREDECESSOR };
test('M001', 'manifest', () => assert.equal(validateManifest(manifest, expected, { forExecution: true }).executable, true));
test('M002', 'manifest', () => expectCode(() => validateManifest(productionTemplate, expected, { forExecution: true }), ManifestValidationError, 'PRODUCTION_MANIFEST_UNASSIGNED'));
function mutated(change) { const body = structuredClone(manifest); delete body.manifestSha256; change(body); return sealManifest(body); }
const manifestMutations = [
  ['M003', (m) => { m.migrations[0].version = ''; }, 'MALFORMED_OR_REAL_VERSION'],
  ['M004', (m) => { m.migrations[1].version = m.migrations[0].version; }, 'DUPLICATE_VERSION'],
  ['M005', (m) => { m.migrations[1].version = '98000000000001'; }, 'NON_INCREASING_VERSION'],
  ['M006', (m) => { m.migrations[0].version = '046'; }, 'MALFORMED_OR_REAL_VERSION'],
  ['M007', (m) => { m.migrations[0].ledgerName = 'wrong'; }, 'FILENAME_NAME_MISMATCH'],
  ['M008', (m) => { m.migrations[0].canonicalSha256 = '0'.repeat(64); }, 'SOURCE_OR_PAYLOAD_IDENTITY_MISMATCH'],
  ['M009', (m) => { m.migrations[0].payloadSha256 = '0'.repeat(64); }, 'SOURCE_OR_PAYLOAD_IDENTITY_MISMATCH'],
  ['M010', (m) => { m.executorReleaseIdentity = '0'.repeat(64); }, 'EXECUTOR_IDENTITY_MISMATCH'],
  ['M011', (m) => { m.verifierIdentities.inTransaction = '0'.repeat(64); }, 'VERIFIER_IDENTITY_MISMATCH'],
  ['M012', (m) => { m.stageOrder.reverse(); }, 'STAGE_ORDER_MISMATCH'],
  ['M013', (m) => { m.recoveryPolicy.reconcileLedgerOnlyEnabled = true; }, 'UNSAFE_RECOVERY_POLICY'],
  ['M014', (m) => { m.migrations[0].orderedStatementIdentities[0].sha256 = '0'.repeat(64); }, 'ORDERED_STATEMENT_IDENTITY_MISMATCH'],
];
for (const [id, change, code] of manifestMutations) test(id, 'manifest', () => expectCode(() => validateManifest(mutated(change), expected, { forExecution: true }), ManifestValidationError, code));

const recoveryCases = [
  ['R001', { ledger: 'absent', effects: 'absent', predecessorExact: true }, RECOVERY.NOT_APPLIED_VERIFIED],
  ['R002', { ledger: 'exact', effects: 'exact', predecessorExact: true }, RECOVERY.ALREADY_APPLIED_VERIFIED],
  ['R003', { ledger: 'exact', effects: 'exact', predecessorExact: true, ambiguousCommit: true }, RECOVERY.AMBIGUOUS_COMMIT_RESOLVED_AS_COMMITTED],
  ['R004', { ledger: 'absent', effects: 'absent', predecessorExact: true, ambiguousCommit: true }, RECOVERY.AMBIGUOUS_COMMIT_RESOLVED_AS_ROLLED_BACK],
  ['R005', { ledger: 'absent', effects: 'exact', predecessorExact: true }, RECOVERY.HARD_STOP_SPLIT_STATE],
  ['R006', { ledger: 'exact', effects: 'absent', predecessorExact: true }, RECOVERY.HARD_STOP_SPLIT_STATE],
  ['R007', { ledger: 'absent', effects: 'partial', predecessorExact: true }, RECOVERY.HARD_STOP_INCOMPATIBLE_STATE],
  ['R008', { ledger: 'absent', effects: 'incompatible', predecessorExact: true }, RECOVERY.HARD_STOP_INCOMPATIBLE_STATE],
  ['R009', { ledger: 'incompatible', effects: 'absent', predecessorExact: true }, RECOVERY.HARD_STOP_INCOMPATIBLE_STATE],
  ['R010', { ledger: 'absent', effects: 'absent', predecessorExact: false }, RECOVERY.HARD_STOP_INCOMPATIBLE_STATE],
];
for (const [id, input, output] of recoveryCases) test(id, 'recovery', () => assert.equal(classifyRecovery(input), output));
test('F001', 'release', () => assert.equal(verifyFrozenRelease(executorRoot, releaseManifest).releaseSha256, releaseManifest.releaseSha256));

const rows = [];
for (const item of tests) {
  try { item.fn(); rows.push({ id: item.id, surface: item.surface, pass: true }); }
  catch (error) { rows.push({ id: item.id, surface: item.surface, pass: false, error: `${error.name}: ${error.message}` }); }
}
const parserRows = rows.filter((row) => ['parser-positive', 'parser-negative', 'transaction-control', 'canonical-reconstruction', 'envelope'].includes(row.surface));
const recoveryRows = rows.filter((row) => row.surface === 'recovery');
const result = { schema: 'tairet-static-acceptance-result-v2', testCount: rows.length, passCount: rows.filter((row) => row.pass).length, failCount: rows.filter((row) => !row.pass).length, rows };
fs.writeFileSync(path.join(evidenceDir, 'parser-test-manifest.json'), canonicalJson({ schema: 'tairet-parser-test-manifest-v2', testCount: parserRows.length, passCount: parserRows.filter((row) => row.pass).length, rows: parserRows }));
fs.writeFileSync(path.join(evidenceDir, 'recovery-test-manifest.json'), canonicalJson({ schema: 'tairet-recovery-test-manifest-v2', testCount: recoveryRows.length, passCount: recoveryRows.filter((row) => row.pass).length, rows: recoveryRows }));
fs.writeFileSync(path.join(evidenceDir, 'static-result.json'), canonicalJson(result));
process.stdout.write(`${JSON.stringify({ testCount: result.testCount, passCount: result.passCount, failCount: result.failCount })}\n`);
process.exitCode = result.failCount ? 1 : 0;
