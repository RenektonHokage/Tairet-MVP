'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { canonicalJson, sealed, verifySeal } = require('./lib/canonical');
const {
  PACKAGE_ID,
  HOST_PACKAGE_ROOT,
  FAILED_PACKAGE_ROOT,
  FAILED_PACKAGE,
  PREDECESSOR,
  MIGRATIONS,
  EXPECTED_EXECUTOR_RELEASE_IDENTITY,
  EXPECTED_EXECUTOR_RELEASE_MANIFEST_SHA256,
} = require('./lib/definitions');
const { loadRuntime, validateAuthoritativeCandidateBytes } = require('./package-runtime');

const packageRoot = path.resolve(__dirname, '..');
const tairetRoot = path.dirname(packageRoot);
function fail(code, detail = '') { throw new Error(`${code}${detail ? `: ${detail}` : ''}`); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJsonNew(file, value) {
  if (fs.existsSync(file)) fail('SINGLE_ASSIGNMENT_TARGET_EXISTS', file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, canonicalJson(value), { flag: 'wx' });
}
function atomicWriteOnce(file, bytes, operation) {
  if (fs.existsSync(file)) fail(`${operation}_TARGET_EXISTS`, file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  if (fs.existsSync(temp)) fail(`${operation}_TEMP_EXISTS`);
  fs.writeFileSync(temp, bytes, { flag: 'wx' });
  try { fs.renameSync(temp, file); }
  catch (error) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch { /* preserve original failure */ }
    throw error;
  }
  return { operation, final_path: file, atomic_rename: true, authoritative_path_create_count: 1, correction_count: 0 };
}
function walkFiles(root) {
  const rows = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) rows.push(...walkFiles(full));
    else if (entry.isFile()) rows.push(full);
  }
  return rows;
}
function parseVersion(value) {
  if (!/^\d{14}$/.test(value)) fail('INVALID_FOURTEEN_DIGIT_VERSION', value);
  const parts = [value.slice(0, 4), value.slice(4, 6), value.slice(6, 8), value.slice(8, 10), value.slice(10, 12), value.slice(12, 14)].map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]));
  const roundTrip = date.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  if (roundTrip !== value) fail('INVALID_UTC_VERSION', value);
  return date;
}
function formatVersion(date) { return date.toISOString().replace(/[-:T]/g, '').slice(0, 14); }
function successor(value) { return formatVersion(new Date(parseVersion(value).getTime() + 1000)); }
function discoverAssignments() {
  const candidates = [];
  const relativeCandidates = ['deployment-manifest/version-assignment.json', 'deployment-manifest/version-assignment-v2.json', 'version-reservations/failed-package-versions.json'];
  for (const entry of fs.readdirSync(tairetRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const candidateRoot = path.join(tairetRoot, entry.name);
    if (candidateRoot.toLowerCase() === packageRoot.toLowerCase()) continue;
    for (const relativePath of relativeCandidates) {
      const file = path.join(candidateRoot, ...relativePath.split('/'));
      if (fs.existsSync(file) && fs.statSync(file).isFile()) candidates.push(file);
    }
  }
  const rows = [];
  for (const file of candidates) {
    const value = readJson(file);
    const sourceRows = Array.isArray(value.assignments) ? value.assignments : Array.isArray(value.reservations) ? value.reservations : [];
    const versions = sourceRows.map((row) => row.version).filter((version) => /^\d{14}$/.test(version));
    if (versions.length) rows.push({ source_path: file, package_id: value.package_id || value.failed_package_id || null, versions: [...new Set(versions)].sort() });
  }
  return rows.sort((a, b) => a.source_path.localeCompare(b.source_path));
}
function findGreenDevelopmentRun(expectedDescriptorSha256) {
  const root = path.join(packageRoot, 'development-evidence', 'runs');
  const green = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const runRoot = path.join(root, entry.name);
    const resultPath = path.join(runRoot, 'development-rehearsal-result-v2.json');
    const orchestrationPath = path.join(runRoot, 'orchestration-result.json');
    if (!fs.existsSync(resultPath) || !fs.existsSync(orchestrationPath)) continue;
    const result = readJson(resultPath);
    const orchestration = readJson(orchestrationPath);
    try { verifySeal(result, 'package_v2_development_rehearsal_result_sha256', 'DEVELOPMENT_RESULT_IDENTITY_MISMATCH'); }
    catch { continue; }
    if (result.package_descriptor_sha256 === expectedDescriptorSha256 && result.scenario_count === 19 && result.pass_count === 19 && result.fail_count === 0 && result.open_postgres_session_count === 0 && result.disposable_database_residual_count === 0 && result.runtime_stage_verifier_pass_count > 0 && orchestration.suite_exit_code === 0 && orchestration.cleanup?.residual_resource_count === 0 && orchestration.repository_write_count === 0 && orchestration.migration_file_change_count === 0 && orchestration.surviving_process_count === 0 && orchestration.production_contact === 0 && orchestration.external_network_contact === 0 && orchestration.pull_performed === 0 && orchestration.error === null) {
      green.push({ run_id: entry.name, resultPath, orchestrationPath, result, orchestration });
    }
  }
  if (green.length !== 1) fail('EXACTLY_ONE_GREEN_DEVELOPMENT_REHEARSAL_REQUIRED', String(green.length));
  return green[0];
}
function main() {
  assert.equal(packageRoot.toLowerCase(), HOST_PACKAGE_ROOT.toLowerCase(), 'PACKAGE_ROOT_MISMATCH');
  const eventPath = path.join(packageRoot, 'manifests', 'packaging-event-v2.json');
  const assignmentPath = path.join(packageRoot, 'deployment-manifest', 'version-assignment-v2.json');
  const manifestPath = path.join(packageRoot, 'deployment-manifest', 'access-core-046-049-deployment-manifest-v2.json');
  for (const file of [eventPath, assignmentPath, manifestPath]) if (fs.existsSync(file)) fail('AUTHORITATIVE_STATE_ALREADY_EXISTS', file);
  const contract = readJson(path.join(packageRoot, 'development-evidence', 'contract-tests', 'input-manifest-v2-test-result.json'));
  const selfValidation = readJson(path.join(packageRoot, 'development-evidence', 'runtime-self-validation', 'runtime-self-validation-result-v2.json'));
  verifySeal(contract, 'package_v2_input_manifest_test_matrix_sha256', 'CONTRACT_TEST_IDENTITY_MISMATCH');
  verifySeal(selfValidation, 'package_v2_runtime_self_validation_sha256', 'SELF_VALIDATION_IDENTITY_MISMATCH');
  if (contract.pass_count !== 15 || contract.fail_count !== 0 || selfValidation.runtime_self_validation !== 'PASS' || selfValidation.artifact_count !== 153) fail('DEVELOPMENT_STATIC_GATES_NOT_GREEN');
  const runtime = loadRuntime(packageRoot, 'DRAFT');
  const development = findGreenDevelopmentRun(runtime.executionDescriptor.draft_descriptor_sha256);
  if (!runtime.selfValidation.pass || runtime.selfValidation.artifact_count !== 153) fail('RUNTIME_REVALIDATION_NOT_GREEN');

  const eventDate = new Date(Math.floor(Date.now() / 1000) * 1000);
  const eventUtc = eventDate.toISOString().replace('.000Z', 'Z');
  const eventVersion = formatVersion(eventDate);
  const discovered = discoverAssignments();
  const knownVersions = new Set([PREDECESSOR.version, ...FAILED_PACKAGE.versions]);
  for (const row of discovered) for (const version of row.versions) knownVersions.add(version);
  const allocatorCandidates = [eventVersion, successor(PREDECESSOR.version), successor(FAILED_PACKAGE.versions.at(-1)), ...[...knownVersions].map(successor)];
  const t0 = allocatorCandidates.sort().at(-1);
  if (t0 !== eventVersion) fail('PACKAGING_EVENT_NOT_MAXIMUM_ALLOCATOR_INPUT', `${eventVersion} < ${t0}`);

  const eventBody = {
    schema: 'ACCESS_CORE_046_049_PACKAGING_EVENT_V2',
    package_id: PACKAGE_ID,
    packaging_event_utc: eventUtc,
    fourteen_digit_form: eventVersion,
    captured_after: {
      contract_tests_sha256: contract.package_v2_input_manifest_test_matrix_sha256,
      runtime_self_validation_sha256: selfValidation.package_v2_runtime_self_validation_sha256,
      development_rehearsal_sha256: development.result.package_v2_development_rehearsal_result_sha256,
      development_rehearsal_status: 'PASS_19_OF_19',
    },
    failed_package_event_reused: false,
    event_capture_count: 1,
    write_count: 1,
    production_contact: 0,
  };
  const packagingEvent = sealed(eventBody, 'package_v2_packaging_event_identity_sha256');
  const eventWrite = atomicWriteOnce(eventPath, Buffer.from(canonicalJson(packagingEvent), 'utf8'), 'PACKAGING_EVENT');

  const assignments = MIGRATIONS.map((migration, index) => ({ logical_migration: migration.logical, version: formatVersion(new Date(parseVersion(t0).getTime() + index * 1000)), name: migration.name }));
  assert.equal(new Set(assignments.map((row) => row.version)).size, 4);
  assert(assignments.every((row) => !FAILED_PACKAGE.versions.includes(row.version)));
  const assignmentBody = {
    schema: 'ACCESS_CORE_046_049_VERSION_ASSIGNMENT_V2',
    package_id: PACKAGE_ID,
    packaging_event_identity_sha256: packagingEvent.package_v2_packaging_event_identity_sha256,
    t0: t0,
    allocator_inputs: {
      packaging_event_utc_form: eventVersion,
      successor_of_predecessor: successor(PREDECESSOR.version),
      successor_of_failed_package_maximum: successor(FAILED_PACKAGE.versions.at(-1)),
      other_authorized_local_assignments: discovered,
      known_unavailable_versions: [...knownVersions].sort(),
    },
    assignments,
    failed_package_versions_reused: false,
    strict_increase: true,
    write_count: 1,
    renumber_count: 0,
    production_contact: 0,
  };
  const versionAssignment = sealed(assignmentBody, 'package_v2_version_assignment_sha256');
  const assignmentWrite = atomicWriteOnce(assignmentPath, Buffer.from(canonicalJson(versionAssignment), 'utf8'), 'VERSION_ASSIGNMENT');
  const allocationEvidence = sealed({ schema: 'ACCESS_CORE_046_049_VERSION_ALLOCATION_EVIDENCE_V2', package_id: PACKAGE_ID, packaging_event_utc: eventUtc, t0, candidate_inputs: allocatorCandidates.sort(), discovered_assignments: discovered, failed_package_versions: FAILED_PACKAGE.versions, assignments, event_write: eventWrite, assignment_write: assignmentWrite, production_contact: 0 }, 'allocation_evidence_sha256');
  writeJsonNew(path.join(packageRoot, 'version-reservations', 'authoritative-allocation-evidence-v2.json'), allocationEvidence);

  const migrations = runtime.statementManifest.migrations.map((statement, index) => ({
    logical_migration: statement.logical_migration,
    version: assignments[index].version,
    name: statement.name,
    canonical_size: statement.canonical.size,
    canonical_sha256: statement.canonical.sha256,
    payload_size: statement.payload.size,
    payload_sha256: statement.payload.sha256,
    statement_count: statement.statement_count,
    ordered_statement_identities: statement.ordered_statement_identities.map(({ ordinal, size, sha256 }) => ({ ordinal, size, sha256 })),
    statements_text_array: statement.statements_text_array,
    pre_stage: MIGRATIONS[index].preStage,
    post_stage: MIGRATIONS[index].postStage,
  }));
  const manifestBody = {
    schema: 'ACCESS_CORE_046_049_DEPLOYMENT_MANIFEST_V2',
    manifest_version: 2,
    package_id: PACKAGE_ID,
    package_authority: 'AUTHORITATIVE_LOCAL_DEPLOYMENT_CANDIDATE',
    production_eligibility: 'PENDING_FINAL_PRODUCTION_LEDGER_GUARD',
    packaging_event: { utc: eventUtc, fourteen_digit_form: eventVersion, identity_sha256: packagingEvent.package_v2_packaging_event_identity_sha256 },
    version_assignment_sha256: versionAssignment.package_v2_version_assignment_sha256,
    target: { supabase_project_id: 'omteyctmrgahavgfaodw', database: 'postgres', direct_port: 5432, production_contact_in_this_checkpoint: 0 },
    expected_predecessor: { version: PREDECESSOR.version, name: PREDECESSOR.name, statements_policy: 'CAPTURE_AND_PRESERVE_EXACT_AT_FINAL_PRODUCTION_LEDGER_GUARD', candidate_versions_absent: 'REQUIRED', no_unexpected_later_access_core_migration: 'REQUIRED', production_guard_status: 'PENDING' },
    migrations,
    executor: { frozen_release_identity: EXPECTED_EXECUTOR_RELEASE_IDENTITY, frozen_release_manifest_sha256: EXPECTED_EXECUTOR_RELEASE_MANIFEST_SHA256, package_path: 'executor-release/release', runtime_source_policy: 'PACKAGE_CONTAINED_FROZEN_RELEASE_ONLY' },
    artifact_identities: runtime.executionDescriptor.artifact_identities,
    runtime_source_identities: runtime.executionDescriptor.runtime_source_identities,
    development_gates: { contract_tests: 'PASS_15_OF_15', contract_tests_sha256: contract.package_v2_input_manifest_test_matrix_sha256, runtime_self_validation: 'PASS', runtime_self_validation_sha256: selfValidation.package_v2_runtime_self_validation_sha256, development_rehearsal: 'PASS_19_OF_19', development_rehearsal_sha256: development.result.package_v2_development_rehearsal_result_sha256, development_run_id: development.run_id },
    timeout_lock_policy: runtime.executionDescriptor.timeout_lock_policy,
    recovery_policy: runtime.recovery,
    stage_order: runtime.stageOrder.stages,
    reservation_inventory_sha256: allocationEvidence.allocation_evidence_sha256,
    final_rehearsal_policy: { frozen_package_only: true, scenario_count: 12, execution_count: 1, rerun_count: 0 },
    writer_quiescence_prerequisite: 'REQUIRED_SEPARATE_AUTHORIZATION',
    maintenance_window_prerequisite: 'REQUIRED_NOT_GRANTED',
    final_production_preflight_prerequisite: 'REQUIRED_DURING_FINAL_QUIESCED_WINDOW',
    manifest_write_count: 1,
    manifest_correction_count: 0,
    repository_write_count: 0,
    production_contact: 0,
  };
  const manifest = sealed(manifestBody, 'manifest_sha256');
  const manifestBytes = Buffer.from(canonicalJson(manifest), 'utf8');
  const candidatePath = path.join(packageRoot, 'temporary', 'NON_AUTHORITATIVE-prewrite-deployment-manifest-candidate-v2.json');
  writeJsonNew(candidatePath, manifest);
  const prewriteValidation = validateAuthoritativeCandidateBytes(runtime, manifestBytes, { packagingEvent, versionAssignment });
  if (!prewriteValidation.pass) fail('PREWRITE_AUTHORITATIVE_MANIFEST_VALIDATION_FAILED');
  const prewriteResult = sealed({ schema: 'ACCESS_CORE_046_049_PREWRITE_AUTHORITATIVE_MANIFEST_VALIDATION_V2', package_id: PACKAGE_ID, candidate_classification: 'NON_AUTHORITATIVE_TEMPORARY_ARTIFACT', candidate_path: path.relative(packageRoot, candidatePath).split(path.sep).join('/'), candidate_manifest_sha256: manifest.manifest_sha256, exact_candidate_byte_length: manifestBytes.length, validation: 'PASS', runtime_source: 'editable-source/package-runtime.js', input_manifest_schema: runtime.inputManifest.schema, event_identity_sha256: packagingEvent.package_v2_packaging_event_identity_sha256, version_assignment_sha256: versionAssignment.package_v2_version_assignment_sha256, production_contact: 0 }, 'package_v2_prewrite_manifest_validation_sha256');
  writeJsonNew(path.join(packageRoot, 'manifests', 'prewrite-authoritative-manifest-validation-v2.json'), prewriteResult);

  const manifestWrite = atomicWriteOnce(manifestPath, manifestBytes, 'AUTHORITATIVE_DEPLOYMENT_MANIFEST');
  const writtenBytes = fs.readFileSync(manifestPath);
  if (!writtenBytes.equals(manifestBytes)) fail('AUTHORITATIVE_MANIFEST_POSTWRITE_BYTE_MISMATCH');
  const postwriteValidation = validateAuthoritativeCandidateBytes(runtime, writtenBytes, { packagingEvent, versionAssignment });
  if (!postwriteValidation.pass) fail('AUTHORITATIVE_MANIFEST_POSTWRITE_VALIDATION_FAILED');
  const postwriteResult = sealed({ schema: 'ACCESS_CORE_046_049_POSTWRITE_AUTHORITATIVE_MANIFEST_VALIDATION_V2', package_id: PACKAGE_ID, authoritative_manifest_sha256: manifest.manifest_sha256, exact_byte_equal_to_prewrite_candidate: true, validation: 'PASS', manifest_write_count: manifestWrite.authoritative_path_create_count, manifest_correction_count: 0, event_write_count: eventWrite.authoritative_path_create_count, version_assignment_write_count: assignmentWrite.authoritative_path_create_count, production_contact: 0 }, 'postwrite_manifest_validation_sha256');
  writeJsonNew(path.join(packageRoot, 'manifests', 'postwrite-authoritative-manifest-validation-v2.json'), postwriteResult);
  process.stdout.write(`${JSON.stringify({ packagingEventUtc: eventUtc, packagingEventSha256: packagingEvent.package_v2_packaging_event_identity_sha256, versions: assignments.map((row) => row.version), versionAssignmentSha256: versionAssignment.package_v2_version_assignment_sha256, prewriteValidationSha256: prewriteResult.package_v2_prewrite_manifest_validation_sha256, manifestSha256: manifest.manifest_sha256, manifestWriteCount: 1, manifestCorrectionCount: 0 })}\n`);
}

main();
