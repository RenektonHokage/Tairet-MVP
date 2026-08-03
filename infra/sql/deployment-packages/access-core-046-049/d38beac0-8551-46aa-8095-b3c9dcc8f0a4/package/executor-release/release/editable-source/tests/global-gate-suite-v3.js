'use strict';

const assert = require('assert/strict');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { canonicalHash, canonicalJson, sha256Bytes, sha256File } = require('../src/result/suite-result');
const { verifyRelease } = require('../src/result/finalizer');

function parseArgs(argv) { const out = {}; for (let i = 0; i < argv.length; i += 2) out[argv[i].replace(/^--/, '')] = argv[i + 1]; return out; }
const options = parseArgs(process.argv.slice(2));
const executorRoot = path.resolve(options['executor-root']);
const releaseRoot = path.resolve(options['release-root']);
const repoRoot = path.resolve(options['repository-root']);
const mode = options.mode;
const outputPath = path.resolve(options.output);
const expectedRelease = options['release-id'];
const v1Root = path.resolve(process.env.V1_EXECUTOR_ROOT);
const v2Root = path.resolve(process.env.V2_EXECUTOR_ROOT);
const rows = [];

function command(executable, args) { return childProcess.execFileSync(executable, args, { cwd: repoRoot, encoding: 'utf8', windowsHide: true }).trim(); }
function readJson(target) { return JSON.parse(fs.readFileSync(target, 'utf8')); }
function listFiles(root) {
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`REPARSE_OR_SYMLINK_REJECTED: ${full}`);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) rows.push({ path: path.relative(root, full).split(path.sep).join('/'), size: fs.statSync(full).size, sha256: sha256File(full) });
      else throw new Error(`UNSUPPORTED_ENTRY: ${full}`);
    }
  }
  visit(root); return rows;
}
function compareBaseline(target, root) {
  const baseline = readJson(target); const actual = listFiles(root);
  assert.deepEqual(actual, baseline.files); return { file_count: actual.length, inventory_sha256: canonicalHash(actual) };
}
function payload(target) { const bytes = fs.readFileSync(target); return { size: bytes.length - 15, sha256: sha256Bytes(bytes.subarray(7, bytes.length - 8)) }; }
function gate(id, fn) { try { rows.push({ id, pass: true, evidence: fn() }); } catch (error) { rows.push({ id, pass: false, code: error.code || error.name, error: error.message }); } }

const manifestRoot = mode === 'Final' ? path.join(releaseRoot, 'manifests') : path.join(executorRoot, 'manifests');
const releaseManifestPath = mode === 'Final' ? path.join(releaseRoot, 'frozen-release-manifest.json') : path.join(executorRoot, 'development-evidence', 'development-release-manifest.json');
gate('G001_RELEASE_IDENTITY', () => { const manifest = readJson(releaseManifestPath); verifyRelease(releaseRoot, manifest); assert.equal(manifest.releaseSha256, expectedRelease); return { release_sha256: manifest.releaseSha256, entry_count: manifest.entries.length }; });
gate('G002_AUTHORIZED_REPOSITORY', () => { assert.equal(command('git', ['-C', repoRoot, 'branch', '--show-current']), 'main'); assert.equal(command('git', ['-C', repoRoot, 'rev-parse', 'HEAD']), '715ad1cea644e45d688dca785de09c83e1956413'); assert.equal(command('git', ['-C', repoRoot, 'diff', '--name-only']), ''); assert.equal(command('git', ['-C', repoRoot, 'diff', '--cached', '--name-only']), ''); return { branch: 'main', head: '715ad1cea644e45d688dca785de09c83e1956413' }; });
gate('G003_CANONICAL_AND_PAYLOAD_IDENTITIES', () => { const authorized = readJson(path.join(manifestRoot, 'authorized-input-integrity.json')); const evidence = []; for (let index = 0; index < authorized.canonicalMigrations.length; index += 1) { const source = authorized.canonicalMigrations[index]; const expectedPayload = authorized.intermediatePayloads[index]; const target = path.join(repoRoot, ...source.canonicalPath.split('/')); assert.equal(fs.statSync(target).size, source.size); assert.equal(sha256File(target), source.sha256); assert.deepEqual(payload(target), { size: expectedPayload.size, sha256: expectedPayload.sha256 }); evidence.push({ logical_number: source.logicalMigrationNumber, source_sha256: source.sha256, payload_sha256: expectedPayload.sha256 }); } return evidence; });
gate('G004_V1_IMMUTABLE', () => compareBaseline(path.join(manifestRoot, 'v1-tree-baseline.json'), v1Root));
gate('G005_V2_IMMUTABLE', () => { const evidence = compareBaseline(path.join(manifestRoot, 'v2-tree-baseline.json'), v2Root); assert.equal(sha256File(path.join(v2Root, 'final-evidence', 'artifact-hash-manifest.json')), '0f3e00a85b03c44472e49cf4ae2031a6b2a1dc1be28170e1914a6f09bc250120'); assert.equal(readJson(path.join(v2Root, 'frozen-release', 'release', 'frozen-release-manifest.json')).releaseSha256, '2b4668c5f1671114a856589298e0102b238841f53890b92ca5dde666eb7a17c8'); return evidence; });
gate('G006_FINAL_ENVIRONMENT_IDENTITY', () => { const environment = readJson(path.join(manifestRoot, 'final-environment-contract.json')); const body = { ...environment }; delete body.contractSha256; assert.equal(environment.contractSha256, canonicalHash(body)); assert.equal(environment.FINAL_ENVIRONMENT_CONTRACT, 'PASS'); if (mode === 'Final') { for (const [key, value] of Object.entries(environment.exactIntendedFinal.environment)) assert.equal(process.env[key], value, key); } return { contract_sha256: environment.contractSha256 }; });
gate('G007_LOCAL_DEPENDENCIES', () => { const dependencies = readJson(path.join(manifestRoot, 'local-executor-dependency-inventory.json')); const postgres = command('docker', ['image', 'inspect', '--format', '{{.Id}}', dependencies.dockerImages.postgres.reference]); const node = command('docker', ['image', 'inspect', '--format', '{{.Id}}', dependencies.dockerImages.node.reference]); assert.equal(postgres, dependencies.dockerImages.postgres.expectedImageId); assert.equal(node, dependencies.dockerImages.node.expectedImageId); return { postgres_image_id: postgres, node_image_id: node, pull_performed: 0, external_network_contact: 0 }; });
gate('G008_RESULT_CHANNEL_FRESH', () => { const resultRoot = path.join(executorRoot, 'suite-results', process.env.FINAL_RUN_ID); if (fs.existsSync(resultRoot)) assert.deepEqual(fs.readdirSync(resultRoot), []); return { result_root: resultRoot, preexisting_result_count: 0 }; });

const result = { schema: 'tairet-executor-v3-global-gate-result-v1', mode, gate_count: rows.length, pass_count: rows.filter((row) => row.pass).length, fail_count: rows.filter((row) => !row.pass).length, production_contact: 0, rows };
fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, canonicalJson(result), { encoding: 'utf8', flag: 'wx' });
process.stdout.write(`${JSON.stringify({ gateCount: result.gate_count, passCount: result.pass_count, failCount: result.fail_count })}\n`);
process.exit(result.fail_count ? 1 : 0);
