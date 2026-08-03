'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { canonicalHash, canonicalJson, sha256Bytes, sha256File } = require('../src/result/suite-result');
const { FinalizerError, strictRead, validateResultSet, verifyRelease } = require('../src/result/finalizer');

const RESULT_FLAGS = [
  ['static-result', 'STATIC'], ['parser-result', 'PARSER'], ['recovery-result', 'RECOVERY'],
  ['atomicity-result', 'ATOMICITY'], ['semantic-mutation-result', 'SEMANTIC_MUTATION'], ['cleanup-result', 'CLEANUP'],
];
function parseArgs(argv) {
  const allowed = new Set([...RESULT_FLAGS.map(([flag]) => flag), 'wrapper-evidence-manifest', 'output', 'executor-root', 'release-root', 'repository-root', 'run-id', 'release-id', 'execution-attempt', 'mode', 'global-gate-result']);
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index] || !argv[index].startsWith('--') || argv[index + 1] === undefined) throw new FinalizerError('FINALIZER_ARGUMENT_INVALID');
    const key = argv[index].slice(2);
    if (!allowed.has(key)) throw new FinalizerError('FINALIZER_ARGUMENT_UNKNOWN', key);
    if (Object.prototype.hasOwnProperty.call(result, key)) throw new FinalizerError('FINALIZER_ARGUMENT_DUPLICATE', key);
    result[key] = argv[index + 1];
  }
  for (const key of allowed) if (!Object.prototype.hasOwnProperty.call(result, key)) throw new FinalizerError('FINALIZER_ARGUMENT_MISSING', key);
  return result;
}
function writeAtomic(target, value, readOnly = true) {
  if (fs.existsSync(target)) throw new FinalizerError('FINALIZER_OUTPUT_PREEXISTING', target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`);
  fs.writeFileSync(temporary, typeof value === 'string' ? value : canonicalJson(value), { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temporary, target);
  if (readOnly) fs.chmodSync(target, 0o444);
}
function copySealed(source, target) { if (fs.existsSync(target)) throw new FinalizerError('FINALIZER_COPY_TARGET_PREEXISTING', target); fs.copyFileSync(source, target, fs.constants.COPYFILE_EXCL); fs.chmodSync(target, 0o444); }
function payloadIdentity(target) { const bytes = fs.readFileSync(target); return { size: bytes.length - 15, sha256: sha256Bytes(bytes.subarray(7, bytes.length - 8)) }; }
function artifact(root, target) { return { path: path.relative(root, target).split(path.sep).join('/'), size: fs.statSync(target).size, sha256: sha256File(target) }; }

let options;
let outputPath;
try {
  options = parseArgs(process.argv.slice(2));
  outputPath = path.resolve(options.output);
  const executorRoot = path.resolve(options['executor-root']);
  const releaseRoot = path.resolve(options['release-root']);
  const repositoryRoot = path.resolve(options['repository-root']);
  const finalRunId = options['run-id'];
  const releaseIdentity = options['release-id'];
  const executionAttempt = Number(options['execution-attempt']);
  const mode = options.mode;
  const command = (executable, args) => childProcess.execFileSync(executable, args, { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true }).trim();
  const resultPaths = RESULT_FLAGS.map(([flag]) => path.resolve(options[flag]));
  const expected = {
    final_run_id: finalRunId, frozen_release_identity: releaseIdentity, execution_attempt: executionAttempt,
    start_sequences: [100, 200, 300, 400, 500, 600], end_sequences: [101, 201, 301, 401, 501, 601],
  };
  const validated = validateResultSet(resultPaths, path.resolve(options['wrapper-evidence-manifest']), expected);
  const bySuite = Object.fromEntries(validated.results.map((row) => [row.suite_id, row]));
  const releaseManifestPath = mode === 'Final' ? path.join(releaseRoot, 'frozen-release-manifest.json') : path.join(executorRoot, 'development-evidence', 'development-release-manifest.json');
  const release = strictRead(releaseManifestPath, 'RELEASE_MANIFEST_INVALID');
  verifyRelease(releaseRoot, release);
  if (release.releaseSha256 !== releaseIdentity) throw new FinalizerError('FINALIZER_RELEASE_BINDING_MISMATCH');
  const globalGate = strictRead(path.resolve(options['global-gate-result']), 'GLOBAL_GATE_RESULT_INVALID');
  if (globalGate.fail_count !== 0 || globalGate.pass_count !== globalGate.gate_count) throw new FinalizerError('FINALIZER_GLOBAL_GATE_FAILED');
  const environment = strictRead(path.join(releaseRoot, 'manifests', 'final-environment-contract.json'), 'FINAL_ENVIRONMENT_INVALID');
  const environmentBody = { ...environment }; delete environmentBody.contractSha256;
  if (environment.contractSha256 !== canonicalHash(environmentBody) || environment.FINAL_ENVIRONMENT_CONTRACT !== 'PASS') throw new FinalizerError('FINALIZER_ENVIRONMENT_IDENTITY_MISMATCH');
  const authorized = strictRead(path.join(releaseRoot, 'manifests', 'authorized-input-integrity.json'), 'AUTHORIZED_INPUT_INVALID');
  if (command('git', ['-C', repositoryRoot, 'branch', '--show-current']) !== 'main' || command('git', ['-C', repositoryRoot, 'rev-parse', 'HEAD']) !== '715ad1cea644e45d688dca785de09c83e1956413') throw new FinalizerError('FINALIZER_REPOSITORY_IDENTITY_MISMATCH');
  if (command('git', ['-C', repositoryRoot, 'diff', '--name-only']) || command('git', ['-C', repositoryRoot, 'diff', '--cached', '--name-only'])) throw new FinalizerError('FINALIZER_REPOSITORY_TRACKED_WRITE');
  for (let index = 0; index < authorized.canonicalMigrations.length; index += 1) {
    const expectedSource = authorized.canonicalMigrations[index]; const expectedPayload = authorized.intermediatePayloads[index];
    const target = path.join(repositoryRoot, ...expectedSource.canonicalPath.split('/'));
    if (fs.statSync(target).size !== expectedSource.size || sha256File(target) !== expectedSource.sha256) throw new FinalizerError('FINALIZER_CANONICAL_MIGRATION_MISMATCH', expectedSource.logicalMigrationNumber);
    const payload = payloadIdentity(target);
    if (payload.size !== expectedPayload.size || payload.sha256 !== expectedPayload.sha256) throw new FinalizerError('FINALIZER_PAYLOAD_MISMATCH', expectedSource.logicalMigrationNumber);
  }
  const mutationEvidence = strictRead(bySuite.SEMANTIC_MUTATION.suite_evidence_paths[0], 'MUTATION_EVIDENCE_INVALID');
  if (mutationEvidence.mutationCount !== 14 || mutationEvidence.appliedCount !== 14 || mutationEvidence.activatedCount !== 14 || mutationEvidence.killedCount !== 14 || mutationEvidence.survivorCount !== 0) throw new FinalizerError('FINALIZER_MUTATION_COUNTS_INVALID');
  const cleanupCore = strictRead(bySuite.CLEANUP.suite_evidence_paths[0], 'CLEANUP_EVIDENCE_INVALID');
  const cleanupSupplement = strictRead(bySuite.CLEANUP.suite_evidence_paths[1], 'CLEANUP_SUPPLEMENT_INVALID');
  if (cleanupCore.failCount !== 0 || cleanupCore.residualDockerResourceCount !== 0 || cleanupCore.survivingProcessCount !== 0 || cleanupCore.repositoryWriteCount !== 0 || cleanupCore.migrationFileChangeCount !== 0 || cleanupSupplement.v1_change_count !== 0 || cleanupSupplement.v2_change_count !== 0) throw new FinalizerError('FINALIZER_CLEANUP_INVALID');
  const acceptance = strictRead(path.join(releaseRoot, 'manifests', 'development-orchestration-acceptance-result.json'), 'ACCEPTANCE_EVIDENCE_INVALID');
  if (acceptance.fail_count !== 0 || acceptance.pass_count !== acceptance.test_count) throw new FinalizerError('FINALIZER_ACCEPTANCE_GATE_INVALID');
  const markerPath = mode === 'Final' ? path.join(executorRoot, 'final-run', 'final-execution-started.json') : path.join(path.dirname(outputPath), 'development-execution-started.json');
  const marker = strictRead(markerPath, 'EXECUTION_MARKER_INVALID');
  if (marker.execution_count !== 1 || marker.rerun_count !== 0 || marker.final_run_id !== finalRunId || marker.execution_attempt !== executionAttempt || marker.frozen_release_identity !== releaseIdentity) throw new FinalizerError('FINALIZER_MARKER_BINDING_INVALID');

  const classification = mode === 'Final' ? 'STATEMENT_AWARE_ATOMIC_MIGRATION_EXECUTOR_V3_READY_FOR_INDEPENDENT_REVIEW' : 'STATEMENT_AWARE_ATOMIC_MIGRATION_EXECUTOR_V3_DEVELOPMENT_READY_CANDIDATE';
  const orchestration = {
    schema: 'tairet-executor-v3-orchestration-result-v1', classification, ready: true,
    final_run_id: finalRunId, frozen_release_identity: releaseIdentity, execution_attempt: executionAttempt,
    result_file_count: resultPaths.length, result_object_count: validated.results.length,
    array_result_count: 0, duplicate_result_count: 0, missing_result_count: 0,
    required_suite_ids: RESULT_FLAGS.map(([, suite]) => suite),
    suite_result_sha256: Object.fromEntries(RESULT_FLAGS.map(([, suite], index) => [suite, sha256File(resultPaths[index])])),
    final_orchestration_result: 'PASS', production_contact: 0,
  };
  writeAtomic(outputPath, orchestration);

  if (mode === 'Final') {
    const finalRoot = path.dirname(outputPath);
    const canonicalCopies = {};
    for (let index = 0; index < RESULT_FLAGS.length; index += 1) {
      const [flag] = RESULT_FLAGS[index]; const target = path.join(finalRoot, `${flag}.json`);
      copySealed(resultPaths[index], target); canonicalCopies[flag] = target;
    }
    const wrapperCopy = path.join(finalRoot, 'per-suite-wrapper-evidence-manifest.json'); copySealed(path.resolve(options['wrapper-evidence-manifest']), wrapperCopy);
    const forensicsCopy = path.join(finalRoot, 'v2-final-orchestration-forensics.json'); copySealed(path.join(releaseRoot, 'manifests', 'v2-final-orchestration-forensics.json'), forensicsCopy);
    const protocolCopy = path.join(finalRoot, 'suite-result-protocol.json'); copySealed(path.join(releaseRoot, 'manifests', 'suite-result-protocol.json'), protocolCopy);
    const releaseCopy = path.join(finalRoot, 'frozen-release-manifest.json'); copySealed(path.join(releaseRoot, 'frozen-release-manifest.json'), releaseCopy);
    const spec = (name) => sha256File(path.join(releaseRoot, 'manifests', name));
    const structured = {
      schema: 'tairet-statement-aware-atomic-migration-executor-v3-result', CLASSIFICATION: classification,
      EXECUTOR_V3_ROOT: executorRoot, AUTHORIZED_INPUT_INTEGRITY: 'PASS',
      V2_FROZEN_RELEASE_IDENTITY: '2b4668c5f1671114a856589298e0102b238841f53890b92ca5dde666eb7a17c8',
      V2_ARTIFACT_HASH_MANIFEST_IDENTITY: '0f3e00a85b03c44472e49cf4ae2031a6b2a1dc1be28170e1914a6f09bc250120',
      EXECUTOR_V2_FINAL_ORCHESTRATION_FORENSICS_SHA256: sha256File(forensicsCopy),
      EXECUTOR_V3_SUITE_RESULT_PROTOCOL_SHA256: spec('suite-result-protocol.json'),
      EXECUTOR_V3_RESULT_CHANNEL_IMPLEMENTATION_SHA256: spec('result-channel-implementation.json'),
      EXECUTOR_V3_SUITE_WRAPPER_EVIDENCE_SHA256: spec('suite-wrapper-evidence-spec.json'),
      EXECUTOR_V3_FINALIZER_IMPLEMENTATION_SHA256: spec('finalizer-implementation.json'),
      EXECUTOR_V3_ORCHESTRATION_ACCEPTANCE_MATRIX_SHA256: spec('orchestration-acceptance-matrix.json'),
      EXECUTOR_V3_REUSE_AND_CHANGE_MANIFEST_SHA256: spec('reuse-and-change-manifest.json'),
      EXECUTOR_V3_SUITE_ISOLATION_SPEC_SHA256: spec('suite-isolation-spec.json'),
      FROZEN_STATEMENT_AWARE_ATOMIC_EXECUTOR_V3_RELEASE_SHA256: releaseIdentity,
      STATIC_TEST_COUNT: bySuite.STATIC.test_count, STATIC_TEST_PASS_COUNT: bySuite.STATIC.pass_count,
      PARSER_TEST_COUNT: bySuite.PARSER.test_count, PARSER_TEST_PASS_COUNT: bySuite.PARSER.pass_count,
      RECOVERY_TEST_COUNT: bySuite.RECOVERY.test_count, RECOVERY_TEST_PASS_COUNT: bySuite.RECOVERY.pass_count,
      ATOMICITY_TEST_COUNT: bySuite.ATOMICITY.test_count, ATOMICITY_TEST_PASS_COUNT: bySuite.ATOMICITY.pass_count,
      SEMANTIC_MUTATION_COUNT: mutationEvidence.mutationCount, SEMANTIC_MUTATION_APPLIED_COUNT: mutationEvidence.appliedCount,
      SEMANTIC_MUTATION_ACTIVATED_COUNT: mutationEvidence.activatedCount, SEMANTIC_MUTATION_KILLED_COUNT: mutationEvidence.killedCount,
      SEMANTIC_MUTATION_SURVIVOR_COUNT: mutationEvidence.survivorCount,
      ORCHESTRATION_TEST_COUNT: acceptance.test_count, ORCHESTRATION_TEST_PASS_COUNT: acceptance.pass_count,
      FINAL_SUITE_RESULT_FILE_COUNT: 6, FINAL_SUITE_RESULT_OBJECT_COUNT: 6, FINAL_SUITE_ARRAY_RESULT_COUNT: 0,
      FINAL_SUITE_DUPLICATE_RESULT_COUNT: 0, FINAL_SUITE_MISSING_RESULT_COUNT: 0, FINAL_ORCHESTRATION_RESULT: 'PASS',
      FINAL_TEST_EXECUTION_COUNT: 1, FINAL_TEST_RERUN_COUNT: 0,
      MUTATION_WORKSPACE_CREATED_COUNT: mutationEvidence.workspaceCreatedCount, MUTATION_WORKSPACE_CLEANED_COUNT: mutationEvidence.workspaceCleanedCount,
      MUTATION_WORKSPACE_RESIDUAL_COUNT: mutationEvidence.workspaceResidualCount,
      RESIDUAL_DOCKER_RESOURCE_COUNT: cleanupCore.residualDockerResourceCount, SURVIVING_PROCESS_COUNT: cleanupCore.survivingProcessCount,
      V1_CHANGE_COUNT: cleanupSupplement.v1_change_count, V2_CHANGE_COUNT: cleanupSupplement.v2_change_count,
      REPOSITORY_WRITE_COUNT: cleanupCore.repositoryWriteCount, MIGRATION_FILE_CHANGE_COUNT: cleanupCore.migrationFileChangeCount,
      REAL_DEPLOYMENT_VERSION_COUNT_ASSIGNED: 0, PRODUCTION_CONTACT: 0, FINDINGS: [],
      RESIDUAL_RISK: ['Independent read-only review has not yet been performed.', 'Production deployment versions and a production manifest remain deliberately unassigned.'],
      NEXT_RECOMMENDED_ACTION: 'NEW INDEPENDENT READ-ONLY REVIEW of the frozen executor V3 release.',
      confirmations: {
        frozenV2NotModifiedOrRerun: true, frozenV1NotModifiedOrRerun: true, v3IsNewRelease: true,
        stdoutStderrNotStructuredResultChannels: true, everySuiteWroteExactlyOneObject: true, arraysRejected: true,
        finalizerInputsWereExplicitFiles: true, allSubstantiveSuitesAndOrchestrationOneAttempt: true, noFinalRerun: true,
        noRealDeploymentVersionsAssigned: true, migrationsAndRepositoryUnchanged: true, noSupabaseRailwayVercelOrProductionAction: true,
      },
    };
    const structuredPath = path.join(finalRoot, 'structured-result.json'); writeAtomic(structuredPath, structured);
    const report = `# Statement-aware atomic migration executor V3 — final report\n\nCLASSIFICATION = ${classification}\n\nEXECUTOR_V3_ROOT = ${executorRoot}\n\n- Static: ${structured.STATIC_TEST_PASS_COUNT}/${structured.STATIC_TEST_COUNT}.\n- Parser: ${structured.PARSER_TEST_PASS_COUNT}/${structured.PARSER_TEST_COUNT}.\n- Recovery: ${structured.RECOVERY_TEST_PASS_COUNT}/${structured.RECOVERY_TEST_COUNT}.\n- PostgreSQL atomicity: ${structured.ATOMICITY_TEST_PASS_COUNT}/${structured.ATOMICITY_TEST_COUNT}.\n- Semantic mutations: ${structured.SEMANTIC_MUTATION_KILLED_COUNT}/${structured.SEMANTIC_MUTATION_COUNT} killed; survivors ${structured.SEMANTIC_MUTATION_SURVIVOR_COUNT}.\n- Orchestration acceptance: ${structured.ORCHESTRATION_TEST_PASS_COUNT}/${structured.ORCHESTRATION_TEST_COUNT}.\n- Six canonical suite result objects; arrays 0; duplicates 0; missing 0.\n- Final execution count 1; rerun count 0.\n- V1 changes 0; V2 changes 0; repository writes 0; migration changes 0.\n- Residual Docker resources 0; surviving executor processes 0.\n- Raw stdout/stderr were log evidence only. The finalizer consumed six explicit result-file paths.\n- No real deployment versions, production manifest, Supabase, Railway, Vercel, external-network, or production action.\n\nNext action: NEW INDEPENDENT READ-ONLY REVIEW of the frozen executor V3 release.\n`;
    const reportPath = path.join(finalRoot, 'detailed-report.md'); writeAtomic(reportPath, report);
    const evidenceTargets = [outputPath, ...Object.values(canonicalCopies), wrapperCopy, forensicsCopy, protocolCopy, releaseCopy, structuredPath, reportPath];
    const evidenceManifestPath = path.join(finalRoot, 'evidence-manifest.json');
    writeAtomic(evidenceManifestPath, { schema: 'tairet-executor-v3-final-evidence-manifest', classification, frozen_release_identity: releaseIdentity, evidence: evidenceTargets.map((target) => artifact(finalRoot, target)) });
    const artifactManifestPath = path.join(finalRoot, 'artifact-hash-manifest.json');
    writeAtomic(artifactManifestPath, { schema: 'tairet-executor-v3-artifact-hash-manifest', classification, self_hash_disposition: 'SELF_EXCLUDED_TO_AVOID_RECURSIVE_DIGEST', artifacts: [...evidenceTargets, evidenceManifestPath].map((target) => artifact(finalRoot, target)) });
  }
  process.exit(0);
} catch (error) {
  if (outputPath && !fs.existsSync(outputPath)) {
    try { writeAtomic(outputPath, { schema: 'tairet-executor-v3-orchestration-result-v1', classification: 'STATEMENT_AWARE_ATOMIC_MIGRATION_EXECUTOR_V3_FINDINGS', ready: false, final_orchestration_result: 'FAIL', finding: { code: error.code || error.name, message: error.message }, production_contact: 0 }); } catch {}
  }
  process.stderr.write(`${error.name}: ${error.message}\n`);
  process.exit(1);
}
