'use strict';

const fs = require('fs');
const path = require('path');
const { SUITES, SuiteResultError, canonicalHash, parseStrictJson, sha256File, validateSuiteResultFile } = require('./suite-result');

class FinalizerError extends Error {
  constructor(code, detail = '') { super(`${code}${detail ? `: ${detail}` : ''}`); this.name = 'FinalizerError'; this.code = code; }
}
function strictRead(target, code = 'FINALIZER_INPUT_INVALID') {
  if (typeof target !== 'string' || !path.isAbsolute(target)) throw new FinalizerError(`${code}_PATH_NOT_ABSOLUTE`);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) throw new FinalizerError(`${code}_NOT_FILE`, target);
  try { return parseStrictJson(fs.readFileSync(target, 'utf8')); }
  catch (error) { throw new FinalizerError(code, `${error.code || error.name}: ${error.message}`); }
}
function assert(condition, code, detail = '') { if (!condition) throw new FinalizerError(code, detail); }

function validateWrapper(wrapper, expected) {
  assert(wrapper && !Array.isArray(wrapper) && typeof wrapper === 'object', 'WRAPPER_EVIDENCE_OBJECT_REQUIRED');
  assert(wrapper.schema === 'EXECUTOR_SUITE_WRAPPER_EVIDENCE_V1', 'WRAPPER_EVIDENCE_SCHEMA_UNKNOWN');
  assert(wrapper.suite_id === expected.suite_id, 'WRAPPER_EVIDENCE_WRONG_SUITE');
  assert(wrapper.final_run_id === expected.final_run_id, 'WRAPPER_EVIDENCE_WRONG_RUN');
  assert(wrapper.frozen_release_identity === expected.frozen_release_identity, 'WRAPPER_EVIDENCE_WRONG_RELEASE');
  assert(wrapper.execution_attempt === expected.execution_attempt, 'WRAPPER_EVIDENCE_WRONG_ATTEMPT');
  assert(wrapper.start_sequence === expected.start_sequence && wrapper.end_sequence === expected.end_sequence, 'WRAPPER_EVIDENCE_WRONG_SEQUENCE');
  assert(wrapper.result_path_absent_before_start === true, 'WRAPPER_EVIDENCE_STALE_RESULT');
  assert(wrapper.result_file_exists === true, 'WRAPPER_EVIDENCE_RESULT_MISSING');
  assert(wrapper.result_file_read_only === true, 'WRAPPER_EVIDENCE_RESULT_NOT_READ_ONLY');
  assert(wrapper.protocol_validation_exit_code === 0, 'WRAPPER_EVIDENCE_PROTOCOL_VALIDATION_FAILED');
  assert(wrapper.timed_out === false && wrapper.cancelled === false, 'WRAPPER_EVIDENCE_TIMEOUT_OR_CANCEL');
  assert(wrapper.pass_synthesized === false, 'WRAPPER_EVIDENCE_SYNTHETIC_PASS');
  assert(Number.isInteger(wrapper.process_id) && wrapper.process_id > 0, 'WRAPPER_EVIDENCE_PROCESS_ID_INVALID');
  assert(Number.isFinite(Date.parse(wrapper.process_start_time_utc)) && Number.isFinite(Date.parse(wrapper.process_end_time_utc)), 'WRAPPER_EVIDENCE_TIME_INVALID');
  assert(Date.parse(wrapper.process_end_time_utc) >= Date.parse(wrapper.process_start_time_utc), 'WRAPPER_EVIDENCE_TIME_ORDER_INVALID');
  return wrapper;
}

function validateResultSet(resultPaths, wrapperManifestPath, expected) {
  assert(Array.isArray(resultPaths), 'FINALIZER_EXPLICIT_RESULT_LIST_REQUIRED');
  assert(resultPaths.length === SUITES.length, 'FINALIZER_RESULT_CARDINALITY_INVALID', String(resultPaths.length));
  assert(new Set(resultPaths.map((target) => String(target).toLowerCase())).size === SUITES.length, 'FINALIZER_DUPLICATE_RESULT_PATH');
  const wrapperManifest = strictRead(wrapperManifestPath, 'WRAPPER_MANIFEST_INVALID');
  assert(wrapperManifest && !Array.isArray(wrapperManifest) && wrapperManifest.schema === 'EXECUTOR_SUITE_WRAPPER_EVIDENCE_MANIFEST_V1', 'WRAPPER_MANIFEST_SCHEMA_UNKNOWN');
  assert(wrapperManifest.final_run_id === expected.final_run_id, 'WRAPPER_MANIFEST_WRONG_RUN');
  assert(wrapperManifest.frozen_release_identity === expected.frozen_release_identity, 'WRAPPER_MANIFEST_WRONG_RELEASE');
  assert(wrapperManifest.execution_attempt === expected.execution_attempt, 'WRAPPER_MANIFEST_WRONG_ATTEMPT');
  assert(Array.isArray(wrapperManifest.wrapper_evidence_paths) && wrapperManifest.wrapper_evidence_paths.length === SUITES.length, 'WRAPPER_MANIFEST_CARDINALITY_INVALID');
  assert(Array.isArray(wrapperManifest.wrapper_evidence_hashes) && wrapperManifest.wrapper_evidence_hashes.length === SUITES.length, 'WRAPPER_MANIFEST_HASH_CARDINALITY_INVALID');
  const results = []; const wrappers = [];
  let previousEnd = -1;
  for (let index = 0; index < SUITES.length; index += 1) {
    const suiteId = SUITES[index]; const resultPath = resultPaths[index];
    if (typeof resultPath !== 'string' || !path.isAbsolute(resultPath)) throw new FinalizerError('FINALIZER_RESULT_PATH_NOT_ABSOLUTE', String(resultPath));
    if (!fs.existsSync(resultPath) || !fs.statSync(resultPath).isFile()) throw new FinalizerError('FINALIZER_RESULT_NOT_FILE', resultPath);
    const wrapperPath = wrapperManifest.wrapper_evidence_paths[index];
    assert(typeof wrapperPath === 'string' && path.isAbsolute(wrapperPath) && fs.existsSync(wrapperPath) && fs.statSync(wrapperPath).isFile(), 'WRAPPER_EVIDENCE_NOT_FILE');
    assert(sha256File(wrapperPath) === wrapperManifest.wrapper_evidence_hashes[index], 'WRAPPER_EVIDENCE_HASH_MISMATCH', wrapperPath);
    const wrapper = validateWrapper(strictRead(wrapperPath, 'WRAPPER_EVIDENCE_INVALID'), {
      suite_id: suiteId, final_run_id: expected.final_run_id, frozen_release_identity: expected.frozen_release_identity,
      execution_attempt: expected.execution_attempt, start_sequence: expected.start_sequences[index], end_sequence: expected.end_sequences[index],
    });
    assert(path.resolve(wrapper.expected_result_file_path).toLowerCase() === path.resolve(resultPath).toLowerCase(), 'WRAPPER_RESULT_PATH_MISMATCH');
    let validated;
    try {
      validated = validateSuiteResultFile(resultPath, {
        suite_id: suiteId, final_run_id: expected.final_run_id, frozen_release_identity: expected.frozen_release_identity,
        execution_attempt: expected.execution_attempt, start_sequence: expected.start_sequences[index], end_sequence: expected.end_sequences[index],
        process_exit_code: wrapper.process_exit_code, process_start_time: wrapper.process_start_time_utc,
        result_file_sha256: wrapper.result_file_sha256, result_file_size: wrapper.result_file_size,
        result_file_last_write_time_utc: wrapper.result_file_last_write_time_utc,
        result_path_absent_before_start: wrapper.result_path_absent_before_start,
      });
    } catch (error) {
      if (error instanceof SuiteResultError) throw new FinalizerError(error.code, error.message);
      throw error;
    }
    const result = validated.result;
    assert(result.status === 'PASS' && result.exit_code === 0, 'FINALIZER_SUITE_NOT_PASS', suiteId);
    assert(result.start_sequence > previousEnd, 'FINALIZER_SUITE_ORDER_INVALID', suiteId);
    assert(result.raw_stdout_path === wrapper.raw_stdout_path && result.raw_stdout_sha256 === wrapper.raw_stdout_sha256, 'FINALIZER_STDOUT_IDENTITY_MISMATCH', suiteId);
    assert(result.raw_stderr_path === wrapper.raw_stderr_path && result.raw_stderr_sha256 === wrapper.raw_stderr_sha256, 'FINALIZER_STDERR_IDENTITY_MISMATCH', suiteId);
    previousEnd = result.end_sequence; results.push(result); wrappers.push(wrapper);
  }
  assert(new Set(results.map((row) => row.suite_id)).size === SUITES.length, 'FINALIZER_DUPLICATE_SUITE_RESULT');
  assert(SUITES.every((suite) => results.some((row) => row.suite_id === suite)), 'FINALIZER_MISSING_SUITE_RESULT');
  return { results, wrappers, wrapperManifest };
}

function verifyRelease(releaseRoot, manifest) {
  const body = { schema: manifest.schema, executorVersion: manifest.executorVersion, runtimeIdentity: manifest.runtimeIdentity, entries: manifest.entries };
  assert(manifest.schema === 'tairet-statement-aware-atomic-executor-release-v2', 'FINALIZER_RELEASE_SCHEMA_INVALID');
  assert(manifest.releaseSha256 === canonicalHash(body), 'FINALIZER_RELEASE_IDENTITY_MISMATCH');
  const seen = new Set();
  for (const entry of manifest.entries) {
    assert(!seen.has(entry.path), 'FINALIZER_RELEASE_DUPLICATE_ENTRY', entry.path); seen.add(entry.path);
    const target = path.resolve(releaseRoot, entry.path);
    assert(target.toLowerCase().startsWith(`${path.resolve(releaseRoot).toLowerCase()}${path.sep}`), 'FINALIZER_RELEASE_PATH_ESCAPE', entry.path);
    assert(fs.existsSync(target) && fs.statSync(target).isFile(), 'FINALIZER_RELEASE_FILE_MISSING', entry.path);
    assert(fs.statSync(target).size === entry.size && sha256File(target) === entry.sha256, 'FINALIZER_RELEASE_FILE_MISMATCH', entry.path);
  }
  for (const binding of Object.values(manifest.generatedArtifactBindings || {})) {
    const target = path.join(releaseRoot, ...binding.path.split('/'));
    assert(fs.existsSync(target) && sha256File(target) === binding.sha256, 'FINALIZER_GENERATED_ARTIFACT_MISMATCH', binding.path);
  }
}

module.exports = { FinalizerError, strictRead, validateResultSet, verifyRelease };
