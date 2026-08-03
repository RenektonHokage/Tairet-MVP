'use strict';

const crypto = require('crypto');

class ScramError extends Error {
  constructor(code, detail = '') { super(`${code}${detail ? `: ${detail}` : ''}`); this.name = 'ScramError'; this.code = code; }
}

function saslEscape(value) { return value.replace(/=/g, '=3D').replace(/,/g, '=2C'); }
function hmac(key, data) { return crypto.createHmac('sha256', key).update(data).digest(); }
function xor(a, b) { if (a.length !== b.length) throw new ScramError('SCRAM_XOR_LENGTH'); const out = Buffer.alloc(a.length); for (let i = 0; i < a.length; i += 1) out[i] = a[i] ^ b[i]; return out; }
function parseAttributes(value) {
  const result = {};
  for (const part of value.split(',')) {
    if (part.length < 3 || part[1] !== '=') throw new ScramError('SCRAM_ATTRIBUTE_MALFORMED');
    if (result[part[0]] !== undefined) throw new ScramError('SCRAM_ATTRIBUTE_DUPLICATE', part[0]);
    result[part[0]] = part.slice(2);
  }
  return result;
}

function beginScram(user, nonce = crypto.randomBytes(18).toString('base64')) {
  if (!user || /\0/.test(user)) throw new ScramError('SCRAM_USER_INVALID');
  const clientFirstBare = `n=${saslEscape(user)},r=${nonce}`;
  return { nonce, clientFirstBare, clientFirstMessage: `n,,${clientFirstBare}`, expectedServerSignature: null };
}

function continueScram(state, password, serverFirstMessage) {
  const attributes = parseAttributes(serverFirstMessage);
  if (!attributes.r || !attributes.r.startsWith(state.nonce) || attributes.r.length <= state.nonce.length) throw new ScramError('SCRAM_SERVER_NONCE_INVALID');
  if (!attributes.s || !/^[A-Za-z0-9+/]+={0,2}$/.test(attributes.s)) throw new ScramError('SCRAM_SALT_INVALID');
  const iterations = Number(attributes.i);
  if (!Number.isSafeInteger(iterations) || iterations < 4096 || iterations > 1000000) throw new ScramError('SCRAM_ITERATION_INVALID');
  const salt = Buffer.from(attributes.s, 'base64');
  const saltedPassword = crypto.pbkdf2Sync(Buffer.from(password, 'utf8'), salt, iterations, 32, 'sha256');
  const clientKey = hmac(saltedPassword, 'Client Key');
  const storedKey = crypto.createHash('sha256').update(clientKey).digest();
  const clientFinalWithoutProof = `c=biws,r=${attributes.r}`;
  const authMessage = `${state.clientFirstBare},${serverFirstMessage},${clientFinalWithoutProof}`;
  const clientSignature = hmac(storedKey, authMessage);
  const proof = xor(clientKey, clientSignature).toString('base64');
  const serverKey = hmac(saltedPassword, 'Server Key');
  state.expectedServerSignature = hmac(serverKey, authMessage);
  return `${clientFinalWithoutProof},p=${proof}`;
}

function finalizeScram(state, serverFinalMessage) {
  const attributes = parseAttributes(serverFinalMessage);
  if (attributes.e) throw new ScramError('SCRAM_SERVER_ERROR', attributes.e);
  if (!attributes.v || !state.expectedServerSignature) throw new ScramError('SCRAM_SERVER_SIGNATURE_MISSING');
  const actual = Buffer.from(attributes.v, 'base64');
  if (actual.length !== state.expectedServerSignature.length || !crypto.timingSafeEqual(actual, state.expectedServerSignature)) throw new ScramError('SCRAM_SERVER_SIGNATURE_MISMATCH');
  return true;
}

module.exports = { ScramError, beginScram, continueScram, finalizeScram, parseAttributes, saslEscape };
