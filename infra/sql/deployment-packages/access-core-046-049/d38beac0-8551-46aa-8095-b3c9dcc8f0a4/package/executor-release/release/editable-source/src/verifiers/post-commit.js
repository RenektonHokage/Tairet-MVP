'use strict';

const { canonicalHash } = require('../hash/canonical');
const { lastRows } = require('../db/protocol-client');
const { verifyMaterialStage } = require('./material');

async function runPostCommitVerifier({ client, stage, frozenContract, expectedLedgerRows, identityBinding, readLedger }) {
  const readOnly = lastRows(await client.simpleQuery('SHOW transaction_read_only;'));
  if (readOnly.length !== 1 || readOnly[0].transaction_read_only !== 'on') throw new Error('POST_COMMIT_CONNECTION_NOT_READ_ONLY');
  await client.simpleQuery('BEGIN READ ONLY;');
  try {
    const material = await verifyMaterialStage(client, stage, frozenContract);
    const ledgerRows = await readLedger(client);
    if (canonicalHash(ledgerRows) !== canonicalHash(expectedLedgerRows)) throw new Error('POST_COMMIT_LEDGER_MISMATCH');
    const evidence = { readOnly: true, separateConnectionId: client.connectionId, stage, material, ledgerRows, identityBinding };
    evidence.evidenceSha256 = canonicalHash(evidence);
    await client.simpleQuery('ROLLBACK;');
    return evidence;
  } catch (error) {
    try { await client.simpleQuery('ROLLBACK;'); } catch { /* connection may already be failed */ }
    throw error;
  }
}

module.exports = { runPostCommitVerifier };
