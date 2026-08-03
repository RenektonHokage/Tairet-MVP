'use strict';

const fs = require('fs');
const path = require('path');
const { canonicalHash, canonicalJson, sha256File } = require('../hash/canonical');
const { PathAuthorityError, assertMutationPath, isStrictChild, samePath } = require('./authority');

class MutationWorkspaceError extends Error {
  constructor(code, detail = '') {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.name = 'MutationWorkspaceError';
    this.code = code;
  }
}

function assertIdentifier(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) throw new MutationWorkspaceError('INVALID_WORKSPACE_IDENTITY', label);
}

function receiptBody(receipt) {
  const body = structuredClone(receipt);
  delete body.receiptSha256;
  return body;
}

function allocateMutationWorkspace({ authority, releaseSha256, finalRunId, mutantId }) {
  if (!/^[0-9a-f]{64}$/.test(releaseSha256)) throw new MutationWorkspaceError('INVALID_RELEASE_IDENTITY');
  assertIdentifier(finalRunId, 'finalRunId');
  assertIdentifier(mutantId, 'mutantId');
  const leaf = `${finalRunId.toLowerCase()}--${mutantId.toLowerCase()}`;
  const workspacePath = path.join(authority.mutationWorkRoot, leaf);
  if (fs.existsSync(workspacePath)) throw new MutationWorkspaceError('WORKSPACE_REUSE_REJECTED', leaf);
  fs.mkdirSync(workspacePath, { recursive: false });
  const emptyBeforeUse = fs.readdirSync(workspacePath).length === 0;
  if (!emptyBeforeUse) throw new MutationWorkspaceError('WORKSPACE_NOT_EMPTY', leaf);
  const canonicalWorkspace = assertMutationPath(authority, workspacePath);
  const body = {
    schema: 'tairet-mutation-workspace-receipt-v2', authoritySha256: authority.authoritySha256,
    releaseRoot: authority.frozenReleaseRoot, releaseSha256, finalOutputRoot: authority.finalOutputRoot,
    mutationWorkRoot: authority.mutationWorkRoot, workspacePath: canonicalWorkspace, finalRunId, mutantId,
    emptyBeforeUse: true, copiedFiles: [], state: 'ALLOCATED',
  };
  const receipt = { ...body, receiptSha256: canonicalHash(body) };
  fs.writeFileSync(path.join(workspacePath, '.workspace-receipt.json'), canonicalJson(receipt), { encoding: 'utf8', flag: 'wx' });
  return receipt;
}

function validateMutationWorkspaceReceipt(authority, receipt, expected = {}) {
  if (!receipt || receipt.schema !== 'tairet-mutation-workspace-receipt-v2') throw new MutationWorkspaceError('RECEIPT_FORMAT_MISMATCH');
  if (receipt.receiptSha256 !== canonicalHash(receiptBody(receipt))) throw new MutationWorkspaceError('RECEIPT_HASH_MISMATCH');
  if (receipt.authoritySha256 !== authority.authoritySha256) throw new MutationWorkspaceError('STALE_ROOT_BINDING');
  if (!samePath(receipt.releaseRoot, authority.frozenReleaseRoot) || !samePath(receipt.finalOutputRoot, authority.finalOutputRoot) || !samePath(receipt.mutationWorkRoot, authority.mutationWorkRoot)) throw new MutationWorkspaceError('STALE_ROOT_BINDING');
  if (expected.releaseSha256 && receipt.releaseSha256 !== expected.releaseSha256) throw new MutationWorkspaceError('STALE_RELEASE_BINDING');
  if (expected.finalRunId && receipt.finalRunId !== expected.finalRunId) throw new MutationWorkspaceError('STALE_FINAL_RUN_BINDING');
  if (expected.mutantId && receipt.mutantId !== expected.mutantId) throw new MutationWorkspaceError('WORKSPACE_MUTANT_BINDING_MISMATCH');
  const workspacePath = assertMutationPath(authority, receipt.workspacePath);
  const marker = path.join(workspacePath, '.workspace-receipt.json');
  if (!fs.existsSync(marker)) throw new MutationWorkspaceError('WORKSPACE_RECEIPT_MARKER_MISSING');
  const persisted = JSON.parse(fs.readFileSync(marker, 'utf8'));
  if (persisted.receiptSha256 !== receipt.receiptSha256) throw new MutationWorkspaceError('WORKSPACE_RECEIPT_MARKER_MISMATCH');
  return workspacePath;
}

function materializeRequiredSources(authority, receipt, relativeFiles) {
  const workspacePath = validateMutationWorkspaceReceipt(authority, receipt, {
    releaseSha256: receipt.releaseSha256, finalRunId: receipt.finalRunId, mutantId: receipt.mutantId,
  });
  if (!Array.isArray(relativeFiles) || relativeFiles.length === 0) throw new MutationWorkspaceError('REQUIRED_SOURCE_SET_EMPTY');
  const unique = [...new Set(relativeFiles)].sort();
  const packagedSourceBase = path.join(authority.frozenReleaseRoot, 'editable-source', 'src');
  const sourceBase = fs.existsSync(packagedSourceBase) ? packagedSourceBase : path.join(authority.frozenReleaseRoot, 'src');
  const destinationBase = path.join(workspacePath, 'source');
  fs.mkdirSync(destinationBase, { recursive: false });
  const copiedFiles = [];
  for (const relative of unique) {
    if (typeof relative !== 'string' || path.isAbsolute(relative) || relative === '..' || relative.startsWith(`..${path.sep}`) || relative.includes('/../')) throw new MutationWorkspaceError('SOURCE_COPY_PATH_REJECTED', String(relative));
    const source = path.resolve(sourceBase, relative);
    const destination = path.resolve(destinationBase, relative);
    if (!isStrictChild(sourceBase, source) || !isStrictChild(destinationBase, destination)) throw new PathAuthorityError('SOURCE_COPY_PATH_ESCAPE', relative);
    if (!fs.statSync(source).isFile()) throw new MutationWorkspaceError('REQUIRED_SOURCE_NOT_FILE', relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(destination, 0o644);
    copiedFiles.push({ path: relative.split(path.sep).join('/'), size: fs.statSync(destination).size, sha256: sha256File(destination) });
  }
  return { workspacePath, sourceRoot: destinationBase, copiedFiles };
}

function sealAndCleanMutationWorkspace(authority, receipt) {
  const workspacePath = validateMutationWorkspaceReceipt(authority, receipt, {
    releaseSha256: receipt.releaseSha256, finalRunId: receipt.finalRunId, mutantId: receipt.mutantId,
  });
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) files.push({ path: path.relative(workspacePath, full).split(path.sep).join('/'), size: fs.statSync(full).size, sha256: sha256File(full) });
      else throw new MutationWorkspaceError('UNSUPPORTED_WORKSPACE_ENTRY', full);
    }
  }
  visit(workspacePath);
  const sealed = { schema: 'tairet-mutation-workspace-seal-v2', receiptSha256: receipt.receiptSha256, files, sealSha256: canonicalHash(files) };
  fs.rmSync(workspacePath, { recursive: true, force: false });
  if (fs.existsSync(workspacePath)) throw new MutationWorkspaceError('WORKSPACE_CLEANUP_FAILED', workspacePath);
  return { ...sealed, cleaned: true };
}

module.exports = {
  MutationWorkspaceError, allocateMutationWorkspace, validateMutationWorkspaceReceipt,
  materializeRequiredSources, sealAndCleanMutationWorkspace, receiptBody,
};
