'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { canonicalJson, sealed, verifySeal } = require('./lib/canonical');
const { PACKAGE_ID, MIGRATIONS, EXPECTED_EXECUTOR_RELEASE_IDENTITY } = require('./lib/definitions');
const { loadRuntime } = require('./package-runtime');

const packageRoot = path.resolve(__dirname, '..');
const resultPath = path.join(packageRoot, 'development-evidence', 'runtime-self-validation', 'runtime-self-validation-result-v2.json');

function main() {
  if (fs.existsSync(resultPath)) throw new Error('RUNTIME_SELF_VALIDATION_RESULT_ALREADY_EXISTS');
  const contractPath = path.join(packageRoot, 'development-evidence', 'contract-tests', 'input-manifest-v2-test-result.json');
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  verifySeal(contract, 'package_v2_input_manifest_test_matrix_sha256', 'CONTRACT_TEST_IDENTITY_MISMATCH');
  assert.equal(contract.pass_count, 15);
  assert.equal(contract.fail_count, 0);
  const runtime = loadRuntime(packageRoot, 'DRAFT');
  assert.equal(runtime.selfValidation.pass, true);
  assert.equal(runtime.selfValidation.artifact_count, 153);
  assert.equal(runtime.selfValidation.executor_release_identity, EXPECTED_EXECUTOR_RELEASE_IDENTITY);
  assert.deepEqual(runtime.selfValidation.statement_counts, [69, 12, 6, 6]);
  assert.equal(runtime.executionDescriptor.package_classification, 'DRAFT_NON_DEPLOYABLE');
  assert.deepEqual(runtime.executionDescriptor.migrations.map((row) => row.version), MIGRATIONS.map((row) => row.testVersion));
  const body = {
    schema: 'ACCESS_CORE_046_049_RUNTIME_SELF_VALIDATION_RESULT_V2',
    package_id: PACKAGE_ID,
    package_classification: 'DRAFT_NON_DEPLOYABLE',
    runtime_self_validation: 'PASS',
    exact_runtime_source: 'editable-source/package-runtime.js',
    exact_shared_parser: 'editable-source/lib/input-manifest-v2.js',
    contract_test_result_sha256: contract.package_v2_input_manifest_test_matrix_sha256,
    artifact_count: runtime.selfValidation.artifact_count,
    runtime_required_count: runtime.selfValidation.runtime_required_count,
    canonical_migration_count: runtime.selfValidation.canonical_migration_count,
    intermediate_payload_count: runtime.selfValidation.intermediate_payload_count,
    statement_counts: runtime.selfValidation.statement_counts,
    stage_verifier_count: runtime.selfValidation.stage_verifier_count,
    executor_release_identity: runtime.selfValidation.executor_release_identity,
    input_manifest_schema: runtime.selfValidation.input_manifest_schema,
    input_manifest_schema_version: runtime.selfValidation.input_manifest_schema_version,
    runtime_resolution_field: runtime.selfValidation.runtime_resolution_field,
    legacy_fields_rejected: runtime.selfValidation.legacy_fields_rejected,
    eligibility_schema: runtime.selfValidation.eligibility_schema,
    authoritative_packaging_event_status: 'NOT_CAPTURED',
    real_candidate_version_status: 'NOT_ASSIGNED',
    authoritative_manifest_status: 'NOT_WRITTEN',
    production_contact: 0,
  };
  const result = sealed(body, 'package_v2_runtime_self_validation_sha256');
  fs.mkdirSync(path.dirname(resultPath), { recursive: true });
  fs.writeFileSync(resultPath, canonicalJson(result), { flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ pass: true, artifactCount: result.artifact_count, resultSha256: result.package_v2_runtime_self_validation_sha256 })}\n`);
}

main();
