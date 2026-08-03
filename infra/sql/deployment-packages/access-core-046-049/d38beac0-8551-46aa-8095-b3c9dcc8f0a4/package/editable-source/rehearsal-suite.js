'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { canonicalHash, canonicalJson, sealed } = require('./lib/canonical');
const { PACKAGE_ID } = require('./lib/definitions');
const {
  loadRuntime,
  validateDraftCandidate,
  capturePrecondition,
  captureState,
  executePackageStage,
  expectedLedgerRows,
  resolveDescriptor,
} = require('./package-runtime');

const executionRoot = path.resolve(process.env.EXECUTION_ROOT || '/package');
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '/evidence');
const templateDatabase = process.env.TEMPLATE_DATABASE || 'template_access_core_v2';
const passId = process.env.PASS_ID || 'devv2';
const mode = process.env.REHEARSAL_MODE || 'Development';
if (!/^[a-z0-9]{3,12}$/.test(passId)) throw new Error('INVALID_PASS_ID');
if (!['Development', 'Final'].includes(mode)) throw new Error('INVALID_REHEARSAL_MODE');
fs.mkdirSync(path.join(evidenceDir, 'scenarios'), { recursive: true });

const runtime = loadRuntime(executionRoot, mode === 'Development' ? 'DRAFT' : 'AUTHORITATIVE');
const baseConnection = {
  host: process.env.PGHOST || 'pg',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'supabase_admin',
  password: process.env.PGPASSWORD || 'NON_DEPLOYABLE_LOCAL_ONLY',
};
if (baseConnection.host !== 'pg' || baseConnection.port !== 5432) throw new Error('LOCAL_TARGET_ROUTE_MISMATCH');

const createdDatabases = [];
const rows = [];
let databaseSequence = 0;

function safeIdentifier(value) {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) throw new Error(`UNSAFE_DATABASE_IDENTIFIER ${value}`);
  return `"${value}"`;
}
async function adminQuery(sql) {
  const client = new runtime.v3.ProtocolClient({ ...baseConnection, database: 'postgres', applicationName: `tairet-access-core-v2-${PACKAGE_ID}/test-admin` });
  await client.connect();
  try { return await client.simpleQuery(sql); }
  finally { await client.close(); }
}
async function createDatabase(label) {
  databaseSequence += 1;
  const name = `acv2_${passId}_${String(databaseSequence).padStart(3, '0')}_${label}`.slice(0, 63);
  await adminQuery(`CREATE DATABASE ${safeIdentifier(name)} TEMPLATE ${safeIdentifier(templateDatabase)};`);
  createdDatabases.push(name);
  return name;
}
async function dropDatabase(name) {
  await adminQuery(`DROP DATABASE IF EXISTS ${safeIdentifier(name)} WITH (FORCE);`);
  const index = createdDatabases.indexOf(name);
  if (index >= 0) createdDatabases.splice(index, 1);
}
async function dbQuery(database, sql, parameters = null) {
  const client = new runtime.v3.ProtocolClient({ ...baseConnection, database, applicationName: `tairet-access-core-v2-${PACKAGE_ID}/test-fixture` });
  await client.connect();
  try { return parameters ? await client.extendedQuery(sql, parameters) : await client.simpleQuery(sql); }
  finally { await client.close(); }
}
function connection(database) { return { ...baseConnection, database }; }
function writeScenario(row) {
  const file = path.join(evidenceDir, 'scenarios', `${row.id}.json`);
  fs.writeFileSync(file, canonicalJson(row), { flag: 'wx' });
  return { package_path: `scenarios/${row.id}.json`, size: fs.statSync(file).size, sha256: require('./lib/canonical').sha256File(file) };
}
async function expectFailure(call, expectedCode, requireRollback = false) {
  try {
    await call();
    assert.fail(`expected failure ${expectedCode}`);
  } catch (error) {
    assert.equal(error.code, expectedCode, `unexpected code for ${error.name}: ${error.message}`);
    if (requireRollback) assert.equal(error.evidence?.rollback?.pass, true, 'rollback oracle must pass');
    return { code: error.code, message: error.message, rollback: error.evidence?.rollback || null, transaction_evidence: error.evidence?.mutationConnection || null, commit_count: error.evidence?.commitCount ?? null };
  }
}
function expectSynchronousFailure(call, expectedCode) {
  try {
    call();
    assert.fail(`expected failure ${expectedCode}`);
  } catch (error) {
    assert.equal(error.code, expectedCode, `unexpected code for ${error.name}: ${error.message}`);
    return { code: error.code, message: error.message };
  }
}
async function scenarioDb(id, description, label, call) {
  const startedUtc = new Date().toISOString();
  let database = null;
  let before = null;
  let after = null;
  let precondition = null;
  let result = null;
  let pass = false;
  let error = null;
  try {
    database = await createDatabase(label);
    before = await captureState(runtime, connection(database));
    precondition = await capturePrecondition(runtime, connection(database));
    result = await call(database, precondition.baseline);
    after = await captureState(runtime, connection(database));
    pass = true;
  } catch (caught) {
    error = { name: caught.name, code: caught.code || null, message: caught.message, evidence: caught.evidence || null, stack: caught.stack };
    if (database) {
      try { after = await captureState(runtime, connection(database)); }
      catch (captureError) { error.after_capture_error = captureError.message; }
    }
  } finally {
    if (database) {
      try { await dropDatabase(database); }
      catch (dropError) { pass = false; error = { ...(error || {}), drop_error: dropError.message }; }
    }
  }
  const body = { schema: 'ACCESS_CORE_PACKAGE_V2_SCENARIO_EVIDENCE', id, description, mode, started_utc: startedUtc, completed_utc: new Date().toISOString(), disposable_database: database, database_dropped: database ? !createdDatabases.includes(database) : false, pass, before, precondition, result, after, error, production_contact: 0 };
  const evidence = sealed(body, 'scenario_evidence_sha256');
  rows.push({ id, description, pass, artifact: writeScenario(evidence), result_summary: result?.summary || result?.classification || result?.code || null, error_code: error?.code || null, runtime_stage_verifier_pass_count: countRuntimeVerifierPasses({ precondition, result }) });
}
async function scenarioPure(id, description, call) {
  const startedUtc = new Date().toISOString();
  let result = null;
  let pass = false;
  let error = null;
  try { result = await call(); pass = true; }
  catch (caught) { error = { name: caught.name, code: caught.code || null, message: caught.message, stack: caught.stack }; }
  const body = { schema: 'ACCESS_CORE_PACKAGE_V2_SCENARIO_EVIDENCE', id, description, mode, started_utc: startedUtc, completed_utc: new Date().toISOString(), pass, result, error, production_contact: 0 };
  const evidence = sealed(body, 'scenario_evidence_sha256');
  rows.push({ id, description, pass, artifact: writeScenario(evidence), result_summary: result?.code || null, error_code: error?.code || null, runtime_stage_verifier_pass_count: 0 });
}
function countRuntimeVerifierPasses(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return 0;
  seen.add(value);
  let count = 0;
  if (value.pass === true && typeof value.filename === 'string' && value.filename.endsWith('.sql') && value.snapshot && typeof value.snapshot === 'object') count += 1;
  for (const child of Object.values(value)) count += countRuntimeVerifierPasses(child, seen);
  return count;
}
function assertApplied(result) {
  assert.equal(result.status, 'PASS');
  assert.equal(result.classification, 'APPLIED_AND_VERIFIED');
  assert.equal(result.commitCount, 1);
  assert.equal(result.guard.pass, true);
  assert.equal(result.mutationConnection.physicalConnectionCount, 1);
  assert.equal(result.mutationConnection.retryCount, 0);
  assert.equal(result.mutationConnection.reconnectCount, 0);
  assert(result.mutationConnection.operationKinds.includes('extended-parameterized-query'));
  assert.equal(result.postCommit.connection.physicalConnectionCount, 1);
  assert.notEqual(result.mutationConnection.connectionId, result.postCommit.connection.connectionId);
  assert.equal(result.postCommit.pass, true);
}
async function applyPayloadOnly(database, logicalMigration) {
  const migration = runtime.statementManifest.migrations.find((row) => row.logical_migration === logicalMigration);
  const file = resolveDescriptor(runtime.executionRoot, migration.payload, 'INTERMEDIATE_PAYLOAD_IDENTITY_MISMATCH');
  await dbQuery(database, `BEGIN;\n${fs.readFileSync(file, 'utf8')}\nCOMMIT;`);
}
async function insertLedger(database, logicalMigration, override = {}) {
  const migration = runtime.executionDescriptor.migrations.find((row) => row.logical_migration === logicalMigration);
  const version = override.version || migration.version;
  const name = Object.prototype.hasOwnProperty.call(override, 'name') ? override.name : migration.name;
  const statements = override.statements || migration.statements_text_array;
  await dbQuery(database, runtime.v3.ledgerInsertSql(statements.length), [version, name, ...statements]);
}
function mutatedDraft(change) {
  const body = structuredClone(runtime.executionDescriptor);
  delete body.draft_descriptor_sha256;
  change(body);
  return sealed(body, 'draft_descriptor_sha256');
}

async function runScenarios() {
  await scenarioDb('ELR-01', 'normal full chain applies exact V046 through V049', 'normal', async (database, baseline) => {
    const stages = [];
    for (const logical of ['046', '047', '048', '049']) {
      const stage = await executePackageStage({ runtime, logicalMigration: logical, connectionConfig: connection(database), sourceBaseline: baseline });
      assertApplied(stage);
      stages.push(stage);
    }
    const finalState = await captureState(runtime, connection(database));
    assert.equal(canonicalHash(finalState.ledger), canonicalHash(expectedLedgerRows(runtime, 3, true)));
    return { summary: 'NORMAL_CHAIN_EXACT', stages, final_state: finalState };
  });
  await scenarioDb('ELR-02', 'migration SQL failure rolls back effects and ledger', 'sqlfail', async (database, baseline) => ({ summary: 'EFFECTS_AND_LEDGER_ROLLED_BACK', ...(await expectFailure(() => executePackageStage({ runtime, logicalMigration: '046', connectionConfig: connection(database), sourceBaseline: baseline, faultPlan: { migrationStatementFailure: true } }), 'POSTGRES_ERROR', true)) }));
  await scenarioDb('ELR-03', 'in-transaction verifier failure rolls back effects and ledger', 'verifyfail', async (database, baseline) => ({ summary: 'EFFECTS_AND_LEDGER_ROLLED_BACK', ...(await expectFailure(() => executePackageStage({ runtime, logicalMigration: '046', connectionConfig: connection(database), sourceBaseline: baseline, faultPlan: { verifierFailure: true } }), 'STAGE_VERIFICATION_FAILED', true)) }));
  await scenarioDb('ELR-04', 'ledger insertion failure rolls back effects and ledger', 'ledgerfail', async (database, baseline) => ({ summary: 'EFFECTS_AND_LEDGER_ROLLED_BACK', ...(await expectFailure(() => executePackageStage({ runtime, logicalMigration: '046', connectionConfig: connection(database), sourceBaseline: baseline, faultPlan: { ledgerInsertFailure: true } }), 'POSTGRES_ERROR', true)) }));
  await scenarioDb('ELR-05', 'disconnect before commit resolves as rolled back', 'disconnect', async (database, baseline) => {
    const result = await executePackageStage({ runtime, logicalMigration: '046', connectionConfig: connection(database), sourceBaseline: baseline, faultPlan: { disconnectBeforeCommit: true } });
    assert.equal(result.classification, runtime.v3.RECOVERY.AMBIGUOUS_COMMIT_RESOLVED_AS_ROLLED_BACK);
    assert.equal(result.commitCount, 0);
    return { summary: result.classification, ...result };
  });
  await scenarioDb('ELR-06', 'commit success with simulated ACK loss resolves as committed', 'lostack', async (database, baseline) => {
    const result = await executePackageStage({ runtime, logicalMigration: '046', connectionConfig: connection(database), sourceBaseline: baseline, faultPlan: { simulateLostCommitAck: true } });
    assert.equal(result.classification, runtime.v3.RECOVERY.AMBIGUOUS_COMMIT_RESOLVED_AS_COMMITTED);
    assert.equal(result.commitCount, 1);
    assert.equal(result.recovery.postCommit.pass, true);
    return { summary: result.classification, ...result };
  });
  await scenarioDb('ELR-07', 'exact effects without ledger hard-stop as split state', 'effectsonly', async (database, baseline) => {
    await applyPayloadOnly(database, '046');
    return { summary: runtime.v3.RECOVERY.HARD_STOP_SPLIT_STATE, automatic_repair: false, ...(await expectFailure(() => executePackageStage({ runtime, logicalMigration: '046', connectionConfig: connection(database), sourceBaseline: baseline }), runtime.v3.RECOVERY.HARD_STOP_SPLIT_STATE)) };
  });
  await scenarioDb('ELR-08', 'exact ledger without effects hard-stop as split state', 'ledgeronly', async (database, baseline) => {
    await insertLedger(database, '046');
    return { summary: runtime.v3.RECOVERY.HARD_STOP_SPLIT_STATE, automatic_repair: false, ...(await expectFailure(() => executePackageStage({ runtime, logicalMigration: '046', connectionConfig: connection(database), sourceBaseline: baseline }), runtime.v3.RECOVERY.HARD_STOP_SPLIT_STATE)) };
  });
  await scenarioDb('ELR-09', 'partial incompatible effects hard-stop', 'partial', async (database, baseline) => {
    await dbQuery(database, 'CREATE TABLE public.access_order_fulfillments(order_id uuid);');
    return { summary: runtime.v3.RECOVERY.HARD_STOP_INCOMPATIBLE_STATE, automatic_repair: false, ...(await expectFailure(() => executePackageStage({ runtime, logicalMigration: '046', connectionConfig: connection(database), sourceBaseline: baseline }), runtime.v3.RECOVERY.HARD_STOP_INCOMPATIBLE_STATE)) };
  });
  await scenarioDb('ELR-10', 'second invocation after exact application verifies already applied without rerunning SQL', 'second', async (database, baseline) => {
    const first = await executePackageStage({ runtime, logicalMigration: '046', connectionConfig: connection(database), sourceBaseline: baseline });
    assertApplied(first);
    const second = await executePackageStage({ runtime, logicalMigration: '046', connectionConfig: connection(database), sourceBaseline: baseline });
    assert.equal(second.classification, runtime.v3.RECOVERY.ALREADY_APPLIED_VERIFIED);
    assert.equal(second.commitCount, 0);
    return { summary: runtime.v3.RECOVERY.ALREADY_APPLIED_VERIFIED, first, second };
  });
  await scenarioDb('ELR-11', 'conflicting assigned version name and statements hard-stop', 'conflict', async (database, baseline) => {
    await insertLedger(database, '046', { name: 'conflicting_name', statements: ['conflicting_statement'] });
    return { summary: runtime.v3.RECOVERY.HARD_STOP_INCOMPATIBLE_STATE, conflict_dimensions: ['version', 'name', 'statements'], ...(await expectFailure(() => executePackageStage({ runtime, logicalMigration: '046', connectionConfig: connection(database), sourceBaseline: baseline }), runtime.v3.RECOVERY.HARD_STOP_INCOMPATIBLE_STATE)) };
  });
  await scenarioDb('ELR-12', 'out-of-order V047 hard-stops before mutation', 'outorder', async (database, baseline) => {
    const evidence = await expectFailure(() => executePackageStage({ runtime, logicalMigration: '047', connectionConfig: connection(database), sourceBaseline: baseline }), runtime.v3.RECOVERY.HARD_STOP_INCOMPATIBLE_STATE);
    assert.equal(evidence.commit_count, 0);
    return { summary: 'OUT_OF_ORDER_HARD_STOP_BEFORE_MUTATION', ...evidence };
  });

  if (mode === 'Development') {
    await scenarioPure('PM-01', 'wrong executor release identity is rejected', async () => expectSynchronousFailure(() => validateDraftCandidate(runtime, mutatedDraft((manifest) => { manifest.executor.frozen_release_identity = '0'.repeat(64); })), 'EXECUTOR_IDENTITY_MISMATCH'));
    await scenarioPure('PM-02', 'wrong canonical migration bytes identity is rejected', async () => expectSynchronousFailure(() => validateDraftCandidate(runtime, mutatedDraft((manifest) => { manifest.migrations[0].canonical_sha256 = '0'.repeat(64); })), 'CANONICAL_MIGRATION_IDENTITY_MISMATCH'));
    await scenarioPure('PM-03', 'wrong intermediate payload identity is rejected', async () => expectSynchronousFailure(() => validateDraftCandidate(runtime, mutatedDraft((manifest) => { manifest.migrations[0].payload_sha256 = '0'.repeat(64); })), 'INTERMEDIATE_PAYLOAD_IDENTITY_MISMATCH'));
    await scenarioPure('PM-04', 'wrong stage verifier identity is rejected', async () => expectSynchronousFailure(() => validateDraftCandidate(runtime, mutatedDraft((manifest) => { manifest.artifact_identities.stage_verifier_manifest_sha256 = '0'.repeat(64); })), 'VERIFIER_IDENTITY_MISMATCH'));
    await scenarioPure('PM-05', 'wrong target identity is rejected', async () => expectSynchronousFailure(() => validateDraftCandidate(runtime, mutatedDraft((manifest) => { manifest.target.project_identity = 'WRONG'; manifest.target.database_identity = 'WRONG'; })), 'TARGET_IDENTITY_MISMATCH'));
    await scenarioDb('PM-06', 'wrong predecessor ledger identity is rejected', 'badpred', async (database, baseline) => {
      await dbQuery(database, `UPDATE supabase_migrations.schema_migrations SET name='wrong_predecessor' WHERE version='20260711062758';`);
      return { summary: 'WRONG_PREDECESSOR_HARD_STOP', ...(await expectFailure(() => executePackageStage({ runtime, logicalMigration: '046', connectionConfig: connection(database), sourceBaseline: baseline }), runtime.v3.RECOVERY.HARD_STOP_INCOMPATIBLE_STATE)) };
    });
    await scenarioDb('PM-07', 'test-only assigned version collision is rejected', 'collision', async (database, baseline) => {
      await insertLedger(database, '046', { name: 'unrelated_collision', statements: ['collision'] });
      return { summary: 'VERSION_COLLISION_HARD_STOP', ...(await expectFailure(() => executePackageStage({ runtime, logicalMigration: '046', connectionConfig: connection(database), sourceBaseline: baseline }), runtime.v3.RECOVERY.HARD_STOP_INCOMPATIBLE_STATE)) };
    });
  }
}

(async () => {
  let fatal = null;
  try { await runScenarios(); }
  catch (error) { fatal = { name: error.name, code: error.code || null, message: error.message, stack: error.stack }; }
  finally {
    for (const database of [...createdDatabases].reverse()) {
      try { await dropDatabase(database); }
      catch (error) { rows.push({ id: `CLEANUP-${database}`, description: 'disposable database cleanup', pass: false, error_code: error.code || error.message, runtime_stage_verifier_pass_count: 0 }); }
    }
  }
  let openSessions = -1;
  try {
    const results = await adminQuery(`SELECT count(*)::text AS open_sessions FROM pg_stat_activity WHERE application_name LIKE 'tairet-access-core-v2-${PACKAGE_ID}/%' AND pid <> pg_backend_pid();`);
    openSessions = Number(runtime.v3.lastRows(results)[0].open_sessions);
  } catch (error) { fatal = fatal || { name: error.name, code: error.code || null, message: error.message, stack: error.stack }; }
  const expectedCount = mode === 'Development' ? 19 : 12;
  const body = {
    schema: mode === 'Development' ? 'ACCESS_CORE_046_049_DEVELOPMENT_REHEARSAL_RESULT_V2' : 'ACCESS_CORE_046_049_FINAL_REHEARSAL_RESULT_V2',
    package_id: PACKAGE_ID,
    package_descriptor_sha256: runtime.descriptorIdentity,
    executor_release_sha256: runtime.releaseManifest.releaseSha256,
    mode,
    postgres_target: '17.6',
    network_policy: 'DOCKER_INTERNAL_ONLY',
    scenario_count: rows.length,
    expected_scenario_count: expectedCount,
    pass_count: rows.filter((row) => row.pass).length,
    fail_count: rows.filter((row) => !row.pass).length,
    runtime_stage_verifier_pass_count: rows.reduce((sum, row) => sum + row.runtime_stage_verifier_pass_count, 0),
    disposable_database_residual_count: createdDatabases.length,
    open_postgres_session_count: openSessions,
    rows,
    fatal,
    production_contact: 0,
  };
  const identityField = mode === 'Development' ? 'package_v2_development_rehearsal_result_sha256' : 'package_v2_final_rehearsal_result_sha256';
  const result = sealed(body, identityField);
  const resultName = mode === 'Development' ? 'development-rehearsal-result-v2.json' : 'final-rehearsal-result-v2.json';
  fs.writeFileSync(path.join(evidenceDir, resultName), canonicalJson(result), { flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ scenarioCount: result.scenario_count, passCount: result.pass_count, failCount: result.fail_count, runtimeStageVerifierPassCount: result.runtime_stage_verifier_pass_count, databaseResidualCount: result.disposable_database_residual_count, openSessionCount: result.open_postgres_session_count, resultSha256: result[identityField] })}\n`);
  process.exitCode = fatal || result.scenario_count !== expectedCount || result.pass_count !== expectedCount || result.fail_count || result.disposable_database_residual_count || result.open_postgres_session_count || result.runtime_stage_verifier_pass_count < 1 ? 1 : 0;
})().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
