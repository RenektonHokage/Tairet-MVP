'use strict';

const fs = require('fs');
const path = require('path');
const {
  canonicalHash,
  canonicalJson,
  sealed,
  sha256Bytes,
  sha256File,
  verifySeal,
} = require('./lib/canonical');
const {
  SCHEMA_VERSION,
  loadAndValidateInputManifest,
  validatePackagePath,
} = require('./lib/input-manifest-v2');
const {
  PACKAGE_ID,
  EXPECTED_EXECUTOR_RELEASE_IDENTITY,
  EXPECTED_EXECUTOR_RELEASE_MANIFEST_SHA256,
  MIGRATIONS,
  FAILED_PACKAGE,
  PREDECESSOR,
} = require('./lib/definitions');

class PackageRuntimeError extends Error {
  constructor(code, detail = '', evidence = {}) {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.name = 'PackageRuntimeError';
    this.code = code;
    this.evidence = evidence;
  }
}

function fail(code, detail = '', evidence = {}) { throw new PackageRuntimeError(code, detail, evidence); }
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { fail('JSON_READ_FAILED', `${file}: ${error.message}`); }
}
function clone(value) { return structuredClone(value); }
function exact(left, right) { return canonicalHash(left) === canonicalHash(right); }
function verifySealed(value, field, code) {
  try { return verifySeal(value, field, code); }
  catch (error) { fail(code, error.message); }
}
function loadV3(executionRoot) {
  const releaseRoot = path.join(executionRoot, 'executor-release', 'release');
  const sourceRoot = path.join(releaseRoot, 'editable-source', 'src');
  try {
    return {
      releaseRoot,
      validateCanonicalBytes: require(path.join(sourceRoot, 'envelope', 'validator')).validateCanonicalBytes,
      verifyFrozenRelease: require(path.join(sourceRoot, 'identity', 'release')).verifyFrozenRelease,
      ProtocolClient: require(path.join(sourceRoot, 'db', 'protocol-client')).ProtocolClient,
      lastRows: require(path.join(sourceRoot, 'db', 'protocol-client')).lastRows,
      captureMaterial: require(path.join(sourceRoot, 'verifiers', 'material')).captureMaterial,
      compareStage: require(path.join(sourceRoot, 'verifiers', 'material')).compareStage,
      runInTransactionVerifier: require(path.join(sourceRoot, 'verifiers', 'in-transaction')).runInTransactionVerifier,
      runPostCommitVerifier: require(path.join(sourceRoot, 'verifiers', 'post-commit')).runPostCommitVerifier,
      classifyRecovery: require(path.join(sourceRoot, 'recovery', 'classifier')).classifyRecovery,
      RECOVERY: require(path.join(sourceRoot, 'recovery', 'classifier')).RECOVERY,
      StageInvariantGuard: require(path.join(sourceRoot, 'executor', 'invariant-guard')).StageInvariantGuard,
      ledgerInsertSql: require(path.join(sourceRoot, 'executor', 'atomic-stage')).ledgerInsertSql,
    };
  } catch (error) { fail('EXECUTOR_RELEASE_LOAD_FAILED', error.message); }
}
function resolveDescriptor(executionRoot, descriptor, code = 'PACKAGE_DESCRIPTOR_INVALID') {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) fail(code, 'object required');
  const keys = Object.keys(descriptor).sort();
  const expected = ['package_path', 'sha256', 'size'];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) fail(code, `field set ${keys.join(',')}`);
  let file;
  try { file = validatePackagePath(executionRoot, descriptor.package_path); }
  catch (error) { fail(code, error.code || error.message); }
  if (!fs.existsSync(file)) fail(code, `${descriptor.package_path} missing`);
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size !== descriptor.size || sha256File(file) !== descriptor.sha256) fail(code, descriptor.package_path);
  return file;
}
function validateRuntimeSources(runtime, sourceIdentities) {
  if (!Array.isArray(sourceIdentities) || sourceIdentities.length !== runtime.binding.consumers.length) fail('RUNTIME_SOURCE_COUNT_MISMATCH');
  if (!exact(sourceIdentities, runtime.binding.consumers)) fail('RUNTIME_SOURCE_BINDING_MISMATCH');
  for (const source of sourceIdentities) {
    const descriptor = { package_path: source.package_path, size: source.size, sha256: source.sha256 };
    resolveDescriptor(runtime.executionRoot, descriptor, 'RUNTIME_SOURCE_IDENTITY_MISMATCH');
    if (source.schema_version !== SCHEMA_VERSION || source.manifest_parser !== 'editable-source/lib/input-manifest-v2.js') fail('RUNTIME_SOURCE_SCHEMA_DISAGREEMENT', source.component);
  }
}
function validateMigrationBindings(runtime, candidateMigrations, expectedVersions) {
  if (!Array.isArray(candidateMigrations) || candidateMigrations.length !== 4) fail('MIGRATION_COUNT_MISMATCH');
  for (let index = 0; index < 4; index += 1) {
    const actual = candidateMigrations[index];
    const statement = runtime.statementManifest.migrations[index];
    const definition = MIGRATIONS[index];
    if (actual.logical_migration !== definition.logical || actual.name !== definition.name || actual.version !== expectedVersions[index]) fail('VERSION_NAME_BINDING_MISMATCH', definition.logical);
    if (actual.canonical_size !== statement.canonical.size || actual.canonical_sha256 !== statement.canonical.sha256) fail('CANONICAL_MIGRATION_IDENTITY_MISMATCH', definition.logical);
    if (actual.payload_size !== statement.payload.size || actual.payload_sha256 !== statement.payload.sha256) fail('INTERMEDIATE_PAYLOAD_IDENTITY_MISMATCH', definition.logical);
    const expectedIdentities = statement.ordered_statement_identities.map(({ ordinal, size, sha256 }) => ({ ordinal, size, sha256 }));
    if (actual.statement_count !== statement.statement_count || !exact(actual.ordered_statement_identities, expectedIdentities)) fail('STATEMENT_IDENTITY_MISMATCH', definition.logical);
    if (!exact(actual.statements_text_array, statement.statements_text_array)) fail('EXECUTION_STATEMENT_ARRAY_MISMATCH', definition.logical);
    if (actual.pre_stage !== definition.preStage || actual.post_stage !== definition.postStage) fail('STAGE_ORDER_MISMATCH', definition.logical);
  }
}
function validateArtifactBindings(runtime, bindings) {
  const expected = {
    input_manifest_sha256: runtime.inputManifest.input_manifest_sha256,
    input_manifest_schema_sha256: runtime.schemaIdentity.package_v2_input_manifest_schema_sha256,
    input_manifest_runtime_binding_sha256: runtime.binding.package_v2_input_manifest_runtime_binding_sha256,
    statement_manifest_sha256: runtime.statementManifest.statement_manifest_sha256,
    stage_verifier_manifest_sha256: runtime.verifierManifest.stage_verifier_manifest_sha256,
    final_preflight_binding_sha256: runtime.preflight.final_preflight_binding_sha256,
    eligibility_policy_sha256: runtime.eligibility.eligibility_policy_sha256,
    recovery_policy_sha256: runtime.recovery.recovery_policy_sha256,
    stage_order_sha256: runtime.stageOrder.stage_order_sha256,
    predecessor_policy_sha256: runtime.predecessorPolicy.predecessor_policy_sha256,
    failed_version_reservation_sha256: runtime.reservation.failed_package_version_reservation_sha256,
  };
  if (!exact(bindings, expected)) {
    if (bindings?.stage_verifier_manifest_sha256 !== expected.stage_verifier_manifest_sha256) fail('VERIFIER_IDENTITY_MISMATCH');
    if (bindings?.input_manifest_sha256 !== expected.input_manifest_sha256) fail('INPUT_MANIFEST_BINDING_MISMATCH');
    fail('PACKAGE_ARTIFACT_BINDING_MISMATCH');
  }
}
function validateDraftCandidate(runtime, candidate) {
  verifySealed(candidate, 'draft_descriptor_sha256', 'DRAFT_DESCRIPTOR_IDENTITY_MISMATCH');
  if (candidate.schema !== 'ACCESS_CORE_046_049_DRAFT_DEPLOYMENT_DESCRIPTOR_V2' || candidate.descriptor_version !== 2) fail('DRAFT_DESCRIPTOR_SCHEMA_MISMATCH');
  if (candidate.package_id !== PACKAGE_ID || candidate.package_classification !== 'DRAFT_NON_DEPLOYABLE') fail('PACKAGE_IDENTITY_MISMATCH');
  if (candidate.production_eligibility !== 'NOT_ELIGIBLE_DRAFT' || candidate.authoritative_packaging_event_captured !== false || candidate.real_candidate_versions_assigned !== false) fail('DRAFT_AUTHORITY_MISMATCH');
  if (candidate.target.project_identity !== 'LOCAL_DISPOSABLE_POSTGRESQL_17_6_ONLY' || candidate.target.database_identity !== 'DYNAMIC_DISPOSABLE_DATABASE' || candidate.target.direct_port !== 5432 || candidate.target.production_contact !== 0) fail('TARGET_IDENTITY_MISMATCH');
  if (candidate.executor.frozen_release_identity !== EXPECTED_EXECUTOR_RELEASE_IDENTITY || candidate.executor.frozen_release_manifest_sha256 !== EXPECTED_EXECUTOR_RELEASE_MANIFEST_SHA256 || candidate.executor.package_path !== 'executor-release/release') fail('EXECUTOR_IDENTITY_MISMATCH');
  if (candidate.test_only_version_count !== 4 || candidate.production_contact !== 0) fail('DRAFT_VERSION_POLICY_MISMATCH');
  validateArtifactBindings(runtime, candidate.artifact_identities);
  validateRuntimeSources(runtime, candidate.runtime_source_identities);
  validateMigrationBindings(runtime, candidate.migrations, MIGRATIONS.map((row) => row.testVersion));
  return { pass: true, descriptor_sha256: candidate.draft_descriptor_sha256 };
}
function validateSupportingAuthority(packagingEvent, versionAssignment) {
  verifySealed(packagingEvent, 'package_v2_packaging_event_identity_sha256', 'PACKAGING_EVENT_IDENTITY_MISMATCH');
  verifySealed(versionAssignment, 'package_v2_version_assignment_sha256', 'VERSION_ASSIGNMENT_IDENTITY_MISMATCH');
  if (packagingEvent.schema !== 'ACCESS_CORE_046_049_PACKAGING_EVENT_V2' || packagingEvent.package_id !== PACKAGE_ID || packagingEvent.write_count !== 1) fail('PACKAGING_EVENT_SCHEMA_MISMATCH');
  if (versionAssignment.schema !== 'ACCESS_CORE_046_049_VERSION_ASSIGNMENT_V2' || versionAssignment.package_id !== PACKAGE_ID || versionAssignment.write_count !== 1 || versionAssignment.renumber_count !== 0) fail('VERSION_ASSIGNMENT_SCHEMA_MISMATCH');
  if (versionAssignment.packaging_event_identity_sha256 !== packagingEvent.package_v2_packaging_event_identity_sha256) fail('VERSION_EVENT_BINDING_MISMATCH');
  if (!Array.isArray(versionAssignment.assignments) || versionAssignment.assignments.length !== 4) fail('VERSION_ASSIGNMENT_COUNT_MISMATCH');
  const event = new Date(packagingEvent.packaging_event_utc);
  if (Number.isNaN(event.getTime()) || event.toISOString().replace('.000Z', 'Z') !== packagingEvent.packaging_event_utc) fail('PACKAGING_EVENT_UTC_INVALID');
  const versions = [];
  for (let index = 0; index < 4; index += 1) {
    const row = versionAssignment.assignments[index];
    const expected = new Date(event.getTime() + index * 1000).toISOString().replace(/[-:T]/g, '').slice(0, 14);
    if (row.logical_migration !== MIGRATIONS[index].logical || row.name !== MIGRATIONS[index].name || row.version !== expected || !/^\d{14}$/.test(row.version)) fail('VERSION_ASSIGNMENT_SEQUENCE_MISMATCH', String(index));
    if (FAILED_PACKAGE.versions.includes(row.version) || row.version <= PREDECESSOR.version || row.version <= FAILED_PACKAGE.versions.at(-1)) fail('RESERVED_VERSION_REUSED', row.version);
    versions.push(row.version);
  }
  if (new Set(versions).size !== 4 || versions.some((value, index) => index > 0 && value <= versions[index - 1])) fail('VERSION_ASSIGNMENT_NOT_STRICT');
  return versions;
}
function validateAuthoritativeCandidate(runtime, candidate, supporting = {}) {
  const packagingEvent = supporting.packagingEvent || runtime.packagingEvent;
  const versionAssignment = supporting.versionAssignment || runtime.versionAssignment;
  const versions = validateSupportingAuthority(packagingEvent, versionAssignment);
  verifySealed(candidate, 'manifest_sha256', 'DEPLOYMENT_MANIFEST_IDENTITY_MISMATCH');
  if (candidate.schema !== 'ACCESS_CORE_046_049_DEPLOYMENT_MANIFEST_V2' || candidate.manifest_version !== 2) fail('DEPLOYMENT_MANIFEST_SCHEMA_MISMATCH');
  if (candidate.package_id !== PACKAGE_ID || candidate.package_authority !== 'AUTHORITATIVE_LOCAL_DEPLOYMENT_CANDIDATE') fail('PACKAGE_IDENTITY_MISMATCH');
  if (candidate.production_eligibility !== 'PENDING_FINAL_PRODUCTION_LEDGER_GUARD') fail('PACKAGE_ELIGIBILITY_MISMATCH');
  if (candidate.packaging_event.identity_sha256 !== packagingEvent.package_v2_packaging_event_identity_sha256 || candidate.packaging_event.utc !== packagingEvent.packaging_event_utc) fail('PACKAGING_EVENT_BINDING_MISMATCH');
  if (candidate.version_assignment_sha256 !== versionAssignment.package_v2_version_assignment_sha256) fail('VERSION_ASSIGNMENT_IDENTITY_MISMATCH');
  if (candidate.target.supabase_project_id !== 'omteyctmrgahavgfaodw' || candidate.target.database !== 'postgres' || candidate.target.direct_port !== 5432 || candidate.target.production_contact_in_this_checkpoint !== 0) fail('TARGET_IDENTITY_MISMATCH');
  if (candidate.expected_predecessor.version !== PREDECESSOR.version || candidate.expected_predecessor.name !== PREDECESSOR.name || candidate.expected_predecessor.production_guard_status !== 'PENDING') fail('PREDECESSOR_IDENTITY_MISMATCH');
  if (candidate.executor.frozen_release_identity !== EXPECTED_EXECUTOR_RELEASE_IDENTITY || candidate.executor.frozen_release_manifest_sha256 !== EXPECTED_EXECUTOR_RELEASE_MANIFEST_SHA256 || candidate.executor.package_path !== 'executor-release/release') fail('EXECUTOR_IDENTITY_MISMATCH');
  if (candidate.manifest_write_count !== 1 || candidate.manifest_correction_count !== 0) fail('MANIFEST_ASSIGNMENT_COUNT_MISMATCH');
  if (candidate.development_gates.runtime_self_validation !== 'PASS' || candidate.development_gates.development_rehearsal !== 'PASS_19_OF_19') fail('DEVELOPMENT_GATES_NOT_GREEN');
  if (candidate.production_contact !== 0) fail('PRODUCTION_CONTACT_POLICY_MISMATCH');
  validateArtifactBindings(runtime, candidate.artifact_identities);
  validateRuntimeSources(runtime, candidate.runtime_source_identities);
  validateMigrationBindings(runtime, candidate.migrations, versions);
  return { pass: true, manifest_sha256: candidate.manifest_sha256, versions };
}
function validateAuthoritativeCandidateBytes(runtime, bytes, supporting) {
  let candidate;
  try { candidate = JSON.parse(Buffer.from(bytes).toString('utf8')); }
  catch (error) { fail('DEPLOYMENT_MANIFEST_PARSE_FAILED', error.message); }
  if (!Buffer.from(canonicalJson(candidate), 'utf8').equals(Buffer.from(bytes))) fail('DEPLOYMENT_MANIFEST_NOT_CANONICAL');
  return validateAuthoritativeCandidate(runtime, candidate, supporting);
}
function verifyStatementTransport(runtime) {
  if (runtime.statementManifest.schema !== 'ACCESS_CORE_046_049_STATEMENT_MANIFEST_V2' || runtime.statementManifest.reconstruction_pass_count !== 4 || runtime.statementManifest.reconstruction_fail_count !== 0 || runtime.statementManifest.migrations.length !== 4) fail('STATEMENT_MANIFEST_SCHEMA_MISMATCH');
  for (let migrationIndex = 0; migrationIndex < 4; migrationIndex += 1) {
    const manifest = runtime.statementManifest.migrations[migrationIndex];
    const definition = MIGRATIONS[migrationIndex];
    const canonicalFile = resolveDescriptor(runtime.executionRoot, manifest.canonical, 'CANONICAL_MIGRATION_IDENTITY_MISMATCH');
    const payloadFile = resolveDescriptor(runtime.executionRoot, manifest.payload, 'INTERMEDIATE_PAYLOAD_IDENTITY_MISMATCH');
    const validated = runtime.v3.validateCanonicalBytes(fs.readFileSync(canonicalFile), { size: definition.size, sha256: definition.sha256, payloadSize: definition.payloadSize, payloadSha256: definition.payloadSha256 });
    if (!validated.payload.equals(fs.readFileSync(payloadFile))) fail('INTERMEDIATE_PAYLOAD_BYTE_MISMATCH', definition.logical);
    if (validated.parsed.statements.length !== manifest.statement_count) fail('STATEMENT_COUNT_MISMATCH', definition.logical);
    const transport = [];
    const texts = [];
    for (let index = 0; index < manifest.ordered_statement_identities.length; index += 1) {
      const descriptor = manifest.ordered_statement_identities[index];
      const statementFile = resolveDescriptor(runtime.executionRoot, { package_path: descriptor.package_path, size: descriptor.size, sha256: descriptor.sha256 }, 'STATEMENT_IDENTITY_MISMATCH');
      const separatorFile = resolveDescriptor(runtime.executionRoot, descriptor.separator, 'STATEMENT_SEPARATOR_IDENTITY_MISMATCH');
      const statement = fs.readFileSync(statementFile);
      const separator = fs.readFileSync(separatorFile);
      if (descriptor.ordinal !== index || !statement.equals(validated.parsed.statements[index].statement) || !separator.equals(validated.parsed.statements[index].separator)) fail('STATEMENT_TRANSPORT_MISMATCH', `${definition.logical}/${index}`);
      const text = statement.toString('utf8');
      if (!Buffer.from(text, 'utf8').equals(statement)) fail('NON_UTF8_STATEMENT', `${definition.logical}/${index}`);
      texts.push(text);
      transport.push(separator, statement);
    }
    const trailingFile = resolveDescriptor(runtime.executionRoot, manifest.trailing_separator, 'TRAILING_SEPARATOR_IDENTITY_MISMATCH');
    const trailing = fs.readFileSync(trailingFile);
    if (!trailing.equals(validated.parsed.trailingSeparator)) fail('TRAILING_SEPARATOR_IDENTITY_MISMATCH', definition.logical);
    transport.push(trailing);
    if (!Buffer.concat(transport).equals(validated.payload) || !exact(texts, manifest.statements_text_array)) fail('STATEMENT_RECONSTRUCTION_FAILED', definition.logical);
  }
}
function loadRuntime(executionRoot, mode = 'DRAFT') {
  const root = path.resolve(executionRoot);
  if (!['DRAFT', 'AUTHORITATIVE'].includes(mode)) fail('RUNTIME_MODE_INVALID', mode);
  const inputPath = path.join(root, 'manifests', 'package-input-manifest-v2.json');
  let inputValidation;
  try { inputValidation = loadAndValidateInputManifest(inputPath, { packageRoot: root, consumerSchemaVersion: 2, verifyFiles: true }); }
  catch (error) { fail(error.code || 'INPUT_MANIFEST_VALIDATION_FAILED', error.message); }
  const inputManifest = inputValidation.manifest;
  const v3 = loadV3(root);
  const statementManifest = readJson(path.join(root, 'manifests', 'statement-manifest-v2.json'));
  const verifierManifest = readJson(path.join(root, 'manifests', 'stage-verifier-manifest-v2.json'));
  const preflight = readJson(path.join(root, 'manifests', 'final-preflight-binding-v2.json'));
  const binding = readJson(path.join(root, 'manifests', 'input-manifest-runtime-binding-v2.json'));
  const schemaIdentity = readJson(path.join(root, 'manifests', 'input-manifest-schema-identity-v2.json'));
  const eligibility = readJson(path.join(root, 'package-contracts', 'eligibility-policy-v2.json'));
  const recovery = readJson(path.join(root, 'package-contracts', 'recovery-policy-v2.json'));
  const stageOrder = readJson(path.join(root, 'package-contracts', 'stage-order-v2.json'));
  const predecessorPolicy = readJson(path.join(root, 'package-contracts', 'predecessor-ledger-policy-v2.json'));
  const reservation = readJson(path.join(root, 'version-reservations', 'failed-package-versions.json'));
  const stageContract = readJson(path.join(root, 'package-contracts', 'independent-stage-contract.json'));
  for (const [value, field, code] of [
    [statementManifest, 'statement_manifest_sha256', 'STATEMENT_MANIFEST_IDENTITY_MISMATCH'],
    [verifierManifest, 'stage_verifier_manifest_sha256', 'VERIFIER_MANIFEST_IDENTITY_MISMATCH'],
    [preflight, 'final_preflight_binding_sha256', 'FINAL_PREFLIGHT_IDENTITY_MISMATCH'],
    [binding, 'package_v2_input_manifest_runtime_binding_sha256', 'INPUT_RUNTIME_BINDING_IDENTITY_MISMATCH'],
    [schemaIdentity, 'package_v2_input_manifest_schema_sha256', 'INPUT_SCHEMA_IDENTITY_MISMATCH'],
    [eligibility, 'eligibility_policy_sha256', 'ELIGIBILITY_POLICY_IDENTITY_MISMATCH'],
    [recovery, 'recovery_policy_sha256', 'RECOVERY_POLICY_IDENTITY_MISMATCH'],
    [stageOrder, 'stage_order_sha256', 'STAGE_ORDER_IDENTITY_MISMATCH'],
    [predecessorPolicy, 'predecessor_policy_sha256', 'PREDECESSOR_POLICY_IDENTITY_MISMATCH'],
    [reservation, 'failed_package_version_reservation_sha256', 'VERSION_RESERVATION_IDENTITY_MISMATCH'],
  ]) verifySealed(value, field, code);
  if (binding.schema_version !== 2 || binding.manifest_schema !== 'ACCESS_CORE_PACKAGE_INPUT_MANIFEST_V2' || binding.runtime_resolution_field !== 'package_path' || !exact(binding.rejected_legacy_fields, ['path', 'destination'])) fail('INPUT_RUNTIME_BINDING_CONTRACT_MISMATCH');
  resolveDescriptor(root, binding.schema_file, 'INPUT_SCHEMA_FILE_IDENTITY_MISMATCH');
  resolveDescriptor(root, binding.shared_parser, 'INPUT_PARSER_FILE_IDENTITY_MISMATCH');
  if (schemaIdentity.schema_file_sha256 !== binding.schema_file.sha256 || schemaIdentity.parser_sha256 !== binding.shared_parser.sha256) fail('INPUT_SCHEMA_PARSER_BINDING_MISMATCH');
  const releaseManifestPath = path.join(v3.releaseRoot, 'frozen-release-manifest.json');
  if (sha256File(releaseManifestPath) !== EXPECTED_EXECUTOR_RELEASE_MANIFEST_SHA256) fail('EXECUTOR_RELEASE_MANIFEST_MISMATCH');
  const releaseManifest = readJson(releaseManifestPath);
  if (releaseManifest.releaseSha256 !== EXPECTED_EXECUTOR_RELEASE_IDENTITY) fail('EXECUTOR_IDENTITY_MISMATCH');
  const releaseEvidence = v3.verifyFrozenRelease(v3.releaseRoot, releaseManifest);
  if (releaseEvidence.verifiedFileCount !== 108) fail('EXECUTOR_RELEASE_FILE_COUNT_MISMATCH');
  const runtime = { executionRoot: root, mode, inputValidation, inputManifest, v3, statementManifest, verifierManifest, preflight, binding, schemaIdentity, eligibility, recovery, stageOrder, predecessorPolicy, reservation, stageContract, releaseManifest, releaseEvidence };
  for (const descriptor of verifierManifest.files) resolveDescriptor(root, { package_path: descriptor.package_path, size: descriptor.size, sha256: descriptor.sha256 }, 'VERIFIER_IDENTITY_MISMATCH');
  if (verifierManifest.files.length !== 9 || verifierManifest.static_validation.pass !== true || verifierManifest.static_validation.forbidden_write_or_transaction_control_count !== 0) fail('VERIFIER_STATIC_VALIDATION_MISMATCH');
  resolveDescriptor(root, { package_path: preflight.package_path, size: preflight.size, sha256: preflight.sha256 }, 'FINAL_PREFLIGHT_IDENTITY_MISMATCH');
  verifyStatementTransport(runtime);
  if (reservation.failed_package_id !== FAILED_PACKAGE.package_id || !exact(reservation.reservations.map((row) => row.version), FAILED_PACKAGE.versions) || reservation.reservations.some((row) => !exact(row.statuses, ['RESERVED_BY_FAILED_PACKAGE', 'NOT_DEPLOYABLE']))) fail('FAILED_VERSION_RESERVATION_MISMATCH');
  if (mode === 'DRAFT') {
    runtime.executionDescriptor = readJson(path.join(root, 'draft-package', 'draft-deployment-descriptor-v2.json'));
    validateDraftCandidate(runtime, runtime.executionDescriptor);
    runtime.descriptorIdentity = runtime.executionDescriptor.draft_descriptor_sha256;
  } else {
    runtime.packagingEvent = readJson(path.join(root, 'manifests', 'packaging-event-v2.json'));
    runtime.versionAssignment = readJson(path.join(root, 'deployment-manifest', 'version-assignment-v2.json'));
    runtime.executionDescriptor = readJson(path.join(root, 'deployment-manifest', 'access-core-046-049-deployment-manifest-v2.json'));
    validateAuthoritativeCandidate(runtime, runtime.executionDescriptor);
    runtime.descriptorIdentity = runtime.executionDescriptor.manifest_sha256;
  }
  runtime.selfValidation = {
    pass: true,
    mode,
    input_manifest_schema: inputManifest.schema,
    input_manifest_schema_version: inputManifest.schema_version,
    artifact_count: inputValidation.artifact_count,
    runtime_required_count: inputValidation.runtime_required_count,
    executor_release_identity: EXPECTED_EXECUTOR_RELEASE_IDENTITY,
    canonical_migration_count: 4,
    intermediate_payload_count: 4,
    statement_counts: statementManifest.migrations.map((row) => row.statement_count),
    stage_verifier_count: verifierManifest.files.length,
    preflight_sha256: preflight.sha256,
    eligibility_schema: eligibility.schema,
    runtime_resolution_field: binding.runtime_resolution_field,
    legacy_fields_rejected: binding.rejected_legacy_fields,
    production_contact: 0,
  };
  return runtime;
}

function expectedLedgerRows(runtime, stageIndex, includeCurrent) {
  const rows = [{ version: PREDECESSOR.version, name: PREDECESSOR.name, statements: [...PREDECESSOR.localStatements] }];
  const limit = includeCurrent ? stageIndex + 1 : stageIndex;
  for (let index = 0; index < limit; index += 1) {
    const migration = runtime.executionDescriptor.migrations[index];
    rows.push({ version: migration.version, name: migration.name, statements: migration.statements_text_array });
  }
  return rows;
}
async function readLedger(runtime, client) {
  const sql = `SELECT coalesce(jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',to_jsonb(statements)) ORDER BY version),'[]'::jsonb)::text AS ledger FROM supabase_migrations.schema_migrations;`;
  const rows = runtime.v3.lastRows(await client.simpleQuery(sql));
  if (rows.length !== 1) fail('LEDGER_READ_CARDINALITY_MISMATCH');
  return JSON.parse(rows[0].ledger);
}
function stageExact(runtime, stage, material) {
  try { runtime.v3.compareStage(stage, material, runtime.stageContract); return true; }
  catch { return false; }
}
function recoveryFromEvidence(runtime, actualLedger, beforeRows, afterRows, material, migration, ambiguousCommit) {
  const ledger = exact(actualLedger, afterRows) ? 'exact' : exact(actualLedger, beforeRows) ? 'absent' : 'incompatible';
  const preExact = stageExact(runtime, migration.pre_stage, material);
  const postExact = stageExact(runtime, migration.post_stage, material);
  let effects = 'incompatible';
  if (postExact) effects = 'exact';
  else if (preExact) effects = 'absent';
  else if (material.catalogFingerprint === runtime.stageContract.stages[migration.post_stage].catalog_fingerprint) effects = 'partial';
  return { classification: runtime.v3.classifyRecovery({ ledger, effects, predecessorExact: preExact, ambiguousCommit }), ledger, effects, preExact, postExact };
}
async function runSnapshotSql(runtime, client, stage, phase) {
  const filename = stage === 'PRE_046' ? 'PRE_046.post-commit.sql' : `${stage}.${phase === 'in-transaction' ? 'in-transaction' : 'post-commit'}.sql`;
  const descriptor = runtime.verifierManifest.files.find((row) => row.package_path === `stage-verifiers/${filename}`);
  if (!descriptor) fail('PACKAGE_VERIFIER_DESCRIPTOR_MISSING', filename);
  const file = resolveDescriptor(runtime.executionRoot, { package_path: descriptor.package_path, size: descriptor.size, sha256: descriptor.sha256 }, 'VERIFIER_IDENTITY_MISMATCH');
  const sql = fs.readFileSync(file, 'utf8');
  const rows = runtime.v3.lastRows(await client.simpleQuery(sql));
  if (rows.length !== 1 || typeof rows[0].verifier_snapshot !== 'string') fail('PACKAGE_VERIFIER_OUTPUT_CARDINALITY_MISMATCH', filename);
  return { filename, snapshot: JSON.parse(rows[0].verifier_snapshot), sql_sha256: sha256Bytes(Buffer.from(sql, 'utf8')) };
}
function validatePreSnapshot(runtime, evidence, expectedRows) {
  const snapshot = evidence.snapshot;
  const mismatches = [];
  if (snapshot.stage !== 'PRE_046') mismatches.push('stage');
  if (snapshot.transaction_read_only !== 'on') mismatches.push('read_only');
  if (!String(snapshot.server_version).startsWith('17.6')) mismatches.push('server_version');
  if (!exact(snapshot.ledger, expectedRows)) mismatches.push('ledger');
  if (snapshot.fulfillment_table !== false || snapshot.delivery_attempt_table !== false || snapshot.marker_column !== false) mismatches.push('structural_pre_state');
  if (!snapshot.source_relation_oids || Object.keys(snapshot.source_relation_oids).length !== 5) mismatches.push('source_relation_oids');
  if (!snapshot.source_data || Object.keys(snapshot.source_data).length !== 5) mismatches.push('source_data');
  if (mismatches.length) fail('PRE_046_PACKAGE_VERIFIER_FAILED', mismatches.join(','), { snapshot });
  return { ...evidence, pass: true, evidence_sha256: canonicalHash({ filename: evidence.filename, snapshot }) };
}
function validatePostSnapshot(runtime, evidence, stage, phase, expectedRows, baseline) {
  const snapshot = evidence.snapshot;
  const mismatches = [];
  if (snapshot.stage !== stage || snapshot.phase !== phase) mismatches.push('stage_or_phase');
  if (snapshot.transaction_read_only !== (phase === 'post-commit' ? 'on' : 'off')) mismatches.push('transaction_read_only');
  if (!String(snapshot.server_version).startsWith('17.6')) mismatches.push('server_version');
  if (!exact(snapshot.ledger, expectedRows)) mismatches.push('ledger');
  if (!exact(snapshot.source_relation_oids, baseline.source_relation_oids)) mismatches.push('source_relation_oids');
  if (!exact(snapshot.source_data, baseline.source_data)) mismatches.push('source_data');
  if (snapshot.orphan_fulfillment_count !== 0 || snapshot.eligible_without_fulfillment_count !== 0 || snapshot.fulfillment_without_eligible_count !== 0) mismatches.push('backfill_bijection');
  if (snapshot.fulfillment_count !== snapshot.eligible_order_count) mismatches.push('fulfillment_projection');
  if (snapshot.delivery_attempt_count !== 0) mismatches.push('unexpected_delivery_attempt_rows');
  if (mismatches.length) fail('PACKAGE_STAGE_VERIFIER_FAILED', `${stage}/${phase}/${mismatches.join(',')}`, { snapshot });
  return { ...evidence, pass: true, evidence_sha256: canonicalHash({ filename: evidence.filename, snapshot }) };
}
async function capturePrecondition(runtime, connectionConfig) {
  const client = new runtime.v3.ProtocolClient({ ...connectionConfig, readOnly: true, applicationName: `tairet-access-core-v2-${PACKAGE_ID}/pre-046` });
  await client.connect();
  try {
    const material = await runtime.v3.captureMaterial(client);
    const materialEvidence = runtime.v3.compareStage('PRE_046', material, runtime.stageContract);
    const snapshot = validatePreSnapshot(runtime, await runSnapshotSql(runtime, client, 'PRE_046', 'post-commit'), expectedLedgerRows(runtime, 0, false));
    return { material: materialEvidence, snapshot, baseline: { source_relation_oids: snapshot.snapshot.source_relation_oids, source_data: snapshot.snapshot.source_data }, connection: client.invariantEvidence(), pass: true };
  } finally { await client.close(); }
}
async function inTransactionVerification(runtime, client, migration, expectedRows, baseline, phaseLabel) {
  const material = await runtime.v3.runInTransactionVerifier({ client, stage: migration.post_stage, frozenContract: runtime.stageContract });
  const snapshot = validatePostSnapshot(runtime, await runSnapshotSql(runtime, client, migration.post_stage, 'in-transaction'), migration.post_stage, 'in-transaction', expectedRows, baseline);
  return { phase_label: phaseLabel, material, snapshot, evidence_sha256: canonicalHash({ phaseLabel, material, snapshot: snapshot.evidence_sha256 }) };
}
async function postCommitVerification(runtime, connectionConfig, migration, expectedRows, baseline, identityBinding, suffix = 'post-commit') {
  const client = new runtime.v3.ProtocolClient({ ...connectionConfig, readOnly: true, applicationName: `tairet-access-core-v2-${PACKAGE_ID}/${migration.logical_migration}/${suffix}` });
  await client.connect();
  try {
    const material = await runtime.v3.runPostCommitVerifier({ client, stage: migration.post_stage, frozenContract: runtime.stageContract, expectedLedgerRows: expectedRows, identityBinding, readLedger: (inner) => readLedger(runtime, inner) });
    const snapshot = validatePostSnapshot(runtime, await runSnapshotSql(runtime, client, migration.post_stage, 'post-commit'), migration.post_stage, 'post-commit', expectedRows, baseline);
    return { material, snapshot, connection: client.invariantEvidence(), pass: true, evidence_sha256: canonicalHash({ material: material.evidenceSha256, snapshot: snapshot.evidence_sha256, identityBinding }) };
  } finally { await client.close(); }
}
async function resolveAmbiguous(runtime, connectionConfig, beforeRows, afterRows, migration, baseline, identityBinding, ambiguousCommit) {
  const client = new runtime.v3.ProtocolClient({ ...connectionConfig, readOnly: true, applicationName: `tairet-access-core-v2-${PACKAGE_ID}/ambiguous-recovery` });
  await client.connect();
  try {
    const ledgerRows = await readLedger(runtime, client);
    const material = await runtime.v3.captureMaterial(client);
    const result = recoveryFromEvidence(runtime, ledgerRows, beforeRows, afterRows, material, migration, ambiguousCommit);
    let postCommit = null;
    if (result.classification === runtime.v3.RECOVERY.AMBIGUOUS_COMMIT_RESOLVED_AS_COMMITTED) postCommit = await postCommitVerification(runtime, connectionConfig, migration, afterRows, baseline, identityBinding, 'ambiguous-post-commit');
    return { ...result, ledgerRows, material, postCommit, readOnlyConnectionId: client.connectionId, identityBinding };
  } finally { await client.close(); }
}
async function proveRollback(runtime, connectionConfig, beforeRows, migration) {
  const client = new runtime.v3.ProtocolClient({ ...connectionConfig, readOnly: true, applicationName: `tairet-access-core-v2-${PACKAGE_ID}/rollback-oracle` });
  await client.connect();
  try {
    const ledgerRows = await readLedger(runtime, client);
    const material = await runtime.v3.captureMaterial(client);
    return { pass: exact(ledgerRows, beforeRows) && stageExact(runtime, migration.pre_stage, material), ledgerRows, material, connectionId: client.connectionId };
  } finally { await client.close(); }
}
async function executePackageStage(options) {
  const { runtime, logicalMigration, connectionConfig, sourceBaseline, faultPlan = null } = options;
  if (!runtime || !sourceBaseline) fail('PACKAGE_EXECUTION_CONTEXT_REQUIRED');
  if (runtime.mode === 'DRAFT') validateDraftCandidate(runtime, runtime.executionDescriptor);
  else validateAuthoritativeCandidate(runtime, runtime.executionDescriptor);
  const index = runtime.executionDescriptor.migrations.findIndex((row) => row.logical_migration === logicalMigration);
  if (index < 0) fail('UNKNOWN_MIGRATION', logicalMigration);
  const migration = runtime.executionDescriptor.migrations[index];
  const statementAuthority = runtime.statementManifest.migrations[index];
  const canonicalFile = resolveDescriptor(runtime.executionRoot, statementAuthority.canonical, 'CANONICAL_MIGRATION_IDENTITY_MISMATCH');
  const payloadFile = resolveDescriptor(runtime.executionRoot, statementAuthority.payload, 'INTERMEDIATE_PAYLOAD_IDENTITY_MISMATCH');
  const validated = runtime.v3.validateCanonicalBytes(fs.readFileSync(canonicalFile), { size: migration.canonical_size, sha256: migration.canonical_sha256, payloadSize: migration.payload_size, payloadSha256: migration.payload_sha256 });
  const payload = fs.readFileSync(payloadFile);
  if (!payload.equals(validated.payload)) fail('INTERMEDIATE_PAYLOAD_BYTE_MISMATCH', logicalMigration);
  const statements = validated.parsed.statements.map((row) => row.statement.toString('utf8'));
  if (!exact(statements, migration.statements_text_array)) fail('EXECUTION_STATEMENT_ARRAY_MISMATCH', logicalMigration);
  const beforeRows = expectedLedgerRows(runtime, index, false);
  const afterRows = expectedLedgerRows(runtime, index, true);
  const identityBinding = { executorReleaseSha256: EXPECTED_EXECUTOR_RELEASE_IDENTITY, packageDescriptorSha256: runtime.descriptorIdentity, sourceSha256: migration.canonical_sha256, payloadSha256: migration.payload_sha256, verifierManifestSha256: runtime.verifierManifest.stage_verifier_manifest_sha256, version: migration.version, name: migration.name };
  const client = new runtime.v3.ProtocolClient({ ...connectionConfig, applicationName: `tairet-access-core-v2-${PACKAGE_ID}/${logicalMigration}` });
  const guard = new runtime.v3.StageInvariantGuard(client.connectionId);
  let transactionStarted = false;
  let committed = false;
  let commitCount = 0;
  await client.connect();
  try {
    const actualLedger = await readLedger(runtime, client);
    const material = await runtime.v3.captureMaterial(client);
    const preflight = recoveryFromEvidence(runtime, actualLedger, beforeRows, afterRows, material, migration, false);
    if (preflight.classification === runtime.v3.RECOVERY.ALREADY_APPLIED_VERIFIED) {
      await client.close();
      const postCommit = await postCommitVerification(runtime, connectionConfig, migration, afterRows, sourceBaseline, identityBinding, 'already-applied');
      return { status: 'PASS', classification: runtime.v3.RECOVERY.ALREADY_APPLIED_VERIFIED, logicalMigration, identityBinding, preflight, postCommit, mutationConnection: client.invariantEvidence(), commitCount: 0 };
    }
    if (preflight.classification !== runtime.v3.RECOVERY.NOT_APPLIED_VERIFIED) fail(preflight.classification, '', { preflight });
    let packagePrecondition = null;
    if (logicalMigration === '046') {
      packagePrecondition = await capturePrecondition(runtime, connectionConfig);
      if (!exact(packagePrecondition.baseline, sourceBaseline)) fail('PRE_046_BASELINE_BINDING_MISMATCH');
    }
    await client.simpleQuery('BEGIN;'); transactionStarted = true;
    guard.record('BEGIN', client.invariantEvidence());
    const timeout = runtime.executionDescriptor.timeout_lock_policy;
    await client.simpleQuery(`SET LOCAL statement_timeout = '${timeout.statement_timeout_ms}ms'; SET LOCAL lock_timeout = '${timeout.lock_timeout_ms}ms'; SET LOCAL idle_in_transaction_session_timeout = '${timeout.idle_in_transaction_timeout_ms}ms';`);
    guard.record('TIMEOUTS');
    await client.simpleQuery(payload.toString('utf8'));
    guard.record('PAYLOAD_SIMPLE_QUERY', { operationKind: client.operationKinds.at(-1) });
    if (faultPlan?.migrationStatementFailure) await client.simpleQuery('SELECT 1/0;');
    if (faultPlan?.disconnectBeforeCommit) {
      client.destroyUncertain();
      await new Promise((resolve) => setTimeout(resolve, 250));
      const recovery = await resolveAmbiguous(runtime, connectionConfig, beforeRows, afterRows, migration, sourceBaseline, identityBinding, true);
      if (recovery.classification !== runtime.v3.RECOVERY.AMBIGUOUS_COMMIT_RESOLVED_AS_ROLLED_BACK) fail('DISCONNECT_RECOVERY_UNEXPECTED', recovery.classification, { recovery });
      return { status: 'CONTROLLED_FAILURE', classification: recovery.classification, logicalMigration, identityBinding, preflight, packagePrecondition, recovery, commitCount: 0, mutationConnection: client.invariantEvidence() };
    }
    if (faultPlan?.verifierFailure) await client.simpleQuery(`COMMENT ON SCHEMA public IS 'NON_DEPLOYABLE_LOCAL_V2_VERIFIER_FAULT';`);
    const inTransaction = await inTransactionVerification(runtime, client, migration, beforeRows, sourceBaseline, 'before-ledger-insert');
    guard.record('IN_TRANSACTION_VERIFIER', { evidenceSha256: inTransaction.evidence_sha256 });
    if (faultPlan?.ledgerInsertFailure) await client.simpleQuery('SELECT 1/0;');
    await client.extendedQuery(runtime.v3.ledgerInsertSql(statements.length), [migration.version, migration.name, ...statements]);
    guard.record('LEDGER_PARAMETERIZED_INSERT', { operationKind: client.operationKinds.at(-1) });
    const ledgerReread = await readLedger(runtime, client);
    if (!exact(ledgerReread, afterRows)) fail('LEDGER_REREAD_MISMATCH');
    guard.record('LEDGER_REREAD');
    const effectReread = await inTransactionVerification(runtime, client, migration, afterRows, sourceBaseline, 'after-ledger-insert');
    guard.record('EFFECT_REREAD', { evidenceSha256: effectReread.evidence_sha256 });
    commitCount += 1;
    await client.simpleQuery('COMMIT;'); committed = true;
    guard.record('COMMIT');
    await client.close();
    guard.record('MUTATION_CONNECTION_CLOSED');
    if (faultPlan?.simulateLostCommitAck) {
      const recovery = await resolveAmbiguous(runtime, connectionConfig, beforeRows, afterRows, migration, sourceBaseline, identityBinding, true);
      if (recovery.classification !== runtime.v3.RECOVERY.AMBIGUOUS_COMMIT_RESOLVED_AS_COMMITTED) fail('LOST_ACK_RECOVERY_UNEXPECTED', recovery.classification, { recovery });
      return { status: 'PASS', classification: recovery.classification, logicalMigration, identityBinding, preflight, packagePrecondition, inTransaction, effectReread, recovery, commitCount, mutationConnection: client.invariantEvidence() };
    }
    const postCommit = await postCommitVerification(runtime, connectionConfig, migration, afterRows, sourceBaseline, identityBinding);
    if (postCommit.connection.connectionId === client.connectionId) fail('POST_COMMIT_CONNECTION_NOT_INDEPENDENT');
    guard.record('POST_COMMIT_READ_ONLY_VERIFIER', { readOnly: true, connectionId: postCommit.connection.connectionId });
    guard.record('COMPLETE');
    return { status: 'PASS', classification: 'APPLIED_AND_VERIFIED', logicalMigration, identityBinding, preflight, packagePrecondition, inTransaction, ledgerReread, effectReread, postCommit, guard: guard.evidence(), commitCount, mutationConnection: client.invariantEvidence() };
  } catch (error) {
    if (!committed && transactionStarted && !client.closed) {
      try { await client.simpleQuery('ROLLBACK;'); } catch { /* rollback oracle is authoritative */ }
    }
    if (!client.closed) await client.close();
    const rollback = !committed && transactionStarted ? await proveRollback(runtime, connectionConfig, beforeRows, migration) : null;
    if (rollback && !rollback.pass) fail('ROLLBACK_ORACLE_FAILED', error.message, { originalError: error.code || error.message, rollback });
    throw new PackageRuntimeError(error.code || 'PACKAGE_STAGE_FAILED', error.message, { ...(error.evidence || {}), rollback, mutationConnection: client.invariantEvidence(), commitCount });
  }
}
async function captureState(runtime, connectionConfig) {
  const client = new runtime.v3.ProtocolClient({ ...connectionConfig, readOnly: true, applicationName: `tairet-access-core-v2-${PACKAGE_ID}/evidence-capture` });
  await client.connect();
  try {
    const ledger = await readLedger(runtime, client);
    const material = await runtime.v3.captureMaterial(client);
    const rows = runtime.v3.lastRows(await client.simpleQuery(`SELECT count(*)::text AS package_sessions FROM pg_stat_activity WHERE application_name LIKE 'tairet-access-core-v2-${PACKAGE_ID}/%' AND pid <> pg_backend_pid();`));
    return { ledger, material, other_package_session_count: Number(rows[0].package_sessions), connection: client.invariantEvidence(), evidence_sha256: canonicalHash({ ledger, material }) };
  } finally { await client.close(); }
}

module.exports = {
  PackageRuntimeError,
  loadRuntime,
  validateDraftCandidate,
  validateAuthoritativeCandidate,
  validateAuthoritativeCandidateBytes,
  expectedLedgerRows,
  readLedger,
  capturePrecondition,
  captureState,
  executePackageStage,
  resolveDescriptor,
  sealed,
};
