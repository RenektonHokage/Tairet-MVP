'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA = 'EXECUTOR_SUITE_RESULT_V1';
const SUITES = Object.freeze(['STATIC', 'PARSER', 'RECOVERY', 'ATOMICITY', 'SEMANTIC_MUTATION', 'CLEANUP']);
const STATUSES = Object.freeze(['PASS', 'FAIL', 'UNRESOLVED']);
const REQUIRED_FIELDS = Object.freeze([
  'schema', 'suite_id', 'suite_version', 'final_run_id', 'frozen_release_identity',
  'execution_attempt', 'start_sequence', 'end_sequence', 'status', 'exit_code',
  'test_count', 'pass_count', 'fail_count', 'skipped_count', 'raw_stdout_path',
  'raw_stdout_sha256', 'raw_stderr_path', 'raw_stderr_sha256', 'suite_evidence_paths',
  'suite_evidence_hashes', 'result_created_at', 'result_sha256',
]);

class SuiteResultError extends Error {
  constructor(code, detail = '') {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.name = 'SuiteResultError';
    this.code = code;
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}
function canonicalJson(value) { return `${JSON.stringify(stable(value), null, 2)}\n`; }
function sha256Bytes(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function sha256File(target) { return sha256Bytes(fs.readFileSync(target)); }
function canonicalHash(value) { return sha256Bytes(Buffer.from(canonicalJson(value), 'utf8')); }

function parseStrictJson(text) {
  if (typeof text !== 'string') throw new SuiteResultError('JSON_INPUT_NOT_TEXT');
  let cursor = 0;
  const whitespace = () => { while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1; };
  const fail = (code) => { throw new SuiteResultError(code, `offset=${cursor}`); };
  const parseString = () => {
    if (text[cursor] !== '"') fail('JSON_STRING_EXPECTED');
    const start = cursor;
    cursor += 1;
    let escaped = false;
    while (cursor < text.length) {
      const character = text[cursor];
      cursor += 1;
      if (escaped) { escaped = false; continue; }
      if (character === '\\') { escaped = true; continue; }
      if (character === '"') {
        try { return JSON.parse(text.slice(start, cursor)); }
        catch { fail('JSON_STRING_INVALID'); }
      }
      if (character.charCodeAt(0) < 0x20) fail('JSON_STRING_CONTROL_CHARACTER');
    }
    fail('JSON_STRING_UNTERMINATED');
  };
  const parseNumber = () => {
    const match = text.slice(cursor).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!match) fail('JSON_NUMBER_INVALID');
    cursor += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) fail('JSON_NUMBER_NONFINITE');
    return value;
  };
  const parseValue = () => {
    whitespace();
    if (cursor >= text.length) fail('JSON_VALUE_MISSING');
    if (text[cursor] === '"') return parseString();
    if (text[cursor] === '{') {
      cursor += 1;
      whitespace();
      const value = {};
      const keys = new Set();
      if (text[cursor] === '}') { cursor += 1; return value; }
      while (cursor < text.length) {
        whitespace();
        const key = parseString();
        if (keys.has(key)) throw new SuiteResultError('JSON_DUPLICATE_KEY', key);
        keys.add(key);
        whitespace();
        if (text[cursor] !== ':') fail('JSON_COLON_EXPECTED');
        cursor += 1;
        value[key] = parseValue();
        whitespace();
        if (text[cursor] === '}') { cursor += 1; return value; }
        if (text[cursor] !== ',') fail('JSON_OBJECT_SEPARATOR_EXPECTED');
        cursor += 1;
      }
      fail('JSON_OBJECT_UNTERMINATED');
    }
    if (text[cursor] === '[') {
      cursor += 1;
      whitespace();
      const value = [];
      if (text[cursor] === ']') { cursor += 1; return value; }
      while (cursor < text.length) {
        value.push(parseValue());
        whitespace();
        if (text[cursor] === ']') { cursor += 1; return value; }
        if (text[cursor] !== ',') fail('JSON_ARRAY_SEPARATOR_EXPECTED');
        cursor += 1;
      }
      fail('JSON_ARRAY_UNTERMINATED');
    }
    for (const [token, value] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(token, cursor)) { cursor += token.length; return value; }
    }
    if (text[cursor] === '-' || /\d/.test(text[cursor])) return parseNumber();
    fail('JSON_TOKEN_INVALID');
  };
  const result = parseValue();
  whitespace();
  if (cursor !== text.length) fail('JSON_TRAILING_VALUE');
  return result;
}

function resultBody(result) {
  const body = { ...result };
  delete body.result_sha256;
  return body;
}
function assertAbsoluteFile(target, code) {
  if (typeof target !== 'string' || !path.isAbsolute(target)) throw new SuiteResultError(code, String(target));
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new SuiteResultError(code, target);
}
function assertResultPathBinding(resultPath, suiteId, finalRunId) {
  if (!path.isAbsolute(resultPath)) throw new SuiteResultError('RESULT_PATH_NOT_ABSOLUTE', resultPath);
  if (path.basename(path.dirname(resultPath)) !== finalRunId || path.basename(resultPath) !== `${suiteId}.result.json`) {
    throw new SuiteResultError('RESULT_PATH_BINDING_MISMATCH', resultPath);
  }
}
function assertResultPathAbsent(resultPath, suiteId, finalRunId) {
  assertResultPathBinding(resultPath, suiteId, finalRunId);
  if (fs.existsSync(resultPath)) throw new SuiteResultError('RESULT_PATH_PREEXISTING', resultPath);
}

function validateShape(result) {
  if (Array.isArray(result)) throw new SuiteResultError('RESULT_ARRAY_REJECTED');
  if (!result || typeof result !== 'object') throw new SuiteResultError('RESULT_OBJECT_REQUIRED');
  for (const field of REQUIRED_FIELDS) if (!Object.prototype.hasOwnProperty.call(result, field)) throw new SuiteResultError('RESULT_FIELD_MISSING', field);
  if (result.schema !== SCHEMA) throw new SuiteResultError('RESULT_SCHEMA_UNKNOWN', String(result.schema));
  if (!SUITES.includes(result.suite_id)) throw new SuiteResultError('RESULT_SUITE_UNKNOWN', String(result.suite_id));
  if (typeof result.suite_version !== 'string' || result.suite_version.length === 0) throw new SuiteResultError('RESULT_SUITE_VERSION_INVALID');
  if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(result.final_run_id)) throw new SuiteResultError('RESULT_RUN_ID_INVALID');
  if (!/^[0-9a-f]{64}$/.test(result.frozen_release_identity)) throw new SuiteResultError('RESULT_RELEASE_IDENTITY_INVALID');
  for (const field of ['execution_attempt', 'start_sequence', 'end_sequence', 'exit_code', 'test_count', 'pass_count', 'fail_count', 'skipped_count']) {
    if (!Number.isInteger(result[field]) || result[field] < 0) throw new SuiteResultError('RESULT_INTEGER_FIELD_INVALID', field);
  }
  if (result.execution_attempt < 1) throw new SuiteResultError('RESULT_ATTEMPT_INVALID');
  if (result.start_sequence >= result.end_sequence) throw new SuiteResultError('RESULT_SEQUENCE_INVALID');
  if (!STATUSES.includes(result.status)) throw new SuiteResultError('RESULT_STATUS_UNKNOWN', String(result.status));
  if (result.pass_count + result.fail_count + result.skipped_count !== result.test_count) throw new SuiteResultError('RESULT_COUNT_CONTRADICTION');
  if (result.status === 'PASS' && (result.exit_code !== 0 || result.fail_count !== 0)) throw new SuiteResultError('RESULT_PASS_EXIT_CONTRADICTION');
  if (result.status === 'FAIL' && (result.exit_code === 0 || result.fail_count === 0)) throw new SuiteResultError('RESULT_FAIL_EXIT_CONTRADICTION');
  if (result.status === 'UNRESOLVED' && result.exit_code === 0) throw new SuiteResultError('RESULT_UNRESOLVED_EXIT_CONTRADICTION');
  if (!Array.isArray(result.suite_evidence_paths) || !Array.isArray(result.suite_evidence_hashes) || result.suite_evidence_paths.length !== result.suite_evidence_hashes.length) throw new SuiteResultError('RESULT_EVIDENCE_CARDINALITY_INVALID');
  if (new Set(result.suite_evidence_paths.map((row) => String(row).toLowerCase())).size !== result.suite_evidence_paths.length) throw new SuiteResultError('RESULT_EVIDENCE_DUPLICATE');
  if (!Number.isFinite(Date.parse(result.result_created_at))) throw new SuiteResultError('RESULT_CREATED_AT_INVALID');
  if (!/^[0-9a-f]{64}$/.test(result.result_sha256)) throw new SuiteResultError('RESULT_SHA256_INVALID');
  return result;
}

function validateSuiteResultFile(resultPath, expected = {}) {
  if (typeof resultPath !== 'string' || !path.isAbsolute(resultPath)) throw new SuiteResultError('RESULT_FILE_PATH_NOT_ABSOLUTE');
  if (!fs.existsSync(resultPath)) throw new SuiteResultError('RESULT_FILE_MISSING', resultPath);
  if (!fs.statSync(resultPath).isFile()) throw new SuiteResultError('RESULT_FILE_NOT_REGULAR', resultPath);
  const result = validateShape(parseStrictJson(fs.readFileSync(resultPath, 'utf8')));
  assertResultPathBinding(resultPath, result.suite_id, result.final_run_id);
  const bindings = [
    ['suite_id', 'RESULT_WRONG_SUITE'], ['final_run_id', 'RESULT_WRONG_RUN'],
    ['frozen_release_identity', 'RESULT_WRONG_RELEASE'], ['execution_attempt', 'RESULT_WRONG_ATTEMPT'],
  ];
  for (const [field, code] of bindings) if (expected[field] !== undefined && result[field] !== expected[field]) throw new SuiteResultError(code);
  if (expected.start_sequence !== undefined && result.start_sequence !== expected.start_sequence) throw new SuiteResultError('RESULT_WRONG_START_SEQUENCE');
  if (expected.end_sequence !== undefined && result.end_sequence !== expected.end_sequence) throw new SuiteResultError('RESULT_WRONG_END_SEQUENCE');
  if (expected.process_exit_code !== undefined && result.exit_code !== expected.process_exit_code) throw new SuiteResultError('RESULT_WRAPPER_EXIT_CONTRADICTION');
  if (expected.process_start_time && Date.parse(result.result_created_at) < Date.parse(expected.process_start_time)) throw new SuiteResultError('RESULT_CREATED_BEFORE_SUITE_START');
  const actualResultHash = canonicalHash(resultBody(result));
  if (actualResultHash !== result.result_sha256) throw new SuiteResultError('RESULT_SELF_HASH_MISMATCH');
  const fileHash = sha256File(resultPath);
  if (expected.result_file_sha256 && fileHash !== expected.result_file_sha256) throw new SuiteResultError('RESULT_POST_SEAL_MODIFICATION');
  if (expected.result_file_size !== undefined && fs.statSync(resultPath).size !== expected.result_file_size) throw new SuiteResultError('RESULT_POST_SEAL_SIZE_CHANGE');
  if (expected.result_file_last_write_time_utc && Math.abs(fs.statSync(resultPath).mtimeMs - Date.parse(expected.result_file_last_write_time_utc)) > 1) throw new SuiteResultError('RESULT_POST_SEAL_TIMESTAMP_CHANGE');
  if (expected.result_path_absent_before_start === false) throw new SuiteResultError('RESULT_STALE_PREEXISTING');
  assertAbsoluteFile(result.raw_stdout_path, 'RESULT_STDOUT_FILE_MISSING');
  assertAbsoluteFile(result.raw_stderr_path, 'RESULT_STDERR_FILE_MISSING');
  if (sha256File(result.raw_stdout_path) !== result.raw_stdout_sha256) throw new SuiteResultError('RESULT_STDOUT_HASH_MISMATCH');
  if (sha256File(result.raw_stderr_path) !== result.raw_stderr_sha256) throw new SuiteResultError('RESULT_STDERR_HASH_MISMATCH');
  for (let index = 0; index < result.suite_evidence_paths.length; index += 1) {
    const evidencePath = result.suite_evidence_paths[index];
    assertAbsoluteFile(evidencePath, 'RESULT_EVIDENCE_FILE_MISSING');
    if (!/^[0-9a-f]{64}$/.test(result.suite_evidence_hashes[index]) || sha256File(evidencePath) !== result.suite_evidence_hashes[index]) throw new SuiteResultError('RESULT_EVIDENCE_HASH_MISMATCH', evidencePath);
  }
  if (expected.require_read_only !== false && (fs.statSync(resultPath).mode & 0o222) !== 0) throw new SuiteResultError('RESULT_FILE_NOT_READ_ONLY');
  return { result, result_file_sha256: fileHash, result_file_size: fs.statSync(resultPath).size };
}

function writeSuiteResultAtomic(resultPath, body) {
  assertResultPathAbsent(resultPath, body.suite_id, body.final_run_id);
  for (const rawPath of [body.raw_stdout_path, body.raw_stderr_path]) assertAbsoluteFile(rawPath, 'RESULT_RAW_LOG_NOT_SEALED');
  const evidenceHashes = body.suite_evidence_paths.map((target) => { assertAbsoluteFile(target, 'RESULT_EVIDENCE_FILE_MISSING'); return sha256File(target); });
  const result = validateShape({
    ...body,
    schema: SCHEMA,
    raw_stdout_sha256: sha256File(body.raw_stdout_path),
    raw_stderr_sha256: sha256File(body.raw_stderr_path),
    suite_evidence_hashes: evidenceHashes,
    result_sha256: '0'.repeat(64),
  });
  result.result_sha256 = canonicalHash(resultBody(result));
  const temporaryPath = path.join(path.dirname(resultPath), `.${path.basename(resultPath)}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`);
  fs.mkdirSync(path.dirname(resultPath), { recursive: true });
  let descriptor;
  try {
    descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, canonicalJson(result), 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor); descriptor = undefined;
    fs.renameSync(temporaryPath, resultPath);
    fs.chmodSync(resultPath, 0o444);
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
    throw error;
  }
  return validateSuiteResultFile(resultPath, { suite_id: body.suite_id, final_run_id: body.final_run_id, frozen_release_identity: body.frozen_release_identity, execution_attempt: body.execution_attempt });
}

module.exports = {
  SCHEMA, SUITES, STATUSES, REQUIRED_FIELDS, SuiteResultError, stable, canonicalJson,
  canonicalHash, sha256Bytes, sha256File, parseStrictJson, resultBody,
  assertResultPathAbsent, validateShape, validateSuiteResultFile, writeSuiteResultAtomic,
};
