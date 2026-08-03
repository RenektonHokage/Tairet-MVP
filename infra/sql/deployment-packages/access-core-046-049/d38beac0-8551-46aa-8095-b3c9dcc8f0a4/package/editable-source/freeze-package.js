'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const { canonicalHash, canonicalJson, sealed, sha256File, verifySeal } = require('./lib/canonical');
const { PACKAGE_ID, HOST_PACKAGE_ROOT } = require('./lib/definitions');
const { loadRuntime } = require('./package-runtime');

const packageRoot = path.resolve(__dirname, '..');
const frozenRoot = path.join(packageRoot, 'frozen-package', 'package');
const freezeManifestPath = path.join(packageRoot, 'frozen-package', 'frozen-package-manifest-v2.json');
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
  return { entries, file_count: entries.length, total_size: entries.reduce((sum, row) => sum + row.size, 0), tree_sha256: canonicalHash(entries) };
}
function copyTree(relativePath) {
  const source = path.join(packageRoot, ...relativePath.split('/'));
  const destination = path.join(frozenRoot, ...relativePath.split('/'));
  if (!fs.existsSync(source)) fail('FREEZE_SOURCE_MISSING', relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true });
}
function main() {
  assert.equal(packageRoot.toLowerCase(), HOST_PACKAGE_ROOT.toLowerCase(), 'PACKAGE_ROOT_MISMATCH');
  if (fs.existsSync(frozenRoot) || fs.existsSync(freezeManifestPath)) fail('FROZEN_PACKAGE_ALREADY_EXISTS');
  const postwrite = readJson(path.join(packageRoot, 'manifests', 'postwrite-authoritative-manifest-validation-v2.json'));
  verifySeal(postwrite, 'postwrite_manifest_validation_sha256', 'POSTWRITE_VALIDATION_IDENTITY_MISMATCH');
  if (postwrite.validation !== 'PASS' || postwrite.manifest_write_count !== 1 || postwrite.manifest_correction_count !== 0) fail('POSTWRITE_VALIDATION_NOT_GREEN');
  const runtime = loadRuntime(packageRoot, 'AUTHORITATIVE');
  if (!runtime.selfValidation.pass || runtime.selfValidation.artifact_count !== 153) fail('AUTHORITATIVE_RUNTIME_NOT_GREEN');
  fs.mkdirSync(frozenRoot, { recursive: false });
  const frozenSurfaces = [
    'editable-source',
    'draft-package',
    'canonical-migrations',
    'intermediate-payloads',
    'executor-release',
    'stage-verifiers',
    'preflight',
    'package-contracts',
    'development-rehearsal',
    'development-evidence',
    'version-reservations',
    'deployment-manifest',
    'manifests',
    'docker-inventories/development',
    'process-inventories/development',
  ];
  for (const surface of frozenSurfaces) copyTree(surface);
  const frozenRuntime = loadRuntime(frozenRoot, 'AUTHORITATIVE');
  assert.equal(frozenRuntime.executionDescriptor.manifest_sha256, runtime.executionDescriptor.manifest_sha256);
  assert.equal(frozenRuntime.inputManifest.input_manifest_sha256, runtime.inputManifest.input_manifest_sha256);
  assert.equal(frozenRuntime.selfValidation.artifact_count, 153);
  const tree = inventory(frozenRoot);
  let readOnlyFileCount = 0;
  for (const file of walkFiles(frozenRoot)) {
    fs.chmodSync(file, 0o444);
    readOnlyFileCount += 1;
  }
  const commandFiles = ['editable-source/run-rehearsal.ps1', 'editable-source/rehearsal-suite.js', 'editable-source/package-runtime.js', 'editable-source/lib/input-manifest-v2.js'].map((packagePath) => {
    const file = path.join(frozenRoot, ...packagePath.split('/'));
    return { package_path: packagePath, size: fs.statSync(file).size, sha256: sha256File(file) };
  });
  const fixtureRoot = path.join(frozenRoot, 'development-rehearsal', 'fixtures');
  const fixtureEntries = walkFiles(fixtureRoot).map((file) => ({ package_path: path.relative(frozenRoot, file).split(path.sep).join('/'), size: fs.statSync(file).size, sha256: sha256File(file) }));
  const body = {
    schema: 'FROZEN_ACCESS_CORE_046_049_DEPLOYMENT_PACKAGE_V2',
    package_id: PACKAGE_ID,
    frozen_root: frozenRoot,
    authoritative_manifest_sha256: runtime.executionDescriptor.manifest_sha256,
    input_manifest_sha256: runtime.inputManifest.input_manifest_sha256,
    input_manifest_schema_sha256: runtime.schemaIdentity.package_v2_input_manifest_schema_sha256,
    runtime_binding_sha256: runtime.binding.package_v2_input_manifest_runtime_binding_sha256,
    executor_release_identity: runtime.releaseManifest.releaseSha256,
    frozen_surfaces: frozenSurfaces,
    file_count: tree.file_count,
    total_size: tree.total_size,
    frozen_tree_sha256: tree.tree_sha256,
    entries: tree.entries,
    read_only_file_count: readOnlyFileCount,
    final_rehearsal_commands: commandFiles,
    final_rehearsal_fixtures: fixtureEntries,
    final_rehearsal_execution_count_authorized: 1,
    final_rehearsal_rerun_count_authorized: 0,
    freeze_write_count: 1,
    production_contact: 0,
  };
  const freezeManifest = sealed(body, 'frozen_access_core_046_049_deployment_package_v2_sha256');
  fs.writeFileSync(freezeManifestPath, canonicalJson(freezeManifest), { flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ frozenFileCount: tree.file_count, frozenTreeSha256: tree.tree_sha256, frozenPackageSha256: freezeManifest.frozen_access_core_046_049_deployment_package_v2_sha256, readOnlyFileCount })}\n`);
}
main();
