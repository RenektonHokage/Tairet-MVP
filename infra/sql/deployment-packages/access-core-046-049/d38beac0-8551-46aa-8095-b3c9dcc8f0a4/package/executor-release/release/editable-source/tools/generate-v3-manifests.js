'use strict';

const fs = require('fs');
const path = require('path');
const { canonicalHash, canonicalJson, sha256File } = require('../src/result/suite-result');

const root = path.resolve(__dirname, '..', '..');
const v2Root = path.resolve(process.env.V2_EXECUTOR_ROOT || 'C:\\Users\\mateo\\AppData\\Local\\Tairet\\statement-aware-atomic-migration-executor-v2-b4aad405');
const v2Release = path.join(v2Root, 'frozen-release', 'release');
const manifestRoot = path.join(root, 'manifests');
function write(name, value) { fs.writeFileSync(path.join(manifestRoot, name), canonicalJson(value), 'utf8'); }
function artifact(relative) { const target = path.join(root, ...relative.split('/')); return { path: relative, size: fs.statSync(target).size, sha256: sha256File(target) }; }
function listFiles(directory, relativeBase = root) { const rows = []; function visit(current) { for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) { const full = path.join(current, entry.name); if (entry.isDirectory()) visit(full); else if (entry.isFile()) rows.push({ path: path.relative(relativeBase, full).split(path.sep).join('/'), size: fs.statSync(full).size, sha256: sha256File(full) }); else throw new Error(`UNSUPPORTED_ENTRY: ${full}`); } } visit(directory); return rows; }

const requiredFields = ['schema','suite_id','suite_version','final_run_id','frozen_release_identity','execution_attempt','start_sequence','end_sequence','status','exit_code','test_count','pass_count','fail_count','skipped_count','raw_stdout_path','raw_stdout_sha256','raw_stderr_path','raw_stderr_sha256','suite_evidence_paths','suite_evidence_hashes','result_created_at','result_sha256'];
write('suite-result-protocol.json', {
  schema: 'tairet-executor-v3-suite-result-protocol-v1', protocol: 'EXECUTOR_SUITE_RESULT_V1', requiredFields,
  allowedStatuses: ['PASS','FAIL','UNRESOLVED'], requiredSuites: ['STATIC','PARSER','RECOVERY','ATOMICITY','SEMANTIC_MUTATION','CLEANUP'],
  transport: { logsAreEvidenceOnly: true, resultIsExactlyOneJsonObject: true, explicitAbsoluteResultPath: true, atomicTemporaryThenRename: true, resultPathMustBeAbsent: true, suiteAndRunPathBinding: true, readOnlyAfterSeal: true },
  rejections: ['ARRAY','SCALAR','MULTIPLE_OBJECTS','DUPLICATE_KEYS','UNKNOWN_SCHEMA','UNKNOWN_SUITE','MISSING_FIELD','WRONG_RUN','WRONG_RELEASE','WRONG_ATTEMPT','STALE_RESULT','CREATED_BEFORE_START','POST_SEAL_REWRITE','STATUS_EXIT_CONTRADICTION','COUNT_CONTRADICTION','LOG_HASH_MISMATCH','EVIDENCE_HASH_MISMATCH'],
  artifacts: [artifact('editable-source/src/result/suite-result.js'),artifact('editable-source/src/result/suite-result.schema.json')],
});
write('result-channel-implementation.json', {
  schema: 'tairet-executor-v3-result-channel-implementation-v1', stdoutRole: 'RAW_LOG_EVIDENCE_ONLY', stderrRole: 'RAW_LOG_EVIDENCE_ONLY', finalizerParsesLogs: false,
  suiteContract: 'PowerShell redirects adapter stdout/stderr to dedicated files; the Node adapter closes both descriptors, hashes the sealed files, and atomically renames exactly one explicit result object.',
  artifacts: [artifact('editable-source/tests/suite-adapter-v3.js'),artifact('editable-source/tools/suite-wrapper-v3.ps1'),artifact('editable-source/src/result/suite-result.js')],
});
write('suite-wrapper-evidence-spec.json', {
  schema: 'tairet-executor-v3-suite-wrapper-evidence-spec-v1', wrapperSchema: 'EXECUTOR_SUITE_WRAPPER_EVIDENCE_V1',
  fields: ['executable','argv','cwd','environment_identity','process_id','process_start_time_utc','process_exit_code','start_sequence','end_sequence','raw_stdout_path','raw_stdout_sha256','raw_stderr_path','raw_stderr_sha256','expected_result_file_path','result_file_exists','result_file_sha256','timeout_seconds','timed_out','cancelled','pass_synthesized'],
  invalidResultPolicy: { validFailResult: 'FAIL', missingOrUnparseableResult: 'UNRESOLVED_WRAPPER_EVIDENCE', synthesizePass: false },
  artifacts: [artifact('editable-source/tools/suite-wrapper-v3.ps1'),artifact('editable-source/tools/validate-suite-result.js')],
});
write('finalizer-implementation.json', {
  schema: 'tairet-executor-v3-finalizer-implementation-v1', inputCardinality: 6, inputMode: 'EXPLICIT_ABSOLUTE_FILE_PATHS_ONLY', directoryInputPermitted: false, pipelineObjectInputPermitted: false,
  verifications: ['schema','suite_id','run_binding','release_binding','attempt_binding','status_exit_agreement','counts','raw_log_hashes','suite_evidence_hashes','uniqueness','cardinality','sequence_order','wrapper_process_exit','post_seal_identity','global_gates','cleanup'],
  artifacts: [artifact('editable-source/src/result/finalizer.js'),artifact('editable-source/tools/finalize-evidence.js')],
});
const positive = [
  { id:'P001',case:'many stdout log lines and one valid result file' },{ id:'P002',case:'stderr logs and one valid result file' },
  { id:'P003',case:'all six suites PASS' },{ id:'P004',case:'finalizer emits READY candidate result' },
];
const negative = [
  {id:'N001',case:'old V2 mixed stdout array'},{id:'N002',case:'JSON array result'},{id:'N003',case:'two result objects'},
  {id:'N004',case:'missing result file'},{id:'N005',case:'malformed JSON'},{id:'N006',case:'stale preexisting file'},
  {id:'N007',case:'wrong suite ID'},{id:'N008',case:'wrong run ID'},{id:'N009',case:'wrong release ID'},
  {id:'N010',case:'duplicate suite result'},{id:'N011',case:'missing suite result'},{id:'N012',case:'PASS plus exit 1'},
  {id:'N013',case:'FAIL plus exit 0 with contradictory wrapper evidence'},{id:'N014',case:'wrong test counts'},
  {id:'N015',case:'raw-log hash mismatch'},{id:'N016',case:'result evidence hash mismatch'},{id:'N017',case:'result rewritten after seal'},
  {id:'N018',case:'result from another final attempt'},{id:'N019',case:'finalizer directory input'},
];
write('orchestration-acceptance-matrix.json', { schema:'tairet-executor-v3-orchestration-acceptance-matrix-v1', testCount:positive.length+negative.length, positive, negative, requiredOutcome:'ALL_PASS', artifact:artifact('editable-source/tests/orchestration-acceptance-suite.js') });
write('suite-isolation-spec.json', { schema:'tairet-executor-v3-suite-isolation-spec-v1', independentOrder:['STATIC','PARSER','RECOVERY','ATOMICITY','SEMANTIC_MUTATION','CLEANUP'], localFailurePolicy:{writeValidFailOrUnresolvedWhenPossible:true,neverInterpretAsPass:true,continueIndependentSafeSuites:true,globalReady:false}, globalIdentityFailurePolicy:'STOP_BEFORE_EXECUTION_MARKER', atomicityIndependentOfMutation:true, artifact:artifact('editable-source/tools/run-executor-v3.ps1') });
write('path-authority-spec.json', { schema:'tairet-path-authority-spec-v3', authorities:{FROZEN_RELEASE_ROOT:{access:'READ_ONLY',location:'V3_ROOT/frozen-release/release'},FINAL_OUTPUT_ROOT:{access:'WRITABLE',location:'V3_ROOT/final-run/output'},MUTATION_WORK_ROOT:{access:'WRITABLE',location:'FINAL_OUTPUT_ROOT/mutation-workspaces',isolation:'ONE_CHILD_PER_MUTANT'},POSTGRES_WORK_ROOT:{access:'WRITABLE',location:'FINAL_OUTPUT_ROOT/postgres-work'}}, forbidden:['REPOSITORY','V1_ROOT','V2_ROOT','C_TMP','FROZEN_RELEASE'], failClosed:true });

const v2Manifest = JSON.parse(fs.readFileSync(path.join(v2Release, 'frozen-release-manifest.json'), 'utf8'));
const modifiedProtocol = new Set([
  'editable-source/package.json','editable-source/tools/build-development.js','editable-source/tools/preflight-final-environment.js',
  'editable-source/tools/freeze-release.js','editable-source/tools/run-development-suite.ps1','editable-source/tools/run-final-suite.ps1',
  'editable-source/tools/finalize-evidence.js',
]);
const modifiedTests = new Set([]);
const rows = [];
for (const entry of v2Manifest.entries) {
  const target = path.join(root, ...entry.path.split('/'));
  let classification;
  if (!fs.existsSync(target)) classification = 'REJECTED';
  else if (sha256File(target) === entry.sha256 && fs.statSync(target).size === entry.size) classification = 'BYTE_EXACT_REUSE';
  else if (modifiedProtocol.has(entry.path)) classification = 'MODIFIED_FOR_RESULT_PROTOCOL';
  else if (modifiedTests.has(entry.path)) classification = 'MODIFIED_FOR_TESTS';
  else throw new Error(`UNCLASSIFIED_V2_TO_V3_CHANGE: ${entry.path}`);
  rows.push({ path:entry.path, classification, v2_sha256:entry.sha256, v3_sha256:fs.existsSync(target)?sha256File(target):null });
}
const known = new Set(v2Manifest.entries.map((row) => row.path));
for (const entry of [...listFiles(path.join(root,'editable-source')), ...listFiles(path.join(root,'vendor')), ...listFiles(path.join(root,'fixtures')), ...listFiles(path.join(root,'postgres-fixtures'))].sort((a,b)=>a.path.localeCompare(b.path))) {
  if (!known.has(entry.path)) rows.push({ path:entry.path, classification:entry.path.includes('/tests/')?'MODIFIED_FOR_TESTS':'MODIFIED_FOR_RESULT_PROTOCOL', v2_sha256:null, v3_sha256:entry.sha256 });
}
rows.push({path:'frozen-release/release/frozen-release-manifest.json',classification:'PROVENANCE_ONLY',v2_sha256:sha256File(path.join(v2Release,'frozen-release-manifest.json')),v3_sha256:null});
rows.push({path:'final-evidence/artifact-hash-manifest.json',classification:'PROVENANCE_ONLY',v2_sha256:sha256File(path.join(v2Root,'final-evidence','artifact-hash-manifest.json')),v3_sha256:null});
const corePaths = [
  'editable-source/src/parser/statementScanner.js','editable-source/src/envelope/validator.js','editable-source/src/executor/atomic-stage.js',
  'editable-source/src/executor/invariant-guard.js','editable-source/src/verifiers/in-transaction.js','editable-source/src/verifiers/post-commit.js',
  'editable-source/src/verifiers/material.js','editable-source/src/recovery/classifier.js','editable-source/src/path/mutation-workspace.js',
  'editable-source/tests/static-suite.js','editable-source/tests/integration-suite.js','editable-source/tests/mutation-suite.js',
];
const coreByteExact = corePaths.map((relative) => { const v2=path.join(v2Release,...relative.split('/')); const v3=path.join(root,...relative.split('/')); const same=sha256File(v2)===sha256File(v3); if(!same) throw new Error(`EXECUTOR_CORE_CHANGED: ${relative}`); return {path:relative,sha256:sha256File(v3),byteExact:true}; });
const summary = { BYTE_EXACT_REUSE:rows.filter((row)=>row.classification==='BYTE_EXACT_REUSE').length, MODIFIED_FOR_RESULT_PROTOCOL:rows.filter((row)=>row.classification==='MODIFIED_FOR_RESULT_PROTOCOL').length, MODIFIED_FOR_TESTS:rows.filter((row)=>row.classification==='MODIFIED_FOR_TESTS').length, PROVENANCE_ONLY:rows.filter((row)=>row.classification==='PROVENANCE_ONLY').length, REJECTED:rows.filter((row)=>row.classification==='REJECTED').length };
write('reuse-and-change-manifest.json', { schema:'tairet-executor-v3-reuse-and-change-manifest-v1', v2ReleaseIdentity:v2Manifest.releaseSha256, classificationVocabulary:['BYTE_EXACT_REUSE','MODIFIED_FOR_RESULT_PROTOCOL','MODIFIED_FOR_TESTS','PROVENANCE_ONLY','REJECTED'], summary, coreByteExact, rows });
process.stdout.write(`${JSON.stringify({ protocol:sha256File(path.join(manifestRoot,'suite-result-protocol.json')),matrix:sha256File(path.join(manifestRoot,'orchestration-acceptance-matrix.json')),reuse:sha256File(path.join(manifestRoot,'reuse-and-change-manifest.json')),summary })}\n`);
