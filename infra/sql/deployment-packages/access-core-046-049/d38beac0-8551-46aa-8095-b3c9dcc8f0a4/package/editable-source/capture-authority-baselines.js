'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { canonicalHash, canonicalJson, sealed, sha256File } = require('./lib/canonical');
const {
  PACKAGE_ID,
  EXECUTOR_V3_ROOT,
  EXPECTED_EXECUTOR_RELEASE_IDENTITY,
  REPOSITORY_ROOT,
  MIGRATIONS,
} = require('./lib/definitions');

const packageRoot = path.resolve(__dirname, '..');
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
function writeNew(file, value) {
  if (fs.existsSync(file)) throw new Error(`BASELINE_ALREADY_EXISTS ${file}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, canonicalJson(value), { flag: 'wx' });
}
function main() {
  const executor = inventory(EXECUTOR_V3_ROOT);
  const executorResult = sealed({ schema: 'EXECUTOR_V3_IMMUTABILITY_BASELINE_FOR_ACCESS_CORE_PACKAGE_V2', package_id: PACKAGE_ID, source_root: EXECUTOR_V3_ROOT, expected_frozen_release_identity: EXPECTED_EXECUTOR_RELEASE_IDENTITY, file_count: executor.file_count, total_size: executor.total_size, entries: executor.entries, inventory_sha256: executor.inventory_sha256, write_count: 0 }, 'executor_v3_baseline_evidence_sha256');
  writeNew(path.join(packageRoot, 'manifests', 'executor-v3-immutability-baseline.json'), executorResult);
  const repository = {
    root: command(['git', '-C', REPOSITORY_ROOT, 'rev-parse', '--show-toplevel']).replaceAll('\\', '/'),
    branch: command(['git', '-C', REPOSITORY_ROOT, 'branch', '--show-current']),
    head: command(['git', '-C', REPOSITORY_ROOT, 'rev-parse', 'HEAD']),
    status: command(['git', '-C', REPOSITORY_ROOT, 'status', '--porcelain=v1', '--untracked-files=all']),
    staging: command(['git', '-C', REPOSITORY_ROOT, 'diff', '--cached', '--name-status']),
    migrations: MIGRATIONS.map((migration) => {
      const file = path.join(REPOSITORY_ROOT, 'infra', 'sql', 'migrations', migration.filename);
      return { name: migration.filename, size: fs.statSync(file).size, sha256: sha256File(file) };
    }),
  };
  const repositoryResult = sealed({ schema: 'REPOSITORY_IMMUTABILITY_BASELINE_FOR_ACCESS_CORE_PACKAGE_V2', package_id: PACKAGE_ID, repository, write_count: 0 }, 'repository_baseline_evidence_sha256');
  writeNew(path.join(packageRoot, 'manifests', 'repository-immutability-baseline.json'), repositoryResult);
  process.stdout.write(`${JSON.stringify({ executorFileCount: executor.file_count, executorInventorySha256: executor.inventory_sha256, repositoryHead: repository.head })}\n`);
}
main();
