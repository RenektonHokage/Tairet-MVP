import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  DIRECT_POSTGRES_TARGET,
  isGloballyReachableIpv4,
  runDirectPostgresPreflight,
  type CredentialFreeNetworkAdapters,
  type DirectPostgresPreflightOptions,
} from './directPostgresPreflight';

const CA_PATH =
  'C:\\Users\\mateo\\AppData\\Local\\Tairet\\access-core-046-049-production-ca-acquisition-fd54f57f\\official-source\\prod-ca-2021.crt';
const CA_SHA256 = '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7';
const CA_BYTES = readFileSync(CA_PATH);
const IPV4 = '1.1.1.1';
const ALTERNATE_IPV4 = '8.8.4.4';
const IPV6 = '2606:4700:4700::1111';

const NON_GLOBAL_IPV4_CASES = [
  ['UNSPECIFIED_THIS_NETWORK', '0.0.0.0'],
  ['UNSPECIFIED_THIS_NETWORK', '0.1.2.3'],
  ['PRIVATE', '10.0.0.1'],
  ['PRIVATE', '172.16.0.1'],
  ['PRIVATE', '192.168.0.1'],
  ['SHARED_CGNAT', '100.64.0.1'],
  ['LOOPBACK', '127.0.0.1'],
  ['LINK_LOCAL', '169.254.1.1'],
  ['IETF_SPECIAL_NON_GLOBAL', '192.0.0.1'],
  ['IETF_SPECIAL_NON_GLOBAL', '192.0.0.8'],
  ['IETF_SPECIAL_NON_GLOBAL', '192.0.0.170'],
  ['DOCUMENTATION', '192.0.2.1'],
  ['DOCUMENTATION', '198.51.100.1'],
  ['DOCUMENTATION', '203.0.113.1'],
  ['DEPRECATED_NON_GLOBAL_SPECIAL', '192.88.99.2'],
  ['BENCHMARKING', '198.18.0.1'],
  ['MULTICAST', '224.0.0.1'],
  ['MULTICAST', '239.255.255.255'],
  ['RESERVED', '240.0.0.1'],
  ['RESERVED', '255.255.255.254'],
  ['LIMITED_BROADCAST', '255.255.255.255'],
] as const;

type FakeState = {
  calls: string[];
  closeCount: number;
  lastRequest?: Uint8Array;
};

function fakeAdapters(
  state: FakeState,
  overrides: Partial<CredentialFreeNetworkAdapters> = {},
): CredentialFreeNetworkAdapters {
  const connection = { synthetic: true };
  let connectedAddress = IPV4;
  let connectedFamily: 4 | 6 = 4;
  return {
    readFile: async () => CA_BYTES,
    resolveDns: async ({ hostname }) => {
      state.calls.push('resolveDns');
      return {
        queriedHostname: hostname,
        resolver: ['synthetic-resolver'],
        records: [{ address: IPV4, family: 4, ttl: 60 }],
      };
    },
    inspectRoute: async ({ address, family }) => {
      state.calls.push('inspectRoute');
      return { address, family, usable: true, metric: 10 };
    },
    connectTcp: async ({ address, family, port }) => {
      state.calls.push('connectTcp');
      connectedAddress = address;
      connectedFamily = family;
      return { connection, remoteAddress: address, remoteFamily: family, remotePort: port };
    },
    exchangeSslRequest: async ({ request }) => {
      state.calls.push('exchangeSslRequest');
      state.lastRequest = request;
      return Uint8Array.of(0x53);
    },
    startTls: async ({ caSha256, servername }) => {
      state.calls.push('startTls');
      return {
        authorized: true,
        authorizationError: null,
        caSha256,
        chainVerified: true,
        hostnameVerified: true,
        peerAddress: connectedAddress,
        peerFamily: connectedFamily,
        peerPort: DIRECT_POSTGRES_TARGET.port,
        protocol: 'TLSv1.3',
        servername,
        cipher: 'TLS_AES_256_GCM_SHA384',
        peerCertificateSha256: 'a'.repeat(64),
      };
    },
    closeConnection: async () => {
      state.calls.push('closeConnection');
      state.closeCount += 1;
    },
    setTimer: () => Symbol('timer'),
    clearTimer: () => undefined,
    ...overrides,
  };
}

function options(adapters: CredentialFreeNetworkAdapters): DirectPostgresPreflightOptions {
  return { adapters, caPath: CA_PATH, caSha256: CA_SHA256, timeoutMs: 10_000 };
}

function state(): FakeState {
  return { calls: [], closeCount: 0 };
}

test('accepts, normalizes, deduplicates, and orders A-only DNS answers deterministically', async () => {
  const current = state();
  const adapters = fakeAdapters(current, {
    resolveDns: async ({ hostname }) => ({
      queriedHostname: hostname,
      resolver: ['z-resolver', 'a-resolver', 'a-resolver'],
      records: [
        { address: '8.8.8.8', family: 4, ttl: 120 },
        { address: IPV4, family: 4, ttl: 60 },
        { address: '8.8.8.8', family: 4, ttl: 30 },
      ],
    }),
  });
  const result = await runDirectPostgresPreflight(options(adapters));
  assert.equal(result.ok, true);
  assert.deepEqual(result.dns?.resolver, ['a-resolver', 'z-resolver']);
  assert.deepEqual(result.dns?.records, [
    { address: IPV4, family: 4, ttl: 60 },
    { address: '8.8.8.8', family: 4, ttl: 30 },
  ]);
  assert.equal(result.selectedRoute?.family, 4);
  assert.equal(isGloballyReachableIpv4(result.selectedRoute?.address ?? ''), true);
});

test('fails closed when DNS returns no address', async () => {
  const current = state();
  const adapters = fakeAdapters(current, {
    resolveDns: async ({ hostname }) => ({ queriedHostname: hostname, resolver: [], records: [] }),
  });
  const result = await runDirectPostgresPreflight(options(adapters));
  assert.equal(result.classification, 'DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE');
  assert.equal(result.failureStage, 'CP03');
  assert.deepEqual(result.stages, ['CP01', 'CP02', 'CP03', 'CP08']);
  assert.equal(current.closeCount, 1);
  assert.equal(current.calls.includes('connectTcp'), false);
});

test('rejects an IPv6-only DNS answer at the CP03 family gate', async () => {
  const current = state();
  const adapters = fakeAdapters(current, {
    resolveDns: async ({ hostname }) => ({
      queriedHostname: hostname,
      resolver: [],
      records: [{ address: IPV6, family: 6, ttl: 60 }],
    }),
  });
  const result = await runDirectPostgresPreflight(options(adapters));
  assert.equal(result.classification, 'DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE');
  assert.equal(result.failureStage, 'CP03');
  assert.deepEqual(result.stages, ['CP01', 'CP02', 'CP03', 'CP08']);
  assert.equal(current.calls.includes('inspectRoute'), false);
  assert.equal(current.calls.includes('connectTcp'), false);
});

test('rejects a dual-stack DNS answer at the CP03 family gate', async () => {
  const current = state();
  const adapters = fakeAdapters(current, {
    resolveDns: async ({ hostname }) => ({
      queriedHostname: hostname,
      resolver: [],
      records: [
        { address: IPV4, family: 4, ttl: 60 },
        { address: IPV6, family: 6, ttl: 60 },
      ],
    }),
  });
  const result = await runDirectPostgresPreflight(options(adapters));
  assert.equal(result.classification, 'PRODUCTION_TARGET_MISMATCH');
  assert.equal(result.failureStage, 'CP03');
  assert.deepEqual(result.stages, ['CP01', 'CP02', 'CP03', 'CP08']);
  assert.equal(current.calls.includes('inspectRoute'), false);
  assert.equal(current.calls.includes('connectTcp'), false);
});

for (const [category, address] of NON_GLOBAL_IPV4_CASES) {
  test(`rejects ${category} IPv4 address ${address}`, async () => {
    assert.equal(isGloballyReachableIpv4(address), false);
    const current = state();
    const adapters = fakeAdapters(current, {
      resolveDns: async ({ hostname }) => ({
        queriedHostname: hostname,
        resolver: [],
        records: [{ address, family: 4, ttl: 60 }],
      }),
    });
    const result = await runDirectPostgresPreflight(options(adapters));
    assert.equal(result.classification, 'PRODUCTION_TARGET_MISMATCH');
    assert.equal(result.ok, false);
    assert.equal(current.calls.includes('connectTcp'), false);
  });
}

test('rejects invalid or ambiguous IPv4 syntax deterministically', () => {
  for (const address of ['', '1.2.3', '1.2.3.999', '01.2.3.4', IPV6]) {
    assert.equal(isGloballyReachableIpv4(address), false);
  }
});

test('uses the most-specific IANA prefix over the non-global 192.0.0.0/24 parent', () => {
  assert.equal(isGloballyReachableIpv4('192.0.0.8'), false);
  assert.equal(isGloballyReachableIpv4('192.0.0.9'), true);
  assert.equal(isGloballyReachableIpv4('192.0.0.10'), true);
  assert.equal(isGloballyReachableIpv4('192.0.0.11'), false);
});

for (const address of ['192.0.0.9', '192.0.0.10']) {
  test(`accepts globally reachable most-specific IANA exception ${address}`, async () => {
    assert.equal(isGloballyReachableIpv4(address), true);
    const current = state();
    const adapters = fakeAdapters(current, {
      resolveDns: async ({ hostname }) => ({
        queriedHostname: hostname,
        resolver: [],
        records: [{ address, family: 4, ttl: 60 }],
      }),
    });
    const result = await runDirectPostgresPreflight(options(adapters));
    assert.equal(result.classification, 'DIRECT_POSTGRES_PREFLIGHT_PASS');
    assert.equal(result.selectedRoute?.address, address);
  });
}

test('rejects a mixed globally reachable and non-global A set without discarding either record', async () => {
  const current = state();
  const adapters = fakeAdapters(current, {
    resolveDns: async ({ hostname }) => ({
      queriedHostname: hostname,
      resolver: [],
      records: [
        { address: IPV4, family: 4, ttl: 60 },
        { address: '192.0.2.1', family: 4, ttl: 60 },
      ],
    }),
  });
  const result = await runDirectPostgresPreflight(options(adapters));
  assert.equal(result.classification, 'PRODUCTION_TARGET_MISMATCH');
  assert.equal(result.failureStage, 'CP03');
  assert.equal(result.dns?.records.length, 2);
  assert.equal(current.calls.includes('inspectRoute'), false);
  assert.equal(current.calls.includes('connectTcp'), false);
});

test('rejects a route address absent from the resolved A set', async () => {
  const current = state();
  const adapters = fakeAdapters(current, {
    inspectRoute: async ({ family }) => ({
      address: ALTERNATE_IPV4,
      family,
      usable: true,
      metric: 10,
    }),
  });
  const result = await runDirectPostgresPreflight(options(adapters));
  assert.equal(result.classification, 'PRODUCTION_TARGET_MISMATCH');
  assert.equal(result.failureStage, 'CP03');
  assert.equal(current.calls.includes('connectTcp'), false);
});

test('accepts a rotated public IPv4 A value without pinning the materialization-time address', async () => {
  const current = state();
  const adapters = fakeAdapters(current, {
    resolveDns: async ({ hostname }) => ({
      queriedHostname: hostname,
      resolver: [],
      records: [{ address: ALTERNATE_IPV4, family: 4, ttl: 60 }],
    }),
  });
  const result = await runDirectPostgresPreflight(options(adapters));
  assert.equal(result.classification, 'DIRECT_POSTGRES_PREFLIGHT_PASS');
  assert.equal(result.selectedRoute?.address, ALTERNATE_IPV4);
  assert.equal(result.selectedRoute?.family, 4);
  assert.equal(isGloballyReachableIpv4(ALTERNATE_IPV4), true);
});

test('rejects a route adapter claim whose selected family is IPv6', async () => {
  const current = state();
  const adapters = fakeAdapters(current, {
    inspectRoute: async ({ address }) => ({ address, family: 6, usable: true, metric: 10 }),
  });
  const result = await runDirectPostgresPreflight(options(adapters));
  assert.equal(result.classification, 'PRODUCTION_TARGET_MISMATCH');
  assert.equal(result.failureStage, 'CP03');
  assert.deepEqual(result.stages, ['CP01', 'CP02', 'CP03', 'CP08']);
  assert.equal(current.calls.includes('connectTcp'), false);
});

test('uses one TCP attempt and performs zero retry or fallback on timeout', async () => {
  const current = state();
  let connectCount = 0;
  const adapters = fakeAdapters(current, {
    connectTcp: async () => {
      connectCount += 1;
      throw new Error('synthetic timeout');
    },
  });
  const result = await runDirectPostgresPreflight(options(adapters));
  assert.equal(result.classification, 'DIRECT_PRODUCTION_CATALOG_CHANNEL_UNAVAILABLE');
  assert.equal(connectCount, 1);
  assert.equal(result.counters.retryCount, 0);
  assert.equal(result.counters.fallbackCount, 0);
  assert.equal(current.closeCount, 1);
});

test('rejects an invalid SSLRequest response and never starts TLS', async () => {
  const current = state();
  const adapters = fakeAdapters(current, {
    exchangeSslRequest: async () => Uint8Array.of(0x4e),
  });
  const result = await runDirectPostgresPreflight(options(adapters));
  assert.equal(result.classification, 'PRODUCTION_TLS_REQUIRED');
  assert.deepEqual(result.stages, ['CP01', 'CP02', 'CP03', 'CP04', 'CP05', 'CP08']);
  assert.equal(current.calls.includes('startTls'), false);
  assert.equal(current.closeCount, 1);
});

test('rejects TLS trust failure', async () => {
  const current = state();
  const adapters = fakeAdapters(current, {
    startTls: async ({ caSha256, servername }) => ({
      authorized: false,
      authorizationError: 'TLS_AUTHORIZATION_ERROR',
      caSha256,
      chainVerified: false,
      hostnameVerified: false,
      peerAddress: IPV4,
      peerFamily: 4,
      peerPort: 5432,
      protocol: 'TLSv1.3',
      servername,
    }),
  });
  const result = await runDirectPostgresPreflight(options(adapters));
  assert.equal(result.classification, 'PRODUCTION_TLS_IDENTITY_MISMATCH');
  assert.equal(result.failureStage, 'CP06');
  assert.equal(current.closeCount, 1);
});

test('rejects hostname mismatch at CP07', async () => {
  const current = state();
  const adapters = fakeAdapters(current, {
    startTls: async ({ caSha256, servername }) => ({
      authorized: true,
      authorizationError: null,
      caSha256,
      chainVerified: true,
      hostnameVerified: false,
      peerAddress: IPV4,
      peerFamily: 4,
      peerPort: 5432,
      protocol: 'TLSv1.2',
      servername,
    }),
  });
  const result = await runDirectPostgresPreflight(options(adapters));
  assert.equal(result.classification, 'PRODUCTION_TLS_IDENTITY_MISMATCH');
  assert.equal(result.failureStage, 'CP07');
  assert.equal(current.closeCount, 1);
});

test('passes CP01 through CP08 with only the SSLRequest bytes', async () => {
  const current = state();
  const result = await runDirectPostgresPreflight(options(fakeAdapters(current)));
  assert.equal(result.classification, 'DIRECT_POSTGRES_PREFLIGHT_PASS');
  assert.deepEqual(result.stages, ['CP01', 'CP02', 'CP03', 'CP04', 'CP05', 'CP06', 'CP07', 'CP08']);
  assert.equal(Buffer.from(current.lastRequest ?? []).toString('hex'), '0000000804d2162f');
  assert.deepEqual(result.counters, {
    authenticationAttemptCount: 0,
    closeControlCount: 1,
    credentialAccessCount: 0,
    databaseMutationCount: 0,
    fallbackCount: 0,
    liveNetworkActionCount: 7,
    psqlInvocationCount: 0,
    retryCount: 0,
    sqlMessageCount: 0,
    startupMessageCount: 0,
  });
  assert.equal(current.closeCount, 1);
});

test('rejects credential or target-shaped extra options before DNS', async () => {
  const current = state();
  const closed = {
    ...options(fakeAdapters(current)),
    password: 'must-not-be-read',
  } as unknown as DirectPostgresPreflightOptions;
  const result = await runDirectPostgresPreflight(closed);
  assert.equal(result.classification, 'PRODUCTION_ENTRYPOINT_INPUT_NOT_CLOSED');
  assert.deepEqual(result.stages, ['CP08']);
  assert.equal(current.calls.includes('resolveDns'), false);
  assert.equal(result.counters.credentialAccessCount, 0);
  assert.equal(current.closeCount, 1);
});

test('fails before DNS when the CA identity differs', async () => {
  const current = state();
  const result = await runDirectPostgresPreflight({
    ...options(fakeAdapters(current)),
    caSha256: '0'.repeat(64),
  });
  assert.equal(result.classification, 'PRODUCTION_CA_AUTHORITY_MISMATCH');
  assert.deepEqual(result.stages, ['CP08']);
  assert.equal(current.calls.includes('resolveDns'), false);
  assert.equal(current.closeCount, 1);
});
