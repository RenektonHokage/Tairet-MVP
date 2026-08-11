import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  DIRECT_POSTGRES_TARGET,
  runDirectPostgresPreflight,
  type CredentialFreeNetworkAdapters,
  type DirectPostgresPreflightOptions,
} from './directPostgresPreflight';
import { writeCanonicalPostgresSslRequest } from './postgresSslRequest';

const CA_PATH =
  'C:\\Users\\mateo\\AppData\\Local\\Tairet\\access-core-046-049-production-ca-acquisition-fd54f57f\\official-source\\prod-ca-2021.crt';
const CA_SHA256 = '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7';
const CA_BYTES = readFileSync(CA_PATH);
const IPV4 = '1.1.1.1';
const TIMER = Symbol('synthetic-timer');

type FakeState = {
  calls: string[];
  clearTimerCount: number;
  closeInputs: unknown[];
  socketWriteCount: number;
  tlsTransitionCount: number;
};

function state(): FakeState {
  return {
    calls: [],
    clearTimerCount: 0,
    closeInputs: [],
    socketWriteCount: 0,
    tlsTransitionCount: 0,
  };
}

function fakeAdapters(
  current: FakeState,
  overrides: Partial<CredentialFreeNetworkAdapters> = {},
): CredentialFreeNetworkAdapters {
  const connection = { synthetic: true };
  return {
    readFile: async () => {
      current.calls.push('readFile');
      return CA_BYTES;
    },
    resolveDns: async ({ hostname }) => {
      current.calls.push('resolveDns');
      return {
        queriedHostname: hostname,
        resolver: ['synthetic-resolver'],
        records: [{ address: IPV4, family: 4, ttl: 60 }],
      };
    },
    inspectRoute: async ({ address, family }) => {
      current.calls.push('inspectRoute');
      return { address, family, usable: true, metric: 10 };
    },
    connectTcp: async ({ address, family, port }) => {
      current.calls.push('connectTcp');
      return { connection, remoteAddress: address, remoteFamily: family, remotePort: port };
    },
    exchangeSslRequest: async () => {
      current.calls.push('exchangeSslRequest');
      return Uint8Array.of(0x53);
    },
    startTls: async ({ caSha256, servername }) => {
      current.calls.push('startTls');
      current.tlsTransitionCount += 1;
      return {
        authorized: true,
        authorizationError: null,
        caSha256,
        chainVerified: true,
        hostnameVerified: true,
        peerAddress: IPV4,
        peerFamily: 4,
        peerPort: DIRECT_POSTGRES_TARGET.port,
        protocol: 'TLSv1.3',
        servername,
      };
    },
    closeConnection: async (value) => {
      current.calls.push('closeConnection');
      current.closeInputs.push(value);
    },
    setTimer: () => {
      current.calls.push('setTimer');
      return TIMER;
    },
    clearTimer: (timer) => {
      assert.equal(timer, TIMER);
      current.calls.push('clearTimer');
      current.clearTimerCount += 1;
    },
    ...overrides,
  };
}

function options(adapters: CredentialFreeNetworkAdapters): DirectPostgresPreflightOptions {
  return { adapters, caPath: CA_PATH, caSha256: CA_SHA256, timeoutMs: 10_000 };
}

test('fails closed at CP02 when resolveDns rejects', async () => {
  const current = state();
  const adapters = fakeAdapters(current, {
    resolveDns: async () => {
      current.calls.push('resolveDns');
      throw new Error('synthetic DNS rejection');
    },
  });

  const result = await runDirectPostgresPreflight(options(adapters));

  assert.equal(result.ok, false);
  assert.equal(result.classification, 'DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE');
  assert.equal(result.failureStage, 'CP02');
  assert.deepEqual(result.stages, ['CP01', 'CP02', 'CP08']);
  assert.deepEqual(current.calls, ['readFile', 'setTimer', 'resolveDns', 'closeConnection', 'clearTimer']);
  assert.deepEqual(current.closeInputs, [undefined]);
  assert.equal(current.clearTimerCount, 1);
  assert.equal(current.calls.includes('inspectRoute'), false);
  assert.equal(current.calls.includes('connectTcp'), false);
  assert.equal(current.calls.includes('exchangeSslRequest'), false);
  assert.equal(current.calls.includes('startTls'), false);
  assert.equal(current.socketWriteCount, 0);
  assert.equal(current.tlsTransitionCount, 0);
  assert.equal(result.counters.liveNetworkActionCount, 2);
  assert.equal(result.counters.retryCount, 0);
  assert.equal(result.counters.fallbackCount, 0);
});

test('classifies a post-resolution queried hostname mismatch at CP02', async () => {
  const current = state();
  const adapters = fakeAdapters(current, {
    resolveDns: async () => {
      current.calls.push('resolveDns');
      return {
        queriedHostname: 'db.invalid.example',
        resolver: ['synthetic-resolver'],
        records: [{ address: IPV4, family: 4, ttl: 60 }],
      };
    },
  });

  const result = await runDirectPostgresPreflight(options(adapters));

  assert.equal(result.ok, false);
  assert.equal(result.classification, 'PRODUCTION_TARGET_MISMATCH');
  assert.equal(result.failureStage, 'CP02');
  assert.deepEqual(result.stages, ['CP01', 'CP02', 'CP08']);
  assert.deepEqual(current.calls, ['readFile', 'setTimer', 'resolveDns', 'closeConnection', 'clearTimer']);
  assert.deepEqual(current.closeInputs, [undefined]);
  assert.equal(current.clearTimerCount, 1);
  assert.equal(current.calls.includes('inspectRoute'), false);
  assert.equal(current.calls.includes('connectTcp'), false);
  assert.equal(current.calls.includes('exchangeSslRequest'), false);
  assert.equal(current.calls.includes('startTls'), false);
  assert.equal(current.socketWriteCount, 0);
  assert.equal(current.tlsTransitionCount, 0);
  assert.equal(result.counters.liveNetworkActionCount, 2);
  assert.equal(result.counters.retryCount, 0);
  assert.equal(result.counters.fallbackCount, 0);
});

test('rejects altered CP05 bytes before write and performs CP08 cleanup', async () => {
  const current = state();
  const adapters = fakeAdapters(current, {
    exchangeSslRequest: async ({ request }) => {
      current.calls.push('exchangeSslRequest');
      const altered = Buffer.from(request);
      altered[0] = 0xff;
      writeCanonicalPostgresSslRequest(altered, () => {
        current.socketWriteCount += 1;
      });
      return Uint8Array.of(0x53);
    },
  });

  const result = await runDirectPostgresPreflight(options(adapters));

  assert.equal(result.ok, false);
  assert.equal(result.classification, 'PRODUCTION_TLS_REQUIRED');
  assert.equal(result.failureStage, 'CP05');
  assert.deepEqual(result.stages, ['CP01', 'CP02', 'CP03', 'CP04', 'CP05', 'CP08']);
  assert.equal(current.socketWriteCount, 0);
  assert.equal(current.tlsTransitionCount, 0);
  assert.equal(current.calls.includes('startTls'), false);
  assert.equal(current.closeInputs.length, 1);
  assert.equal(current.clearTimerCount, 1);
});
