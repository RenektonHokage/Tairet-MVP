'use strict';

const { canonicalHash } = require('../hash/canonical');

class ManifestValidationError extends Error {
  constructor(code, detail = '') {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.name = 'ManifestValidationError';
    this.code = code;
  }
}

const requiredTop = [
  'manifestFormat', 'manifestVersion', 'classification', 'executable', 'packagingEventIdentity', 'target',
  'expectedPredecessorLedgerIdentity', 'migrations', 'executorReleaseIdentity', 'parserIdentity', 'verifierIdentities',
  'stageOrder', 'recoveryPolicy', 'timeoutLockPolicy', 'manifestSha256',
];

function expectedLedgerName(filename) {
  return filename.replace(/^\d{3}_/, '').replace(/\.sql$/, '');
}

function bodyForHash(manifest) {
  const body = structuredClone(manifest);
  delete body.manifestSha256;
  return body;
}

function sealManifest(body) {
  const result = structuredClone(body);
  result.manifestSha256 = canonicalHash(result);
  return result;
}

function validateManifest(manifest, expected, options = {}) {
  for (const key of requiredTop) if (!(key in manifest)) throw new ManifestValidationError('MISSING_FIELD', key);
  if (manifest.manifestFormat !== 'TAIRET_STATEMENT_AWARE_ATOMIC_MIGRATION_MANIFEST' || manifest.manifestVersion !== 1) throw new ManifestValidationError('FORMAT_MISMATCH');
  if (manifest.manifestSha256 !== canonicalHash(bodyForHash(manifest))) throw new ManifestValidationError('MANIFEST_HASH_MISMATCH');
  if (!Array.isArray(manifest.migrations) || manifest.migrations.length !== 4) throw new ManifestValidationError('MIGRATION_COUNT_MISMATCH');
  if (manifest.classification === 'PRODUCTION_TEMPLATE_UNASSIGNED') {
    if (manifest.executable || options.forExecution) throw new ManifestValidationError('PRODUCTION_MANIFEST_UNASSIGNED');
    if (manifest.migrations.some((row) => row.version !== 'UNASSIGNED')) throw new ManifestValidationError('PRODUCTION_TEMPLATE_VERSION_ASSIGNED');
    return { executable: false, classification: manifest.classification };
  }
  if (manifest.classification !== 'NON_DEPLOYABLE_TEST_ONLY' || !manifest.executable) throw new ManifestValidationError('UNSUPPORTED_MANIFEST_CLASSIFICATION');
  if (manifest.target.projectIdentity !== 'LOCAL_DISPOSABLE_POSTGRESQL_17_6_ONLY') throw new ManifestValidationError('NON_LOCAL_TARGET');
  if (manifest.executorReleaseIdentity !== expected.executorReleaseIdentity) throw new ManifestValidationError('EXECUTOR_IDENTITY_MISMATCH');
  if (manifest.parserIdentity !== expected.parserIdentity) throw new ManifestValidationError('PARSER_IDENTITY_MISMATCH');
  if (expected.expectedPredecessorLedgerIdentity && canonicalHash(manifest.expectedPredecessorLedgerIdentity) !== canonicalHash(expected.expectedPredecessorLedgerIdentity)) throw new ManifestValidationError('PREDECESSOR_LEDGER_IDENTITY_MISMATCH');
  if (manifest.verifierIdentities.inTransaction !== expected.inTransactionVerifierIdentity || manifest.verifierIdentities.postCommit !== expected.postCommitVerifierIdentity || manifest.verifierIdentities.materialContract !== expected.materialContractIdentity) throw new ManifestValidationError('VERIFIER_IDENTITY_MISMATCH');
  const versions = [];
  for (let i = 0; i < manifest.migrations.length; i += 1) {
    const actual = manifest.migrations[i];
    const wanted = expected.migrations[i];
    if (!/^\d{14}$/.test(actual.version) || ['046', '047', '048', '049'].includes(actual.version)) throw new ManifestValidationError('MALFORMED_OR_REAL_VERSION', actual.version);
    if (versions.includes(actual.version)) throw new ManifestValidationError('DUPLICATE_VERSION', actual.version);
    if (versions.length && actual.version <= versions[versions.length - 1]) throw new ManifestValidationError('NON_INCREASING_VERSION', actual.version);
    versions.push(actual.version);
    if (actual.filename !== wanted.canonicalSourceIdentity.filename || actual.ledgerName !== expectedLedgerName(actual.filename)) throw new ManifestValidationError('FILENAME_NAME_MISMATCH', actual.filename);
    const fields = [
      ['canonicalSize', wanted.canonicalSourceIdentity.size], ['canonicalSha256', wanted.canonicalSourceIdentity.sha256],
      ['payloadSize', wanted.intermediatePayloadIdentity.size], ['payloadSha256', wanted.intermediatePayloadIdentity.sha256],
      ['statementCount', wanted.intermediatePayloadIdentity.statementCount],
    ];
    for (const [field, value] of fields) if (actual[field] !== value) throw new ManifestValidationError('SOURCE_OR_PAYLOAD_IDENTITY_MISMATCH', `${actual.filename}:${field}`);
    if (canonicalHash(actual.orderedStatementIdentities) !== canonicalHash(wanted.intermediatePayloadIdentity.orderedStatementIdentities)) throw new ManifestValidationError('ORDERED_STATEMENT_IDENTITY_MISMATCH', actual.filename);
  }
  if (canonicalHash(manifest.stageOrder) !== canonicalHash(expected.stageOrder)) throw new ManifestValidationError('STAGE_ORDER_MISMATCH');
  if (!manifest.recoveryPolicy || manifest.recoveryPolicy.reconcileLedgerOnlyEnabled !== false) throw new ManifestValidationError('UNSAFE_RECOVERY_POLICY');
  if (!manifest.timeoutLockPolicy || !Number.isInteger(manifest.timeoutLockPolicy.statementTimeoutMs) || !Number.isInteger(manifest.timeoutLockPolicy.lockTimeoutMs)) throw new ManifestValidationError('TIMEOUT_POLICY_INVALID');
  return { executable: true, classification: manifest.classification, versions };
}

module.exports = { ManifestValidationError, expectedLedgerName, bodyForHash, sealManifest, validateManifest };
