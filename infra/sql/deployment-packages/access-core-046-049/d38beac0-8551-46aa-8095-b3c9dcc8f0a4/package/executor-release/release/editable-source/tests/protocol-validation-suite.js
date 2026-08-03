'use strict';

const fs = require('fs');
const path = require('path');
const { canonicalJson, parseStrictJson, validateShape, validateSuiteResultFile, writeSuiteResultAtomic } = require('../src/result/suite-result');

function args(argv) { const value = {}; for (let i = 0; i < argv.length; i += 2) value[argv[i].replace(/^--/, '')] = argv[i + 1]; return value; }
const options = args(process.argv.slice(2));
const output = path.resolve(options.output); const temporary = path.resolve(options['temporary-root']); const releaseId = options['release-id'];
const rows = [];
function test(id, expectation, fn) { try { fn(); rows.push({ id, expectation, pass: expectation === 'ACCEPT', observed: 'ACCEPT' }); } catch (error) { rows.push({ id, expectation, pass: expectation === 'REJECT', observed: error.code || error.name }); } }
function valid() { return { schema: 'EXECUTOR_SUITE_RESULT_V1', suite_id: 'STATIC', suite_version: '3.0.0', final_run_id: 'protocol001', frozen_release_identity: releaseId, execution_attempt: 1, start_sequence: 1, end_sequence: 2, status: 'PASS', exit_code: 0, test_count: 1, pass_count: 1, fail_count: 0, skipped_count: 0, raw_stdout_path: 'C:\\placeholder', raw_stdout_sha256: '0'.repeat(64), raw_stderr_path: 'C:\\placeholder2', raw_stderr_sha256: '0'.repeat(64), suite_evidence_paths: [], suite_evidence_hashes: [], result_created_at: '2026-08-01T00:00:01.000Z', result_sha256: '0'.repeat(64) }; }
test('PV001', 'REJECT', () => { const value = parseStrictJson('1'); validateShape(value); });
test('PV002', 'REJECT', () => { const value = parseStrictJson('[]'); validateShape(value); });
test('PV003', 'REJECT', () => parseStrictJson('{} {}'));
test('PV004', 'REJECT', () => parseStrictJson('{"schema":"A","schema":"B"}'));
test('PV005', 'REJECT', () => { const value = valid(); value.schema = 'UNKNOWN'; validateShape(value); });
test('PV006', 'REJECT', () => { const value = valid(); value.suite_id = 'UNKNOWN'; validateShape(value); });
test('PV007', 'REJECT', () => { const value = valid(); delete value.final_run_id; validateShape(value); });
test('PV008', 'REJECT', () => { const value = valid(); value.exit_code = 1; validateShape(value); });
test('PV009', 'REJECT', () => { const value = valid(); value.pass_count = 2; validateShape(value); });
test('PV010', 'REJECT', () => { const value = valid(); value.status = 'MAYBE'; validateShape(value); });
test('PV011', 'REJECT', () => { const value = valid(); value.start_sequence = 2; value.end_sequence = 2; validateShape(value); });
test('PV012', 'ACCEPT', () => {
  fs.mkdirSync(path.join(temporary, 'protocol001'), { recursive: true });
  const stdout = path.join(temporary, 'stdout.log'); const stderr = path.join(temporary, 'stderr.log'); const evidence = path.join(temporary, 'evidence.json');
  fs.writeFileSync(stdout, 'many arbitrary log lines\nnot json\n', 'utf8'); fs.writeFileSync(stderr, 'diagnostic text\n', 'utf8'); fs.writeFileSync(evidence, '{}\n', 'utf8');
  const target = path.join(temporary, 'protocol001', 'STATIC.result.json');
  writeSuiteResultAtomic(target, { suite_id: 'STATIC', suite_version: '3.0.0', final_run_id: 'protocol001', frozen_release_identity: releaseId, execution_attempt: 1, start_sequence: 1, end_sequence: 2, status: 'PASS', exit_code: 0, test_count: 1, pass_count: 1, fail_count: 0, skipped_count: 0, raw_stdout_path: stdout, raw_stderr_path: stderr, suite_evidence_paths: [evidence], result_created_at: new Date().toISOString() });
  validateSuiteResultFile(target);
});
const result = { schema: 'tairet-v3-protocol-validation-result-v1', test_count: rows.length, pass_count: rows.filter((row) => row.pass).length, fail_count: rows.filter((row) => !row.pass).length, rows };
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, canonicalJson(result), 'utf8');
function cleanup(root) { if (!fs.existsSync(root)) return; for (const entry of fs.readdirSync(root, { withFileTypes: true })) { const full = path.join(root, entry.name); if (entry.isDirectory()) cleanup(full); else { try { fs.chmodSync(full, 0o644); } catch {} fs.rmSync(full); } } fs.rmdirSync(root); }
cleanup(temporary);
process.stdout.write(`${JSON.stringify({ testCount: result.test_count, passCount: result.pass_count, failCount: result.fail_count })}\n`);
process.exit(result.fail_count ? 1 : 0);
