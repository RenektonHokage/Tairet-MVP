'use strict';

const fs = require('fs');
const path = require('path');
const { canonicalJson, sealed, sha256File, verifySeal } = require('./lib/canonical');
const { PACKAGE_ID, HOST_PACKAGE_ROOT } = require('./lib/definitions');

const packageRoot = path.resolve(__dirname, '..');
const bindingPath = path.join(packageRoot, 'manifests', 'input-manifest-runtime-binding-v2.json');
const draftPath = path.join(packageRoot, 'draft-package', 'draft-deployment-descriptor-v2.json');
const buildResultPath = path.join(packageRoot, 'development-evidence', 'draft-package-build-result-v2.json');
const selfValidationPath = path.join(packageRoot, 'development-evidence', 'runtime-self-validation', 'runtime-self-validation-result-v2.json');
const archiveRoot = path.join(packageRoot, 'development-evidence', 'pre-authoritative-revisions', 'revision-1');
function fail(code, detail = '') { throw new Error(`${code}${detail ? `: ${detail}` : ''}`); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function descriptor(file, component) { return { component, package_path: `editable-source/${component}`, size: fs.statSync(file).size, sha256: sha256File(file), schema_version: 2, manifest_parser: 'editable-source/lib/input-manifest-v2.js' }; }
function overwriteDraft(file, value) { fs.writeFileSync(file, canonicalJson(value)); }
function main() {
  if (packageRoot.toLowerCase() !== HOST_PACKAGE_ROOT.toLowerCase()) fail('PACKAGE_ROOT_MISMATCH');
  for (const relative of ['manifests/packaging-event-v2.json', 'deployment-manifest/version-assignment-v2.json', 'deployment-manifest/access-core-046-049-deployment-manifest-v2.json']) {
    if (fs.existsSync(path.join(packageRoot, ...relative.split('/')))) fail('AUTHORITATIVE_STATE_EXISTS', relative);
  }
  if (fs.existsSync(archiveRoot)) fail('DRAFT_REVISION_ALREADY_APPLIED');
  const oldBinding = readJson(bindingPath);
  const oldDraft = readJson(draftPath);
  const oldBuildResult = readJson(buildResultPath);
  verifySeal(oldBinding, 'package_v2_input_manifest_runtime_binding_sha256', 'OLD_BINDING_IDENTITY_MISMATCH');
  verifySeal(oldDraft, 'draft_descriptor_sha256', 'OLD_DRAFT_IDENTITY_MISMATCH');
  verifySeal(oldBuildResult, 'draft_package_build_result_sha256', 'OLD_BUILD_RESULT_IDENTITY_MISMATCH');
  const consumerNames = ['build-draft.js', 'contract-tests.js', 'package-runtime.js', 'self-validate.js', 'rehearsal-suite.js', 'authoritative-finalize.js', 'freeze-package.js', 'finalize-report.js', 'run-rehearsal.ps1'];
  const consumers = consumerNames.map((name) => descriptor(path.join(packageRoot, 'editable-source', name), name));
  const changed = consumers.filter((row) => oldBinding.consumers.find((old) => old.component === row.component)?.sha256 !== row.sha256).map((row) => row.component);
  if (changed.length !== 1 || changed[0] !== 'authoritative-finalize.js') fail('UNEXPECTED_SOURCE_CHANGE_SET', changed.join(','));
  fs.mkdirSync(archiveRoot, { recursive: true });
  for (const [source, name] of [[bindingPath, 'input-manifest-runtime-binding-v2.json'], [draftPath, 'draft-deployment-descriptor-v2.json'], [buildResultPath, 'draft-package-build-result-v2.json'], [selfValidationPath, 'runtime-self-validation-result-v2.json']]) fs.copyFileSync(source, path.join(archiveRoot, name), fs.constants.COPYFILE_EXCL);

  const bindingBody = { ...oldBinding, consumers };
  delete bindingBody.package_v2_input_manifest_runtime_binding_sha256;
  const newBinding = sealed(bindingBody, 'package_v2_input_manifest_runtime_binding_sha256');
  overwriteDraft(bindingPath, newBinding);
  const draftBody = { ...oldDraft, runtime_source_identities: consumers, artifact_identities: { ...oldDraft.artifact_identities, input_manifest_runtime_binding_sha256: newBinding.package_v2_input_manifest_runtime_binding_sha256 } };
  delete draftBody.draft_descriptor_sha256;
  const newDraft = sealed(draftBody, 'draft_descriptor_sha256');
  overwriteDraft(draftPath, newDraft);
  const buildBody = { ...oldBuildResult, identities: { ...oldBuildResult.identities, input_manifest_runtime_binding: newBinding.package_v2_input_manifest_runtime_binding_sha256, draft_descriptor: newDraft.draft_descriptor_sha256 }, pre_authoritative_draft_revision: 2 };
  delete buildBody.draft_package_build_result_sha256;
  const newBuildResult = sealed(buildBody, 'draft_package_build_result_sha256');
  overwriteDraft(buildResultPath, newBuildResult);
  fs.unlinkSync(selfValidationPath);
  const revision = sealed({ schema: 'ACCESS_CORE_046_049_PRE_AUTHORITATIVE_DRAFT_REVISION_V2', package_id: PACKAGE_ID, revision: 2, reason: 'Bounded local reservation discovery replaces an unbounded recursive inventory scan that failed before event capture.', changed_source_files: changed, old_runtime_binding_sha256: oldBinding.package_v2_input_manifest_runtime_binding_sha256, new_runtime_binding_sha256: newBinding.package_v2_input_manifest_runtime_binding_sha256, old_draft_descriptor_sha256: oldDraft.draft_descriptor_sha256, new_draft_descriptor_sha256: newDraft.draft_descriptor_sha256, old_green_development_run_preserved: 'devv2a', required_regates: ['RUNTIME_SELF_VALIDATION', 'DEVELOPMENT_REHEARSAL_19_CASES'], authoritative_packaging_event_status: 'NOT_CAPTURED', real_version_assignment_status: 'NOT_ASSIGNED', authoritative_manifest_status: 'NOT_WRITTEN', production_contact: 0 }, 'draft_revision_evidence_sha256');
  fs.writeFileSync(path.join(packageRoot, 'development-evidence', 'pre-authoritative-revisions', 'draft-revision-2.json'), canonicalJson(revision), { flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ changedSourceFiles: changed, newRuntimeBindingSha256: newBinding.package_v2_input_manifest_runtime_binding_sha256, newDraftDescriptorSha256: newDraft.draft_descriptor_sha256, revisionEvidenceSha256: revision.draft_revision_evidence_sha256 })}\n`);
}
main();
