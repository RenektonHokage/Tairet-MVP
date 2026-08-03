'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  canonicalHash, canonicalJson, sha256File, writeSuiteResultAtomic,
} = require('../src/result/suite-result');

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!key || !key.startsWith('--') || argv[index + 1] === undefined) throw new Error(`INVALID_ARGUMENT_AT_${index}`);
    if (Object.prototype.hasOwnProperty.call(result, key.slice(2))) throw new Error(`DUPLICATE_ARGUMENT_${key}`);
    result[key.slice(2)] = argv[index + 1];
  }
  return result;
}

function readJson(target) { return JSON.parse(fs.readFileSync(target, 'utf8')); }
function writeJson(target, value) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, canonicalJson(value), { encoding: 'utf8', flag: 'wx' }); }
function listFiles(root) {
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`REPARSE_OR_SYMLINK_REJECTED: ${full}`);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) rows.push({ path: path.relative(root, full).split(path.sep).join('/'), size: fs.statSync(full).size, sha256: sha256File(full) });
      else throw new Error(`UNSUPPORTED_TREE_ENTRY: ${full}`);
    }
  }
  visit(root);
  return rows;
}
function compareBaseline(baselinePath, root) {
  const baseline = readJson(baselinePath);
  const actual = listFiles(root);
  const expected = new Map(baseline.files.map((row) => [row.path, row]));
  const observed = new Map(actual.map((row) => [row.path, row]));
  const changes = [];
  for (const key of [...new Set([...expected.keys(), ...observed.keys()])].sort()) {
    const left = expected.get(key); const right = observed.get(key);
    if (!left || !right || left.size !== right.size || left.sha256 !== right.sha256) changes.push(key);
  }
  return { baseline_file_count: baseline.files.length, actual_file_count: actual.length, change_count: changes.length, changes, inventory_sha256: canonicalHash(actual) };
}

const options = parseArgs(process.argv.slice(2));
const required = ['suite-id', 'result-file', 'final-run-id', 'release-id', 'execution-attempt', 'start-sequence', 'end-sequence', 'raw-stdout-path', 'raw-stderr-path', 'evidence-root', 'mode'];
for (const key of required) if (!options[key]) throw new Error(`MISSING_ARGUMENT_${key}`);

const suiteId = options['suite-id'];
const resultPath = path.resolve(options['result-file']);
const finalRunId = options['final-run-id'];
const releaseIdentity = options['release-id'];
const executionAttempt = Number(options['execution-attempt']);
const startSequence = Number(options['start-sequence']);
const endSequence = Number(options['end-sequence']);
const rawStdoutPath = path.resolve(options['raw-stdout-path']);
const rawStderrPath = path.resolve(options['raw-stderr-path']);
const evidenceRoot = path.resolve(options['evidence-root']);
const mode = options.mode;
const executorRoot = path.resolve(process.env.ROOT_EXECUTOR_ROOT || path.resolve(__dirname, '..', '..'));
const releaseRoot = path.resolve(process.env.FROZEN_RELEASE_ROOT || executorRoot);
const repoRoot = path.resolve(process.env.TAIRET_REPO_ROOT || 'C:\\Importante\\Python\\tairet-mono-2');
const stdout = [];
const stderr = [];

function append(bufferList, value) {
  if (!value) return;
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  bufferList.push(bytes);
  if (bytes.length && bytes[bytes.length - 1] !== 0x0a) bufferList.push(Buffer.from('\n'));
}
function run(executable, argv, env) {
  const result = childProcess.spawnSync(executable, argv, {
    cwd: repoRoot,
    env,
    encoding: null,
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: suiteId === 'ATOMICITY' ? 30 * 60 * 1000 : 10 * 60 * 1000,
  });
  append(stdout, result.stdout);
  append(stderr, result.stderr);
  if (result.error) throw result.error;
  if (result.signal) throw new Error(`CHILD_SIGNAL_${result.signal}`);
  if (result.status !== 0) throw new Error(`CHILD_EXIT_${result.status}: ${path.basename(executable)} ${argv.join(' ')}`);
  return result;
}
function coreEnvironment(evidenceDir) {
  const env = { ...process.env, EVIDENCE_DIR: evidenceDir, TAIRET_REPO_ROOT: repoRoot };
  env.EXECUTOR_ROOT = mode === 'Final' ? releaseRoot : executorRoot;
  if (mode === 'Development' && suiteId === 'CLEANUP') delete env.FINAL_RUN_ID;
  return env;
}
function ensurePass(value, expected, label) {
  for (const [key, expectedValue] of Object.entries(expected)) if (value[key] !== expectedValue) throw new Error(`${label}_${key.toUpperCase()}_MISMATCH_${value[key]}_${expectedValue}`);
}

let status = 'PASS';
let exitCode = 0;
let testCount = 0;
let passCount = 0;
let failCount = 0;
let skippedCount = 0;
let evidencePaths = [];
try {
  fs.mkdirSync(evidenceRoot, { recursive: true });
  if (suiteId === 'STATIC') {
    const staticDir = path.join(evidenceRoot, 'static');
    const pathDir = path.join(evidenceRoot, 'path-contract');
    fs.mkdirSync(staticDir, { recursive: true }); fs.mkdirSync(pathDir, { recursive: true });
    run(process.execPath, [path.join(__dirname, 'static-suite.js')], coreEnvironment(staticDir));
    run(process.execPath, [path.join(__dirname, 'path-contract-suite.js')], coreEnvironment(pathDir));
    const staticResult = readJson(path.join(staticDir, 'static-result.json'));
    const pathResult = readJson(path.join(pathDir, 'path-contract-result.json'));
    ensurePass(staticResult, { testCount: 61, passCount: 61, failCount: 0 }, 'STATIC');
    ensurePass(pathResult, { testCount: 16, passCount: 16, failCount: 0, mutationWorkspaceResidualCount: 0 }, 'PATH');
    testCount = staticResult.testCount + pathResult.testCount;
    passCount = staticResult.passCount + pathResult.passCount;
    evidencePaths = [
      path.join(staticDir, 'static-result.json'), path.join(staticDir, 'parser-test-manifest.json'),
      path.join(staticDir, 'recovery-test-manifest.json'), path.join(pathDir, 'path-contract-result.json'),
    ];
  } else if (suiteId === 'PARSER') {
    const target = path.join(evidenceRoot, 'static', 'parser-test-manifest.json');
    const value = readJson(target);
    ensurePass(value, { testCount: 36, passCount: 36 }, 'PARSER');
    if (value.rows && value.rows.some((row) => row.pass !== true)) throw new Error('PARSER_ROW_FAILURE');
    testCount = value.testCount; passCount = value.passCount; failCount = value.failCount || 0;
    evidencePaths = [target];
    append(stdout, JSON.stringify({ suite: suiteId, validatedEvidence: target, testCount, passCount, failCount }));
  } else if (suiteId === 'RECOVERY') {
    const target = path.join(evidenceRoot, 'static', 'recovery-test-manifest.json');
    const value = readJson(target);
    ensurePass(value, { testCount: 10, passCount: 10 }, 'RECOVERY');
    if (value.rows && value.rows.some((row) => row.pass !== true)) throw new Error('RECOVERY_ROW_FAILURE');
    testCount = value.testCount; passCount = value.passCount; failCount = value.failCount || 0;
    evidencePaths = [target];
    append(stdout, JSON.stringify({ suite: suiteId, validatedEvidence: target, testCount, passCount, failCount }));
  } else if (suiteId === 'ATOMICITY') {
    const passId = `v3${finalRunId.replace(/[^a-z0-9]/g, '')}`.slice(0, 12);
    run('pwsh', ['-NoProfile', '-File', path.join(mode === 'Final' ? releaseRoot : executorRoot, 'editable-source', 'tools', 'run-docker-suite.ps1'), '-Mode', mode, '-ExecutorRoot', executorRoot, '-RepositoryRoot', repoRoot, '-PassId', passId], coreEnvironment(evidenceRoot));
    const base = mode === 'Final' ? path.join(executorRoot, 'final-evidence') : path.join(executorRoot, 'development-evidence');
    const atomicPath = path.join(base, 'integration', 'atomicity-test-manifest.json');
    const dockerPath = path.join(base, 'docker', `docker-suite-${mode.toLowerCase()}.json`);
    const atomic = readJson(atomicPath); const docker = readJson(dockerPath);
    ensurePass(atomic, { testCount: 25, passCount: 25, failCount: 0, createdDatabaseResidualCount: 0 }, 'ATOMICITY');
    if (docker.suite_exit_code !== 0 || docker.cleanup.residual_resource_count !== 0 || docker.external_network_contact !== 0 || docker.pull_performed !== 0) throw new Error('ATOMICITY_DOCKER_EVIDENCE_FAILED');
    testCount = atomic.testCount; passCount = atomic.passCount; evidencePaths = [atomicPath, dockerPath];
  } else if (suiteId === 'SEMANTIC_MUTATION') {
    const mutationDir = path.join(evidenceRoot, 'mutations');
    fs.mkdirSync(mutationDir, { recursive: true });
    run(process.execPath, [path.join(__dirname, 'mutation-suite.js')], coreEnvironment(mutationDir));
    const target = path.join(mutationDir, 'semantic-mutation-manifest.json');
    const value = readJson(target);
    ensurePass(value, { mutationCount: 14, appliedCount: 14, activatedCount: 14, killedCount: 14, survivorCount: 0, workspaceResidualCount: 0 }, 'MUTATION');
    if (value.workspaceCreatedCount !== value.workspaceCleanedCount) throw new Error('MUTATION_WORKSPACE_CLEANUP_MISMATCH');
    testCount = value.mutationCount; passCount = value.killedCount; evidencePaths = [target];
  } else if (suiteId === 'CLEANUP') {
    const cleanupDir = path.join(evidenceRoot, 'cleanup');
    fs.mkdirSync(cleanupDir, { recursive: true });
    run(process.execPath, [path.join(__dirname, 'cleanup-suite.js')], coreEnvironment(cleanupDir));
    const corePath = path.join(cleanupDir, 'cleanup-result.json');
    const core = readJson(corePath);
    if (core.failCount !== 0 || core.testCount !== core.passCount) throw new Error('CORE_CLEANUP_FAILED');
    const v1Root = path.resolve(process.env.V1_EXECUTOR_ROOT);
    const v2Root = path.resolve(process.env.V2_EXECUTOR_ROOT);
    const v1 = compareBaseline(path.join(executorRoot, 'manifests', 'v1-tree-baseline.json'), v1Root);
    const v2 = compareBaseline(path.join(executorRoot, 'manifests', 'v2-tree-baseline.json'), v2Root);
    const supplement = {
      schema: 'tairet-v3-cleanup-supplement-v1', v1_change_count: v1.change_count,
      v2_change_count: v2.change_count, v1, v2, production_contact: 0,
    };
    if (v1.change_count !== 0 || v2.change_count !== 0) throw new Error('PROVENANCE_ROOT_CHANGED');
    const supplementPath = path.join(cleanupDir, 'v3-cleanup-supplement.json');
    writeJson(supplementPath, supplement);
    testCount = core.testCount + 2; passCount = core.passCount + 2; evidencePaths = [corePath, supplementPath];
  } else {
    throw new Error(`UNKNOWN_SUITE_${suiteId}`);
  }
} catch (error) {
  status = error && /UNAVAILABLE|TIMEOUT|ENOENT|CAPABILITY/.test(`${error.code || ''} ${error.message}`) ? 'UNRESOLVED' : 'FAIL';
  exitCode = 1;
  testCount = Math.max(testCount, 1); passCount = 0; failCount = status === 'FAIL' ? testCount : 0; skippedCount = status === 'UNRESOLVED' ? testCount : 0;
  evidencePaths = evidencePaths.filter((target) => fs.existsSync(target) && fs.statSync(target).isFile());
  append(stderr, `${error.name}: ${error.message}\n${error.stack || ''}`);
}

try {
  for (const target of [rawStdoutPath, rawStderrPath]) fs.mkdirSync(path.dirname(target), { recursive: true });
  if (stdout.length) fs.writeSync(1, Buffer.concat(stdout));
  if (stderr.length) fs.writeSync(2, Buffer.concat(stderr));
  fs.closeSync(1);
  fs.closeSync(2);
  writeSuiteResultAtomic(resultPath, {
    suite_id: suiteId,
    suite_version: '3.0.0',
    final_run_id: finalRunId,
    frozen_release_identity: releaseIdentity,
    execution_attempt: executionAttempt,
    start_sequence: startSequence,
    end_sequence: endSequence,
    status,
    exit_code: exitCode,
    test_count: testCount,
    pass_count: passCount,
    fail_count: failCount,
    skipped_count: skippedCount,
    raw_stdout_path: rawStdoutPath,
    raw_stderr_path: rawStderrPath,
    suite_evidence_paths: evidencePaths,
    result_created_at: new Date().toISOString(),
  });
  process.exit(exitCode);
} catch {
  process.exit(2);
}
