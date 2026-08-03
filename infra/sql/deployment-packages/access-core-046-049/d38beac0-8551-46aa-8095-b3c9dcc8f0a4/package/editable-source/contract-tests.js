'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { canonicalJson, sealed, sha256File } = require('./lib/canonical');
const {
  validateInputManifest,
  loadAndValidateInputManifest,
  sealInputManifest,
} = require('./lib/input-manifest-v2');
const { PACKAGE_ID } = require('./lib/definitions');

const packageRoot = path.resolve(__dirname, '..');
const inputPath = path.join(packageRoot, 'manifests', 'package-input-manifest-v2.json');
const resultPath = path.join(packageRoot, 'development-evidence', 'contract-tests', 'input-manifest-v2-test-result.json');

function clone(value) { return structuredClone(value); }
function reseal(manifest) {
  const body = clone(manifest);
  delete body.input_manifest_sha256;
  return sealInputManifest(body);
}
function mutated(original, change) {
  const body = clone(original);
  delete body.input_manifest_sha256;
  change(body);
  return sealInputManifest(body);
}
function expectedFailure(id, expectedCode, call) {
  try {
    call();
    assert.fail(`Expected ${expectedCode}`);
  } catch (error) {
    assert.equal(error.code, expectedCode, `${id}: ${error.stack || error.message}`);
    return { id, pass: true, expected_code: expectedCode, observed_code: error.code, production_parser_reached: true };
  }
}

function main() {
  if (fs.existsSync(resultPath)) throw new Error('CONTRACT_TEST_RESULT_ALREADY_EXISTS');
  const original = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const positive = loadAndValidateInputManifest(inputPath, { packageRoot, consumerSchemaVersion: 2, verifyFiles: true });
  assert.equal(positive.artifact_count, 153);
  assert.equal(positive.manifest.package_id, PACKAGE_ID);
  assert.equal(positive.read_mode, 'READ_ONLY_PACKAGE_PATH_ONLY');
  assert(Object.isFrozen(positive));
  assert(Object.isFrozen(positive.manifest.records));
  assert(positive.manifest.records.every((record) => !path.win32.isAbsolute(record.package_path) && !path.posix.isAbsolute(record.package_path)));
  assert(positive.manifest.records.every((record) => !record.package_path.includes('..') && !record.package_path.includes('\\')));
  assert(positive.manifest.records.every((record) => !Object.prototype.hasOwnProperty.call(record, 'path') && !Object.prototype.hasOwnProperty.call(record, 'destination')));
  assert(positive.resolved_records.every((row) => sha256File(row.resolved_path) === row.record.sha256));
  const rows = [{ id: 'POS-01', description: 'all approved 153 artifacts resolve relatively and byte-exactly through package_path using read-only handles', pass: true, artifact_count: positive.artifact_count, runtime_required_count: positive.runtime_required_count, read_mode: positive.read_mode, production_parser_reached: true }];

  rows.push(expectedFailure('NEG-01', 'LEGACY_FIELD_REJECTED', () => validateInputManifest(mutated(original, (manifest) => { manifest.records[0].path = manifest.records[0].package_path; }), { packageRoot })));
  rows.push(expectedFailure('NEG-02', 'LEGACY_FIELD_REJECTED', () => validateInputManifest(mutated(original, (manifest) => { manifest.records[0].destination = manifest.records[0].package_path; }), { packageRoot })));
  rows.push(expectedFailure('NEG-03', 'RECORD_FIELD_SET_MISMATCH', () => validateInputManifest(mutated(original, (manifest) => { delete manifest.records[0].package_path; }), { packageRoot })));
  rows.push(expectedFailure('NEG-04', 'ABSOLUTE_PACKAGE_PATH_REJECTED', () => validateInputManifest(mutated(original, (manifest) => { manifest.records[0].package_path = 'C:/absolute/not-allowed.sql'; }), { packageRoot })));
  rows.push(expectedFailure('NEG-05', 'PACKAGE_PATH_TRAVERSAL_REJECTED', () => validateInputManifest(mutated(original, (manifest) => { manifest.records[0].package_path = 'canonical-migrations/../escape.sql'; }), { packageRoot })));
  rows.push(expectedFailure('NEG-06', 'PACKAGE_PATH_TRAVERSAL_REJECTED', () => validateInputManifest(mutated(original, (manifest) => { manifest.records[0].package_path = `../${path.basename(packageRoot)}-sibling/escape.sql`; }), { packageRoot })));
  rows.push(expectedFailure('NEG-07', 'DUPLICATE_ARTIFACT_ID', () => validateInputManifest(mutated(original, (manifest) => { manifest.records[1].artifact_id = manifest.records[0].artifact_id; }), { packageRoot })));
  rows.push(expectedFailure('NEG-08', 'DUPLICATE_PACKAGE_PATH', () => validateInputManifest(mutated(original, (manifest) => { manifest.records[1].package_path = manifest.records[0].package_path; }), { packageRoot })));
  rows.push(expectedFailure('NEG-09', 'PACKAGE_ARTIFACT_HASH_MISMATCH', () => validateInputManifest(mutated(original, (manifest) => { manifest.records[0].sha256 = '0'.repeat(64); }), { packageRoot })));
  rows.push(expectedFailure('NEG-10', 'PACKAGE_ARTIFACT_SIZE_MISMATCH', () => validateInputManifest(mutated(original, (manifest) => { manifest.records[0].size += 1; }), { packageRoot })));
  rows.push(expectedFailure('NEG-11', 'MISSING_RUNTIME_ARTIFACT', () => validateInputManifest(mutated(original, (manifest) => { const row = manifest.records.find((record) => record.required_at_runtime); row.package_path = 'canonical-migrations/definitely-missing-runtime-artifact.sql'; }), { packageRoot })));
  rows.push(expectedFailure('NEG-12', 'NON_RUNTIME_ARTIFACT_MARKED_REQUIRED', () => validateInputManifest(mutated(original, (manifest) => { const row = manifest.records.find((record) => !record.required_at_runtime); row.required_at_runtime = true; }), { packageRoot, verifyFiles: false })));
  rows.push(expectedFailure('NEG-13', 'SCHEMA_VERSION_MISMATCH', () => validateInputManifest(mutated(original, (manifest) => { manifest.schema_version = 3; }), { packageRoot, verifyFiles: false })));
  rows.push(expectedFailure('NEG-14', 'BUILDER_RUNTIME_SCHEMA_DISAGREEMENT', () => validateInputManifest(reseal(original), { packageRoot, consumerSchemaVersion: 3, verifyFiles: false })));

  const body = {
    schema: 'ACCESS_CORE_PACKAGE_INPUT_MANIFEST_V2_TEST_MATRIX_RESULT',
    package_id: PACKAGE_ID,
    production_parser: 'editable-source/lib/input-manifest-v2.js',
    schema_file: 'package-contracts/input-manifest-v2.schema.json',
    positive_test_count: 1,
    negative_test_count: 14,
    test_count: rows.length,
    pass_count: rows.filter((row) => row.pass).length,
    fail_count: rows.filter((row) => !row.pass).length,
    approved_artifact_count: positive.artifact_count,
    all_negative_tests_reached_actual_parser: rows.filter((row) => row.id.startsWith('NEG-')).every((row) => row.production_parser_reached),
    runtime_resolution_field: 'package_path',
    legacy_fields_rejected: ['path', 'destination'],
    rows,
    production_contact: 0,
  };
  assert.equal(body.test_count, 15);
  assert.equal(body.pass_count, 15);
  const result = sealed(body, 'package_v2_input_manifest_test_matrix_sha256');
  fs.mkdirSync(path.dirname(resultPath), { recursive: true });
  fs.writeFileSync(resultPath, canonicalJson(result), { flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ testCount: result.test_count, passCount: result.pass_count, resultSha256: result.package_v2_input_manifest_test_matrix_sha256 })}\n`);
}

main();
