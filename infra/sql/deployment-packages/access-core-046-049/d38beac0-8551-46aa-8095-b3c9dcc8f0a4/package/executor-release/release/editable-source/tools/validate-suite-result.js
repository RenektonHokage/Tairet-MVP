'use strict';

const fs = require('fs');
const { validateSuiteResultFile } = require('../src/result/suite-result');

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index] || !argv[index].startsWith('--') || argv[index + 1] === undefined) throw new Error('INVALID_ARGUMENTS');
    const key = argv[index].slice(2);
    if (Object.prototype.hasOwnProperty.call(result, key)) throw new Error(`DUPLICATE_ARGUMENT_${key}`);
    result[key] = argv[index + 1];
  }
  return result;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const wrapper = options['wrapper-evidence'] ? JSON.parse(fs.readFileSync(options['wrapper-evidence'], 'utf8')) : {};
  validateSuiteResultFile(options['result-file'], {
    suite_id: options['suite-id'],
    final_run_id: options['final-run-id'],
    frozen_release_identity: options['release-id'],
    execution_attempt: Number(options['execution-attempt']),
    start_sequence: Number(options['start-sequence']),
    end_sequence: Number(options['end-sequence']),
    process_exit_code: options['process-exit-code'] === undefined ? undefined : Number(options['process-exit-code']),
    process_start_time: wrapper.process_start_time_utc,
    result_file_sha256: wrapper.result_file_sha256,
    result_file_size: wrapper.result_file_size,
    result_file_last_write_time_utc: wrapper.result_file_last_write_time_utc,
    result_path_absent_before_start: wrapper.result_path_absent_before_start,
  });
  process.exit(0);
} catch {
  process.exit(1);
}
