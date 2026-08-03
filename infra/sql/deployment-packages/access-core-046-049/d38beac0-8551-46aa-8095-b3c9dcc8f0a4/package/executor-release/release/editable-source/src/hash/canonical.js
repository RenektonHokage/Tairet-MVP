'use strict';

const crypto = require('crypto');
const fs = require('fs');

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(path) {
  return sha256Bytes(fs.readFileSync(path));
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

module.exports = { sha256Bytes, sha256File, stable, canonicalJson, canonicalHash };
