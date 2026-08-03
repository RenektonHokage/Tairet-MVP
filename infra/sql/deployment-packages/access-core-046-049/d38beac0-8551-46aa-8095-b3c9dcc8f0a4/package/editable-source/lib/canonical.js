'use strict';

const crypto = require('crypto');
const fs = require('fs');

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sha256File(file) {
  return sha256Bytes(fs.readFileSync(file));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object' && !Buffer.isBuffer(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function canonicalHash(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value), 'utf8'));
}

function sealed(body, field) {
  return { ...body, [field]: canonicalHash(body) };
}

function verifySeal(value, field, code = 'SEALED_IDENTITY_MISMATCH') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${code}: object required`);
  const body = { ...value };
  const observed = body[field];
  delete body[field];
  if (!/^[0-9a-f]{64}$/.test(observed || '') || canonicalHash(body) !== observed) {
    throw new Error(`${code}: ${field}`);
  }
  return observed;
}

module.exports = { sha256Bytes, sha256File, stable, canonicalJson, canonicalHash, sealed, verifySeal };
