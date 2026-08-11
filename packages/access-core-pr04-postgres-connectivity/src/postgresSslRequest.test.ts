import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';

import * as publicPackageSurface from './index';
import {
  createPostgresSslRequest,
  requirePostgresSslResponse,
  writeCanonicalPostgresSslRequest,
} from './postgresSslRequest';
import './directPreflight.test';

test('encodes exactly the PostgreSQL SSLRequest bytes', () => {
  const request = createPostgresSslRequest();
  assert.equal(request.toString('hex'), '0000000804d2162f');
  assert.equal(request.readUInt32BE(0), 8);
  assert.equal(request.readUInt32BE(4), 80877103);
});

test('returns a fresh request buffer for every call', () => {
  const first = createPostgresSslRequest();
  const second = createPostgresSslRequest();
  assert.notEqual(first, second);
  first[0] = 0xff;
  assert.equal(second.toString('hex'), '0000000804d2162f');
  assert.equal(createPostgresSslRequest().toString('hex'), '0000000804d2162f');
});

test('does not expose a mutable SSLRequest byte authority from the package root', () => {
  assert.equal(Reflect.has(publicPackageSurface, 'POSTGRES_SSL_REQUEST_BYTES'), false);
});

test('validates exact bytes and writes a fresh canonical request', () => {
  const input = createPostgresSslRequest();
  let writeCount = 0;
  let written: Buffer | undefined;
  writeCanonicalPostgresSslRequest(input, (request) => {
    writeCount += 1;
    written = request;
  });
  assert.equal(writeCount, 1);
  assert.notEqual(written, input);
  assert.equal(written?.toString('hex'), '0000000804d2162f');
});

test('rejects altered bytes before the writer or TLS transition can run', () => {
  const altered = createPostgresSslRequest();
  altered[0] = 0xff;
  let socketWriteCount = 0;
  let tlsTransitionCount = 0;
  assert.throws(
    () =>
      writeCanonicalPostgresSslRequest(altered, () => {
        socketWriteCount += 1;
        tlsTransitionCount += 1;
      }),
    /PRODUCTION_TLS_REQUIRED/u,
  );
  assert.equal(socketWriteCount, 0);
  assert.equal(tlsTransitionCount, 0);
});

test('accepts only one S byte', () => {
  assert.doesNotThrow(() => requirePostgresSslResponse(0x53));
  assert.doesNotThrow(() => requirePostgresSslResponse(Buffer.from([0x53])));
  assert.throws(() => requirePostgresSslResponse(0x4e), /PRODUCTION_TLS_REQUIRED/u);
  assert.throws(() => requirePostgresSslResponse(Buffer.alloc(0)), /PRODUCTION_TLS_REQUIRED/u);
  assert.throws(
    () => requirePostgresSslResponse(Buffer.from([0x53, 0x00])),
    /PRODUCTION_TLS_REQUIRED/u,
  );
});
