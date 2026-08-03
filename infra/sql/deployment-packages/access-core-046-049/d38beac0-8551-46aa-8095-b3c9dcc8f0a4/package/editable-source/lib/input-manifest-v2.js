'use strict';

const fs = require('fs');
const path = require('path');
const { canonicalHash, sha256File } = require('./canonical');

const SCHEMA = 'ACCESS_CORE_PACKAGE_INPUT_MANIFEST_V2';
const SCHEMA_VERSION = 2;
const TOP_LEVEL_FIELDS = Object.freeze([
  'artifact_count',
  'input_manifest_sha256',
  'package_id',
  'production_contact',
  'records',
  'runtime_required_count',
  'schema',
  'schema_version',
  'source_authority_count',
]);
const RECORD_FIELDS = Object.freeze([
  'artifact_id',
  'authority_classification',
  'executable',
  'package_path',
  'required_at_runtime',
  'runtime_use',
  'sha256',
  'size',
  'source_path',
]);
const LEGACY_FIELDS = new Set(['path', 'destination']);
const RUNTIME_REQUIREMENT = Object.freeze({
  PACKAGE_EXECUTOR_AUTHORITY: true,
  DEPLOYMENT_PAYLOAD_SOURCE: true,
  REQUIRED_DURING_FINAL_QUIESCED_WINDOW: true,
  STAGE_VERIFICATION: true,
  LOCAL_REHEARSAL_FIXTURE: true,
  PROVENANCE: false,
  EXECUTOR_ELIGIBILITY: false,
  REHEARSAL_PROVENANCE: false,
  EXECUTOR_PROVENANCE: false,
});

class InputManifestV2Error extends Error {
  constructor(code, detail = '') {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.name = 'InputManifestV2Error';
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail = '') {
  throw new InputManifestV2Error(code, detail);
}

function exactFieldSet(value, expected, scope) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${scope}_OBJECT_REQUIRED`);
  const keys = Object.keys(value).sort();
  for (const key of keys) if (LEGACY_FIELDS.has(key)) fail('LEGACY_FIELD_REJECTED', `${scope}.${key}`);
  const expectedSorted = [...expected].sort();
  if (keys.length !== expectedSorted.length || keys.some((key, index) => key !== expectedSorted[index])) {
    const missing = expectedSorted.filter((key) => !keys.includes(key));
    const unknown = keys.filter((key) => !expectedSorted.includes(key));
    fail(`${scope}_FIELD_SET_MISMATCH`, `missing=${missing.join(',') || '-'} unknown=${unknown.join(',') || '-'}`);
  }
}

function isAbsoluteAuthorityPath(value) {
  return path.win32.isAbsolute(value) || path.posix.isAbsolute(value);
}

function validatePackagePath(packageRoot, packagePath) {
  if (typeof packagePath !== 'string' || packagePath.length === 0 || packagePath.includes('\0')) fail('PACKAGE_PATH_INVALID');
  if (packagePath.includes('\\')) fail('PACKAGE_PATH_SEPARATOR_INVALID', packagePath);
  if (path.win32.isAbsolute(packagePath) || path.posix.isAbsolute(packagePath) || packagePath.startsWith('//')) fail('ABSOLUTE_PACKAGE_PATH_REJECTED', packagePath);
  const segments = packagePath.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) fail('PACKAGE_PATH_TRAVERSAL_REJECTED', packagePath);
  if (path.posix.normalize(packagePath) !== packagePath) fail('PACKAGE_PATH_NOT_CANONICAL', packagePath);
  const root = path.resolve(packageRoot);
  const resolved = path.resolve(root, ...segments);
  const relative = path.relative(root, resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail('PACKAGE_PATH_ESCAPE_REJECTED', packagePath);
  return resolved;
}

function recordIdentityFields(record, index) {
  exactFieldSet(record, RECORD_FIELDS, 'RECORD');
  if (typeof record.artifact_id !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,127}$/.test(record.artifact_id)) fail('ARTIFACT_ID_INVALID', String(index));
  if (typeof record.source_path !== 'string' || !isAbsoluteAuthorityPath(record.source_path)) fail('SOURCE_PATH_NOT_ABSOLUTE', record.artifact_id);
  if (!Number.isSafeInteger(record.size) || record.size < 0) fail('SIZE_INVALID', record.artifact_id);
  if (typeof record.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(record.sha256)) fail('SHA256_INVALID', record.artifact_id);
  if (typeof record.authority_classification !== 'string' || record.authority_classification.length === 0) fail('AUTHORITY_CLASSIFICATION_INVALID', record.artifact_id);
  if (!Object.prototype.hasOwnProperty.call(RUNTIME_REQUIREMENT, record.runtime_use)) fail('RUNTIME_USE_UNKNOWN', record.artifact_id);
  if (typeof record.executable !== 'boolean' || typeof record.required_at_runtime !== 'boolean') fail('RECORD_BOOLEAN_INVALID', record.artifact_id);
  if (record.required_at_runtime !== RUNTIME_REQUIREMENT[record.runtime_use]) {
    if (record.required_at_runtime) fail('NON_RUNTIME_ARTIFACT_MARKED_REQUIRED', record.artifact_id);
    fail('RUNTIME_ARTIFACT_NOT_MARKED_REQUIRED', record.artifact_id);
  }
}

function deeplyFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deeplyFreeze(child);
  }
  return value;
}

function validateInputManifest(manifest, options = {}) {
  const packageRoot = path.resolve(options.packageRoot || '.');
  const consumerSchemaVersion = options.consumerSchemaVersion ?? SCHEMA_VERSION;
  const verifyFiles = options.verifyFiles !== false;
  if (consumerSchemaVersion !== SCHEMA_VERSION) fail('BUILDER_RUNTIME_SCHEMA_DISAGREEMENT', `${consumerSchemaVersion} != ${SCHEMA_VERSION}`);
  exactFieldSet(manifest, TOP_LEVEL_FIELDS, 'MANIFEST');
  if (manifest.schema !== SCHEMA || manifest.schema_version !== SCHEMA_VERSION) fail('SCHEMA_VERSION_MISMATCH');
  if (typeof manifest.package_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(manifest.package_id)) fail('PACKAGE_ID_INVALID');
  if (!Array.isArray(manifest.records) || manifest.records.length === 0) fail('RECORDS_REQUIRED');
  if (manifest.production_contact !== 0) fail('PRODUCTION_CONTACT_POLICY_MISMATCH');

  const body = { ...manifest };
  const observedIdentity = body.input_manifest_sha256;
  delete body.input_manifest_sha256;
  if (!/^[0-9a-f]{64}$/.test(observedIdentity || '') || canonicalHash(body) !== observedIdentity) fail('INPUT_MANIFEST_IDENTITY_MISMATCH');

  const artifactIds = new Set();
  const packagePaths = new Set();
  const resolvedRecords = [];
  for (let index = 0; index < manifest.records.length; index += 1) {
    const record = manifest.records[index];
    recordIdentityFields(record, index);
    if (artifactIds.has(record.artifact_id)) fail('DUPLICATE_ARTIFACT_ID', record.artifact_id);
    artifactIds.add(record.artifact_id);
    if (packagePaths.has(record.package_path)) fail('DUPLICATE_PACKAGE_PATH', record.package_path);
    packagePaths.add(record.package_path);
    const resolved = validatePackagePath(packageRoot, record.package_path);
    if (verifyFiles) {
      if (!fs.existsSync(resolved)) fail(record.required_at_runtime ? 'MISSING_RUNTIME_ARTIFACT' : 'MISSING_PACKAGE_ARTIFACT', record.package_path);
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) fail('PACKAGE_ARTIFACT_NOT_FILE', record.package_path);
      if (stat.size !== record.size) fail('PACKAGE_ARTIFACT_SIZE_MISMATCH', record.package_path);
      const handle = fs.openSync(resolved, 'r');
      fs.closeSync(handle);
      if (sha256File(resolved) !== record.sha256) fail('PACKAGE_ARTIFACT_HASH_MISMATCH', record.package_path);
    }
    resolvedRecords.push({ record, resolved_path: resolved });
  }
  const runtimeRequiredCount = manifest.records.filter((record) => record.required_at_runtime).length;
  const sourceAuthorityCount = new Set(manifest.records.map((record) => record.source_path)).size;
  if (manifest.artifact_count !== manifest.records.length) fail('ARTIFACT_COUNT_MISMATCH');
  if (manifest.runtime_required_count !== runtimeRequiredCount) fail('RUNTIME_REQUIRED_COUNT_MISMATCH');
  if (manifest.source_authority_count !== sourceAuthorityCount) fail('SOURCE_AUTHORITY_COUNT_MISMATCH');
  return deeplyFreeze({ manifest, resolved_records: resolvedRecords, artifact_count: manifest.records.length, runtime_required_count: runtimeRequiredCount, read_mode: 'READ_ONLY_PACKAGE_PATH_ONLY' });
}

function loadAndValidateInputManifest(file, options = {}) {
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { fail('INPUT_MANIFEST_PARSE_FAILED', error.message); }
  return validateInputManifest(manifest, options);
}

function sealInputManifest(body) {
  return { ...body, input_manifest_sha256: canonicalHash(body) };
}

module.exports = {
  SCHEMA,
  SCHEMA_VERSION,
  TOP_LEVEL_FIELDS,
  RECORD_FIELDS,
  RUNTIME_REQUIREMENT,
  InputManifestV2Error,
  validatePackagePath,
  validateInputManifest,
  loadAndValidateInputManifest,
  sealInputManifest,
};
