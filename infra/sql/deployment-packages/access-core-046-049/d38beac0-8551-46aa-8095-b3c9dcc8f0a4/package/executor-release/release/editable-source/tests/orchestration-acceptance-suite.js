'use strict';

const fs = require('fs');
const path = require('path');
const {
  SUITES, canonicalHash, canonicalJson, resultBody, sha256File,
  validateSuiteResultFile, writeSuiteResultAtomic,
} = require('../src/result/suite-result');
const { validateResultSet } = require('../src/result/finalizer');

function parseArgs(argv) { const out = {}; for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, '')] = argv[i + 1]; return out; }
const options = parseArgs(process.argv.slice(2));
const temporaryRoot = path.resolve(options['temporary-root']);
const evidenceFile = path.resolve(options['evidence-file']);
const releaseId = options['release-id'];
const rows = [];

function write(target, value, readOnly = false) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, typeof value === 'string' ? value : canonicalJson(value), { encoding: 'utf8', flag: 'wx' }); if (readOnly) fs.chmodSync(target, 0o444); }
function replace(target, value, readOnly = false) { fs.chmodSync(target, 0o644); fs.writeFileSync(target, typeof value === 'string' ? value : canonicalJson(value), 'utf8'); if (readOnly) fs.chmodSync(target, 0o444); }
function removeTree(target) { if (!fs.existsSync(target)) return; for (const entry of fs.readdirSync(target, { withFileTypes: true })) { const full = path.join(target, entry.name); if (entry.isDirectory()) removeTree(full); else { try { fs.chmodSync(full, 0o644); } catch {} fs.rmSync(full); } } fs.rmdirSync(target); }
function expected() { return { final_run_id: 'acceptance001', frozen_release_identity: releaseId, execution_attempt: 1, start_sequences: [100,200,300,400,500,600], end_sequences: [101,201,301,401,501,601] }; }

function makeSet(id, mutateLogs) {
  const root = path.join(temporaryRoot, id);
  const runId = 'acceptance001'; const resultRoot = path.join(root, 'results', runId);
  const wrapperRoot = path.join(root, 'wrappers'); const resultPaths = []; const wrapperPaths = [];
  fs.mkdirSync(resultRoot, { recursive: true }); fs.mkdirSync(wrapperRoot, { recursive: true });
  for (let index = 0; index < SUITES.length; index += 1) {
    const suite = SUITES[index];
    const stdoutPath = path.join(root, 'logs', `${suite}.stdout.log`); const stderrPath = path.join(root, 'logs', `${suite}.stderr.log`);
    const evidencePath = path.join(root, 'evidence', `${suite}.json`);
    write(stdoutPath, mutateLogs && mutateLogs.suite === suite ? mutateLogs.stdout : `${suite} human log\n`);
    write(stderrPath, mutateLogs && mutateLogs.suite === suite ? mutateLogs.stderr : '');
    write(evidencePath, { suite, pass: true });
    const resultPath = path.join(resultRoot, `${suite}.result.json`);
    writeSuiteResultAtomic(resultPath, {
      suite_id: suite, suite_version: '3.0.0-test', final_run_id: runId, frozen_release_identity: releaseId,
      execution_attempt: 1, start_sequence: (index + 1) * 100, end_sequence: (index + 1) * 100 + 1,
      status: 'PASS', exit_code: 0, test_count: 1, pass_count: 1, fail_count: 0, skipped_count: 0,
      raw_stdout_path: stdoutPath, raw_stderr_path: stderrPath, suite_evidence_paths: [evidencePath],
      result_created_at: '2026-08-01T12:00:01.000Z',
    });
    const stat = fs.statSync(resultPath);
    const wrapper = {
      schema: 'EXECUTOR_SUITE_WRAPPER_EVIDENCE_V1', suite_id: suite, final_run_id: runId,
      frozen_release_identity: releaseId, execution_attempt: 1, executable: process.execPath,
      argv: ['suite-adapter-v3.js', '--suite-id', suite], cwd: process.cwd(), environment_identity: 'a'.repeat(64),
      process_id: 1000 + index, wrapper_start_time_utc: '2026-08-01T12:00:00.000Z',
      process_start_time_utc: '2026-08-01T12:00:00.000Z', process_end_time_utc: '2026-08-01T12:00:02.000Z',
      process_exit_code: 0, start_sequence: (index + 1) * 100, end_sequence: (index + 1) * 100 + 1,
      raw_stdout_path: stdoutPath, raw_stdout_sha256: sha256File(stdoutPath), raw_stderr_path: stderrPath, raw_stderr_sha256: sha256File(stderrPath),
      expected_result_file_path: resultPath, result_path_absent_before_start: true, result_file_exists: true,
      result_file_sha256: sha256File(resultPath), result_file_size: stat.size, result_file_last_write_time_utc: stat.mtime.toISOString(),
      result_file_read_only: true, protocol_validation_exit_code: 0, timeout_seconds: 60, timed_out: false, cancelled: false, pass_synthesized: false,
    };
    const wrapperPath = path.join(wrapperRoot, `${suite}.json`); write(wrapperPath, wrapper, true);
    resultPaths.push(resultPath); wrapperPaths.push(wrapperPath);
  }
  const manifestPath = path.join(root, 'wrapper-manifest.json');
  write(manifestPath, { schema: 'EXECUTOR_SUITE_WRAPPER_EVIDENCE_MANIFEST_V1', final_run_id: runId, frozen_release_identity: releaseId, execution_attempt: 1, wrapper_evidence_paths: wrapperPaths, wrapper_evidence_hashes: wrapperPaths.map(sha256File) }, true);
  return { root, resultPaths, wrapperPaths, manifestPath };
}
function refreshWrapper(set, index, mutate) {
  const wrapperPath = set.wrapperPaths[index]; const wrapper = JSON.parse(fs.readFileSync(wrapperPath, 'utf8'));
  const resultPath = set.resultPaths[index];
  if (fs.existsSync(resultPath) && fs.statSync(resultPath).isFile()) {
    const stat = fs.statSync(resultPath); wrapper.result_file_sha256 = sha256File(resultPath); wrapper.result_file_size = stat.size; wrapper.result_file_last_write_time_utc = stat.mtime.toISOString();
  }
  if (mutate) mutate(wrapper);
  replace(wrapperPath, wrapper, true);
  const manifest = JSON.parse(fs.readFileSync(set.manifestPath, 'utf8')); manifest.wrapper_evidence_hashes = set.wrapperPaths.map(sha256File); replace(set.manifestPath, manifest, true);
}
function rewriteResult(set, index, mutate, updateWrapper = true) {
  const target = set.resultPaths[index]; const value = JSON.parse(fs.readFileSync(target, 'utf8')); mutate(value); value.result_sha256 = canonicalHash(resultBody(value)); replace(target, value, true); if (updateWrapper) refreshWrapper(set, index);
}
function validate(set, resultPaths = set.resultPaths) { return validateResultSet(resultPaths, set.manifestPath, expected()); }
function positive(id, description, fn) { try { fn(); rows.push({ id, description, expected: 'ACCEPT', pass: true }); } catch (error) { rows.push({ id, description, expected: 'ACCEPT', pass: false, observed: error.code || error.name, message: error.message }); } }
function negative(id, description, fn) { try { fn(); rows.push({ id, description, expected: 'REJECT', pass: false, observed: 'ACCEPTED' }); } catch (error) { rows.push({ id, description, expected: 'REJECT', pass: true, observed: error.code || error.name }); } }

try {
  removeTree(temporaryRoot); fs.mkdirSync(temporaryRoot, { recursive: true });
  positive('P001', 'many stdout lines plus one canonical result file', () => { const set = makeSet('p001', { suite: 'STATIC', stdout: `${Array.from({ length: 100 }, (_, i) => `line-${i}`).join('\n')}\n`, stderr: '' }); validateSuiteResultFile(set.resultPaths[0]); });
  positive('P002', 'stderr logs plus one canonical result file', () => { const set = makeSet('p002', { suite: 'PARSER', stdout: 'ok\n', stderr: 'diagnostic one\ndiagnostic two\n' }); validateSuiteResultFile(set.resultPaths[1]); });
  positive('P003', 'all six explicit suite result objects pass', () => { const set = makeSet('p003'); if (validate(set).results.length !== 6) throw new Error('WRONG_RESULT_COUNT'); });
  positive('P004', 'strict finalizer produces a READY candidate set', () => { const set = makeSet('p004'); if (!validate(set).results.every((row) => row.status === 'PASS')) throw new Error('NOT_READY'); });

  negative('N001', 'old V2 mixed stdout and object array', () => { const set = makeSet('n001'); const mixed = ['{"testCount":61,"passCount":61,"failCount":0}', { name: 'static', exit_code: 0, status: 'PASS', error: null }]; replace(set.resultPaths[0], mixed, true); refreshWrapper(set, 0); validate(set); });
  negative('N002', 'JSON array result', () => { const set = makeSet('n002'); replace(set.resultPaths[0], [{ status: 'PASS' }], true); refreshWrapper(set, 0); validate(set); });
  negative('N003', 'two concatenated result objects', () => { const set = makeSet('n003'); replace(set.resultPaths[0], '{}\n{}\n', true); refreshWrapper(set, 0); validate(set); });
  negative('N004', 'missing result file', () => { const set = makeSet('n004'); fs.chmodSync(set.resultPaths[0], 0o644); fs.rmSync(set.resultPaths[0]); validate(set); });
  negative('N005', 'malformed result JSON', () => { const set = makeSet('n005'); replace(set.resultPaths[0], '{bad json', true); refreshWrapper(set, 0); validate(set); });
  negative('N006', 'stale preexisting result flag', () => { const set = makeSet('n006'); refreshWrapper(set, 0, (wrapper) => { wrapper.result_path_absent_before_start = false; }); validate(set); });
  negative('N007', 'wrong suite ID', () => { const set = makeSet('n007'); rewriteResult(set, 0, (value) => { value.suite_id = 'PARSER'; }); validate(set); });
  negative('N008', 'wrong run ID', () => { const set = makeSet('n008'); rewriteResult(set, 0, (value) => { value.final_run_id = 'different001'; }); validate(set); });
  negative('N009', 'wrong release ID', () => { const set = makeSet('n009'); rewriteResult(set, 0, (value) => { value.frozen_release_identity = 'b'.repeat(64); }); validate(set); });
  negative('N010', 'duplicate suite result', () => { const set = makeSet('n010'); const paths = [...set.resultPaths]; paths[1] = paths[0]; validate(set, paths); });
  negative('N011', 'missing suite result', () => { const set = makeSet('n011'); validate(set, set.resultPaths.slice(0, 5)); });
  negative('N012', 'PASS with exit code 1', () => { const set = makeSet('n012'); rewriteResult(set, 0, (value) => { value.exit_code = 1; }); validate(set); });
  negative('N013', 'FAIL with zero wrapper exit contradiction', () => { const set = makeSet('n013'); rewriteResult(set, 0, (value) => { value.status = 'FAIL'; value.exit_code = 1; value.pass_count = 0; value.fail_count = 1; }); refreshWrapper(set, 0, (wrapper) => { wrapper.process_exit_code = 0; }); validate(set); });
  negative('N014', 'contradictory test counts', () => { const set = makeSet('n014'); rewriteResult(set, 0, (value) => { value.pass_count = 2; }); validate(set); });
  negative('N015', 'raw log hash mismatch', () => { const set = makeSet('n015'); rewriteResult(set, 0, (value) => { value.raw_stdout_sha256 = '0'.repeat(64); }); validate(set); });
  negative('N016', 'suite evidence hash mismatch', () => { const set = makeSet('n016'); rewriteResult(set, 0, (value) => { value.suite_evidence_hashes[0] = '0'.repeat(64); }); validate(set); });
  negative('N017', 'result rewritten after wrapper seal', () => { const set = makeSet('n017'); rewriteResult(set, 0, (value) => { value.suite_version = 'tampered'; }, false); validate(set); });
  negative('N018', 'result from another final attempt', () => { const set = makeSet('n018'); rewriteResult(set, 0, (value) => { value.execution_attempt = 2; }); validate(set); });
  negative('N019', 'finalizer receives a directory instead of explicit files', () => { const set = makeSet('n019'); const paths = [...set.resultPaths]; paths[0] = path.dirname(paths[0]); validate(set, paths); });

  const result = { schema: 'tairet-v3-orchestration-acceptance-result-v1', test_count: rows.length, pass_count: rows.filter((row) => row.pass).length, fail_count: rows.filter((row) => !row.pass).length, positive_count: rows.filter((row) => row.id.startsWith('P')).length, negative_count: rows.filter((row) => row.id.startsWith('N')).length, rows };
  fs.mkdirSync(path.dirname(evidenceFile), { recursive: true }); fs.writeFileSync(evidenceFile, canonicalJson(result), 'utf8');
  removeTree(temporaryRoot);
  process.stdout.write(`${JSON.stringify({ testCount: result.test_count, passCount: result.pass_count, failCount: result.fail_count })}\n`);
  process.exit(result.fail_count ? 1 : 0);
} catch (error) {
  try { removeTree(temporaryRoot); } catch {}
  process.stderr.write(`${error.stack}\n`); process.exit(1);
}
