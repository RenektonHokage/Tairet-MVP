'use strict';

const fs = require('fs');
const path = require('path');
const { canonicalHash, sha256File } = require('../hash/canonical');
const { validateManifest } = require('../manifest/validator');
const { verifyFrozenRelease } = require('../identity/release');
const { MIGRATIONS, PREDECESSOR, computeIdentityModel, sourcePath } = require('../identity/model');
const { validateCanonicalFile } = require('../envelope/validator');
const { ProtocolClient, lastRows } = require('../db/protocol-client');
const { captureMaterial, compareStage } = require('../verifiers/material');
const { runInTransactionVerifier } = require('../verifiers/in-transaction');
const { runPostCommitVerifier } = require('../verifiers/post-commit');
const { classifyRecovery, RECOVERY } = require('../recovery/classifier');
const { StageInvariantGuard } = require('./invariant-guard');

class AtomicStageError extends Error {
  constructor(code, detail = '', evidence = {}) { super(`${code}${detail ? `: ${detail}` : ''}`); this.name = 'AtomicStageError'; this.code = code; this.evidence = evidence; }
}

function exactEqual(a, b) { return canonicalHash(a) === canonicalHash(b); }

function expectedLedgerRows(manifest, stageIndex, includeCurrent) {
  const rows = [manifest.expectedPredecessorLedgerIdentity];
  const limit = includeCurrent ? stageIndex + 1 : stageIndex;
  for (let i = 0; i < limit; i += 1) {
    const migration = manifest.migrations[i];
    rows.push({ version: migration.version, name: migration.ledgerName, statements: migration.orderedStatements });
  }
  return rows;
}

async function readLedger(client) {
  const sql = `SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',to_jsonb(statements)) ORDER BY version),'[]'::jsonb)::text AS ledger FROM supabase_migrations.schema_migrations;`;
  const rows = lastRows(await client.simpleQuery(sql));
  if (rows.length !== 1) throw new AtomicStageError('LEDGER_READ_CARDINALITY_MISMATCH');
  return JSON.parse(rows[0].ledger);
}

function stageExact(stage, material, contract) {
  try { compareStage(stage, material, contract); return true; } catch { return false; }
}

function ledgerState(actualRows, beforeRows, afterRows) {
  if (exactEqual(actualRows, afterRows)) return 'exact';
  if (exactEqual(actualRows, beforeRows)) return 'absent';
  return 'incompatible';
}

function recoveryFromEvidence(actualLedger, beforeRows, afterRows, material, migration, contract, ambiguousCommit) {
  const ledger = ledgerState(actualLedger, beforeRows, afterRows);
  const preExact = stageExact(migration.preStage, material, contract);
  const postExact = stageExact(migration.postStage, material, contract);
  let effects = 'incompatible';
  if (postExact) effects = 'exact';
  else if (preExact) effects = 'absent';
  else if (material.catalogFingerprint === contract.stages[migration.postStage].catalog_fingerprint) effects = 'partial';
  return { classification: classifyRecovery({ ledger, effects, predecessorExact: preExact, ambiguousCommit }), ledger, effects, preExact, postExact };
}

function releaseEntryIdentity(releaseManifest, entryPath) {
  const entry = releaseManifest.entries.find((row) => row.path === entryPath);
  if (!entry) throw new AtomicStageError('RELEASE_IDENTITY_ENTRY_MISSING', entryPath);
  return entry.sha256;
}

function buildExpectedModel(repoRoot, releaseManifest) {
  const parserIdentity = releaseEntryIdentity(releaseManifest, 'editable-source/src/parser/statementScanner.js');
  const inIdentity = releaseEntryIdentity(releaseManifest, 'editable-source/src/verifiers/in-transaction.js');
  const postIdentity = releaseEntryIdentity(releaseManifest, 'editable-source/src/verifiers/post-commit.js');
  const materialContractIdentity = releaseEntryIdentity(releaseManifest, 'fixtures/integration/independent-stage-contract.json');
  const executorIdentity = { version: '1.0.0', releaseSha256: releaseManifest.releaseSha256, parserIdentity, inTransactionVerifierIdentity: inIdentity, postCommitVerifierIdentity: postIdentity, materialContractIdentity, runtimeIdentity: releaseManifest.runtimeIdentity };
  const identityModel = computeIdentityModel(repoRoot, executorIdentity);
  return {
    identityModel,
    validationExpected: {
      executorReleaseIdentity: releaseManifest.releaseSha256,
      parserIdentity,
      inTransactionVerifierIdentity: inIdentity,
      postCommitVerifierIdentity: postIdentity,
      materialContractIdentity,
      migrations: identityModel.migrations,
      stageOrder: MIGRATIONS.map((row) => row.logicalNumber),
      expectedPredecessorLedgerIdentity: PREDECESSOR,
    },
  };
}

function ledgerInsertSql(statementCount) {
  if (!Number.isInteger(statementCount) || statementCount < 1) throw new AtomicStageError('EMPTY_STATEMENT_ARRAY');
  const placeholders = Array.from({ length: statementCount }, (_, index) => `$${index + 3}`).join(',');
  return `INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES ($1,$2,ARRAY[${placeholders}]::text[])`;
}

async function resolveAmbiguous({ connectionConfig, beforeRows, afterRows, migration, frozenContract, identityBinding }) {
  const readOnly = new ProtocolClient({ ...connectionConfig, readOnly: true, applicationName: 'tairet-atomic-executor-v1/ambiguous-recovery' });
  await readOnly.connect();
  try {
    const ledger = await readLedger(readOnly);
    const material = await captureMaterial(readOnly);
    const result = recoveryFromEvidence(ledger, beforeRows, afterRows, material, migration, frozenContract, true);
    return { ...result, ledgerRows: ledger, material, readOnlyConnectionId: readOnly.connectionId, identityBinding };
  } finally { await readOnly.close(); }
}

async function proveRollback({ connectionConfig, beforeRows, migration, frozenContract }) {
  const readOnly = new ProtocolClient({ ...connectionConfig, readOnly: true, applicationName: 'tairet-atomic-executor-v1/rollback-oracle' });
  await readOnly.connect();
  try {
    const ledger = await readLedger(readOnly);
    const material = await captureMaterial(readOnly);
    const pass = exactEqual(ledger, beforeRows) && stageExact(migration.preStage, material, frozenContract);
    return { pass, ledgerRows: ledger, material, connectionId: readOnly.connectionId };
  } finally { await readOnly.close(); }
}

async function executeAtomicStage(options) {
  const { repoRoot, releaseRoot, releaseManifest, manifest, logicalNumber, frozenContract: suppliedContract, connectionConfig, faultPlan = null } = options;
  if (faultPlan && manifest.classification !== 'NON_DEPLOYABLE_TEST_ONLY') throw new AtomicStageError('FAULT_INJECTION_PROHIBITED');
  const releaseEvidence = verifyFrozenRelease(releaseRoot, releaseManifest);
  const migrationIndex = MIGRATIONS.findIndex((row) => row.logicalNumber === logicalNumber);
  if (migrationIndex < 0) throw new AtomicStageError('UNKNOWN_MIGRATION', logicalNumber);
  const migration = MIGRATIONS[migrationIndex];
  const contractPath = path.join(releaseRoot, 'fixtures', 'integration', 'independent-stage-contract.json');
  if (sha256File(contractPath) !== releaseEntryIdentity(releaseManifest, 'fixtures/integration/independent-stage-contract.json')) throw new AtomicStageError('VERIFIER_CONTRACT_FILE_MISMATCH');
  const frozenContract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  if (suppliedContract && canonicalHash(suppliedContract) !== canonicalHash(frozenContract)) throw new AtomicStageError('VERIFIER_CONTRACT_ARGUMENT_MISMATCH');
  const { identityModel, validationExpected } = buildExpectedModel(repoRoot, releaseManifest);
  validateManifest(manifest, validationExpected, { forExecution: true });
  const validated = validateCanonicalFile(sourcePath(repoRoot, migration), migration);
  const statements = validated.parsed.statements.map((row) => {
    const text = row.statement.toString('utf8');
    if (!Buffer.from(text, 'utf8').equals(row.statement)) throw new AtomicStageError('NON_UTF8_STATEMENT_BYTES');
    return text;
  });
  const manifestStage = manifest.migrations[migrationIndex];
  if (!exactEqual(statements, manifestStage.orderedStatements)) throw new AtomicStageError('EXECUTION_STATEMENT_ARRAY_MISMATCH');
  const beforeRows = expectedLedgerRows(manifest, migrationIndex, false);
  const afterRows = expectedLedgerRows(manifest, migrationIndex, true);
  const identityBinding = {
    releaseSha256: releaseManifest.releaseSha256,
    manifestSha256: manifest.manifestSha256,
    sourceSha256: migration.sha256,
    payloadSha256: migration.payloadSha256,
    identityModelSha256: identityModel.identityModelSha256,
  };
  const client = new ProtocolClient({ ...connectionConfig, applicationName: `tairet-atomic-executor-v1/${logicalNumber}` });
  const guard = new StageInvariantGuard(client.connectionId);
  let transactionStarted = false;
  let committed = false;
  let commitCount = 0;
  let preflight;
  await client.connect();
  try {
    const actualLedger = await readLedger(client);
    const material = await captureMaterial(client);
    preflight = recoveryFromEvidence(actualLedger, beforeRows, afterRows, material, migration, frozenContract, false);
    if (preflight.classification === RECOVERY.ALREADY_APPLIED_VERIFIED) {
      await client.close();
      const postClient = new ProtocolClient({ ...connectionConfig, readOnly: true, applicationName: `tairet-atomic-executor-v1/${logicalNumber}/already-applied` });
      await postClient.connect();
      try {
        const postCommit = await runPostCommitVerifier({ client: postClient, stage: migration.postStage, frozenContract, expectedLedgerRows: afterRows, identityBinding, readLedger });
        return { status: 'PASS', classification: RECOVERY.ALREADY_APPLIED_VERIFIED, logicalNumber, releaseEvidence, preflight, postCommit, mutationConnection: client.invariantEvidence(), postCommitConnection: postClient.invariantEvidence(), commitCount: 0 };
      } finally { await postClient.close(); }
    }
    if (preflight.classification !== RECOVERY.NOT_APPLIED_VERIFIED) throw new AtomicStageError(preflight.classification, '', { preflight });
    await client.simpleQuery('BEGIN;'); transactionStarted = true;
    guard.record('BEGIN', client.invariantEvidence());
    const timeout = manifest.timeoutLockPolicy;
    await client.simpleQuery(`SET LOCAL statement_timeout = '${timeout.statementTimeoutMs}ms'; SET LOCAL lock_timeout = '${timeout.lockTimeoutMs}ms'; SET LOCAL idle_in_transaction_session_timeout = '${timeout.idleInTransactionTimeoutMs}ms';`);
    guard.record('TIMEOUTS');
    const payloadText = validated.payload.toString('utf8');
    if (!Buffer.from(payloadText, 'utf8').equals(validated.payload)) throw new AtomicStageError('NON_UTF8_PAYLOAD_BYTES');
    await client.simpleQuery(payloadText);
    guard.record('PAYLOAD_SIMPLE_QUERY', { operationKind: client.operationKinds.at(-1) });
    if (faultPlan?.migrationStatementFailure) await client.simpleQuery('SELECT 1/0;');
    if (faultPlan?.disconnectBeforeCommit) {
      client.destroyUncertain();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const recovery = await resolveAmbiguous({ connectionConfig, beforeRows, afterRows, migration, frozenContract, identityBinding });
      if (recovery.classification !== RECOVERY.AMBIGUOUS_COMMIT_RESOLVED_AS_ROLLED_BACK) throw new AtomicStageError('DISCONNECT_RECOVERY_UNEXPECTED', recovery.classification, { recovery });
      return { status: 'CONTROLLED_FAILURE', classification: recovery.classification, recovery, commitCount: 0, mutationConnection: client.invariantEvidence() };
    }
    if (faultPlan?.verifierFailure) await client.simpleQuery(`COMMENT ON SCHEMA public IS 'NON_DEPLOYABLE_TEST_ONLY_VERIFIER_FAULT';`);
    const inTransaction = await runInTransactionVerifier({ client, stage: migration.postStage, frozenContract });
    guard.record('IN_TRANSACTION_VERIFIER', { evidenceSha256: inTransaction.evidenceSha256 });
    if (faultPlan?.cancelBeforeCommit) await client.simpleQuery(`SET LOCAL statement_timeout='25ms'; SELECT pg_sleep(1);`);
    if (faultPlan?.ledgerInsertFailure) await client.simpleQuery('SELECT 1/0;');
    const insertSql = ledgerInsertSql(statements.length);
    await client.extendedQuery(insertSql, [manifestStage.version, manifestStage.ledgerName, ...statements]);
    guard.record('LEDGER_PARAMETERIZED_INSERT', { operationKind: client.operationKinds.at(-1) });
    if (faultPlan?.ledgerRereadMismatch) await client.extendedQuery('UPDATE supabase_migrations.schema_migrations SET statements=ARRAY[$2]::text[] WHERE version=$1', [manifestStage.version, 'NON_DEPLOYABLE_TEST_ONLY_MISMATCH']);
    const ledgerReread = await readLedger(client);
    if (!exactEqual(ledgerReread, afterRows)) throw new AtomicStageError('LEDGER_REREAD_MISMATCH');
    guard.record('LEDGER_REREAD');
    if (faultPlan?.effectRereadMismatch) await client.simpleQuery(`COMMENT ON SCHEMA public IS 'NON_DEPLOYABLE_TEST_ONLY_EFFECT_FAULT';`);
    const effectReread = await runInTransactionVerifier({ client, stage: migration.postStage, frozenContract });
    guard.record('EFFECT_REREAD', { evidenceSha256: effectReread.evidenceSha256 });
    commitCount += 1;
    await client.simpleQuery('COMMIT;'); committed = true;
    guard.record('COMMIT');
    await client.close();
    guard.record('MUTATION_CONNECTION_CLOSED');
    if (faultPlan?.simulateLostCommitAck) {
      const recovery = await resolveAmbiguous({ connectionConfig, beforeRows, afterRows, migration, frozenContract, identityBinding });
      if (recovery.classification !== RECOVERY.AMBIGUOUS_COMMIT_RESOLVED_AS_COMMITTED) throw new AtomicStageError('LOST_ACK_RECOVERY_UNEXPECTED', recovery.classification, { recovery });
      return { status: 'PASS', classification: recovery.classification, logicalNumber, releaseEvidence, inTransaction, effectReread, recovery, commitCount, mutationConnection: client.invariantEvidence() };
    }
    const postClient = new ProtocolClient({ ...connectionConfig, readOnly: true, applicationName: `tairet-atomic-executor-v1/${logicalNumber}/post-commit` });
    await postClient.connect();
    try {
      const postCommit = await runPostCommitVerifier({ client: postClient, stage: migration.postStage, frozenContract, expectedLedgerRows: afterRows, identityBinding, readLedger });
      if (postClient.connectionId === client.connectionId) throw new AtomicStageError('POST_COMMIT_CONNECTION_NOT_INDEPENDENT');
      guard.record('POST_COMMIT_READ_ONLY_VERIFIER', { readOnly: postCommit.readOnly, connectionId: postClient.connectionId });
      guard.record('COMPLETE');
      return { status: 'PASS', classification: 'APPLIED_AND_VERIFIED', logicalNumber, releaseEvidence, identityBinding, preflight, inTransaction, ledgerReread, effectReread, postCommit, guard: guard.evidence(), commitCount, mutationConnection: client.invariantEvidence(), postCommitConnection: postClient.invariantEvidence() };
    } finally { await postClient.close(); }
  } catch (error) {
    if (!committed && transactionStarted && !client.closed) {
      try { await client.simpleQuery('ROLLBACK;'); } catch { /* rollback evidence below is authoritative */ }
    }
    if (!client.closed) await client.close();
    const rollback = !committed && transactionStarted ? await proveRollback({ connectionConfig, beforeRows, migration, frozenContract }) : null;
    if (!committed && transactionStarted && !rollback.pass) throw new AtomicStageError('ROLLBACK_ORACLE_FAILED', error.message, { originalError: error.code || error.message, rollback });
    throw new AtomicStageError(error.code || 'ATOMIC_STAGE_FAILED', error.message, { rollback, mutationConnection: client.invariantEvidence(), commitCount });
  }
}

module.exports = { AtomicStageError, expectedLedgerRows, readLedger, ledgerInsertSql, recoveryFromEvidence, executeAtomicStage };
