'use strict';

const fs = require('fs');
const path = require('path');
const { canonicalHash, sha256File } = require('../hash/canonical');

class ReleaseVerificationError extends Error {
  constructor(code, detail = '') { super(`${code}${detail ? `: ${detail}` : ''}`); this.name = 'ReleaseVerificationError'; this.code = code; }
}

function releaseBody(manifest) {
  return { schema: manifest.schema, executorVersion: manifest.executorVersion, runtimeIdentity: manifest.runtimeIdentity, entries: manifest.entries };
}

function verifyFrozenRelease(releaseRoot, manifest) {
  if (manifest.schema !== 'tairet-statement-aware-atomic-executor-release-v2') throw new ReleaseVerificationError('RELEASE_FORMAT_MISMATCH');
  if (manifest.releaseSha256 !== canonicalHash(releaseBody(manifest))) throw new ReleaseVerificationError('RELEASE_IDENTITY_MISMATCH');
  const expectedPaths = new Set();
  for (const entry of manifest.entries) {
    if (!/^[0-9a-f]{64}$/.test(entry.sha256) || !Number.isInteger(entry.size)) throw new ReleaseVerificationError('RELEASE_ENTRY_INVALID', entry.path);
    const resolved = path.resolve(releaseRoot, entry.path);
    const relative = path.relative(path.resolve(releaseRoot), resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new ReleaseVerificationError('RELEASE_PATH_ESCAPE', entry.path);
    if (!fs.existsSync(resolved)) throw new ReleaseVerificationError('RELEASE_FILE_MISSING', entry.path);
    if (fs.statSync(resolved).size !== entry.size || sha256File(resolved) !== entry.sha256) throw new ReleaseVerificationError('RELEASE_FILE_MISMATCH', entry.path);
    if (expectedPaths.has(entry.path)) throw new ReleaseVerificationError('RELEASE_DUPLICATE_ENTRY', entry.path);
    expectedPaths.add(entry.path);
  }
  return { releaseSha256: manifest.releaseSha256, verifiedFileCount: manifest.entries.length };
}

module.exports = { ReleaseVerificationError, releaseBody, verifyFrozenRelease };
