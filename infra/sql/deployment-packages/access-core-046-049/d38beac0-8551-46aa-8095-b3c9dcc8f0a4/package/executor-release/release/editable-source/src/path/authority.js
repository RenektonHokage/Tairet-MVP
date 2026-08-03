'use strict';

const fs = require('fs');
const path = require('path');
const { canonicalHash } = require('../hash/canonical');

class PathAuthorityError extends Error {
  constructor(code, detail = '') {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.name = 'PathAuthorityError';
    this.code = code;
  }
}

function pathKey(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function samePath(left, right) {
  return pathKey(left) === pathKey(right);
}

function isStrictChild(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function assertAbsoluteSyntax(value, label) {
  if (typeof value !== 'string' || value.length === 0) throw new PathAuthorityError('PATH_MISSING', label);
  if (/^(?:\\\\|\/\/|\\\\\?\\|\\\\\.\\)/.test(value)) throw new PathAuthorityError('UNC_OR_DEVICE_PATH_REJECTED', label);
  if (/^[A-Za-z]:[^\\/]/.test(value)) throw new PathAuthorityError('DRIVE_RELATIVE_PATH_REJECTED', label);
  if (!path.isAbsolute(value)) throw new PathAuthorityError('RELATIVE_PATH_REJECTED', label);
}

function nearestExisting(target) {
  let current = path.resolve(target);
  const suffix = [];
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) throw new PathAuthorityError('PATH_HAS_NO_EXISTING_ANCESTOR', target);
    suffix.unshift(path.basename(current));
    current = parent;
  }
  return { existing: current, suffix };
}

function assertNoReparseChain(target, boundary) {
  const nearest = nearestExisting(target).existing;
  const stop = path.resolve(boundary);
  if (!samePath(nearest, stop) && !isStrictChild(stop, nearest)) throw new PathAuthorityError('PATH_OUTSIDE_AUTHORITY_BOUNDARY', target);
  let current = nearest;
  while (true) {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) throw new PathAuthorityError('REPARSE_POINT_REJECTED', current);
    const real = fs.realpathSync.native(current);
    if (!samePath(real, current)) throw new PathAuthorityError('REPARSE_CANONICALIZATION_MISMATCH', current);
    if (samePath(current, stop)) break;
    const parent = path.dirname(current);
    if (parent === current) throw new PathAuthorityError('AUTHORITY_BOUNDARY_NOT_REACHED', target);
    current = parent;
  }
}

function canonicalize(value, options = {}) {
  const label = options.label || 'path';
  assertAbsoluteSyntax(value, label);
  const resolved = path.resolve(value);
  const boundary = options.boundary ? path.resolve(options.boundary) : path.parse(resolved).root;
  assertNoReparseChain(resolved, boundary);
  if (options.mustExist !== false && !fs.existsSync(resolved)) throw new PathAuthorityError('PATH_DOES_NOT_EXIST', label);
  if (fs.existsSync(resolved)) return fs.realpathSync.native(resolved);
  const { existing, suffix } = nearestExisting(resolved);
  return path.join(fs.realpathSync.native(existing), ...suffix);
}

function assertOutside(candidate, forbidden, code) {
  if (samePath(candidate, forbidden) || isStrictChild(forbidden, candidate)) throw new PathAuthorityError(code, candidate);
}

function createPathAuthority(input, options = {}) {
  const toolRoot = canonicalize(input.toolRoot, { label: 'V2_TOOL_ROOT' });
  const repositoryRoot = canonicalize(input.repositoryRoot, { label: 'REPOSITORY_ROOT' });
  const v1Root = canonicalize(input.v1Root, { label: 'V1_ROOT' });
  const tmpRoot = canonicalize(input.tmpRoot || 'C:\\tmp', { label: 'TMP_ROOT', mustExist: false });
  const frozenReleaseRoot = canonicalize(input.frozenReleaseRoot, {
    label: 'FROZEN_RELEASE_ROOT', boundary: toolRoot, mustExist: options.allowMissingRelease !== true,
  });
  const finalOutputRoot = canonicalize(input.finalOutputRoot, { label: 'FINAL_OUTPUT_ROOT', boundary: toolRoot });
  const mutationWorkRoot = canonicalize(input.mutationWorkRoot, { label: 'MUTATION_WORK_ROOT', boundary: toolRoot });
  const postgresWorkRoot = canonicalize(input.postgresWorkRoot, { label: 'POSTGRES_WORK_ROOT', boundary: toolRoot });

  if (!isStrictChild(toolRoot, frozenReleaseRoot)) throw new PathAuthorityError('FROZEN_RELEASE_OUTSIDE_V2_ROOT');
  if (!isStrictChild(toolRoot, finalOutputRoot)) throw new PathAuthorityError('FINAL_OUTPUT_OUTSIDE_V2_ROOT');
  if (!isStrictChild(finalOutputRoot, mutationWorkRoot)) throw new PathAuthorityError('MUTATION_ROOT_OUTSIDE_FINAL_OUTPUT');
  if (!isStrictChild(finalOutputRoot, postgresWorkRoot)) throw new PathAuthorityError('POSTGRES_ROOT_OUTSIDE_FINAL_OUTPUT');
  if (samePath(mutationWorkRoot, postgresWorkRoot)) throw new PathAuthorityError('WORK_ROOT_ALIAS');

  for (const [candidate, label] of [[finalOutputRoot, 'FINAL_OUTPUT'], [mutationWorkRoot, 'MUTATION_WORK'], [postgresWorkRoot, 'POSTGRES_WORK']]) {
    assertOutside(candidate, frozenReleaseRoot, `${label}_INSIDE_FROZEN_RELEASE`);
    assertOutside(candidate, repositoryRoot, `${label}_INSIDE_REPOSITORY`);
    assertOutside(candidate, v1Root, `${label}_INSIDE_V1`);
    assertOutside(candidate, tmpRoot, `${label}_INSIDE_C_TMP`);
  }

  const body = {
    schema: 'tairet-path-authority-v2', toolRoot, frozenReleaseRoot, finalOutputRoot, mutationWorkRoot,
    postgresWorkRoot, repositoryRoot, v1Root, tmpRoot,
  };
  return Object.freeze({ ...body, authoritySha256: canonicalHash(body) });
}

function assertMutationPath(authority, candidate, options = {}) {
  const canonical = canonicalize(candidate, {
    label: options.label || 'MUTATION_WORKSPACE', boundary: authority.toolRoot, mustExist: options.mustExist !== false,
  });
  if (!isStrictChild(authority.mutationWorkRoot, canonical)) throw new PathAuthorityError('MUTATION_WORKSPACE_OUTSIDE_AUTHORIZED_ROOT', canonical);
  assertOutside(canonical, authority.frozenReleaseRoot, 'MUTATION_WORKSPACE_INSIDE_FROZEN_RELEASE');
  assertOutside(canonical, authority.repositoryRoot, 'MUTATION_WORKSPACE_INSIDE_REPOSITORY');
  assertOutside(canonical, authority.v1Root, 'MUTATION_WORKSPACE_INSIDE_V1');
  assertOutside(canonical, authority.tmpRoot, 'MUTATION_WORKSPACE_INSIDE_C_TMP');
  return canonical;
}

function validateEnvironmentBindings(authority, env) {
  const expected = {
    ROOT_EXECUTOR_ROOT: authority.toolRoot,
    FROZEN_RELEASE_ROOT: authority.frozenReleaseRoot,
    FINAL_OUTPUT_ROOT: authority.finalOutputRoot,
    MUTATION_WORK_ROOT: authority.mutationWorkRoot,
    POSTGRES_WORK_ROOT: authority.postgresWorkRoot,
    TAIRET_REPO_ROOT: authority.repositoryRoot,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (!env[key] || !samePath(env[key], value)) throw new PathAuthorityError('ENVIRONMENT_OVERRIDE_REJECTED', key);
  }
  return { pass: true, checked: Object.keys(expected) };
}

module.exports = {
  PathAuthorityError, assertAbsoluteSyntax, canonicalize, createPathAuthority, assertMutationPath,
  validateEnvironmentBindings, isStrictChild, samePath,
};
