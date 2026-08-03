'use strict';

const { verifyMaterialStage } = require('./material');

async function runInTransactionVerifier({ client, stage, frozenContract }) {
  return verifyMaterialStage(client, stage, frozenContract);
}

module.exports = { runInTransactionVerifier };
