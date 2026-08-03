'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { canonicalJson } = require('../src/hash/canonical');
const { ProtocolClient } = require('../src/db/protocol-client');
const { executeAtomicStage, AtomicStageError, ledgerInsertSql } = require('../src/executor/atomic-stage');
const { validateCanonicalFile } = require('../src/envelope/validator');
const { MIGRATIONS } = require('../src/identity/model');
const { sealManifest } = require('../src/manifest/validator');
const { RECOVERY } = require('../src/recovery/classifier');

const executorRoot = process.env.EXECUTOR_ROOT || '/executor';
const repoRoot = process.env.TAIRET_REPO_ROOT || '/repo';
const evidenceDir = process.env.EVIDENCE_DIR || path.join(executorRoot, 'development-evidence', 'integration');
const releaseManifestPath = process.env.RELEASE_MANIFEST || path.join(executorRoot, 'development-evidence', 'development-release-manifest.json');
const testManifestPath = process.env.TEST_MANIFEST || path.join(executorRoot, 'manifests', 'development-test-manifest.json');
const contractPath = process.env.STAGE_CONTRACT || path.join(executorRoot, 'fixtures', 'integration', 'independent-stage-contract.json');
const templateDb = process.env.TEMPLATE_DATABASE || 'template_executor_v2';
const passId = process.env.PASS_ID || 'dev001';
if (!/^[a-z0-9_]{1,20}$/.test(passId)) throw new Error('invalid PASS_ID');
fs.mkdirSync(evidenceDir, { recursive: true });

const releaseManifest = JSON.parse(fs.readFileSync(releaseManifestPath, 'utf8'));
const baseManifest = JSON.parse(fs.readFileSync(testManifestPath, 'utf8'));
const frozenContract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
const baseConnection = { host: process.env.PGHOST || 'pg', port: Number(process.env.PGPORT || 5432), user: process.env.PGUSER || 'supabase_admin', password: process.env.PGPASSWORD || 'NON_DEPLOYABLE_LOCAL_ONLY' };

const created = [];
let dbSequence = 0;
async function adminQuery(sql) {
  const client = new ProtocolClient({ ...baseConnection, database: 'postgres', applicationName: 'tairet-atomic-executor-v2/test-admin' });
  await client.connect();
  try { return await client.simpleQuery(sql); } finally { await client.close(); }
}
function safeDb(name) { if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error('unsafe database identifier'); return `"${name}"`; }
async function createDb(label) {
  dbSequence += 1;
  const name = `ex_${passId}_${String(dbSequence).padStart(3, '0')}_${label}`.slice(0, 63);
  await adminQuery(`CREATE DATABASE ${safeDb(name)} TEMPLATE ${safeDb(templateDb)};`);
  created.push(name);
  return name;
}
async function dropDb(name) {
  await adminQuery(`DROP DATABASE IF EXISTS ${safeDb(name)} WITH (FORCE);`);
  const index = created.indexOf(name); if (index >= 0) created.splice(index, 1);
}
function options(db, logicalNumber, overrides = {}) {
  return { repoRoot, releaseRoot: executorRoot, releaseManifest, manifest: baseManifest, logicalNumber, frozenContract, connectionConfig: { ...baseConnection, database: db }, ...overrides };
}
async function withDb(label, fn) { const db = await createDb(label); try { return await fn(db); } finally { await dropDb(db); } }
async function dbQuery(db, sql, values = null) {
  const client = new ProtocolClient({ ...baseConnection, database: db, applicationName: 'tairet-atomic-executor-v2/test-fixture' });
  await client.connect();
  try { return values ? await client.extendedQuery(sql, values) : await client.simpleQuery(sql); } finally { await client.close(); }
}
function mutateManifest(change) { const body = structuredClone(baseManifest); delete body.manifestSha256; change(body); return sealManifest(body); }

const rows = [];
async function test(id, description, fn) {
  try { const evidence = await fn(); rows.push({ id, description, pass: true, evidence }); }
  catch (error) { rows.push({ id, description, pass: false, error: `${error.name}: ${error.message}`, code: error.code || null, evidence: error.evidence || null }); }
}
async function requireFailure(call, expectedCode, requireRollback = false) {
  try { await call(); assert.fail(`expected ${expectedCode}`); }
  catch (error) {
    assert.equal(error.code, expectedCode, `unexpected error type ${error.constructor.name}`);
    if (requireRollback) {
      assert(error instanceof AtomicStageError, `rollback-bearing failure must be AtomicStageError, got ${error.constructor.name}`);
      assert.equal(error.evidence.rollback?.pass, true, 'rollback oracle must pass');
    }
    return { code: error.code, rollback: error.evidence?.rollback || null, mutationConnection: error.evidence?.mutationConnection || null };
  }
}
function assertApplied(result) {
  assert.equal(result.status, 'PASS'); assert.equal(result.classification, 'APPLIED_AND_VERIFIED'); assert.equal(result.commitCount, 1);
  assert.equal(result.mutationConnection.physicalConnectionCount, 1); assert.equal(result.mutationConnection.retryCount, 0); assert.equal(result.mutationConnection.reconnectCount, 0);
  assert(result.mutationConnection.operationKinds.includes('extended-parameterized-query')); assert.equal(result.postCommitConnection.physicalConnectionCount, 1);
  assert.notEqual(result.mutationConnection.connectionId, result.postCommitConnection.connectionId); assert.equal(result.postCommit.readOnly, true);
}

async function main() {
  await test('A001', 'normal 046', () => withDb('normal046', async (db) => { const r = await executeAtomicStage(options(db, '046')); assertApplied(r); return r; }));
  await test('A002', 'normal 046 to 049 chain', () => withDb('chain', async (db) => { const stages = []; for (const n of ['046', '047', '048', '049']) { const r = await executeAtomicStage(options(db, n)); assertApplied(r); stages.push({ logicalNumber: n, classification: r.classification, commitCount: r.commitCount, mutationConnection: r.mutationConnection, postCommitConnection: r.postCommitConnection }); } return { stages }; }));
  await test('A003', 'migration statement failure rolls back', () => withDb('stmtfail', (db) => requireFailure(() => executeAtomicStage(options(db, '046', { faultPlan: { migrationStatementFailure: true } })), 'POSTGRES_ERROR', true)));
  await test('A004', 'in-transaction verifier failure rolls back', () => withDb('verifyfail', (db) => requireFailure(() => executeAtomicStage(options(db, '046', { faultPlan: { verifierFailure: true } })), 'STAGE_VERIFICATION_FAILED', true)));
  await test('A005', 'ledger insertion endpoint failure rolls back', () => withDb('ledgerfail', (db) => requireFailure(() => executeAtomicStage(options(db, '046', { faultPlan: { ledgerInsertFailure: true } })), 'POSTGRES_ERROR', true)));
  await test('A006', 'ledger reread mismatch rolls back', () => withDb('ledgermismatch', (db) => requireFailure(() => executeAtomicStage(options(db, '046', { faultPlan: { ledgerRereadMismatch: true } })), 'LEDGER_REREAD_MISMATCH', true)));
  await test('A007', 'effect reread mismatch rolls back', () => withDb('effectmismatch', (db) => requireFailure(() => executeAtomicStage(options(db, '046', { faultPlan: { effectRereadMismatch: true } })), 'STAGE_VERIFICATION_FAILED', true)));
  await test('A008', 'cancellation before commit rolls back', () => withDb('cancel', (db) => requireFailure(() => executeAtomicStage(options(db, '046', { faultPlan: { cancelBeforeCommit: true } })), 'POSTGRES_ERROR', true)));
  await test('A009', 'disconnect before commit resolves rolled back', () => withDb('disconnect', async (db) => { const r = await executeAtomicStage(options(db, '046', { faultPlan: { disconnectBeforeCommit: true } })); assert.equal(r.classification, RECOVERY.AMBIGUOUS_COMMIT_RESOLVED_AS_ROLLED_BACK); assert.equal(r.commitCount, 0); return r; }));
  await test('A010', 'commit success with simulated lost ACK resolves committed', () => withDb('lostack', async (db) => { const r = await executeAtomicStage(options(db, '046', { faultPlan: { simulateLostCommitAck: true } })); assert.equal(r.classification, RECOVERY.AMBIGUOUS_COMMIT_RESOLVED_AS_COMMITTED); assert.equal(r.commitCount, 1); return r; }));
  await test('A011', 'second invocation is already-applied verified', () => withDb('second', async (db) => { const first = await executeAtomicStage(options(db, '046')); assertApplied(first); const second = await executeAtomicStage(options(db, '046')); assert.equal(second.classification, RECOVERY.ALREADY_APPLIED_VERIFIED); assert.equal(second.commitCount, 0); return { first: first.classification, second: second.classification }; }));
  await test('A012', 'out-of-order migration hard stops', () => withDb('outorder', (db) => requireFailure(() => executeAtomicStage(options(db, '047')), RECOVERY.HARD_STOP_INCOMPATIBLE_STATE)));
  await test('A013', 'version collision hard stops', () => withDb('versioncollision', async (db) => { await dbQuery(db, `INSERT INTO supabase_migrations.schema_migrations VALUES ('99000000000046','conflict',ARRAY['conflict'])`); return requireFailure(() => executeAtomicStage(options(db, '046')), RECOVERY.HARD_STOP_INCOMPATIBLE_STATE); }));
  await test('A014', 'name mismatch manifest rejected', () => withDb('namemismatch', (db) => requireFailure(() => executeAtomicStage(options(db, '046', { manifest: mutateManifest((m) => { m.migrations[0].ledgerName = 'wrong'; }) })), 'FILENAME_NAME_MISMATCH')));
  await test('A015', 'statements-array mismatch hard stops', () => withDb('arraymismatch', async (db) => { const m = baseManifest.migrations[0]; await dbQuery(db, ledgerInsertSql(1), [m.version, m.ledgerName, 'mismatch']); return requireFailure(() => executeAtomicStage(options(db, '046')), RECOVERY.HARD_STOP_INCOMPATIBLE_STATE); }));
  await test('A016', 'source identity tampering rejected', () => withDb('sourcetamper', (db) => requireFailure(() => executeAtomicStage(options(db, '046', { manifest: mutateManifest((m) => { m.migrations[0].canonicalSha256 = '0'.repeat(64); }) })), 'SOURCE_OR_PAYLOAD_IDENTITY_MISMATCH')));
  await test('A017', 'payload identity tampering rejected', () => withDb('payloadtamper', (db) => requireFailure(() => executeAtomicStage(options(db, '046', { manifest: mutateManifest((m) => { m.migrations[0].payloadSha256 = '0'.repeat(64); }) })), 'SOURCE_OR_PAYLOAD_IDENTITY_MISMATCH')));
  await test('A018', 'verifier identity mismatch rejected', () => withDb('verifierid', (db) => requireFailure(() => executeAtomicStage(options(db, '046', { manifest: mutateManifest((m) => { m.verifierIdentities.inTransaction = '0'.repeat(64); }) })), 'VERIFIER_IDENTITY_MISMATCH')));
  await test('A019', 'executor identity mismatch rejected', () => withDb('executorid', (db) => requireFailure(() => executeAtomicStage(options(db, '046', { manifest: mutateManifest((m) => { m.executorReleaseIdentity = '0'.repeat(64); }) })), 'EXECUTOR_IDENTITY_MISMATCH')));
  await test('A020', 'effects exact and ledger absent hard stops split state', () => withDb('effectsonly', async (db) => { const client = new ProtocolClient({ ...baseConnection, database: db }); await client.connect(); try { const migration = MIGRATIONS[0]; const payload = validateCanonicalFile(path.join(repoRoot, 'infra', 'sql', 'migrations', migration.filename), migration).payload.toString('utf8'); await client.simpleQuery('BEGIN;'); await client.simpleQuery(payload); await client.simpleQuery('COMMIT;'); } finally { await client.close(); } return requireFailure(() => executeAtomicStage(options(db, '046')), RECOVERY.HARD_STOP_SPLIT_STATE); }));
  await test('A021', 'ledger exact and effects absent hard stops split state', () => withDb('ledgeronly', async (db) => { const m = baseManifest.migrations[0]; await dbQuery(db, ledgerInsertSql(m.orderedStatements.length), [m.version, m.ledgerName, ...m.orderedStatements]); return requireFailure(() => executeAtomicStage(options(db, '046')), RECOVERY.HARD_STOP_SPLIT_STATE); }));
  await test('A022', 'partial effects hard stop incompatible', () => withDb('partial', async (db) => { await dbQuery(db, 'CREATE TABLE public.access_order_fulfillments(order_id uuid);'); return requireFailure(() => executeAtomicStage(options(db, '046')), RECOVERY.HARD_STOP_INCOMPATIBLE_STATE); }));
  await test('A023', 'incompatible effects hard stop', () => withDb('incompatible', async (db) => { await dbQuery(db, 'COMMENT ON SCHEMA public IS \'NON_DEPLOYABLE_TEST_ONLY_INCOMPATIBLE\';'); return requireFailure(() => executeAtomicStage(options(db, '046')), RECOVERY.HARD_STOP_INCOMPATIBLE_STATE); }));
  await test('A024', 'unexpected predecessor ledger hard stop', () => withDb('predecessor', async (db) => { await dbQuery(db, `UPDATE supabase_migrations.schema_migrations SET name='wrong' WHERE version='99000000000045';`); return requireFailure(() => executeAtomicStage(options(db, '046')), RECOVERY.HARD_STOP_INCOMPATIBLE_STATE); }));
  await test('A025', 'conflicting exact-version statements hard stop', () => withDb('conflictarray', async (db) => { const m = baseManifest.migrations[0]; await dbQuery(db, ledgerInsertSql(1), [m.version, m.ledgerName, 'conflicting']); return requireFailure(() => executeAtomicStage(options(db, '046')), RECOVERY.HARD_STOP_INCOMPATIBLE_STATE); }));
}

(async () => {
  try { await main(); }
  finally { for (const name of [...created].reverse()) { try { await dropDb(name); } catch (error) { rows.push({ id: `CLEANUP-${name}`, description: 'database cleanup', pass: false, error: error.message }); } } }
  const result = { schema: 'tairet-atomic-execution-test-manifest-v2', postgresTarget: '17.6', networkPolicy: 'docker-internal-only', testCount: rows.length, passCount: rows.filter((row) => row.pass).length, failCount: rows.filter((row) => !row.pass).length, createdDatabaseResidualCount: created.length, rows };
  fs.writeFileSync(path.join(evidenceDir, 'atomicity-test-manifest.json'), canonicalJson(result));
  process.stdout.write(`${JSON.stringify({ testCount: result.testCount, passCount: result.passCount, failCount: result.failCount, residualDatabases: result.createdDatabaseResidualCount })}\n`);
  process.exitCode = result.failCount || result.createdDatabaseResidualCount ? 1 : 0;
})().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
