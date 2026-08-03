'use strict';

const path = require('path');
const { validateCanonicalFile } = require('../envelope/validator');
const { canonicalHash } = require('../hash/canonical');

const MIGRATIONS = Object.freeze([
  {
    logicalNumber: '046', filename: '046_access_core_recoverable_fulfillment.sql', ledgerName: 'access_core_recoverable_fulfillment',
    size: 163792, sha256: '6f1b39fc66b53856e19475b20539de1377f20e29fe6ad99a79472c97dba2fe0c',
    payloadSize: 163777, payloadSha256: 'bc86b500ad4b01248edc1a20677bdeb49c8a39360215350b26b71d987b50f9bf',
    testVersion: '99000000000046', preStage: 'PRE_046', postStage: 'POST_046',
  },
  {
    logicalNumber: '047', filename: '047_access_email_preclaim_terminal_failure.sql', ledgerName: 'access_email_preclaim_terminal_failure',
    size: 46349, sha256: '6bebbe803cc5c85094352bbcbc261df5ce26780fb1ae38d956089f48b67f20b4',
    payloadSize: 46334, payloadSha256: 'e2400dd0bd191b097bbd5097557522f6a30949528f4d98214974a328c679afcf',
    testVersion: '99000000000047', preStage: 'POST_046', postStage: 'POST_047',
  },
  {
    logicalNumber: '048', filename: '048_access_email_preclaim_terminal_after_ambiguous.sql', ledgerName: 'access_email_preclaim_terminal_after_ambiguous',
    size: 24852, sha256: '249a75c0da2f80a66e0d0717a88d8c4710cf51f210098078a375692fd4567532',
    payloadSize: 24837, payloadSha256: '0238e401a59b7dc3943e077ff49f087629bdcf096e8c08a9e5a0b30c8f03fb64',
    testVersion: '99000000000048', preStage: 'POST_047', postStage: 'POST_048',
  },
  {
    logicalNumber: '049', filename: '049_access_email_delivery_claim_correlation.sql', ledgerName: 'access_email_delivery_claim_correlation',
    size: 55698, sha256: 'cc3b71a988fafa3298344ec73731abc0ce8219c1dc35110e59916e5344f6d234',
    payloadSize: 55683, payloadSha256: 'e367fe2c3bd96df4ae0b72ea9348a1f2fb139e723123dc43bf566ecd9d9ae3d3',
    testVersion: '99000000000049', preStage: 'POST_048', postStage: 'POST_049',
  },
]);

const PREDECESSOR = Object.freeze({ version: '99000000000045', name: 'synthetic_pre_046_approved_slice', statements: ['NON_DEPLOYABLE_TEST_ONLY approved predecessor fixture'] });

function sourcePath(repoRoot, migration) {
  return path.join(repoRoot, 'infra', 'sql', 'migrations', migration.filename);
}

function computeMigrationIdentity(repoRoot, migration) {
  const result = validateCanonicalFile(sourcePath(repoRoot, migration), migration);
  return {
    canonicalSourceIdentity: {
      logicalMigrationNumber: migration.logicalNumber,
      canonicalPath: `infra/sql/migrations/${migration.filename}`,
      filename: migration.filename,
      size: migration.size,
      sha256: migration.sha256,
    },
    intermediatePayloadIdentity: {
      envelopeBytesRemoved: result.envelope,
      size: result.payload.length,
      sha256: migration.payloadSha256,
      orderedStatementIdentities: result.parsed.statements.map((row, index) => ({ index, size: row.size, sha256: row.sha256 })),
      statementCount: result.parsed.statements.length,
    },
    deploymentIdentity: { version: migration.testVersion, ledgerName: migration.ledgerName, classification: 'NON_DEPLOYABLE_TEST_ONLY' },
  };
}

function computeIdentityModel(repoRoot, executorIdentity) {
  const migrations = MIGRATIONS.map((migration) => computeMigrationIdentity(repoRoot, migration));
  const model = {
    schema: 'tairet-statement-aware-atomic-executor-identity-model-v1',
    separationRule: 'NO_IDENTITY_IMPLIES_ANOTHER',
    migrations,
    executorIdentity,
  };
  return { ...model, identityModelSha256: canonicalHash(model) };
}

module.exports = { MIGRATIONS, PREDECESSOR, sourcePath, computeMigrationIdentity, computeIdentityModel };
