'use strict';

const assert = require('assert/strict');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  canonicalHash,
  canonicalJson,
  sealed,
  sha256Bytes,
  sha256File,
  verifySeal,
} = require('./lib/canonical');
const {
  SCHEMA_VERSION,
  RUNTIME_REQUIREMENT,
  sealInputManifest,
  validateInputManifest,
  loadAndValidateInputManifest,
  validatePackagePath,
} = require('./lib/input-manifest-v2');
const definitions = require('./lib/definitions');

const packageRoot = path.resolve(__dirname, '..');
const {
  PACKAGE_ID,
  HOST_PACKAGE_ROOT,
  REPOSITORY_ROOT,
  FAILED_PACKAGE_ROOT,
  EXECUTOR_V3_ROOT,
  EXECUTOR_RELEASE_SOURCE,
  EXECUTOR_REVIEW_ROOT,
  PRIOR_REHEARSAL_ROOT,
  PRIOR_REVIEW_ROOT,
  EXPECTED_EXECUTOR_RELEASE_IDENTITY,
  EXPECTED_EXECUTOR_RELEASE_MANIFEST_SHA256,
  EXPECTED_EXECUTOR_STRUCTURED_RESULT_SHA256,
  EXPECTED_EXECUTOR_REVIEW,
  MIGRATIONS,
  FAILED_PACKAGE,
  PREDECESSOR,
} = definitions;

function fail(code, detail = '') { throw new Error(`${code}${detail ? `: ${detail}` : ''}`); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function ensureParent(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function writeBytesNew(file, bytes) {
  if (fs.existsSync(file)) fail('DRAFT_OUTPUT_ALREADY_EXISTS', relative(file));
  ensureParent(file);
  fs.writeFileSync(file, bytes, { flag: 'wx' });
}
function writeJsonNew(file, value) { writeBytesNew(file, Buffer.from(canonicalJson(value), 'utf8')); }
function relative(file) { return path.relative(packageRoot, file).split(path.sep).join('/'); }
function walkFiles(root) {
  const rows = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) rows.push(...walkFiles(full));
    else if (entry.isFile()) rows.push(full);
  }
  return rows;
}
function treeInventory(root) {
  const entries = walkFiles(root).map((file) => ({
    package_path: path.relative(root, file).split(path.sep).join('/'),
    size: fs.statSync(file).size,
    sha256: sha256File(file),
  }));
  return { entries, file_count: entries.length, total_size: entries.reduce((sum, row) => sum + row.size, 0), inventory_sha256: canonicalHash(entries) };
}
function command(args) {
  return childProcess.execFileSync(args[0], args.slice(1), { encoding: 'utf8', windowsHide: true }).trim();
}
function assertIdentity(file, size, digest, code) {
  if (!fs.existsSync(file)) fail(`${code}_MISSING`, file);
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size !== size || sha256File(file) !== digest) fail(`${code}_MISMATCH`, file);
}
function assertNoAuthoritativeState() {
  const forbidden = [
    'manifests/packaging-event-v2.json',
    'deployment-manifest/version-assignment-v2.json',
    'deployment-manifest/access-core-046-049-deployment-manifest-v2.json',
    'frozen-package/frozen-package-manifest-v2.json',
    'final-rehearsal-evidence/final-execution-authority.json',
  ];
  for (const item of forbidden) if (fs.existsSync(path.join(packageRoot, ...item.split('/')))) fail('PREMATURE_AUTHORITATIVE_STATE', item);
}
function verifyRepository() {
  const evidence = {
    root: command(['git', '-C', REPOSITORY_ROOT, 'rev-parse', '--show-toplevel']).replaceAll('\\', '/'),
    branch: command(['git', '-C', REPOSITORY_ROOT, 'branch', '--show-current']),
    head: command(['git', '-C', REPOSITORY_ROOT, 'rev-parse', 'HEAD']),
    tracked_status: command(['git', '-C', REPOSITORY_ROOT, 'status', '--porcelain=v1', '--untracked-files=no']),
    baseline_status_including_untracked: command(['git', '-C', REPOSITORY_ROOT, 'status', '--porcelain=v1', '--untracked-files=all']),
    staged_status: command(['git', '-C', REPOSITORY_ROOT, 'diff', '--cached', '--name-status']),
  };
  assert.equal(evidence.root.toLowerCase(), REPOSITORY_ROOT.replaceAll('\\', '/').toLowerCase(), 'REPOSITORY_ROOT_MISMATCH');
  assert.equal(evidence.branch, 'main', 'REPOSITORY_BRANCH_MISMATCH');
  assert.equal(evidence.head, '715ad1cea644e45d688dca785de09c83e1956413', 'REPOSITORY_HEAD_MISMATCH');
  assert.equal(evidence.tracked_status, '', 'REPOSITORY_TRACKED_WORKTREE_NOT_CLEAN');
  assert.equal(evidence.staged_status, '', 'REPOSITORY_STAGING_NOT_CLEAN');
  for (const migration of MIGRATIONS) {
    assertIdentity(path.join(REPOSITORY_ROOT, 'infra', 'sql', 'migrations', migration.filename), migration.size, migration.sha256, `MIGRATION_${migration.logical}`);
  }
  return evidence;
}
function verifyFailedPackageForensics() {
  const findingPath = path.join(FAILED_PACKAGE_ROOT, 'manifests', 'post-manifest-validation-finding.json');
  const hashManifestPath = path.join(FAILED_PACKAGE_ROOT, 'manifests', 'artifact-hash-manifest.json');
  assert.equal(sha256File(findingPath), 'b8792a38ec0b2a2a94fb83c1ace056a7f2fdccf2da1781ee20fed68c1432b2f3');
  assert.equal(sha256File(hashManifestPath), 'dae0fbdd1ab42e1c6a4c80cfc3deaf594c4a4107d5421f952044df58a9d21386');
  const finding = readJson(findingPath);
  const hashManifest = readJson(hashManifestPath);
  verifySeal(finding, 'finding_evidence_sha256', 'FAILED_FINDING_IDENTITY_MISMATCH');
  verifySeal(hashManifest, 'artifact_hash_manifest_sha256', 'FAILED_ARTIFACT_MANIFEST_IDENTITY_MISMATCH');
  assert.equal(finding.finding_evidence_sha256, 'bd284d48f00c7e56290431ed883b2115aae094e1173eb7ef9aadb097e641ea8f');
  assert.equal(finding.finding_id, 'MANIFEST_BOUND_RUNTIME_INPUT_DESCRIPTOR_MISMATCH');
  assert.equal(finding.discovered_phase, 'POST_MANIFEST_PRE_FREEZE_SELF_VALIDATION');
  assert.equal(finding.manifest_write_count, 1);
  assert.equal(finding.manifest_correction_count, 0);
  assert.equal(finding.docker_started, false);
  assert.equal(finding.final_rehearsal_started, false);
  assert.equal(finding.production_contact, 0);
  for (const entry of hashManifest.entries) assertIdentity(path.join(FAILED_PACKAGE_ROOT, ...entry.path.split('/')), entry.size, entry.sha256, 'FAILED_HASH_MANIFEST_ENTRY');

  const structured = readJson(path.join(FAILED_PACKAGE_ROOT, 'manifests', 'structured-result.json'));
  assert.equal(structured.CLASSIFICATION, FAILED_PACKAGE.classification);
  assert.equal(structured.PACKAGE_ID, FAILED_PACKAGE.package_id);
  const event = readJson(path.join(FAILED_PACKAGE_ROOT, 'manifests', 'packaging-event.json'));
  const assignment = readJson(path.join(FAILED_PACKAGE_ROOT, 'deployment-manifest', 'version-assignment.json'));
  const failedEventBody = { ...event }; delete failedEventBody.packaging_event_identity_sha256;
  const failedAssignmentBody = { ...assignment }; delete failedAssignmentBody.access_core_046_049_version_assignment_sha256;
  assert.equal(sha256Bytes(Buffer.from(JSON.stringify(failedEventBody), 'utf8')), event.packaging_event_identity_sha256, 'FAILED_EVENT_IDENTITY_MISMATCH');
  assert.equal(sha256Bytes(Buffer.from(JSON.stringify(failedAssignmentBody), 'utf8')), assignment.access_core_046_049_version_assignment_sha256, 'FAILED_ASSIGNMENT_IDENTITY_MISMATCH');
  assert.equal(event.packaging_event_identity_sha256, FAILED_PACKAGE.identities.packaging_event);
  assert.equal(event.packaging_event_utc, FAILED_PACKAGE.packaging_event_utc);
  assert.equal(assignment.access_core_046_049_version_assignment_sha256, FAILED_PACKAGE.identities.version_assignment);
  assert.deepEqual(assignment.assignments.map((row) => row.version), FAILED_PACKAGE.versions);

  const inputPath = path.join(FAILED_PACKAGE_ROOT, 'manifests', 'package-input-manifest.json');
  const input = readJson(inputPath);
  verifySeal(input, 'deployment_package_input_manifest_sha256', 'FAILED_INPUT_MANIFEST_IDENTITY_MISMATCH');
  assert.equal(input.deployment_package_input_manifest_sha256, FAILED_PACKAGE.identities.input_manifest);
  assert.equal(input.imported_file_count, 153);
  assert.equal(input.byte_equal_count, 153);
  assert.equal(input.mismatch_count, 0);
  assert(input.entries.every((entry) => Object.prototype.hasOwnProperty.call(entry, 'destination')));
  assert(input.entries.every((entry) => !Object.prototype.hasOwnProperty.call(entry, 'path')));
  assert(input.entries.every((entry) => !Object.prototype.hasOwnProperty.call(entry, 'package_path')));

  const runtimePath = path.join(FAILED_PACKAGE_ROOT, 'rehearsal-source', 'package-runtime.js');
  const builderPath = path.join(FAILED_PACKAGE_ROOT, 'rehearsal-source', 'build-package.js');
  const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
  const builderSource = fs.readFileSync(builderPath, 'utf8');
  assert(runtimeSource.includes('normalized(descriptor.path)'));
  assert(!runtimeSource.includes('descriptor.package_path'));
  assert(builderSource.includes('destination: relative(destination)'));
  assert.equal(sha256File(runtimePath), '2c5bf695f90cb1230210e3c0a68852069c5d971f9596fcd0eaa3aa6ad3113b38');
  assert.equal(sha256File(builderPath), '2a2aecbfeee9e7ba6d3fd191de02d31f2ffeaa064bad32cedff8af9bddded207');

  const deployment = readJson(path.join(FAILED_PACKAGE_ROOT, 'deployment-manifest', 'access-core-046-049-deployment-manifest.json'));
  verifySeal(deployment, 'manifest_sha256', 'FAILED_DEPLOYMENT_MANIFEST_IDENTITY_MISMATCH');
  assert.equal(deployment.manifest_sha256, FAILED_PACKAGE.identities.deployment_manifest);
  const runtimeBinding = deployment.rehearsal_runtime.source_identities.find((row) => row.path === 'rehearsal-source/package-runtime.js');
  assert(runtimeBinding);
  assert.equal(runtimeBinding.sha256, sha256File(runtimePath));

  const baseline = treeInventory(FAILED_PACKAGE_ROOT);
  const baselineBody = {
    schema: 'ACCESS_CORE_FAILED_PACKAGE_IMMUTABILITY_BASELINE_V2',
    failed_package_root: FAILED_PACKAGE_ROOT,
    package_id: FAILED_PACKAGE.package_id,
    classification: FAILED_PACKAGE.classification,
    file_count: baseline.file_count,
    total_size: baseline.total_size,
    entries: baseline.entries,
    inventory_sha256: baseline.inventory_sha256,
  };
  writeJsonNew(path.join(packageRoot, 'manifests', 'failed-package-immutability-baseline.json'), sealed(baselineBody, 'baseline_evidence_sha256'));

  const forensicsBody = {
    schema: 'ACCESS_CORE_PACKAGE_V1_PATH_FIELD_FAILURE_FORENSICS_V2',
    root_cause: 'INPUT_MANIFEST_RUNTIME_SCHEMA_MISMATCH',
    failed_package_id: FAILED_PACKAGE.package_id,
    failed_package_root: FAILED_PACKAGE_ROOT,
    failed_package_classification: FAILED_PACKAGE.classification,
    authoritative_manifest_sha256: deployment.manifest_sha256,
    input_manifest_identity_sha256: input.deployment_package_input_manifest_sha256,
    input_manifest_file_sha256: sha256File(inputPath),
    imported_artifact_count: input.entries.length,
    builder_output_property: 'destination',
    runtime_expected_property: 'path',
    v2_canonical_property: 'package_path',
    exact_failed_record: input.entries[0],
    builder_source: { package_path: 'rehearsal-source/build-package.js', size: fs.statSync(builderPath).size, sha256: sha256File(builderPath), expression: 'destination: relative(destination)' },
    runtime_source: { package_path: 'rehearsal-source/package-runtime.js', size: fs.statSync(runtimePath).size, sha256: sha256File(runtimePath), accessor: 'normalized(descriptor.path)', finding_source_location: finding.source_location },
    validation_order: [
      'authoritative manifest and sealed package manifests loaded',
      'frozen executor release identity verified',
      'input-manifest equality counters verified',
      'each imported record passed to fileIdentity',
      'fileIdentity attempted descriptor.path before Docker orchestration',
    ],
    static_checks_miss_reason: 'The builder proved source/destination byte equality and emitted destination, while no pre-authoritative contract test invoked the runtime fileIdentity accessor against an emitted record.',
    runtime_self_validation_detection: 'The first imported-record runtime resolution evaluated undefined descriptor.path and failed closed before freeze.',
    docker_not_reached_reason: 'Runtime self-validation was a mandatory pre-Docker gate and the finding prohibited continuation.',
    bound_runtime_correction_reason: 'The one-write authoritative manifest already bound the runtime source hash; changing the accessor would invalidate that manifest identity.',
    finding_file_sha256: sha256File(findingPath),
    finding_identity_sha256: finding.finding_evidence_sha256,
    artifact_hash_manifest_file_sha256: sha256File(hashManifestPath),
    artifact_hash_manifest_identity_sha256: hashManifest.artifact_hash_manifest_sha256,
    failed_package_inventory_sha256: baseline.inventory_sha256,
    failed_package_executed: false,
    failed_package_modified: false,
    production_contact: 0,
  };
  const forensics = sealed(forensicsBody, 'package_v1_path_field_failure_forensics_sha256');
  writeJsonNew(path.join(packageRoot, 'manifests', 'package-v1-path-field-failure-forensics.json'), forensics);
  return { baseline, forensics };
}

const importedRecords = [];
function copyImported(source, packagePath, authorityClassification, runtimeUse) {
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) fail('APPROVED_SOURCE_MISSING', source);
  const destination = validatePackagePath(packageRoot, packagePath);
  if (fs.existsSync(destination)) fail('PACKAGE_IMPORT_TARGET_EXISTS', packagePath);
  ensureParent(destination);
  fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
  const sourceStat = fs.statSync(source);
  const destinationStat = fs.statSync(destination);
  const sourceHash = sha256File(source);
  assert.equal(destinationStat.size, sourceStat.size, `IMPORT_SIZE_MISMATCH ${packagePath}`);
  assert.equal(sha256File(destination), sourceHash, `IMPORT_HASH_MISMATCH ${packagePath}`);
  const executable = ['.js', '.ps1', '.sh'].includes(path.extname(source).toLowerCase());
  importedRecords.push({
    artifact_id: `artifact-${sha256Bytes(Buffer.from(packagePath, 'utf8')).slice(0, 24)}`,
    source_path: path.resolve(source),
    package_path: packagePath,
    size: destinationStat.size,
    sha256: sourceHash,
    authority_classification: authorityClassification,
    runtime_use: runtimeUse,
    executable,
    required_at_runtime: RUNTIME_REQUIREMENT[runtimeUse],
  });
}
function importApprovedInputs() {
  for (const source of walkFiles(EXECUTOR_RELEASE_SOURCE)) {
    const rel = path.relative(EXECUTOR_RELEASE_SOURCE, source).split(path.sep).join('/');
    copyImported(source, `executor-release/release/${rel}`, 'FROZEN_EXECUTOR_V3', 'PACKAGE_EXECUTOR_AUTHORITY');
  }
  for (const migration of MIGRATIONS) {
    copyImported(path.join(REPOSITORY_ROOT, 'infra', 'sql', 'migrations', migration.filename), `canonical-migrations/${migration.filename}`, 'CANONICAL_REPOSITORY_MIGRATION', 'DEPLOYMENT_PAYLOAD_SOURCE');
  }
  copyImported(path.join(PRIOR_REHEARSAL_ROOT, 'frozen', 'bundle', 'preflight', 'Q046-PF-01.sql'), 'preflight/Q046-PF-01.sql', 'INDEPENDENTLY_APPROVED_FINAL_PREFLIGHT', 'REQUIRED_DURING_FINAL_QUIESCED_WINDOW');
  copyImported(path.join(PRIOR_REHEARSAL_ROOT, 'frozen', 'bundle', 'contracts', 'aggregate-preflight-equivalence-v2.json'), 'preflight/aggregate-preflight-equivalence-v2.json', 'APPROVED_PREFLIGHT_EQUIVALENCE', 'PROVENANCE');
  for (const name of Object.keys(EXPECTED_EXECUTOR_REVIEW)) {
    copyImported(path.join(EXECUTOR_REVIEW_ROOT, name), `manifests/executor-v3-independent-review/${name}`, 'INDEPENDENT_EXECUTOR_V3_REVIEW', 'EXECUTOR_ELIGIBILITY');
  }
  for (const name of ['independent-review-result.json', 'independent-review-report.md', 'independent-evidence-manifest.json', 'independent-artifact-hash-manifest.json']) {
    copyImported(path.join(PRIOR_REVIEW_ROOT, name), `manifests/ledger-neutral-rehearsal-v2-review/${name}`, 'INDEPENDENT_LEDGER_NEUTRAL_REHEARSAL_REVIEW', 'REHEARSAL_PROVENANCE');
  }
  const predecessorRoot = path.join(EXECUTOR_RELEASE_SOURCE, 'fixtures', 'approved-predecessor');
  for (const source of walkFiles(predecessorRoot)) {
    copyImported(source, `development-rehearsal/fixtures/approved-predecessor/${path.basename(source)}`, 'APPROVED_SLICE_SPECIFIC_PREDECESSOR', 'LOCAL_REHEARSAL_FIXTURE');
  }
  copyImported(path.join(EXECUTOR_RELEASE_SOURCE, 'fixtures', 'integration', 'independent-stage-contract.json'), 'package-contracts/independent-stage-contract.json', 'INDEPENDENT_STAGE_CONTRACT', 'STAGE_VERIFICATION');
  copyImported(path.join(EXECUTOR_V3_ROOT, 'final-evidence', 'structured-result.json'), 'manifests/executor-v3-structured-result.json', 'EXECUTOR_V3_FINAL_RESULT', 'EXECUTOR_PROVENANCE');
  assert.equal(importedRecords.length, 153, 'AUTHORIZED_INPUT_COUNT_MISMATCH');
}

function loadV3() {
  const releaseRoot = path.join(packageRoot, 'executor-release', 'release');
  const sourceRoot = path.join(releaseRoot, 'editable-source', 'src');
  return {
    releaseRoot,
    validateCanonicalBytes: require(path.join(sourceRoot, 'envelope', 'validator')).validateCanonicalBytes,
    verifyFrozenRelease: require(path.join(sourceRoot, 'identity', 'release')).verifyFrozenRelease,
    CATALOG_FINGERPRINT_SQL: require(path.join(sourceRoot, 'verifiers', 'material')).CATALOG_FINGERPRINT_SQL,
  };
}
function descriptorFor(packagePath) {
  const file = validatePackagePath(packageRoot, packagePath);
  return { package_path: packagePath, size: fs.statSync(file).size, sha256: sha256File(file) };
}
function buildDerivedArtifacts(v3) {
  const releaseManifestPath = path.join(v3.releaseRoot, 'frozen-release-manifest.json');
  assert.equal(sha256File(releaseManifestPath), EXPECTED_EXECUTOR_RELEASE_MANIFEST_SHA256);
  const releaseManifest = readJson(releaseManifestPath);
  assert.equal(releaseManifest.releaseSha256, EXPECTED_EXECUTOR_RELEASE_IDENTITY);
  const releaseEvidence = v3.verifyFrozenRelease(v3.releaseRoot, releaseManifest);
  assert.equal(releaseEvidence.verifiedFileCount, 108);
  assert.equal(walkFiles(v3.releaseRoot).length, 131);
  assert.equal(sha256File(path.join(packageRoot, 'manifests', 'executor-v3-structured-result.json')), EXPECTED_EXECUTOR_STRUCTURED_RESULT_SHA256);
  const independent = readJson(path.join(packageRoot, 'manifests', 'executor-v3-independent-review', 'independent-structured-result.json'));
  assert.equal(independent.CLASSIFICATION, 'INDEPENDENT_STATEMENT_AWARE_ATOMIC_MIGRATION_EXECUTOR_V3_PASSED');
  assert.equal(independent.HIGH_FINDING_COUNT, 0);
  assert.equal(independent.MEDIUM_FINDING_COUNT, 0);
  assert.equal(independent.LOW_FINDING_COUNT, 0);
  for (const [name, digest] of Object.entries(EXPECTED_EXECUTOR_REVIEW)) assert.equal(sha256File(path.join(packageRoot, 'manifests', 'executor-v3-independent-review', name)), digest);

  const authorized = readJson(path.join(v3.releaseRoot, 'manifests', 'authorized-input-integrity.json'));
  const parsed = [];
  for (let migrationIndex = 0; migrationIndex < MIGRATIONS.length; migrationIndex += 1) {
    const migration = MIGRATIONS[migrationIndex];
    const canonicalPath = path.join(packageRoot, 'canonical-migrations', migration.filename);
    const validated = v3.validateCanonicalBytes(fs.readFileSync(canonicalPath), migration);
    assert.equal(validated.payload.length, migration.payloadSize);
    assert.equal(sha256Bytes(validated.payload), migration.payloadSha256);
    const statements = validated.parsed.statements.map((row, index) => {
      const bytes = Buffer.from(row.statement);
      const separator = Buffer.from(row.separator);
      const text = bytes.toString('utf8');
      assert(Buffer.from(text, 'utf8').equals(bytes), `NON_UTF8_STATEMENT ${migration.logical}/${index}`);
      return { ordinal: index, bytes, separator, text, size: bytes.length, sha256: sha256Bytes(bytes), separator_size: separator.length, separator_sha256: sha256Bytes(separator) };
    });
    const trailing = Buffer.from(validated.parsed.trailingSeparator);
    const reconstructed = Buffer.concat(statements.flatMap((row) => [row.separator, row.bytes]).concat([trailing]));
    assert(reconstructed.equals(validated.payload));
    assert(validated.parsed.reconstructed.equals(validated.payload));
    const approved = authorized.intermediatePayloads[migrationIndex];
    assert.equal(approved.size, migration.payloadSize);
    assert.equal(approved.sha256, migration.payloadSha256);
    assert.equal(approved.orderedStatementIdentities.length, statements.length);
    for (let index = 0; index < statements.length; index += 1) {
      assert.equal(statements[index].size, approved.orderedStatementIdentities[index].size);
      assert.equal(statements[index].sha256, approved.orderedStatementIdentities[index].sha256);
    }
    writeBytesNew(path.join(packageRoot, 'intermediate-payloads', `${migration.logical}.payload.sql`), Buffer.from(validated.payload));
    for (const statement of statements) {
      const stem = String(statement.ordinal).padStart(4, '0');
      writeBytesNew(path.join(packageRoot, 'intermediate-payloads', migration.logical, 'statements', `${stem}.sql`), statement.bytes);
      writeBytesNew(path.join(packageRoot, 'intermediate-payloads', migration.logical, 'separators', `${stem}.separator.bin`), statement.separator);
    }
    writeBytesNew(path.join(packageRoot, 'intermediate-payloads', migration.logical, 'separators', 'trailing.separator.bin'), trailing);
    parsed.push({ migration, statements, trailing });
  }

  const statementBody = {
    schema: 'ACCESS_CORE_046_049_STATEMENT_MANIFEST_V2',
    executor_parser_sha256: sha256File(path.join(v3.releaseRoot, 'editable-source', 'src', 'parser', 'statementScanner.js')),
    envelope_validator_sha256: sha256File(path.join(v3.releaseRoot, 'editable-source', 'src', 'envelope', 'validator.js')),
    migrations: parsed.map(({ migration, statements, trailing }) => ({
      logical_migration: migration.logical,
      name: migration.name,
      canonical: descriptorFor(`canonical-migrations/${migration.filename}`),
      payload: descriptorFor(`intermediate-payloads/${migration.logical}.payload.sql`),
      statement_count: statements.length,
      reconstructed_payload_byte_equal: true,
      ordered_statement_identities: statements.map((row) => ({
        ordinal: row.ordinal,
        size: row.size,
        sha256: row.sha256,
        package_path: `intermediate-payloads/${migration.logical}/statements/${String(row.ordinal).padStart(4, '0')}.sql`,
        separator: { package_path: `intermediate-payloads/${migration.logical}/separators/${String(row.ordinal).padStart(4, '0')}.separator.bin`, size: row.separator_size, sha256: row.separator_sha256 },
      })),
      trailing_separator: { package_path: `intermediate-payloads/${migration.logical}/separators/trailing.separator.bin`, size: trailing.length, sha256: sha256Bytes(trailing) },
      statements_text_array: statements.map((row) => row.text),
    })),
    reconstruction_pass_count: 4,
    reconstruction_fail_count: 0,
  };
  const statementManifest = sealed(statementBody, 'statement_manifest_sha256');
  writeJsonNew(path.join(packageRoot, 'manifests', 'statement-manifest-v2.json'), statementManifest);

  const sourceSnapshotSql = `jsonb_build_object(
  'access_orders', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.access_orders x),'[]'::jsonb),
  'payment_attempts', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.payment_attempts x),'[]'::jsonb),
  'access_ticket_types', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.access_ticket_types x),'[]'::jsonb),
  'access_order_items', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.access_order_items x),'[]'::jsonb),
  'access_entries', coalesce((select jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text) from public.access_entries x),'[]'::jsonb)
)`;
  const ledgerSql = `coalesce((select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements',to_jsonb(statements)) order by version) from supabase_migrations.schema_migrations),'[]'::jsonb)`;
  const preSql = `-- ACCESS CORE PRE_046 READ-ONLY VERIFIER V2
SELECT jsonb_build_object(
  'stage','PRE_046','transaction_read_only',current_setting('transaction_read_only'),'server_version',current_setting('server_version'),'database',current_database(),
  'ledger',${ledgerSql},
  'fulfillment_table',to_regclass('public.access_order_fulfillments') is not null,
  'delivery_attempt_table',to_regclass('public.access_email_delivery_attempts') is not null,
  'marker_column',exists(select 1 from information_schema.columns where table_schema='public' and table_name='access_order_fulfillments' and column_name='email_preclaim_terminal_request_hash'),
  'source_relation_oids',(select jsonb_object_agg(c.relname,c.oid::text order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('access_orders','payment_attempts','access_ticket_types','access_order_items','access_entries')),
  'source_data',${sourceSnapshotSql}
)::text AS verifier_snapshot;
`;
  const snapshotSql = (stage, phase) => `SELECT jsonb_build_object(
  'stage','${stage}','phase','${phase}','transaction_read_only',current_setting('transaction_read_only'),'server_version',current_setting('server_version'),'database',current_database(),
  'ledger',${ledgerSql},
  'source_relation_oids',(select jsonb_object_agg(c.relname,c.oid::text order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('access_orders','payment_attempts','access_ticket_types','access_order_items','access_entries')),
  'source_data',${sourceSnapshotSql},
  'fulfillment_count',(select count(*) from public.access_order_fulfillments),
  'delivery_attempt_count',(select count(*) from public.access_email_delivery_attempts),
  'eligible_order_count',(select count(*) from public.access_orders o where o.status='paid' and exists(select 1 from public.payment_attempts pa where pa.order_id=o.id and pa.status='approved')),
  'orphan_fulfillment_count',(select count(*) from public.access_order_fulfillments f left join public.access_orders o on o.id=f.order_id where o.id is null),
  'eligible_without_fulfillment_count',(select count(*) from public.access_orders o where o.status='paid' and exists(select 1 from public.payment_attempts pa where pa.order_id=o.id and pa.status='approved') and not exists(select 1 from public.access_order_fulfillments f where f.order_id=o.id)),
  'fulfillment_without_eligible_count',(select count(*) from public.access_order_fulfillments f where not exists(select 1 from public.access_orders o where o.id=f.order_id and o.status='paid' and exists(select 1 from public.payment_attempts pa where pa.order_id=o.id and pa.status='approved')))
)::text AS verifier_snapshot;
`;
  const verifierRows = [];
  const addVerifier = (packagePath, text, stage, phase) => {
    writeBytesNew(path.join(packageRoot, ...packagePath.split('/')), Buffer.from(text, 'utf8'));
    verifierRows.push({ stage, phase, ...descriptorFor(packagePath) });
  };
  addVerifier('stage-verifiers/PRE_046.post-commit.sql', preSql, 'PRE_046', 'post-commit-read-only');
  for (const stage of ['POST_046', 'POST_047', 'POST_048', 'POST_049']) {
    addVerifier(`stage-verifiers/${stage}.in-transaction.sql`, `-- ACCESS CORE ${stage} IN-TRANSACTION VERIFIER V2\n${v3.CATALOG_FINGERPRINT_SQL.trim()}\n${snapshotSql(stage, 'in-transaction')}`, stage, 'in-transaction');
    addVerifier(`stage-verifiers/${stage}.post-commit.sql`, `-- ACCESS CORE ${stage} POST-COMMIT READ-ONLY VERIFIER V2\n${snapshotSql(stage, 'post-commit')}`, stage, 'post-commit-read-only');
  }
  let forbidden = 0;
  for (const descriptor of verifierRows) {
    const sql = fs.readFileSync(path.join(packageRoot, ...descriptor.package_path.split('/')), 'utf8').replace(/--[^\r\n]*/g, ' ').replace(/'(?:(?:'')|[^'])*'/g, ' ');
    forbidden += (sql.match(/\b(?:begin|commit|rollback|insert|update|delete|alter|create|drop|truncate|grant|revoke|copy|call)\b/gi) || []).length;
  }
  assert.equal(verifierRows.length, 9);
  assert.equal(forbidden, 0);
  const verifierBody = {
    schema: 'ACCESS_CORE_046_049_STAGE_VERIFIER_MANIFEST_V2',
    files: verifierRows,
    executor_v3_verifier_identities: {
      material: sha256File(path.join(v3.releaseRoot, 'editable-source', 'src', 'verifiers', 'material.js')),
      in_transaction: sha256File(path.join(v3.releaseRoot, 'editable-source', 'src', 'verifiers', 'in-transaction.js')),
      post_commit: sha256File(path.join(v3.releaseRoot, 'editable-source', 'src', 'verifiers', 'post-commit.js')),
      frozen_stage_contract: sha256File(path.join(packageRoot, 'package-contracts', 'independent-stage-contract.json')),
    },
    static_validation: { file_count: 9, forbidden_write_or_transaction_control_count: 0, pass: true },
    enforcement: 'Runtime executes every stage verifier and independently compares exact ledger arrays, material state, source bytes and source relation identities.',
    production_use_constraint: 'Local synthetic fingerprints are rehearsal-only; production remains pending an exact final ledger and PRE_046 guard.',
  };
  const verifierManifest = sealed(verifierBody, 'stage_verifier_manifest_sha256');
  writeJsonNew(path.join(packageRoot, 'manifests', 'stage-verifier-manifest-v2.json'), verifierManifest);
  return { parsed, statementManifest, verifierManifest, releaseEvidence };
}

function buildContractsAndDraft(inputManifest, derived, repositoryEvidence) {
  const schemaPath = path.join(packageRoot, 'package-contracts', 'input-manifest-v2.schema.json');
  JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const schemaSha256 = sha256File(schemaPath);
  const reservationBody = {
    schema: 'ACCESS_CORE_FAILED_PACKAGE_VERSION_RESERVATION_V2',
    failed_package_id: FAILED_PACKAGE.package_id,
    failed_package_event_utc: FAILED_PACKAGE.packaging_event_utc,
    reservations: MIGRATIONS.map((migration, index) => ({ logical_migration: migration.logical, version: FAILED_PACKAGE.versions[index], statuses: ['RESERVED_BY_FAILED_PACKAGE', 'NOT_DEPLOYABLE'] })),
    maximum_reserved_version: FAILED_PACKAGE.versions.at(-1),
    replacement_allocator_rule: 'ALL_LISTED_VERSIONS_ARE_UNAVAILABLE',
    production_contact: 0,
  };
  const reservation = sealed(reservationBody, 'failed_package_version_reservation_sha256');
  writeJsonNew(path.join(packageRoot, 'version-reservations', 'failed-package-versions.json'), reservation);

  const eligibilityBody = {
    schema: 'ACCESS_CORE_DEPLOYMENT_PACKAGE_ELIGIBILITY_POLICY_V2',
    package_authority_after_authoritative_write: 'AUTHORITATIVE_LOCAL_DEPLOYMENT_CANDIDATE',
    draft_authority: 'DRAFT_NON_DEPLOYABLE',
    production_eligibility: 'PENDING_FINAL_PRODUCTION_LEDGER_GUARD',
    input_manifest_schema: 'ACCESS_CORE_PACKAGE_INPUT_MANIFEST_V2',
    authoritative_write_prerequisites: ['RUNTIME_SELF_VALIDATION_PASS', 'DEVELOPMENT_REHEARSAL_19_OF_19_PASS'],
    invalidated_by: ['input manifest schema or parser change', 'canonical migration identity change', 'intermediate payload identity change', 'executor frozen identity change', 'verifier identity change', 'deployment manifest change', 'version/name pair change', 'stage order change', 'target identity change', 'predecessor ledger mismatch', 'assigned version collision', 'unexpected later Access Core migration', 'production structural state not exact PRE_046'],
    invalidated_package_action: 'DO_NOT_EDIT_OR_RENUMBER; CREATE_A_NEW_PACKAGE_IDENTITY',
    production_ready_without_guard: false,
    production_contact: 0,
  };
  const eligibility = sealed(eligibilityBody, 'eligibility_policy_sha256');
  writeJsonNew(path.join(packageRoot, 'package-contracts', 'eligibility-policy-v2.json'), eligibility);

  const recoveryBody = {
    schema: 'ACCESS_CORE_DEPLOYMENT_RECOVERY_POLICY_V2',
    classifications: ['ALREADY_APPLIED_VERIFIED', 'NOT_APPLIED_VERIFIED', 'AMBIGUOUS_COMMIT_RESOLVED_AS_COMMITTED', 'AMBIGUOUS_COMMIT_RESOLVED_AS_ROLLED_BACK', 'HARD_STOP_SPLIT_STATE', 'HARD_STOP_INCOMPATIBLE_STATE'],
    split_state_automatic_repair: false,
    ledger_only_reconciliation: false,
    ordinary_retry: false,
    ambiguous_commit_requires_independent_read: true,
  };
  const recovery = sealed(recoveryBody, 'recovery_policy_sha256');
  writeJsonNew(path.join(packageRoot, 'package-contracts', 'recovery-policy-v2.json'), recovery);
  const stageOrder = sealed({ schema: 'ACCESS_CORE_STAGE_ORDER_V2', stages: MIGRATIONS.map((row) => ({ logical_migration: row.logical, pre_stage: row.preStage, in_transaction_post_stage: row.postStage, post_commit_stage: row.postStage })), execution_order: ['PRE_046', 'V046', 'POST_046', 'V047', 'POST_047', 'V048', 'POST_048', 'V049', 'POST_049'], one_transaction_per_migration: true, post_commit_read_only_connection: true }, 'stage_order_sha256');
  writeJsonNew(path.join(packageRoot, 'package-contracts', 'stage-order-v2.json'), stageOrder);
  const predecessorPolicy = sealed({ schema: 'ACCESS_CORE_PREDECESSOR_LEDGER_POLICY_V2', version: PREDECESSOR.version, name: PREDECESSOR.name, production_statements_authority: 'CAPTURE_AND_PRESERVE_EXACT_AT_FINAL_PRODUCTION_LEDGER_GUARD', local_fixture_statements: PREDECESSOR.localStatements, local_fixture_is_not_production_evidence: true, candidate_versions_required_absent: ['046', '047', '048', '049'], unexpected_later_access_core_migration_policy: 'HARD_STOP' }, 'predecessor_policy_sha256');
  writeJsonNew(path.join(packageRoot, 'package-contracts', 'predecessor-ledger-policy-v2.json'), predecessorPolicy);

  const preflightPath = path.join(packageRoot, 'preflight', 'Q046-PF-01.sql');
  assertIdentity(preflightPath, 13861, '336db9f7cb0d88a422aff34f9e1358c893a3c992dfa200217edb346372639571', 'PREFLIGHT');
  const preflight = sealed({ schema: 'ACCESS_CORE_046_FINAL_PREFLIGHT_BINDING_V2', package_path: 'preflight/Q046-PF-01.sql', size: 13861, sha256: '336db9f7cb0d88a422aff34f9e1358c893a3c992dfa200217edb346372639571', execution_requirement: 'REQUIRED_DURING_FINAL_QUIESCED_WINDOW', executed_in_this_local_checkpoint: false, required_true_fields: ['sql_numeric_and_cast_safety_pass', 'catalog_promised_row_invariants_pass', 'migration_supported_projection_pass', 'clean_operational_handoff_pass'] }, 'final_preflight_binding_sha256');
  writeJsonNew(path.join(packageRoot, 'manifests', 'final-preflight-binding-v2.json'), preflight);

  const consumerNames = ['build-draft.js', 'contract-tests.js', 'package-runtime.js', 'self-validate.js', 'rehearsal-suite.js', 'authoritative-finalize.js', 'freeze-package.js', 'finalize-report.js', 'run-rehearsal.ps1'];
  const consumers = consumerNames.map((name) => {
    const file = path.join(packageRoot, 'editable-source', name);
    if (!fs.existsSync(file)) fail('RUNTIME_CONSUMER_SOURCE_MISSING', name);
    return { component: name, package_path: `editable-source/${name}`, size: fs.statSync(file).size, sha256: sha256File(file), schema_version: SCHEMA_VERSION, manifest_parser: 'editable-source/lib/input-manifest-v2.js' };
  });
  const bindingBody = {
    schema: 'ACCESS_CORE_PACKAGE_INPUT_MANIFEST_RUNTIME_BINDING_V2',
    manifest_schema: 'ACCESS_CORE_PACKAGE_INPUT_MANIFEST_V2',
    schema_version: SCHEMA_VERSION,
    schema_file: { package_path: 'package-contracts/input-manifest-v2.schema.json', size: fs.statSync(schemaPath).size, sha256: schemaSha256 },
    shared_parser: descriptorFor('editable-source/lib/input-manifest-v2.js'),
    canonical_package_field: 'package_path',
    original_authority_field: 'source_path',
    runtime_resolution_field: 'package_path',
    rejected_legacy_fields: ['path', 'destination'],
    consumers,
  };
  const binding = sealed(bindingBody, 'package_v2_input_manifest_runtime_binding_sha256');
  writeJsonNew(path.join(packageRoot, 'manifests', 'input-manifest-runtime-binding-v2.json'), binding);
  const schemaIdentity = sealed({ schema: 'ACCESS_CORE_PACKAGE_INPUT_MANIFEST_SCHEMA_IDENTITY_V2', schema_name: 'ACCESS_CORE_PACKAGE_INPUT_MANIFEST_V2', schema_version: 2, schema_file_sha256: schemaSha256, parser_sha256: binding.shared_parser.sha256, legacy_path_rejected: true, legacy_destination_rejected: true, runtime_field: 'package_path' }, 'package_v2_input_manifest_schema_sha256');
  writeJsonNew(path.join(packageRoot, 'manifests', 'input-manifest-schema-identity-v2.json'), schemaIdentity);

  const migrations = derived.statementManifest.migrations.map((statement, index) => ({
    logical_migration: statement.logical_migration,
    version: MIGRATIONS[index].testVersion,
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
  const draftBody = {
    schema: 'ACCESS_CORE_046_049_DRAFT_DEPLOYMENT_DESCRIPTOR_V2',
    descriptor_version: 2,
    package_id: PACKAGE_ID,
    package_classification: 'DRAFT_NON_DEPLOYABLE',
    production_eligibility: 'NOT_ELIGIBLE_DRAFT',
    authoritative_packaging_event_captured: false,
    real_candidate_versions_assigned: false,
    target: { project_identity: 'LOCAL_DISPOSABLE_POSTGRESQL_17_6_ONLY', database_identity: 'DYNAMIC_DISPOSABLE_DATABASE', direct_port: 5432, production_contact: 0 },
    predecessor_fixture: { version: PREDECESSOR.version, name: PREDECESSOR.name, statements: PREDECESSOR.localStatements },
    migrations,
    executor: { frozen_release_identity: EXPECTED_EXECUTOR_RELEASE_IDENTITY, frozen_release_manifest_sha256: EXPECTED_EXECUTOR_RELEASE_MANIFEST_SHA256, package_path: 'executor-release/release' },
    artifact_identities: { input_manifest_sha256: inputManifest.input_manifest_sha256, input_manifest_schema_sha256: schemaIdentity.package_v2_input_manifest_schema_sha256, input_manifest_runtime_binding_sha256: binding.package_v2_input_manifest_runtime_binding_sha256, statement_manifest_sha256: derived.statementManifest.statement_manifest_sha256, stage_verifier_manifest_sha256: derived.verifierManifest.stage_verifier_manifest_sha256, final_preflight_binding_sha256: preflight.final_preflight_binding_sha256, eligibility_policy_sha256: eligibility.eligibility_policy_sha256, recovery_policy_sha256: recovery.recovery_policy_sha256, stage_order_sha256: stageOrder.stage_order_sha256, predecessor_policy_sha256: predecessorPolicy.predecessor_policy_sha256, failed_version_reservation_sha256: reservation.failed_package_version_reservation_sha256 },
    runtime_source_identities: consumers,
    timeout_lock_policy: { statement_timeout_ms: 120000, lock_timeout_ms: 5000, idle_in_transaction_timeout_ms: 180000 },
    test_only_version_count: 4,
    production_contact: 0,
  };
  const draft = sealed(draftBody, 'draft_descriptor_sha256');
  writeJsonNew(path.join(packageRoot, 'draft-package', 'draft-deployment-descriptor-v2.json'), draft);

  const ledgerFixture = `\\set ON_ERROR_STOP on\n\nCREATE SCHEMA supabase_migrations;\n\nCREATE TABLE supabase_migrations.schema_migrations (\n  version text NOT NULL PRIMARY KEY,\n  name text,\n  statements text[]\n);\n\nINSERT INTO supabase_migrations.schema_migrations(version, name, statements)\nVALUES ('${PREDECESSOR.version}','${PREDECESSOR.name}',ARRAY['${PREDECESSOR.localStatements[0]}']::text[]);\n`;
  writeBytesNew(path.join(packageRoot, 'development-rehearsal', 'fixtures', 'ledger-fixture.sql'), Buffer.from(ledgerFixture, 'utf8'));

  const reservationInventory = sealed({ schema: 'ACCESS_CORE_LOCAL_VERSION_RESERVATION_INVENTORY_V2', discovered_assignment_files: [{ source_path: path.join(FAILED_PACKAGE_ROOT, 'deployment-manifest', 'version-assignment.json'), package_id: FAILED_PACKAGE.package_id, versions: FAILED_PACKAGE.versions, status: 'RESERVED_BY_FAILED_PACKAGE' }], predecessor_version: PREDECESSOR.version, maximum_unavailable_version: FAILED_PACKAGE.versions.at(-1), reservation_record_sha256: reservation.failed_package_version_reservation_sha256, production_contact: 0 }, 'reservation_inventory_sha256');
  writeJsonNew(path.join(packageRoot, 'version-reservations', 'reservation-inventory-v2.json'), reservationInventory);
  const sourceIntegrity = sealed({ schema: 'ACCESS_CORE_V2_AUTHORIZED_INPUT_INTEGRITY', package_id: PACKAGE_ID, imported_artifact_count: inputManifest.artifact_count, byte_equal_count: inputManifest.artifact_count, mismatch_count: 0, repository: repositoryEvidence, executor_release_identity: EXPECTED_EXECUTOR_RELEASE_IDENTITY, input_manifest_sha256: inputManifest.input_manifest_sha256, production_contact: 0 }, 'authorized_input_integrity_sha256');
  writeJsonNew(path.join(packageRoot, 'manifests', 'authorized-input-integrity-v2.json'), sourceIntegrity);
  return { reservation, eligibility, recovery, stageOrder, predecessorPolicy, preflight, binding, schemaIdentity, draft, reservationInventory, sourceIntegrity };
}

function main() {
  assert.equal(packageRoot.toLowerCase(), HOST_PACKAGE_ROOT.toLowerCase(), 'PACKAGE_ROOT_MISMATCH');
  const bootstrap = readJson(path.join(packageRoot, 'manifests', 'draft-bootstrap.json'));
  assert.equal(bootstrap.package_id, PACKAGE_ID);
  assert.equal(bootstrap.package_classification, 'DRAFT_NON_DEPLOYABLE');
  assertNoAuthoritativeState();
  const repositoryEvidence = verifyRepository();
  const failed = verifyFailedPackageForensics();
  importApprovedInputs();
  const inputBody = {
    schema: 'ACCESS_CORE_PACKAGE_INPUT_MANIFEST_V2',
    schema_version: 2,
    package_id: PACKAGE_ID,
    records: importedRecords.sort((a, b) => a.package_path.localeCompare(b.package_path)),
    artifact_count: importedRecords.length,
    runtime_required_count: importedRecords.filter((row) => row.required_at_runtime).length,
    source_authority_count: new Set(importedRecords.map((row) => row.source_path)).size,
    production_contact: 0,
  };
  const inputManifest = sealInputManifest(inputBody);
  const inputPath = path.join(packageRoot, 'manifests', 'package-input-manifest-v2.json');
  validateInputManifest(inputManifest, { packageRoot, consumerSchemaVersion: 2, verifyFiles: true });
  writeJsonNew(inputPath, inputManifest);
  const loadedInput = loadAndValidateInputManifest(inputPath, { packageRoot, consumerSchemaVersion: 2, verifyFiles: true });
  assert.equal(loadedInput.artifact_count, 153);
  const v3 = loadV3();
  const derived = buildDerivedArtifacts(v3);
  const contracts = buildContractsAndDraft(inputManifest, derived, repositoryEvidence);
  const resultBody = {
    schema: 'ACCESS_CORE_046_049_DRAFT_PACKAGE_BUILD_RESULT_V2',
    package_id: PACKAGE_ID,
    package_classification: 'DRAFT_NON_DEPLOYABLE',
    authoritative_packaging_event_status: 'NOT_CAPTURED',
    real_version_assignment_status: 'NOT_ASSIGNED',
    authoritative_manifest_status: 'NOT_WRITTEN',
    failed_package_root_cause: failed.forensics.root_cause,
    authorized_input_integrity: 'PASS 153/153 BYTE_EQUAL',
    imported_artifact_count: inputManifest.artifact_count,
    runtime_required_artifact_count: inputManifest.runtime_required_count,
    canonical_migration_count: 4,
    intermediate_payload_count: 4,
    statement_counts: derived.statementManifest.migrations.map((row) => row.statement_count),
    static_stage_verifier_count: derived.verifierManifest.files.length,
    test_only_version_count: 4,
    identities: {
      failed_package_forensics: failed.forensics.package_v1_path_field_failure_forensics_sha256,
      input_manifest: inputManifest.input_manifest_sha256,
      input_manifest_schema: contracts.schemaIdentity.package_v2_input_manifest_schema_sha256,
      input_manifest_runtime_binding: contracts.binding.package_v2_input_manifest_runtime_binding_sha256,
      failed_version_reservation: contracts.reservation.failed_package_version_reservation_sha256,
      statement_manifest: derived.statementManifest.statement_manifest_sha256,
      stage_verifier_manifest: derived.verifierManifest.stage_verifier_manifest_sha256,
      final_preflight_binding: contracts.preflight.final_preflight_binding_sha256,
      draft_descriptor: contracts.draft.draft_descriptor_sha256,
    },
    repository_write_count: 0,
    production_contact: 0,
  };
  const result = sealed(resultBody, 'draft_package_build_result_sha256');
  writeJsonNew(path.join(packageRoot, 'development-evidence', 'draft-package-build-result-v2.json'), result);
  process.stdout.write(`${JSON.stringify({ packageId: PACKAGE_ID, importedArtifactCount: inputManifest.artifact_count, runtimeRequiredCount: inputManifest.runtime_required_count, statementCounts: result.statement_counts, verifierCount: result.static_stage_verifier_count, resultSha256: result.draft_package_build_result_sha256 })}\n`);
}

main();
