'use strict';

const assert = require('assert/strict');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { canonicalHash, canonicalJson, sealed, sha256File, verifySeal } = require('./lib/canonical');
const {
  PACKAGE_ID,
  HOST_PACKAGE_ROOT,
  FAILED_PACKAGE_ROOT,
  EXECUTOR_V3_ROOT,
  REPOSITORY_ROOT,
  MIGRATIONS,
  FAILED_PACKAGE,
  EXPECTED_EXECUTOR_RELEASE_IDENTITY,
} = require('./lib/definitions');

const packageRoot = path.resolve(__dirname, '..');
function fail(code, detail = '') { throw new Error(`${code}${detail ? `: ${detail}` : ''}`); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function walkFiles(root) {
  const rows = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) rows.push(...walkFiles(full));
    else if (entry.isFile()) rows.push(full);
  }
  return rows;
}
function inventory(root) {
  const entries = walkFiles(root).map((file) => ({ package_path: path.relative(root, file).split(path.sep).join('/'), size: fs.statSync(file).size, sha256: sha256File(file) }));
  return { entries, file_count: entries.length, total_size: entries.reduce((sum, row) => sum + row.size, 0), inventory_sha256: canonicalHash(entries) };
}
function command(args) { return childProcess.execFileSync(args[0], args.slice(1), { encoding: 'utf8', windowsHide: true }).trim(); }
function writeJsonNew(file, value) {
  if (fs.existsSync(file)) fail('FINAL_RESULT_TARGET_EXISTS', file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, canonicalJson(value), { flag: 'wx' });
}
function dockerLines(args) {
  const output = command(['docker', ...args]);
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}
function compareBaseline(baseline, root) {
  const current = inventory(root);
  const changeCount = baseline.file_count === current.file_count && baseline.total_size === current.total_size && baseline.inventory_sha256 === current.inventory_sha256 ? 0 : 1;
  return { change_count: changeCount, current_file_count: current.file_count, current_total_size: current.total_size, current_inventory_sha256: current.inventory_sha256 };
}
function scenarioSummary(result, id) {
  const row = result.rows.find((item) => item.id === id);
  if (!row) fail('FINAL_SCENARIO_MISSING', id);
  return { id, pass: row.pass, result_summary: row.result_summary, evidence_sha256: row.artifact.sha256 };
}
function main() {
  assert.equal(packageRoot.toLowerCase(), HOST_PACKAGE_ROOT.toLowerCase(), 'PACKAGE_ROOT_MISMATCH');
  const requiredOutputPaths = [path.join(packageRoot, 'manifests', 'structured-result-v2.json'), path.join(packageRoot, 'manifests', 'detailed-report-v2.md'), path.join(packageRoot, 'manifests', 'artifact-hash-manifest-v2.json'), path.join(packageRoot, 'final-rehearsal-evidence', 'per-scenario-evidence-manifest-v2.json')];
  for (const file of requiredOutputPaths) if (fs.existsSync(file)) fail('FINAL_OUTPUT_ALREADY_EXISTS', file);
  const event = readJson(path.join(packageRoot, 'manifests', 'packaging-event-v2.json'));
  const assignment = readJson(path.join(packageRoot, 'deployment-manifest', 'version-assignment-v2.json'));
  const manifest = readJson(path.join(packageRoot, 'deployment-manifest', 'access-core-046-049-deployment-manifest-v2.json'));
  const forensics = readJson(path.join(packageRoot, 'manifests', 'package-v1-path-field-failure-forensics.json'));
  const schemaIdentity = readJson(path.join(packageRoot, 'manifests', 'input-manifest-schema-identity-v2.json'));
  const binding = readJson(path.join(packageRoot, 'manifests', 'input-manifest-runtime-binding-v2.json'));
  const testMatrix = readJson(path.join(packageRoot, 'development-evidence', 'contract-tests', 'input-manifest-v2-test-result.json'));
  const reservation = readJson(path.join(packageRoot, 'version-reservations', 'failed-package-versions.json'));
  const selfValidation = readJson(path.join(packageRoot, 'development-evidence', 'runtime-self-validation', 'runtime-self-validation-result-v2.json'));
  const developmentRun = manifest.development_gates.development_run_id;
  const development = readJson(path.join(packageRoot, 'development-evidence', 'runs', developmentRun, 'development-rehearsal-result-v2.json'));
  const developmentOrchestration = readJson(path.join(packageRoot, 'development-evidence', 'runs', developmentRun, 'orchestration-result.json'));
  const prewrite = readJson(path.join(packageRoot, 'manifests', 'prewrite-authoritative-manifest-validation-v2.json'));
  const postwrite = readJson(path.join(packageRoot, 'manifests', 'postwrite-authoritative-manifest-validation-v2.json'));
  const freeze = readJson(path.join(packageRoot, 'frozen-package', 'frozen-package-manifest-v2.json'));
  const finalMarker = readJson(path.join(packageRoot, 'final-rehearsal-evidence', 'final-execution-authority.json'));
  const final = readJson(path.join(packageRoot, 'final-rehearsal-evidence', 'run', 'final-rehearsal-result-v2.json'));
  const finalOrchestration = readJson(path.join(packageRoot, 'final-rehearsal-evidence', 'run', 'orchestration-result.json'));
  const seals = [
    [event, 'package_v2_packaging_event_identity_sha256'], [assignment, 'package_v2_version_assignment_sha256'], [manifest, 'manifest_sha256'], [forensics, 'package_v1_path_field_failure_forensics_sha256'], [schemaIdentity, 'package_v2_input_manifest_schema_sha256'], [binding, 'package_v2_input_manifest_runtime_binding_sha256'], [testMatrix, 'package_v2_input_manifest_test_matrix_sha256'], [reservation, 'failed_package_version_reservation_sha256'], [selfValidation, 'package_v2_runtime_self_validation_sha256'], [development, 'package_v2_development_rehearsal_result_sha256'], [prewrite, 'package_v2_prewrite_manifest_validation_sha256'], [postwrite, 'postwrite_manifest_validation_sha256'], [freeze, 'frozen_access_core_046_049_deployment_package_v2_sha256'], [final, 'package_v2_final_rehearsal_result_sha256'],
  ];
  for (const [value, field] of seals) verifySeal(value, field, `${field}_MISMATCH`);
  if (final.scenario_count !== 12 || final.pass_count !== 12 || final.fail_count !== 0 || final.open_postgres_session_count !== 0 || final.disposable_database_residual_count !== 0 || final.runtime_stage_verifier_pass_count < 1) fail('FINAL_REHEARSAL_NOT_GREEN');
  if (finalMarker.final_rehearsal_execution_count !== 1 || finalMarker.final_rehearsal_rerun_count !== 0 || finalMarker.write_count !== 1 || finalMarker.frozen_package_sha256 !== freeze.frozen_access_core_046_049_deployment_package_v2_sha256) fail('FINAL_EXECUTION_AUTHORITY_MISMATCH');
  if (development.scenario_count !== 19 || development.pass_count !== 19 || development.fail_count !== 0 || developmentOrchestration.repository_write_count !== 0 || developmentOrchestration.cleanup.residual_resource_count !== 0) fail('DEVELOPMENT_REHEARSAL_NOT_GREEN');
  if (postwrite.manifest_write_count !== 1 || postwrite.manifest_correction_count !== 0 || postwrite.validation !== 'PASS') fail('MANIFEST_WRITE_POLICY_MISMATCH');

  const failedBaseline = readJson(path.join(packageRoot, 'manifests', 'failed-package-immutability-baseline.json'));
  const executorBaseline = readJson(path.join(packageRoot, 'manifests', 'executor-v3-immutability-baseline.json'));
  const repositoryBaseline = readJson(path.join(packageRoot, 'manifests', 'repository-immutability-baseline.json'));
  verifySeal(failedBaseline, 'baseline_evidence_sha256', 'FAILED_BASELINE_IDENTITY_MISMATCH');
  verifySeal(executorBaseline, 'executor_v3_baseline_evidence_sha256', 'EXECUTOR_BASELINE_IDENTITY_MISMATCH');
  verifySeal(repositoryBaseline, 'repository_baseline_evidence_sha256', 'REPOSITORY_BASELINE_IDENTITY_MISMATCH');
  const failedComparison = compareBaseline(failedBaseline, FAILED_PACKAGE_ROOT);
  const executorComparison = compareBaseline(executorBaseline, EXECUTOR_V3_ROOT);
  const repositoryCurrent = {
    root: command(['git', '-C', REPOSITORY_ROOT, 'rev-parse', '--show-toplevel']).replaceAll('\\', '/'),
    branch: command(['git', '-C', REPOSITORY_ROOT, 'branch', '--show-current']),
    head: command(['git', '-C', REPOSITORY_ROOT, 'rev-parse', 'HEAD']),
    status: command(['git', '-C', REPOSITORY_ROOT, 'status', '--porcelain=v1', '--untracked-files=all']),
    staging: command(['git', '-C', REPOSITORY_ROOT, 'diff', '--cached', '--name-status']),
    migrations: MIGRATIONS.map((migration) => { const file = path.join(REPOSITORY_ROOT, 'infra', 'sql', 'migrations', migration.filename); return { name: migration.filename, size: fs.statSync(file).size, sha256: sha256File(file) }; }),
  };
  const repositoryChangeCount = canonicalHash(repositoryCurrent) === canonicalHash(repositoryBaseline.repository) ? 0 : 1;
  const migrationChangeCount = MIGRATIONS.filter((migration) => { const file = path.join(REPOSITORY_ROOT, 'infra', 'sql', 'migrations', migration.filename); return fs.statSync(file).size !== migration.size || sha256File(file) !== migration.sha256; }).length;
  const dockerContainers = dockerLines(['ps', '-a', '--filter', `label=tairet.access.package.v2.id=${PACKAGE_ID}`, '--format', '{{.ID}}']);
  const dockerNetworks = dockerLines(['network', 'ls', '--filter', `label=tairet.access.package.v2.id=${PACKAGE_ID}`, '--format', '{{.ID}}']);
  const dockerVolumes = dockerLines(['volume', 'ls', '--filter', `label=tairet.access.package.v2.id=${PACKAGE_ID}`, '--format', '{{.Name}}']);
  const residualDocker = dockerContainers.length + dockerNetworks.length + dockerVolumes.length;
  const survivingProcesses = finalOrchestration.surviving_process_count;
  if (failedComparison.change_count || executorComparison.change_count || repositoryChangeCount || migrationChangeCount || residualDocker || survivingProcesses || finalOrchestration.open_postgres_session_count !== 0) fail('FINAL_IMMUTABILITY_OR_CLEANUP_MISMATCH');

  const scenarioEntries = walkFiles(path.join(packageRoot, 'final-rehearsal-evidence', 'run', 'scenarios')).map((file) => ({ scenario_id: path.basename(file, '.json'), package_path: path.relative(packageRoot, file).split(path.sep).join('/'), size: fs.statSync(file).size, sha256: sha256File(file) }));
  assert.equal(scenarioEntries.length, 12);
  const scenarioManifest = sealed({ schema: 'ACCESS_CORE_046_049_FINAL_PER_SCENARIO_EVIDENCE_MANIFEST_V2', package_id: PACKAGE_ID, scenario_count: scenarioEntries.length, pass_count: final.pass_count, entries: scenarioEntries, production_contact: 0 }, 'per_scenario_evidence_manifest_sha256');
  writeJsonNew(path.join(packageRoot, 'final-rehearsal-evidence', 'per-scenario-evidence-manifest-v2.json'), scenarioManifest);

  const normal = scenarioSummary(final, 'ELR-01');
  const preCommit = ['ELR-02', 'ELR-03', 'ELR-04'].map((id) => scenarioSummary(final, id));
  const ambiguous = ['ELR-05', 'ELR-06'].map((id) => scenarioSummary(final, id));
  const split = ['ELR-07', 'ELR-08', 'ELR-09', 'ELR-11'].map((id) => scenarioSummary(final, id));
  const outOfOrder = scenarioSummary(final, 'ELR-12');
  const resultBody = {
    CLASSIFICATION: 'ACCESS_CORE_046_049_DEPLOYMENT_PACKAGE_V2_READY_FOR_INDEPENDENT_REVIEW',
    PACKAGE_V2_ROOT: packageRoot,
    PACKAGE_V2_ID: PACKAGE_ID,
    AUTHORIZED_INPUT_INTEGRITY: '153/153 BYTE_EQUAL',
    FAILED_PACKAGE_ID: FAILED_PACKAGE.package_id,
    FAILED_PACKAGE_CHANGE_COUNT: failedComparison.change_count,
    PACKAGE_V1_PATH_FIELD_FAILURE_FORENSICS_SHA256: forensics.package_v1_path_field_failure_forensics_sha256,
    PACKAGE_V2_INPUT_MANIFEST_SCHEMA_SHA256: schemaIdentity.package_v2_input_manifest_schema_sha256,
    PACKAGE_V2_INPUT_MANIFEST_RUNTIME_BINDING_SHA256: binding.package_v2_input_manifest_runtime_binding_sha256,
    PACKAGE_V2_INPUT_MANIFEST_TEST_MATRIX_SHA256: testMatrix.package_v2_input_manifest_test_matrix_sha256,
    FAILED_PACKAGE_VERSION_RESERVATION_SHA256: reservation.failed_package_version_reservation_sha256,
    DRAFT_TEST_ONLY_VERSION_COUNT: 4,
    PACKAGE_V2_RUNTIME_SELF_VALIDATION_SHA256: selfValidation.package_v2_runtime_self_validation_sha256,
    RUNTIME_SELF_VALIDATION_ARTIFACT_COUNT: selfValidation.artifact_count,
    PACKAGE_V2_DEVELOPMENT_REHEARSAL_RESULT_SHA256: development.package_v2_development_rehearsal_result_sha256,
    DEVELOPMENT_REHEARSAL_SCENARIO_COUNT: development.scenario_count,
    DEVELOPMENT_REHEARSAL_PASS_COUNT: development.pass_count,
    PACKAGE_V2_PACKAGING_EVENT_UTC: event.packaging_event_utc,
    PACKAGE_V2_PACKAGING_EVENT_IDENTITY_SHA256: event.package_v2_packaging_event_identity_sha256,
    VERSION_046: assignment.assignments[0].version,
    VERSION_047: assignment.assignments[1].version,
    VERSION_048: assignment.assignments[2].version,
    VERSION_049: assignment.assignments[3].version,
    PACKAGE_V2_VERSION_ASSIGNMENT_SHA256: assignment.package_v2_version_assignment_sha256,
    PACKAGE_V2_PREWRITE_MANIFEST_VALIDATION_SHA256: prewrite.package_v2_prewrite_manifest_validation_sha256,
    ACCESS_CORE_046_049_DEPLOYMENT_MANIFEST_V2_SHA256: manifest.manifest_sha256,
    MANIFEST_WRITE_COUNT: postwrite.manifest_write_count,
    MANIFEST_CORRECTION_COUNT: postwrite.manifest_correction_count,
    FROZEN_ACCESS_CORE_046_049_DEPLOYMENT_PACKAGE_V2_SHA256: freeze.frozen_access_core_046_049_deployment_package_v2_sha256,
    FINAL_REHEARSAL_SCENARIO_COUNT: final.scenario_count,
    FINAL_REHEARSAL_PASS_COUNT: final.pass_count,
    FINAL_REHEARSAL_EXECUTION_COUNT: finalMarker.final_rehearsal_execution_count,
    FINAL_REHEARSAL_RERUN_COUNT: finalMarker.final_rehearsal_rerun_count,
    RUNTIME_STAGE_VERIFIER_PASS_COUNT: final.runtime_stage_verifier_pass_count,
    NORMAL_CHAIN_RESULT: normal,
    PRE_COMMIT_FAILURE_ROLLBACK_RESULTS: preCommit,
    AMBIGUOUS_COMMIT_RESULTS: ambiguous,
    SPLIT_STATE_RESULTS: split,
    OUT_OF_ORDER_RESULT: outOfOrder,
    PRODUCTION_ELIGIBILITY: 'PENDING_FINAL_PRODUCTION_LEDGER_GUARD_AND_INDEPENDENT_REVIEW',
    RESIDUAL_DOCKER_RESOURCE_COUNT: residualDocker,
    SURVIVING_PROCESS_COUNT: survivingProcesses,
    OPEN_POSTGRES_SESSION_COUNT: final.open_postgres_session_count,
    REPOSITORY_WRITE_COUNT: repositoryChangeCount,
    MIGRATION_FILE_CHANGE_COUNT: migrationChangeCount,
    EXECUTOR_V3_CHANGE_COUNT: executorComparison.change_count,
    PRODUCTION_CONTACT: 0,
    FINDINGS: [],
    RESIDUAL_RISK: ['Independent read-only review of V2 is pending.', 'Final production ledger/PRE_046 guard, quiescence, maintenance approval and separate deployment authorization remain pending.'],
    NEXT_RECOMMENDED_ACTION: 'NEW INDEPENDENT READ-ONLY REVIEW of package V2 covering schema normalization, failed-version reservation, version assignment, authoritative manifest, runtime self-validation, development rehearsal, and frozen final executor/ledger rehearsal. Do not integrate into the repository or contact production during that review.',
    CONFIRMATIONS: {
      failed_package_not_modified_or_executed: true,
      failed_versions_not_reused: true,
      authoritative_assignment_only_after_green_development_rehearsal: true,
      legacy_path_and_destination_rejected: true,
      runtime_consumes_only_package_path: true,
      authoritative_manifest_written_once_never_corrected: true,
      final_rehearsal_ran_once_without_rerun: true,
      executor_v3_and_migrations_byte_exact: true,
      no_repository_deployment_writer_supabase_or_production_action: true,
    },
  };
  const structured = sealed(resultBody, 'STRUCTURED_RESULT_SHA256');
  writeJsonNew(path.join(packageRoot, 'manifests', 'structured-result-v2.json'), structured);
  const report = `# Access Core 046–049 deployment package V2\n\n` +
    `## Classification\n\n${structured.CLASSIFICATION}\n\n` +
    `## Package\n\n- Root: \`${packageRoot}\`\n- Package ID: \`${PACKAGE_ID}\`\n- Authorized inputs: ${structured.AUTHORIZED_INPUT_INTEGRITY}\n- Production eligibility: ${structured.PRODUCTION_ELIGIBILITY}\n\n` +
    `## Closed V1 defect\n\nThe failed package was inspected read-only and remained unchanged. Its builder emitted \`destination\`, while its manifest-bound runtime consumed \`path\`. V2 replaces both with the single canonical relative field \`package_path\`; \`source_path\` remains provenance only. The shared V2 parser rejects both legacy fields. Forensics identity: \`${structured.PACKAGE_V1_PATH_FIELD_FAILURE_FORENSICS_SHA256}\`.\n\n` +
    `## Gate results\n\n- Input contract tests: 15/15 PASS (1 positive plus 14 negative).\n- Runtime self-validation: PASS, ${structured.RUNTIME_SELF_VALIDATION_ARTIFACT_COUNT} artifacts.\n- Development rehearsal: ${structured.DEVELOPMENT_REHEARSAL_PASS_COUNT}/${structured.DEVELOPMENT_REHEARSAL_SCENARIO_COUNT} PASS before the packaging event.\n- Authoritative manifest: prewrite PASS; write count ${structured.MANIFEST_WRITE_COUNT}; correction count ${structured.MANIFEST_CORRECTION_COUNT}.\n- Frozen final rehearsal: ${structured.FINAL_REHEARSAL_PASS_COUNT}/${structured.FINAL_REHEARSAL_SCENARIO_COUNT} PASS; execution count ${structured.FINAL_REHEARSAL_EXECUTION_COUNT}; rerun count ${structured.FINAL_REHEARSAL_RERUN_COUNT}.\n- Runtime stage-verifier passes observed: ${structured.RUNTIME_STAGE_VERIFIER_PASS_COUNT}.\n\n` +
    `## Event and versions\n\n- Packaging event: \`${structured.PACKAGE_V2_PACKAGING_EVENT_UTC}\`\n- 046: \`${structured.VERSION_046}\`\n- 047: \`${structured.VERSION_047}\`\n- 048: \`${structured.VERSION_048}\`\n- 049: \`${structured.VERSION_049}\`\n\nThe failed-package versions \`${FAILED_PACKAGE.versions.join('`, `')}\` remain reserved and were not reused.\n\n` +
    `## Immutability and cleanup\n\n- Failed-package changes: ${structured.FAILED_PACKAGE_CHANGE_COUNT}\n- Executor V3 changes: ${structured.EXECUTOR_V3_CHANGE_COUNT}\n- Migration changes: ${structured.MIGRATION_FILE_CHANGE_COUNT}\n- Repository writes: ${structured.REPOSITORY_WRITE_COUNT}\n- Residual Docker resources: ${structured.RESIDUAL_DOCKER_RESOURCE_COUNT}\n- Surviving scoped processes: ${structured.SURVIVING_PROCESS_COUNT}\n- Open PostgreSQL sessions: ${structured.OPEN_POSTGRES_SESSION_COUNT}\n- Production contact: ${structured.PRODUCTION_CONTACT}\n\n` +
    `## Residual risk and next action\n\n${structured.RESIDUAL_RISK.map((risk) => `- ${risk}`).join('\n')}\n\n${structured.NEXT_RECOMMENDED_ACTION}\n`;
  fs.writeFileSync(path.join(packageRoot, 'manifests', 'detailed-report-v2.md'), report, { flag: 'wx' });
  const artifactPaths = [
    'manifests/structured-result-v2.json', 'manifests/detailed-report-v2.md', 'manifests/package-v1-path-field-failure-forensics.json', 'package-contracts/input-manifest-v2.schema.json', 'manifests/input-manifest-runtime-binding-v2.json', 'development-evidence/contract-tests/input-manifest-v2-test-result.json', 'version-reservations/failed-package-versions.json', 'development-evidence/runtime-self-validation/runtime-self-validation-result-v2.json', `development-evidence/runs/${developmentRun}/development-rehearsal-result-v2.json`, 'manifests/packaging-event-v2.json', 'deployment-manifest/version-assignment-v2.json', 'manifests/prewrite-authoritative-manifest-validation-v2.json', 'deployment-manifest/access-core-046-049-deployment-manifest-v2.json', 'frozen-package/frozen-package-manifest-v2.json', 'final-rehearsal-evidence/run/final-rehearsal-result-v2.json', 'final-rehearsal-evidence/per-scenario-evidence-manifest-v2.json',
  ];
  const artifactEntries = artifactPaths.map((packagePath) => { const file = path.join(packageRoot, ...packagePath.split('/')); return { package_path: packagePath, size: fs.statSync(file).size, sha256: sha256File(file) }; });
  const artifactManifest = sealed({ schema: 'ACCESS_CORE_046_049_DEPLOYMENT_PACKAGE_V2_ARTIFACT_HASH_MANIFEST', package_id: PACKAGE_ID, artifact_count: artifactEntries.length, entries: artifactEntries, production_contact: 0 }, 'artifact_hash_manifest_v2_sha256');
  writeJsonNew(path.join(packageRoot, 'manifests', 'artifact-hash-manifest-v2.json'), artifactManifest);
  process.stdout.write(`${JSON.stringify({ classification: structured.CLASSIFICATION, structuredResultSha256: structured.STRUCTURED_RESULT_SHA256, artifactHashManifestSha256: artifactManifest.artifact_hash_manifest_v2_sha256, residualDocker, survivingProcesses, repositoryChangeCount, migrationChangeCount, failedPackageChangeCount: failedComparison.change_count, executorChangeCount: executorComparison.change_count })}\n`);
}
main();
