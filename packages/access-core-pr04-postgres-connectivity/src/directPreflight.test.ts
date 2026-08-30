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
import { __windowsRouteCatalogTest } from './index';
import { writeCanonicalPostgresSslRequest } from './postgresSslRequest';

const CA_PATH =
  'C:\\Users\\mateo\\AppData\\Local\\Tairet\\access-core-046-049-production-ca-acquisition-fd54f57f\\official-source\\prod-ca-2021.crt';
const CA_SHA256 = '700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7';
const CA_BYTES = readFileSync(CA_PATH);
const IPV4 = '1.1.1.1';
const ROUTE_TARGET = '32.186.245.227';
const TIMER = Symbol('synthetic-timer');

type RouteTestDependencies = NonNullable<
  Parameters<typeof __windowsRouteCatalogTest.inspect>[2]
>;

const TEST_ROUTE_IDENTITY = Object.freeze({
  ...__windowsRouteCatalogTest.boundExecutable,
  device: 'test-device',
  inode: 'test-inode',
  regularFile: true as const,
  reparse: false as const,
});

const ROUTE_SEPARATOR = '===========================================================================';

function routePrintSections(
  activeRows: readonly string[],
  persistentRows: readonly string[],
): string {
  return [
    ROUTE_SEPARATOR,
    'LISTA LOCALIZADA DE INTERFACES',
    ROUTE_SEPARATOR,
    'TABLA LOCALIZADA IPV4',
    ROUTE_SEPARATOR,
    'SECCION LOCALIZADA DE RUTAS ACTIVAS',
    'DESTINO MASCARA PUERTA INTERFAZ METRICA',
    ...activeRows,
    ROUTE_SEPARATOR,
    'SECCION LOCALIZADA DE RUTAS PERSISTENTES',
    'DESTINO MASCARA PUERTA METRICA',
    ...persistentRows,
    ROUTE_SEPARATOR,
  ].join('\r\n');
}

function routePrint(...activeRows: readonly string[]): string {
  return routePrintSections(activeRows, ['0.0.0.0 0.0.0.0 192.168.1.1 1']);
}

function routeDependencies(
  stdout: string,
  processFailure?: 'CATALOG_ACQUISITION_FAILURE' | 'PERMISSION_ACCESS_FAILURE',
): RouteTestDependencies {
  return {
    validateExecutable: async () => ({ ok: true, identity: TEST_ROUTE_IDENTITY }),
    runProcess: async () =>
      processFailure === undefined
        ? { ok: true, stdout: Buffer.from(stdout, 'latin1') }
        : { ok: false, classification: processFailure },
  };
}

async function inspectRouteFixture(
  stdout: string,
  processFailure?: 'CATALOG_ACQUISITION_FAILURE' | 'PERMISSION_ACCESS_FAILURE',
) {
  return __windowsRouteCatalogTest.inspect(
    ROUTE_TARGET,
    new AbortController().signal,
    routeDependencies(stdout, processFailure),
  );
}

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

test('retains the historical empty-address and null-metric PowerShell defect only as inert regression evidence', async () => {
  const historicalOutput = JSON.stringify({ SourceAddress: '', RouteMetric: null });
  assert.equal(Number(JSON.parse(historicalOutput).RouteMetric), 0);

  const result = await inspectRouteFixture(historicalOutput);

  assert.equal(result.classification, 'SCHEMA_FAILURE');
  assert.equal(result.candidateCount, 0);
});

test('selects a valid default route for the historical target', async () => {
  const result = await inspectRouteFixture(
    routePrint('0.0.0.0 0.0.0.0 192.168.1.1 192.168.1.20 25'),
  );

  if (result.classification !== 'VALID_SELECTED_ROUTE') assert.fail(result.classification);
  assert.equal(result.candidateCount, 1);
  assert.equal(result.selected.prefixLength, 0);
  assert.equal(result.selected.metric, 25);
  assert.equal(result.selected.sourceAddress, '192.168.1.20');
});

test('selects the longest matching prefix over a default route', async () => {
  const result = await inspectRouteFixture(
    routePrint(
      '0.0.0.0 0.0.0.0 192.168.1.1 192.168.1.20 5',
      '32.186.0.0 255.255.0.0 En vinculo local 192.168.1.20 50',
    ),
  );

  if (result.classification !== 'VALID_SELECTED_ROUTE') assert.fail(result.classification);
  assert.equal(result.candidateCount, 2);
  assert.equal(result.selected.network, '32.186.0.0');
  assert.equal(result.selected.prefixLength, 16);
  assert.equal(result.selected.metric, 50);
});

test('selects the lowest metric among routes with the same prefix length', async () => {
  const result = await inspectRouteFixture(
    routePrint(
      '32.186.0.0 255.255.0.0 192.168.1.1 192.168.1.20 20',
      '32.186.0.0 255.255.0.0 192.168.1.2 192.168.1.21 5',
    ),
  );

  if (result.classification !== 'VALID_SELECTED_ROUTE') assert.fail(result.classification);
  assert.equal(result.candidateCount, 2);
  assert.equal(result.selected.metric, 5);
  assert.equal(result.selected.sourceAddress, '192.168.1.21');
});

test('fails closed on distinct equal-ranked routes', async () => {
  const result = await inspectRouteFixture(
    routePrint(
      '32.186.0.0 255.255.0.0 192.168.1.1 192.168.1.20 5',
      '32.186.0.0 255.255.0.0 192.168.1.2 192.168.1.21 5',
    ),
  );

  assert.equal(result.classification, 'AMBIGUOUS');
  assert.equal(result.candidateCount, 2);
});

test('deduplicates byte-identical equal-ranked route rows without inventing a tie-break', async () => {
  const row = '32.186.0.0 255.255.0.0 192.168.1.1 192.168.1.20 5';
  const result = await inspectRouteFixture(routePrint(row, row));

  if (result.classification !== 'VALID_SELECTED_ROUTE') assert.fail(result.classification);
  assert.equal(result.candidateCount, 2);
  assert.equal(result.selected.metric, 5);
});

test('rejects null, empty, nonnumeric, signed, negative, and fractional metrics without coercion', async () => {
  const invalidMetrics = ['null', '', 'NaN', '+1', '-1', '1.5'];
  for (const metric of invalidMetrics) {
    const result = await inspectRouteFixture(
      routePrint(
        '0.0.0.0 0.0.0.0 192.168.1.1 192.168.1.20 25',
        `32.186.0.0 255.255.0.0 192.168.1.1 192.168.1.20 ${metric}`,
      ),
    );
    assert.equal(result.classification, 'SCHEMA_FAILURE', metric);
  }
});

test('rejects malformed, noncontiguous, and noncanonical route masks', async () => {
  const invalidRows = [
    '32.186.0.0 255.0.255.0 192.168.1.1 192.168.1.20 5',
    '32.186.0.0 255.255.999.0 192.168.1.1 192.168.1.20 5',
    '32.186.1.0 255.255.0.0 192.168.1.1 192.168.1.20 5',
  ];
  for (const row of invalidRows) {
    const result = await inspectRouteFixture(
      routePrint('0.0.0.0 0.0.0.0 192.168.1.1 192.168.1.20 25', row),
    );
    assert.equal(result.classification, 'SCHEMA_FAILURE', row);
  }
});

test('fails the whole catalog when an active row is missing its metric despite a valid default', async () => {
  const result = await inspectRouteFixture(
    routePrint(
      '0.0.0.0 0.0.0.0 192.168.1.1 192.168.1.20 25',
      '32.186.0.0 255.255.0.0 192.168.1.1 192.168.1.20',
    ),
  );

  assert.equal(result.classification, 'SCHEMA_FAILURE');
});

test('fails closed when an active row is missing its source or interface field', async () => {
  const result = await inspectRouteFixture(
    routePrint(
      '0.0.0.0 0.0.0.0 192.168.1.1 192.168.1.20 25',
      '32.186.0.0 255.255.0.0 192.168.1.1 5',
    ),
  );

  assert.equal(result.classification, 'SCHEMA_FAILURE');
});

test('does not silently classify a four-token route-like row in the active section as persistent', async () => {
  const result = await inspectRouteFixture(
    routePrint(
      '0.0.0.0 0.0.0.0 192.168.1.1 192.168.1.20 25',
      '32.186.0.0 255.255.0.0 192.168.1.1 1',
    ),
  );

  assert.equal(result.classification, 'SCHEMA_FAILURE');
});

test('fails closed on a four-token route-like row before an active section is proven', async () => {
  const unproven = [
    ROUTE_SEPARATOR,
    'BLOQUE LOCALIZADO TODAVIA NO PROBADO',
    '32.186.0.0 255.255.0.0 192.168.1.1 1',
    ROUTE_SEPARATOR,
  ].join('\r\n');

  const result = await inspectRouteFixture(unproven);

  assert.equal(result.classification, 'SCHEMA_FAILURE');
});

test('ignores a valid persistent row only after the structural persistent-section transition', async () => {
  const result = await inspectRouteFixture(
    routePrintSections(
      ['0.0.0.0 0.0.0.0 192.168.1.1 192.168.1.20 25'],
      ['32.186.0.0 255.255.0.0 192.168.1.1 1'],
    ),
  );

  if (result.classification !== 'VALID_SELECTED_ROUTE') assert.fail(result.classification);
  assert.equal(result.candidateCount, 1);
  assert.equal(result.selected.prefixLength, 0);
  assert.equal(result.selected.metric, 25);
});

test('parses valid active rows and excludes valid persistent rows from selection', async () => {
  const result = await inspectRouteFixture(
    routePrintSections(
      [
        '0.0.0.0 0.0.0.0 192.168.1.1 192.168.1.20 25',
        '32.186.0.0 255.255.0.0 ENLACE DIRECTO 192.168.1.20 5',
      ],
      ['0.0.0.0 0.0.0.0 192.168.1.254 1'],
    ),
  );

  if (result.classification !== 'VALID_SELECTED_ROUTE') assert.fail(result.classification);
  assert.equal(result.candidateCount, 2);
  assert.equal(result.selected.prefixLength, 16);
  assert.equal(result.selected.metric, 5);
});

test('parses localized structural sections and a multiword on-link marker without heading literals', async () => {
  const result = await inspectRouteFixture(
    routePrintSections(
      ['0.0.0.0 0.0.0.0 ENLACE LOCAL DIRECTO 192.168.1.20 25'],
      [],
    ),
  );

  if (result.classification !== 'VALID_SELECTED_ROUTE') assert.fail(result.classification);
  assert.equal(result.selected.prefixLength, 0);
  assert.equal(result.selected.gateway, 'ENLACE LOCAL DIRECTO');
});

test('distinguishes catalog acquisition failure after pre and post identity validation', async () => {
  const result = await inspectRouteFixture(
    routePrint('0.0.0.0 0.0.0.0 192.168.1.1 192.168.1.20 25'),
    'CATALOG_ACQUISITION_FAILURE',
  );

  assert.equal(result.classification, 'CATALOG_ACQUISITION_FAILURE');
  assert.equal(result.validationCount, 2);
});

test('distinguishes permission and access failure without exposing host diagnostics', async () => {
  const result = await inspectRouteFixture(
    routePrint('0.0.0.0 0.0.0.0 192.168.1.1 192.168.1.20 25'),
    'PERMISSION_ACCESS_FAILURE',
  );

  assert.equal(result.classification, 'PERMISSION_ACCESS_FAILURE');
  assert.equal(Object.keys(result).includes('error'), false);
});

test('distinguishes successfully acquired malformed output as schema failure', async () => {
  const result = await inspectRouteFixture('localized headings only\r\nno structural records');

  assert.equal(result.classification, 'SCHEMA_FAILURE');
  assert.equal(result.validationCount, 2);
});

test('distinguishes an acquired valid catalog with no matching route', async () => {
  const result = await inspectRouteFixture(
    routePrint('10.0.0.0 255.0.0.0 10.0.0.1 10.0.0.20 5'),
  );

  assert.equal(result.classification, 'NO_MATCH');
  assert.equal(result.candidateCount, 0);
});

test('binds one absolute route.exe invocation with no PowerShell fallback, shell, or stdin program', async () => {
  const indexSource = readFileSync(`${__dirname}\\index.ts`, 'utf8');
  assert.doesNotMatch(indexSource, /Find-NetRoute|powershell\.exe/iu);
  assert.equal(__windowsRouteCatalogTest.processSpec.executable, 'C:\\Windows\\System32\\route.exe');
  assert.deepEqual(__windowsRouteCatalogTest.processSpec.args, ['PRINT', '-4']);
  assert.equal(__windowsRouteCatalogTest.processSpec.shell, false);
  assert.equal(__windowsRouteCatalogTest.processSpec.stdin, 'ignore');

  let invocationCount = 0;
  let observedSpec: unknown;
  const dependencies: RouteTestDependencies = {
    validateExecutable: async () => ({ ok: true, identity: TEST_ROUTE_IDENTITY }),
    runProcess: async (spec) => {
      invocationCount += 1;
      observedSpec = spec;
      return {
        ok: true,
        stdout: Buffer.from(
          routePrint('0.0.0.0 0.0.0.0 192.168.1.1 192.168.1.20 25'),
          'latin1',
        ),
      };
    },
  };
  const result = await __windowsRouteCatalogTest.inspect(
    ROUTE_TARGET,
    new AbortController().signal,
    dependencies,
  );

  assert.equal(result.classification, 'VALID_SELECTED_ROUTE');
  assert.equal(invocationCount, 1);
  assert.deepEqual(observedSpec, __windowsRouteCatalogTest.processSpec);
});

test('revalidates executable identity before and after invocation and fails closed on drift', async () => {
  let validationCount = 0;
  const dependencies: RouteTestDependencies = {
    validateExecutable: async () => {
      validationCount += 1;
      return {
        ok: true,
        identity:
          validationCount === 1
            ? TEST_ROUTE_IDENTITY
            : { ...TEST_ROUTE_IDENTITY, inode: 'drifted-test-inode' },
      };
    },
    runProcess: async () => ({
      ok: true,
      stdout: Buffer.from(
        routePrint('0.0.0.0 0.0.0.0 192.168.1.1 192.168.1.20 25'),
        'latin1',
      ),
    }),
  };

  const result = await __windowsRouteCatalogTest.inspect(
    ROUTE_TARGET,
    new AbortController().signal,
    dependencies,
  );

  assert.equal(validationCount, 2);
  assert.equal(result.classification, 'CATALOG_ACQUISITION_FAILURE');
  assert.equal(result.validationCount, 2);
});
