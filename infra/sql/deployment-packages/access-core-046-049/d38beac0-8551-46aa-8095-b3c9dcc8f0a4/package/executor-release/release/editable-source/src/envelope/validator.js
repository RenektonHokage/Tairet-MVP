'use strict';

const fs = require('fs');
const { sha256Bytes } = require('../hash/canonical');
const { scanStatements } = require('../parser/statementScanner');

const LEADING = Buffer.from('begin;\n', 'utf8');
const TRAILING = Buffer.from('commit;\n', 'utf8');

class EnvelopeValidationError extends Error {
  constructor(code, detail = '') {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.name = 'EnvelopeValidationError';
    this.code = code;
  }
}

function validateCanonicalBytes(bytes, expected) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError('canonical source must be a Buffer');
  if (bytes.length !== expected.size) throw new EnvelopeValidationError('SOURCE_SIZE_MISMATCH');
  if (sha256Bytes(bytes) !== expected.sha256) throw new EnvelopeValidationError('SOURCE_HASH_MISMATCH');
  if (!bytes.subarray(0, LEADING.length).equals(LEADING)) throw new EnvelopeValidationError('LEADING_ENVELOPE_MISMATCH');
  if (!bytes.subarray(bytes.length - TRAILING.length).equals(TRAILING)) throw new EnvelopeValidationError('TRAILING_ENVELOPE_MISMATCH');
  const payload = bytes.subarray(LEADING.length, bytes.length - TRAILING.length);
  if (payload.length !== expected.payloadSize) throw new EnvelopeValidationError('PAYLOAD_SIZE_MISMATCH');
  if (sha256Bytes(payload) !== expected.payloadSha256) throw new EnvelopeValidationError('PAYLOAD_HASH_MISMATCH');
  const parsed = scanStatements(payload);
  if (parsed.transactionControls.length) {
    const first = parsed.transactionControls[0];
    throw new EnvelopeValidationError('UNSAFE_TOP_LEVEL_TRANSACTION_CONTROL', `${first.transactionControl} at ${first.start}`);
  }
  return { payload, parsed, envelope: { leadingHex: LEADING.toString('hex'), trailingHex: TRAILING.toString('hex'), removedBytes: LEADING.length + TRAILING.length } };
}

function validateCanonicalFile(path, expected) {
  return validateCanonicalBytes(fs.readFileSync(path), expected);
}

module.exports = { LEADING, TRAILING, EnvelopeValidationError, validateCanonicalBytes, validateCanonicalFile };
